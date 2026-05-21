// ─── useDragAndDrop ──────────────────────────────────────────────────────────
// Hook minimo de HTML5 DnD (web-only) pro Kanban.
// Mantem estado de "draggingId" e "hoverStatus" e callbacks para coluna alvo.
// Em mobile, retorna API no-op (Kanban fica list-only — Caio decidiu).
// ============================================================================

import { useCallback, useState } from "react";
import { Platform } from "react-native";
import type { LeadStatus } from "@/services/crmApi";

const isWeb = Platform.OS === "web";

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

  // Props pra spread no <View> da coluna
  const getColumnDropProps = useCallback((status: LeadStatus) => {
    if (!isWeb) return {};
    return {
      // @ts-ignore — props HTML5 aceitas no RN Web
      onDragOver: (e: any) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (hoverStatus !== status) setHoverStatus(status);
      },
      onDragLeave: () => {
        if (hoverStatus === status) setHoverStatus(null);
      },
      onDrop: (e: any) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain") || draggingId;
        if (id) onDrop(id, status);
        setDraggingId(null);
        setHoverStatus(null);
      },
    };
  }, [draggingId, hoverStatus, onDrop]);

  return {
    isWeb,
    draggingId,
    hoverStatus,
    onCardDragStart,
    onCardDragEnd,
    getColumnDropProps,
  };
}
