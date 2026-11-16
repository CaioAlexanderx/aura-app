// ============================================================
// AURA. — Personalizados: regras do quadro de Produção (p-129)
//
// O quadro de Produção do shell Negócio (/personalizados/producao). Lê a
// mesma rota do quadro do Studio (GET /companies/:id/studio/orders, sobre a
// view studio_orders) e grava pela mesma rota (PATCH production-status).
// Aqui ficam só as regras, sem tela: etapas, próxima etapa, agrupamento, o
// corte pela data de ativação e a etapa que o celular abre.
//
// Diferenças de propósito para o quadro do Studio:
//   - sem arrastar: no Negócio o cartão anda por botão, sempre visível;
//   - no celular, uma etapa por vez;
//   - "Aguardando personalização" (pedido de marketplace) e "Cancelados" só
//     aparecem quando têm pedido. Loja sem marketplace não vê coluna vazia.
// ============================================================
import type { StudioOrder, StudioProductionStatus } from "@/services/studioApi";
import type { StudioIntent } from "@/constants/studio-semantic";
import { diasAtePrazo } from "@/components/studio/fluxoDoQuadro";

export type Etapa = {
  key: StudioProductionStatus;
  label: string;
  /** Rótulo curto para o seletor de etapa do celular. */
  curto: string;
  icon: string;
  intent: StudioIntent;
  /** Texto do botão que leva o cartão para a próxima etapa ("" = fim). */
  avancar: string;
};

export const ETAPAS: Etapa[] = [
  { key: "awaiting_customization", label: "Aguardando personalização", curto: "Personalização", icon: "message-circle", intent: "waiting",    avancar: "Enviar para a arte" },
  { key: "pending_art",            label: "Aguardando arte",           curto: "Arte",           icon: "alert-circle",   intent: "art",        avancar: "Marcar como aprovado" },
  { key: "approved",               label: "Aprovado",                  curto: "Aprovado",       icon: "check",          intent: "approved",   avancar: "Iniciar produção" },
  { key: "in_production",          label: "Em produção",               curto: "Produção",       icon: "clock",          intent: "production", avancar: "Marcar como pronto" },
  { key: "ready",                  label: "Pronto",                    curto: "Pronto",         icon: "package",        intent: "ready",      avancar: "Marcar como entregue" },
  { key: "delivered",              label: "Entregue",                  curto: "Entregue",       icon: "check-circle",   intent: "delivered",  avancar: "" },
  { key: "cancelled",              label: "Cancelados",                curto: "Cancelados",     icon: "x-circle",       intent: "danger",     avancar: "" },
];

export const PROXIMA_ETAPA: Record<StudioProductionStatus, StudioProductionStatus | null> = {
  awaiting_customization: "pending_art",
  pending_art: "approved",
  approved: "in_production",
  in_production: "ready",
  ready: "delivered",
  delivered: null,
  cancelled: null,
};

/** Etapas que só entram no quadro quando têm pedido. */
const SO_COM_PEDIDO: ReadonlySet<StudioProductionStatus> = new Set<StudioProductionStatus>([
  "awaiting_customization",
  "cancelled",
]);

/** Etapas que contam como trabalho em aberto. */
const EM_ABERTO: StudioProductionStatus[] = ["awaiting_customization", "pending_art", "approved", "in_production", "ready"];

export function etapaDe(o: Pick<StudioOrder, "studio_production_status">): StudioProductionStatus {
  return (o.studio_production_status || "pending_art") as StudioProductionStatus;
}

export type PorEtapa = Record<StudioProductionStatus, StudioOrder[]>;

export function agruparPorEtapa(pedidos: StudioOrder[]): PorEtapa {
  const grupos = {} as PorEtapa;
  for (const e of ETAPAS) grupos[e.key] = [];
  for (const o of pedidos) {
    const k = etapaDe(o);
    if (grupos[k]) grupos[k].push(o);
  }
  return grupos;
}

export function etapasVisiveis(grupos: PorEtapa): Etapa[] {
  return ETAPAS.filter((e) => !SO_COM_PEDIDO.has(e.key) || grupos[e.key].length > 0);
}

export function emAberto(grupos: PorEtapa): number {
  return EM_ABERTO.reduce((soma, k) => soma + grupos[k].length, 0);
}

