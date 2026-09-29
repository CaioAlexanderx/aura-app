// ============================================================
// components/studio/orcamentoModal/regras.ts
//
// As regras do modal do orçamento (29/09/2026), sem React. Mockup
// aprovado: docs/mockups/studio-orcamento-modal.html; diagnóstico:
// docs/studio/orcamento-modal-diagnostico.md.
//
// Aqui mora o que a tela decide e o teste precisa provar: o estado do
// orçamento, os botões do rodapé (um primário por estado), o catálogo
// aberto sem digitar (mais usados, recentes, todos), o modelo de mockup
// de cada peça (herdado do produto ou trocado só neste orçamento) e o
// resumo dos valores.
// ============================================================
import type { StudioQuote, ProdutosFrequentesDoOrcamento } from "@/services/studioApi";
import type { VisualTemplate } from "@/services/studioVisualApi";
import { precoNoPixDoOrcamento, lerNumero } from "@/components/studio/orcamentoVideo/condicoesDoOrcamento";
import { temAjustePendente } from "@/components/studio/orcamentoVideo/ajusteDoOrcamento";
import { SEM_MODELO } from "@/components/studio/orcamentoVideo/modeloDaPeca";
import { semAcento, type OpcaoDoSeletor } from "@/components/studio/mockupPorProduto/regras";

export { SEM_MODELO };

// ─── Estado ─────────────────────────────────────────────────
export type EstadoDoOrcamento =
  | "novo" | "rascunho" | "ajuste" | "enviado" | "aceito" | "aprovado" | "encerrado";

export function estadoDoOrcamento(q: Pick<StudioQuote, "status" | "ajuste_pedido_em"> | null | undefined): EstadoDoOrcamento {
  if (!q) return "novo";
  if (temAjustePendente(q)) return "ajuste";
  switch (q.status) {
    case "draft": return "rascunho";
    case "sent": return "enviado";
    case "accepted": return "aceito";
    case "converted": return "aprovado";
    default: return "encerrado";
  }
}

/** Peças, cliente, condições e desconto só mudam antes do envio (ou depois de um ajuste pedido). */
export function podeEditar(e: EstadoDoOrcamento): boolean {
  return e === "novo" || e === "rascunho" || e === "ajuste";
}

// ─── Rodapé ─────────────────────────────────────────────────
export type IdDaAcao =
  | "cancelar" | "salvar" | "enviar" | "fechar_sem_venda" | "ajuste" | "aprovar"
  | "converter" | "fechar" | "ver_pedido" | "voltar_pecas" | "concluir";
export type TipoDaAcao = "pri" | "wa" | "ok" | "sec" | "ter" | "perigo";
export type AcaoDoRodape = { id: IdDaAcao; rotulo: string; tipo: TipoDaAcao; desabilitada?: boolean };

export const TIPOS_PRIMARIOS: TipoDaAcao[] = ["pri", "wa", "ok"];

/**
 * Os botões do rodapé, do menos ao mais importante (o último é o
 * primário). Um primário por estado: rascunho → Enviar pelo WhatsApp;
 * enviado → Aprovar; ajuste pedido → Reenviar; aprovado → Ver pedido.
 */
export function acoesDoRodape(
  estado: EstadoDoOrcamento,
  o: { temPecas: boolean; catalogoAberto: boolean; temPedido?: boolean },
): AcaoDoRodape[] {
  if (o.catalogoAberto && podeEditar(estado)) {
    return [
      { id: "voltar_pecas", rotulo: "Voltar às peças", tipo: "sec" },
      { id: "concluir", rotulo: "Concluir", tipo: "pri" },
    ];
  }
  switch (estado) {
    case "novo":
    case "rascunho":
      return [
        { id: "cancelar", rotulo: "Cancelar", tipo: "ter" },
        { id: "salvar", rotulo: "Salvar rascunho", tipo: "sec", desabilitada: !o.temPecas },
        { id: "enviar", rotulo: "Enviar pelo WhatsApp", tipo: "wa", desabilitada: !o.temPecas },
      ];
    case "ajuste":
      return [
        { id: "fechar_sem_venda", rotulo: "Fechar sem venda", tipo: "perigo" },
        { id: "salvar", rotulo: "Salvar rascunho", tipo: "sec", desabilitada: !o.temPecas },
        { id: "enviar", rotulo: "Reenviar pelo WhatsApp", tipo: "wa", desabilitada: !o.temPecas },
      ];
    case "enviado":
      return [
        { id: "fechar_sem_venda", rotulo: "Fechar sem venda", tipo: "perigo" },
        { id: "ajuste", rotulo: "Cliente pediu ajuste", tipo: "sec" },
        { id: "aprovar", rotulo: "Aprovar · vira pedido", tipo: "ok" },
      ];
    case "aceito":
      return [
        { id: "fechar", rotulo: "Fechar", tipo: "sec" },
        { id: "converter", rotulo: "Converter em pedido", tipo: "ok" },
      ];
    case "aprovado":
      return o.temPedido
        ? [{ id: "fechar", rotulo: "Fechar", tipo: "sec" }, { id: "ver_pedido", rotulo: "Ver pedido", tipo: "pri" }]
        : [{ id: "fechar", rotulo: "Fechar", tipo: "sec" }];
    default:
      return [{ id: "fechar", rotulo: "Fechar", tipo: "sec" }];
  }
}

