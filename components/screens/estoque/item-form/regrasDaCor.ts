// ============================================================
// Regras do editor de cor do item (CP4a da revisão de cores, 14/11/2026)
//
// Mockup aprovado pelo Caio (telas 1 e 5): a paleta com o nome de cada
// amostra e busca; o nome próprio com amostra; renomear uma cor tocando nela.
//
// REGRA CRÍTICA: o editor nunca grava sozinho um nome da paleta nova no
// color_name de uma cor antiga — isso mudaria a etiqueta sem a lojista
// pedir. Por isso:
//   - cor que veio do servidor sem nome gravado continua marcada
//     (nomeSoParaMostrar) e vai com name null no Salvar, a menos que ela
//     RENOMEIE (e o nome de fato mude);
//   - renomear marca nomeConfirmado: o PUT manda name_confirmado e o
//     backend grava mesmo que o nome coincida com o da paleta (sem isso, o
//     backend descarta o nome da paleta numa cor antiga — CP1);
//   - cor nova (paleta ou nome próprio) vai com o nome, como sempre.
// ============================================================
import { chaveDoNome, porFamilia, maisPerto, PALETA, type CorDaPaleta } from "@/utils/paletaDeCores";
import type { CorDoItem } from "./types";
import { nomeDaCor as nomeDaCorRegra, nomeGravadoParaEtiqueta } from "@/utils/nomeDaCor";
import { hexToName } from "@/utils/colorNames";

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** "#c3b091" ou "c3b091" → "#C3B091"; o resto → null. */
export function hexValido(v: string | null | undefined): string | null {
  const t = String(v || "").trim();
  const h = t.startsWith("#") ? t : "#" + t;
  return HEX.test(h) ? h.toUpperCase() : null;
}

/** A paleta por família, filtrada pela busca (nome, apelido ou família, sem acento). */
export function paletaFiltrada(busca: string): Array<{ familia: string; cores: CorDaPaleta[] }> {
  const q = chaveDoNome(busca);
  return porFamilia()
    .map((f) => ({
      familia: f.familia,
      cores: !q ? f.cores : f.cores.filter((c) =>
        chaveDoNome(c.nome).includes(q)
        || c.apelidos.some((a) => chaveDoNome(a).includes(q))
        || chaveDoNome(f.familia).includes(q)),
    }))
    .filter((f) => f.cores.length > 0);
}

export function jaTemCor(cores: CorDoItem[], hex: string): boolean {
  const h = String(hex || "").toUpperCase();
  return cores.some((c) => String(c.hex).toUpperCase() === h);
}

/** Adiciona uma cor da paleta (o nome dela). Mesmo hex não entra duas vezes. */
export function comCorDaPaleta(cores: CorDoItem[], c: CorDaPaleta): CorDoItem[] {
  if (jaTemCor(cores, c.hex)) return cores;
  return [...cores, { hex: c.hex.toUpperCase(), name: c.nome }];
}

/** Adiciona uma cor com o nome que ela escreveu e a amostra que escolheu. */
export function comNomeProprio(cores: CorDoItem[], nome: string, hex: string): CorDoItem[] {
  const n = String(nome || "").trim();
  const h = hexValido(hex);
  if (!n || !h || jaTemCor(cores, h)) return cores;
  return [...cores, { hex: h, name: n.slice(0, 60), nomeConfirmado: true }];
}

/**
 * Renomeia a cor desse hex. Nome vazio, ou igual ao que já aparece, não
 * muda nada (a cor antiga continua sem nome gravado). Nome novo vale como
 * escolha dela: some a marca de "só para mostrar" e entra nomeConfirmado.
 */
export function renomear(cores: CorDoItem[], hex: string, nome: string): CorDoItem[] {
  const n = String(nome || "").trim().slice(0, 60);
  const h = String(hex || "").toUpperCase();
  return cores.map((c) => {
    if (String(c.hex).toUpperCase() !== h) return c;
    if (!n || n === String(c.name || "").trim()) return c;
    return { hex: c.hex, name: n, nomeConfirmado: true };
  });
}

/** Até 3 nomes da paleta mais perto da amostra, para renomear com um toque. */
export function sugestoesParaAmostra(hex: string, quantas = 3): string[] {
  const h = hexValido(hex);
  if (!h) return [];
  const rgb = (x: string) => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)];
  const [r, g, b] = rgb(h);
  return [...PALETA]
    .map((c) => {
      const [cr, cg, cb] = rgb(c.hex);
      return { nome: c.nome, d: 2 * (r - cr) ** 2 + 4 * (g - cg) ** 2 + 3 * (b - cb) ** 2 };
    })
    .sort((x, y) => x.d - y.d)
    .slice(0, quantas)
    .map((x) => x.nome);
}

// ─── CP4b: nome ou amostra repetidos (só avisam, nunca bloqueiam) ─────────

