import { createElement, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// AgendaDental — View Semanal (padrão) + View Dia
// Itens 8 (semana) + 9 (drag-to-move / resize, web only)
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

type ViewMode = "semana" | "dia";

interface Props {
  appointments: DentalAppointment[];
  chairs?: string[];
  date?: Date;
  onAppointmentPress?: (appt: DentalAppointment) => void;
  onSlotPress?: (chairOrDay: string, time: string) => void;
  onNewAppointment?: () => void;
  onMoveAppointment?: (appointmentId: string, newScheduledAt: string) => void;
  onResizeAppointment?: (appointmentId: string, newDurationMin: number) => void;
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
const DAY_NAMES = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekDays(anchor: Date): Date[] {
  const d = new Date(anchor);
  const day = d.getDay(); // 0=dom
  const diff = day === 0 ? -6 : 1 - day; // segunda
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x;
  });
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Week view ───────────────────────────────────────────────

function WeekView({
  appointments,
  anchor,
  onAppointmentPress,
  onSlotPress,
  onMoveAppointment,
  onResizeAppointment,
}: {
  appointments: DentalAppointment[];
  anchor: Date;
  onAppointmentPress?: (appt: DentalAppointment) => void;
  onSlotPress?: (chairOrDay: string, time: string) => void;
  onMoveAppointment?: (appointmentId: string, newScheduledAt: string) => void;
  onResizeAppointment?: (appointmentId: string, newDurationMin: number) => void;
}) {
  const today = new Date();
  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);

  // Map: isoDate -> DentalAppointment[]
  const byDay = useMemo(() => {
    const map: Record<string, DentalAppointment[]> = {};
    for (const d of weekDays) map[toIsoDate(d)] = [];
    for (const appt of appointments) {
      const iso = toIsoDate(new Date(appt.scheduled_at));
      if (map[iso]) map[iso].push(appt);
    }
    return map;
  }, [appointments, weekDays]);

  const isWeb = Platform.OS === "web";

  function renderAppointmentBlock(appt: DentalAppointment, dayDate: Date, hour: string) {
    const st = STATUS_MAP[appt.status] || STATUS_MAP.agendado;
    const shortName =
      appt.patient_name.length > 14
        ? appt.patient_name.slice(0, 13) + "…"
        : appt.patient_name;

    if (isWeb) {
      return createElement(
        "div",
        {
          key: `appt-${appt.id}`,
          draggable: true,
          onDragStart: (e: any) => {
            e.dataTransfer.setData("apptId", appt.id);
            e.dataTransfer.setData("origHour", hour);
            e.dataTransfer.effectAllowed = "move";
          },
          onClick: () => onAppointmentPress?.(appt),
          style: {
            position: "absolute",
            top: 1,
            left: 1,
            right: 1,
            bottom: 1,
            backgroundColor: st.bg,
            borderLeft: `3px solid ${st.color}`,
            borderRadius: 4,
            padding: "2px 4px",
            cursor: "grab",
            overflow: "hidden",
            fontSize: 10,
            color: st.color,
            fontWeight: 600,
            userSelect: "none",
            zIndex: 2,
          },
        },
        shortName,
        // Resize handle
        createElement("div", {
          style: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            cursor: "s-resize",
            background: "rgba(255,255,255,0.15)",
          },
          onMouseDown: (e: any) => {
            e.stopPropagation();
            const startY = e.clientY;
            const startDur = appt.duration_min || 60;
            const onMove = (ev: MouseEvent) => {
              const dy = ev.clientY - startY;
              const deltaMins = Math.round(dy / 36) * 30;
              const newDur = Math.max(30, startDur + deltaMins);
              onResizeAppointment?.(appt.id, newDur);
            };
            const onUp = () => {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          },
        })
      );
    }

    // Native fallback
    return (
      <Pressable
        key={`appt-${appt.id}`}
        onPress={() => onAppointmentPress?.(appt)}
        style={[
          s.weekApptBlock,
          { backgroundColor: st.bg, borderLeftColor: st.color },
        ]}
      >
        <Text style={[s.weekApptText, { color: st.color }]} numberOfLines={1}>
          {shortName}
        </Text>
      </Pressable>
    );
  }

  function renderSlotCell(dayDate: Date, hour: string) {
    const iso = toIsoDate(dayDate);
    const dayAppts = byDay[iso] || [];
    const appt = dayAppts.find((a) => {
      const t = new Date(a.scheduled_at);
      return `${String(t.getHours()).padStart(2, "0")}:00` === hour;
    });

    if (isWeb) {
      return createElement(
        "div",
        {
          key: `${iso}-${hour}`,
          onDragOver: (e: any) => e.preventDefault(),
          onDrop: (e: any) => {
            const apptId = e.dataTransfer.getData("apptId");
            if (!apptId) return;
            const [h] = hour.split(":");
            const newDate = new Date(dayDate);
            newDate.setHours(parseInt(h, 10), 0, 0, 0);
            onMoveAppointment?.(apptId, newDate.toISOString());
          },
          onClick: appt
            ? undefined
            : () => onSlotPress?.(iso, hour),
          style: {
            height: 36,
            borderBottom: `1px solid ${Colors.border || "rgba(255,255,255,0.07)"}`,
            position: "relative",
            boxSizing: "border-box",
          },
        },
        appt ? renderAppointmentBlock(appt, dayDate, hour) : null
      );
    }

    // Native
    return (
      <Pressable
        key={`${iso}-${hour}`}
        onPress={() => {
          if (appt) onAppointmentPress?.(appt);
          else onSlotPress?.(iso, hour);
        }}
        style={s.weekSlotCell}
      >
        {appt ? renderAppointmentBlock(appt, dayDate, hour) : null}
      </Pressable>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View>
          {/* Week header */}
          <View style={s.weekHeader}>
            <View style={s.weekHourCol} />
            {weekDays.map((d, idx) => {
              const isToday = sameDay(d, today);
              return (
                <View key={idx} style={s.weekDayHdr}>
                  <Text style={s.weekDayName}>{DAY_NAMES[idx]}</Text>
                  <Text style={[s.weekDayNum, isToday && s.weekDayNumToday]}>
                    {d.getDate()}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Grid */}
          <View style={s.weekGrid}>
            {/* Hour column */}
            <View style={s.weekHourCol}>
              {HOURS.map((hour) => (
                <View key={hour} style={s.weekHourCell}>
                  <Text style={s.weekHourText}>{hour}</Text>
                </View>
              ))}
            </View>

            {/* Day columns */}
            {weekDays.map((dayDate, idx) => (
              <View key={idx} style={s.weekDayCol}>
                {HOURS.map((hour) => renderSlotCell(dayDate, hour))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScrollView>
  );
}

// ─── Day view (preserved from D-05) ─────────────────────────

function DayView({
  appointments,
  chairs,
  anchor,
  onAppointmentPress,
  onSlotPress,
  onMoveAppointment,
  onResizeAppointment,
}: {
  appointments: DentalAppointment[];
  chairs: string[];
  anchor: Date;
  onAppointmentPress?: (appt: DentalAppointment) => void;
  onSlotPress?: (chair: string, time: string) => void;
  onMoveAppointment?: (appointmentId: string, newScheduledAt: string) => void;
  onResizeAppointment?: (appointmentId: string, newDurationMin: number) => void;
}) {
  const dayAppointments = useMemo(
    () => appointments.filter((a) => sameDay(new Date(a.scheduled_at), anchor)),
    [appointments, anchor]
  );

  const byChair = useMemo(() => {
    const map: Record<string, DentalAppointment[]> = {};
    for (const ch of chairs) map[ch] = [];
    for (const appt of dayAppointments) {
      const chair = appt.chair || chairs[0];
      if (!map[chair]) map[chair] = [];
      map[chair].push(appt);
    }
    return map;
  }, [dayAppointments, chairs]);

  const isWeb = Platform.OS === "web";

  return (
    <ScrollView horizontal={chairs.length > 2} showsHorizontalScrollIndicator={false}>
      <View style={s.grid}>
        {chairs.map((chair) => (
          <View
            key={chair}
            style={[
              s.column,
              {
                minWidth: chairs.length > 2 ? 200 : undefined,
                flex: chairs.length <= 2 ? 1 : undefined,
              },
            ]}
          >
            <View style={s.chairHeader}>
              <View style={[s.chairDot, { backgroundColor: "#06B6D4" }]} />
              <Text style={s.chairName}>{chair}</Text>
              <Text style={s.chairCount}>{(byChair[chair] || []).length} agend.</Text>
            </View>

            {HOURS.map((hour) => {
              const appt = (byChair[chair] || []).find((a) => {
                const t = new Date(a.scheduled_at);
                return `${String(t.getHours()).padStart(2, "0")}:00` === hour;
              });

              if (appt) {
                const st = STATUS_MAP[appt.status] || STATUS_MAP.agendado;

                if (isWeb) {
                  return createElement(
                    "div",
                    {
                      key: hour,
                      draggable: true,
                      onDragStart: (e: any) => {
                        e.dataTransfer.setData("apptId", appt.id);
                        e.dataTransfer.setData("origChair", chair);
                        e.dataTransfer.setData("origHour", hour);
                        e.dataTransfer.effectAllowed = "move";
                      },
                      onClick: () => onAppointmentPress?.(appt),
                      style: {
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        padding: 8,
                        borderRadius: 8,
                        borderLeft: `3px solid ${st.color}`,
                        backgroundColor: Colors.bg2 || "#090c1a",
                        marginBottom: 3,
                        cursor: "grab",
                        position: "relative",
                        userSelect: "none",
                      },
                    },
                    createElement(
                      "span",
                      { style: { fontSize: 11, color: Colors.ink3 || "#888", fontWeight: 600, width: 38 } },
                      hour
                    ),
                    createElement(
                      "div",
                      { style: { flex: 1 } },
                      createElement(
                        "div",
                        { style: { fontSize: 13, fontWeight: 600, color: Colors.ink || "#fff" } },
                        appt.patient_name
                      ),
                      createElement(
                        "div",
                        { style: { fontSize: 11, color: Colors.ink2 || "#aaa" } },
                        appt.chief_complaint || "Consulta"
                      )
                    ),
                    createElement(
                      "span",
                      {
                        style: {
                          padding: "2px 6px",
                          borderRadius: 4,
                          backgroundColor: st.bg,
                          fontSize: 9,
                          fontWeight: 600,
                          color: st.color,
                        },
                      },
                      st.label
                    ),
                    // Resize handle
                    createElement("div", {
                      style: {
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 6,
                        cursor: "s-resize",
                        background: "rgba(255,255,255,0.10)",
                      },
                      onMouseDown: (e: any) => {
                        e.stopPropagation();
                        const startY = e.clientY;
                        const startDur = appt.duration_min || 60;
                        const onMove = (ev: MouseEvent) => {
                          const dy = ev.clientY - startY;
                          const deltaMins = Math.round(dy / 36) * 30;
                          const newDur = Math.max(30, startDur + deltaMins);
                          onResizeAppointment?.(appt.id, newDur);
                        };
                        const onUp = () => {
                          window.removeEventListener("mousemove", onMove);
                          window.removeEventListener("mouseup", onUp);
                        };
                        window.addEventListener("mousemove", onMove);
                        window.addEventListener("mouseup", onUp);
                      },
                    })
                  );
                }

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

              // Empty slot
              if (isWeb) {
                return createElement("div", {
                  key: hour,
                  onDragOver: (e: any) => e.preventDefault(),
                  onDrop: (e: any) => {
                    const apptId = e.dataTransfer.getData("apptId");
                    if (!apptId) return;
                    const [h] = hour.split(":");
                    const newDate = new Date(anchor);
                    newDate.setHours(parseInt(h, 10), 0, 0, 0);
                    onMoveAppointment?.(apptId, newDate.toISOString());
                  },
                  onClick: () => onSlotPress?.(chair, hour),
                  style: {
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    padding: 8,
                    borderRadius: 8,
                    borderLeft: `3px solid ${Colors.border || "rgba(255,255,255,0.07)"}`,
                    backgroundColor: Colors.bg2 || "#090c1a",
                    marginBottom: 3,
                    opacity: 0.5,
                    cursor: "pointer",
                  },
                },
                  createElement("span", { style: { fontSize: 11, color: Colors.ink3 || "#888", fontWeight: 600, width: 38 } }, hour),
                  createElement("span", { style: { fontSize: 11, color: Colors.ink3 || "#888", fontStyle: "italic" } }, "Horario livre")
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
  );
}

// ─── Main component ──────────────────────────────────────────

export function AgendaDental({
  appointments,
  chairs = ["Cadeira 1", "Cadeira 2"],
  date,
  onAppointmentPress,
  onSlotPress,
  onNewAppointment,
  onMoveAppointment,
  onResizeAppointment,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("dia");
  const anchor = date || new Date();

  const displayDate = anchor.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  // KPIs — always computed for the anchor day
  const dayAppointments = useMemo(
    () => appointments.filter((a) => sameDay(new Date(a.scheduled_at), anchor)),
    [appointments, anchor]
  );
  const total = dayAppointments.filter((a) => a.status !== "cancelado").length;
  const confirmed = dayAppointments.filter(
    (a) => a.status === "confirmado" || a.status === "concluido"
  ).length;
  const pending = dayAppointments.filter((a) => a.status === "agendado").length;
  const noShow = dayAppointments.filter((a) => a.status === "faltou").length;

  return (
    <View style={s.container}>
      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpi}>
          <Text style={[s.kpiVal, { color: "#06B6D4" }]}>{total}</Text>
          <Text style={s.kpiLbl}>No dia</Text>
        </View>
        <View style={s.kpi}>
          <Text style={[s.kpiVal, { color: "#10B981" }]}>{confirmed}</Text>
          <Text style={s.kpiLbl}>Confirmados</Text>
        </View>
        <View style={s.kpi}>
          <Text style={[s.kpiVal, { color: "#F59E0B" }]}>{pending}</Text>
          <Text style={s.kpiLbl}>Pendentes</Text>
        </View>
        <View style={s.kpi}>
          <Text style={[s.kpiVal, { color: "#EF4444" }]}>{noShow}</Text>
          <Text style={s.kpiLbl}>Faltas</Text>
        </View>
      </View>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.dateTitle}>{displayDate}</Text>
        <View style={s.headerRight}>
          {/* PR21 #7: viewToggle interno removido (duplicava AgendaNavigator
              externo de OdontoClinicTabs). AgendaDental agora so renderiza
              o dia que o pai escolheu. */}
          {onNewAppointment && (
            <Pressable onPress={onNewAppointment} style={s.addBtn}>
              <Text style={s.addBtnText}>+ Agendar</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Grid */}
      {viewMode === "semana" ? (
        <WeekView
          appointments={appointments}
          anchor={anchor}
          onAppointmentPress={onAppointmentPress}
          onSlotPress={onSlotPress}
          onMoveAppointment={onMoveAppointment}
          onResizeAppointment={onResizeAppointment}
        />
      ) : (
        <DayView
          appointments={appointments}
          chairs={chairs}
          anchor={anchor}
          onAppointmentPress={onAppointmentPress}
          onSlotPress={onSlotPress}
          onMoveAppointment={onMoveAppointment}
          onResizeAppointment={onResizeAppointment}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },

  // KPIs
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: {
    flex: 1,
    backgroundColor: Colors.bg2 || "#090c1a",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  kpiVal: { fontSize: 20, fontWeight: "700" },
  kpiLbl: {
    fontSize: 9,
    color: Colors.ink3 || "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.ink || "#fff",
    textTransform: "capitalize" as any,
    flex: 1,
  },
  addBtn: {
    backgroundColor: "#06B6D4",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // View toggle
  viewToggle: {
    flexDirection: "row",
    gap: 0,
    backgroundColor: Colors.bg3 || "#0e1228",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border || "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  viewBtn: { paddingHorizontal: 14, paddingVertical: 7 },
  viewBtnActive: { backgroundColor: Colors.violet || "#6d28d9" },
  viewBtnText: { fontSize: 12, color: Colors.ink3 || "#888", fontWeight: "600" },
  viewBtnTextActive: { color: "#fff" },

  // ── Week view ──
  weekHeader: { flexDirection: "row" },
  weekHourCol: { width: 44 },
  weekDayHdr: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: Colors.border || "rgba(255,255,255,0.07)",
  },
  weekDayName: {
    fontSize: 10,
    color: Colors.ink3 || "#888",
    textTransform: "uppercase" as any,
  },
  weekDayNum: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.ink || "#fff",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as any,
    marginTop: 2,
  },
  weekDayNumToday: {
    backgroundColor: Colors.violet || "#6d28d9",
    color: "#fff",
    overflow: "hidden" as any,
  },
  weekGrid: { flexDirection: "row" },
  weekHourCell: {
    height: 36,
    justifyContent: "flex-start",
    paddingTop: 2,
    paddingRight: 6,
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border || "rgba(255,255,255,0.07)",
  },
  weekHourText: { fontSize: 9, color: Colors.ink3 || "#888" },
  weekDayCol: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: Colors.border || "rgba(255,255,255,0.07)",
  },
  weekSlotCell: {
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border || "rgba(255,255,255,0.07)",
    position: "relative" as any,
  },
  weekApptBlock: {
    position: "absolute" as any,
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderLeftWidth: 3,
    borderRadius: 4,
    padding: 2,
    overflow: "hidden",
    justifyContent: "center",
  },
  weekApptText: { fontSize: 10, fontWeight: "600" },

  // ── Day view ──
  grid: { flexDirection: "row", gap: 10 },
  column: { gap: 4 },
  chairHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  chairDot: { width: 8, height: 8, borderRadius: 4 },
  chairName: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff", flex: 1 },
  chairCount: { fontSize: 10, color: Colors.ink3 || "#888" },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#06B6D4",
    backgroundColor: Colors.bg2 || "#090c1a",
    marginBottom: 3,
  },
  slotEmpty: { borderLeftColor: Colors.border || "rgba(255,255,255,0.07)", opacity: 0.5 },
  slotTime: { fontSize: 11, color: Colors.ink3 || "#888", fontWeight: "600", width: 38 },
  slotName: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff" },
  slotProc: { fontSize: 11, color: Colors.ink2 || "#aaa" },
  slotEmptyText: { fontSize: 11, color: Colors.ink3 || "#888", fontStyle: "italic" },
  slotBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  slotBadgeText: { fontSize: 9, fontWeight: "600" },
});

export default AgendaDental;
