// ============================================================
// AgendaGridParts — peças da grade da agenda odonto (Semana e Dia)
//
// Mockup "Agenda Odonto" (16/09/2026), abas A e B. No web o bloco é um
// <div> com CSS próprio (hover, borda tracejada, alça que só aparece com
// mouse, `@media (hover: none)` para toque) porque o react-native-web 0.19
// não repassa className nem eventos de arraste em View. No app nativo o
// bloco é um Pressable simples, sem arraste.
// ============================================================
import { createElement, useEffect, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import { DENTAL_LOCKED_STATUSES, DENTAL_STATUS_ORDER, dentalStatus } from "@/constants/dentalStatus";
import { Fonts } from "@/constants/fonts";
import { IS_DARK_MODE } from "@/constants/colors";
import type { DragPreview } from "@/hooks/useAgendaDrag";
import {
  conflictsFor,
  type ChangeRequest,
  type FlowAppointment,
  type GridToast,
  type PendingConflict,
} from "@/hooks/useAgendaGridFlow";
import { blockBox, blockTier, dropLabel, firstName, hm, minutesOfDay, type BlockTier } from "@/utils/agendaGrid";

export const IS_WEB = Platform.OS === "web";
/** Abaixo disso não há arraste: toque abre o detalhe (mockup, aba G). */
export const DRAG_MIN_WIDTH = 768;

const C = DentalColors;
const PRI_INK = IS_DARK_MODE ? "#03171d" : "#ffffff";
const TOAST_BG = C.ink;
const TOAST_INK = IS_DARK_MODE ? "#050d12" : "#ffffff";
const UNDO_INK = IS_DARK_MODE ? "#0891B2" : "#67e8f9";

function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface GridAppointment {
  id: string;
  patient_name: string;
  patient_phone?: string | null;
  scheduled_at: string;
  duration_min: number;
  chief_complaint?: string | null;
  status: string;
  practitioner_id?: string | null;
  allergies?: string | null;
}

export function isMovable(status: string): boolean {
  return !DENTAL_LOCKED_STATUSES.has(status);
}

// ─── CSS (web) ──────────────────────────────────────────────

const CSS_ID = "aura-agenda-grid-css";
const CSS = `
.aag-blk{position:absolute;box-sizing:border-box;border-left:3px solid var(--c);border-radius:6px;padding:3px 7px;overflow:hidden;cursor:pointer;font-family:${Fonts.body};font-size:11.5px;line-height:1.3;color:${C.ink};background-color:${C.bg2};background-image:linear-gradient(var(--cb),var(--cb));box-shadow:inset 0 0 0 1px var(--cl);user-select:none;-webkit-user-select:none;touch-action:manipulation;z-index:2;outline:none;text-align:left}
.aag-blk:hover{background-image:linear-gradient(var(--ch),var(--ch))}
.aag-blk:focus-visible{box-shadow:0 0 0 2px ${C.cyan}}
.aag-blk.aag-movable{cursor:grab}
.aag-blk.aag-dashed{box-shadow:none;outline:1px dashed var(--cd);outline-offset:-1px}
.aag-blk.aag-done{opacity:.82}
.aag-blk.aag-t1{padding:0 7px;display:flex;align-items:center}
.aag-line{display:flex;gap:6px;align-items:baseline;white-space:nowrap;min-width:0;width:100%}
.aag-time{font-family:${Fonts.mono};font-weight:500;font-size:10px;color:${C.ink2};white-space:nowrap;flex:none}
.aag-name{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.aag-proc{color:${C.ink2};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;min-width:0}
.aag-st{margin-left:auto;font-size:10px;font-weight:700;color:var(--c);white-space:nowrap;flex:none}
.aag-tags{display:flex;gap:4px;margin-top:3px;flex-wrap:wrap}
.aag-tag{font-size:10px;font-weight:700;padding:1px 6px;border-radius:5px;background:${rgba(C.red, 0.16)};color:${C.red}}
.aag-allergy{color:${C.red};font-weight:800;margin-left:2px;flex:none}
.aag-rs{position:absolute;left:0;right:0;bottom:0;height:9px;cursor:ns-resize;opacity:0;touch-action:none}
.aag-rs::after{content:'';position:absolute;left:50%;bottom:2px;width:24px;height:3px;margin-left:-12px;border-radius:2px;background:var(--c)}
.aag-blk.aag-movable:hover .aag-rs{opacity:1}
@media (hover:none){.aag-rs{display:none}}
.aag-src{opacity:.28}
.aag-ghost{opacity:.82;pointer-events:none;box-shadow:0 10px 26px rgba(0,0,0,.35);z-index:8;outline:1.5px solid var(--c)!important;outline-offset:-1px}
.aag-target{position:absolute;left:0;right:0;box-sizing:border-box;background:${C.cyanDim};border:1.5px dashed ${C.cyan};border-radius:8px;z-index:7;pointer-events:none}
.aag-target.aag-warn{background:${rgba(C.amber, 0.14)};border-color:${C.amber}}
.aag-label{position:absolute;top:-25px;left:-2px;background:${C.cyan};color:${PRI_INK};font-family:${Fonts.body};font-size:11.5px;font-weight:700;padding:3px 8px;border-radius:6px;white-space:nowrap;z-index:9;box-shadow:0 4px 12px rgba(0,0,0,.25)}
.aag-label.aag-bottom{top:auto;bottom:-26px}
.aag-warn .aag-label{background:${C.amber};color:#1a1200}
.aag-flash{animation:aag-flash 1.4s ease-out}
@keyframes aag-flash{0%{box-shadow:0 0 0 0 ${C.cyan}}30%{box-shadow:0 0 0 5px ${C.cyanSoft}}100%{box-shadow:0 0 0 0 transparent}}
`;

export function useAgendaCss() {
  useEffect(() => {
    if (!IS_WEB || typeof document === "undefined") return;
    if (document.getElementById(CSS_ID)) return;
    const el = document.createElement("style");
    el.id = CSS_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

function statusVars(status: string): Record<string, string> {
  const st = dentalStatus(status);
  return {
    "--c": st.color,
    "--cb": st.bg,
    "--ch": rgba(st.color, IS_DARK_MODE ? 0.26 : 0.2),
    "--cl": rgba(st.color, 0.26),
    "--cd": rgba(st.color, 0.75),
  };
}

// ─── Bloco ──────────────────────────────────────────────────

export interface BlockPlacement {
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
}

interface BlockProps {
  appt: GridAppointment;
  place: BlockPlacement;
  /** Coluna larga (visão Dia): mostra procedimento, telefone, status. */
  wide: boolean;
  /** Celular: sem status/telefone. */
  compact?: boolean;
  /** Quantas faixas dividem o espaço (etiquetas só com a coluna inteira). */
  lanes: number;
  movable: boolean;
  dragging?: boolean;
  flashing?: boolean;
  onPress: () => void;
  onMoveDown?: (e: any) => void;
  onResizeDown?: (e: any) => void;
}

function blockTitle(a: GridAppointment, start: number): string {
  const st = dentalStatus(a.status);
  return `${a.patient_name} · ${hm(start)}–${hm(start + a.duration_min)} · ${st.label}`
    + (a.allergies ? ` · Alergia: ${a.allergies}` : "");
}

function webBlockChildren(a: GridAppointment, tier: BlockTier, wide: boolean, compact: boolean, lanes: number, start: number): ReactNode[] {
  const h = createElement;
  const st = dentalStatus(a.status);
  const allergy = a.allergies ? h("span", { key: "al", className: "aag-allergy", title: `Alergia: ${a.allergies}` }, "!") : null;
  const proc = a.chief_complaint || "Consulta";
  const end = start + a.duration_min;
  if (tier === "t1") {
    return [h("div", { key: "l", className: "aag-line" },
      h("span", { className: "aag-time" }, hm(start)),
      h("span", { className: "aag-name" }, a.patient_name),
      allergy,
      wide ? h("span", { className: "aag-proc" }, `· ${proc}`) : null,
    )];
  }
  const out: ReactNode[] = [
    h("div", { key: "l1", className: "aag-line" },
      h("span", { className: "aag-time" }, `${hm(start)}–${hm(end)}`),
      wide && !compact ? h("span", { className: "aag-st" }, st.short) : null,
    ),
    h("div", { key: "l2", className: "aag-line" }, h("span", { className: "aag-name" }, a.patient_name), allergy),
  ];
  if (tier === "t3" || wide) {
    const phone = wide && !compact && a.patient_phone ? ` · ${a.patient_phone}` : "";
    out.push(h("div", { key: "l3", className: "aag-proc" }, proc + phone));
  }
  if (tier === "t3" && a.allergies && (wide || lanes === 1)) {
    out.push(h("div", { key: "tg", className: "aag-tags" }, h("span", { className: "aag-tag" }, `Alergia: ${a.allergies}`)));
  }
  return out;
}

export function AgendaBlock({ appt, place, wide, compact = false, lanes, movable, dragging, flashing, onPress, onMoveDown, onResizeDown }: BlockProps) {
  const start = minutesOfDay(new Date(appt.scheduled_at));
  const tier = blockTier(place.height, wide);
  const st = dentalStatus(appt.status);
  const done = appt.status === "concluido" || appt.status === "faltou" || appt.status === "falta_justificada";
  const title = blockTitle(appt, start);

  if (IS_WEB) {
    const cls = [
      "aag-blk", `aag-${tier}`,
      movable ? "aag-movable" : "",
      st.dashed ? "aag-dashed" : "",
      done ? "aag-done" : "",
      dragging ? "aag-src" : "",
      flashing ? "aag-flash" : "",
    ].filter(Boolean).join(" ");
    return createElement(
      "div",
      {
        className: cls,
        role: "button",
        tabIndex: 0,
        title,
        "aria-label": title,
        "data-appt-id": appt.id,
        style: {
          ...statusVars(appt.status),
          top: place.top,
          height: place.height,
          left: `calc(${place.leftPct}% + 2px)`,
          width: `calc(${place.widthPct}% - 4px)`,
        },
        onClick: onPress,
        onKeyDown: (e: any) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPress(); }
        },
        onPointerDown: movable ? onMoveDown : undefined,
      },
      ...webBlockChildren(appt, tier, wide, compact, lanes, start),
      movable && onResizeDown
        ? createElement("div", { key: "rs", className: "aag-rs", title: "Arraste para mudar a duração", onPointerDown: onResizeDown })
        : null,
    );
  }

  // Nativo: sem arraste.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[
        n.block,
        {
          top: place.top,
          height: place.height,
          left: `${place.leftPct}%` as any,
          width: `${place.widthPct}%` as any,
          borderLeftColor: st.color,
          backgroundColor: st.bg,
          opacity: done ? 0.82 : 1,
        },
      ]}
    >
      {tier === "t1" ? (
        <Text style={n.name} numberOfLines={1}>
          <Text style={n.time}>{hm(start)} </Text>{appt.patient_name}{appt.allergies ? <Text style={n.allergy}> !</Text> : null}
        </Text>
      ) : (
        <>
          <Text style={n.time} numberOfLines={1}>{hm(start)}–{hm(start + appt.duration_min)}</Text>
          <Text style={n.name} numberOfLines={1}>{appt.patient_name}{appt.allergies ? <Text style={n.allergy}> !</Text> : null}</Text>
          {(tier === "t3" || wide) && <Text style={n.proc} numberOfLines={1}>{appt.chief_complaint || "Consulta"}</Text>}
        </>
      )}
    </Pressable>
  );
}

