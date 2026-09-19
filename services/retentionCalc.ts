// ============================================================
// retentionCalc — retenção calculada no front, a partir da lista de
// clientes que a tela já carrega (useCustomers). Fase 1 (C1.8).
//
// Por que no front, sem endpoint novo: a lista de clientes já traz
// primeira compra (firstVisit), última compra (lastPurchase) e total de
// compras (visits) por cliente — dá para montar recompra, o comparativo
// novos×retornando e a distribuição pela régua sem chamada nova.
//
// O que a lista NÃO traz: a data de CADA compra intermediária, só a
// primeira e a última. Onde isso importa, a função documenta a
// aproximação — em geral, "a última compra caiu dentro da janela" é
// usado como um proxy de "houve recompra dentro da janela": exato para
// quem tem 2 compras, limite superior (pode estar contando cedo demais)
// para quem tem 3+.
//
// Fonte única de faixas: reaproveita diasSemComprar.ts — a mesma régua
// da lista, da tag "Inativo" e do motor de reativação. Nenhum limiar é
// redefinido aqui.
//
// Módulo de cálculo puro: nada de rede, nada de React — mesma disciplina
// de diasSemComprar.ts, o que mantém o teste unitário rápido e sem mock.
// ============================================================
import type { Customer } from "@/components/screens/clientes/types";
import { diasSemComprar, classificarDias, parseDataBR, FAIXAS, type FaixaDias } from "@/components/screens/clientes/diasSemComprar";

const DIA_MS = 864e5;

/** Abaixo disso os indicadores são ruído estatístico, não informação. */
export const BASE_MINIMA = 10;

function tsUltimaCompra(c: Customer): number | null {
  return parseDataBR(c.lastPurchase);
}
function tsPrimeiraCompra(c: Customer): number | null {
  return parseDataBR(c.firstVisit);
}

/** Quantos clientes têm ao menos uma compra registrada (data válida). */
export function contarComCompra(customers: Customer[]): number {
  let n = 0;
  for (const c of customers) if (tsUltimaCompra(c) != null) n += 1;
  return n;
}

export interface RecompraResultado {
  /** Clientes com tempo suficiente (primeira compra há `dias` dias ou
   * mais) para serem avaliados — quem chegou ontem não teve chance de
   * recomprar, e contá-lo como "não recomprou" penalizaria a loja por um
   * cliente que só é novo. */
  elegiveis: number;
  /** Dentre os elegíveis, quantos recompraram dentro da janela. */
  recompraram: number;
  /** `null` sem elegíveis — não dá para tirar percentual de base vazia. */
  percentual: number | null;
}

/**
 * Recompra em X dias.
 *
 * Aproximação (a lista não traz cada compra, só primeira e última): conta
 * como "recomprou em X dias" quem (a) tem 2+ compras no total e (b) a
 * ÚLTIMA compra caiu dentro de X dias da PRIMEIRA. Exato para quem tem
 * exatamente 2 compras; para quem tem 3+ é um limite superior, porque a
 * 2ª compra (a que de fato define a recompra) pode ter vindo depois da
 * janela mesmo a última estando dentro dela.
 */
export function recompraEmDias(
  customers: Customer[],
  dias: number,
  agora: number = Date.now()
): RecompraResultado {
  let elegiveis = 0;
  let recompraram = 0;
  for (const c of customers) {
    const primeira = tsPrimeiraCompra(c);
    if (primeira == null) continue;
    if (agora - primeira < dias * DIA_MS) continue; // sem tempo suficiente ainda
    elegiveis += 1;
    const ultima = tsUltimaCompra(c);
    if ((c.visits || 0) >= 2 && ultima != null && ultima - primeira <= dias * DIA_MS) {
      recompraram += 1;
    }
  }
  return { elegiveis, recompraram, percentual: elegiveis ? (recompraram / elegiveis) * 100 : null };
}

/**
 * Intervalo médio entre compras, em dias.
 *
 * Aproximação: para clientes com 2+ compras, distribui o intervalo entre
 * primeira e última igualmente pelo número de compras (assume espaçamento
 * regular — a lista não traz as datas do meio para calcular o intervalo
 * real). Só entram clientes com datas válidas e última > primeira.
 */
export function intervaloMedioEntreCompras(customers: Customer[]): number | null {
  let somaDias = 0;
  let n = 0;
  for (const c of customers) {
    if ((c.visits || 0) < 2) continue;
    const primeira = tsPrimeiraCompra(c);
    const ultima = tsUltimaCompra(c);
    if (primeira == null || ultima == null || ultima <= primeira) continue;
    const intervalos = c.visits - 1;
    if (intervalos <= 0) continue;
    somaDias += (ultima - primeira) / DIA_MS / intervalos;
    n += 1;
  }
  return n ? somaDias / n : null;
}

function anoMesDe(ts: number): number {
  const d = new Date(ts);
  return d.getFullYear() * 12 + d.getMonth();
}

/**
 * Clientes que voltaram a comprar NESTE mês calendário — 2+ compras no
 * total, última compra neste mês, e a primeira compra NÃO foi neste mês
 * (senão é cliente novo comprando agora, não alguém que "voltou").
 */
