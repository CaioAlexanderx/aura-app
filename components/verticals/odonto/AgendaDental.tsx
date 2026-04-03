import { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-05: AgendaDental — Multi-chair/professional dental agenda
// Shows columns per chair/professional with time slots
// ============================================================

export interface DentalAppointment {
  id: string;
  patient_name: string;
  patient_phone?: string;
  scheduled_at: string;
  duration_min: number;
  chief_complaint?: string;
  status: "agendado" | "confirmado" | "em_atendimento" | "concluido" | "faltou" | "cancelado";
  chair?: string;
  professional_name?: string;
  professional_color?: string;
}

interface Props {
  appointments: DentalAppointment[];
  chairs?: string[];
  date?: string;
  onAppointmentPress?: (appt: DentalAppointment) => void;
  onSlotPress?: (chair: string, time: string) => void;
  onNewAppointment?: () => void;
}

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  agendado:        { bg: "rgba(6,182,212,0.12)",   color: "#06B6D4", label: "Agendado" },
  confirmado:      { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Confirmado" },
  em_atendimento:  { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B", label: "Em atendimento" },
  concluido:       { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Concluido" },
  faltou:          { bg: "rgba(239,68,68,0.12)",   color: "#EF4444", label: "Faltou" },
  cancelado:       { bg: "rgba(156,163,175,0.08)",  color: "#9CA3AF", label: "Cancelado" },
};

const HOURS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

export function AgendaDental({
  appointments, chairs = ["Cadeira 1", "Cadeira 2"],
  date, onAppointmentPress, onSlotPress, onNewAppointment,
}: Props) {
  const displayDate = date || new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  // Group appointments by chair
  const byChair = useMemo(() => {
    const map: Record<string, DentalAppointment[]> = {};
    for (const ch of chairs) map[ch] = [];
    for (const appt of appointments) {
      const chair = appt.chair || chairs[0];
      if (!map[chair]) map[chair] = [];
      map[chair].push(appt);
    }
    return map;
  }, [appointments, chairs]);

  // KPIs
  const total = appointments.filter(a => a.status !== "cancelado").length;
  const confirmed = appointments.filter(a => a.status === "confirmado" || a.status === "concluido").length;
  const pending = appointments.filter(a => a.status === "agendado").length;
  const noShow = appointments.filter(a => a.status === "faltou").length;

  return (
    <View style={s.container}>
      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>{total}</Text><Text style={s.kpiLbl}>Hoje</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{confirmed}</Text><Text style={s.kpiLbl}>Confirmados</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{pending}</Text><Text style={s.kpiLbl}>Pendentes</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{noShow}</Text><Text style={s.kpiLbl}>Faltas</Text></View>
      </View>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.dateTitle}>{displayDate}</Text>
        {onNewAppointment && (
          <Pressable onPress={onNewAppointment} style={s.addBtn}>
            <Text style={s.addBtnText}>+ Agendar</Text>
          </Pressable>
        )}
      </View>

      {/* Multi-column grid */}
      <ScrollView horizontal={chairs.length > 2} showsHorizontalScrollIndicator={false}>
        <View style={s.grid}>
          {chairs.map(chair => (
            <View key={chair} style={[s.column, { minWidth: chairs.length > 2 ? 200 : undefined, flex: chairs.length <= 2 ? 1 : undefined }]}>
              {/* Chair header */}
              <View style={s.chairHeader}>
                <View style={[s.chairDot, { backgroundColor: "#06B6D4" }]} />
                <Text style={s.chairName}>{chair}</Text>
                <Text style={s.chairCount}>{(byChair[chair] || []).length} agend.</Text>
              </View>

              {/* Slots */}
              {HOURS.map(hour => {
                const appt = (byChair[chair] || []).find(a => {
                  const t = new Date(a.scheduled_at);
                  return `${String(t.getHours()).padStart(2, "0")}:00` === hour;
                });

                if (appt) {
                  const st = STATUS_MAP[appt.status] || STATUS_MAP.agendado;
                  return (
                    <Pressable
                      key={hour}
                      onPress={() => onAppointmentPress?.(appt)}
                      style={[s.slot, { borderLeftColor: st.color }]}
                    >
                      <Text style={s.slotTime}>{hour}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.slotName}>{appt.patient_name}</Text>
                        <Text style={s.slotProc}>{appt.chief_complaint || "Consulta"}</Text>
                      </View>
                      <View style={[s.slotBadge, { backgroundColor: st.bg }]}>
                        <Text style={[s.slotBadgeText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </Pressable>
                  );
                }

                return (
                  <Pressable
                    key={hour}
                    onPress={() => onSlotPress?.(chair, hour)}
                    style={[s.slot, s.slotEmpty]}
                  >
                    <Text style={s.slotTime}>{hour}</Text>
                    <Text style={s.slotEmptyText}>Horario livre</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e", borderRadius: 10, padding: 10, alignItems: "center" },
  kpiVal: { fontSize: 20, fontWeight: "700" },
  kpiLbl: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateTitle: { fontSize: 15, fontWeight: "600", color: Colors.ink || "#fff" },
  addBtn: { backgroundColor: "#06B6D4", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  grid: { flexDirection: "row", gap: 10 },
  column: { gap: 4 },
  chairHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  chairDot: { width: 8, height: 8, borderRadius: 4 },
  chairName: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff", flex: 1 },
  chairCount: { fontSize: 10, color: Colors.ink3 || "#888" },
  slot: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 8, borderRadius: 8, borderLeftWidth: 3,
    borderLeftColor: "#06B6D4", backgroundColor: Colors.bg2 || "#1a1a2e",
    marginBottom: 3,
  },
  slotEmpty: { borderLeftColor: Colors.border || "#333", opacity: 0.5 },
  slotTime: { fontSize: 11, color: Colors.ink3 || "#888", fontWeight: "600", width: 38 },
  slotName: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff" },
  slotProc: { fontSize: 11, color: Colors.ink2 || "#aaa" },
  slotEmptyText: { fontSize: 11, color: Colors.ink3 || "#888", fontStyle: "italic" },
  slotBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  slotBadgeText: { fontSize: 9, fontWeight: "600" },
});

export default AgendaDental;
