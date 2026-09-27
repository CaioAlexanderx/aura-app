// ============================================================
// components/studio/storefront/leituraDaCor.ts
//
// O que acontece com a cor da lojista na vitrine — em português.
//
// O motor de tema já sabe ajustar qualquer hex até ele ser legível
// (theme.ts: parLegivel, corLegivelSobre). O que faltava era CONTAR
// isso para quem escolhe a cor.
//
// A Sheid escolheu `#1a1612`, quase preto. No papel quente ela sobrevive
// intacta; no modo escuro ela viraria cinza para ser legível — a
// legibilidade salva, a identidade não. A lojista não tem como saber
// disso olhando um seletor de cor.
//
// Fica separado da tela porque é regra, e regra precisa de teste.
// ============================================================
import { montarTema, contraste, type ModoVitrine } from "./theme";

/** O piso da WCAG para texto normal. O motor inteiro persegue isto. */
export const MINIMO_AA = 4.5;

export type LeituraDaCor = {
  /** A cor como a lojista digitou. */
  original: string;
  /** Como ela vai aparecer escrita na loja. */
  comoTexto: string;
  /** O preenchimento do botão, e a tinta que fica por cima dele. */
  botao: { fundo: string; tinta: string };
  /** Contraste do texto da marca sobre o fundo da loja. */
  contrasteTexto: number;
  /** Contraste dentro do botão. */
  contrasteBotao: number;
  /** A cor sobreviveu inteira, ou o motor teve de mexer nela? */
  intacta: boolean;
  /** Uma frase para a lojista, sem jargão. */
  recado: string;
  /** 'ok' quando nada mudou; 'ajustada' quando mexeu; 'fraca' quando mexeu muito. */
  tom: "ok" | "ajustada" | "fraca";
};

/** Duas cores são "a mesma" quando batem letra a letra, ignorando caixa. */
function mesma(a: string, b: string): boolean {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

/**
 * Lê a cor da loja no modo em que a vitrine realmente roda.
 *
 * O modo é parâmetro porque a decisão é de marca: a vitrine Studio roda
 * em papel quente, e a mesma cor tem sorte diferente em fundo escuro.
 */
export function lerCorDaLoja(hex: string, modo: ModoVitrine = "papel"): LeituraDaCor {
  const tema = montarTema(hex, modo);
  const comoTexto = tema.marcaTexto;
  const botao = { fundo: tema.marcaFill, tinta: tema.sobreMarca };
  const contrasteTexto = contraste(comoTexto, tema.bg);
  const contrasteBotao = contraste(botao.fundo, botao.tinta);

  const textoIntacto = mesma(comoTexto, tema.marca);
  const botaoIntacto = mesma(botao.fundo, tema.marca);
  const intacta = textoIntacto && botaoIntacto;

  let tom: LeituraDaCor["tom"] = "ok";
  let recado = "Sua cor aparece exatamente como você escolheu, no texto e no botão.";

  if (tema.padrao) {
    tom = "fraca";
    recado = "Nenhuma cor válida escolhida — a loja usa o roxo da Aura por enquanto.";
  } else if (!textoIntacto && !botaoIntacto) {
    tom = "fraca";
    recado =
      "Sua cor é bonita, mas some no fundo claro da loja. Escrita e no botão ela " +
      "aparece um pouco mais forte, para o cliente conseguir ler. A marca continua " +
      "sendo a sua — só ajustada.";
  } else if (!textoIntacto) {
    tom = "ajustada";
    recado =
      "No botão sua cor aparece exata. Escrita sobre o fundo claro ela fica um " +
      "pouco mais escura, senão o texto não seria legível.";
  } else if (!botaoIntacto) {
    tom = "ajustada";
    recado =
      "Escrita, sua cor aparece exata. No botão cheio ela escurece um pouco, para " +
      "o texto branco em cima ficar legível.";
  }

  return { original: hex, comoTexto, botao, contrasteTexto, contrasteBotao, intacta, recado, tom };
}

/**
 * A mesma cor, comparada nos dois modos.
 *
 * É o argumento do papel quente: das seis lojas publicadas em 19/08/2026,
 * quatro sobreviviam intactas no claro e só uma no escuro.
 */
export function corNosDoisModos(hex: string): { papel: LeituraDaCor; escuro: LeituraDaCor } {
  return { papel: lerCorDaLoja(hex, "papel"), escuro: lerCorDaLoja(hex, "escuro") };
}

// ============================================================
// nomeDaCor — o hex, em português (QA da vitrine, 27/09/2026)
//
// O leitor de tela anunciava "Cor da arte, #0F172A" e a mensagem do
// WhatsApp chegava com "Cor: #FFFFFF" — a lojista e a cliente liam um
// código, não uma cor. Sem paleta cadastrada (rótulo por campo), o hex
// vira o nome mais próximo de uma paleta comum em português. Não é
// ciência da cor: é o suficiente para não ler um código onde deveria
// haver uma palavra.
// ============================================================

type Rgb = { r: number; g: number; b: number };

function hexParaRgb(hex: string): Rgb | null {
  const h = String(hex || "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (/^[0-9a-fA-F]{6}$/.test(h)) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

function rgbParaHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const diff = max - min;
  if (diff === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
  let h: number;
  if (max === rn) h = 60 * (((gn - bn) / diff) % 6);
  else if (max === gn) h = 60 * ((bn - rn) / diff + 2);
  else h = 60 * ((rn - gn) / diff + 4);
  if (h < 0) h += 360;
  return { h, s, l };
}

/**
 * O nome em português mais próximo do hex — branco, preto, vermelho,
 * rosa, roxo, azul, laranja, verde, amarelo, marrom, cinza, dourado ou
 * prata. Hex inválido devolve o próprio texto (não inventa cor do nada).
 */
export function nomeDaCor(hex: string | null | undefined): string {
  const rgb = hexParaRgb(String(hex || ""));
  if (!rgb) return String(hex || "").trim() || "cor personalizada";
  const { h, s, l } = rgbParaHsl(rgb);
  if (l <= 0.12) return "preto";
  if (l >= 0.94) return "branco";
  if (s <= 0.12) return l >= 0.62 ? "prata" : "cinza";
  if (h >= 40 && h < 58 && s >= 0.35 && s <= 0.85 && l >= 0.35 && l <= 0.68) return "dourado";
  if (h < 20 || h >= 345) return l >= 0.62 ? "rosa" : "vermelho";
  if (h < 45) return l < 0.38 ? "marrom" : "laranja";
  if (h < 65) return "amarelo";
  if (h < 170) return "verde";
  if (h < 255) return "azul";
  if (h < 300) return "roxo";
  return "rosa";
}
