import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Modal, ActivityIndicator, Linking, Image, TextInput,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useDigitalOrders } from "@/hooks/useDigitalOrders";
import { api } from "@/services/api";
import { toast } from "@/components/Toast";
import { cs } from "./shared";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment:    { label: "Aguardando Pix",   color: "#d97706", bg: "#fef3c7" },
  awaiting_approval:  { label: "Aguardando aprov.", color: "#dc2626", bg: "#fee2e2" },
  confirmed:          { label: "Confirmado",        color: "#2563eb", bg: "#dbeafe" },
  preparing:          { label: "Em preparo",        color: "#7c3aed", bg: "#ede9fe" },
  ready:              { label: "Pronto",            color: "#059669", bg: "#d1fae5" },
  delivered:          { label: "Entregue",          color: "#374151", bg: "#f3f4f6" },
  cancelled:          { label: "Cancelado",         color: "#dc2626", bg: "#fee2e2" },
};

const NEXT_STATUS: Record<string, string> = {
  confirmed: "preparing",
  preparing: "ready",
  ready:     "delivered",
};

const CHIPS = [
  { key: "all",                label: "Todos" },
  { key: "awaiting_approval",  label: "Aguardando aprov." },
  { key: "pending_payment",    label: "Pix gerado" },
  { key: "confirmed",          label: "Novos" },
  { key: "preparing",          label: "Preparo" },
  { key: "ready",              label: "Prontos" },
  { key: "delivered",          label: "Entregues" },
];

function timeAgo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function fmt(v: number | string) {
  return "R$ " + Number(v).toFixed(2).replace(".", ",");
}

