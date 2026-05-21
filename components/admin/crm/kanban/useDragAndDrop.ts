// ─── useDragAndDrop ──────────────────────────────────────────────────────────
// HTML5 DnD para o Kanban (web-only).
//
// Problema com RN Web: nem Pressable nem View propagam `draggable`/`onDragStart`
// pro DOM via props. Por isso usamos refs + setAttribute + addEventListener.
// O hook expõe 3 APIs:
//   1. useDragAndDrop(onDrop)      — orchestrator de state (draggingId, hover)
//   2. useDraggableCardRef(...)    — ref pra anexar num card que vira draggable
//   3. useDropZoneRef(...)         — ref pra anexar numa coluna como drop target
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { LeadStatus } from "@/services/crmApi";

const isWeb = Platform.OS === "web";

// ── Orchestrator ────────────────────────────────────────────────────────────

export function useDragAndDrop(onDrop: (leadId: string, toStatus: LeadStatus) => void) {
  const [draggingId, setDraggingId]   = useState<string | null>(null);
  const [hoverStatus, setHoverStatus] = useState<LeadStatus | null>(null);

  const onCardDragStart = useCallback((id: string) => {
    setDraggingId(id);
  }, []);

  const onCardDragEnd = useCallback(() => {
    setDraggingId(null);
    setHoverStatus(null);
  }, []);

  const onHoverChange = useCallback((status: LeadStatus | null) => {
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

// ── Hook pra card draggable ────────────────────────────────────────────────

export function useDraggableCardRef(
  enabled: boolean,
  leadId: string,
  onStart: (id: string) => void,
  onEnd: () => void,
) {
  const ref = useRef<any>(null);

  useEffect(() => {
    if (!isWeb || !enabled) return;
    const el = ref.current as HTMLElement | null;
    if (!el || typeof el.setAttribute !== "function") return;

    el.setAttribute("draggable", "true");
    // Garante que o navegador entende o elemento como draggable nativo
    (el.style as any).cursor = "grab";
    (el.style as any).userSelect = "none";
    (el.style as any).WebkitUserSelect = "none";
    (el.style as any).WebkitUserDrag = "element";

    const handleStart = (e: DragEvent) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", leadId);
        e.dataTransfer.effectAllowed = "move";
      }
      (el.style as any).cursor = "grabbing";
      onStart(leadId);
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
  }, [enabled, leadId, onStart, onEnd]);

  return ref;
}

// ── Hook pra coluna como drop zone ─────────────────────────────────────────

export function useDropZoneRef(
  status: LeadStatus,
  onDrop: (leadId: string, toStatus: LeadStatus) => void,
  onHover: (s: LeadStatus | null) => void,
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
