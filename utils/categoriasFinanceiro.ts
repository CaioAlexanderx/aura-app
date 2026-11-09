// ============================================================
// AURA. — Categorias e subcategorias do Financeiro: regras puras (09/11/2026)
//
// Mockup aprovado: mockup-categorias-financeiro.html (A gestão, B nova
// categoria, C escolha no lançamento, D relatório, E migração).
//
// O contrato com o backend (Aura-backend, migration 434):
//   - transactions.category guarda o NOME DA CATEGORIA-MÃE; a subcategoria vai
//     só no category_id. O app manda os dois no lançamento.
//   - A lista de lançamentos devolve category_name (nome atual da mãe, quando
//     ligado) e subcategory (nome da subcategoria, se houver).
//   - Lançamento antigo, sem ligação, só tem o texto (às vezes sem acento,
//     ex. "Servicos"). Os relatórios agrupam pelo nome NORMALIZADO, para que
//     "Servicos" e "Serviços" somem juntos — e, no consolidado, nomes iguais
//     de lojas diferentes também (decisão 1 do Caio).
// ============================================================
import type { CategoriaFinanceira, KindDaCategoria, ListaDeCategorias, Subcategoria } from "@/services/financeCategoriesApi";
import { INCOME_CATS, EXPENSE_CATS } from "@/components/screens/financeiro/types";

