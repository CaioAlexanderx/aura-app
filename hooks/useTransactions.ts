import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi, dashboardApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Transaction, DreData, WithdrawalData } from "@/components/screens/financeiro/types";

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
  } as Transaction & { due_date?: string; created_at?: string; paid_at?: string };
}

function safePeriod(raw: any): string {
  if (!raw) return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  if (typeof raw === "string") return raw;
  if (raw.from && raw.to) { try { return new Date(raw.from).toLocaleDateString("pt-BR") + " - " + new Date(raw.to).toLocaleDateString("pt-BR"); } catch { return "Periodo atual"; } }
  return "Periodo atual";
}

export function useTransactionsApi(activeTab?: number) {
  var { company, token, isDemo } = useAuthStore();
  var qc = useQueryClient();
  var companyId = company?.id;

  // FIX: load ALL transactions (was limit=200, couldn't see Ano Anterior)
  var { data: apiTx, isLoading: isLoadingTx } = useQuery({
    queryKey: ["transactions", companyId],
    queryFn: function() { return companiesApi.transactions(companyId!, "limit=10000"); },
    enabled: !!companyId && !!token && !isDemo,
    retry: 1, staleTime: 30000,
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
      var db = b.due_date || b.created_at || "";
      return db.localeCompare(da);
    });
    return mapped;
  }, [apiTx, isDemo]);

  var summary = useMemo(function() {
    var income = apiTx?.summary?.income != null ? parseFloat(apiTx.summary.income) : transactions.filter(function(t) { return t.type === "income"; }).reduce(function(s, t) { return s + t.amount; }, 0);
    var expenses = apiTx?.summary?.expenses != null ? parseFloat(apiTx.summary.expenses) : transactions.filter(function(t) { return t.type === "expense"; }).reduce(function(s, t) { return s + t.amount; }, 0);
    return { income: income, expenses: expenses, balance: income - expenses };
  }, [apiTx, transactions]);

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
      var prev = qc.getQueryData(["transactions", companyId]);
      qc.setQueryData(["transactions", companyId], function(old: any) {
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
      if (context?.prev) qc.setQueryData(["transactions", companyId], context.prev);
      toast.error("Erro ao excluir lancamento");
    },
    onSettled: function() {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
    },
  });

  function createTransaction(body: { type: string; amount: number; description: string; category: string }) {
    if (!companyId) { toast.error("Empresa nao identificada"); return; }
    if (isDemo) return;
    createMutation.mutate(body);
  }

  function deleteTransaction(id: string) {
    if (companyId && !isDemo) deleteMutation.mutate(id);
  }

  return {
    transactions: transactions, summary: summary, dreData: dreData, withdrawalData: withdrawalData,
    isLoading: isLoadingTx && !isDemo, isDemo: isDemo,
    createTransaction: createTransaction, deleteTransaction: deleteTransaction,
    createMutation: !isDemo && companyId ? createMutation : undefined,
  };
}
