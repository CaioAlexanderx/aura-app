import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { CreditHistoryEvent } from "@/services/creditApi";
import { fmt, fmtDate } from "./fichaHelpers";
import { m } from "./fichaStyles";

export type TabHistoricoProps = {
  histEvents: CreditHistoryEvent[];
  histCursor: string | null;
  histLoading: boolean;
  histLoaded: boolean;
  loadHistory: (cursor?: string | null) => void;
  setHistLoaded: (v: boolean) => void;
};

export function TabHistorico({
  histEvents, histCursor, histLoading, histLoaded, loadHistory, setHistLoaded,
}: TabHistoricoProps) {
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
              <Text style={[m.tlSub, { marginTop: 2 }]} numberOfLines={2}>
                {ev.items.map(it => `${it.quantity}× ${it.product_name}`).join(", ")}
              </Text>
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
</View>
  );
}
