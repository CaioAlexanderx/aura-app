// ============================================================
// AURA DOJÔ — Campeonatos: MEUS PEDIDOS (delegações submetidas)
//
// Lista os pedidos do dojô com status do ciclo (aguardando pagamento →
// em conferência → confirmado / cancelado), expande para o detalhe
// (inscrições + cotação) e permite ENVIAR O COMPROVANTE no modo manual
// (o que digitaliza o "planilha sem comprovante será desconsiderada" do
// regulamento). Upload é web-only (input file) — no nativo mostra aviso,
// mesmo padrão dos anexos do exame de kyu.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl,
  Platform, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateFonts as F, KarateRadius as R } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { toast } from "@/components/Toast";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { formatEventDateShort } from "@/utils/eventDate";
import {
  karateDelegationsApi, DelegationOrderSummary, DelegationOrderDetail,
  OrderStatus, ORDER_STATUS_LABEL, formatBRL,
} from "@/services/karateDelegationsApi";

const RECEIPT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

const STATUS_TONE: Record<OrderStatus, { bg: string; fg: string }> = {
  draft: { bg: C.glassHi, fg: C.ink3 },
  submitted: { bg: C.glassHi, fg: C.ink2 },
  awaiting_payment: { bg: C.primarySoft, fg: C.primary },
  awaiting_confirmation: { bg: "#f7efdd", fg: "#a8730f" },
  paid: { bg: "#e8f2ec", fg: "#2e7d4f" },
  cancelled: { bg: C.glassHi, fg: C.ink3 },
};

