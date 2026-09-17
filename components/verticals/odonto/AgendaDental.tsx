// ============================================================
// AgendaDental — visão DIA da agenda odonto
//
// Mockup "Agenda Odonto" (16/09/2026), aba B (e G no celular):
// linha do tempo com altura proporcional à duração, uma coluna por cadeira.
// Mesmo comportamento da Semana (arrastar muda só o horário, e a cadeira se
// soltar em outra; a borda de baixo muda só a duração). Por ser mais larga, a
// coluna mostra procedimento, telefone e alergia. A lateral responde "quem
// está na cadeira", "quem está esperando" e "quem vem depois".
// Antes era uma lista de linhas de 1h: só cabia 1 consulta por hora e 07:30
// aparecia como 07:00. A WeekView interna (não usada) foi removida — a Semana
// é o AgendaDentalWeek.
// ============================================================
import { useCallback, useMemo, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import { DENTAL_STATUS_ORDER, dentalStatus } from "@/constants/dentalStatus";
import { Fonts } from "@/constants/fonts";
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
  blockBox,
  gridHourRange,
  hm,
  layoutLanes,
  minutesOfDay,
  pad2,
} from "@/utils/agendaGrid";

export interface DentalAppointment {
  id: string;
  patient_name: string;
  patient_phone?: string;
  scheduled_at: string;
  duration_min: number;
  chief_complaint?: string;
  /** Ver constants/dentalStatus.ts (DentalStatus). */
  status: string;
  chair?: string;
  practitioner_id?: string | null;
  /** Alergias do paciente, quando a API manda. */
  allergies?: string | null;
  professional_name?: string;
  professional_color?: string;
}

export interface DentalChair {
  /** Rótulo exibido ("Cadeira 1 - Dra. Marina"); também casa com appointment.chair. */
  label: string;
  /**
   * Dentista alocado na cadeira. Soltar um bloco nesta coluna troca o
   * practitioner_id da consulta; sem dentista alocado a coluna não recebe blocos
   * de outras cadeiras.
   */
  practitionerId?: string | null;
}

interface Props {
  appointments: DentalAppointment[];
  chairs?: DentalChair[];
  date?: Date;
  onAppointmentPress?: (appt: DentalAppointment) => void;
  /** (rótulo da cadeira, "HH:MM") */
  onSlotPress?: (chair: string, time: string) => void;
  /** Grava a remarcação/duração. Sem ele, a grade não arrasta. */
  onReschedule?: RescheduleFn;
  startHour?: number;
  endHour?: number;
}

const C = DentalColors;
const HOUR_COL = 52;
const DEFAULT_CHAIRS: DentalChair[] = [{ label: "Cadeira 1" }];
const WAITING_LIST = new Set(["agendado", "confirmado", "avaliacao", "aprovado"]);

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Coluna da consulta: dentista da cadeira, depois o rótulo, senão a primeira. */
function chairIndexFor(a: DentalAppointment, chairs: DentalChair[]): number {
  if (a.practitioner_id) {
    const i = chairs.findIndex(c => c.practitionerId && c.practitionerId === a.practitioner_id);
    if (i >= 0) return i;
  }
  if (a.chair) {
    const i = chairs.findIndex(c => c.label === a.chair);
    if (i >= 0) return i;
  }
  return 0;
}

