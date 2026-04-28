// ============================================================
// AURA. — Visao SEMANAL da agenda odonto
// 7 colunas (seg-dom) x faixa horaria 07-19.
//
// PR21 #2 (2026-04-27): blocos com altura proporcional a duration_min.
// Antes: cada appt era um item flex dentro de uma celula de 1h, max 2 +
// "+N" overflow. Resultado: 120min visualmente igual a 60min.
// Agora: cada coluna de dia e um relative container; blocos sao absolute
// com top = (minutos_inicio/60) * HOUR_PX e height = (duration/60) * HOUR_PX.
// 120min agora ocupa 2h verticais, claramente distinguivel.
// ============================================================
import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { DentalAppointment } from "@/components/verticals/odonto/AgendaDental";
import { startOfWeek } from "@/components/verticals/odonto/AgendaNavigator";

interface Props {
  appointments: DentalAppointment[];
  anchorDate: Date;
  onAppointmentPress?: (a: DentalAppointment) => void;
  onSlotPress?: (date: Date) => void;
}

const DOW_LABELS = ["SEG","TER","QUA","QUI","SEX","SAB","DOM"];
const START_HOUR = 7;
const END_HOUR = 19;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);
const HOUR_PX = 48;

const STATUS_COLOR: Record<string, string> = {
  agendado: "#06B6D4", confirmado: "#10B981", em_atendimento: "#F59E0B",
  concluido: "#10B981", faltou: "#EF4444", cancelado: "#9CA3AF",
};

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface PositionedBlock {
  a: DentalAppointment;
  topPx: number;
  heightPx: number;
  // Para overlap handling (simples): qual coluna dentro do dia (0..N-1) e quantas colunas no total
  colIdx: number;
  colCount: number;
}

// Lane assignment basico: ordena por start, percorre em ordem, cada bloco
// pega a primeira "lane" disponivel (que ja terminou). Lanes sao numeradas
// 0..N-1. Resultado: N = max overlap simultaneo. Cada bloco vira uma fatia
// width = 100/N % com left = (100/N)*colIdx %.
function assignLanes(items: Array<{ a: DentalAppointment; startMin: number; endMin: number }>): Array<{ a: DentalAppointment; startMin: number; endMin: number; colIdx: number; colCount: number }> {
  if (items.length === 0) return [];
  const sorted = [...items].sort((x, y) => x.startMin - y.startMin);
  const lanes: number[] = []; // lanes[i] = endMin do ultimo bloco em lane i
  const result: Array<{ a: DentalAppointment; startMin: number; endMin: number; colIdx: number }> = [];

  for (const it of sorted) {
    let assigned = -1;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] <= it.startMin) { assigned = i; break; }
    }
    if (assigned === -1) { assigned = lanes.length; lanes.push(0); }
    lanes[assigned] = it.endMin;
    result.push({ ...it, colIdx: assigned });
  }

  // Compute colCount por bloco: max(colIdx+1) entre blocos sobrepostos.
  // Simplificacao: usa total lanes do dia inteiro como denominador. Funciona
  // razoavelmente bem; se quiser preciso por-grupo-de-overlap pode evoluir.
  const colCount = lanes.length;
  return result.map(r => ({ ...r, colCount }));
}

