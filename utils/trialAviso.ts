// ============================================================
// AURA. — Texto do aviso do trial a partir de company.trial (14/10/2026)
//
// O backend (trialRegra.montarTrial, backend#817) devolve em /auth/me e no
// cadastro o bloco `company.trial`:
//
//   { mode: 'fixo' | 'primeira_venda', ends_at, started_by_sale_at,
//     dias_restantes, teto_em, aguardando_primeira_venda,
//     dias_apos_primeira_venda }
//
// Até aqui o app ignorava o bloco e contava dias de trial_ends_at: o cadastro
// novo mostrava "15 dias restantes" (o TETO) e, na primeira venda, a conta
// caía para 7 sem explicação.
//
// Decisão do Caio (13/10, aba Produto do board): o anúncio do teste é de 7
// dias. O teto de 15 dias corridos e a queda para 7 na primeira venda são
// mecânica interna e NÃO entram em nenhum texto — o aviso nunca mostra "15
// dias". Antes da primeira venda: "Teste grátis de 7 dias", sem contador.
// Depois: contador com os dias que restam de verdade.
//
// Regras deste módulo:
//   · nenhuma data é recalculada aqui — dias_restantes vem do servidor;
//   · bloco ausente (backend anterior ao #817) = comportamento de sempre,
//     contando a partir de trial_ends_at (legadoDias);
//   · o único caso em que o contador aparece antes da venda é o fim do teto
//     (2 dias ou menos): ali o teste acaba de verdade e mentir "7 dias" seria
//     pior que mostrar a contagem ("Faltam N dias do período de teste e você
//     ainda não fez a primeira venda").
//
// 14/10/2026 (decisão da Nina, aprovada pelo Caio): no fim do teto, sem
// venda, o aviso não repete "Os 7 dias começam na sua primeira venda" (que
// contradiz a contagem): diz quantos dias faltam, que a primeira venda ainda
// não aconteceu e que é preciso assinar. Nunca cita os 15 dias.
//
// Os textos moram todos em TEXTOS_TRIAL: o texto que a loja lê passa pela
// aprovação do Caio (card t2-05), então trocar uma frase é editar aqui.
// ============================================================

export type TrialModo = "fixo" | "primeira_venda";

export type TrialInfo = {
  mode: TrialModo;
  ends_at: string | null;
  started_by_sale_at: string | null;
  dias_restantes: number | null;
  teto_em: string | null;
  aguardando_primeira_venda: boolean;
  dias_apos_primeira_venda: number;
};

export type AvisoTrial = {
  /** Qual regra gerou o texto (útil para teste e para o componente). */
  estado: "legado" | "fixo" | "sem_venda" | "em_curso";
  titulo: string;
  corpo: string;
  urgente: boolean;
  /** Dias restantes quando o título traz contador; null quando não traz. */
  dias: number | null;
};

/** Dias restantes a partir dos quais o aviso fica vermelho. */
export const DIAS_URGENTE = 2;
const DIAS_PADRAO_PRIMEIRA_VENDA = 7;

function diasTxt(n: number): string {
  return n === 1 ? "1 dia restante" : `${n} dias restantes`;
}

/** "Faltam 2 dias", "Falta 1 dia"; zero vira o aviso de que termina hoje. */
function semVendaFim(n: number): string {
  if (n <= 0) return "Seu período de teste termina hoje e você ainda não fez a primeira venda.";
  if (n === 1) return "Falta 1 dia do período de teste e você ainda não fez a primeira venda.";
  return `Faltam ${n} dias do período de teste e você ainda não fez a primeira venda.`;
}

export const TEXTOS_TRIAL = {
  contador: (n: number) => `Teste grátis · ${diasTxt(n)}`,
  urgente: "Seu período de teste termina em breve. Assine para não perder acesso.",
  semVendaFimTitulo: semVendaFim,
  semVendaFimCorpo: "Assine para não perder o acesso.",
  fixo: (plano: string) => `Você está no período de teste do plano ${plano}.`,
  semVendaTitulo: (n: number) => `Teste grátis de ${n} dias`,
  semVendaCorpo: (n: number) => `Os ${n} dias começam na sua primeira venda no Caixa.`,
  emCurso: (n: number, plano: string) =>
    `Seus ${n} dias começaram na sua primeira venda. Plano ${plano}.`,
} as const;