export function AgendaDental({
  appointments,
  chairs: chairsProp,
  date,
  onAppointmentPress,
  onSlotPress,
  onReschedule,
  startHour = 7,
  endHour = 19,
}: Props) {
  useAgendaCss();
  const { width } = useWindowDimensions();
  const phone = width < DRAG_MIN_WIDTH;
  const withSide = width >= 1024;
  const canDrag = IS_WEB && !phone && !!onReschedule;
  const hourPx = phone ? 64 : 76;
  const chairs = chairsProp && chairsProp.length ? chairsProp : DEFAULT_CHAIRS;
  const anchor = useMemo(() => {
    const d = date ? new Date(date) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [date]);
  const now = new Date();
  const isToday = sameDay(anchor, now);
  const nowMin = minutesOfDay(now);

  const dayAppts = useMemo(
    () => appointments
      .filter(a => a.status !== "cancelado" && sameDay(new Date(a.scheduled_at), anchor))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [appointments, anchor],
  );
  const byId = useMemo(() => new Map(dayAppts.map(a => [a.id, a])), [dayAppts]);
  const byChair = useMemo(() => {
    const m: DentalAppointment[][] = chairs.map(() => []);
    for (const a of dayAppts) m[chairIndexFor(a, chairs)].push(a);
    return m;
  }, [dayAppts, chairs]);

  const range = useMemo(() => gridHourRange(
    dayAppts.map(a => ({ start: minutesOfDay(new Date(a.scheduled_at)), dur: a.duration_min || 60 })),
    startHour,
    endHour,
  ), [dayAppts, startHour, endHour]);
  const geometry = useMemo(() => ({ hourPx, ...range }), [hourPx, range]);
  const hours = useMemo(
    () => Array.from({ length: range.endHour - range.startHour }, (_, i) => range.startHour + i),
    [range],
  );

  const flow = useAgendaGridFlow({ appointments: dayAppts, onReschedule });
  const colRefs = useRef<any[]>([]);

  const toChange = useCallback((p: DragPreview) => {
    const appt = byId.get(p.id);
    const chair = chairs[p.colIdx];
    if (!appt || !chair) return null;
    return changeFromPreview(appt, p, {
      day: anchor,
      columnChanged: p.colIdx !== p.fromCol,
      practitionerId: chair.practitionerId || undefined,
      columnLabel: chair.label,
    });
  }, [byId, chairs, anchor]);

  const drag = useAgendaDrag({
    enabled: canDrag,
    geometry,
    getColumnRects: () => chairs.map((_, i) => {
      const r = colRefs.current[i]?.getBoundingClientRect?.();
      return r ? { left: r.left, right: r.right, top: r.top } : { left: 0, right: 0, top: 0 };
    }),
    canEnterColumn: (_from, to) => !!chairs[to]?.practitionerId,
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
  const ghostId = drag.preview?.id ?? flow.pending?.appt.id;
  const multi = chairs.length > 1;

  const grid = (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={{ width: HOUR_COL }} />
        {chairs.map((ch, i) => (
          <View key={ch.label + i} style={[s.chairHeader, multi && phone && s.chairMin]}>
            <View style={s.chairDot} />
            <Text style={s.chairName} numberOfLines={1}>{ch.label}</Text>
            <Text style={s.chairCount}>
              {byChair[i].length} {byChair[i].length === 1 ? "consulta" : "consultas"}
            </Text>
          </View>
        ))}
      </View>

      <View style={[s.bodyRow, { height: hours.length * hourPx }]}>
        <View style={{ width: HOUR_COL }}>
          {hours.map(h => (
            <View key={h} style={{ height: hourPx }}>
              <Text style={s.hourLabel}>{pad2(h)}:00</Text>
            </View>
          ))}
        </View>

        {chairs.map((ch, ci) => {
          const laid = layoutLanes(byChair[ci].map(a => ({
            id: a.id, start: minutesOfDay(new Date(a.scheduled_at)), dur: a.duration_min || 60, a,
          })));
          return (
            <View
              key={ch.label + ci}
              testID={`agenda-col-${ci}`}
              ref={(el: any) => { colRefs.current[ci] = el; }}
              style={[s.col, multi && phone && s.chairMin, activeCol === ci && { zIndex: 5 }]}
            >
              {hours.map(h => [0, 30].map(m => (
                <Pressable
                  key={`${h}-${m}`}
                  onPress={() => onSlotPress?.(ch.label, hm(h * 60 + m))}
                  accessibilityLabel={`Agendar às ${hm(h * 60 + m)} na ${ch.label}`}
                  style={[s.slot, { height: hourPx / 2 }, m === 0 ? s.slotHour : s.slotHalf]}
                />
              )))}

              {laid.map(({ item, col, n }) => {
                const box = blockBox(item.start, item.dur, range.startHour, hourPx);
                const movable = canDrag && isMovable(item.a.status);
                const dragItem = { id: item.id, colIdx: ci, startMin: item.start, durMin: item.dur };
                return (
                  <AgendaBlock
                    key={item.id}
                    appt={item.a}
                    place={{ top: box.top, height: box.height, leftPct: (col * 100) / n, widthPct: 100 / n }}
                    wide
                    compact={phone}
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
                <NowLine top={((nowMin - range.startHour * 60) / 60) * hourPx} label={ci === 0 ? hm(nowMin) : undefined} />
              ) : null}

              <ColumnDragLayer
                colIdx={ci}
                colCount={chairs.length}
                day={anchor}
                columnLabel={ch.label}
                hourPx={hourPx}
                startHour={range.startHour}
                preview={drag.preview}
                pending={flow.pending}
                toChange={toChange}
                appointments={dayAppts}
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
      {!phone && <StatusLegend />}
      {phone && <Text style={s.hint}>Toque numa consulta para ver, confirmar ou remarcar.</Text>}
      <View style={withSide ? s.layoutSide : undefined}>
        <View style={withSide ? { flex: 1, minWidth: 0 } : undefined}>
          {multi && phone ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>{grid}</ScrollView>
          ) : grid}
        </View>
        {withSide && (
          <DaySide appointments={dayAppts} isToday={isToday} nowMin={nowMin} onPress={a => onAppointmentPress?.(a)} />
        )}
      </View>
    </View>
  );
}

// ─── Lateral: na cadeira, aguardando, próximos, contagem ────

function DaySide({ appointments, isToday, nowMin, onPress }: {
  appointments: DentalAppointment[];
  isToday: boolean;
  nowMin: number;
  onPress: (a: DentalAppointment) => void;
}) {
  const inChair = appointments.filter(a => a.status === "em_atendimento");
  const waiting = appointments.filter(a => a.status === "paciente_consultorio");
  const next = appointments.filter(a =>
    WAITING_LIST.has(a.status) && (!isToday || minutesOfDay(new Date(a.scheduled_at)) > nowMin));
  const counts = DENTAL_STATUS_ORDER
    .filter(k => k !== "cancelado")
    .map(k => [k, appointments.filter(a => a.status === k).length] as const)
    .filter(([, c]) => c > 0);

  const row = (a: DentalAppointment) => (
    <Pressable key={a.id} onPress={() => onPress(a)} style={s.sideRow} accessibilityRole="button">
      <View style={[s.sideDot, { backgroundColor: dentalStatus(a.status).color }]} />
      <Text style={s.sideTime}>{hm(minutesOfDay(new Date(a.scheduled_at)))}</Text>
      <Text style={s.sideName} numberOfLines={1}>{a.patient_name}</Text>
    </Pressable>
  );

  return (
    <View style={s.side}>
      {isToday && (
        <>
          <View style={s.sideCard}>
            <Text style={s.sideTitle}>Na cadeira agora</Text>
            {inChair.length ? inChair.map(row) : <Text style={s.sideEmpty}>Ninguém</Text>}
          </View>
          <View style={s.sideCard}>
            <Text style={s.sideTitle}>Aguardando</Text>
            {waiting.length ? waiting.map(row) : <Text style={s.sideEmpty}>Ninguém na sala de espera</Text>}
          </View>
        </>
      )}
      <View style={s.sideCard}>
        <Text style={s.sideTitle}>{isToday ? "Próximos" : "A atender"}</Text>
        {next.length ? next.map(row) : <Text style={s.sideEmpty}>Nenhum</Text>}
      </View>
      <View style={s.sideCard}>
        <Text style={s.sideTitle}>{isToday ? "Hoje" : "No dia"}</Text>
        {counts.length ? counts.map(([k, c]) => (
          <View key={k} style={s.kv}>
            <View style={s.kvLeft}>
              <View style={[s.kvDot, { backgroundColor: dentalStatus(k).color }]} />
              <Text style={s.kvLabel}>{dentalStatus(k).label}</Text>
            </View>
            <Text style={s.kvVal}>{c}</Text>
          </View>
        )) : <Text style={s.sideEmpty}>Sem consultas</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  layoutSide: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  card: { backgroundColor: C.bg2, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingBottom: 12, flexGrow: 1 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border },
  chairHeader: {
    flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 8, paddingVertical: 8, borderLeftWidth: 1, borderLeftColor: C.border,
  },
  chairMin: { minWidth: 220 },
  chairDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.cyan },
  chairName: { fontSize: 12.5, fontWeight: "600", color: C.ink, fontFamily: Fonts.body, flexShrink: 1 },
  chairCount: { marginLeft: "auto" as any, fontSize: 10.5, color: C.ink3, fontFamily: Fonts.body, flexShrink: 0 },
  bodyRow: { flexDirection: "row", marginTop: 10 },
  hourLabel: { position: "absolute", top: -7, right: 8, fontSize: 10, fontWeight: "500", color: C.ink3, fontFamily: Fonts.mono },
  col: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderLeftColor: C.border },
  slot: { borderTopWidth: 1 },
  slotHour: { borderTopColor: C.border },
  slotHalf: { borderTopColor: C.surface },
  hint: { fontSize: 11.5, color: C.ink3, fontFamily: Fonts.body },

  side: { width: 290, gap: 12 },
  sideCard: { backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 },
  sideTitle: {
    fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: C.ink3, fontWeight: "600",
    fontFamily: Fonts.body, marginBottom: 8,
  },
  sideEmpty: { fontSize: 11.5, color: C.ink3, fontFamily: Fonts.body },
  sideRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  sideDot: { width: 9, height: 9, borderRadius: 5 },
  sideTime: { fontSize: 11, color: C.ink3, fontFamily: Fonts.mono },
  sideName: { fontSize: 13, fontWeight: "600", color: C.ink, fontFamily: Fonts.body, flexShrink: 1 },
  kv: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  kvLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  kvDot: { width: 8, height: 8, borderRadius: 2 },
  kvLabel: { fontSize: 13, color: C.ink2, fontFamily: Fonts.body },
  kvVal: { fontSize: 13, fontWeight: "700", color: C.ink, fontFamily: Fonts.body },
});

export default AgendaDental;
