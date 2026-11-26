// ============================================================
// AURA. — Caixa aberto pela condicional (C12, 26/11/2026)
//
// "Cobrar no Caixa" (detalhe da condicional) leva a
//   /pdv?condicional=<id>&loja=<company_id>&itens=<id,id,...>
// e o Caixa monta uma venda só com as peças que ficaram, no preço do
// comprovante, travada (sem acrescentar produto nem tirar peça). Sair volta
// ao Caixa normal, carrinho limpo e nada gravado. Contrato do servidor:
// Aura-backend#1117 (POST /pdv/sale com condicional_id e
// condicional_item_ids; 409 COND_JA_COBRADA / COND_FECHADA / ...).
//
// Tudo isto só roda com CONDICIONAL_LIBERADA (ou equipe Aura): sem a trava,
// os parâmetros da URL são ignorados e o Caixa é o de sempre.
//
// Este arquivo é só regra e texto (sem React), para testar sem render.
// ============================================================
import type { DetalheDaCondicional, PecaDaCondicional } from "@/hooks/useCondicional";

export const TEXTOS_DO_CAIXA_CONDICIONAL = {
  faixa: (numero: string, cliente: string | null) =>
    "Cobrando a condicional " + numero + (cliente ? " · " + cliente : ""),
  faixaSub: "Só as peças que ficaram, pelo preço do comprovante. Para vender outra coisa, saia da condicional.",
  sair: "Sair",
  sairDaCondicional: "Sair da condicional",
  concluir: "Concluir a venda",
  carrinho: (numero: string) => "Condicional " + numero,
  carregando: "Abrindo a condicional…",
  travado: "Esta venda é da condicional. Para vender outra coisa, saia da condicional.",
  travadoPeca: "As peças da condicional não mudam aqui. Para tirar uma peça, volte à condicional.",
  voltarACondicional: "Voltar à condicional",
  trocarDeLoja: "Trocar para a loja da condicional",
  outraLoja: "Esta condicional é de outra loja. Troque para ela para cobrar no Caixa.",
  jaCobrada: "Estas peças já foram cobradas em outra venda.",
  encerrada: "Esta condicional já foi concluída e não muda mais.",
  cancelada: "Esta condicional foi cancelada e não muda mais.",
  semPecas: "Nenhuma peça desta condicional está esperando cobrança.",
  erroAoAbrir: "Não deu para abrir a condicional. Tente de novo.",
  tentarDeNovo: "Tentar de novo",
  vendida: "Venda registrada. A condicional foi atualizada.",
} as const;

export type ParametrosDaCondicional = {
  condicionalId: string;
  /** company_id da loja DONA da condicional (null = a loja do Caixa). */
  loja: string | null;
  itemIds: string[];
};

function umTexto(v: unknown): string | null {
  const bruto = Array.isArray(v) ? v[0] : v;
  if (typeof bruto !== "string") return null;
  const t = bruto.trim();
  if (!t || t === "undefined" || t === "null") return null;
  return t;
}

/** Os parâmetros da URL do Caixa, ou null (Caixa normal). Sem id ou sem peças = null. */
export function condicionalDaUrl(params: { condicional?: unknown; loja?: unknown; itens?: unknown } | null | undefined): ParametrosDaCondicional | null {
  const id = umTexto(params && params.condicional);
  if (!id) return null;
  const itens = (umTexto(params && params.itens) || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!itens.length) return null;
  return { condicionalId: id, loja: umTexto(params && params.loja), itemIds: Array.from(new Set(itens)) };
}

/** A rota do Caixa para cobrar estas peças. */
export function rotaDoCaixaDaCondicional(c: Pick<DetalheDaCondicional, "id" | "company_id">, itemIds: string[]): string {
  return "/pdv?condicional=" + encodeURIComponent(c.id) +
    "&loja=" + encodeURIComponent(c.company_id) +
    "&itens=" + itemIds.map(encodeURIComponent).join(",");
}

/** A rota de volta: o detalhe da condicional, na aba Condicionais de Vendas. */
export function rotaDeVoltaDaCondicional(condicionalId: string, loja: string | null | undefined): string {
  return "/vendas?tab=condicionais&condicional=" + encodeURIComponent(condicionalId) +
    (loja ? "&loja=" + encodeURIComponent(loja) : "");
}

/** As peças que a cobrança leva: as que ficaram e ainda não têm venda (ids em ordem da condicional). */
export function idsParaCobrar(c: Pick<DetalheDaCondicional, "items">, marcadasFicou: string[]): string[] {
  const marcadas = new Set(marcadasFicou);
  return c.items
    .filter((i) => (i.situacao === "ficou" && !i.sale_id) || (marcadas.has(i.id) && i.situacao === "com_cliente" && !i.sale_id))
    .map((i) => i.id);
}

export type EstadoDaCobranca =
  | { tipo: "pronta"; pecas: PecaDaCondicional[] }
  | { tipo: "bloqueada"; motivo: "ja_cobrada" | "encerrada" | "cancelada" | "sem_pecas"; mensagem: string };

/** Confere o detalhe do servidor com as peças da URL. */
export function estadoDaCobranca(c: DetalheDaCondicional, itemIds: string[]): EstadoDaCobranca {
  const T = TEXTOS_DO_CAIXA_CONDICIONAL;
  const escolhidas = itemIds.map((id) => c.items.find((i) => i.id === id)).filter(Boolean) as PecaDaCondicional[];
  const cobrada = escolhidas.find((i) => !!i.sale_id);
  if (cobrada) {
    const n = cobrada.venda_numero;
    const tem = n !== undefined && n !== null && String(n) !== "";
    return { tipo: "bloqueada", motivo: "ja_cobrada", mensagem: tem ? "Estas peças já foram cobradas na venda #" + n + "." : T.jaCobrada };
  }
  if (c.status === "cancelada") return { tipo: "bloqueada", motivo: "cancelada", mensagem: T.cancelada };
  if (c.status !== "aberta") return { tipo: "bloqueada", motivo: "encerrada", mensagem: T.encerrada };
  const cobraveis = escolhidas.filter((i) => i.situacao === "com_cliente" || i.situacao === "ficou");
  if (!cobraveis.length || cobraveis.length !== itemIds.length) {
    return { tipo: "bloqueada", motivo: "sem_pecas", mensagem: T.semPecas };
  }
  return { tipo: "pronta", pecas: cobraveis };
}

/** Os dois campos do POST /pdv/sale. Sem condicional no carrinho: objeto vazio (corpo idêntico ao de sempre). */
export function camposDaCondicionalNaVenda(c: { id: string; itemIds: string[] } | null | undefined): { condicional_id?: string; condicional_item_ids?: string[] } {
  if (!c || !c.id || !c.itemIds || !c.itemIds.length) return {};
  return { condicional_id: c.id, condicional_item_ids: c.itemIds };
}

/** O erro é de uma recusa COND_* do servidor? (409/422 com code COND_...) */
export function ehErroDaCondicional(err: any): boolean {
  const code = err && err.data && err.data.code;
  return typeof code === "string" && code.indexOf("COND_") === 0;
}

/** "Cor · tamanho" da peça no carrinho: o rótulo da variante. */
export function rotuloDaVariante(p: PecaDaCondicional): string {
  const partes = [p.color_name, p.size_label].filter(Boolean) as string[];
  if (partes.length) return partes.join(" · ");
  return p.variant_label || "";
}