export function normalizarCategoria(s: any): string {
  return String(s == null ? "" : s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Paleta da seção B do mockup.
export var CORES_DE_CATEGORIA = ["#7c3aed", "#dc2626", "#059669", "#d97706", "#0891b2", "#db2777"];

// ── Escolha no lançamento (seção C) ─────────────────────────────────────
export type OpcaoDeCategoria = {
  /** null quando a lista veio da lista fixa (backend sem a 434). */
  id: string | null;
  name: string;
  color: string | null;
  is_system: boolean;
  subcategories: Subcategoria[];
};

/** A lista fixa de antes — o que o modal mostra se o backend não responder. */
export function listaFixa(kind: KindDaCategoria): OpcaoDeCategoria[] {
  var nomes = kind === "income" ? INCOME_CATS : EXPENSE_CATS;
  return nomes.map(function(n) { return { id: null, name: n, color: null, is_system: false, subcategories: [] }; });
}

function ativa(c: { archived_at: string | null }): boolean { return !c.archived_at; }

/**
 * Categorias que aparecem na grade do lançamento. As que só o sistema grava
 * (troca, taxa da maquininha) ficam de fora — salvo se forem a do lançamento
 * em edição, para ele não abrir sem categoria marcada.
 */
export function categoriasDaEscolha(lista: ListaDeCategorias | null | undefined, kind: KindDaCategoria, idAtual?: string | null, textoAtual?: string | null): OpcaoDeCategoria[] {
  if (!lista) return listaFixa(kind);
  var nAtual = normalizarCategoria(textoAtual);
  return lista.categories
    .filter(function(c) {
      if (c.kind !== kind || !ativa(c)) return false;
      if (c.manual || c.id === idAtual) return true;
      if (idAtual && c.subcategories.some(function(s) { return s.id === idAtual; })) return true;
      return !!nAtual && normalizarCategoria(c.name) === nAtual;
    })
    .map(function(c) {
      return { id: c.id, name: c.name, color: c.color, is_system: c.is_system, subcategories: c.subcategories.filter(ativa) };
    });
}

/** A categoria (de 1º nível) cujo nome casa com o texto, sem acento/caixa. */
export function acharPorTexto(opcoes: OpcaoDeCategoria[], texto: string | null | undefined): OpcaoDeCategoria | null {
  var n = normalizarCategoria(texto);
  if (!n) return null;
  return opcoes.find(function(o) { return normalizarCategoria(o.name) === n; }) || null;
}

/**
 * O que o modal marca ao abrir um lançamento para editar.
 * category_id pode apontar para a mãe ou para uma subcategoria; sem ele, casa
 * pelo texto.
 */
export function selecaoInicial(
  opcoes: OpcaoDeCategoria[],
  tx: { category?: string | null; category_id?: string | null } | null | undefined,
): { categoria: OpcaoDeCategoria | null; subId: string | null } {
  if (!tx) return { categoria: null, subId: null };
  if (tx.category_id) {
    for (var i = 0; i < opcoes.length; i++) {
      var o = opcoes[i];
      if (o.id === tx.category_id) return { categoria: o, subId: null };
      var sub = o.subcategories.find(function(s) { return s.id === tx.category_id; });
      if (sub) return { categoria: o, subId: sub.id };
    }
  }
  return { categoria: acharPorTexto(opcoes, tx.category), subId: null };
}

/** Corpo do lançamento: texto = nome da mãe; id = sub, se escolhida, senão a mãe. */
export function camposDaCategoria(categoria: OpcaoDeCategoria | null, subId: string | null, textoPadrao: string): { category: string; category_id?: string | null } {
  if (!categoria) return { category: textoPadrao };
  var out: { category: string; category_id?: string | null } = { category: categoria.name };
  if (categoria.id) out.category_id = subId || categoria.id;
  return out;
}

// ── Gestão (seção A) ────────────────────────────────────────────────────
var DESCRICAO_DO_SISTEMA: Record<string, string> = {
  "taxas de cartao": "Lançada sozinha pela taxa da maquininha (Configurações › Caixa)",
  vendas: "Vem do Caixa e da loja online",
  crediario: "Parcelas recebidas e a receber",
  "trocas e devolucoes": "Lançada sozinha pela troca e pela devolução",
};

export function textoDosLancamentos(n: number, ano?: number): string {
  if (n <= 0) return "Nenhum lançamento" + (ano ? " em " + ano : "");
  return n + (n === 1 ? " lançamento" : " lançamentos") + (ano ? " em " + ano : "");
}

export function linhaDeBaixo(c: CategoriaFinanceira, ano?: number): string {
  var especial = c.is_system ? DESCRICAO_DO_SISTEMA[normalizarCategoria(c.name)] : null;
  if (especial) return especial;
  var t = textoDosLancamentos(c.count, ano);
  if (c.is_system && c.dre_label && normalizarCategoria(c.name) === "fornecedores") {
    t += " · entra como “" + c.dre_label + "” no resultado";
  }
  return t;
}

/** Destinos possíveis de "Juntar com outra" (mesmo tipo, ativas, não ela). */
export function destinosDaJuncao(lista: ListaDeCategorias | null | undefined, origem: { id: string; kind: KindDaCategoria; parent_id: string | null }): { id: string; label: string }[] {
  if (!lista) return [];
  var out: { id: string; label: string }[] = [];
  lista.categories.forEach(function(c) {
    if (c.kind !== origem.kind || !ativa(c)) return;
    if (normalizarCategoria(c.name) === "trocas e devolucoes" && c.is_system) return;
    if (c.id !== origem.id) out.push({ id: c.id, label: c.name });
    // Categoria principal só junta com principal (o backend recusa sub).
    if (origem.parent_id) {
      c.subcategories.filter(ativa).forEach(function(s) {
        if (s.id !== origem.id) out.push({ id: s.id, label: c.name + " › " + s.name });
      });
    }
  });
  return out;
}

// ── Relatório (seção D) ─────────────────────────────────────────────────
export type LinhaDeSubcategoria = { key: string; label: string; value: number; pct: number };
export type LinhaDeCategoria = {
  key: string;
  label: string;
  value: number;
  pct: number;
  /** Subcategorias com valor, maior primeiro. */
  subs: LinhaDeSubcategoria[];
  /** Valor sem subcategoria (só faz sentido quando há subs). */
  semSub: number;
};

type TxDoRelatorio = {
  type: string;
  status?: string;
  amount: number;
  category?: string | null;
  category_name?: string | null;
  subcategory?: string | null;
};

/**
 * Agrupa por categoria-mãe e abre em subcategorias. Só confirmados (como o
 * resto do relatório). Chave pelo nome normalizado; o rótulo é o nome atual
 * da categoria quando algum lançamento do grupo está ligado.
 */
export function agruparPorCategoria(txs: TxDoRelatorio[], kind: KindDaCategoria): LinhaDeCategoria[] {
  var grupos: Record<string, { label: string; ligado: boolean; value: number; semSub: number; subs: Record<string, { label: string; value: number }> }> = {};
  txs.forEach(function(t) {
    if (t.type !== kind || (t.status && t.status !== "confirmed")) return;
    var nome = t.category_name || t.category || "Outros";
    var k = normalizarCategoria(nome) || "outros";
    var g = grupos[k];
    if (!g) g = grupos[k] = { label: nome, ligado: !!t.category_name, value: 0, semSub: 0, subs: {} };
    else if (t.category_name && !g.ligado) { g.label = t.category_name; g.ligado = true; }
    var v = t.amount || 0;
    g.value += v;
    if (t.subcategory) {
      var sk = normalizarCategoria(t.subcategory);
      if (!g.subs[sk]) g.subs[sk] = { label: t.subcategory, value: 0 };
      g.subs[sk].value += v;
    } else {
      g.semSub += v;
    }
  });
  var total = Object.keys(grupos).reduce(function(s, k) { return s + grupos[k].value; }, 0);
  var linhas = Object.keys(grupos).map(function(k) {
    var g = grupos[k];
    var subs = Object.keys(g.subs).map(function(sk) {
      return { key: k + "|" + sk, label: g.subs[sk].label, value: g.subs[sk].value, pct: total > 0 ? (g.subs[sk].value / total) * 100 : 0 };
    }).sort(function(a, b) { return b.value - a.value; });
    return { key: k, label: g.label, value: g.value, pct: total > 0 ? (g.value / total) * 100 : 0, subs: subs, semSub: g.semSub };
  });
  linhas.sort(function(a, b) { return b.value - a.value; });
  return linhas;
}

/** O lançamento entra no filtro de categoria (e subcategoria) da lista? */
export function casaComFiltro(t: TxDoRelatorio, categoria: string | null, subcategoria?: string | null): boolean {
  if (!categoria) return true;
  var nome = t.category_name || t.category || "Outros";
  if (normalizarCategoria(nome) !== normalizarCategoria(categoria)) return false;
  if (subcategoria === undefined || subcategoria === null) return true;
  if (subcategoria === "") return !t.subcategory;
  return normalizarCategoria(t.subcategory) === normalizarCategoria(subcategoria);
}
