// ============================================================
// AURA STUDIO · Leitura do fluxo do quadro (K4 — Quadro Vivo)
//
// Funções PURAS sobre o que listOrders já devolve. Módulo próprio para ser
// testável de verdade — teste que reimplementa a regra não protege nada
// (lição da K2).
//
// ZERO CONFIGURAÇÃO, como a premissa exige: nada aqui pede número, limite
// ou ajuste. Tudo é derivado do próprio quadro.
//
// O QUE NÃO DÁ PRA FAZER HOJE, e por quê:
// O plano previa avisar quando uma coluna está "mais cheia que o normal
// dela". Isso exige histórico de ocupação por coluna, e o sistema não
// guarda nada disso — não há tabela de histórico nem timestamp de quando o
// card entrou em cada etapa. Levantamento em 18/08/2026: zero das duas
// coisas.
//
// Em vez de inventar um número ou pedir configuração, comparamos a coluna
// com o RESTO DO QUADRO AGORA: uma etapa que concentra boa parte do
// trabalho ativo é gargalo hoje, independentemente do histórico. É sinal
// honesto com o dado que existe.
// ============================================================

export type CardDoQuadro = {
  id: string;
  studio_production_status?: string | null;
  promised_date?: string | null;
};

/** Dias até a data prometida. Normaliza os dois lados em UTC: data pura
 *  contra hoje local faz "entrega hoje" virar "atrasou 1d" em São Paulo. */
export function diasAtePrazo(iso?: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const n = new Date();
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000,
  );
}

// Etapas que ainda não produzem nada. Um card com entrega perto ainda
// parado aqui é o que vira atraso — e é exatamente o que a lojista não
// enxerga olhando um quadro sem prazo.
const ETAPAS_INICIAIS = new Set(["awaiting_customization", "pending_art", "approved"]);

/** "delivered" e "cancelled" saíram do fluxo; o resto é trabalho ativo. */
export function ehAtivo(c: CardDoQuadro): boolean {
  const s = c.studio_production_status || "pending_art";
  return s !== "delivered" && s !== "cancelled";
}

export type Risco = "atrasado" | "hoje" | "apertado" | null;

/**
 * Risco de uma encomenda, pela distância entre o prazo e a etapa.
 *
 * Não é só "o prazo está perto": é prazo perto COM o trabalho ainda no
 * começo. Uma encomenda que entrega amanhã e já está pronta não é risco —
 * é uma entrega amanhã.
 */
export function riscoDoCard(c: CardDoQuadro): Risco {
  if (!ehAtivo(c)) return null;
  const dias = diasAtePrazo(c.promised_date);
  if (dias === null) return null;
  if (dias < 0) return "atrasado";
  if (dias === 0) return "hoje";
  const cedoDemais = ETAPAS_INICIAIS.has(c.studio_production_status || "pending_art");
  if (dias <= 2 && cedoDemais) return "apertado";
  return null;
}

export type ResumoDaSemana = {
  total: number;      // entregas combinadas nos próximos 7 dias (inclui hoje)
  atrasadas: number;  // prazo já passou e ainda não saiu
  hoje: number;
  emRisco: number;    // atrasadas + hoje + apertadas
};

/** O que a régua no topo do quadro precisa saber. */
export function resumoDaSemana(cards: CardDoQuadro[]): ResumoDaSemana {
  let total = 0, atrasadas = 0, hoje = 0, emRisco = 0;
  for (const c of cards) {
    if (!ehAtivo(c)) continue;
    const dias = diasAtePrazo(c.promised_date);
    if (dias === null) continue;
    if (dias < 0) atrasadas++;
    else if (dias === 0) { hoje++; total++; }
    else if (dias <= 7) total++;
    if (riscoDoCard(c)) emRisco++;
  }
  return { total, atrasadas, hoje, emRisco };
}

// Uma coluna que sozinha concentra mais da metade do trabalho ativo é
// gargalo — e metade é o ponto em que ela pesa mais que todas as outras
// somadas, não um número escolhido a dedo.
export const FATIA_DE_GARGALO = 0.5;

// Abaixo disso não há fila pra falar de gargalo: 2 de 3 cards é 67% e não
// significa nada.
export const MINIMO_PRA_GARGALO = 5;

/**
 * A coluna que está segurando o fluxo, ou null.
 *
 * Compara a coluna com o quadro AGORA (não com histórico, que não existe).
 * Sem número pra configurar e sem jargão de WIP na tela.
 */
export function colunaGargalo(
  porStatus: Record<string, CardDoQuadro[]>,
  colunasAtivas: string[],
): string | null {
  let ativos = 0;
  for (const k of colunasAtivas) ativos += (porStatus[k] || []).length;
  if (ativos < MINIMO_PRA_GARGALO) return null;

  for (const k of colunasAtivas) {
    const n = (porStatus[k] || []).length;
    if (n / ativos > FATIA_DE_GARGALO) return k;
  }
  return null;
}
