// ============================================================
// Produto com fotos e tamanhos — as regras do artboard ProdutoGrade, sem tela.
// ============================================================
import { fmt } from "@/constants/helpers";
import type { GradeCor, GradeFoto, GradeTamanho, HubProdutoGrade } from "@/services/hubProdutoGradeApi";

/** Foto marcável: o id é a própria URL (o servidor aceita de volta só as URLs que devolveu). */
export type FotoMarcavel = { id: string; url: string };

/** Cor para o painel. Produto sem variação vira uma cor só, sem rótulo. */
export function coresDoPainel(g: HubProdutoGrade): GradeCor[] {
  if (g.cores.length) return g.cores;
  return [{ chave: "", nome: null, hex: null, preco: g.produto.preco, foto: null, fotos: [], disponivel: true, tamanhos: [] }];
}

export const temCor = (g: HubProdutoGrade) => g.cores.some((c) => !!c.nome);

/** Fotos da cor; cor sem galeria própria usa a do produto. */
export function fotosDaCor(g: HubProdutoGrade, cor: GradeCor | undefined): FotoMarcavel[] {
  const base: GradeFoto[] = cor && cor.fotos.length ? cor.fotos : g.fotos || [];
  return base.filter((f) => !!f.url).map((f) => ({ id: f.url, url: f.thumb_url || f.url }));
}

/** Padrão do artboard: as duas primeiras fotos marcadas. */
export function marcadasIniciais(fotos: FotoMarcavel[]): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  fotos.slice(0, 2).forEach((f) => { o[f.id] = true; });
  return o;
}

/** "2 de 3 marcadas" ou "nenhuma". */
export function contadorFotos(fotos: FotoMarcavel[], marcadas: Record<string, boolean>): string {
  if (!fotos.length) return "nenhuma";
  return `${fotos.filter((f) => marcadas[f.id]).length} de ${fotos.length} marcadas`;
}

/** Texto do botão: "Mandar 2 fotos e tamanhos" / "Mandar preço e tamanhos". */
export function rotuloEnviar(qtdFotos: number): string {
  if (!qtdFotos) return "Mandar preço e tamanhos";
  return `Mandar ${qtdFotos} ${qtdFotos === 1 ? "foto" : "fotos"} e tamanhos`;
}

/** A anotação embaixo do tamanho: sem a quantidade; "último" quando sobra 1. */
export function notaDoTamanho(t: Pick<GradeTamanho, "ultimo">): "tem" | "último" {
  return t.ultimo ? "último" : "tem";
}

/** "P, M (último) e G" */
export function listaDeTamanhos(c: GradeCor | undefined): string {
  const nomes = (c?.tamanhos || []).map((z) => z.tamanho + (z.ultimo ? " (último)" : ""));
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes.join("");
}

/** "2 cores, grade P ao GG" / "sem foto no cadastro". */
export function subtituloDoProduto(g: HubProdutoGrade): string {
  const partes: string[] = [];
  const cores = g.cores.filter((c) => !!c.nome);
  if (cores.length > 1) partes.push(`${cores.length} cores`);
  const todos = g.cores.flatMap((c) => c.tamanhos.map((z) => z.tamanho));
  const unicos = todos.filter((z, i) => todos.indexOf(z) === i);
  if (unicos.length > 1) partes.push(`grade ${unicos[0]} ao ${unicos[unicos.length - 1]}`);
  const temFoto = (g.fotos || []).length > 0 || g.cores.some((c) => c.fotos.length > 0 || !!c.foto);
  if (!temFoto) partes.push("sem foto no cadastro");
  return partes.join(", ");
}

/** O hex só vale para a rota de imagens se for #rrggbb. */
export function hexValido(hex: string | null | undefined): string | null {
  return hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
}

/** Legenda da bolha enviada, a partir do cartão da thread: [negrito, apoio]. */
export function legendaDoCartao(c: { nome?: string | null; cor?: string | null; preco?: number | null; tamanhos?: { tamanho: string; ultimo?: boolean }[] | null }): [string, string] {
  const l1 = [c.nome, c.cor, c.preco != null ? fmt(Number(c.preco)) : null].filter(Boolean).join(" · ");
  const nomes = (c.tamanhos || []).map((z) => z.tamanho + (z.ultimo ? " (último)" : ""));
  const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes.join("");
  return [l1, lista ? `Tem ${lista}.` : ""];
}
