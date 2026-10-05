// ============================================================
// AURA STUDIO · telas enxutas no celular (etapa 3, 05/10/2026)
//
// As etapas 1 e 2 (app#1023) arrumaram o shell: um cabeçalho, um
// flutuante por tela. Esta etapa enxuga o miolo das telas abaixo de
// 768 px. As decisões que não dependem de layout moram aqui, puras e
// testáveis; cada tela só pergunta.
//
// O desktop não passa por nenhuma destas regras.
// ============================================================
import type { PainelData } from "@/services/studioApi";

// ─── Início ─────────────────────────────────────────────────

/** Painel sem movimento nenhum no período: não há o que comparar. */
export function painelZerado(p: PainelData | null | undefined): boolean {
  if (!p) return true;
  const k = p.kpis;
  return !(
    Number(k.vendas_dia.value) ||
    Number(k.ticket_medio.value) ||
    Number(k.lucro_liquido_mes.value) ||
    Number(k.lucro_liquido_mes.receita_mes) ||
    Number(k.lucro_liquido_mes.despesa_mes) ||
    Number(p.faturamento_total)
  );
}

/** O gráfico de faturamento só vale o cartão quando há valor para desenhar. */
export function faturamentoVazio(p: PainelData | null | undefined): boolean {
  const serie = p?.faturamento_serie || [];
  return serie.length === 0 || serie.every((pt) => !Number(pt.value));
}

// ─── Catálogo ───────────────────────────────────────────────

export type FiltroDeTipo = "all" | "personalizable" | "nonpersonalizable";

export const ROTULO_DO_TIPO: Record<FiltroDeTipo, string> = {
  all: "Todos",
  personalizable: "Personalizáveis",
  nonpersonalizable: "Não personalizáveis",
};

/** Os filtros ligados, na ordem em que aparecem na folha. Vazio = sem filtro. */
export function filtrosAtivos(tipo: FiltroDeTipo, categoria: string | null): string[] {
  const ativos: string[] = [];
  if (tipo !== "all") ativos.push(ROTULO_DO_TIPO[tipo]);
  if (categoria) ativos.push(categoria);
  return ativos;
}

/** O selo "Personalizável" só informa quando separa uma linha da outra:
 *  filtro em "Todos" e catálogo com os dois tipos. Com o filtro ligado, ou
 *  com o catálogo inteiro de um tipo só, ele repete o mesmo selo em toda
 *  linha. */
export function mostrarSeloPersonalizavel(
  tipo: FiltroDeTipo,
  produtos: Array<{ is_personalizable?: boolean }>,
): boolean {
  if (tipo !== "all") return false;
  const com = produtos.some((p) => !!p.is_personalizable);
  const sem = produtos.some((p) => !p.is_personalizable);
  return com && sem;
}

// ─── Pedidos ────────────────────────────────────────────────

type Gravidade = "info" | "warning" | "danger";
const PESO: Record<Gravidade, number> = { info: 0, warning: 1, danger: 2 };

/** A linha recolhida dos alertas: quantos são e a gravidade mais alta. */
export function resumoDosAlertas(
  alertas: Array<{ severity: Gravidade }>,
): { rotulo: string; gravidade: Gravidade } | null {
  if (!alertas.length) return null;
  const gravidade = alertas.reduce<Gravidade>(
    (maior, a) => (PESO[a.severity] > PESO[maior] ? a.severity : maior),
    "info",
  );
  return { rotulo: alertas.length === 1 ? "1 alerta" : `${alertas.length} alertas`, gravidade };
}
