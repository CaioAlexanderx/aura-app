import { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Obligation, CalendarResponse } from "@/components/screens/contabilidade/types";
import { getMEIObligations, getSNObligations } from "@/components/screens/contabilidade/types";

const STORAGE_KEY = "aura_obl_completed";

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

  // Persist completed obligations to localStorage
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(loadCompleted);

  const { data: calendarData, isLoading } = useQuery<CalendarResponse>({
    queryKey: ["obligations-calendar", companyId],
    queryFn: () => companiesApi.obligationsCalendar?.(companyId!) || companiesApi.obligations?.(companyId!),
    enabled: !!companyId && !!token && !isDemo,
    retry: 1,
    staleTime: 60000,
  });

  const result = useMemo(() => {
    const regime = calendarData?.company?.tax_regime || (company as any)?.tax_regime || "mei";
    const regimeLabel = regime === "mei" ? "MEI" : "Simples Nacional";
    const hasEmployee = calendarData?.company?.has_employee || false;

    let obligations: Obligation[];
    if (calendarData?.calendar?.length) {
      obligations = calendarData.calendar;
    } else {
      obligations = regime === "mei" ? getMEIObligations() : getSNObligations(hasEmployee);
    }

    // Apply persisted completions
    obligations = obligations.map(o => {
      if (localCompleted.has(o.code) && o.status !== "done") {
        return { ...o, status: "done" as const, checkpoint_done: o.checkpoint_total };
      }
      return o;
    });

    const actionable = obligations.filter(o => o.status !== "future");
    const total = actionable.length;
    const done = actionable.filter(o => o.status === "done").length;
    const pending = actionable.filter(o => o.status !== "done").length;
    const overdue = obligations.filter(o => o.status === "overdue" || o.alert_level === "overdue").length;
    const urgent = obligations.filter(o => ["critical", "warning"].includes(o.alert_level!)).sort((a, b) => (a.days_until_due || 999) - (b.days_until_due || 999));
    const auraResolve = obligations.filter(o => o.filter_label === "aura_resolve");
    const voceFaz = obligations.filter(o => o.filter_label === "voce_faz");

    return { obligations, regime, regimeLabel, hasEmployee, total, done, pending, overdue, urgent, auraResolve, voceFaz, isDemo: isDemo || false };
  }, [calendarData, company, isDemo, localCompleted]);

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
