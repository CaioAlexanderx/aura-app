export type Transaction = {
  id: string;
  date: string;
  desc: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  status: "confirmed" | "pending";
  source: string;
  due_date?: string;
  created_at?: string;
  paid_at?: string;
  // Sessao 22-23/04: campos novos pra editar/listar
  payment_method?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  idempotency_key?: string | null;
  // MULTICNPJ Onda 2.2: preenchido quando vem do /me/transactions
  // (modo consolidado). Em modo per-company, fica undefined.
  company_id?: string | null;
  company_name?: string | null;
};

export type DreData = {
  period: string;
  income: { category: string; amount: number }[];
  expenses: { category: string; amount: number }[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  marginPct: number;
};

export type WithdrawalData = {
  grossRevenue: number;
  taxes: number;
  fixedCosts: number;
  variableCosts: number;
  operationalProfit: number;
  proLabore: number;
  netProfit: number;
  suggestedWithdrawal: number;
  fatorR: number;
};

// "today" adicionado nesta sessao — primeira opcao pra acompanhamento operacional do dia
export type PeriodKey = "today" | "all" | "week" | "month" | "year" | "prev_year" | "custom";

export var PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Dia" },
  { key: "week", label: "Semanal" },
  { key: "month", label: "Mensal" },
  { key: "year", label: "Anual" },
  { key: "prev_year", label: "Ant." },
  { key: "all", label: "Todos" },
  { key: "custom", label: "Periodo" },
];

// F6 (24/08/2026): 6 abas -> 4.
//
// "Cupons" saiu: e ferramenta de venda (aplicada no Caixa), nao dado
// financeiro — e reimplementava um CRUD que ja existia em /cupons, rota que
// estava orfa na navegacao. Agora vive na secao Vendas do menu.
//
// "Retirada" saiu: e uma calculadora que se abre quando vai fazer a retirada
// do mes, nao um painel que se acompanha. Virou /financeiro/retirada, linkada
// por um card no fim da Visao Geral.
//
// Os indices de retirada/cupons continuam definidos porque `TAB_KEY_TO_INDEX`
// os aceita como alias de deep-link (?tab=retirada, ?tab=cupons) e redireciona
// pras rotas novas. Ficam FORA da faixa de TABS de proposito: qualquer
// `activeTab` com esses valores nao casa com nenhuma aba renderizada, entao um
// redirect que falhe aparece como tela vazia em vez de aba errada silenciosa.
export var TABS = ["Visão Geral", "Receitas", "Despesas", "Lançamentos"];
export var TAB_INDEX = {
  visao: 0,
  receitas: 1,
  despesas: 2,
  lancamentos: 3,
  // fora da faixa de TABS — so servem de alias pros deep-links antigos
  retirada: 90,
  cupons: 91,
} as const;

export var INCOME_CATS = ["Vendas", "Servicos", "Outros", "Investimentos"];
export var EXPENSE_CATS = ["Fornecedores", "Fixas", "Operacional", "Folha", "Impostos", "Marketing", "Outros"];

