import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi, dashboardApi } from "@/services/api";
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
    // Sessao 22-23/04: campos novos (vem do backend ddb07f5)
    payment_method: t.payment_method || null,
    employee_id: t.employee_id || null,
    employee_name: t.employee_name || null,
    idempotency_key: t.idempotency_key || null,
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
  var { company, token, isDemo } = useAuthStore();
  var qc = useQueryClient();
  var companyId = company?.id;

  var periodRange = useMemo(function() {
    var p = period || "month";
    var range = getPeriodRange(p, customStart, customEnd);
    return { start: toISODate(range.start), end: toISODate(range.end) };
  }, [period, customStart, customEnd]);

  // F-10: periodo anterior pra comparativo
  var prevRange = useMemo(function() {
    var p = period || "month";
    var prev = getPreviousPeriodRange(p, customStart, customEnd);
    if (!prev) return null;
    return { start: toISODate(prev.start), end: toISODate(prev.end) };
  }, [period, customStart, customEnd]);

  // Mes vigente — calculado independente do filtro selecionado.
  // Usado pelo MonthExpensesBanner pra avisar quando ha despesas no
  // mes atual escondidas pelo filtro (ex: cliente esta vendo "Dia"
  // ou "Semana" e nao percebe que tem 5 contas a vencer este mes).
  var currentMonthRange = useMemo(function() {
    var range = getPeriodRange("month");
    return { start: toISODate(range.start), end: toISODate(range.end) };
  }, []);

  var { data: apiTx, isLoading: isLoadingTx } = useQuery({
    queryKey: ["transactions", companyId, periodRange.start, periodRange.end],
    queryFn: function() {
      var params = "limit=5000&start=" + periodRange.start + "&end=" + periodRange.end;
      return companiesApi.transactions(companyId!, params);
    },
    enabled: !!companyId && !!token && !isDemo,
    retry: 1, staleTime: 30000,
  });

  // F-10: buscar resumo do periodo anterior
  var { data: apiPrevTx } = useQuery({
    queryKey: ["transactions-prev", companyId, prevRange?.start, prevRange?.end],
    queryFn: function() {
      var params = "limit=1&start=" + prevRange!.start + "&end=" + prevRange!.end;
      return companiesApi.transactions(companyId!, params);
    },
    enabled: !!companyId && !!token && !isDemo && !!prevRange,
    retry: 1, staleTime: 120000,
  });

  // Query do mes vigente — sempre ativa, INDEPENDENTE do filtro.
  // Otimizacao: se period === "month" reutiliza apiTx (mesmo range).
  var monthQueryEnabled = !!companyId && !!token && !isDemo && period !== "month";
  var { data: apiCurrentMonth } = useQuery({
    queryKey: ["current-month-expenses", companyId, currentMonthRange.start, currentMonthRange.end],
    queryFn: function() {
      // Pede so as despesas pra economizar payload (limit=1 + summary cobre tudo)
      var params = "limit=1&type=expense&start=" + currentMonthRange.start + "&end=" + currentMonthRange.end;
      return companiesApi.transactions(companyId!, params);
    },
    enabled: monthQueryEnabled,
    retry: 1, staleTime: 60000,
  });

  var { data: apiDre } = useQuery({
    queryKey: ["dre", companyId],
    queryFn: function() { return companiesApi.dre(companyId!); },
    enabled: !!companyId && !!token && !isDemo && activeTab === 2,
    retry: 1,
  });

  var { data: apiWithdrawal } = useQuery({
    queryKey: ["withdrawal", companyId],
    queryFn: function() { return dashboardApi.summary(companyId!); },
    enabled: !!companyId && !!token && !isDemo && activeTab === 3,
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
    var income = apiTx?.summary?.income != null ? parseFloat(apiTx.summary.income) : transactions.filter(function(t) { return t.type === "income"; }).reduce(function(s, t) { return s + t.amount; }, 0);
    var expenses = apiTx?.summary?.expenses != null ? parseFloat(apiTx.summary.expenses) : transactions.filter(function(t) { return t.type === "expense"; }).reduce(function(s, t) { return s + t.amount; }, 0);
    return { income: income, expenses: expenses, balance: income - expenses };
  }, [apiTx, transactions]);

  // F-10: resumo do periodo anterior
  var previousSummary = useMemo(function() {
    if (!apiPrevTx?.summary) return null;
    var income = parseFloat(apiPrevTx.summary.income) || 0;
    var expenses = parseFloat(apiPrevTx.summary.expenses) || 0;
    return { income: income, expenses: expenses, balance: income - expenses };
  }, [apiPrevTx]);

  // Despesas do mes vigente — usado pelo banner.
  // Quando period === "month" reutiliza apiTx (mesmo dado, evita query extra).
  var currentMonthExpenses = useMemo(function() {
    if (period === "month") {
      // Usa os dados que ja temos
      var exp = transactions.filter(function(t) { return t.type === "expense"; });
      return { count: exp.length, total: exp.reduce(function(s, t) { return s + t.amount; }, 0) };
    }
    // Usa a query separada do mes
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

  var createMutation = useMutation({
    mutationFn: function(body: any) { return companiesApi.createTransaction(companyId!, body); },
    onSuccess: function() {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["transactions-prev", companyId] });
      qc.invalidateQueries({ queryKey: ["current-month-expenses", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
      qc.invalidateQueries({ queryKey: ["dre", companyId] });
      toast.success("Lancamento criado!");
    },
    onError: function() { toast.error("Erro ao criar lancamento"); },
  });

  var deleteMutation = useMutation({
    mutationFn: function(txId: string) { return companiesApi.deleteTransaction(companyId!, txId); },
    onMutate: async function(txId: string) {
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
    onError: function(_err: any, _txId: any, context: any) {
      if (context?.prev) qc.setQueryData(["transactions", companyId, periodRange.start, periodRange.end], context.prev);
      toast.error("Erro ao excluir lancamento");
    },
    onSettled: function() {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["transactions-prev", companyId] });
      qc.invalidateQueries({ queryKey: ["current-month-expenses", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
    },
  });

  function createTransaction(body: { type: string; amount: number; description: string; category: string; due_date?: string; payment_method?: string; employee_id?: string }) {
    if (!companyId) { toast.error("Empresa nao identificada"); return; }
    if (isDemo) return;
    createMutation.mutate(body);
  }

  function deleteTransaction(id: string) {
    if (companyId && !isDemo) deleteMutation.mutate(id);
  }

  return {
    transactions: transactions, summary: summary, previousSummary: previousSummary,
    currentMonthExpenses: currentMonthExpenses, // Tarefa C — banner
    dreData: dreData, withdrawalData: withdrawalData,
    isLoading: isLoadingTx && !isDemo, isDemo: isDemo,
    createTransaction: createTransaction, deleteTransaction: deleteTransaction,
    createMutation: !isDemo && companyId ? createMutation : undefined,
  };
}
