import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// B-10: ClubeAssinatura — Monthly subscription management

export interface Subscription { id: string; name: string; description?: string; monthly_price: number; included_services: { service_name: string }[]; is_active: boolean; subscribers_count: number; }
export interface Subscriber { id: string; subscription_id: string; customer_name?: string; status: string; started_at: string; next_billing?: string; }

interface Props { subscriptions: Subscription[]; subscribers?: Subscriber[]; onCreatePlan?: () => void; onSubscribe?: (subId: string) => void; onCancelSubscription?: (subscriberId: string) => void; }

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0 }); }

export function ClubeAssinatura({ subscriptions, subscribers = [], onCreatePlan, onSubscribe, onCancelSubscription }: Props) {
  const activeSubs = subscribers.filter(s => s.status === "ativo");
  const mrr = activeSubs.reduce((total, sub) => {
    const plan = subscriptions.find(s => s.id === sub.subscription_id);
    return total + (plan?.monthly_price || 0);
  }, 0);

  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{activeSubs.length}</Text><Text style={s.kpiLbl}>Assinantes</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{fmt(mrr)}/mes</Text><Text style={s.kpiLbl}>MRR Clube</Text></View>
      </View>
      <View style={s.header}><Text style={s.title}>Clube de assinatura</Text>{onCreatePlan && <Pressable onPress={onCreatePlan} style={s.addBtn}><Text style={s.addBtnT}>+ Criar plano</Text></Pressable>}</View>
      {subscriptions.map(sub => (
        <View key={sub.id} style={s.card}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={s.nameRow}><Text style={s.name}>{sub.name}</Text><View style={s.recBadge}><Text style={s.recText}>Recorrente</Text></View></View>
            {sub.description && <Text style={s.desc}>{sub.description}</Text>}
            <Text style={s.services}>{(sub.included_services || []).map(sv => sv.service_name).join(" + ")}</Text>
          </View>
          <View style={s.priceCol}>
            <Text style={s.price}>{fmt(sub.monthly_price)}<Text style={s.perMonth}>/mes</Text></Text>
            <Text style={s.count}>{sub.subscribers_count} assinantes</Text>
            {onSubscribe && <Pressable onPress={() => onSubscribe(sub.id)} style={s.subBtn}><Text style={s.subBtnT}>Assinar</Text></Pressable>}
          </View>
        </View>
      ))}
      {activeSubs.length > 0 && (
        <View style={s.subsList}>
          <Text style={s.subTitle}>Assinantes ativos</Text>
          {activeSubs.map(sub => (
            <View key={sub.id} style={s.subRow}>
              <Text style={s.subName}>{sub.customer_name || "Cliente"}</Text>
              <Text style={s.subDate}>Desde {new Date(sub.started_at).toLocaleDateString("pt-BR")}</Text>
              <Text style={s.subNext}>Prox: {sub.next_billing ? new Date(sub.next_billing).toLocaleDateString("pt-BR") : "--"}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, kpiRow: { flexDirection: "row", gap: 8 }, kpi: { flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e", borderRadius: 10, padding: 10, alignItems: "center" }, kpiVal: { fontSize: 18, fontWeight: "700" }, kpiLbl: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 14, fontWeight: "700", color: Colors.ink || "#fff" }, addBtn: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  card: { flexDirection: "row", padding: 14, borderRadius: 12, backgroundColor: Colors.bg2 || "#1a1a2e", borderWidth: 0.5, borderColor: "rgba(245,158,11,0.2)", gap: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 }, name: { fontSize: 15, fontWeight: "700", color: Colors.ink || "#fff" }, recBadge: { backgroundColor: "rgba(245,158,11,0.12)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }, recText: { fontSize: 9, fontWeight: "600", color: "#F59E0B" },
  desc: { fontSize: 12, color: Colors.ink2 || "#aaa" }, services: { fontSize: 11, color: "#F59E0B" },
  priceCol: { alignItems: "flex-end", gap: 4 }, price: { fontSize: 20, fontWeight: "700", color: "#F59E0B" }, perMonth: { fontSize: 11, fontWeight: "500" }, count: { fontSize: 10, color: Colors.ink3 || "#888" },
  subBtn: { backgroundColor: "#F59E0B", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }, subBtnT: { color: "#fff", fontSize: 11, fontWeight: "600" },
  subsList: { gap: 4 }, subTitle: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, backgroundColor: Colors.bg2 || "#1a1a2e" },
  subName: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff", flex: 1 }, subDate: { fontSize: 10, color: Colors.ink3 || "#888" }, subNext: { fontSize: 10, color: "#F59E0B" },
});

export default ClubeAssinatura;
