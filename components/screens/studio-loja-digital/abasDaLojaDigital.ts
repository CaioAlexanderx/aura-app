// ============================================================
// Loja Digital do Studio · as abas e a troca entre elas (QA 26/09)
//
// Duas queixas do QA:
//   - as abas gravavam `?tab=` com replace: o "voltar" do navegador saía
//     da Loja Digital em vez de voltar para a aba anterior;
//   - trocar de aba com o formulário pela metade descartava a edição sem
//     avisar.
//
// Contrato das abas: quem tem formulário recebe `onAlteracoes(bool)` e
// avisa quando há alteração não salva. A tela pergunta antes de sair.
// ============================================================

export const ABAS_DA_LOJA_DIGITAL = [
  "site", "design", "aparencia", "configurator", "gallery", "revisions",
  "marketplaces", "delivery", "pedidos_loja", "orders",
] as const;

export type AbaDaLojaDigital = (typeof ABAS_DA_LOJA_DIGITAL)[number];

const CONHECIDAS = new Set<string>(ABAS_DA_LOJA_DIGITAL);

/** A aba do `?tab=`. Valor desconhecido (ou ausente) cai em Meu Site. */
export function abaDaUrl(param: unknown): AbaDaLojaDigital {
  const v = Array.isArray(param) ? param[0] : param;
  return typeof v === "string" && CONHECIDAS.has(v) ? (v as AbaDaLojaDigital) : "site";
}

/** A pergunta da tela quando a aba atual tem alteração não salva. */
export const PERGUNTA_ALTERACOES = "Você tem alterações não salvas. Sair sem salvar?";

/**
 * O que um clique numa aba faz:
 *   - "nada": clicou na aba em que já está;
 *   - "perguntar": a aba atual tem alteração não salva;
 *   - "ir": troca (com push, para o voltar do navegador funcionar).
 */
export function trocaDeAba(p: {
  atual: AbaDaLojaDigital;
  proxima: AbaDaLojaDigital;
  alteradas: Partial<Record<AbaDaLojaDigital, boolean>>;
}): "nada" | "perguntar" | "ir" {
  if (p.proxima === p.atual) return "nada";
  return p.alteradas[p.atual] ? "perguntar" : "ir";
}
