// ============================================================
// Produto com fotos e tamanhos — as regras do artboard ProdutoGrade, sem tela.
// ============================================================
import { fmt } from "@/constants/helpers";
import type { GradeCor, GradeFoto, GradeTamanho, HubProdutoGrade } from "@/services/hubProdutoGradeApi";

/** Fotos da cor; cor sem foto própria usa a galeria do produto. */
export function fotosDaCor(g: HubProdutoGrade, cor: GradeCor | undefined): GradeFoto[] {
  if (cor && cor.fotos.length) return cor.fotos;
  return g.fotos || [];
}

/** Padrão do artboard: as duas primeiras fotos marcadas. */
export function marcadasIniciais(fotos: GradeFoto[]): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  fotos.slice(0, 2).forEach((f) => { o[f.id] = true; });
  return o;
}

/** "2 de 3 marcadas" ou "nenhuma". */
export function contadorFotos(fotos: GradeFoto[], marcadas: Record<string, boolean>): string {
  if (!fotos.length) return "nenhuma";
  return `${fotos.filter((f) => marcadas[f.id]).length} de ${fotos.length} marcadas`;
}

/** Texto do botão: "Mandar 2 fotos e tamanhos" / "Mandar preço e tamanhos". */
export function rotuloEnviar(qtdFotos: number): string {
  if (!qtdFotos) return "Mandar preço e tamanhos";
  return `Mandar ${qtdFotos} ${qtdFotos === 1 ? "foto" : "fotos"} e tamanhos`;
}

/** A anotação embaixo do tamanho: sem a quantidade; "último" quando sobra 1. */
export function notaDoTamanho(qty: number): "tem" | "último" | "sem peça" {
  return qty <= 0 ? "sem peça" : qty === 1 ? "último" : "tem";
}

/** Só os tamanhos com peça. */
export function tamanhosComPeca(c: GradeCor | undefined): GradeTamanho[] {
  return (c?.tamanhos || []).filter((z) => z.qty > 0);
}

/** "P, M (último) e G" */
export function listaDeTamanhos(c: GradeCor | undefined): string {
  const nomes = tamanhosComPeca(c).map((z) => z.label + (z.qty === 1 ? " (último)" : ""));
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes.join("");
}

/** Legenda da bolha: [negrito, apoio]. */
export function legendaDaGrade(g: HubProdutoGrade, cor: GradeCor | undefined): [string, string] {
  const l1 = [g.product.name, g.tem_cor && cor ? cor.label : null, fmt(Number(g.product.price))].filter(Boolean).join(" · ");
  const lista = listaDeTamanhos(cor);
  return [l1, lista ? `Tem ${lista}.` : "Sem peça no momento."];
}

/** "2 cores, grade P ao GG" / "sem foto no cadastro". */
export function subtituloDoProduto(g: HubProdutoGrade): string {
  const partes: string[] = [];
  if (g.tem_cor && g.cores.length > 1) partes.push(`${g.cores.length} cores`);
  const todos = g.cores.flatMap((c) => c.tamanhos.map((z) => z.label));
  const unicos = todos.filter((z, i) => todos.indexOf(z) === i);
  if (unicos.length > 1) partes.push(`grade ${unicos[0]} ao ${unicos[unicos.length - 1]}`);
  const temFoto = (g.fotos || []).length > 0 || g.cores.some((c) => c.fotos.length > 0) || !!g.product.image_url;
  if (!temFoto) partes.push("sem foto no cadastro");
  return partes.join(", ");
}

/** O hex só vale para a rota de imagens se for #rrggbb. */
export function hexValido(hex: string | null | undefined): string | null {
  return hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
}
