// ============================================================
// TabHistorico — Aura · Crediário (F3 do redesign; spec §2.3)
//
// F3: legenda de cores no topo (● pagamento ● compra ● ajuste);
// confirmações "Devolver"/"Excluir" migram do Sim/Não inline para o
// <ConfirmGate> (padrão único, slide-down animado); alvos de ação
// sobem para ≥40px. Auto-load ao abrir a aba já acontece no shell.
// Lógica preservada: recibo, devolução (B4/B5), excluir manual_debit,
// paginação por cursor.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { creditApi, printReceipt, type CreditHistoryEvent } from "@/services/creditApi";
import { toast } from "@/components/Toast";
import { ConfirmGate } from "@/components/ConfirmGate";
import { fmt, fmtDate } from "./fichaHelpers";
import { m } from "./fichaStyles";
import { pdvApi } from "@/services/pdvApi";
import { DevolucaoModal, type DevolucaoSale } from "@/components/crediario/DevolucaoModal";

export type TabHistoricoProps = {
  histEvents: CreditHistoryEvent[];
  histCursor: string | null;
  histLoading: boolean;
  histLoaded: boolean;
  loadHistory: (cursor?: string | null) => void;
  setHistLoaded: (v: boolean) => void;
  // contexto passado pelo shell (ClienteCrediarioModal)
  companyId: string;
  customerId: string;
  onRefresh: () => void;
};

