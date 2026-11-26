// ============================================================
// AURA. — Detalhe e decisão da condicional (C10, 26/11/2026)
//
// Backend: Aura-backend#1110 (C1/C2, detalhe) e #1115 (C9, decisão).
//   GET   /companies/:id/condicionais/:cid              → { condicional }
//   PATCH .../:cid/itens   { items:[{item_id, situacao, defect_note?}] }
//   PATCH .../:cid/prazo   { due_date }
//   POST  .../:cid/itens   { items:[{product_id, variant_id?}] }  (acrescentar)
//   POST  .../:cid/tudo-devolvido
//   POST  .../:cid/cancelar { reason? }
// Todas as escritas levam Idempotency-Key. Erros 409 COND_* e 422 chegam
// com a frase do servidor em `error.message` e o código em `error.data.code`.
//
// Sempre na loja DONA da condicional (consolidado incluso): quem chama passa
// o company_id da linha da lista.
//
// Chave de idempotência ESTÁVEL por tentativa: a mesma operação (mesmo corpo)
// repetida depois de uma falha de rede manda a MESMA chave, e o servidor
// devolve o que já gravou em vez de gravar de novo. Operação diferente (outro
// corpo) ganha chave nova. A chave só é descartada quando o servidor responde
// (sucesso ou recusa): daí em diante a próxima tentativa é outra.
//
// Depois de cada escrita a lista ("condicionais") e o detalhe se atualizam.
// ============================================================
import { useCallback, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { novaChaveDaVenda } from "@/utils/chaveDaVenda";

export type SituacaoDaPeca = "com_cliente" | "ficou" | "voltou" | "voltou_defeito";

export type PecaDaCondicional = {
  id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  color_name: string | null;
  size_label: string | null;
  /** Preço da retirada (é o que vale na cobrança). */
  unit_price: number;
  /** Preço de hoje na loja; null = backend não calculou. */
  preco_hoje: number | null;
  preco_mudou: boolean;
  situacao: SituacaoDaPeca;
  defect_note: string | null;
  decided_at: string | null;
  decided_by?: string | null;
  sale_id: string | null;
  /** C11 (Aura-backend#1117): número da venda que cobrou a peça. Ausente no backend antigo. */
  venda_numero?: string | number | null;
  added_at: string;
  /** C9: peça com defeito já resolvida em Peças para resolver (C16). */
  resolved_at?: string | null;
};

export type EventoDaCondicional = {
  id: string;
  tipo: string;
  item_id: string | null;
  dados: Record<string, any> | null;
  user_id: string | null;
  created_at: string;
};

export type ResumoDaCondicional = {
  pecas: number;
  com_cliente: number;
  ficou: number;
  a_cobrar: number;
  voltou: number;
  voltou_defeito: number;
  valor_total: number;
  valor_com_cliente: number;
  valor_a_cobrar: number;
};

export type DetalheDaCondicional = {
  id: string;
  company_id: string;
  numero: number;
  numero_exibicao: string;
  status: "aberta" | "encerrada" | "cancelada" | string;
  situacao: string;
  parcial: boolean;
  dias_de_atraso: number;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  seller_name: string | null;
  due_date: string | null;
  notes: string | null;
  terms: string | null;
  created_at: string;
  closed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  resumo: ResumoDaCondicional;
  items: PecaDaCondicional[];
  events: EventoDaCondicional[];
};

export type MarcaDaPeca = { item_id: string; situacao: SituacaoDaPeca; defect_note?: string };

type RespostaDaEscrita = {
  condicional: DetalheDaCondicional;
  avisos?: any[];
  itens_acrescentados?: any[];
  idempotent_replay?: boolean;
};

const base = (cid: string, id: string) => `/companies/${cid}/condicionais/${id}`;

export const condicionalApi = {
  detalhe: (cid: string, id: string) =>
    request<{ condicional: DetalheDaCondicional }>(base(cid, id)),
  marcar: (cid: string, id: string, items: MarcaDaPeca[], chave: string) =>
    request<RespostaDaEscrita>(base(cid, id) + "/itens", { method: "PATCH", body: { items }, headers: { "Idempotency-Key": chave } }),
  prazo: (cid: string, id: string, due_date: string, chave: string) =>
    request<RespostaDaEscrita>(base(cid, id) + "/prazo", { method: "PATCH", body: { due_date }, headers: { "Idempotency-Key": chave } }),
  acrescentar: (cid: string, id: string, items: Array<{ product_id: string; variant_id?: string | null }>, chave: string) =>
    request<RespostaDaEscrita>(base(cid, id) + "/itens", { method: "POST", body: { items }, headers: { "Idempotency-Key": chave } }),
  tudoDevolvido: (cid: string, id: string, chave: string) =>
    request<RespostaDaEscrita>(base(cid, id) + "/tudo-devolvido", { method: "POST", body: {}, headers: { "Idempotency-Key": chave } }),
  cancelar: (cid: string, id: string, reason: string | undefined, chave: string) =>
    request<RespostaDaEscrita>(base(cid, id) + "/cancelar", { method: "POST", body: reason ? { reason } : {}, headers: { "Idempotency-Key": chave } }),
};

/** O código COND_* de um erro do servidor (ou null). */
export function codigoDoErro(err: any): string | null {
  return (err && (err.data?.code || null)) || null;
}

/** Detalhe da condicional, na loja dona dela. */
export function useCondicionalDetalhe(companyId: string | null | undefined, id: string | null | undefined) {
  const q = useQuery({
    queryKey: ["condicional-detalhe", companyId, id],
    queryFn: function() {
      if (!companyId || !id) throw new Error("missing");
      return condicionalApi.detalhe(companyId, id);
    },
    enabled: !!companyId && !!id,
    staleTime: 10_000,
    retry: 1,
  });
  return {
    condicional: q.data?.condicional || null,
    isLoading: q.isLoading,
    error: (q.error as Error | null) || null,
    refetch: q.refetch,
  };
}

/**
 * As escritas da condicional. Cada uma devolve a promessa do servidor (o
 * chamador mostra a frase do erro) e atualiza lista e detalhe.
 */
export function useDecidirCondicional(companyId: string | null | undefined, id: string | null | undefined) {
  const qc = useQueryClient();
  // Uma chave por operação em andamento: { assinatura, chave }.
  const chaves = useRef<Map<string, { sig: string; chave: string }>>(new Map());

  const chaveDe = useCallback((op: string, corpo: unknown): { chave: string; fechar: () => void } => {
    const sig = JSON.stringify(corpo ?? null);
    const atual = chaves.current.get(op);
    const chave = atual && atual.sig === sig ? atual.chave : novaChaveDaVenda();
    chaves.current.set(op, { sig, chave });
    return { chave, fechar: () => { chaves.current.delete(op); } };
  }, []);

  const atualizar = useCallback((resp?: RespostaDaEscrita | null) => {
    if (resp?.condicional && Array.isArray(resp.condicional.items) && companyId && id) {
      qc.setQueryData(["condicional-detalhe", companyId, id], { condicional: resp.condicional });
    }
    qc.invalidateQueries({ queryKey: ["condicionais"] });
    // C16: marcar "voltou com defeito" põe a peça em Peças para resolver.
    qc.invalidateQueries({ queryKey: ["para-resolver"] });
    if (companyId && id) qc.invalidateQueries({ queryKey: ["condicional-detalhe", companyId, id] });
  }, [qc, companyId, id]);

  const executar = useCallback(async (op: string, corpo: unknown, enviar: (chave: string) => Promise<RespostaDaEscrita>) => {
    if (!companyId || !id) throw new Error("missing");
    const { chave, fechar } = chaveDe(op, corpo);
    try {
      const resp = await enviar(chave);
      fechar();
      atualizar(resp);
      return resp;
    } catch (err: any) {
      const st = Number(err && err.status);
      // Recusa do servidor (409/422): a chave termina e lista e detalhe se
      // atualizam (a peça pode ter sido cobrada em outra aba). Sem resposta
      // (rede): a chave fica e nada recarrega, para a tela não perder o que
      // a pessoa marcou.
      if (st >= 400) {
        fechar();
        if (st < 500) atualizar(null);
      }
      throw err;
    }
  }, [companyId, id, chaveDe, atualizar]);

  const m = useMutation({
    mutationFn: (v: { op: string; corpo: unknown; enviar: (chave: string) => Promise<RespostaDaEscrita> }) =>
      executar(v.op, v.corpo, v.enviar),
  });
  const mutar = m.mutateAsync;

  return useMemo(() => ({
    salvando: m.isPending,
    /** Marca peças (voltou, voltou com defeito, ficou, ainda com ela). */
    marcar: (items: MarcaDaPeca[]) =>
      mutar({ op: "marcar", corpo: items, enviar: (k) => condicionalApi.marcar(companyId!, id!, items, k) }),
    mudarPrazo: (due_date: string) =>
      mutar({ op: "prazo", corpo: due_date, enviar: (k) => condicionalApi.prazo(companyId!, id!, due_date, k) }),
    acrescentar: (items: Array<{ product_id: string; variant_id?: string | null }>) =>
      mutar({ op: "acrescentar", corpo: items, enviar: (k) => condicionalApi.acrescentar(companyId!, id!, items, k) }),
    tudoDevolvido: () =>
      mutar({ op: "tudo", corpo: null, enviar: (k) => condicionalApi.tudoDevolvido(companyId!, id!, k) }),
    cancelar: (reason?: string) =>
      mutar({ op: "cancelar", corpo: reason || null, enviar: (k) => condicionalApi.cancelar(companyId!, id!, reason, k) }),
  }), [m.isPending, mutar, companyId, id]);
}