/**
 * A etapa que o celular abre: a primeira com trabalho em aberto. Sem nada
 * em aberto, "Aguardando arte" (é onde o próximo pedido vai chegar).
 */
export function etapaInicialNoCelular(grupos: PorEtapa): StudioProductionStatus {
  const comPedido = EM_ABERTO.find((k) => grupos[k].length > 0);
  return comPedido || "pending_art";
}

// ── Corte pela data de ativação ──────────────────────────────────────────
//
// O trigger trg_sales_studio_status marca studio_production_status =
// 'pending_art' em QUALQUER venda do Caixa com produto personalizável, em
// qualquer empresa, com a frente ligada ou não. Uma loja que já vendia
// personalizável pelo Caixa e liga a frente abriria o quadro com meses de
// vendas antigas paradas em "Aguardando arte", todas já entregues na vida
// real.
//
// Regra: sai do quadro o pedido que é do Caixa (source 'pdv'), está em
// "Aguardando arte" e foi criado ANTES da ativação. Fica tudo o que alguém
// já moveu de etapa (prova de que é trabalho de verdade), tudo o que veio da
// loja online ou de marketplace, e tudo o que foi criado depois.
//
// A data vem de pdv_settings.personalizados_ativado_em (ISO). O backend
// ainda NÃO grava essa chave: enquanto ela não existir, o corte não esconde
// nada. Esconder sem data certa poderia tirar pedido de verdade da frente
// da lojista, e isso é pior do que mostrar pedido antigo.

export function dataDeAtivacao(settings: unknown): string | null {
  const bruto = settings && typeof settings === "object"
    ? (settings as Record<string, unknown>).personalizados_ativado_em
    : null;
  if (typeof bruto !== "string" || !bruto) return null;
  return Number.isNaN(Date.parse(bruto)) ? null : bruto;
}

export function ehAntigoDaAtivacao(o: StudioOrder, ativadoEm: string | null): boolean {
  if (!ativadoEm) return false;
  if (o.source !== "pdv") return false;
  if (etapaDe(o) !== "pending_art") return false;
  const criado = Date.parse(o.created_at);
  const corte = Date.parse(ativadoEm);
  if (Number.isNaN(criado) || Number.isNaN(corte)) return false;
  return criado < corte;
}

export function semAntigosDaAtivacao(pedidos: StudioOrder[], ativadoEm: string | null): StudioOrder[] {
  if (!ativadoEm) return pedidos;
  return pedidos.filter((o) => !ehAntigoDaAtivacao(o, ativadoEm));
}

// ── Prazo no cartão ──────────────────────────────────────────────────────

export type TomDoPrazo = "tranquilo" | "atencao" | "atrasado";

function diaEMes(iso: string): string {
  const [, m, d] = String(iso).slice(0, 10).split("-");
  return d && m ? `${d}/${m}` : String(iso);
}

/**
 * O prazo vem da data prometida. Sem data combinada, cai na idade do pedido.
 * Mesma leitura do quadro do Studio (app/studio/(estudio)/producao.tsx).
 */
export function prazoDoCartao(
  o: Pick<StudioOrder, "created_at"> & { promised_date?: string | null },
  agora: number = Date.now(),
): { texto: string; tom: TomDoPrazo } {
  const dias = diasAtePrazo(o.promised_date);
  if (dias !== null && o.promised_date) {
    if (dias < 0) return { texto: `atrasou ${Math.abs(dias)}d`, tom: "atrasado" };
    if (dias === 0) return { texto: "entrega hoje", tom: "atrasado" };
    if (dias === 1) return { texto: "entrega amanhã", tom: "atencao" };
    return { texto: `entrega ${diaEMes(o.promised_date)}`, tom: dias <= 3 ? "atencao" : "tranquilo" };
  }
  const horas = (agora - Date.parse(o.created_at)) / 3600000;
  if (!Number.isFinite(horas) || horas < 0) return { texto: "agora", tom: "tranquilo" };
  if (horas < 24) return { texto: `há ${Math.round(horas)}h`, tom: "tranquilo" };
  const d = Math.round(horas / 24);
  return { texto: `há ${d}d`, tom: horas < 72 ? "atencao" : "atrasado" };
}

/** Largura abaixo da qual o quadro mostra uma etapa por vez. */
export const LARGURA_DO_CELULAR = 768;
