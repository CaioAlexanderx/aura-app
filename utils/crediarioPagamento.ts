// ============================================================================
// AURA. — Crediário: o pagamento na linha do tempo (08/10/2026)
//
// Caso Looks da Jenny: R$ 200 lançados na ficha da "Maria Eduarda" errada. A
// timeline dizia só "Pagamento · pix −R$ 200,00": não mostrava em quais
// parcelas o dinheiro tinha caído e não tinha como editar nem tirar.
//
// O backend passou a mandar, em cada evento de pagamento, as parcelas que ele
// cobriu (`payment.allocations`). Aqui ficam as duas contas puras da tela:
//   · gruposPorCarne — as parcelas agrupadas pelo carnê, na ordem que chegam
//     (vencimento), com rótulo pronto;
//   · mudancasDoPagamento — o corpo do PATCH só com o que a lojista mudou
//     (o backend recusa "nada para alterar", e mandar campo igual esconderia
//     um engano de digitação).
// ============================================================================
import { installmentLabel } from "./creditInstallmentLabel";

export type AlocacaoDoPagamento = {
  installment_id: string;
  number: number | null;
  total_installments: number | null;
  due_date: string | null;
  account_id: string | null;
  account_name: string | null;
  /** A parcela nasceu de uma venda no Caixa (sem carnê nomeado). */
  from_sale?: boolean;
  principal_paid: number;
  charges_paid: number;
  status_after: string | null;
};

export type LinhaDoGrupo = {
  id: string;
  /** "Parcela 1/3 · vence 06/08/26" */
  rotulo: string;
  /** Principal + encargos que ESTE pagamento pôs na parcela. */
  valor: number;
  /** O pagamento quitou a parcela (false = só abateu). */
  quitou: boolean;
};

export type GrupoDoCarne = {
  chave: string;
  /** Nome do carnê, "Venda no crediário" ou "Conta geral". */
  nome: string;
  linhas: LinhaDoGrupo[];
  total: number;
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function nomeDoGrupo(a: AlocacaoDoPagamento): string {
  if (a.account_name && a.account_name.trim()) return a.account_name.trim();
  return a.from_sale ? "Venda no crediário" : "Conta geral";
}

/** Parcelas do pagamento agrupadas por carnê, preservando a ordem de chegada. */
export function gruposPorCarne(alocacoes: AlocacaoDoPagamento[] | null | undefined): GrupoDoCarne[] {
  const grupos: GrupoDoCarne[] = [];
  const porChave = new Map<string, GrupoDoCarne>();
  for (const a of alocacoes || []) {
    const nome = nomeDoGrupo(a);
    const chave = a.account_id || "sem-carne:" + nome;
    let g = porChave.get(chave);
    if (!g) {
      g = { chave, nome, linhas: [], total: 0 };
      porChave.set(chave, g);
      grupos.push(g);
    }
    const valor = round2((a.principal_paid || 0) + (a.charges_paid || 0));
    g.linhas.push({
      id: a.installment_id,
      rotulo: installmentLabel({ number: a.number, total_installments: a.total_installments, due_date: a.due_date }),
      valor,
      quitou: a.status_after === "paid",
    });
    g.total = round2(g.total + valor);
  }
  return grupos;
}

export type PagamentoOriginal = {
  amount: number;
  method: string | null;
  /** AAAA-MM-DD do pagamento (dia de São Paulo). */
  paidAt: string;
  customerId: string;
};

export type FormDoPagamento = {
  amount: number;
  method: string | null;
  /** AAAA-MM-DD, ou null quando a data digitada não é válida. */
  paidAt: string | null;
  customerId: string;
};

export type CorpoDaEdicao = Partial<{ amount: number; method: string; paid_at: string; customer_id: string }>;

/**
 * O que mudou entre o pagamento original e o formulário. `erro` preenchido =
 * não dá para salvar (e por quê, em português de balcão).
 */
export function mudancasDoPagamento(
  original: PagamentoOriginal,
  form: FormDoPagamento,
  hoje: string,
): { corpo: CorpoDaEdicao; erro: string | null } {
  const corpo: CorpoDaEdicao = {};
  const valor = round2(form.amount);
  if (!(valor > 0)) return { corpo, erro: "Informe um valor maior que zero." };
  if (!form.paidAt) return { corpo, erro: "Informe a data do pagamento (dd/mm/aaaa)." };
  if (form.paidAt > hoje) return { corpo, erro: "A data do pagamento não pode ser no futuro." };
  if (!form.method) return { corpo, erro: "Escolha a forma de pagamento." };

  if (valor !== round2(original.amount)) corpo.amount = valor;
  if (form.method !== (original.method || null)) corpo.method = form.method;
  if (form.paidAt !== original.paidAt) corpo.paid_at = form.paidAt;
  if (form.customerId !== original.customerId) corpo.customer_id = form.customerId;

  if (Object.keys(corpo).length === 0) return { corpo, erro: "Nada foi alterado." };
  return { corpo, erro: null };
}

/** Dia de São Paulo (AAAA-MM-DD) de um timestamp do servidor. */
export function diaSP(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
