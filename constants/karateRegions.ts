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
// 13/07/2026 (parte 2) — removido "Outra…" (REGION_OTHER) do seletor.
// Auditoria no banco (100 dojôs): as 10 regiões abaixo cobrem 100% dos
// registros com região preenchida (78) — os outros 22 têm region = NULL,
// que é "—" (ausência normal, nunca erro), não "Outra…". Sem nenhum dojô
// fora da lista, o fallback de texto livre só existia para abrir a mesma
// duplicidade de campo que este arquivo corrigiu na primeira rodada.
//
// O valor persistido continua sendo a string de texto (coluna `region`).

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
];

/** Conjunto das 10 regiões canônicas — usado para checar se um valor salvo
 *  no banco (region) bate com a lista atual. */
export const KARATE_REGIONS_VALUES = new Set(KARATE_REGIONS);
