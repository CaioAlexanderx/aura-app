import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi, dashboardApi } from "@/services/api";
import { meAggregatesApi } from "@/services/meAggregates";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Transaction, DreData, WithdrawalData, PeriodKey } from "@/components/screens/financeiro/types";
import { getPeriodRange, getPreviousPeriodRange } from "@/components/screens/financeiro/types";

function mapApiTransaction(t: any): Transaction {
  return {
    id: t.id || String(Math.random()),
    date: t.date || (t.created_at ? new Date(t.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "---"),
    desc: t.description || t.desc || "Lancamento",
    type: t.type === "expense" ? "expense" : "income",
    category: t.category || "Outros",
    amount: parseFloat(t.amount) || 0,
    status: t.status === "pending" ? "pending" : "confirmed",
    source: t.source || "manual",
    due_date: t.due_date || null,
    created_at: t.created_at || null,
    paid_at: t.paid_at || null,
    payment_method: t.payment_method || null,
    employee_id: t.employee_id || null,
    employee_name: t.employee_name || null,
    idempotency_key: t.idempotency_key || null,
    // MULTICNPJ Onda 2.2: campos extras passam pelo cast — frontend usa
    // (t as any).company_name pra exibir badge da loja na lista.
    company_id: t.company_id || null,
    company_name: t.company_name || null,
  } as Transaction;
}

function safePeriod(raw: any): string {
  if (!raw) return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  if (typeof raw === "string") return raw;
  if (raw.from && raw.to) { try { return new Date(raw.from).toLocaleDateString("pt-BR") + " - " + new Date(raw.to).toLocaleDateString("pt-BR"); } catch { return "Periodo atual"; } }
  return "Periodo atual";
}

function toISODate(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function useTransactionsApi(activeTab?: number, period?: PeriodKey, customStart?: string, customEnd?: string) {
  // MULTICNPJ Onda 2.2: detecta consolidatedView e ramifica entre
  // /companies/:id/transactions (per-company) e /me/transactions (consolidated).
  // Mutations (create/delete) so funcionam em modo per-company — em consolidated
  // o usuario precisa trocar pra empresa especifica antes de criar/editar.
  // DRE e Withdrawal tambem so existem em per-company por enquanto.
  var { company, token, isDemo, consolidatedView } = useAuthStore();
  var qc = useQueryClient();
  var companyId = company?.id;

  var periodRange = useMemo(function() {
    var p = period || "month";
    var range = getPeriodRange(p, customStart, customEnd);
    return { start: toISODate(range.start), end: toISODate(range.end) };
  }, [period, customStart, customEnd]);

  var prevRange = useMemo(function() {
    var p = period || "month";
    var prev = getPreviousPeriodRange(p, customStart, customEnd);
    if (!prev) return null;
    return { start: toISODate(prev.start), end: toISODate(prev.end) };
  }, [period, customStart, customEnd]);

  var currentMonthRange = useMemo(function() {
    var range = getPeriodRange("month");
    return { start: toISODate(range.start), end: toISODate(range.end) };
  }, []);

  // Query principal de transactions — ramifica entre per-company e consolidated
  var { data: apiTx, isLoading: isLoadingTx } = useQuery({
    queryKey: consolidatedView
      ? ["me-transactions", periodRange.start, periodRange.end]
      : ["transactions", companyId, periodRange.start, periodRange.end],
    queryFn: function() {
      if (consolidatedView) {
        return meAggregatesApi.transactions({
          start: periodRange.start,
          end: periodRange.end,
          limit: 5000,
        });
      }
      var params = "limit=5000&start=" + periodRange.start + "&end=" + periodRange.end;
      return companiesApi.transactions(companyId!, params);
    },
    enabled: (consolidatedView || !!companyId) && !!token && !isDemo,
    retry: 1, staleTime: 30000,
  });

  // Periodo anterior (so per-company por ora; consolidated nao tem comparativo ainda)
  var { data: apiPrevTx } = useQuery({
    queryKey: consolidatedView
      ? ["me-transactions-prev", prevRange?.start, prevRange?.end]
      : ["transactions-prev", companyId, prevRange?.start, prevRange?.end],
    queryFn: function() {
      if (consolidatedView) {
        return meAggregatesApi.transactions({
          start: prevRange!.start,
          end: prevRange!.end,
          limit: 1,
        });
      }
      var params = "limit=1&start=" + prevRange!.start + "&end=" + prevRange!.end;
      return companiesApi.transactions(companyId!, params);
    },
    enabled: (consolidatedView || !!companyId) && !!token && !isDemo && !!prevRange,
    retry: 1, staleTime: 120000,
  });

  var monthQueryEnabled = (consolidatedView || !!companyId) && !!token && !isDemo && period !== "month";
  var { data: apiCurrentMonth } = useQuery({
    queryKey: consolidatedView
      ? ["me-current-month-expenses", currentMonthRange.start, currentMonthRange.end]
      : ["current-month-expenses", companyId, currentMonthRange.start, currentMonthRange.end],
    queryFn: function() {
      if (consolidatedView) {
        return meAggregatesApi.transactions({
          start: currentMonthRange.start,
          end: currentMonthRange.end,
          type: "expense",
          limit: 1,
        });
      }
      var params = "limit=1&type=expense&start=" + currentMonthRange.start + "&end=" + currentMonthRange.end;
      return companiesApi.transactions(companyId!, params);
    },
    enabled: monthQueryEnabled,
    retry: 1, staleTime: 60000,
  });

  // DRE e Withdrawal so em modo per-company por enquanto. Em consolidated
  // a tela exibe placeholder "Disponivel ao selecionar empresa".
  var { data: apiDre } = useQuery({
    queryKey: ["dre", companyId],
    queryFn: function() { return companiesApi.dre(companyId!); },
    enabled: !consolidatedView && !!companyId && !!token && !isDemo && activeTab === 2,
    retry: 1,
  });

  var { data: apiWithdrawal } = useQuery({
    queryKey: ["withdrawal", companyId],
    queryFn: function() { return dashboardApi.summary(companyId!); },
    enabled: !consolidatedView && !!companyId && !!token && !isDemo && activeTab === 3,
    retry: 1,
  });

  var transactions: Transaction[] = useMemo(function() {
    if (isDemo) return [];
    var arr = apiTx?.transactions || apiTx?.rows || apiTx;
    if (!(arr instanceof Array)) return [];
    var mapped = arr.map(mapApiTransaction);
    mapped.sort(function(a: any, b: any) {
      var da = a.due_date || a.created_at || "";
      var db2 = b.due_date || b.created_at || "";
      return db2.localeCompare(da);
    });
    return mapped;
  }, [apiTx, isDemo]);

  var summary = useMemo(function() {
    var income = apiTx?.summary?.income != null ? parseFloat(apiTx.summary.income) : transactions.filter(function(t) { return t.type === "income" && t.status === "confirmed"; }).reduce(function(s, t) { return s + t.amount; }, 0);
    var expenses = apiTx?.summary?.expenses != null ? parseFloat(apiTx.summary.expenses) : transactions.filter(function(t) { return t.type === "expense" && t.status === "confirmed"; }).reduce(function(s, t) { return s + t.amount; }, 0);
    var pendingIncome = apiTx?.summary?.pending_income != null ? parseFloat(apiTx.summary.pending_income) : transactions.filter(function(t) { return t.type === "income" && t.status === "pending"; }).reduce(function(s, t) { return s + t.amount; }, 0);
    var pendingExpenses = apiTx?.summary?.pending_expenses != null ? parseFloat(apiTx.summary.pending_expenses) : transactions.filter(function(t) { return t.type === "expense" && t.status === "pending"; }).reduce(function(s, t) { return s + t.amount; }, 0);
    var gap = apiTx?.summary?.gap != null ? parseFloat(apiTx.summary.gap) : 0;
    return { income: income, expenses: expenses, balance: income - expenses, gap: gap, pendingIncome: pendingIncome, pendingExpenses: pendingExpenses };
  }, [apiTx, transactions]);

  var previousSummary = useMemo(function() {
    if (!apiPrevTx?.summary) return null;
    var income = parseFloat(apiPrevTx.summary.income) || 0;
    var expenses = parseFloat(apiPrevTx.summary.expenses) || 0;
    return { income: income, expenses: expenses, balance: income - expenses };
  }, [apiPrevTx]);

  var currentMonthExpenses = useMemo(function() {
    if (period === "month") {
      var exp = transactions.filter(function(t) { return t.type === "expense"; });
      return { count: exp.length, total: exp.reduce(function(s, t) { return s + t.amount; }, 0) };
    }
    var total = parseFloat(apiCurrentMonth?.summary?.expenses) || 0;
    var count = apiCurrentMonth?.total || 0;
    return { count: count, total: total };
  }, [apiCurrentMonth, period, transactions]);

  var dreData: DreData | null = useMemo(function() {
    var raw = apiDre;
    if (!raw || (!raw.totalIncome && !raw.income && !raw.total_income)) return null;
    return { period: safePeriod(raw.period), income: Array.isArray(raw.income) ? raw.income : [], expenses: Array.isArray(raw.expenses) ? raw.expenses : [], totalIncome: parseFloat(raw.totalIncome || raw.total_income) || 0, totalExpenses: parseFloat(raw.totalExpenses || raw.total_expenses) || 0, netProfit: parseFloat(raw.netProfit || raw.net_profit) || 0, marginPct: parseFloat(raw.marginPct || raw.margin_pct) || 0 };
  }, [apiDre]);

  var withdrawalData: WithdrawalData | null = useMemo(function() {
    var w = apiWithdrawal;
    if (!w || !w.grossRevenue) return null;
    return w as WithdrawalData;
  }, [apiWithdrawal]);

  // MULTICNPJ Onda 2.2: breakdown por empresa (apenas em consolidated)
  var consolidatedBreakdown = useMemo(function() {
    if (!consolidatedView) return null;
    return apiTx?.breakdown || null;
  }, [apiTx, consolidatedView]);

  var createMutation = useMutation({
    mutationFn: function(body: any) {
      // Bloqueio em consolidated: nao tem company
      if (consolidatedView) {
        return Promise.reject(new Error("Selecione uma empresa especifica para criar lancamentos"));
      }
      return companiesApi.createTransaction(companyId!, body);
    },
    onSuccess: function() {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["transactions-prev", companyId] });
      qc.invalidateQueries({ queryKey: ["current-month-expenses", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
      qc.invalidateQueries({ queryKey: ["dre", companyId] });
      toast.success("Lancamento criado!");
    },
    onError: function(err: any) {
      toast.error(err?.message || "Erro ao criar lancamento");
    },
  });

  var deleteMutation = useMutation({
    mutationFn: function(txId: string) {
      if (consolidatedView) {
        return Promise.reject(new Error("Selecione uma empresa especifica para excluir lancamentos"));
      }
      return companiesApi.deleteTransaction(companyId!, txId);
    },
    onMutate: async function(txId: string) {
      if (consolidatedView) return { prev: null };
      await qc.cancelQueries({ queryKey: ["transactions", companyId] });
      var prev = qc.getQueryData(["transactions", companyId, periodRange.start, periodRange.end]);
      qc.setQueryData(["transactions", companyId, periodRange.start, periodRange.end], function(old: any) {
        if (!old) return old;
        if (old.transactions) return { ...old, transactions: old.transactions.filter(function(t: any) { return t.id !== txId; }) };
        if (old.rows) return { ...old, rows: old.rows.filter(function(t: any) { return t.id !== txId; }) };
        if (Array.isArray(old)) return old.filter(function(t: any) { return t.id !== txId; });
        return old;
      });
      toast.success("Lancamento excluido");
      return { prev: prev };
    },
    onError: function(err: any, _txId: any, context: any) {
      if (context?.prev) qc.setQueryData(["transactions", companyId, periodRange.start, periodRange.end], context.prev);
      toast.error(err?.message || "Erro ao excluir lancamento");
    },
    onSettled: function() {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["transactions-prev", companyId] });
      qc.invalidateQueries({ queryKey: ["current-month-expenses", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
    },
  });

  function createTransaction(body: { type: string; amount: number; description: string; category: string; due_date?: string; payment_method?: string; employee_id?: string }) {
    if (consolidatedView) {
      toast.error("Selecione uma empresa especifica para criar lancamentos");
      return;
    }
    if (!companyId) { toast.error("Empresa nao identificada"); return; }
    if (isDemo) return;
    createMutation.mutate(body);
  }

  function deleteTransaction(id: string) {
    if (consolidatedView) {
      toast.error("Selecione uma empresa especifica para excluir lancamentos");
      return;
    }
    if (companyId && !isDemo) deleteMutation.mutate(id);
  }

  return {
    transactions: transactions,
    summary: summary,
    previousSummary: previousSummary,
    currentMonthExpenses: currentMonthExpenses,
    dreData: dreData,
    withdrawalData: withdrawalData,
    isLoading: isLoadingTx && !isDemo,
    isDemo: isDemo,
    createTransaction: createTransaction,
    deleteTransaction: deleteTransaction,
    createMutation: !isDemo && (consolidatedView || companyId) ? createMutation : undefined,
    // MULTICNPJ Onda 2.2: dados especificos de modo consolidado
    consolidatedView: consolidatedView,
    consolidatedBreakdown: consolidatedBreakdown,
  };
}
