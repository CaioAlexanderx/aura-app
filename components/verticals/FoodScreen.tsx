// ============================================================
// DEPRECATED — 2026-05-21 (Polish pré-Fase 7, F1).
//
// FoodScreen mockup antigo (KPIs ficticios + VerticalShell) foi
// removido do app. A vertical Food tem porta dedicada em
// /food/(salao)/* com shell proprio (FoodShell), sidebar dedicada
// (FoodSidebar) e fontes de dados reais (useFoodTables, useFoodKds,
// useFoodMenu).
//
// Este arquivo so persiste como tombstone. Nao importe FoodScreen
// em lugar nenhum — sera removido fisicamente em PR futuro quando
// a MCP tools suportarem delete via push.
// ============================================================

export default function FoodScreenDeprecated(): null {
  if (typeof console !== "undefined") {
    console.warn(
      "[FoodScreen] componente removido em 2026-05-21. Use /food/(salao)/mesas."
    );
  }
  return null;
}
