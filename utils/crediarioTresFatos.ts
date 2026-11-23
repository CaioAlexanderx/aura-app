// ============================================================
// Os três fatos do alto da ficha do crediário (F4, 23/11/2026)
//
// Mockup aprovado pelo Caio (seção a, "Depois"): no lugar de EM ABERTO,
// SCORE e DISPONÍVEL, três fatos em frase inteira —
//  1. "Falta pagar R$ X" (ou "Tem crédito de R$ X na loja");
//  2. "O que vem agora": atrasado (quanto, quantas, desde quando) ou a
//     próxima parcela; substitui os selos Em dia / Em atraso;
//  3. "Pode comprar mais R$ X · limite de R$ Y" / "Sem limite definido" /
//     "Passou R$ X do limite", com a frase do score ("às vezes atrasa").
// A nota do score sai do topo: fica só em "Limite e regras" (decisão 2).
//
// Puro (sem React, sem API): testado em __tests__/crediarioTresFatos.test.ts.
// ============================================================
import { dataDoVencimento, diaEmSaoPaulo } from "@/utils/crediarioMovimentacao";

type Fmt = (n: number) => string;

/** Parcela aberta como a ficha recebe (só o que os fatos usam). */
export type ParcelaDosFatos = {
  due_date: string;
  is_overdue?: boolean;
  charges_total?: number;
  remaining?: number;
  amount_due?: number;
  covered_amount?: number;
  total_due?: number;
  days_late?: number;
  days_charged?: number;
};

/** Principal em aberto da parcela. */
export function restanteDaParcela(p: ParcelaDosFatos): number {
  return Number(p.remaining ?? (Number(p.amount_due || 0) - Number(p.covered_amount || 0))) || 0;
}

/**
 * O que hoje se paga por ela. Multa e juros só quando ela está em atraso
 * (mesma regra da linha da parcela: encargos só com is_overdue). `atrasada`
 * vem da regra única (isInstallmentOverdue) de quem chama.
 */
export function valorDeHoje(p: ParcelaDosFatos, atrasada: boolean = p.is_overdue === true): number {
  const rem = restanteDaParcela(p);
  if (!atrasada) return rem;
  const enc = Number(p.charges_total ?? 0);
  return Number(p.total_due ?? (rem + enc)) || 0;
}

/**
 * Score em frase. As frases descrevem o pagamento, não a pessoa (a tela
 * pode estar virada para a cliente no balcão). Sem nota conhecida: null.
 */
export function fraseDoScore(label: string | null | undefined): string | null {
  switch (label) {
    case "premium": return "Paga sempre em dia";
    case "bom": return "Paga em dia";
    case "regular": return "Às vezes atrasa";
    case "restrito":
    case "bloqueado": return "Atrasa bastante";
    default: return null;
  }
}

const minuscula = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Dias inteiros entre duas datas YYYY-MM-DD (b − a). */
function diasEntre(a: string, b: string): number {
  const ta = Date.parse(a + "T00:00:00Z");
  const tb = Date.parse(b + "T00:00:00Z");
  if (isNaN(ta) || isNaN(tb)) return 0;
  return Math.round((tb - ta) / 86_400_000);
}

export type Fato = {
  titulo: string;
  valor: string;
  detalhe: string;
};

// ── 1. Falta pagar ──────────────────────────────────────────────────────
export function fatoFaltaPagar(p: { saldo: number; comprasEmAberto: number; fmt: Fmt }): Fato & { tom: "deve" | "credito" | "zerado" } {
  if (p.saldo < -0.009) {
    return { titulo: "Tem crédito na loja", valor: p.fmt(Math.abs(p.saldo)), detalhe: "para usar numa próxima compra", tom: "credito" };
  }
  if (p.saldo <= 0.009) {
    return { titulo: "Falta pagar", valor: p.fmt(0), detalhe: "nada em aberto", tom: "zerado" };
  }
  return {
    titulo: "Falta pagar",
    valor: p.fmt(p.saldo),
    detalhe: p.comprasEmAberto > 0 ? `${plural(p.comprasEmAberto, "compra", "compras")} em aberto` : "em aberto",
    tom: "deve",
  };
}

