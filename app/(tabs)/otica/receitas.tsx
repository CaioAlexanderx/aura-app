// ============================================================
// AURA. — Ótica: Receitas (receituário)
//
// O "livro de registro de receitas aviadas" que o Decreto 24.492/1934
// (arts. 7º e 8º) exige da ótica, em versão digital: cliente, prescritor,
// emissão, validade e as OS que usaram cada receita. Exporta em CSV por
// período pra quando a vigilância pedir.
//
// Receitas vencendo em 30 dias sobem pro topo: é o gatilho de recompra
// mais forte da ótica, e o lembrete pelo WhatsApp (job do backend) só diz
// "revise sua receita com seu oftalmologista" — nunca "agende seu exame
// aqui" (art. 17: a ótica não oferece exame).
//
// Receita é dado de saúde: esta tela é lida por quem tem otica.access.
//
// Mockup aprovado: docs/mockups/otica-modulo.html, tela 4.
//
// 23/11/2026 (docs/mockups/otica-cadastro-e-receita.html, tela 2): cada
// receita aberta ganha Editar, Imprimir (ficha em A4) e, quando o servidor
// guardar o arquivo em área privada, a foto do papel. No celular a tabela
// vira cartão: cinco colunas não cabem em 375 px.
// ============================================================
import { useMemo, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { tourTarget } from "@/utils/tourTarget";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ScreenHero } from "@/components/ScreenHero";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { useCustomers } from "@/hooks/useCustomers";
import { arrayToCSV, downloadCSV } from "@/utils/csv";
import {
  oticaApi, OTICA_SETTINGS_DEFAULTS, PRESCRIBER_LABEL,
  type Prescription, columnsToEyes, fmtEyeShort, fmtIsoDate, daysUntil, todayIso,
} from "@/services/oticaApi";
import { RxGrid } from "@/components/otica/RxGrid";
import { ReceitaSheet } from "@/components/otica/ReceitaSheet";
import { FotoDaReceita } from "@/components/otica/FotoDaReceita";
import { printReceita } from "@/services/oticaPrint";
import { nomeDaLojaDe } from "@/utils/nomeDaLoja";
import { formatarDocumento } from "@/utils/clienteDadosCompletos";
import { buscarDocumentosInteiros, lojaDoCliente } from "@/hooks/useDocumentosDoCliente";
import { WHATSAPP_OFICIAL_LIBERADO } from "@/utils/whatsappOficialLiberado";

type Chip = "todas" | "vencendo" | "vencidas" | "mes";
const CHIPS: { key: Chip; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "vencendo", label: "Vencendo em 30 dias" },
  { key: "vencidas", label: "Vencidas" },
  { key: "mes", label: "Este mês" },
];