export function clientesQueVoltaramNoMes(customers: Customer[], agora: number = Date.now()): number {
  const mesAtual = anoMesDe(agora);
  let n = 0;
  for (const c of customers) {
    if ((c.visits || 0) < 2) continue;
    const primeira = tsPrimeiraCompra(c);
    const ultima = tsUltimaCompra(c);
    if (primeira == null || ultima == null) continue;
    if (anoMesDe(ultima) !== mesAtual) continue;
    if (anoMesDe(primeira) === mesAtual) continue;
    n += 1;
  }
  return n;
}

const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface MesNovoRetornando {
  ano: number;
  /** 0-11 */
  mes: number;
  /** "mar/26" */
  label: string;
  novos: number;
  retornando: number;
}

/**
 * Novos × retornando por mês, últimos `meses` meses (padrão 6), incluindo
 * o mês corrente.
 *
 * "Novo" no mês M = a primeira compra caiu em M. "Retornando" no mês M =
 * cliente com 2+ compras cuja ÚLTIMA compra caiu em M, e M não é o mês da
 * primeira compra dele. Aproximação: cada cliente com 2+ compras só pode
 * contribuir para UM mês de "retornando" (o da última compra) — quem
 * comprou várias vezes ao longo do período não aparece em cada mês em que
 * comprou, só no mais recente, porque a lista não guarda as compras do
 * meio.
 */
export function novosXRetornandoPorMes(
  customers: Customer[],
  meses: number = 6,
  agora: number = Date.now()
): MesNovoRetornando[] {
  const baseAnoMes = anoMesDe(agora);
  const minAnoMes = baseAnoMes - (meses - 1);

  const buckets = new Map<number, MesNovoRetornando>();
  for (let key = minAnoMes; key <= baseAnoMes; key++) {
    const ano = Math.floor(key / 12);
    const mes = ((key % 12) + 12) % 12;
    buckets.set(key, { ano, mes, label: `${MESES_CURTO[mes]}/${String(ano).slice(-2)}`, novos: 0, retornando: 0 });
  }

  for (const c of customers) {
    const primeira = tsPrimeiraCompra(c);
    const primeiraKey = primeira != null ? anoMesDe(primeira) : null;

    if (primeiraKey != null && primeiraKey >= minAnoMes && primeiraKey <= baseAnoMes) {
      buckets.get(primeiraKey)!.novos += 1;
    }

    if ((c.visits || 0) >= 2) {
      const ultima = tsUltimaCompra(c);
      const ultimaKey = ultima != null ? anoMesDe(ultima) : null;
      if (ultimaKey != null && ultimaKey >= minAnoMes && ultimaKey <= baseAnoMes && ultimaKey !== primeiraKey) {
        buckets.get(ultimaKey)!.retornando += 1;
      }
    }
  }

  return Array.from(buckets.values());
}

export interface FaixaDistribuicao {
  key: FaixaDias;
  label: string;
  desc: string;
  count: number;
  total: number;
}

/** Distribuição da base pela régua única (diasSemComprar.ts): quantos
 * clientes e quanto R$ em cada faixa. Quem nunca comprou não entra em
 * faixa nenhuma. */
export function distribuicaoPorFaixa(customers: Customer[], agora: number = Date.now()): FaixaDistribuicao[] {
  const porFaixa = new Map<FaixaDias, FaixaDistribuicao>(
    FAIXAS.map((f) => [f.key, { key: f.key, label: f.label, desc: f.desc, count: 0, total: 0 }])
  );
  for (const c of customers) {
    const dias = diasSemComprar(c.lastPurchase, agora);
    const faixa = classificarDias(dias);
    if (!faixa) continue;
    const entrada = porFaixa.get(faixa)!;
    entrada.count += 1;
    entrada.total += Number(c.totalSpent) || 0;
  }
  return FAIXAS.map((f) => porFaixa.get(f.key)!);
}

export interface RetentionSummary {
  /** % da base (com compra registrada) que NÃO está perdida (61-120
   * também conta como retida — só "perdido" ali é tratado como churn). */
  retention_rate: number;
  /** Complemento de retention_rate: % perdida (121+ dias sem comprar). */
  churn_rate: number;
  /** Clientes com 2+ compras — voltaram ao menos uma vez. */
  returning_customers: number;
  total_customers: number;
  /** Compras por cliente, em média. */
  avg_purchase_frequency: number;
}

/**
 * Resumo equivalente ao card de retenção (retention_rate, churn_rate,
 * returning_customers, avg_purchase_frequency), calculado da lista de
 * clientes em vez do endpoint por empresa — usado no consolidado
 * multi-CNPJ, que não tem endpoint de retenção agregado. `null` com base
 * vazia.
 */
export function computeRetentionSummary(customers: Customer[], agora: number = Date.now()): RetentionSummary | null {
  if (!customers.length) return null;
  let comCompra = 0;
  let perdidos = 0;
  let retornando = 0;
  let somaVisitas = 0;
  for (const c of customers) {
    const dias = diasSemComprar(c.lastPurchase, agora);
    if (dias != null) comCompra += 1;
    if (classificarDias(dias) === "perdido") perdidos += 1;
    if ((c.visits || 0) >= 2) retornando += 1;
    somaVisitas += Number(c.visits) || 0;
  }
  const churn_rate = comCompra ? (perdidos / comCompra) * 100 : 0;
  return {
    retention_rate: 100 - churn_rate,
    churn_rate,
    returning_customers: retornando,
    total_customers: customers.length,
    avg_purchase_frequency: somaVisitas / customers.length,
  };
}
