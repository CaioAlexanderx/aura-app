// ============================================================
// AURA. — Ordem de Serviço: detalhe e ciclo de vida
//
// aberta → em_execucao → pronta → entregue (cancelada de qualquer uma;
// pronta → em_execucao é retrabalho). As ações mostradas vêm de
// OS_TRANSICOES — a UI nunca oferece botão que o backend vai recusar.
//
// Regras que o backend impõe e a tela só reflete:
//   - Orçamento aprovado não se edita (409 ORCAMENTO_APROVADO): mexer no
//     valor depois do "sim" do cliente exige reabrir a aprovação.
//   - Entregar NÃO exige venda: garantia/cortesia entregam sem sale_id.
//     O vínculo com venda acontece no PDV (SaleComplete), não aqui.
//   - OS entregue/cancelada é história: só leitura e reimpressão.
// ============================================================
import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import {
  serviceOrdersApi, printOs, OS_STATUS_LABEL, OS_TRANSICOES,
  type OsStatus, type ServiceOrderItem,
} from "@/services/serviceOrdersApi";

const fmt = (n: number | string) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function fmtDate(iso?: string | null, hora = true): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    ...(hora ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).replace(",", "");
}

const STATUS_COLOR: Record<OsStatus, string> = {
  aberta: Colors.violet3, em_execucao: "#d97706", pronta: "#0891b2",
  entregue: Colors.green, cancelada: Colors.ink3,
};

// Rótulo de AÇÃO (o que fazer), não de estado (onde está).
const ACTION_LABEL: Record<OsStatus, string> = {
  aberta: "Reabrir",
  em_execucao: "Iniciar execução",
  pronta: "Marcar como pronta",
  entregue: "Entregar ao cliente",
  cancelada: "Cancelar OS",
};

