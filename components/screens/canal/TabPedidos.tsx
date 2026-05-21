// ============================================================
// AURA. — Canal Digital · TabPedidos
// 03/05: Pix manual flow — comprovante anexado + Aprovar/Rejeitar.
// 11/05: Confirmação manual de pagamento — quick-action "✓ Pago" no
//   card da lista + botão "Confirmar pagamento recebido" no detalhe,
//   agora cobrindo pedidos com status `pending_payment` (cliente NÃO
//   clicou "Já paguei" no site, mas o lojista viu o Pix cair). O
//   endpoint backend `approve-payment` já aceita esse status — só a
//   UI estava restrita a `awaiting_approval`.
// 18/05: Audit Rec #8 — chips de filtro de 7 status granulares pra 4
//   grupos cliente-facing (Precisa agir / Em curso / Concluídos /
//   Cancelados) + "Todos". O status interno continua visível no card
//   e no detalhe; só o filtro foi agrupado. "Precisa agir" tem badge
//   de contagem porque é o que demanda ação imediata.
// 21/05: MP CheckoutPro Fase 2 follow-up — payment_method='card'
//   ganha label/icon proprios (💳 Cartão), copy distinta no detalhe,
//   e canApprovePayment exclui card (confirmação via webhook MP).
//   STATUS_MAP.pending_payment vira label genérica.
// 21/05: Davi pediu fluxo de excluir pedidos teste — botão "Excluir pedido
//   permanentemente" no modal de detalhe (só aparece em cancelled/pending_payment
//   sem transação/estoque/nfce). Chama DELETE /orders/:oid, backend valida.
// ============================================================
import { useMemo, useState } from "react";
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
  pending_payment:    { label: "Aguardando pagamento", color: "#d97706", bg: "#fef3c7" },
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

// Audit Rec #8: chips consolidados em 4 grupos cliente-facing (+ Todos).
// O status granular do backend continua intacto — só o filtro agrupa.
// "Precisa agir" é o único com badge de contagem porque demanda ação.
type ChipKey = "all" | "precisa-agir" | "em-curso" | "concluidos" | "cancelados";

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "all",          label: "Todos" },
  { key: "precisa-agir", label: "Precisa agir" },
  { key: "em-curso",     label: "Em curso" },
  { key: "concluidos",   label: "Concluídos" },
  { key: "cancelados",   label: "Cancelados" },
];

const GROUP_STATUSES: Record<Exclude<ChipKey, "all">, string[]> = {
  "precisa-agir": ["pending_payment", "awaiting_approval"],
  "em-curso":     ["confirmed", "preparing", "ready"],
  "concluidos":   ["delivered"],
  "cancelados":   ["cancelled"],
};

// Pedidos onde o lojista pode confirmar pagamento manualmente.
// - `awaiting_approval`: cliente clicou "Já paguei" + anexou comprovante
// - `pending_payment`: cliente NÃO clicou "Já paguei" mas Pix pode ter
//   sido pago de qualquer jeito (cliente esqueceu, fechou aba, etc).
//   Lojista valida no extrato e confirma manualmente.
//
// 21/05/2026: cartão (CheckoutPro) NUNCA aceita confirmação manual —
// MP só marca como aprovado via webhook após captura real. Botão manual
// pra card geraria divergencia entre Aura e o que o lojista efetivamente
// recebeu (pode ter sido recusa antifraude / chargeback).
function canApprovePayment(order: any): boolean {
  if (!order) return false;
  if (order.payment_method === "card") return false;
  return order.status === "awaiting_approval" || order.status === "pending_payment";
}

// Pode excluir definitivamente quando:
//   - status === 'cancelled' OU 'pending_payment'
//   - sem transação financeira/estoque/NFCe vinculados (backend revalida)
// Botão fica disponível só nesses casos pra evitar perda de histórico.
function canDeleteOrder(order: any): boolean {
  if (!order) return false;
  if (!["cancelled", "pending_payment"].includes(order.status)) return false;
  if (order.transaction_id) return false;
  if (order.stock_deducted) return false;
  if (order.confirmed_at) return false;
  if (order.nfce_id) return false;
  return true;
}

