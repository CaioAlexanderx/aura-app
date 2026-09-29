// ============================================================
// components/studio/mockupPorProduto/regras.ts
//
// As regras da seção "Mockup por produto" da aba Aparência, sem React
// (28/09/2026). A tela antiga mostrava ~13 chips por produto, um por
// modelo publicado; a nova mostra um seletor só e uma prévia. Mockup
// aprovado: docs/mockups/studio-aparencia-seletor-de-mockup.html.
//
// Aqui mora o que a tela decide e o teste precisa provar: o selo de cada
// linha, o que o seletor fechado diz, as opções agrupadas em 3D e 2D, a
// busca e o filtro, e o "digitar para pular" do teclado.
// ============================================================
import type { VisualTemplate, VisualTemplateSpec } from "@/services/studioVisualApi";
import { temMockupNaFoto } from "@/components/studio/visualEngine/specDaFotoDoProduto";
import { rotuloDaArea } from "@/components/studio/visualEngine/areasDaPeca";

export type ProdutoDoMockup = {
  id: string;
  name: string;
  visual_template_key: string | null;
  /** A foto que a lista e a prévia mostram (galeria primeiro, depois a capa). */
  foto: string | null;
  customization_config: any;
};

/** O que a lista precisa de uma linha de GET /studio/products. */
export function lerProduto(p: any): ProdutoDoMockup {
  const galeria = Array.isArray(p?.gallery_urls)
    ? p.gallery_urls.find((u: any) => typeof u === "string" && u.trim())
    : null;
  const capa = typeof p?.image_url === "string" && p.image_url.trim() ? p.image_url : null;
  return {
    id: String(p?.id),
    name: String(p?.name || ""),
    visual_template_key: p?.visual_template_key || null,
    foto: capa || galeria || null,
    customization_config: p?.customization_config || null,
  };
}

export type TipoDoModelo = "3D" | "2D";
export function tipoDoModelo(t: Pick<VisualTemplate, "kind"> | null | undefined): TipoDoModelo | null {
  if (!t) return null;
  return t.kind === "model3d" ? "3D" : "2D";
}

export type Situacao = "vinculado" | "foto" | "sem";

/**
 * O selo da linha, visível sem abrir o seletor. A precedência é a da
 * vitrine (`fonteDoMockup`): modelo da Aura vinculado > Mockup na foto
 * marcado pela lojista > nada.
 */
export function situacaoDoProduto(
  p: ProdutoDoMockup,
  key: string | null | undefined,
  templates: VisualTemplate[],
): { situacao: Situacao; rotulo: string } {
  if (key) {
    const t = templates.find((x) => x.key === key);
    const tipo = tipoDoModelo(t);
    return { situacao: "vinculado", rotulo: tipo ? "Vinculado · " + tipo : "Vinculado" };
  }
  if (temMockupNaFoto(p.customization_config)) return { situacao: "foto", rotulo: "Mockup na foto" };
  return { situacao: "sem", rotulo: "Sem mockup" };
}

/** Uma linha curta sobre o que a peça oferece, para debaixo do nome do modelo. */
export function metaDoModelo(t: VisualTemplate, spec?: VisualTemplateSpec | null): string {
  const s = spec || t.spec || null;
  if (t.kind === "model3d") {
    const ids = (s?.areas || []).map((a) => a.id);
    if (ids.includes("front") && ids.includes("back")) return "Frente e costas";
    if (ids.includes("panel") && ids.includes("wrap")) return "Painel e volta inteira";
    return "A cliente gira a peça";
  }
  const vistas = s?.views || [];
  if (vistas.length > 1) return "Foto de estúdio · frente e costas";
  if (vistas.length === 1) return "Foto de estúdio · só frente";
  return "A arte na foto da peça";
}

/** O que a opção "Sem mockup" explica, conforme o produto. */
export function metaDoNenhum(p: ProdutoDoMockup): string {
  if (temMockupNaFoto(p.customization_config)) return "Vale o Mockup na foto que você marcou";
  if (p.foto) return "A loja mostra a foto do produto";
  return "A loja mostra só a arte, numa prévia plana";
}

export type RotuloDoSeletor = {
  nome: string;
  meta: string;
  tipo: TipoDoModelo | "FOTO" | null;
  /** O modelo cuja miniatura aparece (null: ícone de "sem modelo" ou a foto). */
  template: VisualTemplate | null;
};

