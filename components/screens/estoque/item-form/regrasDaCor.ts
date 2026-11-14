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

/** O nome da paleta mais perto (a dica embaixo do nome próprio). */
export function nomeMaisPerto(hex: string): string | null {
  const c = maisPerto(hexValido(hex));
  return c ? c.nome : null;
}
