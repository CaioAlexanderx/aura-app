// ─── useStudioKanbanDnD ───────────────────────────────────────────────────────
// Hook genérico de HTML5 DnD para o KDS do Studio (web-only).
//
// Derivado de components/admin/crm/kanban/useDragAndDrop.ts —
// sem qualquer import de crmApi ou LeadStatus.
//
// API pública:
//   1. useStudioKanbanDnD<S>(onDrop)   — orchestrator de state (draggingId, hoverStatus)
//   2. useDraggableCardRef(...)        — ref pra anexar num card que vira draggable
//   3. useDropZoneRef(...)             — ref pra anexar numa coluna como drop target
//
// O tipo S é genérico (default: string) — use StudioProductionStatus no KDS.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

// ── Orchestrator ─────────────────────────────────────────────────────────────

export function useStudioKanbanDnD<S extends string = string>(
  onDrop: (orderId: string, toStatus: S) => void,
) {
  const [draggingId, setDraggingId]   = useState<string | null>(null);
  const [hoverStatus, setHoverStatus] = useState<S | null>(null);

  const onCardDragStart = useCallback((id: string) => {
    setDraggingId(id);
  }, []);

  const onCardDragEnd = useCallback(() => {
    setDraggingId(null);
    setHoverStatus(null);
  }, []);

  const onHoverChange = useCallback((status: S | null) => {
    setHoverStatus(status);
  }, []);

  return {
    isWeb,
    draggingId,
    hoverStatus,
    onCardDragStart,
    onCardDragEnd,
    onHoverChange,
    onDrop,
  };
}

// ── Hook pra card draggable ───────────────────────────────────────────────────

export function useDraggableCardRef(
  enabled: boolean,
  cardId: string,
  onStart: (id: string) => void,
  onEnd: () => void,
) {
  const ref = useRef<any>(null);

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
        e.dataTransfer.setData("text/plain", cardId);
        e.dataTransfer.effectAllowed = "move";
      }
      (el.style as any).cursor = "grabbing";
      onStart(cardId);
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
  }, [enabled, cardId, onStart, onEnd]);

  return ref;
}

// ── Hook pra coluna como drop zone ────────────────────────────────────────────

export function useDropZoneRef<S extends string = string>(
  status: S,
  onDrop: (orderId: string, toStatus: S) => void,
  onHover: (s: S | null) => void,
) {
  const ref = useRef<any>(null);

  useEffect(() => {
    if (!isWeb) return;
    const el = ref.current as HTMLElement | null;
    if (!el || typeof el.addEventListener !== "function") return;

    const handleOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      onHover(status);
    };
    const handleLeave = (e: DragEvent) => {
      // Evita "flicker" quando o pointer cruza nodes filhos
      const related = (e as any).relatedTarget as Node | null;
      if (related && el.contains(related)) return;
      onHover(null);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer?.getData("text/plain") || "";
      if (id) onDrop(id, status);
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
  }, [status, onDrop, onHover]);

  return ref;
}
