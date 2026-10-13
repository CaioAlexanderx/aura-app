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

// ── Quem vê ──────────────────────────────────────────────────
//
// Decisão do Caio (13/10): a página fica OCULTA por enquanto e só aparece
// para quem testa — staff (is_staff ou conta @getaura.com.br) e empresa de
// teste (companies.is_sandbox). Quando `BLACK_FRIDAY_LIBERADA_PARA_TODOS`
// virar true, a página abre para todo mundo, dentro do período e do plano.
//
// ATENÇÃO — `is_sandbox`: a coluna existe no backend (migration 320), mas o
// GET /auth/me ainda NÃO a devolve no objeto `company`. Enquanto isso, a
// leitura abaixo só acende para staff; ela passa a valer para conta de
// teste sozinha assim que o payload trouxer o campo (sem mudar o app).
export const BLACK_FRIDAY_LIBERADA_PARA_TODOS = false;

export type ContaParaBlackFriday = {
  /** isStaff do auth store (is_staff ou @getaura.com.br). */
  isStaff?: boolean | null;
  /** Campo legado do auth store (hoje sempre false). */
  isDemo?: boolean | null;
  user?: { is_staff?: boolean | null } | null;
  company?: { is_sandbox?: boolean | null } | null;
};

/** A conta é de teste (staff, demo ou empresa sandbox)? */
export function ehContaDeTeste(c: ContaParaBlackFriday): boolean {
  return (
    c.isStaff === true ||
    c.isDemo === true ||
    (!!c.user && c.user.is_staff === true) ||
    (!!c.company && c.company.is_sandbox === true)
  );
}

/**
 * A página (item do menu e rota) está liberada para esta conta, hoje?
 * Período E (liberada para todos OU conta de teste). `hoje` e a constante
 * são injetáveis só para teste.
 */
export function blackFridayLiberada(
  c: ContaParaBlackFriday,
  hoje?: string,
  liberadaParaTodos: boolean = BLACK_FRIDAY_LIBERADA_PARA_TODOS,
): boolean {
  if (!blackFridayAtivo(hoje)) return false;
  return liberadaParaTodos || ehContaDeTeste(c);
}
