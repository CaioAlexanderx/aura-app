// ============================================================
// AURA. — Ordem de Serviço: abertura
//
// Momento: o cliente está NO BALCÃO entregando o aparelho. A tela é
// otimizada pra esse minuto — cliente, aparelho e defeito primeiro; o
// orçamento pode ficar pra depois (a OS nasce sem itens e o técnico
// orça na bancada).
//
// Recursos reaproveitados, nada novo:
//   - Cliente:  useCustomers (mesma base do CRM/PDV)
//   - Técnico:  employeesApi (mesma lista da folha/PDV)
//   - Peças:    useProducts (o estoque) — selecionar preenche descrição,
//               preço e product_id. O product_id é rastreabilidade; quem
//               baixa estoque é a VENDA no fechamento, nunca a OS, senão
//               a peça sairia duas vezes.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useCustomers } from "@/hooks/useCustomers";
import { useProducts } from "@/hooks/useProducts";
import { employeesApi } from "@/services/api";
import { serviceOrdersApi, type ServiceOrderItem } from "@/services/serviceOrdersApi";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function parseMoney(s: string): number {
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return isFinite(n) && n >= 0 ? n : 0;
}

// "DD/MM/AAAA" -> ISO meio-dia local (meia-noite UTC viraria véspera em UTC-3)
function parsePrazo(s: string): string | null {
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

type DraftItem = ServiceOrderItem & { _key: string };
let keySeq = 0;

export default function OsNovaScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const { customers } = useCustomers();
  const { products } = useProducts();

  const { data: empData } = useQuery({
    queryKey: ["employees", company?.id],
    queryFn: () => employeesApi.list(company!.id),
    enabled: !!company?.id,
    staleTime: 300_000,
  });
  const employees: Array<{ id: string; name: string }> = empData?.employees || [];

  // ── Cliente ──
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return customers
      .filter((c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q))
      .slice(0, 6);
  }, [customers, customerQuery]);

  // ── Equipamento ──
  const [equipType, setEquipType] = useState("");
  const [equipBrand, setEquipBrand] = useState("");
  const [equipModel, setEquipModel] = useState("");
  const [equipSerial, setEquipSerial] = useState("");
  const [equipAccessories, setEquipAccessories] = useState("");
  const [equipCondition, setEquipCondition] = useState("");

  // ── Serviço ──
  const [reportedIssue, setReportedIssue] = useState("");
  const [technicianId, setTechnicianId] = useState<string | null>(null);
  const [prazo, setPrazo] = useState("");
  const [warrantyDays, setWarrantyDays] = useState("90");
  const [notes, setNotes] = useState("");

  // ── Orçamento ──
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [products, productQuery]);

  const total = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const [saving, setSaving] = useState(false);

  function addServico() {
    setItems((prev) => [...prev, { _key: String(++keySeq), kind: "servico", description: "", quantity: 1, unit_price: 0 }]);
  }

  function addPeca(p: { id: string; name: string; price: number }) {
    setItems((prev) => [...prev, {
      _key: String(++keySeq), kind: "peca", description: p.name,
      product_id: p.id, quantity: 1, unit_price: p.price,
    }]);
    setProductQuery("");
  }

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it._key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it._key !== key));
  }

  async function handleSave() {
    if (!company?.id || saving) return;
    if (!customerId) { toast.error("Selecione o cliente — é pra ele que o aparelho volta"); return; }
    if (!reportedIssue.trim()) { toast.error("Descreva o defeito relatado pelo cliente"); return; }
    const badItem = items.find((it) => !it.description.trim());
    if (badItem) { toast.error("Todo item do orçamento precisa de descrição"); return; }
    if (prazo.trim() && !parsePrazo(prazo)) { toast.error("Prazo inválido — use DD/MM/AAAA"); return; }

    setSaving(true);
    try {
      const res = await serviceOrdersApi.create(company.id, {
        customer_id: customerId,
        reported_issue: reportedIssue.trim(),
        equipment_type: equipType.trim() || undefined,
        equipment_brand: equipBrand.trim() || undefined,
        equipment_model: equipModel.trim() || undefined,
        equipment_serial: equipSerial.trim() || undefined,
        equipment_accessories: equipAccessories.trim() || undefined,
        equipment_condition: equipCondition.trim() || undefined,
        technician_id: technicianId || undefined,
        promised_at: parsePrazo(prazo) || undefined,
        warranty_days: parseInt(warrantyDays, 10) || 0,
        notes: notes.trim() || undefined,
        items: items.map(({ _key, ...it }) => ({ ...it, description: it.description.trim() })),
      });
      qc.invalidateQueries({ queryKey: ["service-orders"] });
      toast.success(`OS #${res.order.os_number} aberta`);
      router.replace(("/os/" + res.order.id) as any);
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao abrir a OS");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <View style={st.headerRow}>
        <Pressable onPress={() => router.back()} style={st.backBtn}>
          <Icon name="chevron_left" size={16} color={Colors.violet3} />
          <Text style={st.backText}>Ordens de Serviço</Text>
        </Pressable>
      </View>

      <Text style={st.pageTitle}>Nova Ordem de Serviço</Text>
      <Text style={st.pageSubtitle}>Registre a entrada do equipamento. O orçamento pode ser preenchido agora ou depois, na bancada.</Text>

      {/* ══ CLIENTE ══ */}
      <Text style={st.sectionTitle}>Cliente</Text>
      <View style={st.card}>
        {customerId ? (
          <View style={st.selectedRow}>
            <Icon name="check" size={14} color={Colors.green} />
            <Text style={st.selectedName}>{customerName}</Text>
            <Pressable onPress={() => { setCustomerId(null); setCustomerName(""); }} testID="os-trocar-cliente">
              <Text style={st.changeLink}>trocar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={st.searchBox}>
              <Icon name="search" size={14} color={Colors.ink3} />
              <TextInput
                style={st.searchInput}
                value={customerQuery}
                onChangeText={setCustomerQuery}
                placeholder="Nome ou telefone do cliente"
                placeholderTextColor={Colors.ink3}
                testID="os-busca-cliente"
              />
            </View>
            {customerMatches.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => { setCustomerId(c.id); setCustomerName(c.name); setCustomerQuery(""); }}
                style={st.matchRow}
                testID={`os-cliente-${c.id}`}
              >
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

      {/* ══ EQUIPAMENTO ══ */}
      <Text style={st.sectionTitle}>Equipamento recebido</Text>
      <View style={st.card}>
        <View style={st.row2}>
          <View style={st.col}>
            <Text style={st.lbl}>Tipo</Text>
            <TextInput style={st.input} value={equipType} onChangeText={setEquipType} placeholder="Notebook, tênis, relógio…" placeholderTextColor={Colors.ink3} />
          </View>
          <View style={st.col}>
            <Text style={st.lbl}>Marca</Text>
            <TextInput style={st.input} value={equipBrand} onChangeText={setEquipBrand} placeholder="Dell, Nike…" placeholderTextColor={Colors.ink3} />
          </View>
        </View>
        <View style={[st.row2, { marginTop: 10 }]}>
          <View style={st.col}>
            <Text style={st.lbl}>Modelo</Text>
            <TextInput style={st.input} value={equipModel} onChangeText={setEquipModel} placeholder="Inspiron 15…" placeholderTextColor={Colors.ink3} />
          </View>
          <View style={st.col}>
            <Text style={st.lbl}>Nº de série</Text>
            <TextInput style={st.input} value={equipSerial} onChangeText={setEquipSerial} placeholder="opcional" placeholderTextColor={Colors.ink3} />
          </View>
        </View>
        <View style={{ marginTop: 10 }}>
          <Text style={st.lbl}>Acessórios que vieram junto</Text>
          <TextInput style={st.input} value={equipAccessories} onChangeText={setEquipAccessories} placeholder="Fonte, capa, cabo…" placeholderTextColor={Colors.ink3} />
        </View>
        <View style={{ marginTop: 10 }}>
          <Text style={st.lbl}>Estado na entrada</Text>
          <TextInput
            style={[st.input, st.multiline]}
            value={equipCondition}
            onChangeText={setEquipCondition}
            placeholder="Riscos, marcas, peças faltando — o que for anotado aqui, assinado pelo cliente, é a defesa da loja depois"
            placeholderTextColor={Colors.ink3}
            multiline
          />
        </View>
      </View>

      {/* ══ DEFEITO ══ */}
      <Text style={st.sectionTitle}>Defeito relatado</Text>
      <View style={st.card}>
        <TextInput
          style={[st.input, st.multiline]}
          value={reportedIssue}
          onChangeText={setReportedIssue}
          placeholder="Nas palavras do cliente. O diagnóstico técnico é outro campo, preenchido depois na bancada."
          placeholderTextColor={Colors.ink3}
          multiline
          testID="os-defeito"
        />
      </View>

      {/* ══ EXECUÇÃO ══ */}
      <Text style={st.sectionTitle}>Execução</Text>
      <View style={st.card}>
        {employees.length > 0 && (
          <>
            <Text style={st.lbl}>Técnico responsável</Text>
            <View style={st.chipsWrap}>
              {employees.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => setTechnicianId(technicianId === e.id ? null : e.id)}
                  style={[st.chip, technicianId === e.id && st.chipOn]}
                >
                  <Text style={[st.chipText, technicianId === e.id && st.chipTextOn]}>{e.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <View style={[st.row2, employees.length > 0 && { marginTop: 12 }]}>
          <View style={st.col}>
            <Text style={st.lbl}>Prazo prometido</Text>
            <TextInput style={st.input} value={prazo} onChangeText={setPrazo} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} />
          </View>
          <View style={st.col}>
            <Text style={st.lbl}>Garantia (dias)</Text>
            <TextInput style={st.input} value={warrantyDays} keyboardType="numeric" onChangeText={(v) => setWarrantyDays(v.replace(/\D/g, "").slice(0, 4))} />
          </View>
        </View>
      </View>

      {/* ══ ORÇAMENTO ══ */}
      <Text style={st.sectionTitle}>Orçamento (opcional)</Text>
      <View style={st.card}>
        {items.map((it) => (
          <View key={it._key} style={st.itemBox}>
            <View style={st.itemHead}>
              <View style={[st.kindBadge, it.kind === "peca" && st.kindBadgePeca]}>
                <Text style={st.kindText}>{it.kind === "peca" ? "PEÇA" : "SERVIÇO"}</Text>
              </View>
              <Pressable onPress={() => removeItem(it._key)} testID={`os-rm-item-${it._key}`}>
                <Icon name="trash" size={14} color={Colors.ink3} />
              </Pressable>
            </View>
            <TextInput
              style={st.input}
              value={it.description}
              onChangeText={(v) => updateItem(it._key, { description: v })}
              placeholder={it.kind === "peca" ? "Peça" : "Descreva o serviço"}
              placeholderTextColor={Colors.ink3}
            />
            <View style={[st.row2, { marginTop: 8 }]}>
              <View style={st.col}>
                <Text style={st.lbl}>Qtd</Text>
                <TextInput
                  style={st.input}
                  value={String(it.quantity)}
                  keyboardType="numeric"
                  onChangeText={(v) => updateItem(it._key, { quantity: parseFloat(v.replace(",", ".")) || 0 })}
                />
              </View>
              <View style={st.col}>
                <Text style={st.lbl}>Valor unitário</Text>
                <TextInput
                  style={st.input}
                  defaultValue={it.unit_price ? String(it.unit_price).replace(".", ",") : ""}
                  keyboardType="numeric"
                  placeholder="0,00"
                  placeholderTextColor={Colors.ink3}
                  onChangeText={(v) => updateItem(it._key, { unit_price: parseMoney(v) })}
                />
              </View>
            </View>
          </View>
        ))}

        {/* Peça vem do estoque: buscar preenche descrição, preço e product_id */}
        <View style={st.searchBox}>
          <Icon name="package" size={14} color={Colors.ink3} />
          <TextInput
            style={st.searchInput}
            value={productQuery}
            onChangeText={setProductQuery}
            placeholder="Buscar peça no estoque"
            placeholderTextColor={Colors.ink3}
            testID="os-busca-peca"
          />
        </View>
        {productMatches.map((p) => (
          <Pressable key={p.id} onPress={() => addPeca(p)} style={st.matchRow} testID={`os-peca-${p.id}`}>
            <Text style={st.matchName}>{p.name}</Text>
            <Text style={st.matchMeta}>{fmt(p.price)} · {p.stock} em estoque</Text>
          </Pressable>
        ))}

        <Pressable onPress={addServico} style={st.addServiceBtn} testID="os-add-servico">
          <Icon name="plus" size={14} color={Colors.violet3} />
          <Text style={st.addServiceText}>Adicionar serviço (mão de obra)</Text>
        </Pressable>

        {items.length > 0 && (
          <View style={st.totalRow}>
            <Text style={st.totalLabel}>Total orçado</Text>
            <Text style={st.totalValue}>{fmt(total)}</Text>
          </View>
        )}
      </View>

      {/* ══ OBSERVAÇÕES ══ */}
      <Text style={st.sectionTitle}>Observações</Text>
      <View style={st.card}>
        <TextInput
          style={[st.input, st.multiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Combinados com o cliente, senha do aparelho, etc."
          placeholderTextColor={Colors.ink3}
          multiline
        />
      </View>

      <Pressable onPress={handleSave} style={[st.saveBtn, saving && { opacity: 0.6 }]} disabled={saving} testID="os-salvar">
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={st.saveText}>Abrir OS e imprimir depois</Text>}
      </Pressable>
      <Text style={st.saveHint}>A impressão em A4 fica na tela da OS — confira os dados com o cliente antes.</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 640, alignSelf: "center", width: "100%" },

  headerRow: { marginBottom: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },

  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 6, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginBottom: 8 },

  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 10, marginTop: 18 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },

  row2: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  lbl: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginBottom: 7 },
  input: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: Colors.ink },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 8, lineHeight: 16 },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  matchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  matchName: { fontSize: 13, color: Colors.ink, fontWeight: "600", flex: 1 },
  matchMeta: { fontSize: 11, color: Colors.ink3 },

  selectedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectedName: { fontSize: 14, color: Colors.ink, fontWeight: "700", flex: 1 },
  changeLink: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },

  itemBox: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, marginBottom: 10, backgroundColor: Colors.bg2 },
  itemHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  kindBadge: { backgroundColor: Colors.violet + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  kindBadgePeca: { backgroundColor: Colors.green + "22" },
  kindText: { fontSize: 9, fontWeight: "800", color: Colors.ink2, letterSpacing: 0.5 },

  addServiceBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, marginTop: 8 },
  addServiceText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  totalLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  totalValue: { fontSize: 17, color: Colors.ink, fontWeight: "800" },

  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 24 },
  saveText: { fontSize: 15, color: "#fff", fontWeight: "700" },
  saveHint: { fontSize: 11, color: Colors.ink3, textAlign: "center", marginTop: 10 },
});
