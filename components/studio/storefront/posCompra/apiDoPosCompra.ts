// ============================================================
// components/studio/storefront/posCompra/apiDoPosCompra.ts
//
// As chamadas das páginas do pós-compra no endereço da loja.
//
// POR QUE NÃO studioApi: a casca da vitrine (loja.getaura.com.br e o
// domínio próprio da lojista) tem CSP com `connect-src` só para o
// endereço da API da vitrine (enderecoDaApi.ts). O `request` do painel
// fala com outro host e carrega a sessão do painel — nada disso existe
// aqui. As rotas são as mesmas: /aprovacao/:token e /acompanhar/:token
// (CORS aberto desde a Fase 4) e /storefront/:slug/studio/... .
//
// Os erros viram dois tipos, que a tela distingue: "não achamos esse
// pedido" (404/410, a voz da loja com o WhatsApp) e "não carregou"
// (rede, 5xx — com "Tentar de novo").
// ============================================================
import type { PublicApproval, PublicTrack } from "@/services/studioApi";
import { enderecoDaApi } from "../enderecoDaApi";
import type { RespostaDaRepeticao } from "../repeticaoDoPedido";

export type ErroDoPosCompra = Error & { tipo: "nao_encontrado" | "rede"; status: number | null };

function erro(tipo: ErroDoPosCompra["tipo"], status: number | null, mensagem?: string): ErroDoPosCompra {
  const e = new Error(mensagem || (tipo === "nao_encontrado" ? "Pedido não encontrado" : "Não carregou")) as ErroDoPosCompra;
  e.tipo = tipo;
  e.status = status;
  return e;
}

/** 404 e 410 são "não achamos"; o resto, falha de carregar. */
export function tipoDoErro(status: number | null | undefined): ErroDoPosCompra["tipo"] {
  return status === 404 || status === 410 ? "nao_encontrado" : "rede";
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(enderecoDaApi() + caminho, init);
  } catch {
    throw erro("rede", null);
  }
  let dados: any = null;
  try { dados = await r.json(); } catch { dados = null; }
  if (!r.ok) throw erro(tipoDoErro(r.status), r.status, dados?.error);
  return dados as T;
}

const seguro = (t: string) => encodeURIComponent(String(t || "").trim());

export const apiDoPosCompra = {
  aprovacao: (token: string) => pedir<PublicApproval>("/aprovacao/" + seguro(token)),

  responder: (token: string, corpo: { action: "approve" | "request_changes"; note?: string; referencia_url?: string }) =>
    pedir<{ ok: true; action: string; new_status: string; message: string }>(
      "/aprovacao/" + seguro(token) + "/respond",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) },
    ),

  acompanhamento: (token: string) => pedir<PublicTrack>("/acompanhar/" + seguro(token)),

  repetir: (slug: string, token: string) =>
    pedir<RespostaDaRepeticao>("/storefront/" + seguro(slug) + "/studio/pedido/" + seguro(token) + "/repetir"),

  /**
   * A referência do "Pedir ajuste": o MESMO upload público que a página
   * do produto usa para a foto da cliente. Devolve a URL.
   */
  enviarReferencia: (slug: string, arquivo: { base64: string; tipo: string; nome?: string }) =>
    pedir<{ url: string }>("/storefront/" + seguro(slug) + "/studio/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_base64: arquivo.base64, content_type: arquivo.tipo, filename: arquivo.nome }),
    }),
};
