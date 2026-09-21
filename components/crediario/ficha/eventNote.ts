// ============================================================
// eventNote — descrição de um evento da linha do tempo do crediário.
//
// 21/09/2026: o "Novo lançamento" oferece o campo Descrição, o backend grava
// em customer_credit_transactions.notes e o /history devolve em meta.notes —
// mas a linha do tempo nunca mostrava. A lojista digitava "conta anterior",
// "bolsa da vitrine"... e o texto sumia: todo lançamento virava só
// "Débito manual". Em produção, 119 lançamentos já tinham descrição digitada.
//
// Regras:
//  - compra (purchase): notes é texto do sistema ("Venda no crediário (...)")
//    e os itens já aparecem listados — não repete.
//  - "Lancamento manual" é o padrão que o backend grava quando a descrição
//    fica em branco — não é informação, não mostra.
//  - demais tipos: mostra o que houver (descrição digitada no lançamento ou
//    no recebimento; "Renegociacao ..."/"Devolucao de ..." do sistema, que
//    explicam de onde o evento veio).
//
// Arquivo sem imports de propósito: testável no Jest sem carregar React Native.
// ============================================================

const DEFAULT_MANUAL_NOTES = ["lancamento manual", "lançamento manual"];

export function eventNote(ev: { type: string; meta?: Record<string, any> | null }): string {
  if (!ev || ev.type === "purchase") return "";
  const raw = typeof ev.meta?.notes === "string" ? ev.meta.notes.trim() : "";
  if (!raw) return "";
  if (DEFAULT_MANUAL_NOTES.indexOf(raw.toLowerCase()) >= 0) return "";
  return raw;
}