// ─── Fantasma + faixa-alvo ──────────────────────────────────

export function DropOverlay({ appt, top, height, startMin, durMin, label, warn, bottomLabel }: {
  appt: GridAppointment;
  top: number;
  height: number;
  startMin: number;
  durMin: number;
  label: string;
  warn: boolean;
  bottomLabel: boolean;
}) {
  if (!IS_WEB) return null;
  const h = createElement;
  const tier = height < 36 ? "t1" : "t2";
  const st = dentalStatus(appt.status);
  const name = h("span", { className: "aag-name" }, appt.patient_name);
  const lines = tier === "t1"
    ? [h("div", { key: "a", className: "aag-line" }, h("span", { className: "aag-time" }, hm(startMin)), name)]
    : [
      h("div", { key: "a", className: "aag-line" }, h("span", { className: "aag-time" }, `${hm(startMin)}–${hm(startMin + durMin)}`)),
      h("div", { key: "b", className: "aag-line" }, name),
    ];
  return h(
    "div",
    { style: { position: "absolute", left: 0, right: 0, top: 0, height: 0 } },
    h("div", { key: "t", className: `aag-target${warn ? " aag-warn" : ""}`, style: { top, height } },
      h("div", { className: `aag-label${bottomLabel ? " aag-bottom" : ""}`, role: "status" }, label)),
    h("div", {
      key: "g",
      className: `aag-blk aag-ghost aag-${tier}${st.dashed ? " aag-dashed" : ""}`,
      style: { ...statusVars(appt.status), top, height, left: 2, width: "calc(100% - 4px)" },
    }, ...lines),
  );
}

