// ============================================================
// components/studio/storefront/posCompra/PaginasDoPosCompra.tsx
//
// As duas páginas no endereço da loja (decisão do PO, Q9 · Fase 4):
//   loja.getaura.com.br/<slug>/aprovacao/<token>
//   loja.getaura.com.br/<slug>/acompanhar/<token>
//
// Buscam o pedido pelo token (apiDoPosCompra — a API da vitrine, a única
// que a CSP da casca deixa chamar) e desenham com a marca que vem NO
// PEDIDO. A loja do endereço só é usada quando o pedido não existe, para
// a página de erro falar com a voz da loja certa.
//
// Funcionam com a chave `vitrine_v2` ligada ou não: é só um endereço
// novo. A chave decide para onde a loja MANDA os links (backend,
// marcaDaLoja.js) e se o endereço antigo troca de cara.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import type { PublicApproval, PublicTrack } from "@/services/studioApi";
import { apiDoPosCompra, type ErroDoPosCompra } from "./apiDoPosCompra";
import { AcompanhamentoComMarca } from "./AcompanhamentoComMarca";
import { AprovacaoComMarca } from "./AprovacaoComMarca";
import { CarregandoNaLoja } from "./MolduraDaLoja";
import { PedidoNaoEncontrado, useMarcaPeloSlug } from "./PedidoNaoEncontrado";

type Carga<T> =
  | { estado: "carregando" }
  | { estado: "pronto"; dados: T }
  | { estado: "erro"; tipo: ErroDoPosCompra["tipo"] };

function useCarga<T>(token: string, buscar: (token: string) => Promise<T>) {
  const [carga, setCarga] = useState<Carga<T>>({ estado: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let vivo = true;
    if (!token) { setCarga({ estado: "erro", tipo: "nao_encontrado" }); return; }
    setCarga({ estado: "carregando" });
    buscar(token)
      .then((dados) => { if (vivo) setCarga({ estado: "pronto", dados }); })
      .catch((e: ErroDoPosCompra) => { if (vivo) setCarga({ estado: "erro", tipo: e?.tipo || "rede" }); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tentativa]);
  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);
  return { carga, recarregar };
}

export function PaginaDaAprovacao({ slug, token }: { slug: string; token: string }) {
  const { carga, recarregar } = useCarga<PublicApproval>(token, apiDoPosCompra.aprovacao);
  const marcaDaLoja = useMarcaPeloSlug(slug, carga.estado === "erro");
  if (carga.estado === "carregando") return <CarregandoNaLoja />;
  if (carga.estado === "erro") {
    return <PedidoNaoEncontrado marca={marcaDaLoja} motivo={carga.tipo} onTentarDeNovo={recarregar} />;
  }
  return <AprovacaoComMarca token={token} dados={carga.dados} responder={apiDoPosCompra.responder} />;
}

export function PaginaDoAcompanhamento({ slug, token }: { slug: string; token: string }) {
  const { carga, recarregar } = useCarga<PublicTrack>(token, apiDoPosCompra.acompanhamento);
  const marcaDaLoja = useMarcaPeloSlug(slug, carga.estado === "erro");
  const outroTipo = carga.estado === "pronto" && !!carga.dados.tipo;
  // OS da ótica e entrega do Matcon têm página própria (DANFE, entrega
  // parcial): um link desses colado no endereço de uma loja Studio vai
  // para ela, em vez de uma página que não sabe mostrá-los.
  useEffect(() => {
    if (outroTipo) router.replace(("/acompanhar/" + encodeURIComponent(token)) as any);
  }, [outroTipo, token]);
  if (carga.estado === "carregando") return <CarregandoNaLoja />;
  if (carga.estado === "erro") {
    return <PedidoNaoEncontrado marca={marcaDaLoja} motivo={carga.tipo} onTentarDeNovo={recarregar} />;
  }
  if (outroTipo) return <CarregandoNaLoja />;
  return <AcompanhamentoComMarca token={token} dados={carga.dados} />;
}