export function AgendaDentalWeek({ appointments, anchorDate, onAppointmentPress, onSlotPress }: Props) {
  const today = new Date(); today.setHours(0,0,0,0);
  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); d.setHours(0,0,0,0);
      return d;
    });
  }, [weekStart]);

  // PR21 #2: agrupa por dia e calcula top/height absolutos por bloco
  const byDay = useMemo(() => {
    const raw: Record<string, Array<{ a: DentalAppointment; startMin: number; endMin: number }>> = {};
    for (const a of appointments) {
      if (a.status === "cancelado") continue;
      const dt = new Date(a.scheduled_at);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      const startMin = (dt.getHours() - START_HOUR) * 60 + dt.getMinutes();
      const dur = a.duration_min || 60;
      const endMin = startMin + dur;
      // Skip se esta totalmente fora do range visivel
      if (endMin <= 0 || startMin >= HOURS.length * 60) continue;
      (raw[key] = raw[key] || []).push({ a, startMin, endMin });
    }
    const out: Record<string, PositionedBlock[]> = {};
    for (const k of Object.keys(raw)) {
      const lanes = assignLanes(raw[k]);
      out[k] = lanes.map(l => ({
        a: l.a,
        topPx: Math.max(0, (l.startMin / 60) * HOUR_PX),
        heightPx: Math.max(20, ((Math.min(l.endMin, HOURS.length * 60) - Math.max(0, l.startMin)) / 60) * HOUR_PX) - 2,
        colIdx: l.colIdx,
        colCount: l.colCount,
      }));
    }
    return out;
  }, [appointments]);

  const countByDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of appointments) {
      if (a.status === "cancelado") continue;
      const dt = new Date(a.scheduled_at);
      const k = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, [appointments]);

  function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

  const bodyHeight = HOURS.length * HOUR_PX;

  return (
    <View style={s.container}>
      {/* Header: dias da semana */}
      <View style={s.headerRow}>
        <View style={s.hourColHeader} />
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          const count = countByDay[dayKey(d)] || 0;
          return (
            <View key={i} style={[s.dayHeader, isToday && s.dayHeaderToday]}>
              <Text style={[s.dowLabel, isToday && s.todayText]}>{DOW_LABELS[i]}</Text>
              <Text style={[s.dayNum, isToday && s.todayText]}>{d.getDate()}</Text>
              {count > 0 && <Text style={[s.dayCount, isToday && s.todayText]}>{count}</Text>}
            </View>
          );
        })}
      </View>

      {/* Body */}
      <ScrollView style={s.scrollBody} showsVerticalScrollIndicator={false}>
        <View style={[s.bodyRow, { height: bodyHeight }]}>
          {/* Hour labels column */}
          <View style={s.hourCol}>
            {HOURS.map(h => (
              <View key={h} style={[s.hourLabelCell, { height: HOUR_PX }]}>
                <Text style={s.hourLabel}>{String(h).padStart(2,"0")}:00</Text>
              </View>
            ))}
          </View>
          {/* Day columns */}
          {days.map((d, di) => {
            const isToday = sameDay(d, today);
            const blocks = byDay[dayKey(d)] || [];
            return (
              <View key={di} style={[s.dayCol, isToday && s.dayColToday]}>
                {/* Background hour grid + empty press areas */}
                {HOURS.map(h => (
                  <Pressable
                    key={h}
                    onPress={() => {
                      const dt = new Date(d); dt.setHours(h, 0, 0, 0);
                      onSlotPress?.(dt);
                    }}
                    style={[s.hourSlot, { height: HOUR_PX }]}
                  />
                ))}
                {/* Appointments absolute */}
                {blocks.map(({ a, topPx, heightPx, colIdx, colCount }) => {
                  const color = STATUS_COLOR[a.status] || "#06B6D4";
                  const dt = new Date(a.scheduled_at);
                  const time = `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`;
                  // Width split por lane
                  const widthPct = 100 / Math.max(1, colCount);
                  const leftPct = widthPct * colIdx;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => onAppointmentPress?.(a)}
                      style={[s.block, {
                        position: "absolute",
                        top: topPx,
                        left: `${leftPct + 0.4}%` as any,
                        width: `${widthPct - 0.8}%` as any,
                        height: heightPx,
                        borderLeftColor: color,
                        backgroundColor: color + "22",
                      }]}
                    >
                      <Text style={s.blockTime}>{time} · {a.duration_min || 60}min</Text>
                      <Text style={s.blockName} numberOfLines={heightPx > 36 ? 2 : 1}>{a.patient_name}</Text>
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
  container: { backgroundColor: Colors.bg2 || "#0f0f1e", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg3 },
  hourColHeader: { width: 48 },
  dayHeader: { flex: 1, paddingVertical: 8, alignItems: "center", borderLeftWidth: 1, borderLeftColor: Colors.border, gap: 1 },
  dayHeaderToday: { backgroundColor: "rgba(109,40,217,0.12)" },
  dowLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5 },
  dayNum: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  dayCount: { fontSize: 9, color: Colors.violet3, fontWeight: "600" },
  todayText: { color: Colors.violet3 || "#a78bfa" },
  scrollBody: { maxHeight: 580 },
  bodyRow: { flexDirection: "row" },
  hourCol: { width: 48 },
  hourLabelCell: { alignItems: "center", paddingTop: 2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hourLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600" },
  dayCol: { flex: 1, borderLeftWidth: 1, borderLeftColor: Colors.border, position: "relative" },
  dayColToday: { backgroundColor: "rgba(109,40,217,0.04)" },
  hourSlot: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  block: { borderRadius: 4, padding: 4, borderLeftWidth: 2, overflow: "hidden" },
  blockTime: { fontSize: 9, color: Colors.ink3, fontWeight: "600" },
  blockName: { fontSize: 10, color: Colors.ink, fontWeight: "600", lineHeight: 12 },
});

export default AgendaDentalWeek;
