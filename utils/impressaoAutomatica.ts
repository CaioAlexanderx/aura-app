// ============================================================
// AURA. — Impressão automática do cupom (p-159, 17/11/2026)
//
// A loja liga em Políticas do Caixa (pdv_settings.auto_print_receipt,
// Aura-backend#1042). Cada aparelho ainda escolhe "Imprimir aqui" ou
// "Neste aparelho não" — o teclado e a impressora são do computador, não da
// loja. A escolha fica no navegador, por loja. Sem escolha gravada: o
// computador imprime, o celular não (a térmica quase nunca está no celular).
// Decisão do Caio: só o cupom não fiscal; a nota é sempre manual.
// Quem imprime de fato é o p-160 (quadro oculto na tela de venda concluída),
// pela função imprimeNesteAparelho.
// ============================================================
import type { PdvSettings } from "@/services/authApi";

export type EscolhaDoAparelho = "imprimir" | "nao";

const PREFIXO = "aura:cupom-automatico:";

export function chaveDoAparelho(companyId: string): string {
  return PREFIXO + companyId;
}

/** Aparelho de toque, sem mouse: celular ou tablet. */
export function ehCelular(): boolean {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  } catch {
    return false;
  }
}

export function escolhaPadrao(celular: boolean = ehCelular()): EscolhaDoAparelho {
  return celular ? "nao" : "imprimir";
}

export function lerEscolhaDoAparelho(companyId: string | null | undefined, celular: boolean = ehCelular()): EscolhaDoAparelho {
  if (!companyId) return escolhaPadrao(celular);
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(chaveDoAparelho(companyId)) : null;
    if (v === "imprimir" || v === "nao") return v;
  } catch { /* janela anônima ou armazenamento bloqueado */ }
  return escolhaPadrao(celular);
}

export function gravarEscolhaDoAparelho(companyId: string | null | undefined, escolha: EscolhaDoAparelho): void {
  if (!companyId) return;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(chaveDoAparelho(companyId), escolha);
  } catch { /* só não lembra */ }
}

export function lerImpressaoAutomaticaLigada(settings: Partial<PdvSettings> | null | undefined): boolean {
  return !!(settings && (settings as any).auto_print_receipt === true);
}

/** A loja ligou e este aparelho não disse "Neste aparelho não". */
export function imprimeNesteAparelho(
  settings: Partial<PdvSettings> | null | undefined,
  companyId: string | null | undefined,
  celular: boolean = ehCelular(),
): boolean {
  return lerImpressaoAutomaticaLigada(settings) && lerEscolhaDoAparelho(companyId, celular) === "imprimir";
}

// Textos do mockup aprovado (p-139). As palavras ainda são proposta até o OK
// do Caio; ficam todas aqui para trocar num lugar só.
export const TEXTOS_DA_IMPRESSAO = {
  opcao: "Imprimir o cupom ao finalizar a venda",
  apoio: "Quando a venda é registrada, a impressão do cupom abre sozinha: é só confirmar com Enter. A nota fiscal continua sendo impressa por você.",
  tituloComputador: "Neste computador",
  tituloCelular: "Neste celular",
  imprimirAqui: "Imprimir aqui",
  nesteAparelhoNao: "Neste aparelho não",
  computadorImprime: "Essa escolha fica guardada só neste aparelho. Use Neste aparelho não no computador do escritório ou no celular, onde não tem impressora de cupom.",
  computadorNao: "Neste aparelho a impressão não abre sozinha. O botão Imprimir cupom continua na tela final.",
  celularNao: "Deixamos desligado neste celular, porque a impressora de cupom quase nunca está ligada no celular. As vendas feitas aqui não abrem a impressão. O computador do balcão continua imprimindo.",
  celularImprime: "Neste celular a impressão vai abrir a cada venda. Se não tem impressora de cupom ligada nele, escolha Neste aparelho não.",
} as const;

export function textoDaEscolha(escolha: EscolhaDoAparelho, celular: boolean): string {
  if (celular) return escolha === "nao" ? TEXTOS_DA_IMPRESSAO.celularNao : TEXTOS_DA_IMPRESSAO.celularImprime;
  return escolha === "nao" ? TEXTOS_DA_IMPRESSAO.computadorNao : TEXTOS_DA_IMPRESSAO.computadorImprime;
}
