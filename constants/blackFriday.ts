// ============================================================
// AURA. — Página "Black Friday" (13/10/2026): chave e período
//
// A página reúne as funções da temporada de fim de ano (o que vai faltar,
// assento de temporada, vale-troca no cupom, placar do dia). Ela existe
// só durante a temporada: o item do menu e a própria rota somem fora do
// período. Esta é a ÚNICA constante de período — a do ano seguinte se muda
// aqui, junto com as datas das funções (assentoTemporada.ts, valeTroca.ts).
//
// Chave de módulo PRÓPRIA (regra 3 do CLAUDE.md): cadastrada em
// MODULE_PLAN_MAP e PERM_TO_MODULES (hooks/useVisibleModules.ts) e usada
// pelo item do NAV (app/(tabs)/_layout.tsx).
// ============================================================
import { diaEmBrasilia } from "@/utils/valeTroca";

export const BLACK_FRIDAY_MOD = "black_friday";
export const BLACK_FRIDAY_ROTA = "/black-friday";

/** Período em que a página existe (dia civil de Brasília, inclusive). */
export const BLACK_FRIDAY_DE = "2026-10-13";
export const BLACK_FRIDAY_ATE = "2027-02-02";

/** A página está no ar? `hoje` ("AAAA-MM-DD") é injetável para teste. */
export function blackFridayAtivo(hoje?: string): boolean {
  const dia = hoje || diaEmBrasilia(Date.now());
  if (!dia) return false;
  return dia >= BLACK_FRIDAY_DE && dia <= BLACK_FRIDAY_ATE;
}
