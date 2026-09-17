// ============================================================
// AURA. — Visão SEMANAL da agenda odonto
//
// Mockup "Agenda Odonto" (16/09/2026), aba A:
// - blocos com altura proporcional à duração; 30 min = "09:00 Ana Teste" numa linha;
// - borda tracejada = agendado (ainda não confirmou); cancelados fora da grade;
// - arrastar remarca (fantasma, faixa-alvo "Qui 17 · 14:30", aviso com Desfazer);
//   a borda de baixo muda a duração; soltar sobre outro paciente pergunta se é encaixe;
// - em atendimento, concluído e faltas não se movem; toque nunca arrasta;
// - a faixa de horas (startHour–endHour) estica para caber consultas fora dela.
// O arraste é por pointer events (hooks/useAgendaDrag): o RNW 0.19 descartava
// draggable/onDragStart/onDrop, e o arraste antigo nunca funcionou.
// A gravação fica com quem monta a agenda (onReschedule).
// ============================================================
import { useCallback, useMemo, useRef } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import { Fonts } from "@/constants/fonts";
import type { DentalAppointment } from "@/components/verticals/odonto/AgendaDental";
import { startOfWeek } from "@/components/verticals/odonto/AgendaNavigator";
import {
  AgendaBlock,
  AgendaToast,
  ColumnDragLayer,
  DRAG_MIN_WIDTH,
  IS_WEB,
  NowLine,
  StatusLegend,
  isMovable,
  useAgendaCss,
} from "@/components/verticals/odonto/AgendaGridParts";
import { useAgendaDrag, type DragPreview } from "@/hooks/useAgendaDrag";
import { changeFromPreview, useAgendaGridFlow } from "@/hooks/useAgendaGridFlow";
import type { RescheduleFn } from "@/hooks/useDentalReschedule";
import {
  atMinute,
  blockBox,
  dayKey,
  gridHourRange,
  hm,
  layoutLanes,
  minutesOfDay,
  pad2,
} from "@/utils/agendaGrid";

interface Props {
  appointments: DentalAppointment[];
  anchorDate: Date;
  onAppointmentPress?: (a: DentalAppointment) => void;
  onSlotPress?: (date: Date) => void;
  /** Grava a remarcação/duração. Sem ele, a grade não arrasta. */
  onReschedule?: RescheduleFn;
  startHour?: number;
  endHour?: number;
  hourPx?: number;
}

