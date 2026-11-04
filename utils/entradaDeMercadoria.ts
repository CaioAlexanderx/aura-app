// ============================================================
// AURA. — Entrada de mercadoria e custo por fornecedor (03/11/2026)
//
// Mockup: docs/mockups/estoque-entrada-por-fornecedor.html (telas 1-9).
// Backend: Aura-backend#950 (migration 424, src/routes/productSuppliers.js).
//
// O produto continua UM (não é variante: variante abre o seletor no Caixa
// em toda venda). Cada ENTRADA guarda fornecedor + quantidade + custo; a
// conta do custo médio aqui é a MESMA do backend (services/
// entradaDeMercadoria.js) — a prévia "R$ 5,50 → R$ 5,83" que a pessoa vê
// antes de confirmar tem que bater com o que grava.
//
// Puro (sem React/RN/store): o jest carrega direto.
// ============================================================

const round = (n: number, casas: number) => {
  const f = 10 ** casas;
  return Math.round((n + Number.EPSILON) * f) / f;
};

export function numeroPositivo(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Mesma regra do backend: estoque negativo fora da média; sem custo, não muda. */
export function custoMedioPonderado(a: {
  estoqueAntes: number; custoAtual: number | null; quantidade: number; custoUnitario: number | null;
}): number | null {
  const q = numeroPositivo(a.quantidade);
  const c = numeroPositivo(a.custoUnitario);
  const atual = numeroPositivo(a.custoAtual);
  if (!q || !c) return atual === null ? null : round(atual, 4);
  const base = Math.max(Number(a.estoqueAntes) || 0, 0);
  if (atual === null || base === 0) return round(c, 4);
  return round((base * atual + q * c) / (base + q), 4);
}

export function margemPct(preco: number | null | undefined, custo: number | null | undefined): number | null {
  const p = Number(preco);
  const c = Number(custo);
  if (!(p > 0) || !(c > 0)) return null;
  return Math.round(((p - c) / p) * 100);
}

export type PreviaDaEntrada = {
  estoqueAntes: number;
  estoqueDepois: number;
  custoAntes: number | null;
  custoDepois: number | null;
  margemAntes: number | null;
  margemDepois: number | null;
  total: number | null;
};

export function previaDaEntrada(a: {
  estoqueAntes: number; custoAtual: number | null; quantidade: number; custoUnitario: number | null; preco: number | null;
}): PreviaDaEntrada {
  const q = numeroPositivo(a.quantidade) || 0;
  const custoDepois = custoMedioPonderado({ ...a, quantidade: q });
  const c = numeroPositivo(a.custoUnitario);
  const custoAntes = numeroPositivo(a.custoAtual);
  return {
    estoqueAntes: Number(a.estoqueAntes) || 0,
    estoqueDepois: round((Number(a.estoqueAntes) || 0) + q, 3),
    custoAntes,
    custoDepois,
    margemAntes: margemPct(a.preco, custoAntes),
    margemDepois: margemPct(a.preco, custoDepois),
    total: c && q ? round(c * q, 2) : null,
  };
}

/**
 * Aviso "Confere?" (decisão do PO, tela 2): custo da entrada 50% acima do
 * custo médio. Pega o erro de digitação 59,00 no lugar de 5,90 — o mesmo da
 * vírgula perdida que já apareceu em planilha de cliente importada. Não
 * bloqueia: só pergunta.
 */
export function custoMuitoAcima(custoMedio: number | null, custoUnitario: number | null): boolean {
  const m = numeroPositivo(custoMedio);
  const c = numeroPositivo(custoUnitario);
  return !!m && !!c && c > m * 1.5;
}

export type CompraPorFornecedor = {
  supplier_id: string;
  supplier_name: string;
  quantity: number | null;
  unit_cost?: number | null;
  avg_cost?: number | null;
  last_purchase_at?: string | null;
};

/**
 * "Distribuidora Brás vende mais barato: R$ 5,21, contra R$ 5,90 da Alfa"
 * (tela 5). Compara o ÚLTIMO custo de cada um; precisa de pelo menos dois
 * fornecedores com custo e de diferença de verdade (≥ 1 centavo).
 */
export function maisBarato(lista: CompraPorFornecedor[]): { barato: CompraPorFornecedor; caro: CompraPorFornecedor; diferenca: number } | null {
  const com = (lista || []).filter((f) => numeroPositivo(f.unit_cost) !== null);
  if (com.length < 2) return null;
  const ord = [...com].sort((a, b) => Number(a.unit_cost) - Number(b.unit_cost));
  const barato = ord[0];
  const caro = ord[ord.length - 1];
  const diferenca = round(Number(caro.unit_cost) - Number(barato.unit_cost), 2);
  return diferenca >= 0.01 ? { barato, caro, diferenca } : null;
}

// ── Fornecedores do produto (tela 8) ─────────────────────────────

export type LinhaDeFornecedor = {
  supplier_id: string;
  name: string;
  /** Texto do campo (máscara "5,21"). "" = sem custo. */
  custo: string;
  codigo: string;
  principal: boolean;
};

/** Corpo do PUT /products/:pid/suppliers. Sem custo visível, `cost` NÃO vai
 *  (o backend mantém o gravado). */
export function corpoDosFornecedores(linhas: LinhaDeFornecedor[], semCusto: boolean) {
  const vistos = new Set<string>();
  const suppliers = [] as Array<{ supplier_id: string; cost?: number | null; supplier_code: string | null; is_main: boolean }>;
  for (const l of linhas) {
    if (!l.supplier_id || vistos.has(l.supplier_id)) continue;
    vistos.add(l.supplier_id);
    const item: any = { supplier_id: l.supplier_id, supplier_code: l.codigo.trim() || null, is_main: l.principal };
    if (!semCusto) item.cost = numeroPositivo(l.custo);
    suppliers.push(item);
  }
  return { suppliers };
}

/** Sempre um principal (o primeiro, se ninguém marcou). */
export function comUmPrincipal(linhas: LinhaDeFornecedor[]): LinhaDeFornecedor[] {
  if (!linhas.length) return linhas;
  let idx = linhas.findIndex((l) => l.principal);
  if (idx < 0) idx = 0;
  return linhas.map((l, k) => ({ ...l, principal: k === idx }));
}

/** "Varia de R$ 4,80 a R$ 5,90 conforme o fornecedor" — null sem variação. */
export function faixaDeCusto(linhas: LinhaDeFornecedor[]): { min: number; max: number } | null {
  const cs = linhas.map((l) => numeroPositivo(l.custo)).filter((c): c is number => c !== null);
  if (cs.length < 2) return null;
  const min = Math.min(...cs);
  const max = Math.max(...cs);
  return max - min >= 0.01 ? { min, max } : null;
}

// ── Corpo do POST /products/:pid/stock-entries ──────────────────

export type FornecedorDaEntrada =
  | { tipo: "existente"; id: string; name: string }
  | { tipo: "novo"; name: string; phone?: string; cnpj?: string };

export function corpoDaEntrada(a: {
  fornecedor: FornecedorDaEntrada | null;
  quantidade?: string | number;
  grade?: Array<{ variant_id: string; quantidade: string | number }>;
  custo: string | number | null;
  nota?: string;
  usarCustoMedio: boolean;
  semCusto: boolean;
}): { erro: string } | { corpo: Record<string, unknown>; total: number } {
  const corpo: Record<string, unknown> = {};
  let total = 0;
  if (a.grade && a.grade.length) {
    const items = a.grade
      .map((g) => ({ variant_id: g.variant_id, quantity: numeroPositivo(g.quantidade) }))
      .filter((g) => g.quantity);
    if (!items.length) return { erro: "Diga quantas chegaram de cada" };
    corpo.items = items;
    total = items.reduce((s, i) => s + (i.quantity as number), 0);
  } else {
    const q = numeroPositivo(a.quantidade);
    if (!q) return { erro: "Diga quantas chegaram" };
    corpo.quantity = q;
    total = q;
  }
  if (a.fornecedor?.tipo === "existente") corpo.supplier_id = a.fornecedor.id;
  else if (a.fornecedor?.tipo === "novo") {
    const name = a.fornecedor.name.trim();
    if (!name) return { erro: "Diga o nome do fornecedor" };
    corpo.new_supplier = {
      name,
      ...(a.fornecedor.phone?.trim() ? { phone: a.fornecedor.phone.trim() } : {}),
      ...(a.fornecedor.cnpj?.replace(/\D/g, "") ? { cnpj: a.fornecedor.cnpj.replace(/\D/g, "") } : {}),
    };
  }
  if (!a.semCusto) {
    const c = numeroPositivo(a.custo);
    if (c) corpo.unit_cost = c;
    corpo.update_cost = a.usarCustoMedio;
  }
  if (a.nota && a.nota.trim()) corpo.invoice_number = a.nota.trim();
  return { corpo, total: round(total, 3) };
}