export default function OsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [solution, setSolution] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["service-order", company?.id, id],
    queryFn: () => serviceOrdersApi.get(company!.id, String(id)),
    enabled: !!company?.id && !!id,
  });

  const os = data?.order;
  const items: ServiceOrderItem[] = data?.items || [];

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["service-order", company?.id, id] });
    qc.invalidateQueries({ queryKey: ["service-orders"] });
  }

  async function run(fn: () => Promise<any>, okMsg?: string) {
    if (busy || !company?.id) return;
    setBusy(true);
    try {
      await fn();
      invalidate();
      if (okMsg) toast.success(okMsg);
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao atualizar a OS");
    } finally {
      setBusy(false);
    }
  }

  function handleStatus(next: OsStatus) {
    if (!os) return;
    if (next === "cancelada") { setShowCancel(true); return; }
    run(
      () => serviceOrdersApi.setStatus(company!.id, os.id, next, solution != null ? { solution } : undefined),
      next === "entregue" ? "OS entregue" : undefined
    );
  }

  function handlePrint() {
    if (!company?.id || !os) return;
    if (Platform.OS !== "web") { toast.info("Impressão disponível apenas na versão web"); return; }
    printOs(company.id, os.id);
  }

  if (isLoading || !os) {
    return (
      <View style={[st.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={Colors.violet3} />
      </View>
    );
  }

  const fechada = os.status === "entregue" || os.status === "cancelada";
  const aprovado = !!os.approved_at;
  const transicoes = OS_TRANSICOES[os.status];

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <View style={st.headerRow}>
        <Pressable onPress={() => router.back()} style={st.backBtn}>
          <Icon name="chevron_left" size={16} color={Colors.violet3} />
          <Text style={st.backText}>Ordens de Serviço</Text>
        </Pressable>
      </View>

      {/* Cabeçalho */}
      <View style={st.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={st.pageTitle}>OS #{os.os_number}</Text>
          <View style={[st.badge, { borderColor: STATUS_COLOR[os.status] }]}>
            <Text style={[st.badgeText, { color: STATUS_COLOR[os.status] }]}>{OS_STATUS_LABEL[os.status]}</Text>
          </View>
        </View>
        <Pressable onPress={handlePrint} style={st.printBtn} testID="os-imprimir">
          <Icon name="receipt" size={14} color={Colors.ink} />
          <Text style={st.printText}>Imprimir A4</Text>
        </Pressable>
      </View>

      {/* Cliente + datas */}
      <View style={st.card}>
        <Row k="Cliente" v={os.customer_name || "—"} />
        {!!os.customer_phone && <Row k="Telefone" v={os.customer_phone} />}
        <Row k="Abertura" v={fmtDate(os.created_at)} />
        {!!os.promised_at && <Row k="Prazo prometido" v={fmtDate(os.promised_at)} />}
        {!!os.technician_name && <Row k="Técnico" v={os.technician_name} />}
        {!!os.delivered_at && <Row k="Entrega" v={fmtDate(os.delivered_at)} />}
        {os.warranty_days > 0 && <Row k="Garantia" v={`${os.warranty_days} dias`} />}
        {!!os.sale_id && <Row k="Venda vinculada" v={`#${String(os.sale_id).slice(0, 8).toUpperCase()}`} />}
        {os.status === "cancelada" && !!os.cancel_reason && <Row k="Motivo" v={os.cancel_reason} />}
      </View>

      {/* Equipamento */}
      {(os.equipment_type || os.equipment_brand || os.equipment_model || os.equipment_condition) && (
        <>
          <Text style={st.sectionTitle}>Equipamento</Text>
          <View style={st.card}>
            <Row k="Aparelho" v={[os.equipment_type, os.equipment_brand, os.equipment_model].filter(Boolean).join(" · ") || "—"} />
            {!!os.equipment_serial && <Row k="Nº de série" v={os.equipment_serial} />}
            {!!os.equipment_accessories && <Row k="Acessórios" v={os.equipment_accessories} />}
            {!!os.equipment_condition && (
              <View style={st.txtBlock}>
                <Text style={st.txtLabel}>Estado na entrada</Text>
                <Text style={st.txtBody}>{os.equipment_condition}</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Defeito / diagnóstico / solução */}
      <Text style={st.sectionTitle}>Serviço</Text>
      <View style={st.card}>
        <View style={st.txtBlock}>
          <Text style={st.txtLabel}>Defeito relatado pelo cliente</Text>
          <Text style={st.txtBody}>{os.reported_issue}</Text>
        </View>

        <View style={st.txtBlock}>
          <Text style={st.txtLabel}>Diagnóstico técnico</Text>
          {fechada ? (
            <Text style={st.txtBody}>{os.diagnosis || "—"}</Text>
          ) : (
            <TextInput
              style={[st.input, st.multiline]}
              value={diagnosis ?? os.diagnosis ?? ""}
              onChangeText={setDiagnosis}
              onBlur={() => {
                if (diagnosis != null && diagnosis !== (os.diagnosis || "")) {
                  run(() => serviceOrdersApi.patch(company!.id, os.id, { diagnosis }), "Diagnóstico salvo");
                }
              }}
              placeholder="O que o técnico encontrou (salva ao sair do campo)"
              placeholderTextColor={Colors.ink3}
              multiline
              testID="os-diagnostico"
            />
          )}
        </View>

        <View style={st.txtBlock}>
          <Text style={st.txtLabel}>Serviço executado</Text>
          {fechada ? (
            <Text style={st.txtBody}>{os.solution || "—"}</Text>
          ) : (
            <TextInput
              style={[st.input, st.multiline]}
              value={solution ?? os.solution ?? ""}
              onChangeText={setSolution}
              onBlur={() => {
                if (solution != null && solution !== (os.solution || "")) {
                  run(() => serviceOrdersApi.patch(company!.id, os.id, { solution }), "Registro salvo");
                }
              }}
              placeholder="O que foi feito de fato"
              placeholderTextColor={Colors.ink3}
              multiline
            />
          )}
        </View>
      </View>

      {/* Orçamento */}
      <Text style={st.sectionTitle}>Orçamento</Text>
      <View style={st.card}>
        {items.length === 0 ? (
          <Text style={st.emptyItems}>Nenhum item orçado.</Text>
        ) : (
          items.map((it, i) => (
            <View key={it.id || i} style={st.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.itemDesc}>{it.description}</Text>
                <Text style={st.itemMeta}>
                  {it.kind === "peca" ? "Peça" : "Serviço"} · {Number(it.quantity)} × {fmt(it.unit_price)}
                </Text>
              </View>
              <Text style={st.itemTotal}>{fmt(Number(it.quantity) * Number(it.unit_price))}</Text>
            </View>
          ))
        )}
        <View style={st.totalRow}>
          <Text style={st.totalLabel}>Total orçado</Text>
          <Text style={st.totalValue}>{fmt(os.estimated_amount)}</Text>
        </View>

        {aprovado ? (
          <View style={st.approvedBox}>
            <Icon name="check" size={13} color={Colors.green} />
            <Text style={st.approvedText}>Aprovado pelo cliente em {fmtDate(os.approved_at)}</Text>
          </View>
        ) : (!fechada && items.length > 0 && (
          <Pressable
            onPress={() => run(() => serviceOrdersApi.approve(company!.id, os.id), "Orçamento aprovado")}
            style={st.approveBtn}
            disabled={busy}
            testID="os-aprovar"
          >
            <Text style={st.approveText}>Cliente aprovou o orçamento</Text>
          </Pressable>
        ))}
        {!fechada && (
          <Text style={st.hint}>
            {aprovado
              ? "Orçamento aprovado é um acordo: para alterar itens, o backend exige nova aprovação."
              : "Itens são editados na abertura ou pela bancada; aprovado, o valor congela."}
          </Text>
        )}
      </View>

      {/* Ações de status */}
      {transicoes.length > 0 && (
        <>
          <Text style={st.sectionTitle}>Ações</Text>
          <View style={st.card}>
            {os.status === "pronta" && (
              <Text style={st.hint}>
                Se a retirada acontecer junto com uma venda, feche pelo PDV — lá a OS é vinculada à venda.
                Entregar aqui é para os casos sem venda: garantia, retrabalho, cortesia.
              </Text>
            )}
            <View style={st.actionsRow}>
              {transicoes.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => handleStatus(t)}
                  style={[st.actionBtn, t === "entregue" && st.actionPrimary, t === "cancelada" && st.actionDanger]}
                  disabled={busy}
                  testID={`os-status-${t}`}
                >
                  <Text style={[st.actionText, t === "entregue" && st.actionTextPrimary, t === "cancelada" && st.actionTextDanger]}>
                    {ACTION_LABEL[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {showCancel && (
              <View style={{ marginTop: 12 }}>
                <Text style={st.txtLabel}>Motivo do cancelamento</Text>
                <TextInput
                  style={[st.input, st.multiline]}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  placeholder="Cliente desistiu, sem conserto viável…"
                  placeholderTextColor={Colors.ink3}
                  multiline
                />
                <Pressable
                  onPress={() => run(
                    () => serviceOrdersApi.setStatus(company!.id, os.id, "cancelada", { cancel_reason: cancelReason.trim() || undefined }),
                    "OS cancelada"
                  ).then(() => setShowCancel(false))}
                  style={[st.actionBtn, st.actionDanger, { marginTop: 10 }]}
                  disabled={busy}
                  testID="os-confirmar-cancelamento"
                >
                  <Text style={[st.actionText, st.actionTextDanger]}>Confirmar cancelamento</Text>
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={st.row}>
      <Text style={st.rowK}>{k}</Text>
      <Text style={st.rowV}>{v}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 640, alignSelf: "center", width: "100%" },

  headerRow: { marginBottom: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },

  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 6, letterSpacing: -0.4 },
  badge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  printBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  printText: { fontSize: 12, color: Colors.ink, fontWeight: "700" },

  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 10, marginTop: 18 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: 12 },
  rowK: { fontSize: 12, color: Colors.ink3 },
  rowV: { fontSize: 12, color: Colors.ink, fontWeight: "600", flex: 1, textAlign: "right" },

  txtBlock: { marginTop: 10 },
  txtLabel: { fontSize: 11, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 },
  txtBody: { fontSize: 13, color: Colors.ink, lineHeight: 19 },
  input: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  multiline: { minHeight: 64, textAlignVertical: "top" },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 10, lineHeight: 16 },

  emptyItems: { fontSize: 12, color: Colors.ink3, fontStyle: "italic" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemDesc: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  itemMeta: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  itemTotal: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  totalLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  totalValue: { fontSize: 17, color: Colors.ink, fontWeight: "800" },

  approvedBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  approvedText: { fontSize: 12, color: Colors.green, fontWeight: "600" },
  approveBtn: { backgroundColor: Colors.green + "22", borderWidth: 1, borderColor: Colors.green, borderRadius: 10, paddingVertical: 11, alignItems: "center", marginTop: 12 },
  approveText: { fontSize: 13, color: Colors.green, fontWeight: "700" },

  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  actionPrimary: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  actionDanger: { backgroundColor: "transparent", borderColor: "#dc2626" + "66" },
  actionText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  actionTextPrimary: { color: "#fff" },
  actionTextDanger: { color: "#dc2626" },
});
