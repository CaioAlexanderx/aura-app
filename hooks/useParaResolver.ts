// ============================================================
// AURA. — Peças para resolver da condicional (C16, 26/11/2026)
//
// Backend: Aura-backend#1118.
//   GET  /companies/:id/condicionais/para-resolver            uma loja
//   GET  /me/condicionais/para-resolver[?company_id=]         consolidado
//        → { pecas:[{item_id, condicional_id, company_id, company_name?,
//            numero_exibicao, customer_name, product_name, variant_label,
//            color_name, size_label, nota, voltou_em, estoque}], total }
//   POST /companies/:id/condicionais/itens/:itemId/resolver
//        { acao:'voltar_estoque'|'baixa', motivo?, motivo_texto? }
//   POST .../itens/:itemId/resolver/desfazer
// Escritas sempre na loja DONA da condicional (company_id da peça), com
// Idempotency-Key estável por tentativa (a mesma operação repetida depois de
// falha de rede manda a MESMA chave; a chave só cai quando o servidor responde).
//
// Multi-CNPJ desde o desenho: a chave do cache leva o escopo (a loja ou "me").
// ============================================================
import { useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { novaChaveDaVenda } from "@/utils/chaveDaVenda";

export type MotivoDaBaixa = "defeito" | "sem_etiqueta" | "perda" | "outro";

export type PecaParaResolver = {
  item_id: string;
  condicional_id: string;
  company_id: string;
  company_name?: string | null;
  numero: number;
  numero_exibicao: string;
  customer_name: string | null;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  color_name: string | null;
  size_label: string | null;
  nota: string | null;
  /** Quando voltou (ISO). */
  voltou_em: string | null;
  /** Estoque de agora da peça (variante, se tiver). */
  estoque: number | null;
};

export type RespostaParaResolver = { pecas: PecaParaResolver[]; total: number };

export type ResolucaoDaPeca =
  | { acao: "voltar_estoque" }
  | { acao: "baixa"; motivo: MotivoDaBaixa; motivo_texto?: string };

const base = (cid: string, itemId: string) => `/companies/${cid}/condicionais/itens/${itemId}/resolver`;

export const paraResolverApi = {
  listar: (cid: string) => request<RespostaParaResolver>(`/companies/${cid}/condicionais/para-resolver`),
  listarConsolidado: () => request<RespostaParaResolver>(`/me/condicionais/para-resolver`),
  resolver: (cid: string, itemId: string, corpo: ResolucaoDaPeca, chave: string) =>
    request<any>(base(cid, itemId), { method: "POST", body: corpo, headers: { "Idempotency-Key": chave } }),
  desfazer: (cid: string, itemId: string, chave: string) =>
    request<any>(base(cid, itemId) + "/desfazer", { method: "POST", body: {}, headers: { "Idempotency-Key": chave } }),
};

/** Lista de peças para resolver da loja (ou de todas, no consolidado). `enabled: false` não consulta. */
export function useParaResolver(opts: { enabled?: boolean } = {}) {
  const { token, company, consolidatedView } = useAuthStore();
  const escopo = consolidatedView ? "me" : company?.id;
  const ligado = opts.enabled !== false && !!token && (consolidatedView || !!company?.id);
  const q = useQuery({
    queryKey: ["para-resolver", escopo],
    queryFn: function() {
      if (consolidatedView) return paraResolverApi.listarConsolidado();
      if (!company?.id) throw new Error("no company");
      return paraResolverApi.listar(company.id);
    },
    enabled: ligado,
    staleTime: 15_000,
    retry: 1,
    placeholderData: function(prev, prevQuery) {
      return prevQuery && prevQuery.queryKey[1] === escopo ? prev : undefined;
    },
  });
  const data = q.data;
  return useMemo(() => ({
    pecas: data?.pecas || [],
    total: data?.total || 0,
    carregou: !!data,
    isLoading: q.isLoading,
    error: (q.error as Error | null) || null,
    refetch: q.refetch,
  }), [data, q.isLoading, q.error, q.refetch]);
}

/** O que a escrita muda: a lista, as condicionais, o detalhe e o estoque. */
function useAtualizarTudo() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ["para-resolver"] });
    qc.invalidateQueries({ queryKey: ["condicionais"] });
    qc.invalidateQueries({ queryKey: ["condicional-detalhe"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  }, [qc]);
}

/** Resolver e desfazer. Cada uma devolve a promessa do servidor (a tela mostra a frase do erro). */
export function useResolverPeca() {
  const atualizar = useAtualizarTudo();
  const chaves = useRef<Map<string, { sig: string; chave: string }>>(new Map());

  const executar = useCallback(async <T,>(op: string, sig: string, enviar: (chave: string) => Promise<T>): Promise<T> => {
    const atual = chaves.current.get(op);
    const chave = atual && atual.sig === sig ? atual.chave : novaChaveDaVenda();
    chaves.current.set(op, { sig, chave });
    try {
      const r = await enviar(chave);
      chaves.current.delete(op);
      atualizar();
      return r;
    } catch (err: any) {
      const st = Number(err && err.status);
      if (st >= 400) {
        chaves.current.delete(op);
        if (st < 500) atualizar();
      }
      throw err;
    }
  }, [atualizar]);

  return useMemo(() => ({
    resolver: (p: Pick<PecaParaResolver, "company_id" | "item_id">, corpo: ResolucaoDaPeca) =>
      executar("resolver:" + p.item_id, JSON.stringify(corpo), (k) => paraResolverApi.resolver(p.company_id, p.item_id, corpo, k)),
    desfazer: (p: Pick<PecaParaResolver, "company_id" | "item_id">) =>
      executar("desfazer:" + p.item_id, "", (k) => paraResolverApi.desfazer(p.company_id, p.item_id, k)),
  }), [executar]);
}
