// ============================================================
// AURA. — Personalizados: regras da visão de todas as lojas (p-187)
//
// No consolidado multi-CNPJ ("Todas as empresas") a Produção e os
// Orçamentos 3D viram listas SÓ DE LEITURA, lidas de GET /me/studio/orders
// e GET /me/studio/quotes (Aura-backend#1052). Mutação só por CNPJ: cada
// item tem "Abrir na loja", que troca para a empresa e abre o item lá.
//
// Aqui ficam só as regras, sem tela: o seletor de lojas, os filtros, a
// paginação e as rotas do "Abrir na loja".
// ============================================================
import type { StudioProductionStatus, StudioQuoteStatus } from "@/services/studioApi";
import type { StudioConsolidadoBreakdown } from "@/services/meAggregates";
import { ETAPAS } from "@/components/personalizados/regrasDaProducao";

/** Itens por página nas duas listas. */
export const TAMANHO_DA_PAGINA = 30;

/** Janela de dias pedida ao servidor (a Produção do Studio olha 60 dias; os orçamentos, 180). */
export const DIAS_DOS_PEDIDOS = 60;
export const DIAS_DOS_ORCAMENTOS = 180;

// ── Rotas do "Abrir na loja" ─────────────────────────────────────────────

export const PARAM_DO_PEDIDO = "pedido";
export const PARAM_DO_ORCAMENTO = "orcamento";

export function rotaDoPedidoNaLoja(orderId: string): string {
  return `/personalizados/producao?${PARAM_DO_PEDIDO}=${encodeURIComponent(orderId)}`;
}

export function rotaDoOrcamentoNaLoja(quoteId: string): string {
  return `/personalizados/orcamentos?${PARAM_DO_ORCAMENTO}=${encodeURIComponent(quoteId)}`;
}

/** O id que veio na rota (?pedido= ou ?orcamento=), ou null. Aceita só uuid-ish. */
export function idDaRota(valor: unknown): string | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(t) ? t : null;
}

// ── Seletor de lojas ─────────────────────────────────────────────────────

export type SeletorDeLojas = {
  /** As lojas do seletor, na ordem do servidor (principal primeiro). */
  lojas: StudioConsolidadoBreakdown[];
  /** "Todas as lojas" só existe quando toda loja da resposta tem a frente. */
  podeVerTodas: boolean;
  /** Soma das lojas do seletor. */
  totalDasLojas: number;
};

/**
 * O servidor devolve as lojas em que o usuário vê Personalizados pelo plano
 * e pela permissão. O app ainda tira as que não têm a frente ligada
 * (studio_enabled e sem vertical_active): nelas a tela da loja não existe.
 * Quando alguma loja da resposta fica de fora, não dá para pedir "todas"
 * (o filtro do servidor é uma loja ou todas): o seletor começa na primeira.
 */
export function seletorDeLojas(breakdown: StudioConsolidadoBreakdown[] | null | undefined, ligadas: Set<string>): SeletorDeLojas {
  const todas = Array.isArray(breakdown) ? breakdown : [];
  const lojas = todas.filter((b) => ligadas.has(String(b.company_id)));
  return {
    lojas,
    podeVerTodas: lojas.length > 0 && lojas.length === todas.length,
    totalDasLojas: lojas.reduce((n, b) => n + (Number(b.total) || 0), 0),
  };
}

/**
 * A loja que o pedido ao servidor deve filtrar. `escolhida` é a do seletor
 * (null = todas). Se "todas" não pode, ou a escolhida saiu da lista, vale a
 * primeira loja do seletor.
 */
export function lojaDoFiltro(escolhida: string | null, seletor: SeletorDeLojas): string | null {
  if (escolhida && seletor.lojas.some((l) => String(l.company_id) === escolhida)) return escolhida;
  if (seletor.podeVerTodas) return null;
  return seletor.lojas.length ? String(seletor.lojas[0].company_id) : null;
}

// ── Filtros ──────────────────────────────────────────────────────────────

export type FiltroDeEtapa = { key: StudioProductionStatus | null; label: string };

/** "Todas", as cinco etapas do quadro, e as duas que saem da Fila. */
export const FILTROS_DE_ETAPA: FiltroDeEtapa[] = [
  { key: null, label: "Todas" },
  ...ETAPAS.map((e) => ({ key: e.key, label: e.label })),
  { key: "delivered", label: "Entregue" },
  { key: "cancelled", label: "Cancelado" },
];

export function rotuloDaEtapa(status: string | null | undefined): string {
  const f = FILTROS_DE_ETAPA.find((x) => x.key === status);
  return f && f.key ? f.label : "Aguardando arte";
}

export type FiltroDeSituacao = { key: StudioQuoteStatus | null; label: string };

export const FILTROS_DE_SITUACAO: FiltroDeSituacao[] = [
  { key: null, label: "Todos" },
  { key: "draft", label: "Rascunho" },
  { key: "sent", label: "Enviado" },
  { key: "accepted", label: "Aceito" },
  { key: "rejected", label: "Recusado" },
  { key: "expired", label: "Expirado" },
  { key: "converted", label: "Convertido" },
  { key: "closed", label: "Encerrado" },
];

// ── Paginação ────────────────────────────────────────────────────────────

/** "31–60 de 87". Lista vazia: "0 de 0". */
export function textoDaPagina(offset: number, naPagina: number, total: number): string {
  if (!naPagina) return `0 de ${total || 0}`;
  return `${offset + 1}–${offset + naPagina} de ${total}`;
}

export function temProxima(offset: number, naPagina: number, total: number): boolean {
  return offset + naPagina < (total || 0);
}
