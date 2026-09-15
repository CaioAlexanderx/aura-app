// ============================================================
// AURA. — Ótica: nova OS de óculos
//
// Momento: o cliente escolheu a armação, o vendedor está com a receita do
// médico na mão e vai fechar o par. Diferente da OS de conserto, aqui a
// VENDA NASCE JUNTO COM A OS: o cliente paga um sinal, o saldo vence na
// data prometida e as lentes só existem depois. Por isso a sequência ao
// salvar é (1) receita nova, se houver → (2) venda com sinal no PDV →
// (3) OS kind='otica' apontando pra venda (deposit_sale_id).
//
// Se a venda passou e a OS falhou (rede, 409 do backend), a venda fica
// guardada em `depositSaleId` e o botão vira "tentar abrir a OS de novo"
// SEM cobrar o sinal outra vez.
//
// Formulário aberto numa tela, sem wizard (mockup docs/mockups/
// otica-modulo.html, tela 2; memória app#859: wizard reprovado). A grade
// OD/OE espelha o papel do médico.
//
// Fora daqui, de propósito: recomendação automática de lente ao cliente
// (Decreto 24.492, art. 13 — a ótica não aconselha lente).
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useCustomers } from "@/hooks/useCustomers";
import { useProducts } from "@/hooks/useProducts";
import { pdvApi } from "@/services/pdvApi";
import { serviceOrdersApi, type ServiceOrderItem } from "@/services/serviceOrdersApi";
import {
  oticaApi, OTICA_SETTINGS_DEFAULTS, LENS_USES, LENS_USE_LABEL, LENS_TREATMENTS,
  type Prescription, type LensUse, type OpticalDetails,
  columnsToEyes, eyesToColumns, fmtIsoDate, fmtEyeShort, parseBrDate, daysUntil, todayIso,
} from "@/services/oticaApi";
import { RxGrid } from "@/components/otica/RxGrid";
import { RxEditor, emptyRxDraft, validateRxDraft, type RxDraft } from "@/components/otica/RxEditor";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function parseMoney(s: string): number {
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return isFinite(n) && n >= 0 ? n : 0;
}