// ─── Camada de arraste de uma coluna ────────────────────────

/**
 * Fantasma + faixa-alvo (durante o arraste ou com o aviso de conflito
 * aberto) e o próprio aviso, na coluna-alvo.
 */
export function ColumnDragLayer({ colIdx, colCount, day, columnLabel, hourPx, startHour, preview, pending, toChange, appointments, onFit, onCancel }: {
  colIdx: number;
  colCount: number;
  day: Date;
  /** Nome da coluna (cadeira) para o rótulo quando o bloco troca de coluna. */
  columnLabel?: string;
  hourPx: number;
  startHour: number;
  preview: DragPreview | null;
  pending: PendingConflict | null;
  toChange: (p: DragPreview) => ChangeRequest | null;
  appointments: FlowAppointment[];
  onFit: () => void;
  onCancel: () => void;
}) {
  const active = preview ?? pending?.ghost ?? null;
  if (!active || active.colIdx !== colIdx) return null;
  const req = preview ? toChange(preview) : pending;
  if (!req) return null;
  const conflicts = preview ? conflictsFor(req, appointments) : pending!.conflicts;
  const box = blockBox(active.startMin, active.durMin, startHour, hourPx);
  let label = dropLabel(active.mode, day, active.startMin, active.durMin);
  if (active.mode === "move" && active.fromCol !== active.colIdx && columnLabel) label += ` · ${columnLabel}`;
  if (conflicts.length) label += ` · sobre ${firstName(conflicts[0].patient_name)}`;
  const appt = req.appt as GridAppointment;
  return (
    <>
      <DropOverlay
        appt={appt}
        top={box.top}
        height={box.height}
        startMin={active.startMin}
        durMin={active.durMin}
        label={label}
        warn={conflicts.length > 0}
        bottomLabel={active.mode === "resize"}
      />
      {!preview && pending ? (
        <ConflictPopover
          pending={pending}
          top={box.top + box.height + (active.mode === "resize" ? 34 : 12)}
          alignRight={colCount > 1 && colIdx >= colCount - 2}
          onFit={onFit}
          onCancel={onCancel}
        />
      ) : null}
    </>
  );
}

