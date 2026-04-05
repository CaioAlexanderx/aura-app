import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// D-20: ListaEsperaDental — Waitlist for cancelled slots

const URGENCY: Record<string, { bg: string; color: string; label: string }> = {
  normal: { bg: "rgba(156,163,175,0.12)", color: "#9CA3AF", label: "Normal" },
  urgente: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B", label: "Urgente" },
  prioritario: { bg: "rgba(239,68,68,0.12)", color: "#EF4444", label: "Prioritario" },
};

const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"];

export interface WaitlistEntry { id: string; patient_name: string; patient_phone?: string; procedure_name?: string; preferred_days: number[]; preferred_time?: string; urgency: string; status: string; created_at: string; }

interface Props { entries: WaitlistEntry[]; onAdd?: () => void; onNotify?: (id: string) => void; onSchedule?: (id: string) => void; onRemove?: (id: string) => void; }

export function ListaEsperaDental({ entries, onAdd, onNotify, onSchedule, onRemove }: Props) {
  return (
    <View style={s.container}>
      <View style={s.header}><Text style={s.title}>Lista de espera ({entries.length})</Text>{onAdd && <Pressable onPress={onAdd} style={s.addBtn}><Text style={s.addBtnT}>+ Adicionar</Text></Pressable>}</View>
      {entries.map((e, i) => {
        const urg = URGENCY[e.urgency] || URGENCY.normal;
        return (
          <View key={e.id} style={[s.row, i === 0 && e.urgency === "prioritario" && { borderLeftWidth: 3, borderLeftColor: "#EF4444" }]}>
            <View style={s.posCol}><Text style={s.pos}>{i + 1}</Text></View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={s.nameRow}><Text style={s.name}>{e.patient_name}</Text><View style={[s.urgBadge, { backgroundColor: urg.bg }]}><Text style={[s.urgText, { color: urg.color }]}>{urg.label}</Text></View></View>
              {e.procedure_name && <Text style={s.proc}>{e.procedure_name}</Text>}
              <View style={s.prefsRow}>
                {(e.preferred_days || []).map(d => <Text key={d} style={s.dayChip}>{DAYS[d]}</Text>)}
                {e.preferred_time && <Text style={s.timeChip}>{e.preferred_time}</Text>}
              </View>
              <Text style={s.since}>Na fila desde {new Date(e.created_at).toLocaleDateString("pt-BR")}</Text>
            </View>
            <View style={s.actions}>
              {e.status === "aguardando" && onNotify && <Pressable onPress={() => onNotify(e.id)} style={s.actBtn}><Text style={s.actBtnT}>Notificar</Text></Pressable>}
              {onSchedule && <Pressable onPress={() => onSchedule(e.id)} style={[s.actBtn, { borderColor: "#10B981" }]}><Text style={[s.actBtnT, { color: "#10B981" }]}>Agendar</Text></Pressable>}
              {onRemove && <Pressable onPress={() => onRemove(e.id)} style={[s.actBtn, { borderColor: "#EF4444" }]}><Text style={[s.actBtnT, { color: "#EF4444" }]}>\u00D7</Text></Pressable>}
            </View>
          </View>
        );
      })}
      {entries.length === 0 && <View style={s.empty}><Text style={s.emptyT}>Nenhum paciente na lista de espera. Quando um horario for cancelado, pacientes daqui serao notificados automaticamente.</Text></View>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  addBtn: { backgroundColor: "#06B6D4", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 0.5, borderColor: Colors.border },
  posCol: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(6,182,212,0.12)", alignItems: "center", justifyContent: "center" }, pos: { fontSize: 12, fontWeight: "700", color: "#06B6D4" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 }, name: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  urgBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }, urgText: { fontSize: 9, fontWeight: "600" },
  proc: { fontSize: 11, color: Colors.ink2 },
  prefsRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" }, dayChip: { fontSize: 9, color: "#06B6D4", backgroundColor: "rgba(6,182,212,0.08)", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, fontWeight: "600" }, timeChip: { fontSize: 9, color: Colors.ink3, backgroundColor: Colors.bg4, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  since: { fontSize: 9, color: Colors.ink3 },
  actions: { gap: 4 }, actBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 0.5, borderColor: "#06B6D4" }, actBtnT: { fontSize: 9, fontWeight: "600", color: "#06B6D4" },
  empty: { alignItems: "center", paddingVertical: 24 }, emptyT: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 300 },
});

export default ListaEsperaDental;