// ─── Catálogo ───────────────────────────────────────────────
export type ProdutoDoCatalogo = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
  sku: string | null;
  visual_template_key: string | null;
  customization_config: any;
  gallery_urls: string[];
};

/** Uma linha de GET /studio/products?include_non_personalizable=true. */
export function lerProdutoDoCatalogo(p: any): ProdutoDoCatalogo {
  const preco = Number(p?.price);
  return {
    id: String(p?.id),
    name: String(p?.name || ""),
    price: Number.isFinite(preco) ? preco : 0,
    image_url: typeof p?.image_url === "string" && p.image_url.trim() ? p.image_url : null,
    category: typeof p?.category === "string" && p.category.trim() ? p.category.trim() : null,
    sku: p?.sku ? String(p.sku) : null,
    visual_template_key: p?.visual_template_key || null,
    customization_config: p?.customization_config || null,
    gallery_urls: Array.isArray(p?.gallery_urls) ? p.gallery_urls.filter((u: any) => typeof u === "string") : [],
  };
}

export const TODAS_AS_CATEGORIAS = "todas";
export const LIMITE_DE_FREQUENTES = 5;

export function categoriasDoCatalogo(produtos: ProdutoDoCatalogo[]): string[] {
  const set = new Set<string>();
  produtos.forEach((p) => { if (p.category) set.add(p.category); });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export type GruposDoCatalogo = {
  /** Com busca, só esta lista (sem as faixas de mais usados e recentes). */
  buscando: boolean;
  maisUsados: Array<{ produto: ProdutoDoCatalogo; usos: number }>;
  recentes: ProdutoDoCatalogo[];
  todos: ProdutoDoCatalogo[];
};

function casaBusca(p: ProdutoDoCatalogo, q: string): boolean {
  return [p.name, p.category || "", p.sku || ""].some((c) => semAcento(c).includes(q));
}

/**
 * O catálogo já aberto: mais usados e recentes (do backend, por CNPJ) no
 * topo, depois todos de A a Z sem repetir o que já apareceu. A busca
 * procura em nome, categoria e código e mostra uma lista só.
 */
export function gruposDoCatalogo(
  produtos: ProdutoDoCatalogo[],
  frequentes: Pick<ProdutosFrequentesDoOrcamento, "mais_usados" | "recentes"> | null,
  filtro: { busca: string; categoria: string },
): GruposDoCatalogo {
  const q = semAcento(filtro.busca.trim());
  const naCategoria = (p: ProdutoDoCatalogo) =>
    filtro.categoria === TODAS_AS_CATEGORIAS || p.category === filtro.categoria;
  const az = (a: ProdutoDoCatalogo, b: ProdutoDoCatalogo) => a.name.localeCompare(b.name, "pt-BR");
  if (q) {
    return {
      buscando: true, maisUsados: [], recentes: [],
      todos: produtos.filter((p) => naCategoria(p) && casaBusca(p, q)).sort(az),
    };
  }
  const porId = new Map(produtos.map((p) => [p.id, p] as const));
  const vistos = new Set<string>();
  const maisUsados: GruposDoCatalogo["maisUsados"] = [];
  for (const f of frequentes?.mais_usados || []) {
    const p = porId.get(f.product_id);
    if (!p || !naCategoria(p) || vistos.has(p.id)) continue;
    maisUsados.push({ produto: p, usos: f.usos });
    vistos.add(p.id);
    if (maisUsados.length >= LIMITE_DE_FREQUENTES) break;
  }
  const recentes: ProdutoDoCatalogo[] = [];
  for (const f of frequentes?.recentes || []) {
    const p = porId.get(f.product_id);
    if (!p || !naCategoria(p) || vistos.has(p.id)) continue;
    recentes.push(p);
    vistos.add(p.id);
    if (recentes.length >= LIMITE_DE_FREQUENTES) break;
  }
  const todos = produtos.filter((p) => naCategoria(p) && !vistos.has(p.id)).sort(az);
  return { buscando: false, maisUsados, recentes, todos };
}

// ─── Modelo de mockup da peça ───────────────────────────────
export type ModeloEfetivo = { key: string | null; herdado: boolean };

/** null no item = herda do produto; SEM_MODELO = tirado só neste orçamento. */
export function modeloEfetivo(chaveDoItem: string | null | undefined, chaveDoProduto: string | null | undefined): ModeloEfetivo {
  if (chaveDoItem === SEM_MODELO) return { key: null, herdado: false };
  if (chaveDoItem) return { key: chaveDoItem, herdado: false };
  return { key: chaveDoProduto || null, herdado: true };
}

export type SeloDoModelo = { rotulo: string; tipo: "3d" | "2d" | "sem" };

export function seloDoModelo(key: string | null | undefined, templates: Pick<VisualTemplate, "key" | "kind">[]): SeloDoModelo {
  if (!key) return { rotulo: "Sem mockup", tipo: "sem" };
  const t = templates.find((x) => x.key === key);
  if (!t) return { rotulo: "Modelo", tipo: "2d" };
  return t.kind === "model3d" ? { rotulo: "3D", tipo: "3d" } : { rotulo: "2D", tipo: "2d" };
}

/**
 * As opções do seletor na peça: primeiro o que o produto usa ("Do
 * produto", a opção que deixa o item herdando), depois "Sem mockup" (só
 * quando o produto tem modelo), depois os modelos em 3D e em 2D, sem
 * repetir o do produto.
 */
export function opcoesDoModeloDaPeca(chaveDoProduto: string | null | undefined, templates: VisualTemplate[]): OpcaoDoSeletor[] {
  const doProduto = chaveDoProduto ? templates.find((t) => t.key === chaveDoProduto) || null : null;
  const out: OpcaoDoSeletor[] = [{
    key: null,
    nome: doProduto ? "Do produto · " + doProduto.name : chaveDoProduto ? "Do produto · " + chaveDoProduto : "Do produto · sem mockup",
    grupo: "nenhum",
    template: doProduto,
    meta: "O que a ficha do produto usa hoje",
  }];
  if (chaveDoProduto) {
    out.push({ key: SEM_MODELO, nome: "Sem mockup", grupo: "nenhum", template: null, meta: "Vai a foto do produto, sem vídeo" });
  }
  const de = (kind: VisualTemplate["kind"], grupo: "3D" | "2D") => templates
    .filter((t) => t.kind === kind && t.key !== chaveDoProduto)
    .map((t): OpcaoDoSeletor => ({ key: t.key, nome: t.name, grupo, template: t }));
  return [...out, ...de("model3d", "3D"), ...de("photo2d", "2D")];
}

// ─── Números e resumo ───────────────────────────────────────
/** Quantidade digitada ("12", "2,5") → número > 0, ou null. */
export function lerQuantidade(txt: string): number | null {
  const n = lerNumero(txt);
  return n !== null && n > 0 ? Math.round(n * 1000) / 1000 : null;
}

/** Preço digitado ("59,90", "1.234,50") → número ≥ 0, ou null. */
export function lerPreco(txt: string): number | null {
  let s = String(txt ?? "").trim().replace(/^R\$\s*/i, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** "59,90" — preço para o campo. */
export function textoDoPreco(v: number): string {
  return (Math.round((Number(v) || 0) * 100) / 100).toFixed(2).replace(".", ",");
}

/** "12" / "2,5" — quantidade para o campo. */
export function textoDaQuantidade(v: number): string {
  return String(Math.round((Number(v) || 0) * 1000) / 1000).replace(".", ",");
}

export type ResumoDoOrcamento = {
  pecas: number;
  unidades: number;
  subtotal: number;
  desconto: number;
  total: number;
  sinal: number | null;
  pix: number | null;
  parcela: number | null;
};

export function resumoDoOrcamento(
  itens: Array<{ quantity: number; unit_price: number }>,
  o: { desconto: number; sinalPct: number | null; pixPct: number | null; parcelas: number | null },
): ResumoDoOrcamento {
  const subtotal = Math.round(itens.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0) * 100) / 100;
  const desconto = Math.max(0, Number(o.desconto) || 0);
  const total = Math.max(0, Math.round((subtotal - desconto) * 100) / 100);
  const unidades = itens.reduce((a, it) => a + (Number(it.quantity) || 0), 0);
  const sinal = o.sinalPct && o.sinalPct > 0 ? Math.round(total * o.sinalPct) / 100 : null;
  const pix = o.pixPct && o.pixPct > 0 ? precoNoPixDoOrcamento(total, o.pixPct) : null;
  const parcela = o.parcelas && o.parcelas >= 2 ? Math.round((total / o.parcelas) * 100) / 100 : null;
  return { pecas: itens.length, unidades: Math.round(unidades * 1000) / 1000, subtotal, desconto, total, sinal, pix, parcela };
}

/** "1 peça" / "3 peças" */
export function textoDePecas(n: number): string {
  return n === 1 ? "1 peça" : `${n} peças`;
}

/** "1 unidade" / "13 unidades" */
export function textoDeUnidades(n: number): string {
  return n === 1 ? "1 unidade" : `${textoDaQuantidade(n)} unidades`;
}

/** Chips de validade: 3, 7, 15 e 30 dias, e a atual se for outra. */
export function chipsDeValidade(atual: number): number[] {
  const base = [3, 7, 15, 30];
  return base.includes(atual) || !(atual > 0) ? base : [...base, atual].sort((a, b) => a - b);
}

/** Data em que vence, contando de hoje (rascunho) ou do envio. */
export function venceEm(dias: number, desde?: string | null): Date {
  const base = desde ? new Date(desde) : new Date();
  const t = isNaN(base.getTime()) ? Date.now() : base.getTime();
  return new Date(t + Math.max(1, dias) * 86400000);
}
