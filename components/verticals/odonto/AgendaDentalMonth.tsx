// ============================================================
// AURA. — Visao MENSAL da agenda odonto
// Calendario 6x7. Cada celula mostra dia + contagem de agend. + preview.
// Click no dia -> onDayPress(Date). Click em agend -> onAppointmentPress.
// ============================================================
import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import type { DentalAppointment } from "@/components/verticals/odonto/AgendaDental";

interface Props {
  appointments: DentalAppointment[];
  anchorDate: Date;
  onDayPress?: (d: Date) => void;
  onAppointmentPress?: (a: DentalAppointment) => void;
}

const DOW_LABELS = ["SEG","TER","QUA","QUI","SEX","SAB","DOM"];

const STATUS_COLOR: Record<string, string> = {
  agendado: "#06B6D4", confirmado: "#10B981", em_atendimento: "#F59E0B",
  concluido: "#10B981", faltou: "#EF4444", cancelado: "#9CA3AF",
};

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildCalendarGrid(anchor: Date): Date[] {
  // Gera 42 celulas (6 semanas) com segunda-feira inicial.
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const dow = firstOfMonth.getDay(); // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() + diff);
  gridStart.setHours(0,0,0,0);

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); d.setHours(0,0,0,0);
    cells.push(d);
  }
  return cells;
}

export function AgendaDentalMonth({ appointments, anchorDate, onDayPress, onAppointmentPress }: Props) {
  const today = new Date(); today.setHours(0,0,0,0);
  const cells = useMemo(() => buildCalendarGrid(anchorDate), [anchorDate]);
  const anchorMonth = anchorDate.getMonth();

  // Agrupa por dia
  const byDay = useMemo(() => {
    const m: Record<string, DentalAppointment[]> = {};
    for (const a of appointments) {
      if (a.status === "cancelado") continue;
      const dt = new Date(a.scheduled_at);
      const k = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      if (!m[k]) m[k] = [];
      m[k].push(a);
    }
    // Ordena cada dia por hora
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    }
    return m;
  }, [appointments]);

  function cellKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

  return (
    <View style={s.container}>
      {/* DOW header */}
      <View style={s.dowRow}>
        {DOW_LABELS.map(l => <Text key={l} style={s.dowLabel}>{l}</Text>)}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === anchorMonth;
            const isToday = sameDay(d, today);
            const list = byDay[cellKey(d)] || [];
            return (
              <Pressable
                key={i}
                onPress={() => onDayPress?.(d)}
                style={[
                  s.cell,
                  !inMonth && s.cellOtherMonth,
                  isToday && s.cellToday,
                ]}
              >
                <View style={s.cellHeader}>
                  <Text style={[s.dayNum, !inMonth && s.dayNumOther, isToday && s.dayNumToday]}>
                    {d.getDate()}
                  </Text>
                  {list.length > 0 && (
                    <View style={s.countBadge}>
                      <Text style={s.countText}>{list.length}</Text>
                    </View>
                  )}
                </View>
                <View style={s.cellBody}>
                  {list.slice(0, 2).map(a => {
                    const color = STATUS_COLOR[a.status] || "#06B6D4";
                    const dt = new Date(a.scheduled_at);
                    const time = `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`;
                    return (
                      <Pressable
                        key={a.id}
                        onPress={(e: any) => { e?.stopPropagation?.(); onAppointmentPress?.(a); }}
                        style={[s.preview, { borderLeftColor: color }]}
                      >
                        <Text style={s.previewText} numberOfLines={1}>
                          <Text style={s.previewTime}>{time} </Text>
                          {a.patient_name}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {list.length > 2 && (
                    <Text style={s.moreText}>+{list.length - 2} mais</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg2 || "#0f0f1e", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  dowRow: { flexDirection: "row", backgroundColor: Colors.bg3, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dowLabel: { flex: 1, textAlign: "center", fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, paddingVertical: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.2857%" as any, minHeight: 86, padding: 4, borderBottomWidth: 1, borderRightWidth: 1, borderColor: Colors.border, gap: 2 },
  cellOtherMonth: { backgroundColor: Colors.bg3, opacity: 0.5 },
  cellToday: { backgroundColor: "rgba(109,40,217,0.08)" },
  cellHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayNum: { fontSize: 12, color: Colors.ink, fontWeight: "700" },
  dayNumOther: { color: Colors.ink3 },
  dayNumToday: { color: Colors.violet3 || "#a78bfa" },
  countBadge: { backgroundColor: Colors.violet || "#6d28d9", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 16, alignItems: "center" },
  countText: { fontSize: 9, color: "#fff", fontWeight: "700" },
  cellBody: { gap: 2 },
  preview: { borderLeftWidth: 2, paddingLeft: 3, paddingVertical: 1 },
  previewText: { fontSize: 9, color: Colors.ink, fontWeight: "500" },
  previewTime: { fontSize: 9, color: Colors.ink3, fontWeight: "600" },
  moreText: { fontSize: 8, color: Colors.ink3, fontWeight: "600" },
});

export default AgendaDentalMonth;
