import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// D-21: CheckinPaciente — Patient check-in (manual, QR, WhatsApp)

const ST: Record<string, { bg: string; color: string; label: string }> = {
  arrived: { bg: "rgba(6,182,212,0.12)", color: "#06B6D4", label: "Chegou" },
  called: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B", label: "Chamado" },
  in_service: { bg: "rgba(16,185,129,0.12)", color: "#10B981", label: "Em atend." },
  done: { bg: "rgba(156,163,175,0.12)", color: "#9CA3AF", label: "Concluido" },
};

const METHOD: Record<string, string> = { manual: "Manual", qrcode: "QR Code", whatsapp: "WhatsApp", app: "App" };

export interface Checkin { id: string; patient_name?: string; patient_full_name?: string; method: string; checked_in_at: string; called_at?: string; started_at?: string; status: string; }
export interface CheckinStats { total: number; waiting: number; called: number; in_service: number; done: number; }

interface Props { checkins: Checkin[]; stats: CheckinStats; qrCodeUrl?: string; onCheckin?: () => void; onCall?: (id: string) => void; onStart?: (id: string) => void; onDone?: (id: string) => void; }

function timeAgo(dateStr: string): string { const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000); if (mins < 1) return "agora"; if (mins < 60) return `${mins}min`; return `${Math.floor(mins / 60)}h${mins % 60}min`; }

export function CheckinPaciente({ checkins, stats, qrCodeUrl, onCheckin, onCall, onStart, onDone }: Props) {
  const waiting = checkins.filter(c => c.status === "arrived");
  const inProgress = checkins.filter(c => c.status === "called" || c.status === "in_service");
  const done = checkins.filter(c => c.status === "done");

  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>{stats.waiting}</Text><Text style={s.kpiLbl}>Aguardando</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{stats.called}</Text><Text style={s.kpiLbl}>Chamados</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{stats.in_service}</Text><Text style={s.kpiLbl}>Em atend.</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#9CA3AF" }]}>{stats.done}</Text><Text style={s.kpiLbl}>Concluidos</Text></View>
      </View>
      <View style={s.header}>
        <Text style={s.title}>Check-in de pacientes</Text>
        {onCheckin && <Pressable onPress={onCheckin} style={s.addBtn}><Text style={s.addBtnT}>+ Check-in manual</Text></Pressable>}
      </View>
      {qrCodeUrl && <View style={s.qrBox}><Text style={s.qrLabel}>QR Code para check-in na recepcao:</Text><Text style={s.qrUrl}>{qrCodeUrl}</Text></View>}
      {/* Waiting */}
      {waiting.length > 0 && <Text style={s.sectionTitle}>Aguardando ({waiting.length})</Text>}
      {waiting.map(c => { const st = ST[c.status]; return (
        <View key={c.id} style={s.row}>
          <View style={[s.dot, { backgroundColor: st.color }]} />
          <View style={{ flex: 1 }}><Text style={s.name}>{c.patient_name || c.patient_full_name || "Paciente"}</Text><Text style={s.meta}>{METHOD[c.method]} | ha {timeAgo(c.checked_in_at)}</Text></View>
          {onCall && <Pressable onPress={() => onCall(c.id)} style={[s.actBtn, { borderColor: "#F59E0B" }]}><Text style={[s.actBtnT, { color: "#F59E0B" }]}>Chamar</Text></Pressable>}
        </View>
      ); })}
      {/* In progress */}
      {inProgress.length > 0 && <Text style={s.sectionTitle}>Em andamento ({inProgress.length})</Text>}
      {inProgress.map(c => { const st = ST[c.status]; return (
        <View key={c.id} style={s.row}>
          <View style={[s.dot, { backgroundColor: st.color }]} />
          <View style={{ flex: 1 }}><Text style={s.name}>{c.patient_name || c.patient_full_name || "Paciente"}</Text><Text style={s.meta}>{st.label} | {c.called_at ? "Chamado ha " + timeAgo(c.called_at) : ""}</Text></View>
          {c.status === "called" && onStart && <Pressable onPress={() => onStart(c.id)} style={[s.actBtn, { borderColor: "#10B981" }]}><Text style={[s.actBtnT, { color: "#10B981" }]}>Iniciar</Text></Pressable>}
          {c.status === "in_service" && onDone && <Pressable onPress={() => onDone(c.id)} style={[s.actBtn, { borderColor: "#9CA3AF" }]}><Text style={[s.actBtnT, { color: "#9CA3AF" }]}>Concluir</Text></Pressable>}
        </View>
      ); })}
      {checkins.length === 0 && <Text style={s.emptyT}>Nenhum check-in hoje.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.border, gap: 2 },
  kpiVal: { fontSize: 22, fontWeight: "800" }, kpiLbl: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  addBtn: { backgroundColor: "#06B6D4", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  qrBox: { padding: 12, borderRadius: 10, backgroundColor: "rgba(6,182,212,0.06)", borderWidth: 0.5, borderColor: "rgba(6,182,212,0.2)", gap: 4 },
  qrLabel: { fontSize: 10, color: Colors.ink3 }, qrUrl: { fontSize: 12, color: "#06B6D4", fontFamily: "monospace", fontWeight: "500" },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 0.5, borderColor: Colors.border },
  dot: { width: 10, height: 10, borderRadius: 5 }, name: { fontSize: 14, fontWeight: "600", color: Colors.ink }, meta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  actBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5 }, actBtnT: { fontSize: 10, fontWeight: "600" },
  emptyT: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 20 },
});

export default CheckinPaciente;
