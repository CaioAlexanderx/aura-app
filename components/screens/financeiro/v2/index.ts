// components/screens/financeiro/v2/index.ts
//
// Barrel pra os componentes do redesign v2 do Financeiro.

export * from "./types";
// F3 (24/08/2026): hero unificado da Visao Geral + lista "Para fazer agora".
// Substituem HealthScoreHero (donut de score + 4 drivers), BiggestLever e
// SmartBalance, que juntos lotavam a primeira dobra.
export { default as ResumoHero } from "./ResumoHero";
export { default as AcoesCard } from "./AcoesCard";
export { goalColor, goalHealth, goalCaption, hexLerp } from "./goalScale";
export { default as RunwayCard } from "./RunwayCard";
export { default as FinanceiroTopbar } from "./FinanceiroTopbar";
export { default as TabReceitas } from "./TabReceitas";
export { default as TabDespesas } from "./TabDespesas";
// Onda 2: cards compartilhados
export { Top5List, HBarList, Timeline, DowBars, Gauge, AnomalyAlerts } from "./SharedCards";
// Onda 3: cashflow + evolução + ranking
export { CashflowChart, MonthlyEvolution, ProfessionalsRanking } from "./Onda3Cards";
