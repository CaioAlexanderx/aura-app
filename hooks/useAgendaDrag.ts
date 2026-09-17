// ============================================================
// useAgendaDrag — arrastar e redimensionar blocos da agenda (web)
//
// Por que pointer events: o react-native-web 0.19 descarta `draggable`,
// `onDragStart` e `onDrop` em View/Pressable (não estão em forwardedProps),
// então o arraste HTML5 da Semana nunca funcionou. Aqui o bloco (um <div>)
// recebe onPointerDown e o resto do gesto é ouvido na window, como no
// mockup aprovado (16/09/2026). Um gesto muda UMA coisa: mover muda só o
// horário (e a coluna); a borda de baixo muda só a duração.
//
// Toque (pointerType "touch") nunca arrasta: o toque abre o detalhe.
// Esc cancela. Nada é gravado aqui: ao soltar chama onDrop uma vez.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DRAG_THRESHOLD_PX,
  columnAt,
  moveStart,
  resizeDuration,
  type ColumnRect,
  type Geometry,
} from "@/utils/agendaGrid";

export type DragMode = "move" | "resize";

export interface DragItem {
  id: string;
  /** Coluna de origem (dia na Semana, cadeira no Dia). */
  colIdx: number;
  startMin: number;
  durMin: number;
}

export interface DragPreview extends DragItem {
  mode: DragMode;
  /** Coluna de onde o bloco saiu (colIdx é a coluna-alvo). */
  fromCol: number;
}

export interface AgendaDragOptions {
  enabled: boolean;
  geometry: Geometry;
  /** Retângulos das colunas na tela, na ordem de colIdx (lidos a cada movimento: acompanham a rolagem). */
  getColumnRects: () => ColumnRect[];
  /** Pode soltar na coluna `to` vindo de `from`? Padrão: sim. */
  canEnterColumn?: (from: number, to: number) => boolean;
  /** Chamado ao soltar, só se algo mudou. */
  onDrop: (item: DragItem, preview: DragPreview) => void;
}

/** Subconjunto do PointerEvent do React/DOM que o hook usa. */
export interface PointerLike {
  pointerType?: string;
  button?: number;
  clientX: number;
  clientY: number;
  currentTarget: any;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

interface Session {
  item: DragItem;
  mode: DragMode;
  x: number;
  y: number;
  grabOffsetY: number;
  started: boolean;
  /** Já desenhou o fantasma ao menos uma vez. */
  shown: boolean;
  last: DragPreview;
}

function setBodyGesture(mode: DragMode | null) {
  if (typeof document === "undefined" || !document.body) return;
  const st = document.body.style as any;
  if (!mode) {
    st.cursor = "";
    st.userSelect = "";
    st.webkitUserSelect = "";
    return;
  }
  st.cursor = mode === "resize" ? "ns-resize" : "grabbing";
  st.userSelect = "none";
  st.webkitUserSelect = "none";
}

export function useAgendaDrag(opts: AgendaDragOptions) {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const session = useRef<Session | null>(null);
  const detach = useRef<(() => void) | null>(null);
  const suppressClickUntil = useRef(0);

  const finish = useCallback((commit: boolean) => {
    const s = session.current;
    session.current = null;
    detach.current?.();
    detach.current = null;
    setBodyGesture(null);
    if (!s) return;
    if (!s.started) return; // clique simples: o onClick do bloco cuida
    // O click do navegador vem logo depois do pointerup: não abrir o detalhe.
    suppressClickUntil.current = Date.now() + 500;
    setPreview(null);
    if (!commit) return;
    const p = s.last;
    const it = s.item;
    if (p.colIdx === it.colIdx && p.startMin === it.startMin && p.durMin === it.durMin) return;
    optsRef.current.onDrop(it, p);
  }, []);

  const handleMove = useCallback((ev: { clientX: number; clientY: number }) => {
    const s = session.current;
    if (!s) return;
    const o = optsRef.current;
    if (!s.started) {
      if (Math.hypot(ev.clientX - s.x, ev.clientY - s.y) < DRAG_THRESHOLD_PX) return;
      s.started = true;
      setBodyGesture(s.mode);
    }
    const rects = o.getColumnRects();
    let col = s.item.colIdx;
    if (s.mode === "move") {
      const hit = columnAt(ev.clientX, rects);
      if (hit >= 0 && (hit === col || !o.canEnterColumn || o.canEnterColumn(col, hit))) col = hit;
    }
    const r = rects[col];
    if (!r) return;
    const y = ev.clientY - r.top;
    const next: DragPreview =
      s.mode === "move"
        ? { ...s.item, mode: "move", fromCol: s.item.colIdx, colIdx: col, startMin: moveStart(y, s.grabOffsetY, s.item.durMin, o.geometry) }
        : { ...s.item, mode: "resize", fromCol: s.item.colIdx, durMin: resizeDuration(y, s.item.startMin, o.geometry) };
    const l = s.last;
    const changed = !s.shown || l.colIdx !== next.colIdx || l.startMin !== next.startMin || l.durMin !== next.durMin;
    s.last = next;
    s.shown = true;
    if (changed) setPreview(next);
  }, []);

  const begin = useCallback((e: PointerLike, item: DragItem, mode: DragMode) => {
    const o = optsRef.current;
    if (!o.enabled) return false;
    if (e.pointerType === "touch") return false;
    if (e.button !== undefined && e.button !== 0) return false;
    if (typeof window === "undefined") return false;
    finish(false);
    let grabOffsetY = 0;
    try {
      const rect = e.currentTarget?.getBoundingClientRect?.();
      if (rect) grabOffsetY = e.clientY - rect.top;
    } catch { /* sem DOM: fica 0 */ }
    session.current = {
      item, mode, x: e.clientX, y: e.clientY, grabOffsetY, started: false, shown: false,
      last: { ...item, mode, fromCol: item.colIdx },
    };
    // Sem seleção de texto nem arraste nativo de imagem durante o gesto.
    // (O click continua chegando: preventDefault no pointerdown só corta os eventos de mouse de compatibilidade.)
    e.preventDefault?.();
    if (mode === "resize") e.stopPropagation?.();

    const onMove = (ev: PointerEvent) => handleMove(ev);
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") finish(false); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onCancel);
    detach.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onCancel);
    };
    return true;
  }, [finish, handleMove]);

  useEffect(() => () => finish(false), [finish]);

  /** true se o click que acabou de chegar é o fim de um arraste (não abrir o detalhe). */
  const consumeClick = useCallback(() => Date.now() < suppressClickUntil.current, []);

  return {
    preview,
    onMovePointerDown: (e: PointerLike, item: DragItem) => begin(e, item, "move"),
    onResizePointerDown: (e: PointerLike, item: DragItem) => begin(e, item, "resize"),
    cancel: () => finish(false),
    consumeClick,
  };
}
