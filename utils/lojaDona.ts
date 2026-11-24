// ============================================================
// AURA. — Loja dona do produto no grupo (18/11/2026, INC-2026-11-18-01)
//
// Relato: lojista com matriz e filial via, nas Etiquetas e no Estoque, os
// produtos das duas lojas misturados, sem saber de qual loja cada um era.
// O produto compartilhado no grupo (is_group_shared) aparece nas duas
// lojas, mas pertence a UMA: products.company_id, a loja dona, onde fica o
// estoque. O GET /companies/:id/products manda esse id como
// `stock_company_id` (hooks/useProducts -> Product.lojaDonaId).
//
// Regras (sem React; a tela só desenha):
//   - o contexto de lojas só existe quando a lista MISTURA lojas: pelo
//     menos duas lojas donas diferentes (a empresa aberta conta sempre).
//     Fora de grupo, grupo sem compartilhamento ou backend antigo (sem o
//     id da loja dona) -> null, e a tela fica exatamente como antes;
//   - o nome vem do switcher (nome fantasia > nome > razão social); loja
//     dona que o usuário não acessa vira "Outra loja do grupo";
//   - "Todas as lojas" é o padrão e não filtra nada;
//   - a escolha fica lembrada por tela e por empresa, neste navegador;
//     storage indisponível ou loja que saiu da lista -> "Todas as lojas".
// ============================================================

export const TODAS_AS_LOJAS = "todas";
export const TEXTO_TODAS_AS_LOJAS = "Todas as lojas";
export const TEXTO_OUTRA_LOJA = "Outra loja do grupo";
export const ROTULO_FILTRO_LOJA = "Loja:";

export type LojaDaLista = { id: string; nome: string };

export type ContextoDeLojas = {
  /** A empresa aberta primeiro; as outras em ordem de nome. */
  lojas: LojaDaLista[];
  nomes: Record<string, string>;
};

type EmpresaDoSwitcher = { id: string; trade_name?: string | null; name?: string | null; legal_name?: string | null };

function nomeDaEmpresa(c: EmpresaDoSwitcher | null | undefined): string {
  var nome = c && (c.trade_name || c.name || c.legal_name);
  return nome ? String(nome).trim() : "";
}

/** Id da loja dona do item; null quando o backend não mandou. */
export function lojaDonaDoProduto(p: { lojaDonaId?: string | null } | null | undefined): string | null {
  return p && p.lojaDonaId ? String(p.lojaDonaId) : null;
}

/**
 * Lojas que aparecem na lista. null = a lista é de uma loja só (nada muda
 * na tela). `nomesConhecidos` completa o switcher (ex.: o nome que o
 * consolidado já traz em cada item).
 */
export function contextoDeLojas(
  empresas: EmpresaDoSwitcher[] | null | undefined,
  empresaAtualId: string | null | undefined,
  idsDasLojasDonas: Array<string | null | undefined>,
  nomesConhecidos?: Record<string, string | null | undefined>,
): ContextoDeLojas | null {
  var ids: string[] = [];
  function junta(id: string | null | undefined) {
    if (!id) return;
    var s = String(id);
    if (ids.indexOf(s) < 0) ids.push(s);
  }
  idsDasLojasDonas.forEach(junta);
  if (ids.length === 0) return null;
  junta(empresaAtualId);
  if (ids.length < 2) return null;

  var doSwitcher: Record<string, string> = {};
  (empresas || []).forEach(function (c) { if (c && c.id) doSwitcher[String(c.id)] = nomeDaEmpresa(c); });
  var nomes: Record<string, string> = {};
  ids.forEach(function (id) {
    var conhecido = nomesConhecidos && nomesConhecidos[id] ? String(nomesConhecidos[id]).trim() : "";
    nomes[id] = doSwitcher[id] || conhecido || TEXTO_OUTRA_LOJA;
  });

  var atual = empresaAtualId ? String(empresaAtualId) : null;
  var lojas = ids
    .map(function (id) { return { id: id, nome: nomes[id] }; })
    .sort(function (a, b) {
      if (a.id === atual) return -1;
      if (b.id === atual) return 1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  return { lojas: lojas, nomes: nomes };
}

/** Nome da loja dona para o selo da linha; null = sem selo. */
export function nomeDaLojaDona(ctx: ContextoDeLojas | null, lojaDonaId: string | null | undefined): string | null {
  if (!ctx || !lojaDonaId) return null;
  return ctx.nomes[String(lojaDonaId)] || null;
}

/** A escolha vale só se a loja ainda está na lista; senão, todas. */
export function lojaValida(ctx: ContextoDeLojas | null, escolha: string | null | undefined): string {
  if (!ctx || !escolha || escolha === TODAS_AS_LOJAS) return TODAS_AS_LOJAS;
  return ctx.lojas.some(function (l) { return l.id === escolha; }) ? escolha : TODAS_AS_LOJAS;
}

/**
 * Filtra pela loja dona. "Todas as lojas" (ou sem contexto) devolve a
 * MESMA lista, sem copiar: quem não usa o filtro fica idêntico ao de hoje.
 */
export function filtrarPorLoja<T>(itens: T[], ctx: ContextoDeLojas | null, escolha: string, donaDe: (item: T) => string | null | undefined): T[] {
  var loja = lojaValida(ctx, escolha);
  if (loja === TODAS_AS_LOJAS) return itens;
  return itens.filter(function (it) { var d = donaDe(it); return !!d && String(d) === loja; });
}

// ── Escolha lembrada (por tela e por empresa) ──────────────────────
export type TelaDoFiltroDeLoja = "etiquetas" | "estoque" | "estoque-consolidado";

export function chaveDaLojaEscolhida(tela: TelaDoFiltroDeLoja, empresaId: string | null | undefined): string {
  return "aura:filtro-loja:" + tela + ":" + (empresaId ? String(empresaId) : "sem-empresa");
}

export function lerLojaEscolhida(tela: TelaDoFiltroDeLoja, empresaId: string | null | undefined): string {
  try {
    if (typeof window === "undefined" || !window.localStorage) return TODAS_AS_LOJAS;
    var v = window.localStorage.getItem(chaveDaLojaEscolhida(tela, empresaId));
    return v ? String(v) : TODAS_AS_LOJAS;
  } catch (e) {
    return TODAS_AS_LOJAS;
  }
}

export function salvarLojaEscolhida(tela: TelaDoFiltroDeLoja, empresaId: string | null | undefined, loja: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    var chave = chaveDaLojaEscolhida(tela, empresaId);
    if (!loja || loja === TODAS_AS_LOJAS) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, loja);
  } catch (e) { /* sem storage: vale só nesta visita */ }
}
