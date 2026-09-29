// ============================================================
// Quadro do Financeiro — regras puras (28/09/2026)
//
// Três colunas: Atrasado · A receber · Recebido (A pagar · Pago nas
// despesas). "Atrasado" não é gravado: o backend calcula pela data do
// lançamento contra hoje em São Paulo, então nenhum cartão é arrastado para
// lá. Os movimentos que existem:
//   aberto/atrasado → feito   baixa (data + forma de pagamento)
//   atrasado → aberto         nova data de vencimento (renegociou)
//   feito → aberto            desfazer a baixa (se já venceu, volta p/ Atrasado)
// O crediário fica fora do quadro nesta fase (backend: GET /transactions/board).
// ============================================================

export type TipoQuadro = "income" | "expense";
export type ColunaQuadro = "atrasado" | "aberto" | "feito";

export type CartaoQuadro = {
  id: string;
  description: string;
  category: string;
  amount: number;
  /** Valor do boleto quando a baixa foi com outro valor (amount = pago). */
  original_amount?: number | null;
  /** F3: nome do comprovante anexado. */
  receipt_filename?: string | null;
  status: "pending" | "confirmed";
  /** Data do lançamento (competência) — AAAA-MM-DD. */
  date: string | null;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  employee_id?: string | null;
  employee_name: string | null;
  recurrence_type: string | null;
  recurrence_index: number | null;
  /** Só manual ou planilha. O resto muda pelo fluxo de origem (venda, troca...). */
  movable: boolean;
};

export type GrupoQuadro = { date: string; origem: "caixa" | "taxas"; count: number; total: number };

/** F2: pago a mais (juros/multa) ou a menos (desconto) que o valor original, no mês. */
export type DiferencaDoMes = { a_mais: number; a_menos: number; count_a_mais: number };

export type ColunaDados = { total: number; count: number; items: CartaoQuadro[]; grupos?: GrupoQuadro[]; diferenca?: DiferencaDoMes };

/** F2: pendentes de hoje até hoje+6, de qualquer mês. */
export type SemanaDoQuadro = { count: number; total: number; until: string | null };

export type Quadro = {
  type: TipoQuadro;
  month: string;
  today: string;
  limit_per_column: number;
  columns: Record<ColunaQuadro, ColunaDados>;
  week?: SemanaDoQuadro;
};

export const ORDEM_DAS_COLUNAS: ColunaQuadro[] = ["atrasado", "aberto", "feito"];

export function rotulos(tipo: TipoQuadro) {
  return tipo === "income"
    ? { atrasado: "Atrasado", aberto: "A receber", feito: "Recebido", acao: "Recebi", verbo: "recebido", baixa: "recebimento", titulo: "Receitas" }
    : { atrasado: "Atrasado", aberto: "A pagar", feito: "Pago", acao: "Paguei", verbo: "pago", baixa: "pagamento", titulo: "Despesas" };
}

export type Movimento = "baixa" | "nova_data" | "desfazer";

/** O que acontece ao soltar um cartão de `de` em `para` (null = não pode). */
export function movimento(de: ColunaQuadro, para: ColunaQuadro): Movimento | null {
  if (de === para) return null;
  if (para === "atrasado") return null;
  if (para === "feito") return "baixa";
  if (de === "atrasado") return "nova_data";
  if (de === "feito") return "desfazer";
  return null;
}

/** Motivo curto quando o movimento não vale — vira aviso na tela. */
export function motivoDoBloqueio(de: ColunaQuadro, para: ColunaQuadro, movable: boolean): string | null {
  if (de === para) return null;
  if (!movable) return "Este lançamento veio de uma venda ou de outro fluxo e muda por lá.";
  if (para === "atrasado") return "Atrasado é pela data de vencimento. O cartão entra sozinho quando vence.";
  return movimento(de, para) ? null : "Esse movimento não existe no quadro.";
}

