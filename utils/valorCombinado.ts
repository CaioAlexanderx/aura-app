// ============================================================
// AURA. — Valor combinado da assinatura (14/10/2026)
//
// Caso real: Luis Henrique fechou Negócio anual por R$ 211,20/mês (tabela
// R$ 140,83 + R$ 70,37 da segunda loja). O checkout padrão só sabe somar
// plano + R$ 19 × acessos extras. A equipe grava o valor combinado em
// companies.custom_subscription_* (Gestão Aura) e o backend devolve o valor
// certo em GET /companies/:id/billing/quote; o checkout só mostra.
//
// Regras deste arquivo (puras, testadas sem renderizar):
//   1. O valor combinado só vale quando o backend diz custom === true e o
//      plano/ciclo da cotação são os que estão na tela.
//   2. Qualquer outra coisa (endpoint ausente, erro, resposta estranha,
//      custom:false) devolve null e a tela mantém o cálculo de tabela. O
//      checkout é caminho de cobrança: nunca depende do endpoint novo.
//   3. Gestão Aura: validação do formulário que define o valor combinado.
// ============================================================

// Mesmo piso do backend (MIN_CHARGE_BRL em services/billingPricing.js).
export var VALOR_COMBINADO_MINIMO = 5;
// Limites do PUT (Aura-backend#840): R$ 100.000 e observação de até 1000 caracteres.
export var VALOR_COMBINADO_MAXIMO = 100000;
export var NOTA_VALOR_COMBINADO_MAX = 1000;

export var ROTULO_VALOR_COMBINADO = "Valor combinado";

export var TEXTO_CONFIRMACAO_VALOR_COMBINADO =
  "Passa a valer no próximo checkout da empresa e protege o valor contra reajuste automático de acessos extras.";

export var TEXTO_REMOCAO_VALOR_COMBINADO =
  "A empresa volta ao valor de tabela (plano + acessos extras) no próximo checkout. " +
  "A assinatura que já existe na Asaas não muda sozinha: use Ressincronizar assinatura se precisar.";

/** GET /companies/:id/billing/quote → o que a tela precisa. `note` nunca vem ao cliente. */
export type QuoteResponse = {
  plan?: string;
  cycle?: string;
  billing_type?: string;
  extra_seats?: number;
  value?: number | string | null;
  custom?: boolean;
  table_value?: number | string | null;
};

function paraNumero(v: unknown): number | null {
  var n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(",", ".")) : NaN;
  return isFinite(n) ? n : null;
}

