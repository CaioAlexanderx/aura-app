// ============================================================
// AURA. — Caixa aberto pela condicional (C12, 26/11/2026)
//
// Lê ?condicional= &loja= &itens= da URL do Caixa e, SÓ com a trava
// (condicionalLiberada), busca a condicional na loja dona dela e monta o
// carrinho com as peças que ficaram: no preço do comprovante (unit_price da
// peça), cliente da condicional já escolhido.
//
// Sem a trava, sem os parâmetros ou fora da tela do Caixa: `ativa` é false,
// a busca nem nasce (enabled false) e nada mais neste arquivo roda.
//
// O contexto da venda (condicional, peças) é FIXADO quando o carrinho é
// montado. A busca só serve até aí (sem refetch ao focar a janela): uma busca
// nova que falhe ou volte "já cobrada" não desmonta o contexto, então o
// Concluir nunca manda uma venda comum com as peças da condicional.
//
// O modo condicional nunca grava nem apaga a venda guardada da lojista: ao
// entrar esvazia só o carrinho em memória; ao sair, o Caixa a recupera.
//
// Estados: carregando · pronta (carrinho montado, travado) · bloqueada
// (peça já cobrada, condicional fechada, venda em andamento...: mostra a
// frase) · outra_loja (a loja do Caixa não é a dona) · erro.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { condicionalApi } from "@/hooks/useCondicional";
import {
  condicionalDaUrl, estadoDaCobranca, rotuloDaVariante, rotaDeVoltaDaCondicional,
  TEXTOS_DO_CAIXA_CONDICIONAL as T,
  type ParametrosDaCondicional,
} from "@/utils/condicionalNoCaixa";

export type CondicionalNoCarrinho = { id: string; itemIds: string[] };

export type EstadoDoCaixaCondicional =
  | { tipo: "carregando" }
  | { tipo: "pronta" }
  | { tipo: "bloqueada"; mensagem: string }
  | { tipo: "outra_loja"; mensagem: string }
  | { tipo: "erro"; mensagem: string };

type Params = {
  /** Trava CONDICIONAL_LIBERADA / equipe Aura. */
  liberada: boolean;
  /** Parâmetros crus da URL do Caixa. */
  rota: { condicional?: unknown; loja?: unknown; itens?: unknown } | null | undefined;
  /** A loja ativa do Caixa. */
  companyId: string | null | undefined;
  isDemo?: boolean;
  /** O carrinho em memória tem itens (venda comum em andamento). */
  temItens: boolean;
  /** Esvazia o carrinho em memória SEM tocar na venda guardada. */
  limpar: () => void;
  /** Depois de sair: o Caixa recupera a venda guardada, como ao abrir. */
  retomar: () => void;
  addToCart: (p: any, v?: any) => void;
  selectCustomer: (id: string | null, name: string | null, phone?: string | null) => void;
  /** Catálogo carregado (unidade e "sai em" do produto vão ao item). */
  produtos?: Array<{ id: string; unit?: string | null; notaFiscal?: any }>;
  /** Troca de loja (auth store). */
  trocarDeLoja?: (companyId: string) => Promise<any> | void;
};

/** O contexto da venda, fixado quando o carrinho é montado. */
type Fixado = { chave: string; id: string; itemIds: string[]; numero: string; cliente: string | null };