function partes(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

/** Dias de `de` até `ate` (datas AAAA-MM-DD, sem fuso). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((partes(ate) - partes(de)) / 86400000);
}

export function ddmm(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(8, 10) + "/" + iso.slice(5, 7);
}

/** Selo de prazo do cartão: "Venceu há 5 dias", "Vence amanhã", "Vence 30/09". */
export function seloDoPrazo(c: Pick<CartaoQuadro, "date">, coluna: ColunaQuadro, hoje: string): { texto: string; tom: "atraso" | "breve" | "neutro" } | null {
  if (!c.date || coluna === "feito") return null;
  const n = diasEntre(c.date, hoje);
  if (coluna === "atrasado") return { texto: "Venceu há " + n + (n === 1 ? " dia" : " dias"), tom: "atraso" };
  const f = -n;
  if (f === 0) return { texto: "Vence hoje", tom: "breve" };
  if (f === 1) return { texto: "Vence amanhã", tom: "breve" };
  if (f <= 3) return { texto: "Vence em " + f + " dias", tom: "breve" };
  return { texto: "Vence " + ddmm(c.date), tom: "neutro" };
}

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function nomeDoMes(mes: string): string {
  const n = Number(mes.slice(5, 7));
  const nome = MESES[n - 1] || "";
  return nome.charAt(0).toUpperCase() + nome.slice(1) + " " + mes.slice(0, 4);
}

export function somarMes(mes: string, delta: number): string {
  let a = Number(mes.slice(0, 4));
  let m = Number(mes.slice(5, 7)) - 1 + delta;
  a += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return a + "-" + String(m + 1).padStart(2, "0");
}

/** "de agosto" no cartão atrasado que veio de outro mês. */
export function mesDeOrigem(c: Pick<CartaoQuadro, "date">, mesAtual: string): string | null {
  if (!c.date || c.date.slice(0, 7) === mesAtual) return null;
  return "de " + MESES[Number(c.date.slice(5, 7)) - 1];
}

// Mesmos valores que o backend aceita (VALID_PAYMENTS em routes/transactions.js).
export const FORMAS_DE_PAGAMENTO: { valor: string; rotulo: string }[] = [
  { valor: "pix", rotulo: "Pix" },
  { valor: "cash", rotulo: "Dinheiro" },
  { valor: "debit", rotulo: "Débito" },
  { valor: "credit", rotulo: "Crédito" },
  { valor: "transfer", rotulo: "Transferência" },
  { valor: "boleto", rotulo: "Boleto" },
  { valor: "voucher", rotulo: "Vale" },
];

export function rotuloDaForma(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const f = FORMAS_DE_PAGAMENTO.find((x) => x.valor === valor);
  return f ? f.rotulo : null;
}

/**
 * Aplica o movimento no quadro em cache (atualização otimista). Recalcula
 * contagem e total das colunas afetadas. O backend decide a coluna de fato
 * no próximo GET; aqui "desfazer" de algo já vencido cai em Atrasado.
 */
export function aplicarMovimento(q: Quadro, id: string, mov: Movimento, dados: { data?: string; forma?: string | null; valorPago?: number | null }): Quadro {
  let de: ColunaQuadro | null = null;
  let cartao: CartaoQuadro | null = null;
  for (const k of ORDEM_DAS_COLUNAS) {
    const achado = q.columns[k].items.find((c) => c.id === id);
    if (achado) { de = k; cartao = achado; break; }
  }
  if (!de || !cartao) return q;
  let novo: CartaoQuadro = { ...cartao };
  let para: ColunaQuadro;
  if (mov === "baixa") {
    novo = { ...novo, status: "confirmed", paid_at: dados.data ? dados.data + "T03:00:00.000Z" : new Date().toISOString(), payment_method: dados.forma ?? novo.payment_method };
    const boleto = novo.original_amount ?? novo.amount;
    if (dados.valorPago && Math.abs(dados.valorPago - boleto) >= 0.005) novo = { ...novo, amount: dados.valorPago, original_amount: boleto };
    else if (dados.valorPago) novo = { ...novo, amount: boleto, original_amount: null };
    para = "feito";
  } else if (mov === "nova_data") {
    novo = { ...novo, date: dados.data || novo.date, due_date: dados.data || novo.due_date };
    para = novo.date && novo.date < q.today ? "atrasado" : "aberto";
  } else {
    novo = { ...novo, status: "pending", paid_at: null, amount: novo.original_amount ?? novo.amount, original_amount: null };
    para = novo.date && novo.date < q.today ? "atrasado" : "aberto";
  }
  const cols = { ...q.columns };
  const tirar = cols[de];
  cols[de] = { ...tirar, items: tirar.items.filter((c) => c.id !== id), count: Math.max(0, tirar.count - 1), total: arred(tirar.total - cartao.amount) };
  const por = cols[para];
  cols[para] = { ...por, items: [novo, ...por.items.filter((c) => c.id !== id)], count: por.count + 1, total: arred(por.total + novo.amount) };
  return { ...q, columns: cols };
}

export type PedidoDeMovimento = {
  id: string;
  mov: Movimento;
  /** baixa: data do pagamento; nova_data: novo vencimento (AAAA-MM-DD). */
  data?: string;
  forma?: string | null;
  /** baixa: valor pago (juros/desconto) — sem ele o backend usa o valor do lançamento. */
  valorPago?: number | null;
  /** F3: comprovante escolhido na confirmação (sobe depois da baixa). */
  comprovante?: { content: string; filename: string; content_type: string; size: number } | null;
};

/** Corpo do PATCH para cada movimento. */
export function corpoDoMovimento(p: PedidoDeMovimento): Record<string, any> {
  if (p.mov === "baixa") {
    const corpo: Record<string, any> = { status: "confirmed" };
    if (p.data) corpo.paid_at = p.data;
    if (p.forma) corpo.payment_method = p.forma;
    if (p.valorPago && p.valorPago > 0) corpo.paid_amount = p.valorPago;
    return corpo;
  }
  if (p.mov === "nova_data") return { due_date: p.data };
  return { status: "pending" };
}

/**
 * Cartão → formato do modal "Editar lançamento" (o mesmo que a lista usa).
 * employee_id vai sempre (null quando não há): o modal compara com o de
 * antes e, se faltasse, mandaria employee_id: null e apagaria o vínculo.
 */
export function cartaoParaLancamento(c: CartaoQuadro, tipo: TipoQuadro) {
  return {
    id: c.id,
    date: c.date || "",
    desc: c.description,
    type: tipo,
    category: c.category,
    amount: c.amount,
    status: c.status,
    source: "manual",
    due_date: c.due_date || c.date || undefined,
    paid_at: c.paid_at || undefined,
    original_amount: c.original_amount ?? null,
    receipt_filename: c.receipt_filename ?? null,
    payment_method: c.payment_method,
    employee_id: c.employee_id ?? null,
    employee_name: c.employee_name,
    idempotency_key: null,
  };
}

// ── F2 (28/09/2026) ─────────────────────────────────────────

/** Faixa do topo: "Vencem nesta semana: 2 contas · R$ 120,00 (até 04/10)". */
export function textoDaSemana(tipo: TipoQuadro, w: SemanaDoQuadro | undefined, fmt: (n: number) => string): string | null {
  if (!w || !w.count) return null;
  const itens = w.count + (w.count === 1 ? (tipo === "expense" ? " conta" : " lançamento") : (tipo === "expense" ? " contas" : " lançamentos"));
  const ate = w.until ? " (até " + ddmm(w.until) + ")" : "";
  return (tipo === "expense" ? "Vencem nesta semana: " : "A receber nesta semana: ") + itens + " · " + fmt(w.total) + ate;
}

/** Linha do mês: "Juros e multas pagos em setembro: R$ 6,40 (1 conta) · descontos R$ 5,00". */
export function textoDaDiferencaDoMes(tipo: TipoQuadro, d: DiferencaDoMes | undefined, mes: string, fmt: (n: number) => string): string | null {
  if (!d || (!(d.a_mais > 0) && !(d.a_menos > 0))) return null;
  const nomeMes = MESES[Number(mes.slice(5, 7)) - 1] || "";
  const partes: string[] = [];
  if (d.a_mais > 0) {
    const qtd = d.count_a_mais ? " (" + d.count_a_mais + (d.count_a_mais === 1 ? (tipo === "expense" ? " conta" : " recebimento") : (tipo === "expense" ? " contas" : " recebimentos")) + ")" : "";
    partes.push((tipo === "expense" ? "Juros e multas pagos em " : "Recebido a mais em ") + nomeMes + ": " + fmt(d.a_mais) + qtd);
  }
  if (d.a_menos > 0) partes.push((partes.length ? "descontos " : "Descontos em " + nomeMes + ": ") + fmt(d.a_menos));
  return partes.join(" · ");
}

/** Cartões que podem entrar no "Pagar vários": pendentes (atrasado ou aberto) e movable. */
export function podeEntrarNoLote(c: CartaoQuadro, coluna: ColunaQuadro): boolean {
  return c.movable && coluna !== "feito";
}

export type ItemDoLote = { id: string; paid_amount?: number };

/** Corpo do POST /baixa-em-lote: valor pago só vai quando difere do lançamento. */
export function corpoDoLote(p: { itens: { cartao: CartaoQuadro; valorPago: number }[]; data?: string; forma?: string | null }) {
  return {
    items: p.itens.map(({ cartao, valorPago }) =>
      valorPago > 0 && Math.abs(valorPago - cartao.amount) >= 0.005 ? { id: cartao.id, paid_amount: valorPago } : { id: cartao.id }),
    paid_at: p.data || undefined,
    payment_method: p.forma || undefined,
  };
}

function arred(n: number) { return Math.round(n * 100) / 100; }
