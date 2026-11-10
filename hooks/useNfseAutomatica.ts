// ============================================================
// AURA. — NFS-e automática: opt-in da loja e situação de uma origem
//
// useNfseAutomaticaConfig: GET /nfse/automatica/config. `ativa` = liga do
//   servidor E opt-in da empresa. `emite` = a loja emite NFS-e pelo botão
//   (independe da automática). Backend sem a rota (404) ou erro = false
//   nos dois: a loja some do fluxo e o Caixa fica como sempre.
//
// useSituacaoNfse: GET /nfse/automatica/origem/:tipo/:id com polling LEVE
//   (1,5 s → 12 s, ~2 min no total). Para ao chegar num estado final, ao
//   sair da tela (unmount) ou ao esgotar as tentativas — aí `esgotou` e a
//   tela oferece "Atualizar". `aplicar` recebe a resposta de um POST
//   (emitir, completar, tentar de novo) e retoma o polling se precisar.
//
// Multi-CNPJ: companyId é o DA VENDA/OS (quem chama decide).
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { nfseAutomaticaApi, type OrigemNfse, type SituacaoNfse } from "@/services/nfseAutomaticaApi";
import { ehEstadoFinal, intervaloDoPolling, MAX_TENTATIVAS_POLLING } from "@/utils/nfseAutomatica";

export function useNfseAutomaticaConfig(companyId: string | null | undefined, enabled = true) {
  const q = useQuery({
    queryKey: ["nfse-automatica-config", companyId],
    queryFn: () => nfseAutomaticaApi.config(companyId as string),
    enabled: !!companyId && enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return {
    ativa: !!(q.data && q.data.ativa),
    emite: !!(q.data && q.data.emite),
    config: q.data || null,
    carregando: !!q.isLoading,
  };
}

type Opcoes = {
  companyId: string | null | undefined;
  tipo: OrigemNfse;
  id: string | null | undefined;
  enabled?: boolean;
  /** false = uma leitura só. */
  poll?: boolean;
  /** Telas de detalhe: 'nenhuma' (sem serviço, loja que não emite) para o
   *  polling. Na venda que acabou de fechar o gatilho ainda vai rodar. */
  nenhumaEhFinal?: boolean;
};

export function useSituacaoNfse({ companyId, tipo, id, enabled = true, poll = true, nenhumaEhFinal = false }: Opcoes) {
  const [situacao, setSituacao] = useState<SituacaoNfse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [esgotou, setEsgotou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<any>(null);
  const tentativa = useRef(0);
  const vivo = useRef(true);
  const geracao = useRef(0);

  const acabou = useCallback((s: SituacaoNfse) =>
    ehEstadoFinal(s.estado) || (nenhumaEhFinal && s.estado === "nenhuma"), [nenhumaEhFinal]);

  const parar = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  const ler = useCallback(async (g: number) => {
    if (!companyId || !id) return;
    try {
      const s = await nfseAutomaticaApi.situacao(companyId, tipo, id);
      if (!vivo.current || g !== geracao.current) return;
      setSituacao(s);
      setErro(null);
      setCarregando(false);
      if (!poll || acabou(s)) return;
    } catch (e: any) {
      if (!vivo.current || g !== geracao.current) return;
      setCarregando(false);
      // 404 = venda/OS de outra loja ou rota ausente: nada a mostrar.
      if (e && e.status === 404) { setSituacao(null); return; }
      setErro((e && e.message) || "Não deu para consultar a nota de serviço.");
      if (!poll) return;
    }
    if (tentativa.current >= MAX_TENTATIVAS_POLLING) { setEsgotou(true); return; }
    const espera = intervaloDoPolling(tentativa.current);
    tentativa.current += 1;
    timer.current = setTimeout(() => { timer.current = null; ler(g); }, espera);
  }, [companyId, tipo, id, poll, acabou]);

  const iniciar = useCallback(() => {
    parar();
    geracao.current += 1;
    tentativa.current = 0;
    setEsgotou(false);
    setCarregando(true);
    ler(geracao.current);
  }, [ler, parar]);

  useEffect(() => {
    vivo.current = true;
    if (enabled && companyId && id) iniciar();
    return () => { vivo.current = false; parar(); };
  }, [enabled, companyId, tipo, id, iniciar, parar]);

  /** Resposta de um POST: mostra já e, se ainda não acabou, volta a acompanhar. */
  const aplicar = useCallback((s: SituacaoNfse | null | undefined) => {
    if (!s) return;
    parar();
    geracao.current += 1;
    setSituacao(s);
    setEsgotou(false);
    if (poll && !acabou(s)) {
      tentativa.current = 0;
      const g = geracao.current;
      timer.current = setTimeout(() => { timer.current = null; ler(g); }, intervaloDoPolling(0));
    }
  }, [ler, parar, poll, acabou]);

  return { situacao, carregando, esgotou, erro, atualizar: iniciar, aplicar };
}
