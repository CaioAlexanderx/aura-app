// ============================================================
// AURA. — Lista da aba Condicionais (C5, 26/11/2026)
//
// O backend é o Aura-backend#1110 (C1/C2):
//   GET /companies/:id/condicionais?filtro=&q=&page=&limit=   uma loja
//   GET /me/condicionais?company_id=&filtro=&q=&page=&limit=  consolidado
//     (todas as lojas que a pessoa vê; company_id filtra uma delas), com
//     company_id/company_name por linha e por_empresa
// Resposta: { condicionais, filtro, hoje, totalizador:{valor,pecas,clientes,
// texto}, valor_a_cobrar, counts, pagination } (+ por_empresa, company_count
// no consolidado). Ordem do backend: atrasadas, depois as a cobrar, depois as
// outras abertas pelo prazo, depois as fechadas.
//
// Multi-CNPJ desde o desenho: a chave do cache leva o escopo (a loja ou
// "me"), a loja escolhida no consolidado, o filtro e a busca. Quem decide se
// a aba existe é useAbaCondicionais (trava + módulo); com a aba fora, nada
// sai daqui (enabled: false).
// ============================================================
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

/** Situação de cada linha, derivada no backend (condicional.derivarSituacao). */
export type SituacaoDaCondicional = "com_cliente" | "vence_hoje" | "atrasada" | "a_cobrar" | "concluida" | "cancelada";

/** O parâmetro `filtro` do backend. */
export type FiltroDasCondicionais =
  | "em_aberto" | "com_cliente" | "vence_hoje" | "atrasadas" | "a_cobrar" | "concluidas" | "canceladas" | "todas";

export type LinhaDaCondicional = {
  id: string;
  company_id: string;
  company_name: string | null;
  numero: number;
  /** "C-0031" */
  numero_exibicao: string;
  status: "aberta" | "encerrada" | "cancelada" | string;
  situacao: SituacaoDaCondicional | string;
  /** Parte das peças já decidida (voltou ou ficou). */
  parcial: boolean;
  dias_de_atraso: number;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  seller_name: string | null;
  /** 'YYYY-MM-DD' */
  due_date: string | null;
  notes: string | null;
  pecas: number;
  pecas_com_cliente: number;
  pecas_ficou: number;
  pecas_a_cobrar: number;
  /** voltou + voltou com defeito */
  pecas_voltou: number;
  valor_total: number;
  valor_com_cliente: number;
  valor_a_cobrar: number;
  primeira_peca: string | null;
  // C18 (Aura-backend#1116). Ausentes no backend antigo: a tela cai nos campos acima.
  resumo?: { com_cliente: number; voltaram: number; ficaram: number; a_cobrar: number; valor_com_cliente: number; valor_a_cobrar: number };
  /** Até 2, na ordem: com a cliente, ficou, voltou. */
  primeiras_pecas?: Array<{ nome: string; cor?: string | null; tamanho?: string | null }>;
  outras_pecas?: number;
  /** Só concluída com venda. */
  venda?: { numero: string | number; valor: number } | null;
  created_at: string;
  closed_at: string | null;
  cancelled_at: string | null;
};

export type TotalizadorDasCondicionais = { valor: number; pecas: number; clientes: number; texto: string };

/** C18: totais dos cartões do topo, de TODAS as abertas (sem depender de página nem de filtro). */
export type TotaisDasCondicionais = {
  vence_hoje: { valor: number; pecas: number };
  atrasadas: { valor: number; pecas: number };
  a_cobrar: { valor: number; pecas: number };
};

export type ContagemDasCondicionais = Record<FiltroDasCondicionais, number>;

export type NumerosDaLojaCondicional = {
  company_id: string;
  company_name?: string | null;
  totalizador: TotalizadorDasCondicionais;
  valor_a_cobrar: number;
  counts: ContagemDasCondicionais;
};

export type RespostaDasCondicionais = {
  condicionais: LinhaDaCondicional[];
  filtro: FiltroDasCondicionais;
  hoje: string;
  totalizador: TotalizadorDasCondicionais;
  valor_a_cobrar: number;
  totais?: TotaisDasCondicionais;
  counts: ContagemDasCondicionais;
  pagination: { page: number; limit: number; total: number; pages: number };
  por_empresa?: NumerosDaLojaCondicional[];
  company_count?: number;
  filtered_company_id?: string | null;
};

/** A lista pede até 100 por vez (o máximo do backend). */
export const CONDICIONAIS_POR_PAGINA = 100;

/** Filtro + busca (+ a loja, no consolidado) → query string da rota. */
export function parametrosDaLista(filtro: FiltroDasCondicionais, busca: string, loja?: string | null): string {
  const p: string[] = ["filtro=" + filtro];
  const q = String(busca || "").trim();
  if (q) p.push("q=" + encodeURIComponent(q));
  if (loja) p.push("company_id=" + encodeURIComponent(loja));
  p.push("limit=" + CONDICIONAIS_POR_PAGINA);
  return p.join("&");
}

export const condicionaisApi = {
  listar: (cid: string, filtro: FiltroDasCondicionais, busca: string) =>
    request<RespostaDasCondicionais>(`/companies/${cid}/condicionais?${parametrosDaLista(filtro, busca)}`),
  listarConsolidado: (filtro: FiltroDasCondicionais, busca: string, loja?: string | null) =>
    request<RespostaDasCondicionais>(`/me/condicionais?${parametrosDaLista(filtro, busca, loja)}`),
};

/**
 * Lista da aba: uma loja ou o consolidado, conforme o seletor de empresa.
 * `loja` só vale no consolidado (o chip da loja; null = todas).
 */
export function useCondicionais(
  filtro: FiltroDasCondicionais,
  busca: string,
  opts: { enabled?: boolean; loja?: string | null } = {},
) {
  const { token, company, consolidatedView } = useAuthStore();
  const escopo = consolidatedView ? "me" : company?.id;
  const loja = consolidatedView ? opts.loja || null : null;
  const q = String(busca || "").trim();
  const ligado = opts.enabled !== false && !!token && (consolidatedView || !!company?.id);

  const query = useQuery({
    queryKey: ["condicionais", escopo, loja, filtro, q],
    queryFn: function() {
      if (consolidatedView) return condicionaisApi.listarConsolidado(filtro, q, loja);
      if (!company?.id) throw new Error("no company");
      return condicionaisApi.listar(company.id, filtro, q);
    },
    enabled: ligado,
    staleTime: 15_000,
    retry: 1,
    // Trocar o chip ou a busca mantém a lista de antes na tela enquanto a nova
    // chega; trocar de loja (escopo) não: nunca mostrar a lista de outra loja.
    placeholderData: function(prev, prevQuery) {
      return prevQuery && prevQuery.queryKey[1] === escopo && prevQuery.queryKey[2] === loja ? prev : undefined;
    },
  });

  const data = query.data;
  return useMemo(() => ({
    condicionais: data?.condicionais || [],
    totalizador: data?.totalizador || null,
    valorACobrar: data?.valor_a_cobrar || 0,
    totais: data?.totais || null,
    contagem: data?.counts || null,
    porEmpresa: data?.por_empresa || [],
    lojas: data?.company_count || 1,
    hoje: data?.hoje || null,
    total: data?.pagination?.total || 0,
    consolidado: !!consolidatedView,
    carregou: !!data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) || null,
    refetch: query.refetch,
  }), [data, consolidatedView, query.isLoading, query.isFetching, query.error, query.refetch]);
}
