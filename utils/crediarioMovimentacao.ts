// ============================================================================
// Movimentações da ficha do crediário (F1 do redesenho, 23/11/2026).
//
// O antigo "Histórico · Linha do tempo" falava a língua do razão: "Pagamento ·
// pix", "Compra" em vermelho com "+", "Débito manual", e o print da cliente —
// um Pix de R$ 205,34 que quitou a parcela 1 e deixou 1 centavo na 2 — saía
// como "Parcela 1/3 · vence 20/11/26 · quitada" e "Parcela 2/3 · parcial
// R$ 0,01", sem dizer que o centavo era sobra nem quanto ainda faltava.
//
// Aqui fica o que a tela diz, sem React (testável no Jest sozinho):
//   · tituloDoEvento — verbo no lugar do tipo ("Pagou no Pix", "Comprou");
//   · valorComSinal — sinal do ponto de vista da dívida: "−" diminui, "+"
//     aumenta (comprar não é erro: a tela pinta o "+" em cor neutra);
//   · agruparPorMes / diaDoEvento — mês como cabeçalho, dia curto na linha;
//   · paraOndeFoiODinheiro — por carnê, cada parcela "paga inteira", "abateu
//     R$ X" ou "sobra do pagamento", com "vence dd/mm · hoje faltam R$ Y"
//     tirado das parcelas abertas que a ficha já carrega.
//
// "Hoje faltam" é o saldo de HOJE da parcela, não o do dia do pagamento: o
// texto diz "hoje" de propósito. Parcela que não está mais entre as abertas
// (quitada depois, renegociada, cancelada na devolução) diz "já não está em
// aberto" — a ficha não sabe qual dos três foi, e "já foi paga" mentiria nos
// outros dois.
// ============================================================================

export type AlocacaoDaMovimentacao = {
  installment_id: string;
  number: number | null;
  total_installments: number | null;
  due_date: string | null;
  account_id: string | null;
  account_name: string | null;
  from_sale?: boolean;
  principal_paid: number;
  charges_paid: number;
  status_after: string | null;
};

export type EventoDaMovimentacao = {
  type: string;
  occurred_at: string;
  amount: number;
  payment?: { method: string | null; allocations?: AlocacaoDaMovimentacao[] } | null;
};

/** O que a ficha sabe de uma parcela ainda aberta. */
export type ParcelaAbertaDaFicha = {
  id: string;
  due_date: string;
  amount_due?: number;
  covered_amount?: number;
  remaining?: number;
  /** Principal restante + multa e juros (quando o backend calcula). */
  total_due?: number;
};

export type TipoDaLinha = "inteira" | "abateu" | "sobra";

export type LinhaDoDinheiro = {
  id: string;
  tipo: TipoDaLinha;
  /** "Parcela 1 de 3 · paga inteira" */
  rotulo: string;
  /** "vence 20/12 · hoje faltam R$ 205,32" (vazio na paga inteira). */
  detalhe: string;
  /** Quanto ESTE pagamento pôs na parcela (principal + encargos). */
  valor: number;
};

export type GrupoDoDinheiro = {
  chave: string;
  /** "Compra de 19/10" (nome do carnê) ou "Compras sem carnê". */
  nome: string;
  linhas: LinhaDoDinheiro[];
};

/** Nome do grupo sem carnê — o mesmo de utils/crediarioCarne. */
export const NOME_SEM_CARNE_MOV = "Compras sem carnê";

