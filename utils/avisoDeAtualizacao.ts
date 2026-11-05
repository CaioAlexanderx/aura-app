// ============================================================
// AURA. — Aviso automático de versão nova: a regra, sem React (05/11/2026)
//
// O aviso (components/UpdateBanner) ficou desligado de 11/07 a 05/11/2026
// porque o bundle é único para toda a Aura: cada deploy mudava o hash e o
// lojista via "Nova versão disponível" o dia inteiro (média de 4,6 deploys
// por dia útil nos últimos 30 dias, pico de 12).
//
// O custo de ficar sem ele apareceu na Lulume em 04 e 05/11: a aba do caixa
// estava aberta há dias, três correções de etiqueta já estavam no ar e ela
// imprimia com o app velho; ninguém percebeu por horas. O botão "Versão do
// app" em Configurações existe, mas só ajuda quem sabe que precisa dele.
//
// Então o aviso volta, com três freios para não virar ruído:
//   1. só versão ASSENTADA: o bundle servido tem de ter pelo menos 30 min de
//      vida (builtAt do version.json). Numa sequência de deploys o aviso
//      sai uma vez, com o último, e não a cada um;
//   2. "Agora não" cala o aviso por 24 h neste navegador. No pior dia
//      (12 deploys) quem dispensa vê um aviso só;
//   3. dentro da janela de congelamento, só hotfix (regra que já existia,
//      services/atualizarApp.atualizacaoLiberada).
// Sem builtAt (version.json ausente, de outro bundle ou ilegível) o aviso
// espera a próxima verificação em vez de arriscar: na dúvida, quieto.
// ============================================================

export const IDADE_MINIMA_MS = 30 * 60 * 1000;
export const SILENCIO_MS = 24 * 60 * 60 * 1000;
export const CHAVE_SILENCIO = "aura.atualizacao.agoraNao";

export const TEXTO_DO_AVISO = {
  titulo: "Nova versão da Aura disponível.",
  atualizar: "Atualizar",
  agoraNao: "Agora não",
} as const;

export type EntradaDoAviso = {
  /** Hash do bundle rodando nesta aba (null = dev/nativo: nunca avisa). */
  carregado: string | null;
  /** Hash do bundle que o servidor serve (null = não deu para ler). */
  servido: string | null;
  /** builtAt do bundle servido, em ms; null = não deu para saber. */
  builtAt: number | null;
  /** Até quando "Agora não" vale, em ms; null/0 = não está calado. */
  silenciadoAte: number | null;
  /** "Agora", em ms. */
  agora: number;
};

/** Mostrar o aviso? Todas as condições, numa função só, para o jest. */
export function deveAvisar(e: EntradaDoAviso): boolean {
  if (!e.carregado || !e.servido) return false;
  if (e.servido === e.carregado) return false;
  if (e.builtAt == null || !Number.isFinite(e.builtAt)) return false;
  if (e.agora - e.builtAt < IDADE_MINIMA_MS) return false;
  if (e.silenciadoAte && e.silenciadoAte > e.agora) return false;
  return true;
}

function armazenamento(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Até quando o aviso está calado neste navegador (ms), ou null. */
export function silenciadoAte(): number | null {
  try {
    const v = Number(armazenamento()?.getItem(CHAVE_SILENCIO) || "");
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** "Agora não": cala por 24 h. Devolve até quando. */
export function silenciarPorUmDia(agora: number = Date.now()): number {
  const ate = agora + SILENCIO_MS;
  try {
    armazenamento()?.setItem(CHAVE_SILENCIO, String(ate));
  } catch {
    /* sem armazenamento: o aviso volta na próxima verificação, só isso */
  }
  return ate;
}

/** Só para teste. */
export function _limparSilencio(): void {
  try {
    armazenamento()?.removeItem(CHAVE_SILENCIO);
  } catch {
    /* nada */
  }
}
