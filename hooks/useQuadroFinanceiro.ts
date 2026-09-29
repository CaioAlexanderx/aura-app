// ============================================================
// useQuadroFinanceiro — dados e movimentos do Quadro do Financeiro
// (28/09/2026). Um GET por tipo+mês; cada movimento é um PATCH no
// lançamento com atualização otimista e rollback se o servidor recusar.
// ============================================================
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { toast } from "@/components/Toast";
import { invalidateFinanceiroQueries } from "@/hooks/useTransactions";
import { anexarComprovante } from "@/utils/comprovante";
import { aplicarMovimento, corpoDoLote, corpoDoMovimento, ddmm, rotulos, type PedidoDeMovimento, type Quadro, type TipoQuadro } from "@/utils/quadroFinanceiro";

export { corpoDoMovimento, type PedidoDeMovimento };

export function chaveDoQuadro(companyId: string | null | undefined, tipo: TipoQuadro, mes: string) {
  return ["transactions-board", companyId, tipo, mes] as const;
}

export function useQuadroFinanceiro(companyId: string | null | undefined, tipo: TipoQuadro, mes: string) {
  const qc = useQueryClient();
  const chave = chaveDoQuadro(companyId, tipo, mes);

  const consulta = useQuery<Quadro>({
    queryKey: chave,
    queryFn: () => companiesApi.transactionsBoard(companyId as string, tipo, mes),
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const mover = useMutation({
    // F3: a baixa grava primeiro; o comprovante sobe em seguida. Se só o
    // arquivo falhar, a baixa vale e o aviso manda anexar pelo Editar.
    mutationFn: async (p: PedidoDeMovimento) => {
      const r = await companiesApi.updateTransaction(companyId as string, p.id, corpoDoMovimento(p));
      if (p.mov === "baixa" && p.comprovante) {
        try { await anexarComprovante(companyId as string, p.id, p.comprovante); }
        catch (e: any) { toast.warning("A baixa foi feita, mas o comprovante não subiu" + (e?.message ? " (" + e.message + ")" : "") + ". Anexe pelo Editar."); }
      }
      return r;
    },
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<Quadro>(chave);
      if (antes) qc.setQueryData<Quadro>(chave, aplicarMovimento(antes, p.id, p.mov, { data: p.data, forma: p.forma, valorPago: p.valorPago }));
      return { antes };
    },
    onError: (err: any, _p, ctx) => {
      if (ctx?.antes) qc.setQueryData(chave, ctx.antes);
      toast.error(err?.message || "Não deu para salvar. Confira a conexão e tente de novo.");
    },
    onSuccess: (_r, p) => {
      const r = rotulos(tipo);
      if (p.mov === "baixa") toast.success("Marcado como " + r.verbo + ".");
      else if (p.mov === "nova_data") toast.success("Vencimento mudou para " + ddmm(p.data) + ".");
      else toast.success("Baixa desfeita.");
    },
    onSettled: () => {
      invalidateFinanceiroQueries(qc, companyId);
    },
  });

  // F2: pagar vários de uma vez. Sem otimista (o servidor decide quem pula);
  // o quadro recarrega no fim.
  const lote = useMutation({
    mutationFn: (corpo: ReturnType<typeof corpoDoLote>) => companiesApi.transactionsBaixaEmLote(companyId as string, corpo),
    onSuccess: (r: any) => {
      const n = Number(r?.updated) || 0;
      const verbo = tipo === "expense" ? (n === 1 ? " pago" : " pagos") : (n === 1 ? " recebido" : " recebidos");
      toast.success(n + (n === 1 ? " lançamento" : " lançamentos") + verbo + ".");
      const pulados = Array.isArray(r?.skipped) ? r.skipped.length : 0;
      if (pulados) toast.warning(pulados + (pulados === 1 ? " lançamento não recebeu" : " lançamentos não receberam") + " baixa: já estavam pagos ou mudam por outro fluxo.");
    },
    onError: (err: any) => { toast.error(err?.message || "Não deu para dar baixa. Confira a conexão e tente de novo."); },
    onSettled: () => { invalidateFinanceiroQueries(qc, companyId); },
  });

  return {
    quadro: consulta.data,
    carregando: consulta.isLoading,
    erro: consulta.isError,
    recarregar: consulta.refetch,
    mover: mover.mutate,
    salvando: mover.isPending,
    pagarVarios: lote.mutate,
    pagandoVarios: lote.isPending,
  };
}