function addDaysIso(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type SinalMethod = "pix" | "dinheiro" | "cartao" | "debito";
const SINAL_METHODS: { key: SinalMethod; label: string }[] = [
  { key: "pix", label: "Pix" }, { key: "dinheiro", label: "Dinheiro" }, { key: "cartao", label: "Cartão" }, { key: "debito", label: "Débito" },
];

export default function OticaNovaScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ customer_id?: string }>();
  const { customers } = useCustomers();
  const { products } = useProducts();

  const { data: settingsData } = useQuery({
    queryKey: ["otica-settings", company?.id],
    queryFn: () => oticaApi.getSettings(company!.id),
    enabled: !!company?.id,
    staleTime: 300_000,
  });
  const settings = settingsData?.settings || OTICA_SETTINGS_DEFAULTS;

  const { data: labsData } = useQuery({
    queryKey: ["otica-labs", company?.id],
    queryFn: () => oticaApi.listLabs(company!.id),
    enabled: !!company?.id,
    staleTime: 300_000,
  });
  const labs = (labsData?.labs || []).filter((l) => l.is_active);

  // ── Cliente ──
  const [customerId, setCustomerId] = useState<string | null>(params.customer_id || null);
  const [customerName, setCustomerName] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return customers.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q)).slice(0, 6);
  }, [customers, customerQuery]);
  useEffect(() => {
    if (customerId && !customerName) {
      const c = customers.find((x) => x.id === customerId);
      if (c) setCustomerName(c.name);
    }
  }, [customerId, customerName, customers]);

  // ── Receita ──
  const { data: rxData } = useQuery({
    queryKey: ["otica-prescriptions", company?.id, customerId],
    queryFn: () => oticaApi.listPrescriptions(company!.id, { customer_id: customerId!, limit: 10 }),
    enabled: !!company?.id && !!customerId,
  });
  const prescriptions: Prescription[] = rxData?.prescriptions || [];
  const [rxMode, setRxMode] = useState<"existente" | "nova">("nova");
  const [rxId, setRxId] = useState<string | null>(null);
  const [rxDraft, setRxDraft] = useState<RxDraft>(() => emptyRxDraft(settings.prescription_validity_months));
  // Receita registrada por ESTA tela numa tentativa que falhou depois.
  const [createdRx, setCreatedRx] = useState<Prescription | null>(null);
  useEffect(() => {
    // Cliente com receita válida: usa a mais recente por padrão. Sem receita
    // (ou vencida), digita nova.
    const valid = prescriptions.find((p) => (daysUntil(p.valid_until) ?? -1) >= 0);
    if (valid) { setRxMode("existente"); setRxId(valid.id); }
    else { setRxMode("nova"); setRxId(null); }
  }, [prescriptions.length, customerId]); // eslint-disable-line react-hooks/exhaustive-deps
  const rxSelected = prescriptions.find((p) => p.id === rxId) || null;

  // ── Armação ──
  const [frameSource, setFrameSource] = useState<"estoque" | "cliente">("estoque");
  const [frameProduct, setFrameProduct] = useState<{ id: string; name: string; price: number } | null>(null);
  const [frameQuery, setFrameQuery] = useState("");
  const [frameDesc, setFrameDesc] = useState("");
  const [framePrice, setFramePrice] = useState("");
  const frameMatches = useMemo(() => {
    const q = frameQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q)).slice(0, 6);
  }, [products, frameQuery]);

  // ── Lentes ──
  const [use, setUse] = useState<LensUse>("longe");
  const [lensType, setLensType] = useState<"pronta" | "surfacada">("surfacada");
  const [lensBrand, setLensBrand] = useState("");
  const [lensDesign, setLensDesign] = useState("");
  const [lensMaterial, setLensMaterial] = useState("");
  const [treatments, setTreatments] = useState<string[]>([]);
  const [lensPrice, setLensPrice] = useState("");
  const [servicePrice, setServicePrice] = useState("");

  // ── Laboratório e prazo ──
  const [labId, setLabId] = useState<string | null>(null);
  const [labRef, setLabRef] = useState("");
  const [promised, setPromised] = useState("");
  useEffect(() => {
    if (!labId && settings.default_lab_id && labs.some((l) => l.id === settings.default_lab_id)) setLabId(settings.default_lab_id);
  }, [settings.default_lab_id, labs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const lab = labs.find((l) => l.id === labId);
    if (lab && !promised) setPromised(fmtIsoDate(addDaysIso(lab.lead_days || 7)));
  }, [labId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sinal, garantia, observações ──
  const [sinal, setSinal] = useState("");
  const [sinalMethod, setSinalMethod] = useState<SinalMethod>("pix");
  const [adaptDays, setAdaptDays] = useState<string | null>(null);
  const [labWarranty, setLabWarranty] = useState("365");
  const [notes, setNotes] = useState("");

  const frameValue = frameSource === "estoque" ? (frameProduct?.price ?? 0) : parseMoney(framePrice);
  const total = frameValue + parseMoney(lensPrice) + parseMoney(servicePrice);
  const sinalNum = parseMoney(sinal);
  const saldo = Math.max(0, total - sinalNum);

  const [saving, setSaving] = useState(false);
  const [depositSaleId, setDepositSaleId] = useState<string | null>(null);

  function toggleTreatment(t: string) {
    setTreatments((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  // A receita congelada na OS vem OU de uma receita salva (colunas od_*/oe_*)
  // OU do rascunho digitado agora (datas em DD/MM/AAAA). O flag é explícito
  // pra não adivinhar pelo shape.
  function buildOptical(prescriptionId: string | null, source: { saved: Prescription } | { draft: RxDraft }): OpticalDetails {
    const eyes = "saved" in source ? columnsToEyes(source.saved) : { od: source.draft.od, oe: source.draft.oe };
    const d: any = "saved" in source ? source.saved : source.draft;
    return {
      prescription_id: prescriptionId,
      prescription: {
        od: eyes.od, oe: eyes.oe,
        prescriber_type: d.prescriber_type,
        prescriber_name: d.prescriber_name || null,
        prescriber_registry: d.prescriber_registry || null,
        issued_at: "saved" in source ? d.issued_at : parseBrDate(d.issued_at),
        valid_until: "saved" in source ? d.valid_until : parseBrDate(d.valid_until),
      },
      frame: {
        source: frameSource,
        product_id: frameSource === "estoque" ? (frameProduct?.id || null) : null,
        description: frameSource === "estoque" ? (frameProduct?.name || "") : frameDesc.trim(),
      },
      lens: {
        type: lensType, brand: lensBrand.trim(), design: lensDesign.trim(), material: lensMaterial.trim(),
        treatments, notes: "",
      },
      use,
      adaptation_warranty_days: parseInt(adaptDays ?? String(settings.adaptation_warranty_days), 10) || 0,
    };
  }

  async function handleSave() {
    if (!company?.id || saving) return;
    if (!customerId) { toast.error("Selecione o cliente — a receita e o sinal são dele"); return; }
    if (rxMode === "existente" && !rxSelected) { toast.error("Escolha uma receita ou digite uma nova"); return; }
    if (rxMode === "nova") {
      const err = validateRxDraft(rxDraft);
      if (err) { toast.error(err); return; }
    }
    if (frameSource === "estoque" && !frameProduct) { toast.error("Escolha a armação no estoque, ou marque \"do cliente\""); return; }
    if (frameSource === "cliente" && !frameDesc.trim()) { toast.error("Descreva a armação que o cliente trouxe"); return; }
    if (!lensBrand.trim() && !lensDesign.trim() && !lensMaterial.trim()) { toast.error("Informe ao menos a marca, o desenho ou o material da lente"); return; }
    if (promised.trim() && !parseBrDate(promised)) { toast.error("Data prometida inválida — use DD/MM/AAAA"); return; }
    if (sinalNum > 0 && sinalNum > total) { toast.error("O sinal não pode ser maior que o total"); return; }
    if (sinalNum > 0 && !promised.trim()) { toast.error("Com sinal, informe a data prometida: o saldo vence nela"); return; }

    setSaving(true);
    try {
      // (1) receita
      let prescriptionId = rxId;
      let rxSource: { saved: Prescription } | { draft: RxDraft } = rxSelected ? { saved: rxSelected } : { draft: rxDraft };
      if (rxMode === "nova" && createdRx) {
        // A receita já foi salva numa tentativa anterior que falhou depois
        // (ex.: venda ou OS recusada). Reusa em vez de registrar duas vezes.
        prescriptionId = createdRx.id;
        rxSource = { saved: createdRx };
      } else if (rxMode === "nova") {
        const created = await oticaApi.createPrescription(company.id, {
          customer_id: customerId,
          ...eyesToColumns(rxDraft.od, rxDraft.oe),
          prescriber_type: rxDraft.prescriber_type,
          prescriber_name: rxDraft.prescriber_name.trim() || null,
          prescriber_registry: rxDraft.prescriber_registry.trim() || null,
          issued_at: parseBrDate(rxDraft.issued_at)!,
          valid_until: parseBrDate(rxDraft.valid_until)!,
          notes: rxDraft.notes.trim() || null,
        });
        prescriptionId = created.prescription.id;
        rxSource = { saved: created.prescription };
        setCreatedRx(created.prescription);
        setRxMode("existente");
        setRxId(created.prescription.id);
        qc.invalidateQueries({ queryKey: ["otica-prescriptions"] });
      }

      // (2) venda com sinal (uma vez só — ver cabeçalho)
      let saleId = depositSaleId;
      const saleItems: any[] = [];
      if (frameValue > 0 || frameSource === "estoque") {
        saleItems.push(frameSource === "estoque"
          ? { product_id: frameProduct!.id, quantity: 1, unit_price: frameProduct!.price, product_name_snapshot: frameProduct!.name }
          : { quantity: 1, unit_price: frameValue, product_name_snapshot: "Armação do cliente" });
      }
      const lensName = ["Lentes", lensBrand.trim(), lensDesign.trim(), lensMaterial.trim()].filter(Boolean).join(" ");
      if (parseMoney(lensPrice) > 0) saleItems.push({ quantity: 1, unit_price: parseMoney(lensPrice), product_name_snapshot: lensName });
      if (parseMoney(servicePrice) > 0) saleItems.push({ quantity: 1, unit_price: parseMoney(servicePrice), product_name_snapshot: "Montagem" });

      if (!saleId && sinalNum > 0 && total > 0) {
        const sale = await pdvApi.createSaleComSinal(company.id, {
          items: saleItems.filter((i) => i.unit_price > 0),
          customer_id: customerId,
          notes: "Óculos — sinal na abertura da OS",
          sinal: { method: sinalMethod, amount: Number(sinalNum.toFixed(2)) },
          saldo_due_date: parseBrDate(promised)!,
        });
        saleId = sale?.sale_id || sale?.id || sale?.sale?.id || null;
        setDepositSaleId(saleId);
      }

      // (3) a OS
      const osItems: ServiceOrderItem[] = [];
      if (frameValue > 0 || frameSource === "estoque") osItems.push({ kind: "peca", description: frameSource === "estoque" ? frameProduct!.name : "Armação do cliente", product_id: frameProduct?.id || null, quantity: 1, unit_price: frameValue });
      if (parseMoney(lensPrice) > 0) osItems.push({ kind: "peca", description: lensName, quantity: 1, unit_price: parseMoney(lensPrice) });
      if (parseMoney(servicePrice) > 0) osItems.push({ kind: "servico", description: "Montagem", quantity: 1, unit_price: parseMoney(servicePrice) });

      const res = await serviceOrdersApi.create(company.id, {
        kind: "otica",
        customer_id: customerId,
        optical: buildOptical(prescriptionId, rxSource),
        lab_id: labId || null,
        lab_order_ref: labRef.trim() || null,
        deposit_sale_id: saleId || null,
        promised_at: promised.trim() ? `${parseBrDate(promised)}T12:00:00` : undefined,
        warranty_days: parseInt(labWarranty, 10) || 0,
        notes: notes.trim() || undefined,
        items: osItems,
      });
      qc.invalidateQueries({ queryKey: ["service-orders"] });
      qc.invalidateQueries({ queryKey: ["otica-dashboard"] });
      toast.success(`OS #${res.order.os_number} aberta${saleId ? " · sinal registrado" : ""}`);
      router.replace(("/otica/" + res.order.id) as any);
    } catch (err: any) {
      toast.error(err?.data?.error || "Não deu para abrir a OS");
    } finally {
      setSaving(false);
    }
  }

  const rxValidDays = rxSelected ? daysUntil(rxSelected.valid_until) : null;

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <Pressable onPress={() => router.back()} style={st.backBtn}>
        <Icon name="chevron_left" size={16} color={Colors.violet3} />
        <Text style={st.backText}>Laboratório</Text>
      </Pressable>
      <Text style={st.pageTitle}>Nova OS de óculos<Text style={{ color: Colors.violet }}>.</Text></Text>
      <Text style={st.pageSubtitle}>A receita fica congelada na OS. O sinal vira venda no caixa e o saldo entra no crediário com vencimento na data prometida.</Text>

      {/* ══ CLIENTE ══ */}
      <Text style={st.sectionTitle}>Cliente</Text>
      <View style={st.card}>
        {customerId ? (
          <View style={st.selectedRow}>
            <View style={st.avatar}><Text style={st.avatarText}>{(customerName || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={st.selectedName}>{customerName || "Cliente"}</Text>
              <Text style={st.selectedMeta}>
                {prescriptions.length === 0 ? "sem receita cadastrada" : `${prescriptions.length} ${prescriptions.length === 1 ? "receita" : "receitas"} · última de ${fmtIsoDate(prescriptions[0].issued_at)}`}
              </Text>
            </View>
            <Pressable onPress={() => { setCustomerId(null); setCustomerName(""); setRxId(null); }} testID="otica-trocar-cliente">
              <Text style={st.changeLink}>trocar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={st.searchBox}>
              <Icon name="search" size={14} color={Colors.ink3} />
              <TextInput style={st.searchInput} value={customerQuery} onChangeText={setCustomerQuery} placeholder="Nome ou telefone do cliente" placeholderTextColor={Colors.ink3} testID="otica-busca-cliente" />
            </View>
            {customerMatches.map((c) => (
              <Pressable key={c.id} onPress={() => { setCustomerId(c.id); setCustomerName(c.name); setCustomerQuery(""); }} style={st.matchRow} testID={`otica-cliente-${c.id}`}>
                <Text style={st.matchName}>{c.name}</Text>
                {!!c.phone && <Text style={st.matchMeta}>{c.phone}</Text>}
              </Pressable>
            ))}
            {customerQuery.trim().length >= 2 && customerMatches.length === 0 && (
              <Text style={st.hint}>Nenhum cliente encontrado. Cadastre na aba Clientes antes de abrir a OS.</Text>
            )}
          </>
        )}
      </View>

      {/* ══ RECEITA ══ */}
      <Text style={st.sectionTitle}>Receita</Text>
      <View style={st.card}>
        {prescriptions.length > 0 && (
          <View style={[st.chipsWrap, { marginBottom: 12 }]}>
            {prescriptions.slice(0, 3).map((p) => {
              const d = daysUntil(p.valid_until) ?? -1;
              const on = rxMode === "existente" && rxId === p.id;
              return (
                <Pressable key={p.id} onPress={() => { setRxMode("existente"); setRxId(p.id); }} style={[st.chip, on && st.chipOn]} testID={`otica-rx-${p.id}`}>
                  <Text style={[st.chipText, on && st.chipTextOn]}>
                    Receita de {fmtIsoDate(p.issued_at)}{d < 0 ? " · vencida" : ` · válida até ${fmtIsoDate(p.valid_until)}`}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setRxMode("nova")} style={[st.chip, rxMode === "nova" && st.chipOn]} testID="otica-rx-nova">
              <Text style={[st.chipText, rxMode === "nova" && st.chipTextOn]}>Digitar nova</Text>
            </Pressable>
          </View>
        )}
        {rxMode === "existente" && rxSelected ? (
          <View style={{ gap: 8 }}>
            <RxGrid od={columnsToEyes(rxSelected).od} oe={columnsToEyes(rxSelected).oe} />
            <Text style={st.hint}>
              {[rxSelected.prescriber_name, rxSelected.prescriber_registry].filter(Boolean).join(" · ") || "prescritor não informado"} · emitida {fmtIsoDate(rxSelected.issued_at)}
              {rxValidDays != null && rxValidDays < 0 ? " · VENCIDA" : rxValidDays != null && rxValidDays <= 30 ? ` · vence em ${rxValidDays} dias` : ""}
            </Text>
            {rxValidDays != null && rxValidDays < 0 && (
              <View style={st.warn}><Text style={st.warnText}>Receita vencida. A ótica só avia lente com receita válida — peça ao cliente uma nova consulta ou digite a receita nova.</Text></View>
            )}
          </View>
        ) : (
          <RxEditor value={rxDraft} onChange={setRxDraft} validityMonths={settings.prescription_validity_months} testID="otica-rx" />
        )}
      </View>

      {/* ══ ARMAÇÃO ══ */}
      <Text style={st.sectionTitle}>Armação</Text>
      <View style={st.card}>
        <View style={[st.chipsWrap, { marginBottom: 10 }]}>
          {(["estoque", "cliente"] as const).map((s) => (
            <Pressable key={s} onPress={() => setFrameSource(s)} style={[st.chip, frameSource === s && st.chipOn]} testID={`otica-armacao-${s}`}>
              <Text style={[st.chipText, frameSource === s && st.chipTextOn]}>{s === "estoque" ? "Do estoque" : "Do cliente"}</Text>
            </Pressable>
          ))}
        </View>
        {frameSource === "estoque" ? (
          frameProduct ? (
            <View style={st.selectedRow}>
              <Icon name="check" size={14} color={Colors.green} />
              <Text style={st.selectedName}>{frameProduct.name}</Text>
              <Text style={st.matchMeta}>{fmt(frameProduct.price)}</Text>
              <Pressable onPress={() => setFrameProduct(null)}><Text style={st.changeLink}>trocar</Text></Pressable>
            </View>
          ) : (
            <>
              <View style={st.searchBox}>
                <Icon name="package" size={14} color={Colors.ink3} />
                <TextInput style={st.searchInput} value={frameQuery} onChangeText={setFrameQuery} placeholder="Buscar armação no estoque (nome ou código)" placeholderTextColor={Colors.ink3} testID="otica-busca-armacao" />
              </View>
              {frameMatches.map((p) => (
                <Pressable key={p.id} onPress={() => { setFrameProduct({ id: p.id, name: p.name, price: p.price }); setFrameQuery(""); }} style={st.matchRow} testID={`otica-armacao-${p.id}`}>
                  <Text style={st.matchName}>{p.name}</Text>
                  <Text style={st.matchMeta}>{fmt(p.price)} · {p.stock} em estoque</Text>
                </Pressable>
              ))}
              <Text style={st.hint}>A armação sai do estoque na venda do sinal, como qualquer produto.</Text>
            </>
          )
        ) : (
          <View style={st.row2}>
            <View style={[st.col, { flex: 2 }]}>
              <Text style={st.lbl}>Descrição</Text>
              <TextInput style={st.input} value={frameDesc} onChangeText={setFrameDesc} placeholder="Ray-Ban RB5154 preto 52-18-140" placeholderTextColor={Colors.ink3} />
            </View>
            <View style={st.col}>
              <Text style={st.lbl}>Valor (opcional)</Text>
              <TextInput style={st.input} value={framePrice} onChangeText={setFramePrice} placeholder="0,00" keyboardType="numeric" placeholderTextColor={Colors.ink3} />
            </View>
          </View>
        )}
      </View>

      {/* ══ LENTES ══ */}
      <Text style={st.sectionTitle}>Lentes</Text>
      <View style={st.card}>
        <Text style={st.lbl}>Uso</Text>
        <View style={st.chipsWrap}>
          {LENS_USES.map((u) => (
            <Pressable key={u} onPress={() => setUse(u)} style={[st.chip, use === u && st.chipOn]} testID={`otica-uso-${u}`}>
              <Text style={[st.chipText, use === u && st.chipTextOn]}>{LENS_USE_LABEL[u]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[st.lbl, { marginTop: 12 }]}>Tipo</Text>
        <View style={st.chipsWrap}>
          {(["pronta", "surfacada"] as const).map((t) => (
            <Pressable key={t} onPress={() => setLensType(t)} style={[st.chip, lensType === t && st.chipOn]} testID={`otica-lente-${t}`}>
              <Text style={[st.chipText, lensType === t && st.chipTextOn]}>{t === "pronta" ? "Pronta (estoque)" : "Surfaçada (sob encomenda)"}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[st.row2, { marginTop: 12 }]}>
          <View style={st.col}>
            <Text style={st.lbl}>Marca</Text>
            <TextInput style={st.input} value={lensBrand} onChangeText={setLensBrand} placeholder="Essilor, Zeiss, Hoya…" placeholderTextColor={Colors.ink3} testID="otica-lente-marca" />
          </View>
          <View style={st.col}>
            <Text style={st.lbl}>Desenho</Text>
            <TextInput style={st.input} value={lensDesign} onChangeText={setLensDesign} placeholder="Varilux Comfort Max" placeholderTextColor={Colors.ink3} />
          </View>
        </View>
        <View style={[st.row2, { marginTop: 10 }]}>
          <View style={st.col}>
            <Text style={st.lbl}>Material / índice</Text>
            <TextInput style={st.input} value={lensMaterial} onChangeText={setLensMaterial} placeholder="1.59 policarbonato" placeholderTextColor={Colors.ink3} />
          </View>
          <View style={st.col}>
            <Text style={st.lbl}>Valor das lentes</Text>
            <TextInput style={st.input} value={lensPrice} onChangeText={setLensPrice} placeholder="0,00" keyboardType="numeric" placeholderTextColor={Colors.ink3} testID="otica-lente-valor" />
          </View>
        </View>
        <Text style={[st.lbl, { marginTop: 12 }]}>Tratamentos</Text>
        <View style={st.chipsWrap}>
          {LENS_TREATMENTS.map((t) => {
            const on = treatments.includes(t);
            return (
              <Pressable key={t} onPress={() => toggleTreatment(t)} style={[st.chip, on && st.chipOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <Text style={[st.chipText, on && st.chipTextOn]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[st.row2, { marginTop: 12 }]}>
          <View style={st.col}>
            <Text style={st.lbl}>Montagem / serviço (opcional)</Text>
            <TextInput style={st.input} value={servicePrice} onChangeText={setServicePrice} placeholder="0,00" keyboardType="numeric" placeholderTextColor={Colors.ink3} />
          </View>
          <View style={st.col} />
        </View>
      </View>

      {/* ══ LABORATÓRIO ══ */}
      <Text style={st.sectionTitle}>Laboratório e prazo</Text>
      <View style={st.card}>
        {labs.length === 0 ? (
          <Text style={st.hint}>Nenhum laboratório cadastrado. Cadastre em <Text style={st.link} onPress={() => router.push("/otica/config" as any)}>Configurações › Ótica</Text> para a previsão de entrega sair sozinha. Dá para abrir a OS sem laboratório.</Text>
        ) : (
          <View style={st.chipsWrap}>
            {labs.map((l) => (
              <Pressable key={l.id} onPress={() => { setLabId(labId === l.id ? null : l.id); setPromised(labId === l.id ? "" : fmtIsoDate(addDaysIso(l.lead_days || 7))); }} style={[st.chip, labId === l.id && st.chipOn]} testID={`otica-lab-${l.id}`}>
                <Text style={[st.chipText, labId === l.id && st.chipTextOn]}>{l.name} · {l.lead_days} {l.lead_days === 1 ? "dia" : "dias"}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={[st.row2, { marginTop: 12 }]}>
          <View style={st.col}>
            <Text style={st.lbl}>Nº do pedido no laboratório</Text>
            <TextInput style={st.input} value={labRef} onChangeText={setLabRef} placeholder="preenche ao enviar" placeholderTextColor={Colors.ink3} />
          </View>
          <View style={st.col}>
            <Text style={st.lbl}>Prometido para</Text>
            <TextInput style={st.input} value={promised} onChangeText={setPromised} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} testID="otica-prometido" />
          </View>
        </View>
      </View>

      {/* ══ VALORES E SINAL ══ */}
      <Text style={st.sectionTitle}>Valores e sinal</Text>
      <View style={st.card}>
        <View style={st.money}>
          <MoneyRow k="Armação" v={frameValue} />
          <MoneyRow k="Lentes" v={parseMoney(lensPrice)} />
          {parseMoney(servicePrice) > 0 && <MoneyRow k="Montagem" v={parseMoney(servicePrice)} />}
          <View style={st.totalRow}>
            <Text style={st.totalLabel}>Total</Text>
            <Text style={st.totalValue}>{fmt(total)}</Text>
          </View>
        </View>
        <View style={[st.row2, { marginTop: 14 }]}>
          <View style={st.col}>
            <Text style={st.lbl}>Sinal agora</Text>
            <TextInput style={[st.input, { fontFamily: Fonts.mono }]} value={sinal} onChangeText={setSinal} placeholder="0,00" keyboardType="numeric" placeholderTextColor={Colors.ink3} testID="otica-sinal" editable={!depositSaleId} />
          </View>
          <View style={st.col}>
            <Text style={st.lbl}>Forma</Text>
            <View style={st.chipsWrap}>
              {SINAL_METHODS.map((m) => (
                <Pressable key={m.key} onPress={() => setSinalMethod(m.key)} style={[st.chip, sinalMethod === m.key && st.chipOn]} disabled={!!depositSaleId}>
                  <Text style={[st.chipText, sinalMethod === m.key && st.chipTextOn]}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        {sinalNum > 0 && (
          <View style={[st.money, { marginTop: 12 }]}>
            <View style={st.row}><Text style={st.rowK}>Saldo na entrega</Text><Text style={[st.rowV, { color: Colors.amber }]}>{fmt(saldo)}</Text></View>
            <View style={st.row}><Text style={st.rowK}>Vence em</Text><Text style={st.rowV}>{promised || "informe a data prometida"}</Text></View>
          </View>
        )}
        <Text style={st.hint}>
          {depositSaleId
            ? "Sinal já registrado no caixa. Falta só abrir a OS — o botão abaixo não cobra de novo."
            : "Sem sinal? Deixe em branco: a OS abre sem venda e o caixa fecha na entrega."}
        </Text>
      </View>

      {/* ══ GARANTIA E OBSERVAÇÕES ══ */}
      <Text style={st.sectionTitle}>Garantia</Text>
      <View style={st.card}>
        <View style={st.row2}>
          <View style={st.col}>
            <Text style={st.lbl}>Adaptação (dias após a entrega)</Text>
            <TextInput style={st.input} value={adaptDays ?? String(settings.adaptation_warranty_days)} keyboardType="numeric" onChangeText={(v) => setAdaptDays(v.replace(/\D/g, "").slice(0, 4))} />
          </View>
          <View style={st.col}>
            <Text style={st.lbl}>Laboratório (dias)</Text>
            <TextInput style={st.input} value={labWarranty} keyboardType="numeric" onChangeText={(v) => setLabWarranty(v.replace(/\D/g, "").slice(0, 4))} />
          </View>
        </View>
        <Text style={st.hint}>Dois relógios correm juntos: o do cliente contra a ótica (adaptação, e os 90 dias do CDC) e o da ótica contra o laboratório.</Text>
      </View>

      <Text style={st.sectionTitle}>Observações</Text>
      <View style={st.card}>
        <TextInput style={[st.input, st.multiline]} value={notes} onChangeText={setNotes} placeholder="Combinados com o cliente, haste mais curta, estojo…" placeholderTextColor={Colors.ink3} multiline />
      </View>

      <Pressable onPress={handleSave} style={[st.saveBtn, saving && { opacity: 0.6 }]} disabled={saving} testID="otica-salvar">
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={st.saveText}>{depositSaleId ? "Tentar abrir a OS de novo" : sinalNum > 0 ? "Abrir OS e receber sinal" : "Abrir OS"}</Text>}
      </Pressable>
      <Text style={st.saveHint}>A impressão em A4 fica na tela da OS — confira a receita com o cliente antes de mandar ao laboratório.</Text>
    </ScrollView>
  );
}

function MoneyRow({ k, v }: { k: string; v: number }) {
  return (
    <View style={st.row}>
      <Text style={st.rowK}>{k}</Text>
      <Text style={st.rowV}>{fmt(v)}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 720, alignSelf: "center", width: "100%" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  pageTitle: { fontFamily: Fonts.heading, fontSize: 36, lineHeight: 38, color: Colors.ink, letterSpacing: -0.5, marginBottom: 6 },
  pageSubtitle: { fontSize: 13, color: Colors.ink3, lineHeight: 19, marginBottom: 6, maxWidth: 600 },
  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 10, marginTop: 18 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  row2: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  col: { flex: 1, minWidth: 160 },
  lbl: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginBottom: 7 },
  input: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: Colors.ink },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 8, lineHeight: 16 },
  link: { color: Colors.violet3, fontWeight: "700" },
  warn: { backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber + "55", borderRadius: 10, padding: 10 },
  warnText: { fontSize: 12, color: Colors.amber, lineHeight: 17 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  matchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  matchName: { fontSize: 13, color: Colors.ink, fontWeight: "600", flex: 1 },
  matchMeta: { fontSize: 11, color: Colors.ink3 },
  selectedRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontWeight: "800", color: Colors.violet3 },
  selectedName: { fontSize: 14, color: Colors.ink, fontWeight: "700", flex: 1 },
  selectedMeta: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  changeLink: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },
  money: { gap: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 12 },
  rowK: { fontSize: 13, color: Colors.ink3 },
  rowV: { fontSize: 13, color: Colors.ink, fontWeight: "600", fontFamily: Fonts.mono },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  totalLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  totalValue: { fontSize: 18, color: Colors.ink, fontWeight: "800", fontFamily: Fonts.mono },
  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 24 },
  saveText: { fontSize: 15, color: "#fff", fontWeight: "700" },
  saveHint: { fontSize: 11, color: Colors.ink3, textAlign: "center", marginTop: 10 },
});