// 21/05/2026: helpers de display do método de pagamento.
function paymentMethodIcon(method: string | undefined): string {
  if (method === "card") return "💳";
  if (method === "on_delivery") return "💵";
  return "💸";
}
function paymentMethodShortLabel(method: string | undefined): string {
  if (method === "card") return "Cartão";
  if (method === "on_delivery") return "Na entrega";
  return "Pix";
}
function paymentMethodLongLabel(method: string | undefined): string {
  if (method === "card") return "Cartão de crédito (Mercado Pago)";
  if (method === "on_delivery") return "Pagamento na entrega";
  return "Pix manual";
}

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
  const [filter, setFilter] = useState<ChipKey>("all");
  const [order, setOrder] = useState<any>(null);
  const [proofZoom, setProofZoom] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [working, setWorking] = useState(false);
  // ID do pedido que está com a quick-action em andamento (loading state inline)
  const [approvingId, setApprovingId] = useState<string | null>(null);
  // Hook sempre busca "all" — filtro de grupo é aplicado client-side
  // pra mapear N status granulares -> 1 chip sem precisar mudar a API.
  const { orders, kpi, counts, isLoading, refetch, updateStatus, isUpdating, deleteOrder, isDeleting } = useDigitalOrders("all");

  // companyId pode vir via prop OU ser pego do hook (fallback usa qualquer endpoint que ja tem cid)
  const cid = companyId || (orders[0]?.company_id) || null;

  // Filtragem client-side por grupo. Os status do backend continuam
  // chegando intactos — só agrupamos pra UI.
  const filteredOrders = useMemo(() => {
    if (filter === "all") return orders;
    const allow = GROUP_STATUSES[filter];
    if (!allow) return orders;
    return orders.filter((o: any) => allow.includes(o.status));
  }, [orders, filter]);

  // Contagem do badge "Precisa agir" — usa counts.* do backend quando
  // disponível (mais preciso, conta tudo no DB), fallback no client.
  const precisaAgirCount = useMemo(() => {
    const fromCounts =
      (counts?.pending_payment || 0) + (counts?.awaiting_approval || 0);
    if (fromCounts > 0) return fromCounts;
    return orders.filter((o: any) =>
      GROUP_STATUSES["precisa-agir"].includes(o.status)
    ).length;
  }, [counts, orders]);

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

  // Chamada genérica do endpoint approve-payment. Aceita pedidos em
  // `awaiting_approval` ou `pending_payment` (validação no backend).
  // `fromList` indica se foi acionado via quick-action no card (loading
  // inline) ou via modal (loading global).
  async function approvePayment(targetOrder: any, opts?: { fromList?: boolean }) {
    if (!targetOrder || !cid) return;
    const fromList = !!opts?.fromList;
    if (fromList) {
      setApprovingId(targetOrder.id);
    } else {
      setWorking(true);
    }
    try {
      await api.post(`/companies/${cid}/digital-channel/orders/${targetOrder.id}/approve-payment`, {});
      toast.success("Pagamento confirmado · pedido #" + targetOrder.order_number);
      if (!fromList) setOrder(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao confirmar pagamento");
    } finally {
      if (fromList) setApprovingId(null);
      else setWorking(false);
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

  async function handleDelete() {
    if (!order || !cid) return;
    try {
      await deleteOrder(order.id);
      setOrder(null);
      setShowDeleteConfirm(false);
    } catch {}
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

      {/* Filter Chips — 5 chips (Todos + 4 grupos). Audit Rec #8. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
        {CHIPS.map((c) => {
          const active = filter === c.key;
          const showBadge = c.key === "precisa-agir" && precisaAgirCount > 0;
          return (
            <Pressable key={c.key} onPress={() => setFilter(c.key)} style={[cs.filterChip, active && cs.filterChipActive]}>
              <Text style={[cs.filterText, active && cs.filterTextActive]}>{c.label}</Text>
              {showBadge && (
                <View style={s.chipBadge}>
                  <Text style={s.chipBadgeText}>{precisaAgirCount}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable onPress={() => refetch()} style={s.refreshBtn}>
        <Icon name="refresh" size={12} color={Colors.violet3} />
        <Text style={s.refreshText}>Atualizar</Text>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator size="small" color={Colors.violet} style={{ marginTop: 32 }} />
      ) : filteredOrders.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📦</Text>
          <Text style={s.emptyTitle}>Nenhum pedido aqui</Text>
          <Text style={s.emptyDesc}>Quando clientes fizerem pedidos pelo site, eles aparecerão aqui.</Text>
        </View>
      ) : (
        filteredOrders.map((o: any) => {
          const st = STATUS_MAP[o.status] || STATUS_MAP.cancelled;
          const isAwaiting = o.status === "awaiting_approval";
          const isPendingPayment = o.status === "pending_payment";
          const showApproveQuick = canApprovePayment(o);
          return (
            <Pressable key={o.id} style={[s.card, isAwaiting && s.cardHighlight, isPendingPayment && o.payment_method !== "card" && s.cardWarn]} onPress={() => setOrder(o)}>
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
                  {paymentMethodIcon(o.payment_method)} {paymentMethodShortLabel(o.payment_method)}
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
              {/* Quick action: confirmar pagamento direto da lista — não abre modal.
                  Aparece sempre que o pedido aceita aprovação (Pix em pending_payment
                  ou awaiting_approval). Card NUNCA mostra — webhook MP confirma sozinho.
                  Em RN, Pressable filho consome o evento de toque sem disparar o pai. */}
              {showApproveQuick && (
                <View style={s.quickRow}>
                  <Pressable
                    onPress={() => approvePayment(o, { fromList: true })}
                    disabled={approvingId === o.id}
                    style={[s.quickBtn, approvingId === o.id && { opacity: 0.6 }]}
                  >
                    {approvingId === o.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Icon name="check" size={12} color="#fff" />
                        <Text style={s.quickBtnText}>Confirmar pagamento</Text>
                      </>
                    )}
                  </Pressable>
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
        onRequestClose={() => { setOrder(null); setShowRejectInput(false); setRejectReason(""); setShowDeleteConfirm(false); }}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            {order && (() => {
              const st = STATUS_MAP[order.status] || STATUS_MAP.cancelled;
              const nextSt = NEXT_STATUS[order.status];
              const isAwaiting = order.status === "awaiting_approval";
              const isPendingPayment = order.status === "pending_payment";
              const isCard = order.payment_method === "card";
              const canApprove = canApprovePayment(order);
              const canCancel = !["delivered", "cancelled"].includes(order.status);
              return (
                <>
                  <View style={s.sheetHead}>
                    <View>
                      <Text style={s.sheetTitle}>Pedido #{order.order_number}</Text>
                      <Text style={s.sheetSub}>{timeAgo(order.created_at)}</Text>
                    </View>
                    <Pressable onPress={() => { setOrder(null); setShowRejectInput(false); setRejectReason(""); setShowDeleteConfirm(false); }} style={s.closeBtn}>
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
                        {paymentMethodIcon(order.payment_method)} {paymentMethodLongLabel(order.payment_method)}
                      </Text>
                      <Text style={s.dSub}>
                        {order.payment_status === "confirmed"
                          ? (isCard ? "✓ Pagamento confirmado pelo Mercado Pago" : "✓ Pagamento confirmado")
                          : order.payment_method === "on_delivery"
                            ? "Cliente paga no momento da entrega/retirada"
                            : isAwaiting
                              ? "Cliente avisou que pagou — confirme abaixo"
                              : isCard && isPendingPayment
                                ? "Cliente foi para o checkout do Mercado Pago. A confirmação entra automaticamente quando o pagamento for aprovado — você não precisa fazer nada aqui."
                                : isPendingPayment
                                  ? "Cliente ainda não confirmou no site. Se o Pix já caiu na sua conta, confirme manualmente abaixo."
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
                    {canApprove && showRejectInput && (
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

                    {showDeleteConfirm && (
                      <View style={[cs.card, { borderColor: "#fecaca", backgroundColor: "#fef2f2", marginTop: 10 }]}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#dc2626", marginBottom: 6 }}>
                          Excluir pedido permanentemente?
                        </Text>
                        <Text style={{ fontSize: 12, color: Colors.ink3, lineHeight: 17 }}>
                          Esta ação apaga o pedido e seus itens do banco. Não pode ser desfeita. Use só pra pedidos teste.
                        </Text>
                      </View>
                    )}

                    {canDeleteOrder(order) && !showDeleteConfirm && !showRejectInput && (
                      <Pressable onPress={() => setShowDeleteConfirm(true)} style={{ alignSelf: "center", marginTop: 16, padding: 8 }}>
                        <Text style={{ fontSize: 12, color: "#dc2626", fontWeight: "600", textDecorationLine: "underline" }}>
                          Excluir pedido permanentemente
                        </Text>
                      </Pressable>
                    )}

                    <View style={{ height: 24 }} />
                  </ScrollView>

                  <View style={s.sheetFoot}>
                    {showDeleteConfirm ? (
                      <>
                        <Pressable onPress={() => setShowDeleteConfirm(false)} disabled={isDeleting} style={[s.cancelBtn, isDeleting && { opacity: 0.6 }]}>
                          <Text style={s.cancelText}>Voltar</Text>
                        </Pressable>
                        <Pressable onPress={handleDelete} disabled={isDeleting} style={[s.advBtn, { backgroundColor: "#dc2626" }, isDeleting && { opacity: 0.6 }]}>
                          <Text style={s.advText}>{isDeleting ? "Excluindo..." : "Excluir definitivamente"}</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        {/* Fluxo de aprovação cobre awaiting_approval E pending_payment.
                            Awaiting tem comprovante; pending_payment não tem (cliente esqueceu).
                            Em ambos, o lojista pode aprovar/rejeitar.
                            Card NÃO entra aqui (canApprovePayment retorna false). */}
                        {canApprove && !showRejectInput && (
                          <>
                            <Pressable onPress={() => setShowRejectInput(true)} disabled={working} style={[s.cancelBtn, working && { opacity: 0.6 }]}>
                              <Text style={s.cancelText}>Rejeitar</Text>
                            </Pressable>
                            <Pressable onPress={() => approvePayment(order)} disabled={working} style={[s.advBtn, { backgroundColor: Colors.green }, working && { opacity: 0.6 }]}>
                              <Text style={s.advText}>{working ? "..." : (isPendingPayment ? "✓ Confirmar pagamento recebido" : "✓ Aprovar pagamento")}</Text>
                            </Pressable>
                          </>
                        )}
                        {canApprove && showRejectInput && (
                          <>
                            <Pressable onPress={() => { setShowRejectInput(false); setRejectReason(""); }} disabled={working} style={[s.cancelBtn, working && { opacity: 0.6 }]}>
                              <Text style={s.cancelText}>Voltar</Text>
                            </Pressable>
                            <Pressable onPress={rejectPayment} disabled={working} style={[s.advBtn, { backgroundColor: "#dc2626" }, working && { opacity: 0.6 }]}>
                              <Text style={s.advText}>{working ? "..." : "Confirmar rejeição"}</Text>
                            </Pressable>
                          </>
                        )}
                        {!canApprove && canCancel && (
                          <Pressable onPress={cancel} disabled={isUpdating} style={[s.cancelBtn, isUpdating && { opacity: 0.6 }]}>
                            <Text style={s.cancelText}>Cancelar pedido</Text>
                          </Pressable>
                        )}
                        {!canApprove && !!nextSt && (
                          <Pressable onPress={advance} disabled={isUpdating} style={[s.advBtn, isUpdating && { opacity: 0.6 }]}>
                            <Text style={s.advText}>{isUpdating ? "..." : `→ ${STATUS_MAP[nextSt]?.label}`}</Text>
                          </Pressable>
                        )}
                      </>
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
  cardWarn: { borderColor: "#fde68a", borderWidth: 2, backgroundColor: "#fffbeb" },
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
  // Badge de contagem dentro do chip "Precisa agir" — vermelho/contraste
  // pra puxar olho. Aparece só quando count > 0.
  chipBadge: {
    marginLeft: 6, backgroundColor: "#dc2626", borderRadius: 999,
    minWidth: 18, height: 18, paddingHorizontal: 5,
    alignItems: "center", justifyContent: "center",
  },
  chipBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800", lineHeight: 12 },
  quickRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  quickBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: Colors.green, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
  },
  quickBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
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
