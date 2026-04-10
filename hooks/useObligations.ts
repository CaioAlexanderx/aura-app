import { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Obligation, CalendarResponse } from "@/components/screens/contabilidade/types";
import { getMEIObligations, getSNObligations } from "@/components/screens/contabilidade/types";

const STORAGE_KEY = "aura_obl_completed";

// N6 fix: normaliza qualquer valor de regime para 'mei' | 'simples'
// DB pode ter: 'mei', 'simples', 'simples_nacional', 'lucro_presumido', 'lucro_real'
function normalizeRegime(raw: string | null | undefined): 'mei' | 'simples' {
  if ((raw || '').toLowerCase().trim() === 'mei') return 'mei';
  return 'simples'; // trata SN, lucro presumido, etc. como SN
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

  // Query principal: calendario de obrigacoes
  const { data: calendarData, isLoading: calendarLoading } = useQuery<CalendarResponse>({
    queryKey: ["obligations-calendar", companyId],
    queryFn: () => companiesApi.obligationsCalendar?.(companyId!) || companiesApi.obligations?.(companyId!),
    enabled: !!companyId && !!token && !isDemo,
    retry: 1,
    staleTime: 60000,
  });

  // N6 fix: fallback query para perfil da empresa (sempre inclui tax_regime)
  // O endpoint /companies/:id/profile retorna tax_regime com fallback 'simples' no backend
  const { data: profileData, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["company-profile", companyId],
    queryFn: () => companiesApi.getProfile(companyId!),
    enabled: !!companyId && !!token && !isDemo,
    staleTime: 5 * 60 * 1000, // 5 min — regime muda raramente
  });

  const isLoading = calendarLoading || profileLoading;

  const result = useMemo(() => {
    // N6 fix: cadeia de fallback robusta + normalizacao
    // 1. API calendar (pode retornar tax_regime)
    // 2. API profile (sempre retorna — backend tem fallback 'simples')
    // 3. Auth store (nao tem tax_regime hoje, mas por seguranca)
    // 4. Ultimo fallback: 'simples' (mais seguro que 'mei' para desconhecido)
    const rawRegime =
      calendarData?.company?.tax_regime ||
      profileData?.tax_regime ||
      (company as any)?.tax_regime ||
      null;

    const regime = normalizeRegime(rawRegime);
    const regimeLabel = regime === "mei" ? "MEI" : "Simples Nacional";
    const hasEmployee = calendarData?.company?.has_employee || profileData?.has_employee || false;

    let obligations: Obligation[];
    if (calendarData?.calendar?.length) {
      obligations = calendarData.calendar;
    } else {
      obligations = regime === "mei" ? getMEIObligations() : getSNObligations(hasEmployee);
    }

    // Aplicar conclusoes persistidas
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
