// hooks/useFinanceGoal.ts
//
// F3 (24/08/2026) — meta de gasto do negocio, configuravel pelo usuario.
//
// A barra do ResumoHero mostra quanto da receita foi consumida por despesa e
// muda de cor conforme se aproxima (ou passa) dessa meta. Antes o Financeiro
// usava HEALTH_TARGETS.margin_pct — um numero fixo, igual pra salao, mercado e
// prestador de servico, que nao representa a realidade de ninguem.
//
// Persistencia: localStorage por empresa, mesmo padrao do CollapsibleSection.
// E deliberadamente local por ora — a proxima onda leva a meta pro backend
// (settings da empresa) pra sincronizar entre dispositivos e alimentar os
// insights server-side. Enquanto isso o usuario ja configura e ve valer.

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";

var STORAGE_PREFIX = "aura.financeiro.meta.gasto.";

// 70% e um teto conservador pra pequeno negocio: sobra ~30% pra pro-labore,
// impostos nao provisionados e reinvestimento. Serve como ponto de partida
// ate o usuario calibrar com a realidade dele.
export var DEFAULT_GOAL_PCT = 70;
export var GOAL_MIN = 30;
export var GOAL_MAX = 95;

function storageKey(companyId?: string | null): string {
  return STORAGE_PREFIX + (companyId || "default");
}

function readGoal(companyId?: string | null): { value: number; custom: boolean } {
  if (typeof window === "undefined" || !window.localStorage) {
    return { value: DEFAULT_GOAL_PCT, custom: false };
  }
  try {
    var raw = window.localStorage.getItem(storageKey(companyId));
    if (raw === null) return { value: DEFAULT_GOAL_PCT, custom: false };
    var parsed = parseInt(raw, 10);
    if (!isFinite(parsed) || parsed < GOAL_MIN || parsed > GOAL_MAX) {
      return { value: DEFAULT_GOAL_PCT, custom: false };
    }
    return { value: parsed, custom: true };
  } catch {
    return { value: DEFAULT_GOAL_PCT, custom: false };
  }
}

export function useFinanceGoal() {
  var companyId = useAuthStore(function(state) { return state.company?.id; });
  var [state, setState] = useState(function() { return readGoal(companyId); });

  // Trocar de empresa (switcher multi-CNPJ) precisa recarregar a meta daquela
  // empresa — senao o usuario ve a meta da anterior aplicada nos numeros novos.
  useEffect(function() {
    setState(readGoal(companyId));
  }, [companyId]);

  var setGoal = useCallback(function(next: number) {
    var clamped = Math.max(GOAL_MIN, Math.min(GOAL_MAX, Math.round(next)));
    setState({ value: clamped, custom: true });
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(storageKey(companyId), String(clamped));
    } catch {
      // storage cheio ou desabilitado — meta segue valendo na sessao
    }
  }, [companyId]);

  return {
    goalPct: state.value,
    // false = ainda no default sugerido; a UI usa isso pra convidar a calibrar
    isCustom: state.custom,
    setGoal: setGoal,
  };
}

export default useFinanceGoal;
