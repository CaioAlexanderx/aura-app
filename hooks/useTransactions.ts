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
  };
}

function safePeriod(raw: any): string {
  if (!raw) return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  if (typeof raw === "string") return raw;
  if (raw.from && raw.to) { try { return `${new Date(raw.from).toLocaleDateString("pt-BR")} - ${new Date(raw.to).toLocaleDateString("pt-BR")}`; } catch { return "Periodo atual"; } }
  return "Periodo atual";
}

export function useTransactionsApi(activeTab?: number) {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;

  const { data: apiTx, isLoading: isLoadingTx } = useQuery({
    queryKey: ["transactions", companyId],
    queryFn: () => companiesApi.transactions(companyId!, "limit=50"),
    enabled: !!companyId && !!token && !isDemo,
    retry: 1, staleTime: 30000,
  });

  const { data: apiDre } = useQuery({
    queryKey: ["dre", companyId],
    queryFn: () => companiesApi.dre(companyId!),
    enabled: !!companyId && !!token && !isDemo && activeTab === 2,
    retry: 1,
  });

  const { data: apiWithdrawal } = useQuery({
    queryKey: ["withdrawal", companyId],
    queryFn: () => dashboardApi.summary(companyId!),
    enabled: !!companyId && !!token && !isDemo && activeTab === 3,
    retry: 1,
  });

  const transactions: Transaction[] = useMemo(() => {
    if (isDemo) return [];
    const arr = apiTx?.transactions || apiTx?.rows || apiTx;
    if (!(arr instanceof Array)) return [];
    return arr.map(mapApiTransaction);
  }, [apiTx, isDemo]);

  const summary = useMemo(() => {
    const income = apiTx?.summary?.income != null ? parseFloat(apiTx.summary.income) : transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = apiTx?.summary?.expenses != null ? parseFloat(apiTx.summary.expenses) : transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [apiTx, transactions]);

  const dreData: DreData | null = useMemo(() => {
    const raw = apiDre;
    if (!raw || (!raw.totalIncome && !raw.income && !raw.total_income)) return null;
    return { period: safePeriod(raw.period), income: Array.isArray(raw.income) ? raw.income : [], expenses: Array.isArray(raw.expenses) ? raw.expenses : [], totalIncome: parseFloat(raw.totalIncome || raw.total_income) || 0, totalExpenses: parseFloat(raw.totalExpenses || raw.total_expenses) || 0, netProfit: parseFloat(raw.netProfit || raw.net_profit) || 0, marginPct: parseFloat(raw.marginPct || raw.margin_pct) || 0 };
  }, [apiDre]);

  const withdrawalData: WithdrawalData | null = useMemo(() => {
    const w = apiWithdrawal;
    if (!w || !w.grossRevenue) return null;
    return w as WithdrawalData;
  }, [apiWithdrawal]);

  const createMutation = useMutation({
    mutationFn: (body: any) => companiesApi.createTransaction(companyId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
      qc.invalidateQueries({ queryKey: ["dre", companyId] });
      toast.success("Lancamento criado!");
    },
    onError: () => toast.error("Erro ao criar lancamento"),
  });

  // M9: Optimistic delete — remove from cache immediately, rollback on error
  const deleteMutation = useMutation({
    mutationFn: (txId: string) => companiesApi.deleteTransaction(companyId!, txId),
    onMutate: async (txId: string) => {
      await qc.cancelQueries({ queryKey: ["transactions", companyId] });
      const prev = qc.getQueryData(["transactions", companyId]);
      // Optimistically remove the transaction from cache
      qc.setQueryData(["transactions", companyId], (old: any) => {
        if (!old) return old;
        if (old.transactions) return { ...old, transactions: old.transactions.filter((t: any) => t.id !== txId) };
        if (old.rows) return { ...old, rows: old.rows.filter((t: any) => t.id !== txId) };
        if (Array.isArray(old)) return old.filter((t: any) => t.id !== txId);
        return old;
      });
      toast.success("Lancamento excluido");
      return { prev };
    },
    onError: (_err, _txId, context) => {
      // Rollback on error
      if (context?.prev) qc.setQueryData(["transactions", companyId], context.prev);
      toast.error("Erro ao excluir lancamento");
    },
    onSettled: () => {
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
    transactions, summary, dreData, withdrawalData,
    isLoading: isLoadingTx && !isDemo, isDemo,
    createTransaction, deleteTransaction,
    createMutation: !isDemo && companyId ? createMutation : undefined,
  };
}