export function TabHistorico({
  histEvents, histCursor, histLoading, histLoaded, loadHistory, setHistLoaded,
  companyId, onRefresh,
}: TabHistoricoProps) {
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [loadingRefundId, setLoadingRefundId] = useState<string | null>(null);
  const [refundSale, setRefundSale] = useState<DevolucaoSale | null>(null);
  // ConfirmGate (padrão único F3): id do evento aguardando confirmação.
  const [confirmRefundId, setConfirmRefundId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handlePrintReceipt(transactionId: string) {
    setPrintingId(transactionId);
    try {
      await printReceipt(companyId, transactionId);
    } catch (err) {
      console.error("[crediário] printReceipt error:", err);
      toast.error("Não foi possível abrir o recibo. Tente novamente.");
    } finally {
      setPrintingId(null);
    }
  }

  async function openRefund(ev: CreditHistoryEvent) {
    if (!ev.sale_id) return;
    setLoadingRefundId(ev.id);
    try {
      const sale = await pdvApi.getSale(companyId, ev.sale_id);
      // Mapeia itens: id real do sale_item; clamp quantity = vendida − já devolvida;
      // pula itens sem quantidade disponível para devolver.
      const items = (sale.items || []).flatMap((it) => {
        const refunded = it.refunded_quantity ?? 0;
        const available = it.quantity - refunded;
        if (available <= 0) return [];
        return [{
          id: it.id,
          product_name: it.product_name,
          quantity: available,
          unit_price: it.unit_price,
          total_price: it.unit_price * available,
        }];
      });
      if (items.length === 0) {
        toast.error("Todos os itens desta venda já foram devolvidos.");
        return;
      }
      setRefundSale({ id: sale.id, items });
    } catch (err) {
      console.error("[crediário] openRefund error:", err);
      toast.error("Não foi possível carregar a venda. Tente novamente.");
    } finally {
      setLoadingRefundId(null);
    }
  }

  // Exclui um lançamento manual (manual_debit) via DELETE /credit/transaction/:id.
  // Após sucesso, recarrega a timeline do zero (evita paginação inconsistente) e
  // invalida saldo/perfil via onRefresh (mesmo callback usado pela devolução).
  async function handleDelete(transactionId: string) {
    setDeletingId(transactionId);
    try {
      await creditApi.undoTransaction(companyId, transactionId);
      toast.success("Lançamento excluído!");
      onRefresh();
      setHistLoaded(false);
      loadHistory();
    } catch (err: any) {
      console.error("[crediário] undoTransaction error:", err);
      toast.error(err?.data?.error || "Não foi possível excluir o lançamento. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
<View>
  <View style={m.card}>
    <View style={m.cardTitleRow}>
      <Text style={m.cardTitle}>Linha do tempo</Text>
      <Pressable
        style={[m.newAccBtn, { minHeight: 32 }]}
        onPress={() => { setHistLoaded(false); loadHistory(); }}
        disabled={histLoading}
      >
        <Icon name="refresh_cw" size={11} color={Colors.violet3} />
        <Text style={m.newAccTxt}>Atualizar</Text>
      </Pressable>
    </View>

    {/* F3: legenda de cores — antes os dots não tinham significado descobrível */}
    <View style={lc.legendRow}>
      <View style={lc.legendItem}><View style={[lc.legendDot, { backgroundColor: Colors.green }]} /><Text style={lc.legendTxt}>pagamento</Text></View>
      <View style={lc.legendItem}><View style={[lc.legendDot, { backgroundColor: Colors.violet3 }]} /><Text style={lc.legendTxt}>compra</Text></View>
      <View style={lc.legendItem}><View style={[lc.legendDot, { backgroundColor: Colors.amber }]} /><Text style={lc.legendTxt}>débito/ajuste</Text></View>
    </View>

    {histLoading && histEvents.length === 0 && (
      <View style={{ paddingVertical: 24, alignItems: "center" }}>
        <ActivityIndicator color={Colors.violet3} />
      </View>
    )}

    {!histLoading && !histLoaded && (
      <Pressable
        style={[m.cta, { marginVertical: 10 }]}
        onPress={() => loadHistory()}
      >
        <Text style={m.ctaTxt}>Carregar histórico</Text>
      </Pressable>
    )}

    {histEvents.length === 0 && histLoaded && !histLoading && (
      <Text style={m.emptyTxt}>Sem eventos no histórico.</Text>
    )}

    {histEvents.map((ev) => {
      const isCredit = ev.amount < 0;
      const typeLabels: Record<string, string> = {
        purchase: "Compra",
        manual_debit: "Débito manual",
        payment: "Pagamento",
        exchange_credit: "Crédito de troca",
        refund: "Devolução",
      };
      const typeLabel = typeLabels[ev.type] ?? ev.type;
      const methodStr = ev.payment?.method ? ` · ${ev.payment.method}` : "";
      const isPrinting = printingId === ev.id;
      const isLoadingRefund = loadingRefundId === ev.id;
      const canRefund = ev.type === "purchase" && !!ev.sale_id;
      // Só lançamento manual (sem venda/parcela vinculada) pode ser excluído pela
      // timeline — purchase/payment/refund têm efeitos colaterais (parcelas, estoque,
      // venda) que o endpoint genérico de "undo" pode não reverter corretamente.
      const canDelete = ev.type === "manual_debit";
      const isDeleting = deletingId === ev.id;
      return (
        <View key={ev.id} style={m.tlItem}>
          <View style={[m.tlDot, { backgroundColor: isCredit ? Colors.green : (ev.type === "purchase" ? Colors.violet3 : Colors.amber) }]} />
          <View style={{ flex: 1 }}>
            <View style={m.tlLine}>
              <Text style={m.tlMain}>{typeLabel}{methodStr}</Text>
              <Text style={[m.tlAmt, { color: isCredit ? Colors.green : Colors.red }]}>
                {isCredit ? "" : "+"}{fmt(Math.abs(ev.amount))}
              </Text>
            </View>
            <Text style={m.tlSub}>{fmtDate(ev.occurred_at)}</Text>
            {ev.items && ev.items.length > 0 && (
              <View style={lc.itemList}>
                {ev.items.map((it, idx) => (
                  <View key={idx} style={lc.itemRow}>
                    <Text style={lc.itemQty}>{it.quantity}×</Text>
                    <Text style={lc.itemName} numberOfLines={1}>{it.product_name}</Text>
                    <Text style={lc.itemTotal}>{fmt(it.total / 100)}</Text>
                  </View>
                ))}
              </View>
            )}
            {/* Ações: Recibo (payments), Devolver (purchases com sale_id) e Excluir (manual_debit) */}
            {(ev.type === "payment" || canRefund || canDelete) && (
              <View style={lc.actionRow}>
                {ev.type === "payment" && (
                  <Pressable
                    style={[lc.actionBtn, isPrinting && { opacity: 0.5 }]}
                    onPress={() => handlePrintReceipt(ev.id)}
                    disabled={isPrinting}
                    hitSlop={4}
                  >
                    {isPrinting
                      ? <ActivityIndicator size="small" color={Colors.violet3} style={{ width: 12, height: 12 }} />
                      : <Icon name="printer" size={12} color={Colors.violet3} />}
                    <Text style={lc.actionBtnTxt}>Recibo</Text>
                  </Pressable>
                )}
                {canRefund && (
                  <Pressable
                    style={[lc.actionBtn, lc.actionBtnAmber, isLoadingRefund && { opacity: 0.5 }]}
                    onPress={() => { setConfirmDeleteId(null); setConfirmRefundId(prev => prev === ev.id ? null : ev.id); }}
                    disabled={isLoadingRefund}
                    hitSlop={4}
                  >
                    {isLoadingRefund
                      ? <ActivityIndicator size="small" color={Colors.amber} style={{ width: 12, height: 12 }} />
                      : <Icon name="repeat" size={12} color={Colors.amber} />}
                    <Text style={[lc.actionBtnTxt, { color: Colors.amber }]}>Devolver</Text>
                  </Pressable>
                )}
                {canDelete && (
                  <Pressable
                    style={[lc.actionBtn, lc.actionBtnRed, isDeleting && { opacity: 0.5 }]}
                    onPress={() => { setConfirmRefundId(null); setConfirmDeleteId(prev => prev === ev.id ? null : ev.id); }}
                    disabled={isDeleting}
                    hitSlop={4}
                  >
                    {isDeleting
                      ? <ActivityIndicator size="small" color={Colors.red} style={{ width: 12, height: 12 }} />
                      : <Icon name="trash" size={12} color={Colors.red} />}
                    <Text style={[lc.actionBtnTxt, { color: Colors.red }]}>Excluir</Text>
                  </Pressable>
                )}
              </View>
            )}
            {/* ConfirmGate — padrão único de confirmação sensível (F3) */}
            {canRefund && (
              <ConfirmGate
                visible={confirmRefundId === ev.id}
                message={`Devolver itens da compra de ${fmt(Math.abs(ev.amount))}?`}
                confirmLabel="Sim, devolver"
                onConfirm={() => { setConfirmRefundId(null); openRefund(ev); }}
                onCancel={() => setConfirmRefundId(null)}
                loading={isLoadingRefund}
              />
            )}
            {canDelete && (
              <ConfirmGate
                visible={confirmDeleteId === ev.id}
                message={`Excluir o débito manual de ${fmt(Math.abs(ev.amount))}? Isso não pode ser desfeito.`}
                confirmLabel="Sim, excluir"
                tone="red"
                onConfirm={() => { setConfirmDeleteId(null); handleDelete(ev.id); }}
                onCancel={() => setConfirmDeleteId(null)}
                loading={isDeleting}
              />
            )}
          </View>
        </View>
      );
    })}

    {histCursor && !histLoading && (
      <Pressable
        style={[m.cta, { marginTop: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border }]}
        onPress={() => loadHistory(histCursor)}
      >
        <Text style={[m.ctaTxt, { color: Colors.ink2 }]}>Carregar mais</Text>
      </Pressable>
    )}
    {histLoading && histEvents.length > 0 && (
      <View style={{ paddingVertical: 12, alignItems: "center" }}>
        <ActivityIndicator size="small" color={Colors.violet3} />
      </View>
    )}
  </View>

  {/* B4: DevolucaoModal — renderizada fora do map para evitar aninhamento */}
  {refundSale && (
    <DevolucaoModal
      visible={!!refundSale}
      companyId={companyId}
      sale={refundSale}
      onClose={() => setRefundSale(null)}
      onDone={() => {
        setRefundSale(null);
        onRefresh();
        setHistLoaded(false);
        loadHistory();
      }}
    />
  )}
</View>
  );
}

const lc = StyleSheet.create({
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendTxt: { fontSize: 10.5, color: Colors.ink3, fontWeight: "600" },
  itemList: {
    marginTop: 5,
    gap: 3,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  itemQty: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.violet3,
    minWidth: 20,
  },
  itemName: {
    flex: 1,
    fontSize: 11,
    color: Colors.ink2,
  },
  itemTotal: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.ink,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
    gap: 8,
  },
  // F3: alvo ≥40px (antes pv 4 / fonte 11)
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 40,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.bg2,
  },
  actionBtnAmber: {
    borderColor: Colors.amber + "55",
    backgroundColor: Colors.amberD,
  },
  actionBtnRed: {
    borderColor: Colors.red + "55",
    backgroundColor: Colors.redD,
  },
  actionBtnTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.violet3,
  },
});
