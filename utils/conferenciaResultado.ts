// ============================================================
// AURA. — Conferência de estoque · regras da tela de resultado (p-108, C)
//
// Sem React: diferenças, histórico e o rótulo do lançamento no histórico do
// produto usam estas funções, e o jest carrega este arquivo direto.
// ============================================================
import type {
  Conferencia, EscopoConferencia, ItemDiferenca, StatusConferencia,
} from "@/services/conferenciaEstoqueResultadoApi";
import type { ProdutoParaTransferir } from "@/components/screens/estoque/transferencia/TransferirModal";
import { chaveDaLinha, textoDoTudo } from "@/utils/transferenciaEstoque";

/** Janela do desfazer (decisão do p-108, igual ao reajuste de preço). */
export var DIAS_PARA_DESFAZER = 7;

/**
 * Quem aplica, desfaz e transfere: quem pode EDITAR o estoque. Dono, admin
 * e permissions null sempre; "só consulta" nunca; funcionário só com a
 * chave `estoque` ligada (a mesma que abre o Estoque para gravar).
 */
export function podeEditarEstoque(permData: any): boolean {
  if (!permData || permData.is_owner) return true;
  if (permData.role === "owner" || permData.role === "admin") return true;
  var p = permData.permissions;
  if (!p) return true;
  if (p.estoque_consulta === true) return false;
  return p.estoque === true;
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function dataEHora(iso: string | null | undefined): string {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return dataCurta(iso) + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Até quando dá para desfazer: o que o backend mandou, ou aplicada + 7 dias. */
export function desfazerAte(c: Pick<Conferencia, "pode_desfazer_ate" | "aplicada_em">): Date | null {
  var iso = c.pode_desfazer_ate || null;
  if (iso) {
    var d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  if (!c.aplicada_em) return null;
  var a = new Date(c.aplicada_em);
  if (isNaN(a.getTime())) return null;
  return new Date(a.getTime() + DIAS_PARA_DESFAZER * 24 * 3600 * 1000);
}

/**
 * Aura-backend#1001 manda `pode_desfazer` pronto (o relógio do servidor
 * decide). Sem o campo, calcula pelo prazo.
 */
export function podeDesfazerAgora(c: Pick<Conferencia, "status" | "pode_desfazer_ate" | "aplicada_em" | "pode_desfazer">, agora: Date = new Date()): boolean {
  if (c.status !== "aplicada") return false;
  if (typeof c.pode_desfazer === "boolean") return c.pode_desfazer;
  var ate = desfazerAte(c);
  return !!ate && ate.getTime() > agora.getTime();
}

export function rotuloDoEscopo(e: EscopoConferencia | null | undefined): string {
  if (!e) return "Conferência";
  if (e.tipo === "loja_toda") return "A loja toda";
  if (e.tipo === "com_estoque") return "Só o que tem estoque";
  var nomes = Array.isArray(e.category_names) ? e.category_names.filter(Boolean) : [];
  if (nomes.length === 1) return nomes[0];
  if (nomes.length > 1) return nomes[0] + " e mais " + (nomes.length - 1);
  var n = Array.isArray(e.category_ids) ? e.category_ids.length : 0;
  return n > 1 ? n + " categorias" : "Uma categoria";
}

export var ROTULO_STATUS: Record<StatusConferencia, string> = {
  rascunho: "Em andamento",
  aplicada: "Ajustada",
  desfeita: "Desfeita",
  descartada: "Descartada",
};

export function qtd(n: number): string {
  return Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function pecas(n: number): string {
  var v = Math.abs(n);
  return qtd(v) + (v === 1 ? " peça" : " peças");
}

export function itens(n: number): string {
  return qtd(n) + (n === 1 ? " item" : " itens");
}

export function brl(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(Number(n))) return "—";
  return "R$ " + Math.abs(Number(n)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Diferença com sinal: "+2", "−3", "0". */
export function comSinal(n: number): string {
  if (n > 0) return "+" + qtd(n);
  if (n < 0) return "−" + qtd(-n);
  return "0";
}

export function chaveDoItem(it: { product_id: string; variant_id: string | null }): string {
  return chaveDaLinha(it.product_id, it.variant_id);
}

export function somaDasPecas(lista: ItemDiferenca[]): number {
  return Math.round(lista.reduce(function (a, it) { return a + Math.abs(it.diferenca); }, 0) * 1000) / 1000;
}

/**
 * Itens escolhidos na tela de diferenças → o que o TransferirModal recebe.
 * Variantes do mesmo produto viram um produto com grade; a quantidade já
 * vem preenchida com a sobra (diferença positiva). O resto fica vazio:
 * a pessoa digita.
 */
export function montarTransferencia(escolhidos: ItemDiferenca[]): {
  produtos: ProdutoParaTransferir[];
  quantidades: Record<string, string>;
} {
  var porProduto: Record<string, ProdutoParaTransferir> = {};
  var ordem: string[] = [];
  var quantidades: Record<string, string> = {};
  escolhidos.forEach(function (it) {
    var p = porProduto[it.product_id];
    if (!p) {
      p = { id: it.product_id, name: it.nome, stock: 0, unit: it.unidade || "un", has_variants: false, sku: it.codigo };
      porProduto[it.product_id] = p;
      ordem.push(it.product_id);
    }
    p.stock = Math.round((p.stock + Math.max(0, it.estoque_atual)) * 1000) / 1000;
    if (it.variant_id) p.has_variants = true;
    if (it.diferenca > 0) {
      var q = textoDoTudo(it.diferenca);
      if (q) quantidades[chaveDoItem(it)] = q;
    }
  });
  return { produtos: ordem.map(function (id) { return porProduto[id]; }), quantidades: quantidades };
}

// ── Histórico do produto ─────────────────────────────────────────

export type MovimentoDeEstoque = {
  reference_type?: string | null;
  notes?: string | null;
  numero?: number | string | null;
  stock_count_numero?: number | string | null;
};

function numeroDasNotas(notes: string | null | undefined): string | null {
  var m = /n[ºo°]\s*(\d+)/i.exec(String(notes || ""));
  return m ? m[1] : null;
}

/**
 * Rótulo de um lançamento de estoque vindo da conferência:
 * "Conferência nº N" (ajuste) e "Conferência nº N desfeita" (desfazer).
 * null = não é da conferência (a tela usa o rótulo de sempre).
 */
export function rotuloDoMovimentoDeEstoque(m: MovimentoDeEstoque | null | undefined): string | null {
  if (!m) return null;
  var tipo = m.reference_type;
  if (tipo !== "stock_count" && tipo !== "stock_count_undo") return null;
  var n = m.stock_count_numero != null ? String(m.stock_count_numero)
    : m.numero != null ? String(m.numero)
    : numeroDasNotas(m.notes);
  var base = n ? "Conferência nº " + n : "Conferência";
  return tipo === "stock_count_undo" ? base + " desfeita" : base;
}
