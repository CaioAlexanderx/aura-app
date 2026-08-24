// ============================================================
// AURA KARATÊ — Workspace do campeonato: FILA DE CONFERÊNCIA
//
// A digitalização do fluxo real: "planilhas sem comprovante serão
// desconsideradas". Lista os pedidos de delegação por dojô com status,
// comprovante ao lado do valor cotado, e as duas ações da federação:
// CONFIRMAR (pedido 'paid' + baixa em cascata nas inscrições) ou
// RECUSAR (com motivo; inscrições viram 'withdrawn', rastro preservado).
//
// Para a federação SEM Aura Pay, esta fila É o produto; com Aura Pay, o
// webhook faz o mesmo caminho e a fila fica vazia sozinha.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, Linking, TextInput,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateRadius as R } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { KarateButton } from "@/components/karate/KarateButton";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { toast } from "@/components/Toast";
import { formatEventDateShort } from "@/utils/eventDate";
import { ORDER_STATUS_LABEL, OrderStatus, formatBRL } from "@/services/karateDelegationsApi";
import {
  karateCompetitionSetupApi, FedDelegationSummary, FedDelegationDetail,
} from "@/services/karateCompetitionSetupApi";

const FILTERS: [OrderStatus | "all", string][] = [
  ["all", "Todos"],
  ["awaiting_confirmation", "Em conferência"],
  ["awaiting_payment", "Aguardando pagamento"],
  ["paid", "Confirmados"],
  ["cancelled", "Cancelados"],
];

const STATUS_TONE: Record<OrderStatus, { bg: string; fg: string }> = {
  draft: { bg: C.glassHi, fg: C.ink3 },
  submitted: { bg: C.glassHi, fg: C.ink2 },
  awaiting_payment: { bg: C.primarySoft, fg: C.primary },
  awaiting_confirmation: { bg: "#f7efdd", fg: "#a8730f" },
  paid: { bg: "#e8f2ec", fg: "#2e7d4f" },
  cancelled: { bg: C.glassHi, fg: C.ink3 },
};

