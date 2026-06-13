import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { printReceipt, type CreditHistoryEvent } from "@/services/creditApi";
import { toast } from "@/components/Toast";
import { fmt, fmtDate } from "./fichaHelpers";
import { m } from "./fichaStyles";
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
  companyId, customerId, onRefresh,
}: TabHistoricoProps) {
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [refundSale, setRefundSale] = useState<DevolucaoSale | null>(null);

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

  function handleOpenRefund(ev: CreditHistoryEvent) {
    if (!ev.sale_id) return;
    // Mapeia ev.items → DevolucaoSaleItem (campos compatíveis)
    const items = (ev.items || []).map((it) => ({
      id: it.product_name + "_" + it.unit_price, // fallback: sem sale_item_id na timeline
      product_name: it.product_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total_price: it.total,
    }));
    setRefundSale({ id: ev.sale_id, items });
  }

  return (
<View>
  <View style={m.card}>
    <View style={m.cardTitleRow}>
      <Text style={m.cardTitle}>Linha do tempo</Text>
      <Pressable
        style={m.newAccBtn}
        onPress={() => { setHistLoaded(false); loadHistory(); }}
        disabled={histLoading}
      >
        <Icon name="refresh_cw" size={11} color={Colors.violet3} />
        <Text style={m.newAccTxt}>Atualizar</Text>
      </Pressable>
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
            {/* ── Ações por tipo de evento ── */}
            <View style={lc.actionRow}>
              {ev.type === "payment" && (
                <Pressable
                  style={[lc.actionBtn, isPrinting && { opacity: 0.5 }]}
                  onPress={() => handlePrintReceipt(ev.id)}
                  disabled={isPrinting}
                  hitSlop={6}
                >
                  {isPrinting
                    ? <ActivityIndicator size="small" color={Colors.violet3} style={{ width: 11, height: 11 }} />
                    : <Icon name="printer" size={11} color={Colors.violet3} />}
                  <Text style={lc.actionBtnTxt}>Recibo</Text>
                </Pressable>
              )}
              {ev.type === "purchase" && !!ev.sale_id && (
                <Pressable
                  style={lc.actionBtn}
                  onPress={() => handleOpenRefund(ev)}
                  hitSlop={6}
                >
                  <Icon name="repeat" size={11} color={Colors.amber} />
                  <Text style={[lc.actionBtnTxt, { color: Colors.amber }]}>Devolver</Text>
                </Pressable>
              )}
            </View>
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

  {/* ── Modal de devolução ── */}
  {!!refundSale && (
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
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.bg2,
  },
  actionBtnTxt: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.violet3,
  },
});