/** Até quanto o resto que caiu na parcela seguinte é "sobra" (centavos). */
export const LIMITE_DA_SOBRA = 1;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const DATA_PURA = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/;

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function brl(n: number): string {
  return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** AAAA-MM-DD do instante no fuso de São Paulo ("" se inválido). */
export function diaEmSaoPaulo(iso: string | null | undefined): string {
  if (!iso) return "";
  const cal = String(iso).match(DATA_PURA);
  if (cal) return `${cal[1]}-${cal[2]}-${cal[3]}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** "Novembro de 2026" */
export function mesDoEvento(iso: string | null | undefined): string {
  const dia = diaEmSaoPaulo(iso);
  if (!dia) return "";
  const [a, m] = dia.split("-");
  const nome = MESES[Number(m) - 1] || "";
  return nome ? `${nome[0].toUpperCase()}${nome.slice(1)} de ${a}` : "";
}

/** "20 nov" */
export function diaDoEvento(iso: string | null | undefined): string {
  const dia = diaEmSaoPaulo(iso);
  if (!dia) return "";
  const [, m, d] = dia.split("-");
  return `${d} ${MESES_CURTOS[Number(m) - 1] || ""}`.trim();
}

/** "20/12" de uma data pura (vencimento é dia de calendário, sem fuso). */
function diaMesDaData(value: string | null | undefined): string {
  const dia = diaEmSaoPaulo(value);
  if (!dia) return "";
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

/** Mesma ordem que chegou (mais recentes primeiro), com o mês como cabeçalho. */
export function agruparPorMes<E extends { occurred_at: string }>(eventos: E[]): Array<{ mes: string; eventos: E[] }> {
  const grupos: Array<{ mes: string; eventos: E[] }> = [];
  for (const ev of eventos || []) {
    const mes = mesDoEvento(ev.occurred_at) || "Sem data";
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.mes === mes) ultimo.eventos.push(ev);
    else grupos.push({ mes, eventos: [ev] });
  }
  return grupos;
}

/** "Pagou no Pix" / "Pagou em dinheiro" / "Pagou no cartão". */
export function verboDoPagamento(method: string | null | undefined): string {
  const m = String(method || "").trim().toLowerCase();
  if (!m) return "Pagou";
  if (m === "pix") return "Pagou no Pix";
  if (m === "dinheiro" || m === "cash") return "Pagou em dinheiro";
  if (m.includes("cart") || m === "credito" || m === "crédito" || m === "debito" || m === "débito"
    || m === "credit" || m === "debit" || m === "card") return "Pagou no cartão";
  if (m.includes("transf") || m === "ted" || m === "doc") return "Pagou por transferência";
  if (m === "boleto") return "Pagou no boleto";
  if (m === "cheque") return "Pagou em cheque";
  return "Pagou";
}

/** Verbo no lugar do tipo do razão. */
export function tituloDoEvento(ev: Pick<EventoDaMovimentacao, "type" | "payment">): string {
  switch (ev?.type) {
    case "payment": return verboDoPagamento(ev.payment?.method);
    case "purchase": return "Comprou";
    case "manual_debit": return "Valor lançado à mão pela loja";
    case "refund": return "Devolveu itens";
    case "exchange_credit": return "Ganhou crédito de troca";
    case "credit_use": return "Usou crédito na compra";
    default: return "Movimentação";
  }
}

/** O evento diminui o que a cliente deve? (convenção do razão: < 0 diminui). */
export function diminuiADivida(amount: number): boolean {
  return (Number(amount) || 0) < 0;
}

/** "− R$ 205,34" (diminui) / "+ R$ 616,00" (aumenta). O "−" é o sinal de menos. */
export function valorComSinal(amount: number): string {
  const v = Math.abs(Number(amount) || 0);
  return `${diminuiADivida(amount) ? "−" : "+"} ${brl(v)}`;
}

function quantoFaltaHoje(p: ParcelaAbertaDaFicha): number {
  if (p.total_due != null && Number.isFinite(Number(p.total_due))) return round2(Number(p.total_due));
  if (p.remaining != null && Number.isFinite(Number(p.remaining))) return round2(Number(p.remaining));
  return round2((Number(p.amount_due) || 0) - (Number(p.covered_amount) || 0));
}

function nomeDaParcela(a: AlocacaoDaMovimentacao): string {
  if (a.number == null) return "Parcela";
  return a.total_installments ? `Parcela ${a.number} de ${a.total_installments}` : `Parcela ${a.number}`;
}

/**
 * Para onde foi o dinheiro de um pagamento, por carnê, na ordem que chegou.
 *
 * @param abertas parcelas abertas da ficha (para o "hoje faltam").
 * @param hoje    AAAA-MM-DD de hoje em São Paulo (decide "vence" x "venceu").
 */
export function paraOndeFoiODinheiro(
  alocacoes: AlocacaoDaMovimentacao[] | null | undefined,
  abertas: ParcelaAbertaDaFicha[] | null | undefined,
  hoje: string,
): GrupoDoDinheiro[] {
  const lista = alocacoes || [];
  if (lista.length === 0) return [];
  const porId = new Map<string, ParcelaAbertaDaFicha>();
  for (const p of abertas || []) if (p && p.id) porId.set(p.id, p);
  // Sobra só faz sentido quando o mesmo pagamento quitou outra parcela antes.
  const quitouAlguma = lista.some(a => a.status_after === "paid");

  const grupos: GrupoDoDinheiro[] = [];
  const porChave = new Map<string, GrupoDoDinheiro>();
  for (const a of lista) {
    const nomeCarne = (a.account_name || "").trim() || NOME_SEM_CARNE_MOV;
    const chave = a.account_id || "sem-carne:" + nomeCarne;
    let g = porChave.get(chave);
    if (!g) {
      g = { chave, nome: nomeCarne, linhas: [] };
      porChave.set(chave, g);
      grupos.push(g);
    }
    const valor = round2((Number(a.principal_paid) || 0) + (Number(a.charges_paid) || 0));
    const nome = nomeDaParcela(a);

    if (a.status_after === "paid") {
      g.linhas.push({ id: a.installment_id, tipo: "inteira", rotulo: `${nome} · paga inteira`, detalhe: "", valor });
      continue;
    }

    const sobra = quitouAlguma && valor > 0 && valor < LIMITE_DA_SOBRA;
    const tipo: TipoDaLinha = sobra ? "sobra" : "abateu";
    const rotulo = sobra ? `${nome} · sobra do pagamento` : `${nome} · abateu ${brl(valor)}`;

    const aberta = porId.get(a.installment_id);
    let detalhe: string;
    if (!aberta) {
      detalhe = "já não está em aberto";
    } else {
      const venc = aberta.due_date || a.due_date;
      const dm = diaMesDaData(venc);
      const vencida = !!hoje && !!diaEmSaoPaulo(venc) && diaEmSaoPaulo(venc) < hoje;
      const falta = quantoFaltaHoje(aberta);
      const partes: string[] = [];
      if (dm) partes.push(`${vencida ? "venceu" : "vence"} ${dm}`);
      partes.push(falta > 0.009 ? `hoje faltam ${brl(falta)}` : "hoje não falta nada");
      detalhe = partes.join(" · ");
    }
    g.linhas.push({ id: a.installment_id, tipo, rotulo, detalhe, valor });
  }
  return grupos;
}
