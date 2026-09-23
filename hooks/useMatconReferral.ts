// ============================================================
// AURA. — Matcon M3: Profissionais Parceiros — "Indicado por" do Caixa
//
// 22/09/2026. Isola a busca de profissionais (matconApi.searchProfessionals)
// e a seleção do "indicado por" da venda — docs/CONTRACT_MATCON.md (seção
// M3) e o mockup docs/mockups/matcon-m3-clube-calculadora.html #caixa.
// IndicadoPorChip só renderiza texto/toque; toda a lógica mora aqui.
//
// Só ativo com matcon_enabled && matcon_club_enabled — matcon_club_enabled
// desliga o chip e a busca sem desligar o resto do Matcon (a mesma loja
// pode manter orçamentos/entregas e desligar só o clube). Quem chama
// (usePdvState) já leu readMatconSettings uma vez; aqui só recebemos os
// dois booleans + o matcon_points_per_100 já resolvido — nenhuma leitura
// de pdv_settings duplicada (mesmo padrão de useMatconQuote.ts).
//
// `select`/`clear` só mexem no estado local (quem é o profissional
// exibido no chip); é quem chama (usePdvState) que sincroniza isso com
// useCart.setReferredProfessionalId — o hook não conhece o carrinho.
//
// QA 23/09/2026: a busca que FALHA (rota ainda não existia, sem internet)
// caía no mesmo lugar da busca sem resultado — o balcão lia "Nenhum
// parceiro com esse nome" e cadastrava o pedreiro de novo. Agora
// `searchError` separa os dois casos.
// ============================================================
import { useRef, useState } from "react";
import { matconApi, type Professional } from "@/services/matconApi";

const SEARCH_DEBOUNCE_MS = 300;

export type UseMatconReferralParams = {
  companyId: string | null | undefined;
  matconEnabled: boolean;
  clubEnabled: boolean;
  /** matcon_points_per_100 já resolvido (readMatconSettings). */
  pointsPer100: number;
};

export function useMatconReferral(params: UseMatconReferralParams) {
  const { companyId, matconEnabled, clubEnabled, pointsPer100 } = params;
  const active = matconEnabled && clubEnabled;

  const [referred, setReferred] = useState<Professional | null>(null);
  const [results, setResults] = useState<Professional[]>([]);
  const [searching, setSearching] = useState(false);
  // A última busca falhou (≠ busca sem resultado).
  const [searchError, setSearchError] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Descarta resposta de uma busca anterior que chegou depois da mais
  // recente (digitação rápida disparando várias chamadas em paralelo).
  const requestSeqRef = useRef(0);

  function search(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = (q || "").trim();

    // Clube desligado (ou sem empresa/termo): nada de rede — a busca nem
    // existe fora do toggle ligado.
    if (!active || !companyId || query.length === 0) {
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return;
    }

    setSearching(true);
    setSearchError(false);
    const seq = ++requestSeqRef.current;
    debounceRef.current = setTimeout(() => {
      matconApi.searchProfessionals(companyId, query)
        .then(({ professionals }) => {
          if (requestSeqRef.current !== seq) return;
          setResults(professionals || []);
        })
        .catch(() => {
          if (requestSeqRef.current !== seq) return;
          setResults([]);
          setSearchError(true);
        })
        .finally(() => {
          if (requestSeqRef.current === seq) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
  }

  function select(p: Professional) {
    setReferred(p);
    setResults([]);
    setSearchError(false);
  }

  function clear() {
    setReferred(null);
    setResults([]);
    setSearchError(false);
  }

  // pontos = floor(total / 100) × matcon_points_per_100
  // (docs/CONTRACT_MATCON.md, M3 — "Venda indicada"). Clube desligado nunca
  // promete pontos, mesmo se chamado com um total válido.
  function pontosPrevistos(total: number): number {
    if (!active) return 0;
    const t = Number(total) || 0;
    return Math.floor(t / 100) * pointsPer100;
  }

  return {
    active,
    referred, select, clear,
    search, results, searching, searchError,
    pontosPrevistos,
  };
}
