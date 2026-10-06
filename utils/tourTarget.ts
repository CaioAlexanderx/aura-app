// ============================================================
// Marcadores de tour (05/10/2026 — primeiros passos por frente)
//
// Registro leve de "onde o tour aponta": o elemento alvo ganha o atributo
// data-tour="<chave>" (no react-native-web, via dataSet) e o SpotlightTour
// acha pelo seletor. Nada de ref global nem de registro em store: a tela
// alvo só marca o botão, e quem puxa o tour só conhece a chave.
//
//   <Pressable {...tourTarget("estoque.importar")} ...>
//   tourSelector("estoque.importar") → '[data-tour="estoque.importar"]'
//
// Em native o dataSet é ignorado (o SpotlightTour é web-only).
// ============================================================

export function tourTarget(key: string): any {
  return { dataSet: { tour: key } };
}

export function tourSelector(key: string): string {
  return '[data-tour="' + key + '"]';
}