/** Distância RGB abaixo da qual duas amostras parecem a mesma na vitrine. */
export const AMOSTRA_PARECIDA = 22;

function distancia(a: string, b: string): number {
  const x = hexValido(a), y = hexValido(b);
  if (!x || !y) return Infinity;
  const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = rgb(x), [r2, g2, b2] = rgb(y);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

export type Repeticao = { chave: string; primeira: CorDoItem; segunda: CorDoItem; tipo: "nome" | "amostra" };

/**
 * Pares de cores do mesmo produto que sairiam iguais: o MESMO nome (sem
 * acento nem caixa: "Preto" e "preto") — no Caixa, na etiqueta e na nota
 * viram duas linhas iguais — ou amostras quase iguais — na vitrine viram
 * duas bolinhas iguais. `ignorar` tem as chaves que ela já marcou como
 * "são diferentes, manter".
 */
export function repeticoes(cores: CorDoItem[], ignorar?: ReadonlySet<string>): Repeticao[] {
  const out: Repeticao[] = [];
  for (let i = 0; i < cores.length; i++) {
    for (let j = i + 1; j < cores.length; j++) {
      const a = cores[i], b = cores[j];
      const chave = [a.hex.toUpperCase(), b.hex.toUpperCase()].sort().join("|");
      if (ignorar && ignorar.has(chave)) continue;
      if (chaveDoNome(a.name) && chaveDoNome(a.name) === chaveDoNome(b.name)) out.push({ chave, primeira: a, segunda: b, tipo: "nome" });
      else if (distancia(a.hex, b.hex) < AMOSTRA_PARECIDA) out.push({ chave, primeira: a, segunda: b, tipo: "amostra" });
    }
  }
  return out;
}

/**
 * Aviso para a cor que vai entrar (nome próprio) ou ser renomeada: outra
 * cor do produto já tem esse nome, ou uma amostra quase igual. `fora` é o
 * hex da própria cor (no renomear), que não conta.
 */
export function avisoDaCor(cores: CorDoItem[], nome: string, hex: string, fora?: string): string | null {
  const k = chaveDoNome(nome);
  const outras = cores.filter((c) => !fora || c.hex.toUpperCase() !== String(fora).toUpperCase());
  const mesmoNome = k ? outras.find((c) => chaveDoNome(c.name) === k) : undefined;
  if (mesmoNome) return "Este produto já tem uma cor \"" + mesmoNome.name + "\". No Caixa, na etiqueta e na nota as duas saem iguais.";
  const perto = outras.find((c) => distancia(c.hex, hex) < AMOSTRA_PARECIDA);
  if (perto) return "A amostra está quase igual à de \"" + perto.name + "\". Na vitrine as duas bolinhas vão parecer a mesma cor.";
  return null;
}

// ─── CP4b: como o nome sai ───────────────────────────────────────────────

export type ComoSai = { caixa: string; etiqueta: string; vitrine: string; nota: string; notaTamanho: number };

/**
 * O que cada lugar mostra para esta cor, pelas regras de verdade:
 * Caixa, vitrine e nota pela regra única (utils/nomeDaCor.ts, a mesma do
 * cupom e do pedido online no backend); a etiqueta pela regra dela
 * (nomeGravadoParaEtiqueta → paleta de 26 tons), que não muda.
 * `nome` é o que vai ser gravado; null = a cor fica sem nome gravado (cor
 * antiga que ela não renomeou), e aí o nome vem do sufixo/paleta, como hoje.
 */
export function comoSai(o: { hex: string; nome: string | null; nomeNaTela?: string; produto?: string; tamanho?: string | null }): ComoSai {
  const tam = (o.tamanho || "").trim();
  // Sem nome gravado, o servidor lê o sufixo (o pedaço que a tela mostra).
  const sufixo = o.nome ? null : (o.nomeNaTela || null);
  const nomeCaixa = nomeDaCorRegra({ hex: o.hex, colorName: o.nome, skuSuffix: sufixo }) || o.hex;
  const nomeEtiqueta = nomeGravadoParaEtiqueta(o.nome) || hexToName(o.hex) || o.hex;
  const produto = (o.produto || "").trim() || "Produto";
  const variacao = tam ? nomeCaixa + " · " + tam : nomeCaixa;
  const notaInteira = produto + " (" + variacao + ")";
  return {
    caixa: variacao,
    etiqueta: tam ? nomeEtiqueta + " • Tam " + tam : nomeEtiqueta,
    // A vitrine põe a primeira letra maiúscula (primeiraMaiuscula do template).
    vitrine: nomeCaixa.charAt(0).toUpperCase() + nomeCaixa.slice(1),
    nota: notaInteira.slice(0, 120),
    notaTamanho: notaInteira.length,
  };
}

/** O nome da paleta mais perto (a dica embaixo do nome próprio). */
export function nomeMaisPerto(hex: string): string | null {
  const c = maisPerto(hexValido(hex));
  return c ? c.nome : null;
}
