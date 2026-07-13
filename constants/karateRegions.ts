// Regiões canônicas da FPKT para o cadastro de dojôs.
//
// ⚠️ CORREÇÃO (13/07/2026): esta lista era INVENTADA e não batia com os dados
// reais da federação. Resultado: 41 dos 101 dojôs tinham região fora da lista
// e o modal caía no fallback "Outra…" + campo de texto livre — ou seja, dois
// campos de região na tela ao mesmo tempo, o que parecia (e era) duplicidade.
// Pior: o filtro de região (lista e exportação) oferecia opções que quase
// nenhum dojô tinha.
//
// Agora a lista é o vocabulário REAL usado pela federação (extraído do banco):
//   Capital — São Paulo (25) · Grande SP — ABC / Osasco / Guarulhos (12)
//   Vale do Paraíba (14) · Campinas (13) · Bauru (8) · Sorocaba (2)
//   Baixada Santista · Litoral Norte · Barretos · Araraquara — Central
//
// "Outra…" (REGION_OTHER) segue existindo para uma região nova que ainda não
// esteja aqui — mas deixa de ser o caso da MAIORIA, que era o bug.
//
// O valor persistido continua sendo a string de texto (coluna `region`).

export const REGION_OTHER = "Outra…";

export const KARATE_REGIONS: string[] = [
  "Capital — São Paulo",
  "Grande SP — ABC / Osasco / Guarulhos",
  "Vale do Paraíba",
  "Campinas",
  "Bauru",
  "Sorocaba",
  "Baixada Santista",
  "Litoral Norte",
  "Araraquara — Central",
  "Barretos",
  REGION_OTHER,
];

/** Conjunto das opções fixas (sem "Outra…") — usado para detectar
 *  se o valor salvo no banco precisa do fallback de texto livre. */
export const KARATE_REGIONS_VALUES = new Set(
  KARATE_REGIONS.filter((r) => r !== REGION_OTHER)
);
