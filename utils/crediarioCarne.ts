// ============================================================
// AURA. — Crediário · carnês por compra (10/10/2026)
//
// Regras puras da nova ficha de carnês: formato de impressão (A4 ou bobina),
// derivação do cartão de cada carnê e plano de seleção do "Juntar carnês".
//
// Mora fora dos componentes pelo mesmo motivo de utils/crediarioRecebimento:
// a ficha arrasta react-native-svg pelo Icon/Toast e o jest do repo não
// carrega isso — a regra precisa ser testável sozinha.
//
// Contrato do backend: Aura-backend#802 (impressão) e #803 (carnês por
// compra + juntar). TODO campo novo é opcional: o app tem que funcionar
// igual contra o backend anterior a esses PRs.
// ============================================================

// ─── Impressão: formato e escopo ─────────────────────────────────────────

export type FormatoCarne = "a4" | "bobina";

/** Bobina é o padrão de propósito: quem já imprime hoje imprime em bobina, e
 *  a escolha nova não pode mudar o papel de ninguém sem a pessoa pedir. */
export const FORMATO_PADRAO: FormatoCarne = "bobina";

const CHAVE_FORMATO = "aura.crediario.carne.formato";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storagePadrao(): StorageLike | null {
  // try/catch: em aba anônima do Safari e com cookies bloqueados o simples
  // acesso a window.localStorage lança.
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Último formato escolhido NESTE aparelho; bobina se nunca escolheu. */
export function lerFormatoCarne(storage: StorageLike | null = storagePadrao()): FormatoCarne {
  try {
    const v = storage?.getItem(CHAVE_FORMATO);
    return v === "a4" || v === "bobina" ? v : FORMATO_PADRAO;
  } catch {
    return FORMATO_PADRAO;
  }
}

export function salvarFormatoCarne(formato: FormatoCarne, storage: StorageLike | null = storagePadrao()): void {
  try { storage?.setItem(CHAVE_FORMATO, formato); } catch { /* sem storage: só não lembra */ }
}

/**
 * Qual carnê imprimir:
 *   string    → aquele carnê (`account=<uuid>`)
 *   null      → o grupo sem carnê, "Compras anteriores" (`account=none`)
 *   undefined → todos os carnês do cliente (sem `account`) — o de sempre
 */
export type EscopoCarne = string | null | undefined;

export type OpcoesDeImpressao = { format?: FormatoCarne; accountId?: EscopoCarne };

/**
 * Caminho (sem o BASE_URL) do carnê para impressão.
 * Bobina não manda `format`: é o padrão do backend novo e a única coisa que
 * o backend antigo sabe fazer — a URL fica idêntica à de antes.
 */
export function carnePrintPath(companyId: string, customerId: string, opts: OpcoesDeImpressao = {}): string {
  const qs: string[] = [];
  if (opts.format === "a4") qs.push("format=a4");
  if (opts.accountId === null) qs.push("account=none");
  else if (typeof opts.accountId === "string" && opts.accountId) qs.push("account=" + encodeURIComponent(opts.accountId));
  const path = "/companies/" + companyId + "/print/credit/" + customerId + "/carne";
  return qs.length ? path + "?" + qs.join("&") : path;
}

// ─── Cartão do carnê: derivação ──────────────────────────────────────────
// Tipos estruturais (e não os de services/creditApi) para este arquivo não
// depender do cliente HTTP: creditApi importa daqui, não o contrário.

export type CompraDoCarne = {
  date?: string | null;
  description?: string | null;
  quantity?: number | null;
  amount?: number | null;
  manual?: boolean;
};

export type ParcelaPagaDoCarne = {
  id: string;
  installment_number: number;
  total_installments: number;
  due_date?: string | null;
  paid_at?: string | null;
  amount: number;
};

/** O que o cartão lê de um item de accounts[] da ficha. Só id, name e
 *  balance são garantidos (backend anterior ao #803); o resto é opcional. */
export type ContaDoCarne = {
  id: string | null;
  name: string;
  balance: number;
  overdue?: boolean;
  next_due_date?: string | null;
  purchases?: CompraDoCarne[];
  purchases_total?: number;
  total_amount?: number;
  refunded_total?: number;
  total_count?: number;
  paid_count?: number;
  paid_installments?: ParcelaPagaDoCarne[];
  open_remaining?: number;
  unscheduled?: number;
  remaining?: number;
  created_at?: string | null;
  merged_from?: Array<{ id: string; name: string }>;
};

/** O que o cartão lê de uma parcela em aberto. */
export type ParcelaAbertaDoCarne = {
  id: string;
  account_id?: string | null;
  due_date: string;
  amount_due: number;
  covered_amount?: number;
  remaining?: number;
  is_overdue?: boolean;
};

export type LinhaDeCompra = { rotulo: string; valor: number };

export type CarneDerivado<P extends ParcelaAbertaDoCarne = ParcelaAbertaDoCarne> = {
  /** Chave de lista e de seleção: o id do carnê, ou "general" para o grupo sem carnê. */
  key: string;
  id: string | null;
  nome: string;
  /** Grupo sem carnê ("Compras anteriores"). */
  semCarne: boolean;
  /** O backend mandou os campos de carnê por compra (#803)? */
  temCamposNovos: boolean;
  /** Quanto falta pagar: remaining; sem ele, balance. */
  falta: number;
  quitado: boolean;
  /** Carnê sem nada lançado (criado à mão e ainda vazio). */
  vazio: boolean;
  atrasado: boolean;
  /** Tem saldo e nenhuma parcela: venda 1x / fiado. */
  semParcelas: boolean;
  /** Itens numa linha, para o cartão fechado. */
  itensResumo: string;
  /** Itens (carnê) ou compras (grupo sem carnê), para o cartão aberto. */
  compras: LinhaDeCompra[];
  comprasTotal: number | null;
  devolvido: number;
  /** Valor original do carnê, para a linha de quitado. */
  valorOriginal: number | null;
  pagas: number | null;
  total: number | null;
  /** 0..1; null = sem barra (sem parcelas ou backend antigo). */
  progresso: number | null;
  /** "2 de 4 pagas · próx. 10/11" */
  resumo: string;
  parcelasPagas: ParcelaPagaDoCarne[];
  parcelasAbertas: P[];
  /** Soma do principal em aberto das parcelas (base do Renegociar). */
  somaParcelas: number;
  juntadoDe: string[];
};

export const NOME_SEM_CARNE = "Compras anteriores";
/** Como o grupo sem carnê vai em account_ids do juntar e na URL do preview. */
export const CHAVE_SEM_CARNE = "general";

const CENTAVO = 0.009;
const DATA_PURA = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/;

/** DD/MM. Data pura é dia de calendário (sem conversão de fuso — ver o D-1
 *  do carnê em ficha/fichaHelpers); timestamp vai para o fuso de São Paulo. */
export function diaMes(iso?: string | null): string {
  if (!iso) return "";
  const cal = String(iso).match(DATA_PURA);
  if (cal) return `${cal[3]}/${cal[2]}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

function restante(p: ParcelaAbertaDoCarne): number {
  return p.remaining ?? ((Number(p.amount_due) || 0) - (Number(p.covered_amount) || 0));
}

function rotuloDoItem(c: CompraDoCarne): string {
  const desc = String(c.description || "").trim() || (c.manual ? "Lançamento manual" : "Compra");
  const q = Number(c.quantity) || 0;
  return q > 1 ? `${q}× ${desc}` : desc;
}

/** Itens do carnê: uma linha por item. */
function linhasPorItem(compras: CompraDoCarne[]): LinhaDeCompra[] {
  return compras.map(c => ({ rotulo: rotuloDoItem(c), valor: Number(c.amount) || 0 }));
}

/** Grupo sem carnê: uma linha por COMPRA (itens da mesma venda chegam com a
 *  mesma data/hora), "13/09 · item, item". Sem data, cada item é uma linha. */
function linhasPorCompra(compras: CompraDoCarne[]): LinhaDeCompra[] {
  const grupos: Array<{ date: string | null; itens: string[]; valor: number }> = [];
  for (const c of compras) {
    const date = c.date ? String(c.date) : null;
    const g = date ? grupos.find(x => x.date === date) : undefined;
    if (g) { g.itens.push(rotuloDoItem(c)); g.valor += Number(c.amount) || 0; }
    else grupos.push({ date, itens: [rotuloDoItem(c)], valor: Number(c.amount) || 0 });
  }
  return grupos.map(g => ({
    rotulo: (g.date && diaMes(g.date) ? diaMes(g.date) + " · " : "") + g.itens.join(", "),
    valor: +g.valor.toFixed(2),
  }));
}

/** A regra de atraso da parcela vem de fora (utils/creditOverdue) para este
 *  arquivo não fixar "hoje" — e para o teste injetar a sua. */
export type RegraDeAtraso<P> = (p: P) => boolean;

/**
 * Tudo o que o cartão de um carnê mostra, a partir do item de accounts[]
 * e das parcelas em aberto dele.
 *
 * Backend antigo (sem os campos do #803): "falta" cai no balance, não há
 * barra de progresso nem itens — o cartão mostra o que a ficha já mostrava
 * (nome, saldo, parcelas).
 */
export function derivarCarne<P extends ParcelaAbertaDoCarne>(
  acc: ContaDoCarne,
  parcelas: P[],
  emAtraso: RegraDeAtraso<P> = (p) => p.is_overdue === true,
): CarneDerivado<P> {
  const semCarne = acc.id == null;
  const abertas = parcelas.slice().sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  const temCamposNovos = acc.remaining !== undefined || acc.total_count !== undefined || acc.purchases !== undefined;

  const falta = +(Number(acc.remaining ?? acc.balance) || 0).toFixed(2);
  const total = typeof acc.total_count === "number" ? acc.total_count : null;
  const pagas = typeof acc.paid_count === "number" ? acc.paid_count : null;
  const compras = acc.purchases || [];
  const linhas = semCarne ? linhasPorCompra(compras) : linhasPorItem(compras);
  const somaLinhas = +linhas.reduce((s, l) => s + l.valor, 0).toFixed(2);
  const valorOriginal = acc.total_amount ?? acc.purchases_total ?? (linhas.length ? somaLinhas : null);

  const temAlgo = abertas.length > 0 || (total ?? 0) > 0 || (pagas ?? 0) > 0
    || linhas.length > 0 || (Number(valorOriginal) || 0) > CENTAVO;
  const semSaldo = falta <= CENTAVO;
  // Quitado = não falta nada. Com parcela ainda aberta o carnê NÃO some para
  // "Quitados" (saldo zerado com parcela viva é divergência a conferir, não
  // carnê pago), e sem os campos novos não dá para distinguir pago de vazio.
  const quitado = semSaldo && abertas.length === 0 && temCamposNovos && temAlgo;
  const vazio = semSaldo && abertas.length === 0 && !quitado;
  const semParcelas = !semSaldo && abertas.length === 0;
  const atrasado = !quitado && (acc.overdue === true || abertas.some(emAtraso));
  const temContagem = !!total && total > 0 && pagas != null;

  const proxima = abertas[0];
  const proxData = proxima?.due_date || acc.next_due_date || null;
  const quando = proxData && diaMes(proxData)
    ? (proxima && emAtraso(proxima) ? "venceu " : "próx. ") + diaMes(proxData)
    : "";
  let resumo: string;
  if (vazio) resumo = "Sem lançamentos";
  else if (semParcelas && !temContagem) resumo = "sem parcelas — à vista no crediário";
  else if (temContagem) {
    resumo = `${pagas} de ${total} paga${total === 1 ? "" : "s"}` + (quando ? " · " + quando : "");
  } else {
    // Backend antigo: o que a ficha já dizia.
    const n = abertas.length;
    resumo = [n > 0 ? `${n} parcela${n === 1 ? "" : "s"} em aberto` : "", quando].filter(Boolean).join(" · ");
  }

  const nGrupos = linhas.length;
  const itensResumo = semCarne
    ? (nGrupos > 0 ? `${nGrupos} compra${nGrupos === 1 ? "" : "s"} de antes dos carnês por compra` : "")
    : linhas.map(l => l.rotulo).join(" · ");

  return {
    key: acc.id ?? CHAVE_SEM_CARNE,
    id: acc.id ?? null,
    nome: semCarne ? NOME_SEM_CARNE : acc.name,
    semCarne,
    temCamposNovos,
    falta,
    quitado,
    vazio,
    atrasado,
    semParcelas,
    itensResumo,
    compras: linhas,
    comprasTotal: linhas.length ? +(Number(acc.purchases_total ?? acc.total_amount ?? somaLinhas) || 0).toFixed(2) : null,
    devolvido: +(Number(acc.refunded_total) || 0).toFixed(2),
    valorOriginal: valorOriginal == null ? null : +(Number(valorOriginal) || 0).toFixed(2),
    pagas,
    total,
    progresso: temContagem ? Math.max(0, Math.min(1, (pagas as number) / (total as number))) : null,
    resumo,
    parcelasPagas: (acc.paid_installments || []).slice()
      .sort((a, b) => a.installment_number - b.installment_number),
    parcelasAbertas: abertas,
    somaParcelas: +abertas.reduce((s, p) => s + restante(p), 0).toFixed(2),
    juntadoDe: (acc.merged_from || []).map(x => x.name).filter(Boolean),
  };
}

/**
 * Separa os carnês da ficha em "em aberto" e "quitados".
 *
 * Parcela aberta sem carnê na lista (account_id nulo, ou apontando para um
 * carnê que o backend não mandou) nunca some: vai para o cartão "Compras
 * anteriores", criado aqui se accounts[] não trouxer o grupo de id nulo.
 */
export function organizarCarnes<P extends ParcelaAbertaDoCarne>(
  accounts: ContaDoCarne[],
  openInst: P[],
  emAtraso?: RegraDeAtraso<P>,
): { abertos: CarneDerivado<P>[]; quitados: CarneDerivado<P>[] } {
  const ids = new Set(accounts.filter(a => a.id != null).map(a => a.id as string));
  const porConta = new Map<string | null, P[]>();
  for (const p of openInst) {
    const k = p.account_id != null && ids.has(p.account_id) ? p.account_id : null;
    if (!porConta.has(k)) porConta.set(k, []);
    porConta.get(k)!.push(p);
  }
  const lista = accounts.slice();
  const orfas = porConta.get(null) || [];
  if (orfas.length > 0 && !lista.some(a => a.id == null)) {
    lista.push({ id: null, name: NOME_SEM_CARNE, balance: +orfas.reduce((s, p) => s + restante(p), 0).toFixed(2) });
  }
  const todos = lista.map(a => derivarCarne(a, porConta.get(a.id ?? null) || [], emAtraso));
  // "Compras anteriores" por último; o resto na ordem do backend.
  // O grupo sem carnê só aparece se tiver o que mostrar (a "conta geral" do
  // backend antigo vem sempre, mesmo zerada).
  const ordenados = [...todos.filter(c => !c.semCarne), ...todos.filter(c => c.semCarne && !c.vazio)];
  return {
    abertos: ordenados.filter(c => !c.quitado),
    quitados: ordenados.filter(c => c.quitado),
  };
}
