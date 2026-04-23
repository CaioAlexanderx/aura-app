import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Image } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useSaleDetail, useCancelSale } from "@/hooks/useSales";

// ============================================================
// AURA. — Modal de detalhes da venda (Item 3 Eryca)
//
// Renderiza:
//   - Header: total, data/hora, metodo, status (badge cancelada)
//   - Cliente + Vendedora
//   - Lista de items (foto, nome, qty, preco, total)
//   - Footer com 2 botoes:
//       1. "Editar lancamento" -> abre TransactionModal via callback
//          (parente passa transaction_id pra abrir corretamente)
//       2. "Cancelar venda" -> ConfirmDialog com textarea reason
//          So aparece se a venda estiver ATIVA
// ============================================================

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ","); };
var fmtDateTime = function(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  dinheiro: "Dinheiro",
  credit: "Cartao Credito",
  credito: "Cartao Credito",
  debit: "Cartao Debito",
  debito: "Cartao Debito",
  voucher: "Voucher",
};

export function SaleDetailModal({
  visible, saleId, onClose, onEditTransaction,
}: {
  visible: boolean;
  saleId: string | null;
  onClose: () => void;
  onEditTransaction?: (transactionId: string) => void;
}) {
  const { detail, isLoading, error } = useSaleDetail(visible ? saleId : null);
  const { cancelSale, isCancelling } = useCancelSale();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (!visible) return null;

  async function handleConfirmCancel() {
    if (!saleId) return;
    try {
      const result = await cancelSale({ saleId: saleId, reason: cancelReason.trim() });
      toast.success(
        "Venda cancelada. " + result.items_returned + " item(s) devolvido(s) ao estoque, " +
        fmt(result.refunded_amount) + " creditado(s) como devolucao."
      );
      setConfirmCancel(false);
      setCancelReason("");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao cancelar venda");
    }
  }

  function handleEditClick() {
    const txId = detail?.sale.transaction_id;
    if (!txId) {
      toast.error("Esta venda nao tem lancamento financeiro vinculado");
      return;
    }
    if (onEditTransaction) {
      onClose();
      onEditTransaction(txId);
    }
  }

  const sale = detail?.sale;
  const isCancelled = sale?.status === "cancelled";
  const items = detail?.items || [];
  const customer = detail?.customer;
  const seller = detail?.seller;
  const paymentLabel = sale?.payment_method ? (PAYMENT_LABELS[sale.payment_method.toLowerCase()] || sale.payment_method) : "-";

  return (
    <View style={s.overlay}>
      <View style={s.modal}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <View style={s.headerTitleRow}>
              <Text style={s.headerTitle}>Detalhes da venda</Text>
              {isCancelled && (
                <View style={s.cancelledBadge}>
                  <Text style={s.cancelledText}>Cancelada</Text>
                </View>
              )}
            </View>
            {sale && <Text style={s.headerDate}>{fmtDateTime(sale.created_at)}</Text>}
          </View>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>x</Text>
          </Pressable>
        </View>

        {/* Loading / Error */}
        {isLoading && (
          <View style={s.loadingBox}>
            <ActivityIndicator color={Colors.violet3} />
            <Text style={s.loadingText}>Carregando venda...</Text>
          </View>
        )}
        {error && !isLoading && (
          <View style={s.errorBox}>
            <Icon name="alert" size={16} color={Colors.red} />
            <Text style={s.errorText}>{(error as any)?.data?.error || error.message || "Erro ao carregar"}</Text>
          </View>
        )}

        {/* Conteudo */}
        {detail && sale && (
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: 4 }}>
            {/* Card de totais */}
            <View style={[s.totalCard, isCancelled && s.totalCardCancelled]}>
              <Text style={s.totalLabel}>Valor da venda</Text>
              <Text style={[s.totalValue, isCancelled && s.totalValueStrike]}>{fmt(sale.total_amount)}</Text>
              {sale.discount_amount > 0 && (
                <Text style={s.totalHint}>Desconto: {fmt(sale.discount_amount)}</Text>
              )}
              <View style={s.totalMetaRow}>
                <View style={s.totalMetaItem}>
                  <Text style={s.totalMetaLabel}>Pagamento</Text>
                  <Text style={s.totalMetaValue}>{paymentLabel}</Text>
                </View>
                <View style={s.totalMetaItem}>
                  <Text style={s.totalMetaLabel}>Itens</Text>
                  <Text style={s.totalMetaValue}>{items.length}</Text>
                </View>
                {sale.coupon_code && (
                  <View style={s.totalMetaItem}>
                    <Text style={s.totalMetaLabel}>Cupom</Text>
                    <Text style={s.totalMetaValue}>{sale.coupon_code}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Cliente + Vendedora */}
            <View style={s.peopleRow}>
              <View style={s.personCard}>
                <Icon name="users" size={12} color={Colors.ink3} />
                <Text style={s.personLabel}>Cliente</Text>
                <Text style={s.personValue} numberOfLines={1}>
                  {customer?.name || "Nao identificado"}
                </Text>
                {customer?.phone && <Text style={s.personHint}>{customer.phone}</Text>}
              </View>
              <View style={s.personCard}>
                <Icon name="user_plus" size={12} color={Colors.ink3} />
                <Text style={s.personLabel}>Vendedora</Text>
                <Text style={s.personValue} numberOfLines={1}>
                  {seller?.name || "Nao informada"}
                </Text>
              </View>
            </View>

            {/* Items */}
            <Text style={s.sectionTitle}>Mercadorias</Text>
            <View style={s.itemsBox}>
              {items.length === 0 && (
                <Text style={s.noItems}>Esta venda nao possui itens.</Text>
              )}
              {items.map(function(item) {
                return (
                  <View key={item.id} style={s.itemRow}>
                    <View style={s.itemImage}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={s.itemImageInner} />
                      ) : (
                        <Icon name="package" size={14} color={Colors.ink3} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName} numberOfLines={2}>{item.product_name}</Text>
                      <Text style={s.itemMeta}>
                        {item.quantity}x {fmt(item.unit_price)}
                        {item.discount > 0 ? "  - " + fmt(item.discount) : ""}
                      </Text>
                    </View>
                    <Text style={s.itemTotal}>{fmt(item.total_price)}</Text>
                  </View>
                );
              })}
            </View>

            {/* Notas se houver */}
            {sale.notes && (
              <View style={s.notesBox}>
                <Text style={s.notesLabel}>Observacoes</Text>
                <Text style={s.notesText}>{sale.notes}</Text>
              </View>
            )}

            {/* Cancelled hint */}
            {isCancelled && sale.cancelled_at && (
              <View style={s.cancelledHint}>
                <Icon name="info" size={12} color={Colors.red} />
                <Text style={s.cancelledHintText}>
                  Esta venda foi cancelada em {fmtDateTime(sale.cancelled_at)}.
                  O estoque foi devolvido e um lancamento de devolucao foi criado no financeiro.
                </Text>
              </View>
            )}

            {/* Acoes */}
            <View style={s.actionsRow}>
              {sale.transaction_id && onEditTransaction && (
                <Pressable
                  onPress={handleEditClick}
                  style={[s.actionBtn, s.actionEdit]}
                >
                  <Icon name="edit" size={13} color={Colors.violet3} />
                  <Text style={s.actionEditText}>Editar lancamento</Text>
                </Pressable>
              )}
              {!isCancelled && (
                <Pressable
                  onPress={function() { setConfirmCancel(true); }}
                  disabled={isCancelling}
                  style={[s.actionBtn, s.actionCancel]}
                >
                  {isCancelling ? (
                    <ActivityIndicator color={Colors.red} size="small" />
                  ) : (
                    <>
                      <Icon name="x" size={13} color={Colors.red} />
                      <Text style={s.actionCancelText}>Cancelar venda</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Confirmacao de cancelamento */}
      {confirmCancel && (
        <View style={s.confirmOverlay}>
          <View style={s.confirmModal}>
            <Text style={s.confirmTitle}>Cancelar venda?</Text>
            <Text style={s.confirmMsg}>
              Todos os {items.length} item(s) sao devolvidos ao estoque, a receita eh
              zerada e um lancamento de devolucao eh criado no financeiro.
              Esta acao nao pode ser desfeita.
            </Text>
            <Text style={s.confirmFieldLabel}>Motivo (opcional)</Text>
            <TextInput
              style={s.confirmInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Ex: cliente desistiu, produto trocado..."
              placeholderTextColor={Colors.ink3}
              multiline
              maxLength={200}
            />
            <View style={s.confirmActions}>
              <Pressable
                onPress={function() { setConfirmCancel(false); setCancelReason(""); }}
                style={s.confirmBtnCancel}
                disabled={isCancelling}
              >
                <Text style={s.confirmBtnCancelText}>Voltar</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmCancel}
                style={s.confirmBtnConfirm}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.confirmBtnConfirmText}>Sim, cancelar venda</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center",
    zIndex: 100,
  },
  modal: {
    backgroundColor: Colors.bg3, borderRadius: 20, padding: 24,
    maxWidth: 580, width: "92%", borderWidth: 1, borderColor: Colors.border2,
    maxHeight: "92%",
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 18, color: Colors.ink, fontWeight: "700" },
  headerDate: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  cancelledBadge: { backgroundColor: Colors.redD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.red + "55" },
  cancelledText: { fontSize: 9, color: Colors.red, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },

  loadingBox: { paddingVertical: 50, alignItems: "center", gap: 12 },
  loadingText: { fontSize: 12, color: Colors.ink3 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, backgroundColor: Colors.redD, borderRadius: 10, borderWidth: 1, borderColor: Colors.red + "33" },
  errorText: { flex: 1, fontSize: 12, color: Colors.red },

  totalCard: { backgroundColor: Colors.bg4, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  totalCardCancelled: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  totalLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  totalValue: { fontSize: 28, color: Colors.green, fontWeight: "800", marginTop: 4 },
  totalValueStrike: { color: Colors.red, textDecorationLine: "line-through" as any },
  totalHint: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  totalMetaRow: { flexDirection: "row", gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, width: "100%", justifyContent: "center" },
  totalMetaItem: { alignItems: "center" },
  totalMetaLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  totalMetaValue: { fontSize: 12, color: Colors.ink, fontWeight: "600", marginTop: 3 },

  peopleRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  personCard: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  personLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 2 },
  personValue: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  personHint: { fontSize: 10, color: Colors.ink3 },

  sectionTitle: { fontSize: 11, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8, marginTop: 4 },
  itemsBox: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  noItems: { fontSize: 12, color: Colors.ink3, fontStyle: "italic", textAlign: "center", paddingVertical: 16 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 8 },
  itemImage: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  itemImageInner: { width: 36, height: 36 },
  itemName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  itemMeta: { fontSize: 10.5, color: Colors.ink3, marginTop: 2 },
  itemTotal: { fontSize: 13, color: Colors.green, fontWeight: "700" },

  notesBox: { backgroundColor: Colors.bg4, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  notesLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  notesText: { fontSize: 12, color: Colors.ink, marginTop: 4, lineHeight: 17 },

  cancelledHint: { flexDirection: "row", gap: 8, padding: 10, backgroundColor: Colors.redD, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: Colors.red + "33" },
  cancelledHintText: { flex: 1, fontSize: 11, color: Colors.red, lineHeight: 15 },

  actionsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  actionEdit: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  actionEditText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  actionCancel: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  actionCancelText: { fontSize: 12, color: Colors.red, fontWeight: "600" },

  // ConfirmDialog inline (sobre o modal pra preservar contexto)
  confirmOverlay: {
    position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center",
    zIndex: 200,
  },
  confirmModal: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, maxWidth: 420, width: "90%", borderWidth: 1, borderColor: Colors.border2 },
  confirmTitle: { fontSize: 16, color: Colors.ink, fontWeight: "700", marginBottom: 8 },
  confirmMsg: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginBottom: 14 },
  confirmFieldLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4 },
  confirmInput: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: Colors.ink, minHeight: 60, textAlignVertical: "top", marginBottom: 14 },
  confirmActions: { flexDirection: "row", gap: 8 },
  confirmBtnCancel: { flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  confirmBtnCancelText: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  confirmBtnConfirm: { flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: Colors.red, alignItems: "center" },
  confirmBtnConfirmText: { fontSize: 12, color: "#fff", fontWeight: "700" },
});

export default SaleDetailModal;