/** O seletor fechado já diz o modelo atual: miniatura, nome e 3D/2D. */
export function rotuloDoSeletor(
  p: ProdutoDoMockup,
  key: string | null | undefined,
  templates: VisualTemplate[],
  spec?: VisualTemplateSpec | null,
): RotuloDoSeletor {
  if (key) {
    const t = templates.find((x) => x.key === key) || null;
    // Vinculado a um modelo que saiu da lista (arquivado): a loja ainda o
    // usa, e esconder isso faria a lojista achar que não tem nada.
    if (!t) return { nome: key, meta: "Fora da lista de modelos publicados", tipo: null, template: null };
    return { nome: t.name, meta: metaDoModelo(t, spec), tipo: tipoDoModelo(t), template: t };
  }
  if (temMockupNaFoto(p.customization_config)) {
    return { nome: "Mockup na foto", meta: "Marcado por você, sem modelo da Aura", tipo: "FOTO", template: null };
  }
  return {
    nome: "Sem mockup",
    meta: p.foto ? "A loja mostra a foto do produto" : "A loja mostra só a arte",
    tipo: null,
    template: null,
  };
}

export type GrupoDaOpcao = "nenhum" | "3D" | "2D";
export type OpcaoDoSeletor = {
  key: string | null;
  nome: string;
  grupo: GrupoDaOpcao;
  template: VisualTemplate | null;
  /** Linha de baixo própria (o orçamento explica "Do produto" e "Sem mockup" do seu jeito). */
  meta?: string;
};

/** "Sem mockup" primeiro; depois os modelos em 3D e em 2D, cada grupo na ordem da API (nome). */
export function opcoesDoSeletor(templates: VisualTemplate[]): OpcaoDoSeletor[] {
  const nenhum: OpcaoDoSeletor = { key: null, nome: "Sem mockup", grupo: "nenhum", template: null };
  const de = (tipo: TipoDoModelo) => templates
    .filter((t) => tipoDoModelo(t) === tipo)
    .map((t): OpcaoDoSeletor => ({ key: t.key, nome: t.name, grupo: tipo, template: t }));
  return [nenhum, ...de("3D"), ...de("2D")];
}

export const ROTULO_DO_GRUPO: Record<Exclude<GrupoDaOpcao, "nenhum">, string> = {
  "3D": "3D · a cliente gira a peça",
  "2D": "2D · a arte na foto da peça",
};

export function semAcento(s: string): string {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Digitar com o seletor aberto pula para o modelo. Casa com o começo de
 * QUALQUER palavra: quase todo nome começa com "Caneca", então "ch" acha
 * a de chopp e "vi" a vintage. Uma letra só anda para a próxima que casa
 * (repetir a letra percorre); mais de uma procura a partir da atual.
 * -1 quando nada casa.
 */
export function proximaPorDigitacao(opcoes: Pick<OpcaoDoSeletor, "nome">[], ativo: number, digitado: string): number {
  const alvo = semAcento(digitado);
  const n = opcoes.length;
  if (!alvo || !n) return -1;
  const desloc = alvo.length > 1 ? 0 : 1;
  for (let s = 0; s < n; s++) {
    const j = (Math.max(0, ativo) + desloc + s) % n;
    const palavras = semAcento(opcoes[j].nome).split(/[\s·()/-]+/);
    if (palavras.some((w) => w.startsWith(alvo))) return j;
  }
  return -1;
}

/** Com mais produtos que isto, a lista ganha busca e filtro. */
export const LIMITE_SEM_BUSCA = 8;

export type FiltroDoMockup = "todos" | "sem" | "com";

export function filtrarProdutos(
  produtos: ProdutoDoMockup[],
  vinculos: Record<string, string | null>,
  busca: string,
  filtro: FiltroDoMockup,
): ProdutoDoMockup[] {
  const q = semAcento(busca.trim());
  return produtos.filter((p) => {
    if (q && !semAcento(p.name).includes(q)) return false;
    const tem = !!vinculos[p.id];
    if (filtro === "com") return tem;
    if (filtro === "sem") return !tem;
    return true;
  });
}

export function contarComModelo(produtos: ProdutoDoMockup[], vinculos: Record<string, string | null>): number {
  return produtos.filter((p) => !!vinculos[p.id]).length;
}

export type AbaDaPrevia = { id: string; rotulo: string };

/**
 * As abas da prévia: áreas da peça 3D (Painel/Volta inteira,
 * Frente/Costas) ou vistas da foto 2D. Uma só (ou nenhuma): sem abas.
 */
export function abasDaPrevia(t: Pick<VisualTemplate, "kind"> | null, spec: VisualTemplateSpec | null | undefined): AbaDaPrevia[] {
  if (!t || !spec) return [];
  if (t.kind === "model3d") return (spec.areas || []).map((a) => ({ id: a.id, rotulo: rotuloDaArea(a) }));
  return (spec.views || []).map((v) => ({ id: v.id, rotulo: v.id === "back" ? "Costas" : v.label || "Frente" }));
}

/** A arte de exemplo da prévia: um nome, como a cliente escreveria. */
export const ARTE_DE_EXEMPLO = { text: "Helena" };
