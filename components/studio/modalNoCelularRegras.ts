// ============================================================
// AURA STUDIO · modal no celular: as regras, sem React (etapa 4,
// 05/10/2026). As peças e os estilos moram em modalNoCelular.tsx, que
// reexporta tudo daqui.
// ============================================================

/** A mesma largura em que o shell do Studio vira celular. */
export const LARGURA_DO_CELULAR = 768;
/** Alvo mínimo de toque. */
export const ALVO_DE_TOQUE = 44;
/** Um primário e um secundário. O "Cancelar" é o X do cabeçalho. */
export const MAX_BOTOES_NO_RODAPE = 2;

export function ehCelular(largura: number): boolean {
  return largura < LARGURA_DO_CELULAR;
}

/** O foco automático só vale no desktop: no celular ele abre o teclado
 *  por cima do modal antes de a pessoa ver o que tem nele. */
export function focoAutomatico(celular: boolean): boolean {
  return !celular;
}

// ─── Rodapé ─────────────────────────────────────────────────

export type RodapeNoCelular<T> = {
  primaria: T | null;
  secundaria: T | null;
  /** O que não coube no rodapé e vai para o fim do corpo ("Mais ações"). */
  resto: T[];
};

/**
 * Reduz as ações de um rodapé a no máximo duas. A primária é a primeira
 * que `ehPrimaria` aceitar; a secundária, a primeira que `prefereSecundaria`
 * aceitar (ou a primeira que sobrar). O que só fecha o modal sai quando
 * não há vaga, porque o X do cabeçalho já faz isso. O resto continua
 * alcançável, fora do rodapé.
 */
export function rodapeNoCelular<T>(
  acoes: T[],
  o: { ehPrimaria: (a: T) => boolean; soFecha: (a: T) => boolean; prefereSecundaria?: (a: T) => boolean },
): RodapeNoCelular<T> {
  const primaria = acoes.find(o.ehPrimaria) ?? null;
  const outras = acoes.filter((a) => a !== primaria);
  if (outras.length <= (primaria ? 1 : MAX_BOTOES_NO_RODAPE - 1)) {
    return { primaria, secundaria: outras[0] ?? null, resto: [] };
  }
  const uteis = outras.filter((a) => !o.soFecha(a));
  const secundaria = (o.prefereSecundaria ? uteis.find(o.prefereSecundaria) : undefined) ?? uteis[0] ?? outras[0] ?? null;
  return { primaria, secundaria, resto: uteis.filter((a) => a !== secundaria) };
}
