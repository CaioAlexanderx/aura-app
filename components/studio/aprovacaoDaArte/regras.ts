// ============================================================
// AURA Studio · Pedir aprovação da arte: regras puras (27/11/2026)
//
// Mockup da Nina: Personalizados → Produção → pedido → "Pedir aprovação
// da arte". Aqui ficam as contas e os textos, sem tela, para testar.
// ============================================================
import type { EtapaDoRender } from "@/components/studio/visualEngine/gerarRenderAprovacao";
import { reais } from "@/components/studio/orcamentoVideo/condicoesDoOrcamento";

export { reais };

export type ItemDaPrevia = { quantidade: number; nome: string; valor: number };

/** Primeiro nome, com a primeira letra maiúscula. "ana paula" → "Ana". */
export function primeiroNomeDe(nome: string | null | undefined): string {
  const p = String(nome || "").trim().split(/\s+/)[0] || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : "";
}

/** "Oi, Ana. A arte do seu pedido ficou pronta. Dá uma olhada e me diz se posso produzir:" */
export function mensagemPadrao(nome: string | null | undefined): string {
  const n = primeiroNomeDe(nome);
  return `Oi${n ? ", " + n : ""}. A arte do seu pedido ficou pronta. Dá uma olhada e me diz se posso produzir:`;
}

/** O campo que a Aura preenche com o link da aprovação (a pílula dentro do texto). */
export const CAMPO_LINK = "link da aprovação";
const MARCA_DO_CAMPO = `{${CAMPO_LINK}}`;

/** A mensagem de partida: o texto e, no fim, a pílula do link. */
export function mensagemInicial(nome: string | null | undefined): string {
  return `${mensagemPadrao(nome)} ${MARCA_DO_CAMPO}`;
}

/**
 * O texto que vai ao WhatsApp: a pílula vira o link. Se a lojista apagou a
 * pílula, o link entra na linha de baixo, para a cliente nunca receber a
 * mensagem sem ele.
 */
export function textoComLink(mensagem: string, link: string): string {
  const m = String(mensagem || "").trim();
  if (m.includes(MARCA_DO_CAMPO)) return m.split(MARCA_DO_CAMPO).join(link);
  return m ? `${m}\n${link}` : link;
}

/** O que vai ao servidor em custom_message: a pílula vira o marcador {link}. */
export function textoParaOServidor(mensagem: string): string {
  const m = String(mensagem || "").trim();
  if (m.includes(MARCA_DO_CAMPO)) return m.split(MARCA_DO_CAMPO).join("{link}");
  return m ? `${m}\n{link}` : "{link}";
}

/** Só dígitos do telefone. */
export function digitos(v: string | null | undefined): string {
  return String(v || "").replace(/\D/g, "");
}

/** Telefone com DDD (10 ou 11 dígitos), ou com 55 na frente (12 ou 13). */
export function telefoneValido(v: string | null | undefined): boolean {
  const d = digitos(v);
  if (d.length === 10 || d.length === 11) return true;
  return (d.length === 12 || d.length === 13) && d.startsWith("55");
}

/** wa.me para o número da cliente, com DDI 55 quando vier só DDD + número. */
export function linkDoWhatsApp(telefone: string | null | undefined, texto: string): string | null {
  let d = digitos(telefone);
  if (!telefoneValido(d)) return null;
  if (d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

/**
 * Progresso (0 a 1) da barra, da leitura do pedido ao envio do arquivo. A
 * gravação do giro (`f`, 0 a 1) ocupa a maior parte da barra.
 */
export function progressoDaGeracao(etapa: EtapaDoRender | null, f: number = 0): number {
  const g = Math.max(0, Math.min(1, Number(f) || 0));
  switch (etapa) {
    case "pedido": return 0.04;
    case "mockup": return 0.4;
    case "video": return 0.08 + g * 0.8;
    case "arquivo": return 0.92;
    case "envio": return 0.96;
    default: return 0.02;
  }
}

/** Itens da prévia (a página que a cliente abre): quantidade × nome, valor da linha. */
export function itensDaPrevia(
  itens: Array<{ product_name?: string | null; quantity?: number | string | null; unit_price?: number | string | null }> | null | undefined,
): ItemDaPrevia[] {
  return (itens || []).map((i) => {
    const q = Number(i.quantity) || 1;
    return { quantidade: q, nome: String(i.product_name || "Item"), valor: q * (Number(i.unit_price) || 0) };
  });
}

/** "1 × Camiseta Básica Branca" (quantidade com vírgula quando fracionada). */
export function rotuloDoItem(i: ItemDaPrevia): string {
  const q = Number.isInteger(i.quantidade) ? String(i.quantidade) : String(i.quantidade).replace(".", ",");
  return `${q} × ${i.nome}`;
}

/** O arquivo é vídeo? (pela extensão, ignorando a query) */
export function ehVideo(url: string | null | undefined): boolean {
  const p = String(url || "").split("?")[0].toLowerCase();
  return p.endsWith(".webm") || p.endsWith(".mp4");
}

export function ehPdf(url: string | null | undefined): boolean {
  return String(url || "").split("?")[0].toLowerCase().endsWith(".pdf");
}

export type Anexo = {
  url: string;
  isVideo: boolean;
  renderId: string | null;
  origem: "gerado" | "arquivo";
};

/** O selo do cartão "O que vai para a cliente". */
export function seloDoAnexo(a: Anexo, duracaoS: number): string {
  if (a.origem === "arquivo") return "✓ Arquivo pronto";
  return a.isVideo ? `✓ Vídeo pronto · ${duracaoS} s` : "✓ Imagem pronta";
}