export default function OticaReceitasScreen() {
  const { company, availableCompanies } = useAuthStore();
  const qc = useQueryClient();
  const { settings: pdv } = usePdvSettings();
  const enabled = pdv.otica_enabled === true;
  const params = useLocalSearchParams<{ customer_id?: string; nova?: string }>();
  const { customers } = useCustomers();

  const [chip, setChip] = useState<Chip>("todas");
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<boolean>(params.nova === "1");
  const [editing, setEditing] = useState<Prescription | null>(null);
  const [toDelete, setToDelete] = useState<Prescription | null>(null);
  const { width } = useWindowDimensions();
  const estreito = width < 640;

  const { data: settingsData } = useQuery({
    queryKey: ["otica-settings", company?.id],
    queryFn: () => oticaApi.getSettings(company!.id),
    enabled: !!company?.id,
    staleTime: 300_000,
  });
  const validityMonths = settingsData?.settings?.prescription_validity_months ?? OTICA_SETTINGS_DEFAULTS.prescription_validity_months;
  // A foto do papel só aparece quando o servidor avisa que guarda o arquivo.
  const fotoDisponivel = settingsData?.capabilities?.prescription_photo === true;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["otica-prescriptions", company?.id, params.customer_id || "all"],
    queryFn: () => oticaApi.listPrescriptions(company!.id, { customer_id: params.customer_id || undefined, limit: 500 }),
    enabled: !!company?.id,
    staleTime: 30_000,
  });
  const all: Prescription[] = data?.prescriptions || [];

  const rows = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const today = todayIso();
    let list = all;
    if (chip === "vencendo") list = all.filter((p) => { const d = daysUntil(p.valid_until); return d != null && d >= 0 && d <= 30; });
    if (chip === "vencidas") list = all.filter((p) => (daysUntil(p.valid_until) ?? 0) < 0);
    if (chip === "mes") list = all.filter((p) => String(p.issued_at).slice(0, 7) === today.slice(0, 7));
    if (q) list = list.filter((p) => (p.customer_name || "").toLowerCase().includes(q) || (p.prescriber_name || "").toLowerCase().includes(q));
    if (chip === "todas" && !q) {
      // Vencendo sobe pro topo; o resto por emissão, mais recente primeiro.
      return [...list].sort((a, b) => {
        const da = daysUntil(a.valid_until) ?? 999, db = daysUntil(b.valid_until) ?? 999;
        const ea = da >= 0 && da <= 30 ? 0 : 1, eb = db >= 0 && db <= 30 ? 0 : 1;
        return ea - eb || String(b.issued_at).localeCompare(String(a.issued_at));
      });
    }
    return list;
  }, [all, chip, busca]);

  const expiring = all.filter((p) => { const d = daysUntil(p.valid_until); return d != null && d >= 0 && d <= 30; }).length;
  const expired = all.filter((p) => (daysUntil(p.valid_until) ?? 0) < 0).length;
  const customerFilter = params.customer_id ? customers.find((c) => c.id === params.customer_id) : null;

  async function exportBook() {
    if (!company?.id) return;
    try {
      const r = await oticaApi.book(company.id);
      const csv = arrayToCSV(
        r.rows.map((x) => ({
          emitida: fmtIsoDate(x.issued_at), cliente: x.customer_name,
          prescritor: x.prescriber_name || "", registro: x.prescriber_registry || "",
          tipo: PRESCRIBER_LABEL[x.prescriber_type] || x.prescriber_type,
          os: (x.os_numbers || []).map((n) => "#" + n).join(" "),
        })),
        [
          { key: "emitida", label: "Emitida em" }, { key: "cliente", label: "Paciente" },
          { key: "prescritor", label: "Prescritor" }, { key: "registro", label: "Registro" },
          { key: "tipo", label: "Tipo" }, { key: "os", label: "OS" },
        ],
      );
      downloadCSV(csv, `livro-de-receitas-${todayIso()}.csv`);
    } catch (err: any) {
      toast.error(err?.data?.error || "Não deu para exportar o livro. Tente de novo.");
    }
  }

  // Ficha em A4. Direto no clique: a janela de impressão precisa do gesto.
  function imprimir(p: Prescription) {
    if (Platform.OS !== "web") { toast.info("Impressão disponível apenas na versão web"); return; }
    const doc = formatarDocumento((company as any)?.cnpj || (company as any)?.cpf || "");
    const cliente = customers.find((c) => c.id === p.customer_id) || null;
    // 24/11/2026: CPF/RG da lista vêm mascarados; o inteiro é buscado na
    // loja do próprio cliente (multi-CNPJ) depois de a janela abrir.
    const lojaDoCadastro = cliente ? lojaDoCliente(cliente, { company: company as any, availableCompanies }) : null;
    printReceita({
      loja: { nome: nomeDaLojaDe(company as any) || "Ótica", documento: doc ? (doc.length > 14 ? "CNPJ " : "CPF ") + doc : null },
      settings: settingsData?.settings || null,
      cliente,
      receita: p,
    }, cliente && lojaDoCadastro ? () => buscarDocumentosInteiros(lojaDoCadastro, cliente.id) : undefined).then((r) => { if (r === "blocked") toast.error("Permita pop-ups neste site para imprimir a receita."); });
  }

  async function confirmDelete() {
    if (!company?.id || !toDelete) return;
    try {
      await oticaApi.removePrescription(company.id, toDelete.id);
      qc.invalidateQueries({ queryKey: ["otica-prescriptions"] });
      toast.success("Receita excluída");
    } catch (err: any) {
      toast.error(err?.data?.code === "RECEITA_EM_USO" ? "Esta receita foi usada numa OS e faz parte do livro: não pode ser excluída." : (err?.data?.error || "Não deu para excluir"));
    } finally {
      setToDelete(null);
    }
  }

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <ScreenHero
        eyebrow="Ótica"
        title="Receitas"
        badge={customerFilter ? customerFilter.name : undefined}
        subtitle={
          isLoading ? "Carregando o receituário…" : (
            <Text>
              {all.length} {all.length === 1 ? "receita registrada" : "receitas registradas"}
              {expiring > 0 && <Text style={{ color: Colors.amber, fontWeight: "700" }}> · {expiring} {expiring === 1 ? "vence" : "vencem"} em 30 dias</Text>}
              {expired > 0 && <Text> · {expired} {expired === 1 ? "vencida" : "vencidas"}</Text>}
            </Text>
          )
        }
        actions={
          <>
            <Pressable onPress={exportBook} style={st.ghostBtn} testID="otica-exportar-livro">
              <Icon name="download" size={14} color={Colors.ink} />
              <Text style={st.ghostBtnText}>Exportar livro (CSV)</Text>
            </Pressable>
            {enabled && (
              <Pressable onPress={() => setSheet(true)} style={st.newBtn} testID="otica-nova-receita" {...tourTarget("otica.nova_receita")}>
                <Icon name="plus" size={14} color="#fff" />
                <Text style={st.newBtnText}>Nova receita</Text>
              </Pressable>
            )}
          </>
        }
      />

      {customerFilter && (
        <Pressable onPress={() => router.replace("/otica/receitas" as any)} style={st.filterPill}>
          <Icon name="x" size={12} color={Colors.violet3} />
          <Text style={st.filterPillText}>Mostrando só {customerFilter.name} — ver todas</Text>
        </Pressable>
      )}

      <View style={st.searchBox}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput style={st.searchInput} value={busca} onChangeText={setBusca} placeholder="Cliente ou prescritor" placeholderTextColor={Colors.ink3} testID="otica-busca-receita" />
      </View>
      <View style={st.chips}>
        {CHIPS.map((c) => (
          <Pressable key={c.key} onPress={() => setChip(c.key)} style={[st.chip, chip === c.key && st.chipOn]} testID={`otica-rx-chip-${c.key}`}>
            <Text style={[st.chipText, chip === c.key && st.chipTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={st.loadingBox}><ActivityIndicator color={Colors.violet3} /></View>
      ) : isError ? (
        <View style={st.emptyBox} testID="otica-rx-erro">
          <Icon name="alert" size={28} color={Colors.amber} />
          <Text style={st.emptyTitle}>Não deu para carregar as receitas</Text>
          <Text style={st.emptyDesc}>Pode ser a conexão. As receitas continuam guardadas.</Text>
          <Pressable onPress={() => refetch()} style={[st.ghostBtn, { marginTop: 6 }]} testID="otica-rx-tentar"><Text style={st.ghostBtnText}>Tentar de novo</Text></Pressable>
        </View>
      ) : rows.length === 0 ? (
        <View style={st.emptyBox} testID="otica-rx-vazio">
          <Icon name="eye" size={30} color={Colors.ink3} />
          <Text style={st.emptyTitle}>{busca ? "Nada encontrado" : chip === "vencendo" ? "Nenhuma receita vence nos próximos 30 dias" : chip === "vencidas" ? "Nenhuma receita vencida" : "Nenhuma receita registrada"}</Text>
          <Text style={st.emptyDesc}>{busca ? "Tente pelo nome do cliente ou do prescritor." : "Cada receita registrada aqui vira uma linha do livro e pode ser usada em uma OS de óculos."}</Text>
          {enabled && !busca && chip === "todas" && (
            <Pressable onPress={() => setSheet(true)} style={[st.newBtn, { marginTop: 8 }]} testID="otica-rx-vazio-nova">
              <Icon name="plus" size={14} color="#fff" />
              <Text style={st.newBtnText}>{customerFilter ? "Registrar a primeira receita" : "Nova receita"}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={st.table} testID="otica-rx-lista">
          {!estreito && <View style={[st.tr, st.th]}>
            <Text style={[st.cell, st.cEmit, st.thText]}>Emitida</Text>
            <Text style={[st.cell, st.cName, st.thText]}>Cliente</Text>
            <Text style={[st.cPresc, st.thText]}>Prescritor</Text>
            <Text style={[st.cell, st.cRx, st.thText]}>OD / OE</Text>
            <Text style={[st.cVal, st.thText]}>Validade</Text>
          </View>}
          {rows.map((p) => {
            const eyes = columnsToEyes(p);
            const d = daysUntil(p.valid_until);
            const isOpen = open === p.id;
            return (
              <View key={p.id}>
                {estreito ? (
                  <Pressable onPress={() => setOpen(isOpen ? null : p.id)} style={[st.mRow, isOpen && st.trOpen]} testID={`otica-rx-${p.id}`} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
                    <View style={st.mTop}>
                      <Text style={[st.cellText, st.strong, { flex: 1 }]} numberOfLines={1}>{p.customer_name || "—"}</Text>
                      <Text style={st.mono}>{fmtIsoDate(p.issued_at)}</Text>
                    </View>
                    <Text style={st.mMeta} numberOfLines={1}>{[p.prescriber_name, p.prescriber_registry || PRESCRIBER_LABEL[p.prescriber_type]].filter(Boolean).join(" · ") || "prescritor não informado"}</Text>
                    <Text style={st.mono}>OD {fmtEyeShort(eyes.od)}</Text>
                    <Text style={st.mono}>OE {fmtEyeShort(eyes.oe)}</Text>
                    <View style={st.mTop}>
                      <Text style={[st.mMeta, { flex: 1 }]}>válida até {fmtIsoDate(p.valid_until)}</Text>
                      {d != null && d < 0 && <Text style={[st.tag, st.tagBad]}>vencida</Text>}
                      {d != null && d >= 0 && d <= 30 && <Text style={[st.tag, st.tagWarn]}>vence em {d} {d === 1 ? "dia" : "dias"}</Text>}
                    </View>
                  </Pressable>
                ) : (
                <Pressable onPress={() => setOpen(isOpen ? null : p.id)} style={[st.tr, isOpen && st.trOpen]} testID={`otica-rx-${p.id}`} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
                  <Text style={[st.cell, st.cEmit, st.mono]}>{fmtIsoDate(p.issued_at)}</Text>
                  <Text style={[st.cell, st.cName, st.strong]} numberOfLines={1}>{p.customer_name || "—"}</Text>
                  <View style={st.cPresc}>
                    <Text style={st.cellText} numberOfLines={1}>{p.prescriber_name || "—"}</Text>
                    {(p.prescriber_registry || p.prescriber_type) && (
                      <Text style={[st.tag, p.prescriber_type === "medico" ? st.tagMed : st.tagNeutral]}>{p.prescriber_registry || PRESCRIBER_LABEL[p.prescriber_type]}</Text>
                    )}
                  </View>
                  <Text style={[st.cell, st.cRx, st.mono]} numberOfLines={2}>{fmtEyeShort(eyes.od)} / {fmtEyeShort(eyes.oe)}</Text>
                  <View style={st.cVal}>
                    <Text style={st.mono}>{fmtIsoDate(p.valid_until)}</Text>
                    {d != null && d < 0 && <Text style={[st.tag, st.tagBad]}>vencida</Text>}
                    {d != null && d >= 0 && d <= 30 && <Text style={[st.tag, st.tagWarn]}>vence em {d} {d === 1 ? "dia" : "dias"}</Text>}
                  </View>
                </Pressable>
                )}
                {isOpen && (
                  <View style={st.detail}>
                    <RxGrid od={eyes.od} oe={eyes.oe} />
                    {!!p.notes && <Text style={st.hint}>{p.notes}</Text>}
                    {!!company?.id && (
                      <FotoDaReceita
                        companyId={company.id}
                        receita={p}
                        disponivel={fotoDisponivel}
                        podeEditar={enabled}
                        onChanged={() => qc.invalidateQueries({ queryKey: ["otica-prescriptions"] })}
                      />
                    )}
                    <View style={st.detailActions}>
                      {enabled && (
                        <Pressable onPress={() => router.push(("/otica/nova?customer_id=" + p.customer_id + "&rx_id=" + p.id) as any)} style={st.newBtn} testID={`otica-rx-abrir-os-${p.id}`}>
                          <Icon name="glasses" size={14} color="#fff" />
                          <Text style={st.newBtnText}>Abrir OS com esta receita</Text>
                        </Pressable>
                      )}
                      {enabled && (
                        <Pressable onPress={() => setEditing(p)} style={st.ghostBtn} testID={`otica-rx-editar-${p.id}`}>
                          <Icon name="edit" size={14} color={Colors.ink} />
                          <Text style={st.ghostBtnText}>Editar</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => imprimir(p)} style={st.ghostBtn} testID={`otica-rx-imprimir-${p.id}`}>
                        <Icon name="receipt" size={14} color={Colors.ink} />
                        <Text style={st.ghostBtnText}>Imprimir</Text>
                      </Pressable>
                      {!customerFilter && (
                        <Pressable onPress={() => router.push(("/otica/receitas?customer_id=" + p.customer_id) as any)} style={st.ghostBtn}>
                          <Text style={st.ghostBtnText}>Todas deste cliente</Text>
                        </Pressable>
                      )}
                      {enabled && (
                        <Pressable onPress={() => setToDelete(p)} style={[st.ghostBtn, { borderColor: Colors.red + "66" }]} testID={`otica-rx-excluir-${p.id}`}>
                          <Text style={[st.ghostBtnText, { color: Colors.red }]}>Excluir</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* 18/11/2026 — trava do WhatsApp oficial (utils/whatsappOficialLiberado). */}
      {WHATSAPP_OFICIAL_LIBERADO && (
      <Text style={[st.hint, { marginTop: 16 }]}>
        O lembrete de revisão (30 dias antes de vencer) sai pelo WhatsApp oficial como mensagem de marketing, com consentimento e cota, e diz "revise sua receita com seu oftalmologista". Ligue em Configurações › Ótica.
      </Text>
      )}

      <ReceitaSheet
        visible={sheet || !!editing}
        onClose={() => { setSheet(false); setEditing(null); }}
        validityMonths={validityMonths}
        presetCustomerId={params.customer_id || null}
        editing={editing}
      />

      <ConfirmDialog
        visible={!!toDelete}
        title="Excluir receita?"
        message={toDelete ? `A receita de ${fmtIsoDate(toDelete.issued_at)} de ${toDelete.customer_name || "cliente"} sai do livro. Receita usada em OS não pode ser excluída.` : ""}
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 980, alignSelf: "center", width: "100%" },
  ghostBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  ghostBtnText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  newBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },
  filterPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.violet + "55", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  filterPillText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },
  loadingBox: { paddingVertical: 40, alignItems: "center" },
  emptyBox: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700", textAlign: "center" },
  emptyDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 360, lineHeight: 17 },

  table: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, flexWrap: "wrap" },
  trOpen: { backgroundColor: Colors.violetD },
  th: { backgroundColor: Colors.bg2 },
  thText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.ink3 },
  cell: { fontSize: 13, color: Colors.ink },
  cellText: { fontSize: 13, color: Colors.ink },
  cEmit: { width: 86 },
  cName: { flexBasis: 150, flexGrow: 1 },
  cPresc: { flexBasis: 170, flexGrow: 1, gap: 3 },
  cRx: { flexBasis: 220, flexGrow: 2, fontSize: 12 },
  cVal: { width: 130, gap: 3 },
  mono: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.ink },
  strong: { fontWeight: "600" },
  tag: { alignSelf: "flex-start", fontSize: 10, fontWeight: "700", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  tagMed: { backgroundColor: Colors.violetD, color: Colors.violet3 },
  tagNeutral: { backgroundColor: Colors.bg4, color: Colors.ink3 },
  tagWarn: { backgroundColor: Colors.amberD, color: Colors.amber },
  tagBad: { backgroundColor: Colors.redD, color: Colors.red },
  detail: { padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg2, gap: 10 },
  detailActions: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 },
  hint: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  mRow: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 3 },
  mTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  mMeta: { fontSize: 11, color: Colors.ink3 },

});