export function fmt(n: number): string {
  return "R$ " + round2(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtK(n: number): string {
  return n >= 1000 ? "R$ " + (n / 1000).toFixed(1).replace(".", ",") + "k" : fmt(n);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// FIX 06/05/2026 (timezone): Postgres DATE serializa como 'YYYY-MM-DD' e
// new Date('2026-05-06') interpreta como UTC midnight, que em America/Sao_Paulo
// (UTC-3) recua pro dia anterior — lancamentos apareciam no dia errado nos
// graficos client-side (tendencia diaria, byDay buckets, etc).
//
// Estrategia: detectar strings date-only (sem hora/offset) e construir Date
// em timezone local explicitamente via Date(y, m, d). Strings com offset (Z,
// +HH:MM) ja sao parseadas corretamente pelo construtor padrao — apenas
// repassa.
//
// Backend ja usa AT TIME ZONE 'America/Sao_Paulo' nas queries, entao a
// agregacao server-side (summary, dashboard, insights) ja vinha certa. Esta
// funcao corrige o ultimo elo (parsing client-side de date-only strings).
// 03/08/2026 — o regex ancorado abaixo era o furo: ele so casava com
// "2026-08-03", e o backend NAO manda nesse formato.
//
// `transactions.due_date` e coluna `date`. O pool do pg
// (Aura-backend/src/config/database.js) sobrescreve o type parser de NUMERIC
// mas nao o de DATE (oid 1082), entao o driver devolve um objeto Date na
// meia-noite do fuso do processo -- e o backend nao define TZ, herdando UTC
// do container. O JSON sai como "2026-08-03T00:00:00.000Z".
//
// Essa forma nao casava com o regex, caia no `new Date(s)` do final e virava
// meia-noite UTC = 21:00 do dia ANTERIOR em horario do Brasil. Vencimento
// aparecia um dia antes -- mesmo bug que o carne do crediario tinha (#659).
//
// Aceita agora as duas formas. Timestamp com hora REAL continua indo pro
// construtor padrao: o casamento exige meia-noite exata, e timestamps nascem
// de now() com microssegundos, entao nao caem aqui por acidente.
export function parseDateLocal(s: string | null | undefined): Date {
  if (!s) return new Date(NaN);
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(String(s));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Timestamp com hora de verdade: construtor padrao acerta.
  return new Date(s);
}

export function getPeriodRange(key: PeriodKey, customStart?: string, customEnd?: string): { start: Date; end: Date; label: string } {
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  switch (key) {
    case "today": {
      var startD = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      var dayLabel = "Hoje, " + now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
      return { start: startD, end: today, label: dayLabel };
    }
    case "all": return { start: new Date(1970, 0, 1), end: new Date(2100, 0, 1), label: "Todos os lancamentos" };
    case "week": {
      var start = new Date(today); start.setDate(today.getDate() - 6); start.setHours(0, 0, 0, 0);
      return { start: start, end: today, label: "Ultimos 7 dias" };
    }
    case "month": {
      // FIX 04/05/2026: end = ultimo dia do mes (era today). Alinha com janela
      // do dashboard.js no backend: WHERE due_date < (date_trunc('month', NOW())
      // + INTERVAL '1 month')::date. Antes, despesas confirmed com due_date no
      // futuro do mes (ex.: recorrente com i=0 confirmed em 5/maio quando hoje
      // eh 4/maio) apareciam no Painel mas nao no Financeiro — divergencia
      // confusa pro usuario. Cliente Eryca reportou.
      var startM = new Date(now.getFullYear(), now.getMonth(), 1);
      var endM = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      var monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      return { start: startM, end: endM, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) };
    }
    case "year": return { start: new Date(now.getFullYear(), 0, 1), end: today, label: String(now.getFullYear()) };
    case "prev_year": { var y = now.getFullYear() - 1; return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59), label: String(y) }; }
    case "custom": {
      if (customStart && customEnd) {
        var s = new Date(customStart + "T00:00:00"); var e = new Date(customEnd + "T23:59:59");
        var sl = s.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        var el = e.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        return { start: s, end: e, label: sl + " a " + el };
      }
      return getPeriodRange("month");
    }
  }
}

// F-10: calcula o periodo anterior equivalente pra comparacao
export function getPreviousPeriodRange(key: PeriodKey, customStart?: string, customEnd?: string): { start: Date; end: Date } | null {
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  switch (key) {
    case "today": {
      var yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      var yestEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      return { start: yest, end: yestEnd };
    }
    case "all": return null;
    case "week": {
      var end = new Date(today); end.setDate(today.getDate() - 7);
      var start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0, 0, 0, 0);
      return { start: start, end: end };
    }
    case "month": {
      var pm = now.getMonth() - 1; var py = now.getFullYear();
      if (pm < 0) { pm = 11; py--; }
      return { start: new Date(py, pm, 1), end: new Date(py, pm + 1, 0, 23, 59, 59) };
    }
    case "year": {
      var prevY = now.getFullYear() - 1;
      return { start: new Date(prevY, 0, 1), end: new Date(prevY, 11, 31, 23, 59, 59) };
    }
    case "prev_year": return null;
    case "custom": {
      if (customStart && customEnd) {
        var s = new Date(customStart + "T00:00:00"); var e = new Date(customEnd + "T23:59:59");
        var diff = e.getTime() - s.getTime();
        var prevEnd = new Date(s.getTime() - 86400000); prevEnd.setHours(23, 59, 59);
        var prevStart = new Date(prevEnd.getTime() - diff); prevStart.setHours(0, 0, 0, 0);
        return { start: prevStart, end: prevEnd };
      }
      return null;
    }
  }
}

export function filterByPeriod(txs: Transaction[], key: PeriodKey): Transaction[] {
  if (key === "all") return txs;
  var range = getPeriodRange(key);
  return txs.filter(function(t) {
    var raw = (t as any).due_date || (t as any).created_at || t.date;
    if (!raw) return false;
    var d = parseDateLocal(raw);
    if (isNaN(d.getTime())) return false;
    return d >= range.start && d <= range.end;
  });
}
