// ============================================================
// useChaveDaVenda (tq-18, 18/10/2026): a chave de idempotência de uma tela
// que registra venda fora do Caixa (checkout do Studio, OS de óculos com
// sinal, venda retroativa do Financeiro). Regras em utils/chaveDaVenda.
//
//   atual()      a chave desta tentativa de venda (a mesma até concluir)
//   concluida()  a venda foi registrada: a próxima é outra venda
//   aposErro(e)  troca a chave só no 409 IDEMPOTENCY_KEY_REUSED; timeout,
//                queda de rede e qualquer outro erro mantêm a mesma
//
// `escopo` (ex.: "financeiro:<empresa>"): a chave pendente sobrevive à tela
// ou ao modal fechado. Sem isso, "deu timeout, fechei, abri de novo e lancei
// a mesma venda" mandava outra chave e gravava a venda duas vezes. Com o
// escopo, a repetição volta com a mesma chave: o servidor devolve a venda
// já gravada, ou, se a pessoa montou outra venda, responde 409 dizendo qual
// venda a chave registrou (e a chave é trocada para o próximo envio) — em
// vez de duplicar calado. Vive na memória da aba (some no recarregar), um
// escopo por fluxo e por empresa.
//
// Ref/Map, e não estado: trocar a chave não redesenha a tela, e quem lê no
// momento do POST sempre vê o valor mais novo.
// ============================================================
import { useMemo, useRef } from "react";
import { novaChaveDaVenda, chaveDaVendaJaUsada } from "@/utils/chaveDaVenda";

export type ChaveDaVenda = {
  atual: () => string;
  concluida: () => void;
  aposErro: (err: any) => void;
};

const chavesPorEscopo = new Map<string, string>();

/** Só para testes: esquece as chaves pendentes de todos os escopos. */
export function __zerarChavesDaVendaParaTestes() {
  chavesPorEscopo.clear();
}

export function useChaveDaVenda(escopo?: string | null): ChaveDaVenda {
  const local = useRef<string | null>(null);
  const escopoRef = useRef(escopo);
  escopoRef.current = escopo;
  return useMemo<ChaveDaVenda>(() => {
    function atual(): string {
      const e = escopoRef.current;
      if (e) {
        let k = chavesPorEscopo.get(e);
        if (!k) { k = novaChaveDaVenda(); chavesPorEscopo.set(e, k); }
        return k;
      }
      if (!local.current) local.current = novaChaveDaVenda();
      return local.current;
    }
    function trocar() {
      const k = novaChaveDaVenda();
      const e = escopoRef.current;
      if (e) chavesPorEscopo.set(e, k);
      else local.current = k;
    }
    return {
      atual,
      concluida: trocar,
      aposErro: (err: any) => { if (chaveDaVendaJaUsada(err)) trocar(); },
    };
  }, []);
}
