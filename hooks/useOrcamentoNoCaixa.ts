// ============================================================
// AURA. — Matcon M1: o Caixa abre o orçamento que virou pedido (`?quote=`)
//
// QA 23/09/2026 (produção). "Virar pedido" em /matcon/orcamentos levava ao
// Caixa com `?quote=<id>` e a tela empilhava 4 avisos ("virou pedido — o
// Caixa abre com 2 itens", "carregado no carrinho" ×2 e "Não foi possível
// carregar o orçamento"), com um GET /matcon/quotes/undefined no meio,
// embora o carrinho acabasse certo. Duas causas:
//
//   1. O Caixa montava DUAS vezes. O <PageTransition> do web
//      (components/PageTransition.tsx) trocava a `key` do conteúdo 150 ms
//      depois da troca de rota — a tela nova montava, desmontava e montava
//      de novo. O `useRef` que impedia a 2ª busca morria junto: duas buscas,
//      dois "carregado". (O PageTransition também foi corrigido.)
//   2. `router.setParams({ quote: undefined })`, que limpa a URL depois de
//      montar o carrinho, deixa a chave com valor undefined — e o
//      useLocalSearchParams do expo-router passa tudo por
//      decodeURIComponent, que devolve a STRING "undefined". O efeito rodava
//      de novo com o id "undefined": 404 e o aviso de erro.
//
// Agora: o id da URL passa por `orcamentoDaUrl` (ignora "undefined"/"null"/
// vazio); a busca vai pelo cache do react-query (`fetchQuery` na chave
// `chaveDoOrcamento`), então duas montagens seguidas dividem UMA chamada —
// e a tela de Orçamentos já deixa o orçamento convertido nessa chave, o que
// normalmente dispensa a busca; e só a montagem que continua viva aplica o
// carrinho e mostra o aviso, que agora é um só:
// "Orçamento #1 no carrinho — 2 itens".
// ============================================================
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { toast } from "@/components/Toast";
import { matconApi, type Quote } from "@/services/matconApi";

/** Chave do react-query do orçamento aberto no Caixa. */
export function chaveDoOrcamento(companyId: string, quoteId: string) {
  return ["matcon-quote", companyId, quoteId] as const;
}

/** O id do orçamento na URL, ou null. "undefined"/"null"/vazio não são id. */
export function orcamentoDaUrl(v: unknown): string | null {
  const bruto = Array.isArray(v) ? v[0] : v;
  if (typeof bruto !== "string") return null;
  const id = bruto.trim();
  if (!id || id === "undefined" || id === "null") return null;
  return id;
}

/** "Orçamento #1 no carrinho — 2 itens" */
export function avisoDoOrcamento(quote: Pick<Quote, "number" | "items">): string {
  const n = (quote.items || []).length;
  return "Orçamento #" + quote.number + " no carrinho — " + n + (n === 1 ? " item" : " itens");
}

export type UseOrcamentoNoCaixaParams = {
  /** `quote` cru de useLocalSearchParams. */
  quoteParam: unknown;
  companyId: string | null | undefined;
  /** pdv_settings.matcon_enabled — sem Matcon o efeito nunca dispara. */
  enabled: boolean;
  /** Monta o carrinho com o orçamento (usePdvState sabe como). */
  aplicar: (quote: Quote) => void;
};

export function useOrcamentoNoCaixa({ quoteParam, companyId, enabled, aplicar }: UseOrcamentoNoCaixaParams) {
  const qc = useQueryClient();
  const carregadoRef = useRef<string | null>(null);
  // O `aplicar` de quem chama muda a cada render (produtos chegando etc.):
  // usa sempre o mais novo, sem refazer a busca por isso.
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;

  const quoteId = orcamentoDaUrl(quoteParam);

  useEffect(() => {
    if (!quoteId || !enabled || !companyId) return;
    if (carregadoRef.current === quoteId) return;
    carregadoRef.current = quoteId;

    let vivo = true;
    let terminou = false;
    qc.fetchQuery({
      queryKey: chaveDoOrcamento(companyId, quoteId),
      queryFn: () => matconApi.getQuote(companyId, quoteId),
      staleTime: 60_000,
    })
      .then(({ quote }) => {
        if (!vivo) return;
        terminou = true;
        aplicarRef.current(quote);
        toast.success(avisoDoOrcamento(quote));
        // Tira o `quote` da URL: voltar/atualizar não remonta o carrinho.
        try { router.setParams({ quote: undefined } as any); } catch {}
      })
      .catch(() => {
        if (!vivo) return;
        terminou = true;
        toast.error("Não foi possível carregar o orçamento. Abra de novo pela tela de Orçamentos.");
      });

    return () => {
      vivo = false;
      // Saiu antes de terminar (desmontou, ou mudou empresa/toggle): a
      // próxima vez que o efeito rodar busca de novo em vez de achar que já
      // carregou.
      if (!terminou) carregadoRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, enabled, companyId]);
}
