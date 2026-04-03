import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-09: RecallControl — Patient recall/return tracking
// Shows patients due for recall with WhatsApp alert action
// ============================================================

export interface RecallPatient {
  id: string;
  full_name: string;
  phone?: string;
  next_recall: string;
  recall_interval_months: number;
  last_recall_sent?: string;
  days_until_recall: number;
  no_show_count: number;
}

interface Props {
  patients: RecallPatient[];
  onSendRecall?: (patientId: string) => void;
  onSchedule?: (patientId: string) => void;
  onDismiss?: (patientId: string) => void;
}

export function RecallControl({ patients, onSendRecall, onSchedule, onDismiss }: Props) {
  const overdue = patients.filter(p => p.days_until_recall < 0);
  const thisWeek = patients.filter(p => p.days_until_recall >= 0 && p.days_until_recall <= 7);
  const thisMonth = patients.filter(p => p.days_until_recall > 7 && p.days_until_recall <= 30);

  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{overdue.length}</Text><Text style={s.kpiLbl}>Atrasados</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{thisWeek.length}</Text><Text style={s.kpiLbl}>Esta semana</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>{thisMonth.length}</Text><Text style={s.kpiLbl}>Este mes</Text></View>
      </View>

      {/* Overdue section */}
      {overdue.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: "#EF4444" }]}>Atrasados</Text>
          {overdue.map(p => (
            <PatientRecallCard key={p.id} patient={p} urgency="overdue" onSendRecall={onSendRecall} onSchedule={onSchedule} />
          ))}
        </View>
      )}

      {thisWeek.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: "#F59E0B" }]}>Retorno esta semana</Text>
          {thisWeek.map(p => (
            <PatientRecallCard key={p.id} patient={p} urgency="soon" onSendRecall={onSendRecall} onSchedule={onSchedule} />
          ))}
        </View>
      )}

      {thisMonth.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: "#06B6D4" }]}>Retorno este mes</Text>
          {thisMonth.map(p => (
            <PatientRecallCard key={p.id} patient={p} urgency="upcoming" onSendRecall={onSendRecall} onSchedule={onSchedule} />
          ))}
        </View>
      )}

      {patients.length === 0 && (
        <View style={s.empty}><Text style={s.emptyText}>Nenhum paciente com retorno programado.</Text></View>
      )}
    </View>
  );
}

function PatientRecallCard({ patient: p, urgency, onSendRecall, onSchedule }: {
  patient: RecallPatient; urgency: "overdue" | "soon" | "upcoming";
  onSendRecall?: (id: string) => void; onSchedule?: (id: string) => void;
}) {
  const color = urgency === "overdue" ? "#EF4444" : urgency === "soon" ? "#F59E0B" : "#06B6D4";
  const daysText = p.days_until_recall < 0
    ? `${Math.abs(p.days_until_recall)} dias atrasado`
    : p.days_until_recall === 0 ? "Hoje" : `em ${p.days_until_recall} dias`;

  return (
    <View style={[s.card, { borderLeftColor: color }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{p.full_name}</Text>
        <Text style={s.recallDate}>Retorno: {new Date(p.next_recall).toLocaleDateString("pt-BR")} ({daysText})</Text>
        <Text style={s.meta}>Intervalo: {p.recall_interval_months} meses{p.no_show_count > 0 ? ` | ${p.no_show_count} faltas` : ""}</Text>
      </View>
      <View style={s.actions}>
        {onSendRecall && <Pressable onPress={() => onSendRecall(p.id)} style={[s.btn, { borderColor: "#10B981" }]}><Text style={[s.btnText, { color: "#10B981" }]}>WhatsApp</Text></Pressable>}
        {onSchedule && <Pressable onPress={() => onSchedule(p.id)} style={[s.btn, { borderColor: "#06B6D4" }]}><Text style={[s.btnText, { color: "#06B6D4" }]}>Agendar</Text></Pressable>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 14 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e", borderRadius: 10, padding: 10, alignItems: "center" },
  kpiVal: { fontSize: 20, fontWeight: "700" },
  kpiLbl: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: "700" },
  card: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 10, borderLeftWidth: 3,
    backgroundColor: Colors.bg2 || "#1a1a2e",
  },
  name: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  recallDate: { fontSize: 12, color: Colors.ink2 || "#aaa", marginTop: 2 },
  meta: { fontSize: 10, color: Colors.ink3 || "#888", marginTop: 2 },
  actions: { gap: 4 },
  btn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5 },
  btnText: { fontSize: 10, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 24 },
  emptyText: { fontSize: 13, color: Colors.ink3 || "#888" },
});

export default RecallControl;
