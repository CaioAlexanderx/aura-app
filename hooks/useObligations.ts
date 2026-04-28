import { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Obligation, CalendarResponse } from "@/components/screens/contabilidade/types";
import { getMEIObligations, getSNObligations } from "@/components/screens/contabilidade/types";

const STORAGE_KEY = "aura_obl_completed";

// PR36 (2026-04-28): regime cobre 5 valores reais (MEI / Simples / Lucro Presumido /
// Lucro Real / Pessoa Fisica). Antes colapsava tudo em 'simples'. Backend
// migrations 075-076 seedam obrigacoes desses regimes - frontend agora as exibe.
export type FiscalRegime = 'mei' | 'simples' | 'lucro_presumido' | 'lucro_real' | 'pessoa_fisica';

function normalizeRegime(raw: string | null | undefined): FiscalRegime {
  const v = (raw || '').toLowerCase().trim();
  if (v === 'mei') return 'mei';
  if (v === 'lucro_presumido' || v === 'presumido') return 'lucro_presumido';
  if (v === 'lucro_real' || v === 'real') return 'lucro_real';
  if (v === 'pessoa_fisica' || v === 'autonomo') return 'pessoa_fisica';
  // simples_nacional, simples, ou desconhecido => Simples Nacional como default seguro
  return 'simples';
}

function regimeLabelOf(r: FiscalRegime): string {
  switch (r) {
    case 'mei': return 'MEI';
    case 'simples': return 'Simples Nacional';
    case 'lucro_presumido': return 'Lucro Presumido';
    case 'lucro_real': return 'Lucro Real';
    case 'pessoa_fisica': return 'Pessoa Fisica (Autonomo)';
  }
}

function loadCompleted(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
}

function saveCompleted(set: Set<string>) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); } catch {}
}

export function useObligations() {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;

  const [localCompleted, setLocalCompleted] = useState<Set<string>>(loadCompleted);

  const { data: calendarData, isLoading: calendarLoading } = useQuery<CalendarResponse>({
    queryKey: ["obligations-calendar", companyId],
    queryFn: () => companiesApi.obligationsCalendar?.(companyId!) || companiesApi.obligations?.(companyId!),
    enabled: !!companyId && !!token && !isDemo,
    retry: 1,
    staleTime: 60000,
  });

  const { data: profileData, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["company-profile", companyId],
    queryFn: () => companiesApi.getProfile(companyId!),
    enabled: !!companyId && !!token && !isDemo,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = calendarLoading || profileLoading;

  const result = useMemo(() => {
    const rawRegime =
      calendarData?.company?.tax_regime ||
      profileData?.tax_regime ||
      (company as any)?.tax_regime ||
      null;

    const regime = normalizeRegime(rawRegime);
    const regimeLabel = regimeLabelOf(regime);
    const hasEmployee = calendarData?.company?.has_employee || profileData?.has_employee || false;

    let obligations: Obligation[];
    if (calendarData?.calendar?.length) {
      // Backend ja retornou calendario (incluindo Lucro Presumido/Real/Saude se aplicavel).
      obligations = calendarData.calendar;
    } else {
      // Fallback hardcoded so cobre MEI e Simples. Pra Presumido/Real/PF, sem fallback -
      // se backend nao responder, lista fica vazia (esperado, pois nao temos hardcode pra esses).
      // PR36 TODO: remover fallback completamente apos validar backend resolver.
      if (regime === 'mei') obligations = getMEIObligations();
      else if (regime === 'simples') obligations = getSNObligations(hasEmployee);
      else obligations = []; // Lucro Presumido/Real/PF: depende do backend
    }

    obligations = obligations.map(o => {
      if (localCompleted.has(o.code) && o.status !== "done") {
        return { ...o, status: "done" as const, checkpoint_done: o.checkpoint_total };
      }
      return o;
    });

    const actionable = obligations.filter(o => o.status !== "future");
    const total    = actionable.length;
    const done     = actionable.filter(o => o.status === "done").length;
    const pending  = actionable.filter(o => o.status !== "done").length;
    const overdue  = obligations.filter(o => o.status === "overdue" || o.alert_level === "overdue").length;
    const urgent   = obligations.filter(o => ["critical", "warning"].includes(o.alert_level!)).sort((a, b) => (a.days_until_due || 999) - (b.days_until_due || 999));
    const auraResolve = obligations.filter(o => o.filter_label === "aura_resolve");
    const voceFaz    = obligations.filter(o => o.filter_label === "voce_faz");

    return { obligations, regime, regimeLabel, hasEmployee, total, done, pending, overdue, urgent, auraResolve, voceFaz, isDemo: isDemo || false };
  }, [calendarData, profileData, company, isDemo, localCompleted]);

  const completeCheckpoint = useCallback((oblCode: string) => {
    setLocalCompleted(prev => {
      const next = new Set(prev).add(oblCode);
      saveCompleted(next);
      return next;
    });
    toast.success("Obrigacao concluida!");
    if (companyId && !isDemo) {
      companiesApi.completeCheckpoint?.(companyId, oblCode)
        .then(() => qc.invalidateQueries({ queryKey: ["obligations-calendar", companyId] }))
        .catch(() => {});
    }
  }, [companyId, isDemo, qc]);

  return { ...result, isLoading, completeCheckpoint };
}
