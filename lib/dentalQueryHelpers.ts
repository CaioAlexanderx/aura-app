import type { QueryClient } from "@tanstack/react-query";

// ============================================================
// dentalQueryHelpers — utilitarios pra invalidate cruzado entre
// queries dentais e financeiras genericas.
//
// CONTEXTO: backend (aura-backend migrations 064/067) cria
// transactions automaticamente quando eventos dental acontecem:
//   - parcela paga       (dental_treatment_plan_installments.paid_at)
//   - repasse paid       (dental_repasse_ledger.status = 'paid')
//   - guia TISS paga     (dental_tiss_guides.paid_at)
//
// Sem esse invalidate cruzado, /financeiro generico mostra dado
// stale por ate 30s (staleTime padrao do React Query). Com ele,
// atualizacao instantanea.
//
// USAR SEMPRE que uma mutation dental disparar uma das 3 triggers.
// Hoje, no aura-app, e disparado em apenas 1 lugar:
//   - components/verticals/odonto/RepasseDentista.tsx (markPaidMut)
//
// FEATURES FUTURAS que tambem devem usar esta helper:
//   - Botao "Marcar parcela como paga" em BillingDashboard ou
//     PatientHub > CobrancasTabContent (atualmente apenas listam
//     parcelas, sem mutation de pagamento).
//   - Reconciliacao TISS — quando UI parsear XML de retorno e
//     marcar guias pagas (TissDashboard tem mutations de criar
//     guia/lote mas nao de marcar paga).
// ============================================================

// Lista de queryKeys financeiras potencialmente afetadas pelos
// triggers backend. Ordem nao importa — todas sao invalidadas em
// bloco. Manter conservador (pegar tudo) e mais seguro que perder
// alguma key.
const DENTAL_FINANCIAL_KEYS: ReadonlyArray<readonly string[]> = [
  // Generico — diretamente atualizado pelas triggers
  ["transactions"],
  ["dre"],
  ["dashboard-aggregate"],
  ["dashboard-summary"],
  ["dashboard-sparkline"],
  ["sales-analytics"],

  // Dental — fontes dos eventos (refletem nos cards do shell dental)
  ["dental-billing-dash"],
  ["dental-billing-overdue"],
  ["dental-repasses"],
  ["dental-dashboard"],
  ["tiss-guides"],
  ["tiss-batches"],
];

// Versao tipada permissiva: aceita QueryClient real ou qualquer
// objeto com `invalidateQueries`. Facilita uso em testes/mocks.
type QcLike = Pick<QueryClient, "invalidateQueries"> | { invalidateQueries: (opts: any) => any };

export function invalidateDentalFinancials(qc: QcLike): void {
  for (const k of DENTAL_FINANCIAL_KEYS) {
    qc.invalidateQueries({ queryKey: k as readonly unknown[] });
  }
}