export function PedidosTab() {
  const { federationId } = useKarateFederation();
  const [orders, setOrders] = useState<DelegationOrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DelegationOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!federationId) return;
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await karateDelegationsApi.listOrders(federationId);
      setOrders(res.data || []);
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar os pedidos.");
      setOrders([]);
    } finally {
      setRefreshing(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const toggleDetail = useCallback(async (orderId: string) => {
    if (openId === orderId) { setOpenId(null); setDetail(null); return; }
    setOpenId(orderId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await karateDelegationsApi.getOrder(federationId, orderId);
      setDetail(res.order);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível carregar o pedido.");
      setOpenId(null);
    } finally {
      setDetailLoading(false);
    }
  }, [federationId, openId]);

  // Upload do comprovante — web-only (input file → base64).
  const pickReceipt = useCallback((orderId: string) => {
    if (Platform.OS !== "web") {
      toast.error("O envio de comprovante está disponível na versão web.");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = RECEIPT_ACCEPT;
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > RECEIPT_MAX_BYTES) {
        toast.error("Comprovante acima de 5MB — envie um arquivo menor.");
        return;
      }
      setUploading(true);
      try {
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = String(reader.result || "");
            resolve(res.includes(",") ? res.split(",")[1] : res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await karateDelegationsApi.uploadReceipt(federationId, orderId, b64, file.type || "application/pdf");
        toast.success("Comprovante enviado — a federação vai conferir.");
        await load();
        if (openId === orderId) {
          const res = await karateDelegationsApi.getOrder(federationId, orderId);
          setDetail(res.order);
        }
      } catch (e: any) {
        toast.error(e?.message || "Não foi possível enviar o comprovante.");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }, [federationId, load, openId]);

  if (orders === null && !error) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />;
  }
  if (error) return <KarateErrorState message={error} onRetry={() => load()} />;

  return (
    <ScrollView
      style={{ flex: 1 }}
      // PREMISSA (24/08): coluna central com largura máxima — pedidos não
      // esticam em monitor largo (status/valor ficam perto do nome).
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40, width: "100%", maxWidth: 920, alignSelf: "center" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.primary} />}
    >
      {!orders || orders.length === 0 ? (
        <KarateEmptyState
          icon="receipt"
          title="Nenhum pedido de delegação"
          subtitle='Inscreva sua delegação na aba "Campeonatos" — o pedido consolidado aparece aqui.'
          style={{ paddingVertical: 40 }}
        />
      ) : (
        orders.map((o) => {
          const tone = STATUS_TONE[o.status] || STATUS_TONE.submitted;
          const isOpen = openId === o.id;
          const needsReceipt = (o.status === "awaiting_payment" || o.status === "awaiting_confirmation");
          return (
            <View key={o.id} style={s.card}>
              <TouchableOpacity onPress={() => toggleDetail(o.id)} accessibilityRole="button">
                <View style={s.row}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.compName} numberOfLines={1}>{o.competition_name}</Text>
                    <Text style={s.meta}>
                      {formatEventDateShort(o.event_date)} · pedido em {formatEventDateShort(o.created_at?.slice(0, 10))}
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

              {needsReceipt && (
                <View style={s.receiptRow}>
                  {o.receipt_url ? (
                    <Text style={s.receiptSent}>
                      <Icon name="check_circle" size={13} color="#2e7d4f" /> Comprovante enviado — aguardando conferência
                    </Text>
                  ) : (
                    <Text style={s.receiptHint}>Pague no PIX da federação e envie o comprovante:</Text>
                  )}
                  <TouchableOpacity
                    style={s.receiptBtn}
                    onPress={() => pickReceipt(o.id)}
                    disabled={uploading}
                    accessibilityRole="button"
                    accessibilityLabel="Enviar comprovante"
                  >
                    {uploading
                      ? <ActivityIndicator size="small" color={C.primary} />
                      : (<>
                          <Icon name="upload" size={14} color={C.primary} />
                          <Text style={s.receiptBtnTxt}>{o.receipt_url ? "Reenviar" : "Enviar comprovante"}</Text>
                        </>)}
                  </TouchableOpacity>
                </View>
              )}

              {isOpen && (
                detailLoading
                  ? <ActivityIndicator style={{ marginVertical: 12 }} color={C.primary} />
                  : detail && detail.id === o.id
                    ? <OrderDetail detail={detail} />
                    : null
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function OrderDetail({ detail }: { detail: DelegationOrderDetail }) {
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
          <Icon
            name={e.fee_paid ? "check_circle" : "clock"}
            size={14}
            color={e.fee_paid ? "#2e7d4f" : C.ink3}
          />
        </View>
      ))}
      {quote && (
        <>
          <Text style={[s.detailTitle, { marginTop: 10 }]}>Cotação</Text>
          {quote.lines.map((l, i) => (
            <View key={i} style={s.quoteRow}>
              <Text style={[s.quoteLabel, l.exempted && s.quoteExempt]} numberOfLines={1}>
                {l.label}{l.exempted ? " (isento)" : ""}
              </Text>
              <Text style={[s.quoteAmount, l.exempted && s.quoteExempt]}>{formatBRL(l.amount)}</Text>
            </View>
          ))}
          {quote.discount > 0 && (
            <View style={s.quoteRow}>
              <Text style={s.quoteLabel}>Isenções ({quote.exemptions.applied})</Text>
              <Text style={[s.quoteAmount, { color: "#2e7d4f" }]}>−{formatBRL(quote.discount)}</Text>
            </View>
          )}
          <View style={[s.quoteRow, s.quoteTotalRow]}>
            <Text style={s.quoteTotalLabel}>Total</Text>
            <Text style={s.quoteTotalAmount}>{formatBRL(quote.total)}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: 14, gap: 8 } as ViewStyle,
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  compName: { fontSize: 15, fontWeight: "700", color: C.ink } as TextStyle,
  meta: { fontSize: 11.5, color: C.ink3 } as TextStyle,
  statusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 } as ViewStyle,
  statusTxt: { fontSize: 11, fontWeight: "700" } as TextStyle,
  total: { fontSize: 14, fontWeight: "800", color: C.ink } as TextStyle,
  receiptRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 } as ViewStyle,
  receiptHint: { fontSize: 12, color: C.ink2, flex: 1, minWidth: 160 } as TextStyle,
  receiptSent: { fontSize: 12, color: "#2e7d4f", flex: 1, minWidth: 160 } as TextStyle,
  receiptBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: C.primaryLine, backgroundColor: C.primarySoft, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 7 } as ViewStyle,
  receiptBtnTxt: { fontSize: 12.5, fontWeight: "700", color: C.primary } as TextStyle,
  detail: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, gap: 4 } as ViewStyle,
  detailTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", color: C.ink3, marginBottom: 2 } as TextStyle,
  entryRow: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  entryName: { flex: 1, fontSize: 13, color: C.ink, fontWeight: "600" } as TextStyle,
  entryCat: { flex: 1, fontSize: 12, color: C.ink3 } as TextStyle,
  quoteRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 } as ViewStyle,
  quoteLabel: { flex: 1, fontSize: 12.5, color: C.ink2 } as TextStyle,
  quoteAmount: { fontSize: 12.5, color: C.ink2, fontVariant: ["tabular-nums"] } as TextStyle,
  quoteExempt: { textDecorationLine: "line-through", color: C.ink3 } as TextStyle,
  quoteTotalRow: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6, marginTop: 4 } as ViewStyle,
  quoteTotalLabel: { fontSize: 13.5, fontWeight: "800", color: C.ink } as TextStyle,
  quoteTotalAmount: { fontSize: 15, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
});
