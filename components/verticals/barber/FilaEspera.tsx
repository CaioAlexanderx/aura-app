import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// B-02: FilaEspera — Real-time walk-in queue
// Cards with position, name, service, wait time, actions
// ============================================================

export interface QueueEntry {
  id: string;
  customer_name: string;
  customer_phone?: string;
  service_name?: string;
  professional_name?: string;
  professional_id?: string;
  position: number;
  status: "waiting" | "called" | "in_service" | "done";
  entered_at: string;
  called_at?: string;
}

interface Props {
  queue: QueueEntry[];
  attendedToday?: number;
  avgWaitMinutes?: number;
  onCall?: (entryId: string) => void;
  onDone?: (entryId: string) => void;
  onRemove?: (entryId: string) => void;
  onAddToQueue?: () => void;
}

function minutesAgo(dateStr: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 60000));
}

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  waiting:    { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B", label: "Aguardando" },
  called:     { bg: "rgba(6,182,212,0.12)",   color: "#06B6D4", label: "Chamado" },
  in_service: { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Em atendimento" },
  done:       { bg: "rgba(156,163,175,0.08)",  color: "#9CA3AF", label: "Concluido" },
};

export function FilaEspera({
  queue, attendedToday = 0, avgWaitMinutes = 0,
  onCall, onDone, onRemove, onAddToQueue,
}: Props) {
  const active = queue.filter(q => ["waiting", "called", "in_service"].includes(q.status));
  const waitingCount = queue.filter(q => q.status === "waiting").length;
  const estWait = waitingCount > 0 ? Math.round(avgWaitMinutes * waitingCount / Math.max(1, queue.filter(q => q.status === "in_service").length || 1)) : 0;

  return (
    <View style={s.container}>
      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{waitingCount}</Text><Text style={s.kpiLbl}>Na fila</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>~{estWait || avgWaitMinutes}min</Text><Text style={s.kpiLbl}>Tempo estimado</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>{attendedToday}</Text><Text style={s.kpiLbl}>Atendidos hoje</Text></View>
      </View>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Fila de espera</Text>
        {onAddToQueue && (
          <Pressable onPress={onAddToQueue} style={s.addBtn}>
            <Text style={s.addBtnText}>+ Adicionar</Text>
          </Pressable>
        )}
      </View>

      {/* Queue items */}
      {active.map(entry => {
        const st = STATUS_MAP[entry.status] || STATUS_MAP.waiting;
        const wait = minutesAgo(entry.entered_at);
        const isInService = entry.status === "in_service";

        return (
          <View key={entry.id} style={[s.item, isInService && { borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.04)" }]}>
            {/* Position */}
            <View style={[s.posCircle, isInService && { backgroundColor: "rgba(16,185,129,0.12)" }]}>
              <Text style={[s.posNum, isInService && { color: "#10B981" }]}>{entry.position}</Text>
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{entry.customer_name}</Text>
              <Text style={s.meta}>
                {entry.service_name || "Servico"} \u2014 {wait}min na fila
                {entry.professional_name ? ` \u2014 ${entry.professional_name}` : ""}
              </Text>
            </View>

            {/* Status badge */}
            <View style={[s.badge, { backgroundColor: st.bg }]}>
              <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
            </View>

            {/* Actions */}
            <View style={s.actions}>
              {entry.status === "waiting" && onCall && (
                <Pressable onPress={() => onCall(entry.id)} style={s.actionBtn}>
                  <Text style={s.actionText}>Chamar</Text>
                </Pressable>
              )}
              {(entry.status === "called" || entry.status === "in_service") && onDone && (
                <Pressable onPress={() => onDone(entry.id)} style={[s.actionBtn, { borderColor: "#10B981" }]}>
                  <Text style={[s.actionText, { color: "#10B981" }]}>Concluir</Text>
                </Pressable>
              )}
              {entry.status === "waiting" && onRemove && (
                <Pressable onPress={() => onRemove(entry.id)} style={[s.actionBtn, { borderColor: "#EF4444" }]}>
                  <Text style={[s.actionText, { color: "#EF4444" }]}>Remover</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}

      {active.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>\u2702\uFE0F</Text>
          <Text style={s.emptyTitle}>Fila vazia</Text>
          <Text style={s.emptyText}>Ninguem na fila no momento.</Text>
        </View>
      )}

      {/* Average wait footer */}
      {active.length > 0 && (
        <Text style={s.footer}>
          Tempo medio de espera hoje: {avgWaitMinutes} min
        </Text>
      )}
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
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink || "#fff" },
  addBtn: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  item: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 10, borderWidth: 0.5,
    borderColor: Colors.border || "#333",
    backgroundColor: Colors.bg3 || "#1a1a2e",
  },
  posCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  posNum: { fontSize: 13, fontWeight: "700", color: "#F59E0B" },
  name: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  meta: { fontSize: 11, color: Colors.ink2 || "#aaa", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  actions: { flexDirection: "column", gap: 4 },
  actionBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    borderWidth: 0.5, borderColor: "#F59E0B",
  },
  actionText: { fontSize: 10, fontWeight: "600", color: "#F59E0B" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: Colors.ink || "#fff" },
  emptyText: { fontSize: 12, color: Colors.ink3 || "#888" },
  footer: { textAlign: "center", fontSize: 12, color: Colors.ink3 || "#888", paddingTop: 4 },
});

export default FilaEspera;