/**
 * Lê o bloco `trial` da resposta do backend com defesa: qualquer coisa fora
 * do formato vira null (o app cai no comportamento antigo, nunca quebra).
 */
export function lerTrial(raw: unknown): TrialInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const mode = r.mode === "primeira_venda" ? "primeira_venda" : r.mode === "fixo" ? "fixo" : null;
  if (!mode) return null;
  const txt = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
  const dias = typeof r.dias_restantes === "number" && Number.isFinite(r.dias_restantes)
    ? Math.max(0, Math.floor(r.dias_restantes)) : null;
  const apos = typeof r.dias_apos_primeira_venda === "number" && r.dias_apos_primeira_venda > 0
    ? Math.floor(r.dias_apos_primeira_venda) : DIAS_PADRAO_PRIMEIRA_VENDA;
  return {
    mode,
    ends_at: txt(r.ends_at),
    started_by_sale_at: txt(r.started_by_sale_at),
    dias_restantes: dias,
    teto_em: txt(r.teto_em),
    aguardando_primeira_venda: r.aguardando_primeira_venda === true,
    dias_apos_primeira_venda: apos,
  };
}

/**
 * Texto do aviso do trial.
 * @param trial       company.trial (ou null, backend sem o bloco)
 * @param opts.plano  rótulo do plano ("Negócio")
 * @param opts.legadoDias  dias contados a partir de trial_ends_at, usados só
 *                    quando não há bloco (ou ele não traz dias_restantes)
 */
export function avisoDoTrial(
  trial: TrialInfo | null | undefined,
  opts: { plano: string; legadoDias: number },
): AvisoTrial {
  const info = trial || null;
  const dias = info && info.dias_restantes != null ? info.dias_restantes : Math.max(0, opts.legadoDias);

  if (info && info.mode === "primeira_venda" && info.aguardando_primeira_venda && dias > DIAS_URGENTE) {
    const n = info.dias_apos_primeira_venda;
    return {
      estado: "sem_venda",
      titulo: TEXTOS_TRIAL.semVendaTitulo(n),
      corpo: TEXTOS_TRIAL.semVendaCorpo(n),
      urgente: false,
      dias: null,
    };
  }

  // Fim do teto sem nenhuma venda: contador e a explicação do que falta.
  if (info && info.mode === "primeira_venda" && info.aguardando_primeira_venda) {
    return {
      estado: "sem_venda",
      titulo: TEXTOS_TRIAL.semVendaFimTitulo(dias),
      corpo: TEXTOS_TRIAL.semVendaFimCorpo,
      urgente: true,
      dias,
    };
  }

  const urgente = dias <= DIAS_URGENTE;
  const emCurso = !!info && info.mode === "primeira_venda" && !info.aguardando_primeira_venda;
  const estado: AvisoTrial["estado"] = !info ? "legado"
    : info.mode === "fixo" ? "fixo"
    : emCurso ? "em_curso" : "sem_venda";
  const corpo = urgente
    ? TEXTOS_TRIAL.urgente
    : emCurso && info
      ? TEXTOS_TRIAL.emCurso(info.dias_apos_primeira_venda, opts.plano)
      : TEXTOS_TRIAL.fixo(opts.plano);

  return { estado, titulo: TEXTOS_TRIAL.contador(dias), corpo, urgente, dias };
}

/**
 * A empresa já fez a primeira venda no trial? Só o modo primeira_venda sabe
 * (started_by_sale_at). Modo fixo (código de acesso, cupom, extensão) e bloco
 * ausente: false, e quem usa trata como "não sabemos", com texto neutro.
 */
export function vendeuNoTrial(trial: TrialInfo | null | undefined): boolean {
  return !!trial && trial.mode === "primeira_venda" && !!trial.started_by_sale_at;
}

/** Dias até trial_ends_at: SÓ para backend sem o bloco `trial` (legado). */
export function diasLegado(trialEndsAt: string | null | undefined, agora: number = Date.now()): number {
  if (!trialEndsAt) return 0;
  const fim = new Date(trialEndsAt).getTime();
  if (!Number.isFinite(fim)) return 0;
  return Math.max(0, Math.ceil((fim - agora) / 86400000));
}