export function useCondicionalNoCaixa(p: Params) {
  const qc = useQueryClient();
  // Parâmetros lidos uma vez por valor de URL; sem a trava, nada vale.
  const pedido: ParametrosDaCondicional | null = useMemo(
    () => (p.liberada ? condicionalDaUrl(p.rota) : null),
    [p.liberada, p.rota && p.rota.condicional, p.rota && p.rota.loja, p.rota && p.rota.itens],
  );
  // Saiu: o pedido da URL deixa de valer mesmo se a URL ainda o trouxer.
  const [saiu, setSaiu] = useState<string | null>(null);
  const chaveDoPedido = pedido ? pedido.condicionalId + "|" + pedido.itemIds.join(",") : null;
  const ativa = !!pedido && saiu !== chaveDoPedido && !p.isDemo;
  // A URL ficou sem condicional (Sair, venda feita): a próxima cobrança, mesmo
  // das mesmas peças, começa do zero.
  useEffect(() => { if (!chaveDoPedido) setSaiu(null); }, [chaveDoPedido]);
  // A recusa COND_* do servidor na hora de concluir (a frase é dele).
  const [erroDaVenda, setErroDaVenda] = useState<string | null>(null);
  const [fixadoBruto, setFixado] = useState<Fixado | null>(null);
  const fixado = ativa && fixadoBruto && fixadoBruto.chave === chaveDoPedido ? fixadoBruto : null;

  const lojaDona = pedido ? (pedido.loja || p.companyId || null) : null;
  const outraLoja = ativa && !!lojaDona && !!p.companyId && lojaDona !== p.companyId;

  // A busca só serve até o carrinho ser montado; depois o contexto está
  // fixado e uma busca nova (foco da janela, rede) não pode desmontá-lo.
  const q = useQuery({
    queryKey: ["condicional-detalhe", lojaDona, pedido ? pedido.condicionalId : null],
    queryFn: () => condicionalApi.detalhe(lojaDona as string, pedido!.condicionalId),
    enabled: ativa && !outraLoja && !!lojaDona && !fixado,
    // A cobrança precisa do estado de agora: sem cache velho.
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
  const detalhe = q.data ? q.data.condicional : null;

  const cobranca = useMemo(
    () => (ativa && detalhe && pedido ? estadoDaCobranca(detalhe, pedido.itemIds) : null),
    [ativa, detalhe, pedido],
  );
  // Venda comum em andamento no carrinho: não se mistura com a condicional.
  const vendaEmAndamento = ativa && !fixado && p.temItens;

  // Monta o carrinho uma vez por (condicional, peças) e fixa o contexto.
  const montado = useRef<string | null>(null);
  useEffect(() => {
    if (!ativa || vendaEmAndamento || !detalhe || !cobranca || cobranca.tipo !== "pronta" || !chaveDoPedido || !pedido) return;
    if (montado.current === chaveDoPedido) return;
    montado.current = chaveDoPedido;
    p.limpar();
    // Mesmo produto+variante com preços diferentes: uma linha por preço (chave com "~cN").
    const precosPorBase = new Map<string, number[]>();
    cobranca.pecas.forEach((peca) => {
      const preco = Number(peca.unit_price) || 0;
      const base = peca.product_id + "|" + (peca.variant_id || "");
      const lista = precosPorBase.get(base) || [];
      let idx = lista.indexOf(preco);
      if (idx < 0) { lista.push(preco); idx = lista.length - 1; }
      precosPorBase.set(base, lista);
      const suf = idx > 0 ? "~c" + (idx + 1) : "";
      const doCatalogo = (p.produtos || []).find((x) => x.id === peca.product_id);
      const produto: any = {
        id: peca.variant_id ? peca.product_id : peca.product_id + suf,
        name: peca.product_name, price: preco, refPrice: preco, cardPrice: null,
        ...(doCatalogo && doCatalogo.unit ? { unit: doCatalogo.unit } : {}),
        ...(doCatalogo && doCatalogo.notaFiscal ? { notaFiscal: doCatalogo.notaFiscal } : {}),
      };
      if (peca.variant_id) {
        p.addToCart(produto, { id: peca.variant_id + suf, label: rotuloDaVariante(peca) || "variante", price: preco });
      } else {
        p.addToCart(produto);
      }
    });
    p.selectCustomer(detalhe.customer_id || null, detalhe.customer_name || null, detalhe.customer_phone || null);
    setFixado({ chave: chaveDoPedido, id: pedido.condicionalId, itemIds: pedido.itemIds, numero: detalhe.numero_exibicao, cliente: detalhe.customer_name || null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativa, vendaEmAndamento, detalhe, cobranca, chaveDoPedido]);

  // Parâmetro novo (outra condicional) ou saída: o carrinho montado é esquecido.
  useEffect(() => {
    if (!chaveDoPedido) { montado.current = null; setFixado(null); }
  }, [chaveDoPedido]);

  function tirarDaUrl() {
    try { router.setParams({ condicional: undefined, loja: undefined, itens: undefined } as any); } catch {}
  }

  /** "Sair": volta ao Caixa normal, carrinho limpo, nada gravado; a venda guardada volta. */
  function sair() {
    setErroDaVenda(null);
    setSaiu(chaveDoPedido);
    montado.current = null;
    setFixado(null);
    p.limpar();
    p.retomar();
    tirarDaUrl();
  }

  /** "Voltar à condicional": sai e abre o detalhe dela em Vendas. */
  function voltarACondicional() {
    const id = pedido ? pedido.condicionalId : null;
    sair();
    if (id) { try { router.push(rotaDeVoltaDaCondicional(id, lojaDona) as any); } catch {} }
  }

  function trocarDeLoja() {
    if (!lojaDona || !p.trocarDeLoja) return;
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const caminho = window.location.pathname + window.location.search;
        if (caminho && caminho !== "/") window.sessionStorage.setItem("aura_post_switch_redirect", caminho);
      }
    } catch {}
    Promise.resolve(p.trocarDeLoja(lojaDona)).catch(() => {});
  }

  /** O servidor recusou a venda (409/422 COND_*): mostra a frase dele. */
  function aoErro(err: any) {
    const frase = String((err && err.data && err.data.error) || (err && err.message) || "").trim();
    setErroDaVenda(frase || T.jaCobrada);
    // A condicional mudou em outro lugar: o detalhe e a lista se atualizam.
    qc.invalidateQueries({ queryKey: ["condicionais"] });
  }

  /** Depois da venda: lista, detalhe, peças para resolver e estoque se atualizam. */
  function aoVender() {
    qc.invalidateQueries({ queryKey: ["condicionais"] });
    qc.invalidateQueries({ queryKey: ["condicional-detalhe"] });
    qc.invalidateQueries({ queryKey: ["para-resolver"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    // A venda saiu: o Caixa volta ao normal na próxima venda.
    setErroDaVenda(null);
    setSaiu(chaveDoPedido);
    montado.current = null;
    setFixado(null);
    tirarDaUrl();
  }

  let estado: EstadoDoCaixaCondicional | null = null;
  if (ativa) {
    if (outraLoja) estado = { tipo: "outra_loja", mensagem: T.outraLoja };
    else if (fixado) estado = { tipo: "pronta" };
    else if (vendaEmAndamento) estado = { tipo: "bloqueada", mensagem: T.vendaEmAndamento };
    else if (q.isError) estado = { tipo: "erro", mensagem: T.erroAoAbrir };
    else if (!detalhe) estado = { tipo: "carregando" };
    else if (cobranca && cobranca.tipo === "bloqueada") estado = { tipo: "bloqueada", mensagem: cobranca.mensagem };
    else estado = { tipo: "pronta" };
  }

  return {
    ativa,
    estado,
    /** Só com a cobrança pronta o carrinho é o da condicional (trava, "Concluir a venda"). */
    travada: ativa && !!estado && (estado.tipo === "pronta" || !!erroDaVenda),
    /** A frase de recusa (do servidor) ou do estado bloqueado; null = nada a avisar. */
    aviso: (erroDaVenda || (estado && (estado.tipo === "bloqueada" || estado.tipo === "outra_loja" || estado.tipo === "erro") ? estado.mensagem : null)) as string | null,
    numero: fixado ? fixado.numero : (detalhe ? detalhe.numero_exibicao : ""),
    cliente: fixado ? fixado.cliente : (detalhe ? detalhe.customer_name : null),
    /** O que vai no POST da venda: o contexto fixado na montagem, nunca o estado de uma busca. */
    naVenda: (fixado ? { id: fixado.id, itemIds: fixado.itemIds } : null) as CondicionalNoCarrinho | null,
    sair, voltarACondicional, trocarDeLoja, aoVender, aoErro,
    tentarDeNovo: () => { q.refetch(); },
  };
}