export function TabPedidos({ companyId }: { companyId?: string } = {}) {
  const [filter, setFilter] = useState("all");
  const [order, setOrder] = useState<any>(null);
  const [proofZoom, setProofZoom] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [working, setWorking] = useState(false);
  const { orders, kpi, isLoading, refetch, updateStatus, isUpdating } = useDigitalOrders(filter);

  // companyId pode vir via prop OU ser pego do hook (fallback usa qualquer endpoint que ja tem cid)
  const cid = companyId || (orders[0]?.company_id) || null;

  async function advance() {
    if (!order) return;
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    await updateStatus({ oid: order.id, status: next });
    setOrder(null);
  }

  async function cancel() {
    if (!order) return;
    await updateStatus({ oid: order.id, status: "cancelled" });
    setOrder(null);
  }

  async function approvePayment() {
    if (!order || !cid) return;
    setWorking(true);
    try {
      await api.post(`/companies/${cid}/digital-channel/orders/${order.id}/approve-payment`, {});
      toast.success("Pagamento aprovado!");
      setOrder(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aprovar pagamento");
    } finally {
      setWorking(false);
    }
  }

  async function rejectPayment() {
    if (!order || !cid) return;
    setWorking(true);
    try {
      await api.post(`/companies/${cid}/digital-channel/orders/${order.id}/reject-payment`, {
        reason: rejectReason.trim() || undefined,
      });
      toast.success("Pedido rejeitado");
      setOrder(null);
      setShowRejectInput(false);
      setRejectReason("");
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao rejeitar");
    } finally {
      setWorking(false);
    }
  }

  function openProof(url: string) {
    setProofZoom(url);
  }

  return (
    <View>
      {/* KPI Row */}
      <View style={s.kpiRow}>
        <View style={[s.kpiCard, { borderTopColor: "#dc2626" }]}>
          <Text style={[s.kpiNum, { color: "#dc2626" }]}>{(kpi as any).awaiting_approval || 0}</Text>
          <Text style={s.kpiLabel}>Aguardando aprov.</Text>
        </View>
        <View style={[s.kpiCard, { borderTopColor: Colors.violet }]}>
          <Text style={[s.kpiNum, { color: Colors.violet }]}>{kpi.confirmed}</Text>
          <Text style={s.kpiLabel}>Confirmados</Text>
        </View>
        <View style={[s.kpiCard, { borderTopColor: Colors.green }]}>
          <Text style={[s.kpiNum, { color: Colors.green }]} numberOfLines={1} adjustsFontSizeToFit>
            {fmt(kpi.revenue_today)}
          </Text>
          <Text style={s.kpiLabel}>Receita hoje</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
        {CHIPS.map((c) => (
          <Pressable key={c.key} onPress={() => setFilter(c.key)} style={[cs.filterChip, filter === c.key && cs.filterChipActive]}>
            <Text style={[cs.filterText, filter === c.key && cs.filterTextActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable onPress={() => refetch()} style={s.refreshBtn}>
        <Icon name="refresh" size={12} color={Colors.violet3} />
        <Text style={s.refreshText}>Atualizar</Text>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator size="small" color={Colors.violet} style={{ marginTop: 32 }} />
      ) : orders.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📦</Text>
          <Text style={s.emptyTitle}>Nenhum pedido aqui</Text>
          <Text style={s.emptyDesc}>Quando clientes fizerem pedidos pelo site, eles aparecerão aqui.</Text>
        </View>
      ) : (
        orders.map((o: any) => {
          const st = STATUS_MAP[o.status] || STATUS_MAP.cancelled;
          const isAwaiting = o.status === "awaiting_approval";
          return (
            <Pressable key={o.id} style={[s.card, isAwaiting && s.cardHighlight]} onPress={() => setOrder(o)}>
              <View style={s.cardTop}>
                <Text style={s.cardNum}>#{o.order_number}</Text>
                <View style={[s.badge, { backgroundColor: st.bg }]}>
                  <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
              <Text style={s.cardCustomer}>{o.customer_name}</Text>
              <View style={s.cardBottom}>
                <Text style={s.cardTotal}>{fmt(o.total)}</Text>
                <Text style={s.cardMeta}>
                  {o.payment_method === "on_delivery" ? "💵 Na entrega" : "💸 Pix"}
                  {" · "}
                  {o.delivery_type === "delivery" ? "🚚 Entrega" : "🏪 Retirada"}
                  {" · "}
                  {timeAgo(o.created_at)}
                </Text>
              </View>
              {isAwaiting && o.payment_proof_url && (
                <View style={s.proofBadgeRow}>
                  <Icon name="check" size={11} color={Colors.green} />
                  <Text style={s.proofBadgeText}>Comprovante anexado</Text>
                </View>
              )}
            </Pressable>
          );
        })
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!order}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => { setOrder(null); setShowRejectInput(false); setRejectReason(""); }}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            {order && (() => {
              const st = STATUS_MAP[order.status] || STATUS_MAP.cancelled;
              const nextSt = NEXT_STATUS[order.status];
              const isAwaiting = order.status === "awaiting_approval";
              const canCancel = !["delivered", "cancelled"].includes(order.status);
              return (
                <>
                  <View style={s.sheetHead}>
                    <View>
                      <Text style={s.sheetTitle}>Pedido #{order.order_number}</Text>
                      <Text style={s.sheetSub}>{timeAgo(order.created_at)}</Text>
                    </View>
                    <Pressable onPress={() => { setOrder(null); setShowRejectInput(false); setRejectReason(""); }} style={s.closeBtn}>
                      <Text style={{ fontSize: 20, color: Colors.ink3 }}>×</Text>
                    </Pressable>
                  </View>

                  <ScrollView style={{ padding: 20 }}>
                    <View style={[s.statusBanner, { backgroundColor: st.bg }]}>
                      <Text style={[s.statusBannerText, { color: st.color }]}>{st.label}</Text>
                    </View>

                    <Text style={s.sec}>Pagamento</Text>
                    <View style={cs.card}>
                      <Text style={s.dLine}>
                        {order.payment_method === "on_delivery" ? "💵 Pagamento na entrega" : "💸 Pix manual"}
                      </Text>
                      <Text style={s.dSub}>
                        {order.payment_status === "confirmed"
                          ? "✓ Pagamento confirmado"
                          : order.payment_method === "on_delivery"
                            ? "Cliente paga no momento da entrega/retirada"
                            : isAwaiting
                              ? "Cliente avisou que pagou — confirme abaixo"
                              : "Aguardando cliente pagar"}
                      </Text>

                      {order.payment_proof_url && (
                        <Pressable onPress={() => openProof(order.payment_proof_url)} style={s.proofThumb}>
                          {order.payment_proof_url.toLowerCase().includes(".pdf") ? (
                            <View style={s.proofPdf}>
                              <Text style={{ fontSize: 28 }}>📄</Text>
                              <Text style={s.proofPdfText}>Ver comprovante (PDF)</Text>
                            </View>
                          ) : (
                            <Image source={{ uri: order.payment_proof_url }} style={s.proofImg} resizeMode="cover" />
                          )}
                          <Text style={s.proofZoomHint}>🔍 Toque pra ampliar</Text>
                        </Pressable>
                      )}
                    </View>

                    <Text style={s.sec}>Cliente</Text>
                    <View style={cs.card}>
                      <Text style={s.dLine}>{order.customer_name}</Text>
                      {!!order.customer_phone && (
                        <Pressable onPress={() => Linking.openURL(`https://wa.me/${order.customer_phone.replace(/\D/g, "")}`)}>
                          <Text style={[s.dSub, { color: Colors.violet3 }]}>{order.customer_phone} (abrir WhatsApp)</Text>
                        </Pressable>
                      )}
                      {!!order.customer_email && <Text style={s.dSub}>{order.customer_email}</Text>}
                    </View>

                    <Text style={s.sec}>Entrega</Text>
                    <View style={cs.card}>
                      <Text style={s.dLine}>{order.delivery_type === "delivery" ? "🚚 Entrega a domicílio" : "🏪 Retirada no local"}</Text>
                      {!!order.delivery_address && <Text style={s.dSub}>{order.delivery_address}</Text>}
                    </View>

                    <Text style={s.sec}>Itens</Text>
                    <View style={cs.card}>
                      {(order.items || []).map((item: any, i: number) => (
                        <View key={i} style={[s.itemRow, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, paddingTop: 8 }]}>
                          <Text style={s.itemName}>{item.product_name} × {item.quantity}</Text>
                          <Text style={s.itemPrice}>{fmt(item.subtotal)}</Text>
                        </View>
                      ))}
                      <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 10, paddingTop: 8 }}>
                        {order.delivery_fee > 0 && (
                          <View style={s.sumRow}><Text style={s.sumLabel}>Entrega</Text><Text style={s.sumVal}>{fmt(order.delivery_fee)}</Text></View>
                        )}
                        <View style={s.sumRow}>
                          <Text style={[s.sumLabel, { fontWeight: "800", color: Colors.ink }]}>Total</Text>
                          <Text style={[s.sumVal, { fontWeight: "800", color: Colors.ink }]}>{fmt(order.total)}</Text>
                        </View>
                      </View>
                    </View>

                    {!!order.notes && (
                      <>
                        <Text style={s.sec}>Observações</Text>
                        <View style={cs.card}><Text style={s.dLine}>{order.notes}</Text></View>
                      </>
                    )}

                    {/* Caixa de motivo de rejeição (aparece quando user clica em Rejeitar) */}
                    {isAwaiting && showRejectInput && (
                      <View style={[cs.card, { borderColor: "#fecaca", backgroundColor: "#fef2f2" }]}>
                        <Text style={[cs.fieldLabel, { color: "#dc2626" }]}>Motivo da rejeição (opcional)</Text>
                        <TextInput
                          style={cs.input}
                          value={rejectReason}
                          onChangeText={setRejectReason}
                          placeholder="Ex: comprovante não bate com o valor"
                          placeholderTextColor={Colors.ink3}
                          multiline
                        />
                      </View>
                    )}

                    <View style={{ height: 24 }} />
                  </ScrollView>

                  <View style={s.sheetFoot}>
                    {isAwaiting && !showRejectInput && (
                      <>
                        <Pressable onPress={() => setShowRejectInput(true)} disabled={working} style={[s.cancelBtn, working && { opacity: 0.6 }]}>
                          <Text style={s.cancelText}>Rejeitar</Text>
                        </Pressable>
                        <Pressable onPress={approvePayment} disabled={working} style={[s.advBtn, { backgroundColor: Colors.green }, working && { opacity: 0.6 }]}>
                          <Text style={s.advText}>{working ? "..." : "✓ Aprovar pagamento"}</Text>
                        </Pressable>
                      </>
                    )}
                    {isAwaiting && showRejectInput && (
                      <>
                        <Pressable onPress={() => { setShowRejectInput(false); setRejectReason(""); }} disabled={working} style={[s.cancelBtn, working && { opacity: 0.6 }]}>
                          <Text style={s.cancelText}>Voltar</Text>
                        </Pressable>
                        <Pressable onPress={rejectPayment} disabled={working} style={[s.advBtn, { backgroundColor: "#dc2626" }, working && { opacity: 0.6 }]}>
                          <Text style={s.advText}>{working ? "..." : "Confirmar rejeição"}</Text>
                        </Pressable>
                      </>
                    )}
                    {!isAwaiting && canCancel && (
                      <Pressable onPress={cancel} disabled={isUpdating} style={[s.cancelBtn, isUpdating && { opacity: 0.6 }]}>
                        <Text style={s.cancelText}>Cancelar pedido</Text>
                      </Pressable>
                    )}
                    {!isAwaiting && !!nextSt && (
                      <Pressable onPress={advance} disabled={isUpdating} style={[s.advBtn, isUpdating && { opacity: 0.6 }]}>
                        <Text style={s.advText}>{isUpdating ? "..." : `→ ${STATUS_MAP[nextSt]?.label}`}</Text>
                      </Pressable>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Lightbox do comprovante */}
      <Modal
        visible={!!proofZoom}
        animationType="fade"
        transparent
        onRequestClose={() => setProofZoom(null)}
      >
        <Pressable style={s.lightbox} onPress={() => setProofZoom(null)}>
          {proofZoom && (
            proofZoom.toLowerCase().includes(".pdf") ? (
              <View style={{ alignItems: "center", gap: 16 }}>
                <Text style={{ color: "#fff", fontSize: 18 }}>📄 Comprovante em PDF</Text>
                <Pressable onPress={() => Linking.openURL(proofZoom)} style={s.lightboxOpenBtn}>
                  <Text style={s.lightboxOpenText}>Abrir PDF em nova aba</Text>
                </Pressable>
              </View>
            ) : (
              <Image source={{ uri: proofZoom }} style={s.lightboxImg} resizeMode="contain" />
            )
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, borderTopWidth: 3, alignItems: "center" },
  kpiNum: { fontSize: 18, fontWeight: "800", marginBottom: 3 },
  kpiLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", textAlign: "center" },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10, alignSelf: "flex-end" },
  refreshText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  emptyDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", lineHeight: 18, maxWidth: 260 },
  card: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardHighlight: { borderColor: "#fecaca", borderWidth: 2, backgroundColor: "#fff5f5" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardNum: { fontSize: 13, fontWeight: "800", color: Colors.ink },
  cardCustomer: { fontSize: 12, color: Colors.ink3, marginBottom: 8 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTotal: { fontSize: 15, fontWeight: "800", color: Colors.ink },
  cardMeta: { fontSize: 10, color: Colors.ink3, flex: 1, textAlign: "right", marginLeft: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  proofBadgeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.border },
  proofBadgeText: { fontSize: 11, color: Colors.green, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%", overflow: "hidden" },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  sheetSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  statusBanner: { borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 8 },
  statusBannerText: { fontSize: 14, fontWeight: "800" },
  sec: { fontSize: 11, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 14 },
  dLine: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  dSub: { fontSize: 12, color: Colors.ink3, marginTop: 3 },
  proofThumb: { marginTop: 12, alignItems: "center", gap: 6 },
  proofImg: { width: "100%" as any, height: 180, borderRadius: 10, backgroundColor: Colors.bg4 },
  proofPdf: { width: "100%" as any, height: 100, borderRadius: 10, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", gap: 6 },
  proofPdfText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  proofZoomHint: { fontSize: 11, color: Colors.ink3 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemName: { fontSize: 13, color: Colors.ink, flex: 1 },
  itemPrice: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  sumRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  sumLabel: { fontSize: 13, color: Colors.ink3 },
  sumVal: { fontSize: 13, color: Colors.ink3 },
  sheetFoot: { flexDirection: "row", gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 13, fontWeight: "700", color: Colors.ink3 },
  advBtn: { flex: 2, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  advText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  // Lightbox
  lightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center", padding: 20 },
  lightboxImg: { width: "100%" as any, height: "80%" as any },
  lightboxOpenBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14 },
  lightboxOpenText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