// ── 2. O que vem agora ──────────────────────────────────────────────────
export function fatoOQueVemAgora(p: {
  /** Parcelas em atraso (pela regra única: isInstallmentOverdue). */
  atrasadas: ParcelaDosFatos[];
  /** A próxima a vencer (não atrasada, não "a conferir"), se houver. */
  proxima: ParcelaDosFatos | null;
  /** Parcelas vencidas antes de o carnê ser cadastrado (needsReview). */
  aConferir?: number;
  saldo: number;
  /** Hoje em São Paulo, YYYY-MM-DD. */
  hoje: string;
  fmt: Fmt;
}): Fato & { atrasado: boolean } {
  if (p.atrasadas.length > 0) {
    const ordem = p.atrasadas.slice().sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    const antiga = ordem[0];
    const dia = diaEmSaoPaulo(antiga.due_date);
    const dias = antiga.days_late ?? antiga.days_charged ?? Math.max(0, diasEntre(dia, p.hoje));
    const venceu = dataDoVencimento(antiga.due_date, p.hoje);
    const ha = dias > 0 ? `, há ${plural(dias, "dia", "dias")}` : "";
    const n = ordem.length;
    const total = ordem.reduce((s, i) => s + valorDeHoje(i, true), 0);
    // Com encargos o "Atrasado" fica maior que a soma das parcelas: a frase
    // diz quanto é multa e juros, para não parecer conta errada.
    const encargos = +(total - ordem.reduce((s, i) => s + restanteDaParcela(i), 0)).toFixed(2);
    const comEncargos = encargos > 0.009 ? `com ${p.fmt(encargos)} de multa e juros · ` : "";
    return {
      titulo: "Atrasado",
      valor: p.fmt(total),
      detalhe: comEncargos + (n === 1
        ? `1 parcela · venceu ${venceu}${ha}`
        : `${n} parcelas · a mais antiga venceu ${venceu}${ha}`),
      atrasado: true,
    };
  }
  if (p.proxima) {
    const dia = diaEmSaoPaulo(p.proxima.due_date);
    return {
      titulo: "Próxima parcela",
      valor: p.fmt(valorDeHoje(p.proxima, false)),
      // Vencida dentro da carência não está "em atraso", mas também não
      // "vence" numa data que já passou.
      detalhe: dia === p.hoje ? "vence hoje"
        : dia && dia < p.hoje ? `venceu ${dataDoVencimento(p.proxima.due_date, p.hoje)}`
        : `vence ${dataDoVencimento(p.proxima.due_date, p.hoje)}`,
      atrasado: false,
    };
  }
  if ((p.aConferir ?? 0) > 0) {
    return { titulo: "O que vem agora", valor: "Parcelas a conferir", detalhe: "veja o aviso abaixo", atrasado: false };
  }
  if (p.saldo > 0.009) {
    return {
      titulo: "Próxima parcela",
      valor: "Sem data marcada",
      detalhe: "compras sem carnê: receba quando vier o pagamento",
      atrasado: false,
    };
  }
  return { titulo: "O que vem agora", valor: "Nada a vencer", detalhe: "nenhuma parcela em aberto", atrasado: false };
}

// ── 3. Pode comprar mais ────────────────────────────────────────────────
export function fatoPodeComprarMais(p: {
  limite: number | null | undefined;
  usado: number | null | undefined;
  /** available_limit do backend; sem ele, limite − usado. */
  disponivel?: number | null;
  scoreLabel?: string | null;
  fmt: Fmt;
}): Fato & { tom: "ok" | "passou" | "sem" } {
  const frase = fraseDoScore(p.scoreLabel);
  const limite = Number(p.limite) || 0;
  // Limite 0 é "sem limite" no backend (ledger: limit > 0 && ...).
  if (limite <= 0) {
    return { titulo: "Limite", valor: "Sem limite definido", detalhe: frase ?? "", tom: "sem" };
  }
  const usado = Number(p.usado) || 0;
  const passou = +(usado - limite).toFixed(2);
  const sufixo = frase ? ` · ${minuscula(frase)}` : "";
  if (passou > 0.009) {
    return { titulo: "Passou do limite", valor: p.fmt(passou), detalhe: `limite de ${p.fmt(limite)}${sufixo}`, tom: "passou" };
  }
  const disp = p.disponivel != null && isFinite(Number(p.disponivel)) ? Number(p.disponivel) : limite - usado;
  return { titulo: "Pode comprar mais", valor: p.fmt(Math.max(0, disp)), detalhe: `limite de ${p.fmt(limite)}${sufixo}`, tom: "ok" };
}

/** Datas das parcelas pagas para a linha "2 pagas · 01/09 e 05/10". */
export function datasDasPagas(dias: string[]): string {
  // QA 23/11 (P2): duas pagas no mesmo dia viravam "23/11 e 23/11".
  const ds = dias.filter(Boolean).filter((d, i, todos) => todos.indexOf(d) === i);
  if (ds.length === 0) return "";
  if (ds.length === 1) return ds[0];
  if (ds.length <= 3) return `${ds.slice(0, -1).join(", ")} e ${ds[ds.length - 1]}`;
  return `a última em ${ds[ds.length - 1]}`;
}
