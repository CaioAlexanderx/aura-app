// "Olho" que oculta valores financeiros no Painel, Crediário e Estoque
// (17/09/2026). Regra pura, sem React, para ser testável no Jest.

export const MASCARA_MOEDA = "R$ ••••";

/** Texto de valor em dinheiro como deve aparecer na tela. */
export function ocultarMoeda(texto: string, ocultos: boolean): string {
  return ocultos ? MASCARA_MOEDA : texto;
}

// Preferência por aparelho (localStorage no web). Nunca quebra a tela:
// janela privada ou storage bloqueado caem no padrão (valores visíveis).
export const CHAVE_STORAGE = "aura_valores_ocultos";

export function lerPreferencia(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(CHAVE_STORAGE) === "1";
  } catch {
    return false;
  }
}

export function gravarPreferencia(ocultos: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (ocultos) localStorage.setItem(CHAVE_STORAGE, "1");
    else localStorage.removeItem(CHAVE_STORAGE);
  } catch {
    // preferência é conveniência: sem storage, vale só nesta sessão
  }
}
