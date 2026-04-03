import { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// B-01: AgendaMultiPro — Multi-professional barber/salon agenda
// Grid columns = professionals, rows = time slots
// ============================================================

export interface BarberAppointment {
  id: string;
  customer_name: string;
  customer_phone?: string;
  scheduled_at: string;
  duration_min: number;
  services: { name: string }[];
  status: "agendado" | "confirmado" | "em_atendimento" | "concluido" | "faltou" | "cancelado";
  professional_id: string;
  professional_name: string;
  professional_color: string;
  deposit_amount?: number;
}

export interface Professional {
  id: string;
  name: string;
  color: string;
  commission_pct: number;
  is_active: boolean;
}

interface Props {
  appointments: BarberAppointment[];
  professionals: Professional[];
  date?: string;
  queueCount?: number;
  expectedRevenue?: number;
  onAppointmentPress?: (appt: BarberAppointment) => void;
  onSlotPress?: (professionalId: string, time: string) => void;
  onNewAppointment?: () => void;
  onOpenQueue?: () => void;
}

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  agendado:       { bg: "rgba(6,182,212,0.12)",   color: "#06B6D4", label: "Agendado" },
  confirmado:     { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "OK" },
  em_atendimento: { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B", label: "Atendendo" },
  concluido:      { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Concluido" },
  faltou:         { bg: "rgba(239,68,68,0.12)",   color: "#EF4444", label: "Faltou" },
  cancelado:      { bg: "rgba(156,163,175,0.08)",  color: "#9CA3AF", label: "Cancelado" },
};

const HOURS = Array.from({ length: 14 }, (_, i) => {
  const h = i + 7;
  return [`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`];
}).flat();

export function AgendaMultiPro({
  appointments, professionals, date, queueCount = 0,
  expectedRevenue = 0, onAppointmentPress, onSlotPress,
  onNewAppointment, onOpenQueue,
}: Props) {
  const activePros = professionals.filter(p => p.is_active);
  const displayDate = date || new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  // Group by professional
  const byPro = useMemo(() => {
    const map: Record<string, BarberAppointment[]> = {};
    for (const p of activePros) map[p.id] = [];
    for (const a of appointments) {
      if (a.status !== "cancelado" && map[a.professional_id]) {
        map[a.professional_id].push(a);
      }
    }
    return map;
  }, [appointments, activePros]);

  const total = appointments.filter(a => a.status !== "cancelado").length;
  const confirmed = appointments.filter(a => ["confirmado", "concluido"].includes(a.status)).length;

  return (
    <View style={s.container}>
      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{total}</Text><Text style={s.kpiLbl}>Agendamentos</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{confirmed}</Text><Text style={s.kpiLbl}>Confirmados</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>R$ {expectedRevenue.toLocaleString("pt-BR")}</Text><Text style={s.kpiLbl}>Receita prevista</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#7C3AED" }]}>{queueCount}</Text><Text style={s.kpiLbl}>Na fila</Text></View>
      </View>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.dateTitle}>{displayDate}</Text>
        <View style={s.headerBtns}>
          {onNewAppointment && (
            <Pressable onPress={onNewAppointment} style={s.btnFill}>
              <Text style={s.btnFillText}>+ Agendar</Text>
            </Pressable>
          )}
          {onOpenQueue && (
            <Pressable onPress={onOpenQueue} style={s.btnOut}>
              <Text style={s.btnOutText}>Fila +</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Multi-column grid */}
      <ScrollView horizontal={activePros.length > 2} showsHorizontalScrollIndicator={false}>
        <View style={s.grid}>
          {activePros.map(pro => {
            const proAppts = byPro[pro.id] || [];
            return (
              <View key={pro.id} style={[s.column, { minWidth: activePros.length > 2 ? 190 : undefined, flex: activePros.length <= 2 ? 1 : undefined }]}>
                {/* Pro header */}
                <View style={s.proHeader}>
                  <View style={[s.proAvatar, { backgroundColor: pro.color }]}>
                    <Text style={s.proInitial}>{pro.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.proName}>{pro.name}</Text>
                    <Text style={s.proCount}>{proAppts.length} agendados</Text>
                  </View>
                </View>

                {/* Slots */}
                {HOURS.filter((_, i) => i % 2 === 0).map(hour => {
                  const appt = proAppts.find(a => {
                    const t = new Date(a.scheduled_at);
                    return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0").replace(/[^03]0/, "00")}` === hour
                      || `${String(t.getHours()).padStart(2, "0")}:00` === hour;
                  });

                  if (appt) {
                    const st = STATUS[appt.status] || STATUS.agendado;
                    const svcNames = appt.services?.map(sv => sv.name).join(", ") || "";
                    return (
                      <Pressable key={hour} onPress={() => onAppointmentPress?.(appt)} style={[s.slot, { borderLeftColor: pro.color }]}>
                        <Text style={s.slotTime}>{hour}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.slotName}>{appt.customer_name}</Text>
                          {svcNames ? <Text style={s.slotSvc} numberOfLines={1}>{svcNames}</Text> : null}
                        </View>
                        <View style={[s.badge, { backgroundColor: st.bg }]}>
                          <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
                        </View>
                      </Pressable>
                    );
                  }

                  return (
                    <Pressable key={hour} onPress={() => onSlotPress?.(pro.id, hour)} style={[s.slot, s.slotEmpty, { borderLeftColor: pro.color }]}>
                      <Text style={s.slotTime}>{hour}</Text>
                      <Text style={s.slotEmptyText}>Horario livre</Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
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
  dateTitle: { fontSize: 15, fontWeight: "600", color: Colors.ink || "#fff" },
  headerBtns: { flexDirection: "row", gap: 6 },
  btnFill: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnFillText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  btnOut: { borderWidth: 0.5, borderColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  btnOutText: { color: "#F59E0B", fontSize: 12, fontWeight: "500" },
  grid: { flexDirection: "row", gap: 10 },
  column: { gap: 3 },
  proHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  proAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  proInitial: { color: "#fff", fontSize: 12, fontWeight: "700" },
  proName: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff" },
  proCount: { fontSize: 10, color: Colors.ink3 || "#888" },
  slot: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 8, borderRadius: 8, borderLeftWidth: 3,
    backgroundColor: Colors.bg2 || "#1a1a2e", marginBottom: 2,
  },
  slotEmpty: { opacity: 0.4 },
  slotTime: { fontSize: 11, color: Colors.ink3 || "#888", fontWeight: "600", width: 38 },
  slotName: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff" },
  slotSvc: { fontSize: 11, color: Colors.ink2 || "#aaa" },
  slotEmptyText: { fontSize: 11, color: Colors.ink3 || "#888", fontStyle: "italic" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: "600" },
});

export default AgendaMultiPro;
