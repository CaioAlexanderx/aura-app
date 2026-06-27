// Regiões canônicas do estado de São Paulo para o cadastro de dojôs FPKT.
// A opção "Outra…" (REGION_OTHER) habilita digitação livre de fallback —
// usada quando o valor salvo não consta na lista ou quando o usuário opta
// por informar uma subdivisão não prevista aqui.
//
// O valor persistido é sempre a string de texto (coluna `region` no back).
// Ao carregar um registro, se o valor não estiver em KARATE_REGIONS_VALUES
// o campo cai automaticamente em "Outra…" e exibe o texto do banco.

export const REGION_OTHER = "Outra…";

export const KARATE_REGIONS: string[] = [
  "São Paulo",
  "Grande São Paulo",
  "Campinas",
  "Vale do Paraíba",
  "Litoral",
  "Sorocaba",
  "Ribeirão Preto",
  "Bauru",
  "São José do Rio Preto",
  "Presidente Prudente",
  REGION_OTHER,
];

/** Conjunto das opções fixas (sem "Outra…") — usado para detectar
 *  se o valor salvo no banco precisa do fallback de texto livre. */
export const KARATE_REGIONS_VALUES = new Set(
  KARATE_REGIONS.filter((r) => r !== REGION_OTHER)
);