function arredonda(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Valor mensal combinado para o plano e o ciclo escolhidos, ou null quando a
 * tela deve ficar no cálculo de tabela.
 */
export function valorCombinadoDaCotacao(
  q: QuoteResponse | null | undefined,
  plano: string,
  ciclo: string,
): number | null {
  if (!q || typeof q !== "object" || q.custom !== true) return null;
  // Cotação de outro plano/ciclo (resposta atrasada) não vale para esta tela.
  if (q.plan && String(q.plan).toLowerCase() !== String(plano).toLowerCase()) return null;
  if (q.cycle && String(q.cycle).toLowerCase() !== String(ciclo).toLowerCase()) return null;
  var v = paraNumero(q.value);
  if (v === null || v <= 0) return null;
  return arredonda(v);
}

/** Total mensal que o resumo e o botão mostram, e se é o valor combinado. */
export function totalDoCheckout(
  totalTabela: number,
  q: QuoteResponse | null | undefined,
  plano: string,
  ciclo: string,
): { total: number; combinado: boolean } {
  var v = valorCombinadoDaCotacao(q, plano, ciclo);
  return v === null ? { total: totalTabela, combinado: false } : { total: v, combinado: true };
}

export function formatarBRL(v: number): string {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "R$ 211,20 por mês" — sem valor de tabela riscado ao lado. */
export function textoValorPorMes(v: number): string {
  return formatarBRL(v) + " por mês";
}

// ------------------------------------------------------------
// Gestão Aura › Valor combinado da assinatura
// ------------------------------------------------------------

export var PLANOS_VALOR_COMBINADO: { key: string; label: string }[] = [
  { key: "essencial", label: "Essencial" },
  { key: "negocio", label: "Negócio" },
  { key: "expansao", label: "Expansão" },
];

export var CICLOS_VALOR_COMBINADO: { key: "monthly" | "annual"; label: string }[] = [
  { key: "monthly", label: "Mensal" },
  { key: "annual", label: "Anual" },
];

export function rotuloDoPlano(plano?: string | null): string {
  var p = String(plano || "").toLowerCase();
  var achou = PLANOS_VALOR_COMBINADO.filter(function (x) { return x.key === p; })[0];
  return achou ? achou.label : (plano || "—");
}

export function rotuloDoCiclo(ciclo?: string | null): string {
  return String(ciclo || "").toLowerCase() === "annual" ? "anual" : "mensal";
}

/** Bloco que o backend devolve no detalhe do cliente (clients-360). */
export type CustomSubscription = {
  value: number | string;
  plan: string;
  cycle: string;
  note?: string | null;
  set_at?: string | null;
  set_by?: string | null;
};

/** Normaliza o bloco do backend; null quando não há valor combinado. */
export function lerValorCombinado(raw: unknown): { value: number; plan: string; cycle: string; note: string; setAt: string | null } | null {
  if (!raw || typeof raw !== "object") return null;
  var r = raw as Record<string, any>;
  var v = paraNumero(r.value);
  if (v === null || v <= 0) return null;
  return {
    value: arredonda(v),
    plan: String(r.plan || ""),
    cycle: String(r.cycle || ""),
    note: typeof r.note === "string" ? r.note : "",
    setAt: typeof r.set_at === "string" ? r.set_at : null,
  };
}

/** Linha de resumo do bloco: "R$ 211,20/mês · Negócio · anual" ou "Valor de tabela". */
export function resumoDoValorCombinado(raw: unknown): string {
  var cs = lerValorCombinado(raw);
  if (!cs) return "Valor de tabela";
  return formatarBRL(cs.value) + "/mês · " + rotuloDoPlano(cs.plan) + " · " + rotuloDoCiclo(cs.cycle);
}

/** "211,20", "1.234,56" ou "211.20" → 211.2. Qualquer outra coisa → null. */
export function lerValorDigitado(texto: string): number | null {
  var t = String(texto || "").replace(/R\$/gi, "").replace(/\s/g, "");
  if (!t) return null;
  if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  var n = parseFloat(t);
  return isFinite(n) ? arredonda(n) : null;
}

export type FormValorCombinado = {
  valor: string;
  plano: string;
  ciclo: string;
  nota: string;
  motivo: string;
};

export function formInicialValorCombinado(
  atual: unknown,
  planoDaEmpresa?: string | null,
  cicloDaEmpresa?: string | null,
): FormValorCombinado {
  var cs = lerValorCombinado(atual);
  var plano = cs ? cs.plan : String(planoDaEmpresa || "").toLowerCase();
  if (!PLANOS_VALOR_COMBINADO.some(function (p) { return p.key === plano; })) plano = "negocio";
  var ciclo = cs ? cs.cycle : String(cicloDaEmpresa || "").toLowerCase();
  if (ciclo !== "annual" && ciclo !== "monthly") ciclo = "monthly";
  return {
    valor: cs ? String(cs.value.toFixed(2)).replace(".", ",") : "",
    plano: plano,
    ciclo: ciclo,
    nota: cs ? cs.note : "",
    motivo: "",
  };
}

export type ValidacaoValorCombinado = {
  ok: boolean;
  erros: Partial<Record<keyof FormValorCombinado, string>>;
  valor: number | null;
};

/**
 * @param minimo `min_value` que o servidor devolve no GET; sem ele, o piso conhecido (R$ 5).
 */
export function validarValorCombinado(f: FormValorCombinado, minimo?: number | null): ValidacaoValorCombinado {
  var erros: ValidacaoValorCombinado["erros"] = {};
  var piso = typeof minimo === "number" && isFinite(minimo) && minimo > 0 ? minimo : VALOR_COMBINADO_MINIMO;
  var valor = lerValorDigitado(f.valor);
  if (valor === null) erros.valor = "Informe o valor mensal, por exemplo 211,20.";
  else if (valor < piso) erros.valor = "O mínimo é " + formatarBRL(piso) + " por mês.";
  else if (valor > VALOR_COMBINADO_MAXIMO) erros.valor = "O máximo é " + formatarBRL(VALOR_COMBINADO_MAXIMO) + " por mês.";
  if (f.nota.trim().length > NOTA_VALOR_COMBINADO_MAX) erros.nota = "A observação aceita até " + NOTA_VALOR_COMBINADO_MAX + " caracteres.";
  if (!PLANOS_VALOR_COMBINADO.some(function (p) { return p.key === f.plano; })) erros.plano = "Escolha o plano.";
  if (f.ciclo !== "monthly" && f.ciclo !== "annual") erros.ciclo = "Escolha o ciclo.";
  if (f.motivo.trim().length < 3) erros.motivo = "Diga o motivo: fica no log de auditoria.";
  return { ok: Object.keys(erros).length === 0, erros: erros, valor: valor };
}

/** Corpo do PUT /admin/clients/:cid/custom-subscription. */
export function corpoDoValorCombinado(f: FormValorCombinado, valor: number) {
  return {
    value: valor,
    plan: f.plano,
    cycle: f.ciclo,
    note: f.nota.trim() || null,
    reason: f.motivo.trim(),
  };
}
