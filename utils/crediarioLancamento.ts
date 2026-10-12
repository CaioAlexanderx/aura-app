// ============================================================================
// AURA. — Crediário: "o lançamento tem algo preenchido?" (12/10/2026)
//
// Relato de cliente: no "Novo lançamento" um clique fora do modal fechava a
// janela e o reset() apagava tudo — minutos de digitação. O modal agora
// pergunta antes de descartar, mas só quando há o que perder. Esta é a conta
// pura dessa pergunta.
//
// "Preenchido" é diferente de "diferente do estado inicial bruto": três campos
// nascem com o valor do dia (1º vencimento = hoje + 1 mês, data do lançamento
// = hoje, 1ª parcela unificada = hoje + 1 mês). Se o relógio virar a meia-noite
// com o modal aberto, ou se o chamador comparar com o "hoje" de agora, esses
// campos pareceriam editados sem o usuário ter tocado em nada. Por isso a
// comparação é feita contra os PADRÕES com que o formulário nasceu (`padroes`),
// que o modal guarda a cada reset(), e não contra uma data recalculada.
//
// A busca de cliente (`searchQ`) fica de fora de propósito: é uma consulta que
// se refaz em dois toques, não um dado digitado. Já o nome e o telefone do
// cliente novo contam.
// ============================================================================

/** Os valores com que o formulário nasceu (os que dependem do dia). */
export type PadroesDoLancamento = {
  /** 1º vencimento e 1ª parcela unificada: hoje + 1 mês, dd/mm/aaaa. */
  vencimento: string;
  /** Data do lançamento: hoje (America/Sao_Paulo), dd/mm/aaaa. */
  hoje: string;
};

/** O recorte do estado do modal que decide se há algo a perder. */
export type EstadoDoLancamento = {
  selectedCustomer: { id: string } | null;
  newName: string;
  newPhone: string;
  amountRaw: string;
  installments: string;
  interestRate: string;
  firstDueDate: string;
  entryDate: string;
  periodKind: string;
  description: string;
  accountMode: string;
  selectedAccountId: string | null;
  newAccountName: string;
  unifyEnabled: boolean;
};

// Defaults fixos do formulário (não dependem do dia).
export const PARCELAS_PADRAO = "1";
export const PERIODO_PADRAO = "mensal";
export const CARNE_PADRAO = "new";

/**
 * true quando o usuário digitou/escolheu algo que um fechamento jogaria fora.
 * Estado idêntico ao inicial (inclusive depois de apagar o que digitou) → false.
 */
export function lancamentoPreenchido(e: EstadoDoLancamento, padroes: PadroesDoLancamento): boolean {
  if (e.selectedCustomer) return true;
  if (e.newName.trim() || e.newPhone.trim()) return true;
  if (e.amountRaw.trim()) return true;
  if (e.installments !== PARCELAS_PADRAO) return true;
  if (e.interestRate.trim()) return true;
  if (e.firstDueDate !== padroes.vencimento) return true;
  if (e.entryDate !== padroes.hoje) return true;
  if (e.periodKind !== PERIODO_PADRAO) return true;
  if (e.description.trim()) return true;
  if (e.accountMode !== CARNE_PADRAO) return true;
  if (e.selectedAccountId) return true;
  if (e.newAccountName.trim()) return true;
  if (e.unifyEnabled) return true;
  return false;
}