export function DelegacoesTab({ federationId, competitionId }: { federationId: string; competitionId: string }) {
  const [orders, setOrders] = useState<FedDelegationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FedDelegationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await karateCompetitionSetupApi.listDelegations(federationId, competitionId);
      setOrders(data);
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar as delegações.");
      setOrders([]);
    }
  }, [federationId, competitionId]);

  useEffect(() => { load(); }, [load]);

  const toggleDetail = useCallback(async (orderId: string) => {
    if (openId === orderId) { setOpenId(null); setDetail(null); return; }
    setOpenId(orderId);
    setDetail(null);
    setRejectReason("");
    setDetailLoading(true);
    try {
      const res = await karateCompetitionSetupApi.getDelegation(federationId, competitionId, orderId);
      setDetail(res.order);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível carregar o pedido.");
      setOpenId(null);
    } finally {
      setDetailLoading(false);
    }
  }, [federationId, competitionId, openId]);

  const doConfirm = async (o: FedDelegationSummary) => {
    const ok = await confirmAsync({
      title: "Confirmar pagamento?",
      message: `Confirmar o pedido de ${o.dojo_name || "dojô"} (${formatBRL(o.total_amount)})? Todas as inscrições do pedido serão marcadas como pagas.`,
      confirmLabel: "Confirmar",
    });
    if (!ok) return;
    setBusyId(o.id);
    try {
      const res = await karateCompetitionSetupApi.confirmDelegation(federationId, competitionId, o.id);
      toast.success(`Confirmado — ${res.entries_marked_paid} inscriç${res.entries_marked_paid === 1 ? "ão" : "ões"} pagas.`);
      setOpenId(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível confirmar.");
    } finally {
      setBusyId(null);
    }
  };

  const doReject = async (o: FedDelegationSummary) => {
    const ok = await confirmAsync({
      title: "Recusar pedido?",
      message: `Recusar o pedido de ${o.dojo_name || "dojô"}? As inscrições saem das listagens e chaves (nada é apagado).`,
      confirmLabel: "Recusar",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(o.id);
    try {
      const res = await karateCompetitionSetupApi.rejectDelegation(federationId, competitionId, o.id, rejectReason.trim() || undefined);
      toast.success(`Pedido recusado — ${res.entries_withdrawn} inscriç${res.entries_withdrawn === 1 ? "ão retirada" : "ões retiradas"}.`);
      setOpenId(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível recusar.");
    } finally {
      setBusyId(null);
    }
  };

  if (orders === null && !error) return <ActivityIndicator style={{ marginTop: 32 }} color={C.primary} />;
  if (error) return <KarateErrorState message={error} onRetry={load} />;

  const filtered = (orders || []).filter((o) => filter === "all" || o.status === filter);
  const pendingCount = (orders || []).filter((o) => o.status === "awaiting_confirmation").length;

  return (
    <View style={s.panel}>
      <View style={s.filters}>
        {FILTERS.map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[s.filterChip, filter === key && s.filterChipOn]}
            onPress={() => setFilter(key)}
          >
            <Text style={[s.filterTxt, filter === key && s.filterTxtOn]}>
              {label}{key === "awaiting_confirmation" && pendingCount > 0 ? ` · ${pendingCount}` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <KarateEmptyState
          icon="receipt"
          title="Nenhuma delegação aqui"
          subtitle="Os pedidos consolidados dos dojôs aparecem nesta fila."
          style={{ paddingVertical: 28 }}
        />
      ) : (
        filtered.map((o) => {
          const tone = STATUS_TONE[o.status] || STATUS_TONE.submitted;
          const isOpen = openId === o.id;
          const actionable = o.status === "awaiting_confirmation" || o.status === "awaiting_payment";
          return (
            <View key={o.id} style={s.card}>
              <TouchableOpacity onPress={() => toggleDetail(o.id)} accessibilityRole="button">
                <View style={s.row}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.dojoName} numberOfLines={1}>{o.dojo_name || "Dojô"}</Text>
                    <Text style={s.meta}>
                      {o.entry_count} inscriç{o.entry_count === 1 ? "ão" : "ões"} · {o.officials_count} oficia{o.officials_count === 1 ? "l" : "is"} · pedido em {formatEventDateShort(o.created_at?.slice(0, 10))}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={[s.statusChip, { backgroundColor: tone.bg }]}>
                      <Text style={[s.statusTxt, { color: tone.fg }]}>{ORDER_STATUS_LABEL[o.status]}</Text>
                    </View>
                    <Text style={s.total}>{formatBRL(o.total_amount)}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {actionable && (
                <View style={s.actionRow}>
                  {o.receipt_url ? (
                    <TouchableOpacity style={s.receiptLink} onPress={() => Linking.openURL(o.receipt_url!)}>
                      <Icon name="file_text" size={14} color={C.primary} />
                      <Text style={s.receiptLinkTxt}>Ver comprovante</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={s.noReceipt}>Sem comprovante ainda</Text>
                  )}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <KarateButton
                      label="Recusar" variant="ghost" size="sm"
                      disabled={busyId === o.id}
                      onPress={() => doReject(o)}
                    />
                    <KarateButton
                      label={busyId === o.id ? "..." : "Confirmar pagamento"} variant="sumi" size="sm"
                      disabled={busyId === o.id}
                      onPress={() => doConfirm(o)}
                    />
                  </View>
                </View>
              )}

              {isOpen && (
                detailLoading
                  ? <ActivityIndicator style={{ marginVertical: 10 }} color={C.primary} />
                  : detail && detail.id === o.id
                    ? <DetailView detail={detail} rejectReason={rejectReason} onReason={setRejectReason} actionable={actionable} />
                    : null
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

function DetailView({ detail, rejectReason, onReason, actionable }: {
  detail: FedDelegationDetail; rejectReason: string; onReason: (v: string) => void; actionable: boolean;
}) {
  const quote = detail.quote && "lines" in detail.quote ? detail.quote : null;
  return (
    <View style={s.detail}>
      <Text style={s.detailTitle}>Inscrições ({detail.entries.length})</Text>
      {detail.entries.map((e) => (
        <View key={e.id} style={s.entryRow}>
          <Text style={s.entryName} numberOfLines={1}>
            {e.team_name ? `Equipe ${e.team_name}` : e.student_name || "—"}
          </Text>
          <Text style={s.entryCat} numberOfLines={1}>{e.category_name}</Text>
          <Icon name={e.fee_paid ? "check_circle" : "clock"} size={14} color={e.fee_paid ? "#2e7d4f" : C.ink3} />
        </View>
      ))}

      {quote && (
        <>
          <Text style={[s.detailTitle, { marginTop: 8 }]}>Cotação aceita pelo dojô</Text>
          {quote.lines.map((l, i) => (
            <View key={i} style={s.quoteRow}>
              <Text style={[s.quoteLabel, l.exempted && s.quoteExempt]} numberOfLines={1}>{l.label}{l.exempted ? " (isento)" : ""}</Text>
              <Text style={[s.quoteAmt, l.exempted && s.quoteExempt]}>{formatBRL(l.amount)}</Text>
            </View>
          ))}
          <View style={[s.quoteRow, { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 5, marginTop: 3 }]}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{formatBRL(quote.total)}</Text>
          </View>
        </>
      )}

      {detail.cancel_reason ? (
        <Text style={s.cancelReason}>Motivo da recusa: {detail.cancel_reason}</Text>
      ) : null}
      {detail.confirmed_by_name ? (
        <Text style={s.confirmedBy}>Confirmado por {detail.confirmed_by_name}</Text>
      ) : null}

      {actionable && (
        <TextInput
          style={s.reasonInput}
          value={rejectReason}
          onChangeText={onReason}
          placeholder="Motivo da recusa (opcional — vai para o dojô)"
          placeholderTextColor={C.ink4}
          accessibilityLabel="Motivo da recusa"
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // PREMISSA (24/08): coluna central com largura máxima — mesma regra do
  // Credenciamento; a fila de conferência não estica em monitor largo.
  panel: { gap: 12, width: "100%", maxWidth: 920, alignSelf: "center" } as ViewStyle,
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  filterChip: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 11, paddingVertical: 5 } as ViewStyle,
  filterChipOn: { backgroundColor: C.primarySoft, borderColor: C.primaryLine } as ViewStyle,
  filterTxt: { fontSize: 12, fontWeight: "600", color: C.ink3 } as TextStyle,
  filterTxtOn: { color: C.primary, fontWeight: "700" } as TextStyle,
  card: { backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: 13, gap: 8 } as ViewStyle,
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  dojoName: { fontSize: 14.5, fontWeight: "700", color: C.ink } as TextStyle,
  meta: { fontSize: 11.5, color: C.ink3 } as TextStyle,
  statusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 } as ViewStyle,
  statusTxt: { fontSize: 11, fontWeight: "700" } as TextStyle,
  total: { fontSize: 14, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 9 } as ViewStyle,
  receiptLink: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  receiptLinkTxt: { fontSize: 12.5, fontWeight: "700", color: C.primary } as TextStyle,
  noReceipt: { fontSize: 12, color: C.ink3 } as TextStyle,
  detail: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 9, gap: 4 } as ViewStyle,
  detailTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  entryRow: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  entryName: { flex: 1, fontSize: 13, fontWeight: "600", color: C.ink } as TextStyle,
  entryCat: { flex: 1, fontSize: 12, color: C.ink3 } as TextStyle,
  quoteRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 } as ViewStyle,
  quoteLabel: { flex: 1, fontSize: 12.5, color: C.ink2 } as TextStyle,
  quoteAmt: { fontSize: 12.5, color: C.ink2, fontVariant: ["tabular-nums"] } as TextStyle,
  quoteExempt: { textDecorationLine: "line-through", color: C.ink3 } as TextStyle,
  totalLabel: { fontSize: 13, fontWeight: "800", color: C.ink } as TextStyle,
  totalValue: { fontSize: 14.5, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  cancelReason: { fontSize: 12, color: C.primary2, marginTop: 4 } as TextStyle,
  confirmedBy: { fontSize: 12, color: "#2e7d4f", marginTop: 4 } as TextStyle,
  reasonInput: { fontSize: 13, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.glassHi, marginTop: 6 } as TextStyle,
});
