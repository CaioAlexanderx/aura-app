// ─── useLossReasonGate ───────────────────────────────────────────────────────
// Fase 0 — C0.1 (16/09/2026). Orquestra a abertura do LossReasonModal a partir
// de QUALQUER caminho que mova um lead pra "Perdido" (kanban DnD, fila/modo
// de trabalho, batch). Padrao promise-based: o caller faz
// `await requestReason({ leadName })` e so segue com a mutation se o
// resultado nao vier null (usuario confirmou "Cancelar" ou fechou o modal).
//
// Nao cobre o InteractionModal — la o motivo e um bloco INLINE do proprio
// modal (ja tem um passo de "Novo status" + observacao), entao nao faz
// sentido empilhar um segundo modal por cima.
// ============================================================================

import { useCallback, useRef, useState } from "react";
import type { LossReasonResult } from "../components/LossReasonModal";

export type LossReasonTarget = { leadName?: string; count?: number };

export function useLossReasonGate() {
  const [target, setTarget] = useState<LossReasonTarget | null>(null);
  const resolverRef = useRef<((r: LossReasonResult | null) => void) | null>(null);

  const requestReason = useCallback((t: LossReasonTarget): Promise<LossReasonResult | null> => {
    setTarget(t);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const confirm = useCallback((result: LossReasonResult) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setTarget(null);
  }, []);

  const cancel = useCallback(() => {
    resolverRef.current?.(null);
    resolverRef.current = null;
    setTarget(null);
  }, []);

  return { target, isOpen: !!target, requestReason, confirm, cancel };
}
