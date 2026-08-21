// ─── useBoardDragAndDrop ──────────────────────────────────────────────────
// DnD do BOARD DO DIA (kotos): arrasta uma CATEGORIA de uma coluna (koto ou
// "não alocadas") e solta em outra. Mesma técnica DOM-nativa do
// useBracketDragAndDrop (que por sua vez espelha o Kanban do CRM): refs +
// setAttribute("draggable") + listeners nativos, porque RN Web não propaga
// draggable/onDragStart via props.
//
// Domínio diferente do bracket (lá são slots aka/shiro dentro de matches;
// aqui são categorias entre colunas), por isso hook próprio — mesma decisão
// documentada no cabeçalho do hook do bracket.
//
// Fallback mobile: em nativo o DnD é no-op; a tela oferece o seletor de koto
// por toque (menu), que funciona em qualquer plataforma.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

/** null = coluna "não alocadas". */
export type BoardColumnId = string | null;

export function useBoardDragAndDrop(
  onDropCategory: (categoryId: string, toColumn: BoardColumnId) => void
) {
  const [draggingCategory, setDraggingCategory] = useState<string | null>(null);
  const [hoverColumn, setHoverColumn] = useState<BoardColumnId | undefined>(undefined);

  const onDragStart = useCallback((categoryId: string) => setDraggingCategory(categoryId), []);
  const onDragEnd = useCallback(() => {
    setDraggingCategory(null);
    setHoverColumn(undefined);
  }, []);
  const onHoverChange = useCallback((col: BoardColumnId | undefined) => setHoverColumn(col), []);
  const handleDrop = useCallback((categoryId: string, toColumn: BoardColumnId) => {
    onDropCategory(categoryId, toColumn);
  }, [onDropCategory]);

  return { isWeb, draggingCategory, hoverColumn, onDragStart, onDragEnd, onHoverChange, onDrop: handleDrop };
}

/** Torna o card da categoria arrastável (web). */
export function useDraggableCategoryRef(
  enabled: boolean,
  categoryId: string,
  onStart: (categoryId: string) => void,
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
        e.dataTransfer.setData("text/plain", categoryId);
        e.dataTransfer.effectAllowed = "move";
      }
      (el.style as any).cursor = "grabbing";
      onStart(categoryId);
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
  }, [enabled, categoryId, onStart, onEnd]);

  return ref;
}

/** Torna a coluna (koto ou "não alocadas") uma drop zone (web). */
export function useColumnDropZoneRef(
  column: BoardColumnId,
  onDrop: (categoryId: string, toColumn: BoardColumnId) => void,
  onHover: (col: BoardColumnId | undefined) => void,
) {
  const ref = useRef<any>(null);
  const key = column === null ? "__unassigned__" : column;
  useEffect(() => {
    if (!isWeb) return;
    const el = ref.current as HTMLElement | null;
    if (!el || typeof el.addEventListener !== "function") return;

    const handleOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      onHover(column);
    };
    const handleLeave = (e: DragEvent) => {
      const related = (e as any).relatedTarget as Node | null;
      if (related && el.contains(related)) return;
      onHover(undefined);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const categoryId = e.dataTransfer?.getData("text/plain") || "";
      if (categoryId) onDrop(categoryId, column);
      onHover(undefined);
    };

    el.addEventListener("dragover", handleOver);
    el.addEventListener("dragleave", handleLeave);
    el.addEventListener("drop", handleDrop);
    return () => {
      el.removeEventListener("dragover", handleOver);
      el.removeEventListener("dragleave", handleLeave);
      el.removeEventListener("drop", handleDrop);
    };
  }, [key, column, onDrop, onHover]);

  return ref;
}
