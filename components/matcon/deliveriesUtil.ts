// ============================================================
// AURA. — Matcon (materiais de construção): a esteira de entregas (M1)
//
// 22/09/2026. Funções puras, sem React — mesmo desenho de
// components/matcon/quotesUtil.ts (que a esteira de Orçamentos usa):
// data pura (`scheduled_for`, "YYYY-MM-DD") nunca passa por
// `new Date(iso)` direto, porque em UTC-3 isso vira a véspera. O teste
// (__tests__/matconDeliveriesUtil.test.ts) roda em America/Sao_Paulo, o
// mesmo fuso do jest.config.
//
// O dono lê a esteira de manhã pra saber "quanto material tá parado
// esperando caminhão" e "quem já recebeu tudo" — por isso:
//   1. `agruparPorDia` ordena do mais atrasado pro mais futuro: quem já
//      devia ter saído ontem aparece antes de "hoje", que aparece antes
//      de "amanhã" (docs/matcon-faseamento-po-ux.md §3/M1).
//   2. O progresso do item é sobre o que já foi CONFIRMADO entregue, não
//      sobre o que saiu no caminhão — uma entrega em rota ("saiu") só
//      conta como entregue quando alguém aperta "marcar como entregue"
//      (ou faz a entrega parcial, que fecha a entrega atual e cria a
//      próxima com o saldo).
// ============================================================
import type { Delivery, DeliveryItem, DeliveryStage } from "@/services/matconApi";
import { fmtQty } from "@/utils/matconUnits";