const C = DentalColors;
const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HOUR_COL = 52;

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function AgendaDentalWeek({
  appointments,
  anchorDate,
  onAppointmentPress,
  onSlotPress,
  onReschedule,
  startHour = 7,
  endHour = 19,
  hourPx = 56,
}: Props) {
  useAgendaCss();
  const { width } = useWindowDimensions();
  const canDrag = IS_WEB && width >= DRAG_MIN_WIDTH && !!onReschedule;
  const now = new Date();
  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);

  const visible = useMemo(() => appointments.filter(a => a.status !== "cancelado"), [appointments]);
  const byId = useMemo(() => new Map(visible.map(a => [a.id, a])), [visible]);

  // Seg–Sáb sempre; domingo só se tiver consulta.
  const { days, buckets } = useMemo(() => {
    const all = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
    const b: Record<string, DentalAppointment[]> = {};
    for (const a of visible) {
      const k = dayKey(new Date(a.scheduled_at));
      (b[k] = b[k] || []).push(a);
    }
    return { days: all.filter((d, i) => i < 6 || (b[dayKey(d)]?.length ?? 0) > 0), buckets: b };
  }, [weekStart, visible]);

  const range = useMemo(() => {
    const spans = days.flatMap(d => (buckets[dayKey(d)] || []).map(a => ({
      start: minutesOfDay(new Date(a.scheduled_at)), dur: a.duration_min || 60,
    })));
    return gridHourRange(spans, startHour, endHour);
  }, [days, buckets, startHour, endHour]);
  const geometry = useMemo(() => ({ hourPx, ...range }), [hourPx, range]);
  const hours = useMemo(
    () => Array.from({ length: range.endHour - range.startHour }, (_, i) => range.startHour + i),
    [range],
  );
  const bodyHeight = hours.length * hourPx;

  const flow = useAgendaGridFlow({ appointments: visible, onReschedule });
  const colRefs = useRef<any[]>([]);

  const toChange = useCallback((p: DragPreview) => {
    const appt = byId.get(p.id);
    const day = days[p.colIdx];
    if (!appt || !day) return null;
    return changeFromPreview(appt, p, { day, columnChanged: p.colIdx !== p.fromCol });
  }, [byId, days]);

  const drag = useAgendaDrag({
    enabled: canDrag,
    geometry,
    getColumnRects: () => days.map((_, i) => {
      const r = colRefs.current[i]?.getBoundingClientRect?.();
      return r ? { left: r.left, right: r.right, top: r.top } : { left: 0, right: 0, top: 0 };
    }),
    onDrop: (_item, p) => {
      const req = toChange(p);
      if (req) flow.request(req);
    },
  });

  function press(a: DentalAppointment) {
    if (drag.consumeClick()) return;
    onAppointmentPress?.(a);
  }

  const activeCol = (drag.preview ?? flow.pending?.ghost)?.colIdx ?? -1;
  const nowMin = minutesOfDay(now);

  const grid = (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={{ width: HOUR_COL }} />
        {days.map((d, i) => {
          const isToday = sameDay(d, now);
          const count = (buckets[dayKey(d)] || []).length;
          const dow = DOW[(d.getDay() + 6) % 7];
          return (
            <View key={i} style={s.dayHeader}>
              <Text style={[s.dow, isToday && s.dowToday]}>{dow}</Text>
              <Text style={[s.dayNum, isToday && s.dayNumToday]}>{d.getDate()}</Text>
              <Text style={s.dayCount} numberOfLines={1}>
                {count ? `${count} ${count > 1 ? "consultas" : "consulta"}` : "—"}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[s.bodyRow, { height: bodyHeight }]}>
        <View style={{ width: HOUR_COL }}>
          {hours.map(h => (
            <View key={h} style={{ height: hourPx }}>
              <Text style={s.hourLabel}>{pad2(h)}:00</Text>
            </View>
          ))}
        </View>

        {days.map((d, di) => {
          const isToday = sameDay(d, now);
          const list = buckets[dayKey(d)] || [];
          const laid = layoutLanes(list.map(a => ({
            id: a.id, start: minutesOfDay(new Date(a.scheduled_at)), dur: a.duration_min || 60, a,
          })));
          const ghostId = drag.preview?.id ?? flow.pending?.appt.id;
          return (
            <View
              key={di}
              testID={`agenda-col-${di}`}
              ref={(el: any) => { colRefs.current[di] = el; }}
              style={[s.dayCol, isToday && s.dayColToday, activeCol === di && { zIndex: 5 }]}
            >
              {hours.map(h => [0, 30].map(m => (
                <Pressable
                  key={`${h}-${m}`}
                  onPress={() => onSlotPress?.(atMinute(d, h * 60 + m))}
                  accessibilityLabel={`Agendar ${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} às ${hm(h * 60 + m)}`}
                  style={[s.slot, { height: hourPx / 2 }, m === 0 ? s.slotHour : s.slotHalf]}
                />
              )))}

              {laid.map(({ item, col, n }) => {
                const box = blockBox(item.start, item.dur, range.startHour, hourPx);
                const movable = canDrag && isMovable(item.a.status);
                const dragItem = { id: item.id, colIdx: di, startMin: item.start, durMin: item.dur };
                return (
                  <AgendaBlock
                    key={item.id}
                    appt={item.a}
                    place={{ top: box.top, height: box.height, leftPct: (col * 100) / n, widthPct: 100 / n }}
                    wide={false}
                    lanes={n}
                    movable={movable}
                    dragging={ghostId === item.id}
                    flashing={flow.flashId === item.id}
                    onPress={() => press(item.a)}
                    onMoveDown={movable ? (e: any) => drag.onMovePointerDown(e, dragItem) : undefined}
                    onResizeDown={movable ? (e: any) => drag.onResizePointerDown(e, dragItem) : undefined}
                  />
                );
              })}

              {isToday && nowMin >= range.startHour * 60 && nowMin <= range.endHour * 60 ? (
                <NowLine top={((nowMin - range.startHour * 60) / 60) * hourPx} />
              ) : null}

              <ColumnDragLayer
                colIdx={di}
                colCount={days.length}
                day={d}
                hourPx={hourPx}
                startHour={range.startHour}
                preview={drag.preview}
                pending={flow.pending}
                toChange={toChange}
                appointments={visible}
                onFit={flow.confirmFit}
                onCancel={flow.cancelPending}
              />
            </View>
          );
        })}
      </View>

      <AgendaToast toast={flow.toast} onClose={flow.dismissToast} />
    </View>
  );

  return (
    <View style={{ gap: 8 }}>
      <StatusLegend />
      {width < DRAG_MIN_WIDTH ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 640, flex: 1 }}>{grid}</View>
        </ScrollView>
      ) : grid}
      {canDrag ? (
        <Text style={s.hint}>Arraste uma consulta para remarcar; puxe a borda de baixo para mudar a duração.</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.bg2, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingBottom: 12 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border },
  dayHeader: {
    flex: 1, minWidth: 0, flexDirection: "row", alignItems: "baseline", gap: 6,
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 7, borderLeftWidth: 1, borderLeftColor: C.border,
  },
  dowToday: { color: C.cyan },
  dow: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: C.ink3, textTransform: "uppercase", fontFamily: Fonts.body, flexShrink: 0 },
  dayNum: { fontSize: 16, fontWeight: "700", color: C.ink, fontFamily: Fonts.body, paddingHorizontal: 1, flexShrink: 0 },
  dayNumToday: { backgroundColor: C.cyan, color: "#03171d", borderRadius: 8, paddingHorizontal: 7, overflow: "hidden" },
  dayCount: { marginLeft: "auto" as any, fontSize: 10.5, color: C.ink3, fontFamily: Fonts.body, flexShrink: 1 },
  bodyRow: { flexDirection: "row", marginTop: 10 },
  hourLabel: {
    position: "absolute", top: -7, right: 8, fontSize: 10, fontWeight: "500", color: C.ink3, fontFamily: Fonts.mono,
  },
  dayCol: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderLeftColor: C.border },
  dayColToday: { backgroundColor: C.cyanGhost },
  slot: { borderTopWidth: 1 },
  slotHour: { borderTopColor: C.border },
  slotHalf: { borderTopColor: C.surface },
  hint: { fontSize: 11.5, color: C.ink3, fontFamily: Fonts.body },
});

export default AgendaDentalWeek;
