// ─── useBracketDragAndDrop ────────────────────────────────────────────────
// HTML5 DnD para o bracket de karatê (web-only) — MESMA técnica do Kanban
// de CRM (components/admin/crm/kanban/useDragAndDrop.ts), generalizada.
//
// Por que uma variante própria em vez de importar o hook do Kanban:
//   O hook original é tipado especificamente para `LeadStatus` (string enum
//   de status de lead) tanto no payload de drop quanto no "hover target".
//   O bracket precisa trocar ATLETAS entre SLOTS identificados por
//   `matchId + side ("aka"|"shiro")` — um domínio diferente, não generalizável
//   sem tornar o hook do Kanban genérico (o que arriscaria quebrar o Kanban
//   em produção). Para não tocar no arquivo original, replicamos a MESMA
//   técnica (refs + setAttribute("draggable") + listeners nativos DOM +
//   fallback web-only) com tipos próprios de slot de bracket.
//
// Problema com RN Web (mesmo do Kanban): nem Pressable nem View propagam
// `draggable`/`onDragStart` pro DOM via props — por isso refs + DOM nativo.
//
// Fallback mobile: espelha a decisão do Kanban (useDragAndDrop.ts + KanbanView
// "Arrastar-e-soltar so funciona na versao web") — em mobile o drag fica
// DESABILITADO por completo (isWeb=false ⇒ hooks são no-op); a tela cobre
// esse caso com um aviso e mantém disponível o clique-para-vencedor (modo
// normal), que funciona em qualquer plataforma.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

// Identifica um slot único no bracket: qual match + qual lado (aka/shiro).
export type BracketSlotId = { matchId: string; side: "aka" | "shiro" };

function encodeSlot(slot: BracketSlotId): string {
  return `${slot.matchId}::${slot.side}`;
}
function decodeSlot(raw: string): BracketSlotId | null {
  const idx = raw.indexOf("::");
  if (idx < 0) return null;
  const side = raw.slice(idx + 2);
  if (side !== "aka" && side !== "shiro") return null;
  return { matchId: raw.slice(0, idx), side };
}

// ── Orchestrator ────────────────────────────────────────────────────────────
// onDrop recebe o slot de ORIGEM (quem foi arrastado) e o slot de DESTINO
// (onde foi solto). O caller decide a troca (swap) das duas posições.
export function useBracketDragAndDrop(
  onDrop: (from: BracketSlotId, to: BracketSlotId) => void
) {
  const [draggingSlot, setDraggingSlot] = useState<BracketSlotId | null>(null);
  const [hoverSlot, setHoverSlot] = useState<BracketSlotId | null>(null);

  const onSlotDragStart = useCallback((slot: BracketSlotId) => {
    setDraggingSlot(slot);
  }, []);

  const onSlotDragEnd = useCallback(() => {
    setDraggingSlot(null);
    setHoverSlot(null);
  }, []);

  const onHoverChange = useCallback((slot: BracketSlotId | null) => {
    setHoverSlot(slot);
  }, []);

  const handleDrop = useCallback((from: BracketSlotId, to: BracketSlotId) => {
    onDrop(from, to);
  }, [onDrop]);

  return {
    isWeb,
    draggingSlot,
    hoverSlot,
    onSlotDragStart,
    onSlotDragEnd,
    onHoverChange,
    onDrop: handleDrop,
  };
}

// ── Hook pra atleta arrastável dentro de um slot ────────────────────────────
export function useDraggableSlotRef(
  enabled: boolean,
  slot: BracketSlotId,
  onStart: (slot: BracketSlotId) => void,
  onEnd: () => void,
) {
  const ref = useRef<any>(null);
  const slotKey = encodeSlot(slot);

  useEffect(() => {
    if (!isWeb || !enabled) return;
    const el = ref.current as HTMLElement | null;
    if (!el || typeof el.setAttribute !== "function") return;

    el.setAttribute("draggable", "true");
    (el.style as any).cursor = "grab";
    (el.style as any).userSelect = "none";
    (el.style as any).WebkitUserSelect = "none";
    (el.style as any).WebkitUserDrag = "element";

    const handleStart = (e: DragEvent) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", slotKey);
        e.dataTransfer.effectAllowed = "move";
      }
      (el.style as any).cursor = "grabbing";
      onStart(slot);
    };
    const handleEnd = () => {
      (el.style as any).cursor = "grab";
      onEnd();
    };

    el.addEventListener("dragstart", handleStart);
    el.addEventListener("dragend", handleEnd);

    return () => {
      el.removeEventListener("dragstart", handleStart);
      el.removeEventListener("dragend", handleEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, slotKey, onStart, onEnd]);

  return ref;
}

// ── Hook pra slot como drop zone (qualquer slot de qualquer round) ─────────
export function useSlotDropZoneRef(
  slot: BracketSlotId,
  onDrop: (from: BracketSlotId, to: BracketSlotId) => void,
  onHover: (slot: BracketSlotId | null) => void,
) {
  const ref = useRef<any>(null);
  const slotKey = encodeSlot(slot);

  useEffect(() => {
    if (!isWeb) return;
    const el = ref.current as HTMLElement | null;
    if (!el || typeof el.addEventListener !== "function") return;

    const handleOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      onHover(slot);
    };
    const handleLeave = (e: DragEvent) => {
      const related = (e as any).relatedTarget as Node | null;
      if (related && el.contains(related)) return;
      onHover(null);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer?.getData("text/plain") || "";
      const from = decodeSlot(raw);
      if (from) onDrop(from, slot);
      onHover(null);
    };

    el.addEventListener("dragover", handleOver);
    el.addEventListener("dragleave", handleLeave);
    el.addEventListener("drop", handleDrop);

    return () => {
      el.removeEventListener("dragover", handleOver);
      el.removeEventListener("dragleave", handleLeave);
      el.removeEventListener("drop", handleDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey, onDrop, onHover]);

  return ref;
}
