// "1 item" / "2 itens". A contagem vem do Postgres como COUNT(*) —
// bigint, que chega ao app como TEXTO ("1"). Comparar `qty === 1` dava
// sempre falso e o hub escrevia "1 itens" em todas as linhas (QA final
// 28/09/2026, LJ-30).
export function rotuloDeItens(qtd: number | string | null | undefined): string {
  const n = Number(qtd);
  const total = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  return `${total} ${total === 1 ? "item" : "itens"}`;
}
