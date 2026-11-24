// ============================================================
// AURA. — Em quais lojas o lote entra (20/11/2026, A2 · D14)
//
// Lê a lista de lojas do servidor quando o lote abre (nunca do token) e
// guarda a escolha: a loja ativa sempre marcada, as outras à escolha, e de
// qual loja é o estoque. Sem react-query de propósito: os modais de lote
// já são testados sem QueryClientProvider, e erro aqui só esconde o campo.
// ============================================================
import { useEffect, useState } from "react";
import { lojasDoProdutoApi, type RespostaLojasParaCadastro } from "@/services/lojasDoProdutoApi";
import {
  campoDeLojas, corpoDasLojasDoLote, lojasEscolhidas,
  type CampoDeLojas, type CorpoDasLojasDoLote,
} from "@/components/screens/estoque/item-form/lojasDoCadastro";
import type { LojaParaCadastro } from "@/services/lojasDoProdutoApi";

export type LojasDoLote = {
  campo: CampoDeLojas;
  ativaId: string;
  /** Inclui a ativa. */
  marcadas: string[];
  escolhidas: LojaParaCadastro[];
  estoqueEm: string;
  alternar: (companyId: string) => void;
  escolherEstoque: (companyId: string) => void;
  /** null = 1 loja só: o corpo do pedido é o de hoje. */
  corpo: (comEstoque: boolean) => CorpoDasLojasDoLote | null;
};

export function useLojasDoLote(companyId: string | null | undefined, aberto: boolean): LojasDoLote {
  const ativaId = companyId ? String(companyId) : "";
  const [resp, setResp] = useState<RespostaLojasParaCadastro | null>(null);
  const [outras, setOutras] = useState<string[]>([]);
  const [estoqueEm, setEstoqueEm] = useState<string | null>(null);

  useEffect(() => {
    setOutras([]);
    setEstoqueEm(null);
    if (!aberto || !ativaId) { setResp(null); return; }
    let vivo = true;
    (async () => {
      try {
        const r = await lojasDoProdutoApi.lojasParaCadastro(ativaId);
        if (vivo) setResp(r || null);
      } catch (_) {
        if (vivo) setResp(null);
      }
    })();
    return () => { vivo = false; };
  }, [aberto, ativaId]);

  const campo = campoDeLojas(resp, ativaId);
  const marcadas = [ativaId, ...outras];
  const escolhidas = lojasEscolhidas(campo, marcadas);
  const estoqueDe = estoqueEm && escolhidas.some((l) => String(l.company_id) === estoqueEm) ? estoqueEm : ativaId;

  return {
    campo,
    ativaId,
    marcadas,
    escolhidas,
    estoqueEm: estoqueDe,
    alternar: (id: string) => {
      if (!id || id === ativaId) return;
      setOutras((m) => (m.indexOf(id) >= 0 ? m.filter((x) => x !== id) : [...m, id]));
    },
    escolherEstoque: (id: string) => setEstoqueEm(id),
    corpo: (comEstoque: boolean) => corpoDasLojasDoLote(campo, outras, ativaId, estoqueDe, comEstoque),
  };
}