// ─── Aviso de conflito ancorado ao horário ──────────────────

export function ConflictPopover({ pending, top, alignRight, onFit, onCancel }: {
  pending: PendingConflict;
  top: number;
  alignRight: boolean;
  onFit: () => void;
  onCancel: () => void;
}) {
  const c = pending.conflicts[0];
  const cStart = c ? minutesOfDay(new Date(c.scheduled_at)) : 0;
  const more = pending.conflicts.length > 1 ? ` e mais ${pending.conflicts.length - 1}` : "";
  return (
    <View
      style={[p.pop, { top }, alignRight ? { right: 0 } : { left: 0 }]}
      accessibilityRole={"alertdialog" as any}
      accessibilityLabel="Conflito de horário"
    >
      <View style={[p.caret, alignRight ? { right: 22 } : { left: 22 }]} />
      <Text style={p.text}>
        <Text style={p.bold}>
          {c
            ? `Esse horário já tem ${firstName(c.patient_name)} (${hm(cStart)}–${hm(cStart + c.duration_min)})${more}.`
            : "Esse horário já está ocupado."}
        </Text>
        {" "}Encaixar mesmo assim?
      </Text>
      <Text style={p.small}>No encaixe, as duas consultas aparecem lado a lado.</Text>
      <View style={p.acts}>
        <Pressable onPress={onCancel} style={[p.btn, p.btnOutline]} accessibilityRole="button">
          <Text style={p.btnOutlineText}>Não mover</Text>
        </Pressable>
        <Pressable onPress={onFit} style={[p.btn, p.btnPrimary]} accessibilityRole="button">
          <Text style={p.btnPrimaryText}>Encaixar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Aviso no rodapé do card, com Desfazer ──────────────────

export const TOAST_MS = 9000;

export function AgendaToast({ toast, onClose }: { toast: GridToast | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  const error = toast.kind === "error";
  return (
    <View style={t.host} pointerEvents="box-none">
      <View style={[t.toast, error && t.toastError]} accessibilityRole={"status" as any} accessibilityLiveRegion="polite">
        <Text style={[t.msg, error && t.msgError]}>{toast.message}</Text>
        {toast.undo && (
          <Pressable onPress={toast.undo} style={t.undo} accessibilityRole="button">
            <Text style={t.undoText}>Desfazer</Text>
          </Pressable>
        )}
        <Pressable onPress={onClose} style={t.close} accessibilityRole="button" accessibilityLabel="Fechar aviso">
          <Text style={[t.closeText, error && t.msgError]}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Linha de "agora" ───────────────────────────────────────

export function NowLine({ top, label }: { top: number; label?: string }) {
  return (
    <View style={[l.now, { top }]} pointerEvents="none">
      <View style={l.dot} />
      {label ? <Text style={l.label}>{label}</Text> : null}
    </View>
  );
}

// ─── Legenda de status ──────────────────────────────────────

export function StatusLegend() {
  return (
    <View style={g.row}>
      {DENTAL_STATUS_ORDER.filter(k => k !== "cancelado").map(k => {
        const st = dentalStatus(k);
        return (
          <View key={k} style={g.item}>
            <View
              style={[
                g.swatch,
                { backgroundColor: st.bg, borderLeftColor: st.color },
                st.dashed && { borderColor: st.color, borderStyle: "dashed", borderWidth: 1, borderLeftWidth: 3 },
              ]}
            />
            <Text style={g.text}>{st.label}</Text>
          </View>
        );
      })}
      <Text style={[g.text, { color: C.ink3 }]}>Cancelados ficam fora da grade (ver na Lista)</Text>
    </View>
  );
}

const n = StyleSheet.create({
  block: { position: "absolute", borderRadius: 6, borderLeftWidth: 3, paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden", justifyContent: "center" },
  time: { fontSize: 10, color: C.ink2, fontFamily: Fonts.mono },
  name: { fontSize: 11.5, color: C.ink, fontWeight: "700" },
  proc: { fontSize: 11, color: C.ink2 },
  allergy: { color: C.red, fontWeight: "800" },
});

const p = StyleSheet.create({
  pop: {
    position: "absolute", zIndex: 12, width: 270, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.amber,
    borderRadius: 12, padding: 12, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
  },
  caret: {
    position: "absolute", top: -7, width: 12, height: 12, backgroundColor: C.bg2,
    borderLeftWidth: 1, borderTopWidth: 1, borderColor: C.amber, transform: [{ rotate: "45deg" }],
  },
  text: { fontSize: 13, color: C.ink, fontFamily: Fonts.body, marginBottom: 4 },
  bold: { fontWeight: "700" },
  small: { fontSize: 12, color: C.ink3, fontFamily: Fonts.body, marginBottom: 10 },
  acts: { flexDirection: "row", justifyContent: "flex-end", gap: 6 },
  btn: { height: 30, paddingHorizontal: 10, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  btnOutline: { borderColor: C.border, backgroundColor: "transparent" },
  btnOutlineText: { fontSize: 12, fontWeight: "600", color: C.ink, fontFamily: Fonts.body },
  btnPrimary: { backgroundColor: IS_DARK_MODE ? C.cyan : "#0891B2", borderColor: "transparent" },
  btnPrimaryText: { fontSize: 12, fontWeight: "700", color: PRI_INK, fontFamily: Fonts.body },
});

const t = StyleSheet.create({
  host: { position: "absolute", left: 0, right: 0, bottom: 14, alignItems: "center", zIndex: 30 },
  toast: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: TOAST_BG, borderRadius: 12,
    paddingVertical: 8, paddingLeft: 14, paddingRight: 8, maxWidth: "94%" as any,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
  },
  toastError: { backgroundColor: C.red },
  msg: { fontSize: 13, fontWeight: "500", color: TOAST_INK, fontFamily: Fonts.body, flexShrink: 1 },
  msgError: { color: "#ffffff" },
  undo: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  undoText: { fontSize: 13, fontWeight: "800", color: UNDO_INK, fontFamily: Fonts.body },
  close: { paddingHorizontal: 6, paddingVertical: 4 },
  closeText: { fontSize: 13, color: TOAST_INK, opacity: 0.6 },
});

const l = StyleSheet.create({
  now: { position: "absolute", left: -1, right: 0, height: 2, backgroundColor: C.red, zIndex: 4 },
  dot: { position: "absolute", left: -4, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },
  label: {
    position: "absolute", left: -50, top: -8, fontSize: 10, fontFamily: Fonts.mono, color: C.red,
    backgroundColor: C.bg2, paddingHorizontal: 3, borderRadius: 4,
  },
});

const g = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 14, rowGap: 6, marginVertical: 4 },
  item: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3, borderLeftWidth: 3 },
  text: { fontSize: 11.5, color: C.ink2, fontFamily: Fonts.body },
});
