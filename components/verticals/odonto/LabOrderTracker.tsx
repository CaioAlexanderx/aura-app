import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-12: LabOrderTracker — Prosthetic/lab work tracking
// Pipeline: Pendente → Enviado → Producao → Pronto → Entregue
// ============================================================

export interface LabOrder {
  id: string;
  patient_name: string;
  lab_name: string;
  item_type: string;
  material?: string;
  tooth_number?: number;
  shade?: string;
  cost: number;
  deadline?: string;
  status: "pendente" | "enviado" | "producao" | "pronto" | "entregue" | "refeito";
  sent_at?: string;
  received_at?: string;
  notes?: string;
}

interface Props {
  orders: LabOrder[];
  summary?: { pending: number; inProduction: number; ready: number; totalCost: number };
  onNewOrder?: () => void;
  onOrderPress?: (orderId: string) => void;
  onStatusChange?: (orderId: string, newStatus: string) => void;
}

const STATUS: Record<string, { bg: string; color: string; label: string; next?: string }> = {
  pendente:  { bg: "rgba(156,163,175,0.12)", color: "#9CA3AF", label: "Pendente",  next: "enviado" },
  enviado:   { bg: "rgba(6,182,212,0.12)",   color: "#06B6D4", label: "Enviado",   next: "producao" },
  producao:  { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B", label: "Producao",  next: "pronto" },
  pronto:    { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Pronto",    next: "entregue" },
  entregue:  { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Entregue" },
  refeito:   { bg: "rgba(239,68,68,0.12)",   color: "#EF4444", label: "Refeito" },
};

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0 }); }

export function LabOrderTracker({ orders, summary, onNewOrder, onOrderPress, onStatusChange }: Props) {
  const s_pending = summary?.pending ?? orders.filter(o => o.status === "pendente").length;
  const s_prod = summary?.inProduction ?? orders.filter(o => ["enviado","producao"].includes(o.status)).length;
  const s_ready = summary?.ready ?? orders.filter(o => o.status === "pronto").length;
  const s_cost = summary?.totalCost ?? orders.reduce((s, o) => s + Number(o.cost), 0);

  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#9CA3AF" }]}>{s_pending}</Text><Text style={s.kpiLbl}>Pendentes</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{s_prod}</Text><Text style={s.kpiLbl}>Em producao</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{s_ready}</Text><Text style={s.kpiLbl}>Prontos</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>{fmt(s_cost)}</Text><Text style={s.kpiLbl}>Custo total</Text></View>
      </View>

      <View style={s.header}>
        <Text style={s.title}>Pedidos de laboratorio</Text>
        {onNewOrder && <Pressable onPress={onNewOrder} style={s.addBtn}><Text style={s.addBtnT}>+ Novo pedido</Text></Pressable>}
      </View>

      {orders.map(order => {
        const st = STATUS[order.status] || STATUS.pendente;
        const daysLeft = order.deadline ? Math.ceil((new Date(order.deadline).getTime() - Date.now()) / 86400000) : null;
        return (
          <Pressable key={order.id} onPress={() => onOrderPress?.(order.id)} style={[s.card, { borderLeftColor: st.color }]}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.itemType}>{order.item_type}{order.material ? " \u2014 " + order.material : ""}</Text>
              <Text style={s.patient}>{order.patient_name}{order.tooth_number ? " #" + order.tooth_number : ""}{order.shade ? " (" + order.shade + ")" : ""}</Text>
              <Text style={s.lab}>{order.lab_name}{daysLeft !== null ? " \u2022 " + (daysLeft < 0 ? Math.abs(daysLeft) + "d atrasado" : daysLeft + "d restantes") : ""}</Text>
            </View>
            <View style={s.rightCol}>
              <View style={[s.badge, { backgroundColor: st.bg }]}><Text style={[s.badgeT, { color: st.color }]}>{st.label}</Text></View>
              <Text style={s.cost}>{fmt(Number(order.cost))}</Text>
              {st.next && onStatusChange && (
                <Pressable onPress={() => onStatusChange(order.id, st.next!)} style={[s.nextBtn, { borderColor: st.color }]}>
                  <Text style={[s.nextBtnT, { color: st.color }]}>{STATUS[st.next].label} \u2192</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        );
      })}
      {orders.length === 0 && <View style={s.empty}><Text style={s.emptyT}>Nenhum pedido de laboratorio.</Text></View>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e", borderRadius: 10, padding: 10, alignItems: "center" },
  kpiVal: { fontSize: 18, fontWeight: "700" },
  kpiLbl: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 14, fontWeight: "700", color: Colors.ink || "#fff" },
  addBtn: { backgroundColor: "#06B6D4", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  card: { flexDirection: "row", padding: 12, borderRadius: 10, borderLeftWidth: 3, backgroundColor: Colors.bg2 || "#1a1a2e", gap: 10 },
  itemType: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  patient: { fontSize: 12, color: Colors.ink2 || "#aaa" },
  lab: { fontSize: 11, color: Colors.ink3 || "#888" },
  rightCol: { alignItems: "flex-end", gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeT: { fontSize: 9, fontWeight: "600" },
  cost: { fontSize: 12, fontWeight: "600", color: Colors.ink || "#fff" },
  nextBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 0.5 },
  nextBtnT: { fontSize: 9, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 24 },
  emptyT: { fontSize: 13, color: Colors.ink3 || "#888" },
});

export default LabOrderTracker;