function round3(n: number): number {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

/** Meia-noite local da data pura "YYYY-MM-DD". null se a string não presta. */
function meiaNoiteLocal(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  var partes = String(iso).slice(0, 10).split("-");
  var y = Number(partes[0]), m = Number(partes[1]), d = Number(partes[2]);
  if (!y || !m || !d) return null;
  var dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Dias inteiros até a data agendada, contando de meia-noite a meia-noite:
 * 0 = hoje, 1 = amanhã, negativo = atrasada. `agora` existe para o teste;
 * em produção ninguém passa.
 */
export function diasAteData(scheduledFor: string | null | undefined, agora?: Date): number | null {
  var alvo = meiaNoiteLocal(scheduledFor);
  if (!alvo) return null;
  var hoje = agora ? new Date(agora.getTime()) : new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

/** "2026-09-23" -> "23/09". Data pura: sem new Date(iso) para não virar a véspera. */
export function fmtDiaMes(iso: string | null | undefined): string {
  if (!iso) return "";
  var p = String(iso).slice(0, 10).split("-");
  return p[0] && p[1] && p[2] ? p[2] + "/" + p[1] : "";
}

var DIAS_SEMANA = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];

/** Dia da semana em caixa alta, em português — a partir da data pura local. */
function diaDaSemana(iso: string | null | undefined): string {
  var dt = meiaNoiteLocal(iso);
  return dt ? DIAS_SEMANA[dt.getDay()] : "";
}

/**
 * O rótulo do grupo do dia, do jeito que a esteira lê em voz alta:
 *   "HOJE · TERÇA, 22/09" · "AMANHÃ · QUARTA, 23/09" · "SEXTA, 25/09"
 *   "ATRASADA · SEGUNDA, 21/09"
 */
export function rotuloDia(scheduledFor: string | null | undefined, agora?: Date): string {
  var d = diasAteData(scheduledFor, agora);
  if (d === null) return "";
  var linha = diaDaSemana(scheduledFor) + ", " + fmtDiaMes(scheduledFor);
  if (d < 0) return "ATRASADA · " + linha;
  if (d === 0) return "HOJE · " + linha;
  if (d === 1) return "AMANHÃ · " + linha;
  return linha;
}

export type GrupoDeEntregas = {
  diaISO: string;
  rotulo: string;
  entregas: Delivery[];
};

/**
 * Agrupa as entregas por `scheduled_for`, em ordem: mais atrasada primeiro,
 * depois hoje, depois os dias futuros — quem abre a tela de manhã lê o que
 * precisa de atenção antes do que ainda tem tempo. Dentro do grupo, mantém
 * a ordem em que a API devolveu (mais recente/mais prioritária primeiro,
 * decisão do backend).
 */
export function agruparPorDia(deliveries: Delivery[], agora?: Date): GrupoDeEntregas[] {
  var grupos: Record<string, Delivery[]> = {};
  var ordemDias: string[] = [];

  (deliveries || []).forEach(function (d) {
    var dia = String(d.scheduled_for || "").slice(0, 10);
    if (!dia) return;
    if (!grupos[dia]) {
      grupos[dia] = [];
      ordemDias.push(dia);
    }
    grupos[dia].push(d);
  });

  ordemDias.sort(function (a, b) {
    var da = diasAteData(a, agora);
    var db = diasAteData(b, agora);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });

  return ordemDias.map(function (dia) {
    return { diaISO: dia, rotulo: rotuloDia(dia, agora), entregas: grupos[dia] };
  });
}

/**
 * Quantas entregas ainda não entregues estão marcadas para DEPOIS de hoje
 * (amanhã em diante). É o número que o estado vazio de "Hoje" mostra —
 * "Há 1 entrega marcada para os próximos dias" — para a entrega nova, que
 * nasce para daqui a 2 dias, não parecer perdida (QA 23/09/2026).
 */
export function contarProximosDias(deliveries: Delivery[], agora?: Date): number {
  return (deliveries || []).filter(function (d) {
    if (d.stage === "delivered") return false;
    var dias = diasAteData(d.scheduled_for, agora);
    return dias !== null && dias > 0;
  }).length;
}

export type ProgressoItem = {
  entregue: number;
  total: number;
  saldo: number;
  completo: boolean;
};

/**
 * Quanto do item já foi confirmado entregue. Enquanto a entrega está
 * "saiu" (em rota), o caminhão ainda pode voltar sem descarregar tudo —
 * só quando `stage === "delivered"` a quantidade DESTA entrega
 * (`quantity`) soma ao que já tinha sido confirmado antes
 * (`delivered_before`).
 */
export function progressoDoItem(item: DeliveryItem, stage: DeliveryStage): ProgressoItem {
  var total = round3(item.sold_quantity);
  var entregue = round3(stage === "delivered" ? item.delivered_before + item.quantity : item.delivered_before);
  var saldo = round3(Math.max(0, total - entregue));
  return { entregue: entregue, total: total, saldo: saldo, completo: saldo <= 0 };
}

/** "6 de 10 sc" — o que o vendedor lê na linha do item. */
export function rotuloProgresso(item: DeliveryItem, stage: DeliveryStage): string {
  var p = progressoDoItem(item, stage);
  var unidade = item.unit ? " " + item.unit : "";
  return fmtQty(p.entregue) + " de " + fmtQty(p.total) + unidade;
}

/** "SALDO 4 SC" — só quando ainda falta. null quando o item está completo. */
export function seloSaldo(item: DeliveryItem, stage: DeliveryStage): string | null {
  var p = progressoDoItem(item, stage);
  if (p.completo) return null;
  var unidade = item.unit ? " " + String(item.unit).toUpperCase() : "";
  return "SALDO " + fmtQty(p.saldo) + unidade;
}

export type ProximaEtapa = { stage: DeliveryStage; label: string } | null;

/** O botão principal do card, por estação — null quando já entregou. */
export function proximaEtapa(stage: DeliveryStage): ProximaEtapa {
  if (stage === "separating") return { stage: "ready", label: "Marcar pronto" };
  if (stage === "ready") return { stage: "out", label: "Saiu para entrega" };
  if (stage === "out") return { stage: "delivered", label: "Marcar como entregue" };
  return null;
}

/** Horário local (America/Sao_Paulo) de um timestamp do servidor. "" se ausente/ruim. */
function fmtHora(iso: string | null | undefined): string {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

/** O selo de estação do card: "SEPARANDO", "PRONTO", "SAIU 13:40", "ENTREGUE 16:05". */
export function seloEstacao(delivery: Delivery): string {
  if (delivery.stage === "separating") return "SEPARANDO";
  if (delivery.stage === "ready") return "PRONTO";
  if (delivery.stage === "out") {
    var horaSaida = fmtHora(delivery.out_at);
    return horaSaida ? "SAIU " + horaSaida : "SAIU";
  }
  var horaEntrega = fmtHora(delivery.delivered_at);
  return horaEntrega ? "ENTREGUE " + horaEntrega : "ENTREGUE";
}
