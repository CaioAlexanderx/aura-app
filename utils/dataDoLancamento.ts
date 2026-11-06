// ============================================================
// AURA. — A data que o modal "Editar lançamento" mostra e devolve (06/11/2026)
//
// Esquina da Make, venda 527: feita 06/11 16:12, editada 16:14 só para
// trocar a forma de pagamento, virou 05/11 00:00 e sumiu da lista do dia.
//
// O vencimento (transactions.due_date) é uma DATA, mas chega do backend como
// meia-noite UTC ("2026-11-06T00:00:00.000Z"). O modal convertia isso no fuso
// de Brasília, onde meia-noite UTC ainda é 21h do dia ANTERIOR: o campo abria
// com 05/11, o Salvar mandava 05/11, e o backend levava a venda junto. Cada
// Salvar recuava mais um dia.
//
// Regra daqui: o vencimento é lido pelos 10 primeiros caracteres
// (AAAA-MM-DD), sem fuso nenhum; e, numa edição, só vai no PATCH se a pessoa
// mudou a data. Puro (sem React), para o jest carregar direto.
// ============================================================

/** "2026-11-06" ou "2026-11-06T00:00:00.000Z" -> "06/11/2026". null se não for data. */
export function vencimentoParaBR(dueDate: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dueDate || ""));
  return m ? m[3] + "/" + m[2] + "/" + m[1] : null;
}

/** Momento (timestamp) -> dia em Brasília, "DD/MM/AAAA". null se inválido. */
export function momentoParaBR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
}

/** A data que o campo abre: o vencimento quando há, senão o dia em que o lançamento nasceu. */
export function dataInicialDoLancamento(tx: { due_date?: string | null; created_at?: string | null }): string | null {
  return vencimentoParaBR(tx.due_date) || momentoParaBR(tx.created_at);
}

/**
 * O due_date que vai no PATCH de uma edição: só quando a pessoa mudou a data
 * do campo. Data igual à que abriu = undefined (o backend não mexe na venda).
 */
export function vencimentoDoPatch(dataDoCampo: string, dataQueAbriu: string, isoDoCampo: string | undefined): string | undefined {
  if (!isoDoCampo) return undefined;
  return dataDoCampo.trim() === dataQueAbriu.trim() ? undefined : isoDoCampo;
}
