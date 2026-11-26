// ============================================================
// AURA. — Personalizados: regras da Fila de produção (p-129)
//
// A Fila de produção do shell Negócio (/personalizados/producao). Lê a mesma
// rota do quadro do Studio (GET /companies/:id/studio/orders, sobre a view
// studio_orders) e grava pela mesma rota (PATCH production-status). Aqui
// ficam só as regras, sem tela.
//
// Desenho: mockup p-131, aprovado em 16/11/2026.
//   - cinco etapas no quadro: Aguardando personalização, Aguardando arte,
//     Aprovado, Em produção e Pronto. Entregue e cancelado saem da Fila;
//   - sem arrastar: o cartão anda pelo botão, sempre visível;
//   - no celular, uma etapa por vez;
//   - cabeçalho com pedidos ativos, atrasados e quanto falta receber.
// ============================================================
import type { StudioOrder, StudioProductionStatus } from "@/services/studioApi";
import type { StudioIntent } from "@/constants/studio-semantic";
import { diasAtePrazo } from "@/components/studio/fluxoDoQuadro";
import { rotuloDeItens } from "@/components/studio/rotuloDeItens";
import { faltaReceberDoOrcamento } from "@/components/personalizados/regrasDoReceber";

export type Etapa = {
  key: StudioProductionStatus;
  label: string;
  /** Rótulo curto para o seletor de etapa do celular. */
  curto: string;
  intent: StudioIntent;
  /** Texto do botão que leva o cartão para a próxima etapa. */
  avancar: string;
};

/** As etapas do quadro, na ordem do mockup. */
export const ETAPAS: Etapa[] = [
  { key: "awaiting_customization", label: "Aguardando personalização", curto: "Personalização", intent: "waiting",    avancar: "Enviar para a arte" },
  { key: "pending_art",            label: "Aguardando arte",           curto: "Arte",           intent: "art",        avancar: "Marcar como aprovado" },
  { key: "approved",               label: "Aprovado",                  curto: "Aprovado",       intent: "approved",   avancar: "Iniciar produção" },
  { key: "in_production",          label: "Em produção",               curto: "Produção",       intent: "production", avancar: "Marcar como pronto" },
  { key: "ready",                  label: "Pronto",                    curto: "Pronto",         intent: "ready",      avancar: "Marcar como entregue" },
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

// ── Voltar uma etapa (25/11/2026) ────────────────────────────────────────
//
// Na fusão o arrasto do Studio saiu e nada entrou no lugar: o cartão só
// andava para a frente. O "Voltar para …" devolve o pedido UMA etapa, pela
// mesma rota do avançar (PATCH production-status, que aceita qualquer etapa
// válida).
//
// O mapa é o inverso do PROXIMA_ETAPA dentro das cinco etapas do quadro:
//   - a primeira (Aguardando personalização) não tem anterior;
//   - Entregue e Cancelado são saídas da Fila, não etapas do quadro: não
//     voltam por aqui (null). O cartão deles não está na Fila, e o
//     cancelado da loja online o backend nem aceita de volta;
//   - não há etapa paralela no mapa: o caminho é uma linha só.
//
// Pedido de marketplace com a arte já recolhida não volta para "Aguardando
// personalização": o backend recusa e a tela mostra a mensagem dele.
export const ETAPA_ANTERIOR: Record<StudioProductionStatus, StudioProductionStatus | null> = {
  awaiting_customization: null,
  pending_art: "awaiting_customization",
  approved: "pending_art",
  in_production: "approved",
  ready: "in_production",
  delivered: null,
  cancelled: null,
};

/** Sair de "Em produção" ou de "Pronto" pede confirmação; das outras, volta direto. */
const VOLTAR_PEDE_CONFIRMACAO = new Set<string>(["in_production", "ready"]);

export function voltarPedeConfirmacao(atual: string | null | undefined): boolean {
  return !!atual && VOLTAR_PEDE_CONFIRMACAO.has(atual);
}

/** A etapa de antes, com o rótulo da coluna. null na primeira e nas saídas. */
export function etapaAnterior(atual: string | null | undefined): Etapa | null {
  const k = atual ? ETAPA_ANTERIOR[atual as StudioProductionStatus] : null;
  return k ? ETAPAS.find((e) => e.key === k) || null : null;
}

/** "Voltar para Aprovado" */
export const textoDoVoltar = (anterior: Pick<Etapa, "label">) => `Voltar para ${anterior.label}`;

/** "Voltar este pedido para Aprovado?" */
export const perguntaDoVoltar = (anterior: Pick<Etapa, "label">) => `Voltar este pedido para ${anterior.label}?`;

// ── Arrastar o cartão entre colunas (web) ───────────────────────────────
//
// O arraste faz o que os botões fazem, e nada mais:
//   - mesma coluna: nada;
//   - a coluna seguinte: o "avançar" do cartão;
//   - duas ou mais colunas adiante: "pular", não faz nada (não se pula a etapa
//     da arte; o botão também só anda uma de cada vez);
//   - coluna de trás: o "voltar", com a MESMA pergunta de sempre (sair de
//     "Em produção" ou de "Pronto" confirma; das outras, volta direto).
export type DecisaoDoSolta =
  | { acao: "nada" }
  | { acao: "avancar" }
  | { acao: "pular" }
  | { acao: "mover"; destino: StudioProductionStatus }
  | { acao: "confirmar-voltar"; destino: Etapa };

export function decidirSolta(atual: StudioProductionStatus, destino: string | null | undefined): DecisaoDoSolta {
  const de = ETAPAS.findIndex((e) => e.key === atual);
  const para = ETAPAS.findIndex((e) => e.key === destino);
  if (de < 0 || para < 0 || de === para) return { acao: "nada" };
  if (para > de) return para === de + 1 ? { acao: "avancar" } : { acao: "pular" };
  return voltarPedeConfirmacao(atual)
    ? { acao: "confirmar-voltar", destino: ETAPAS[para] }
    : { acao: "mover", destino: ETAPAS[para].key };
}

const DO_QUADRO = new Set<string>(ETAPAS.map((e) => e.key));

export function etapaDe(o: Pick<StudioOrder, "studio_production_status">): StudioProductionStatus {
  return (o.studio_production_status || "pending_art") as StudioProductionStatus;
}

/** Pedido ativo = está numa das cinco etapas do quadro. */
export function ehAtivo(o: Pick<StudioOrder, "studio_production_status">): boolean {
  return DO_QUADRO.has(etapaDe(o));
}

export type PorEtapa = Record<string, StudioOrder[]>;

/** Agrupa só os pedidos ativos. Entregue, cancelado e etapa desconhecida ficam fora. */
export function agruparPorEtapa(pedidos: StudioOrder[]): PorEtapa {
  const grupos: PorEtapa = {};
  for (const e of ETAPAS) grupos[e.key] = [];
  for (const o of pedidos) {
    const k = etapaDe(o);
    if (grupos[k]) grupos[k].push(o);
  }
  return grupos;
}

/**
 * A etapa que o celular abre: a primeira com pedido. Sem pedido nenhum,
 * "Aguardando arte" (é onde o próximo pedido vai chegar).
 */
export function etapaInicialNoCelular(grupos: PorEtapa): StudioProductionStatus {
  const comPedido = ETAPAS.find((e) => grupos[e.key].length > 0);
  return comPedido ? comPedido.key : "pending_art";
}

// ── Cabeçalho ────────────────────────────────────────────────────────────

export type ResumoDaFila = { ativos: number; atrasados: number; aReceber: number };

export function resumoDaFila(pedidos: StudioOrder[]): ResumoDaFila {
  let ativos = 0;
  let atrasados = 0;
  let aReceber = 0;
  for (const o of pedidos) {
    if (!ehAtivo(o)) continue;
    ativos += 1;
    const dias = diasAtePrazo(o.promised_date);
    if (dias !== null && dias < 0) atrasados += 1;
    // Pedido de orçamento: o "Falta receber" do detalhe (sinal e saldo juntos).
    // Os outros: o saldo da encomenda do Caixa. Uma fonte por pedido, sem somar duas vezes.
    const faltaOrcamento = faltaReceberDoOrcamento(o);
    if (faltaOrcamento !== null) { aReceber += faltaOrcamento; continue; }
    const saldo = Number(o.balance_amount);
    if (o.balance_amount != null && Number.isFinite(saldo) && saldo > 0) aReceber += saldo;
  }
  return { ativos, atrasados, aReceber: Math.round(aReceber * 100) / 100 };
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** "12 pedidos ativos · 2 atrasados · R$ 1.980,00 a receber" */
export function fraseDoResumo(r: ResumoDaFila, reais: (v: number) => string): string {
  if (r.ativos === 0) return "Nenhum pedido ativo";
  const partes = [`${r.ativos} ${plural(r.ativos, "pedido ativo", "pedidos ativos")}`];
  if (r.atrasados > 0) partes.push(`${r.atrasados} ${plural(r.atrasados, "atrasado", "atrasados")}`);
  if (r.aReceber > 0) partes.push(`${reais(r.aReceber)} a receber`);
  return partes.join(" · ");
}

// ── Nome no cartão ───────────────────────────────────────────────────────

/**
 * O nome do cartão. `display_name` é o número do pedido (PDV-dd6d2358), que o
 * cartão já mostra em cima: repetir o número no lugar do nome não diz nada.
 * Sem cliente, a venda do Caixa é "Venda no Caixa"; os outros, "Sem cadastro".
 */
export function nomeDoCliente(o: Pick<StudioOrder, "customer_name" | "source">): string {
  const nome = typeof o.customer_name === "string" ? o.customer_name.trim() : "";
  if (nome) return nome;
  return o.source === "pdv" ? "Venda no Caixa" : "Sem cadastro";
}

// ── Origem do pedido ─────────────────────────────────────────────────────

/**
 * De onde o pedido veio, para o selo do cartão. 17/11/2026 (p-176): o
 * backend#1051 manda `origin_label` ("Orçamento", "Caixa", "Loja online",
 * "Pedido em lote", a plataforma). Ele manda; sem ele (backend de antes),
 * a conta pela `source`, como no p-129.
 */
export function origemDoPedido(o: Pick<StudioOrder, "source" | "marketplace_platform" | "origin_label">): string | null {
  const rotulo = typeof o.origin_label === "string" ? o.origin_label.trim() : "";
  if (rotulo) return rotulo;
  if (o.source === "pdv") return "Caixa";
  if (o.source === "digital") return "Loja online";
  if (o.source === "marketplace") {
    if (o.marketplace_platform === "mercado_livre") return "Mercado Livre";
    if (o.marketplace_platform === "shopee") return "Shopee";
    return "Marketplace";
  }
  return null;
}

// ── O item no cartão (p-176) ─────────────────────────────────────────────

/**
 * "2 × Caneca com nome · R$ 96,00", como no mockup. Com mais de uma linha no
 * pedido, "+ 1 item". Sem `item_name` (backend de antes do #1051), a
 * contagem de itens do p-129.
 */
export function itemDoCartao(
  o: Pick<StudioOrder, "item_name" | "item_quantity" | "item_count">,
): string {
  const nome = typeof o.item_name === "string" ? o.item_name.trim() : "";
  if (!nome) return rotuloDeItens(o.item_count);
  const q = Number(o.item_quantity);
  const qtd = Number.isFinite(q) && q > 0 ? `${Number.isInteger(q) ? q : String(q).replace(".", ",")} × ` : "";
  const linhas = Math.round(Number(o.item_count) || 0);
  const resto = linhas > 1 ? ` + ${rotuloDeItens(linhas - 1)}` : "";
  return `${qtd}${nome}${resto}`;
}

// ── Saíram da Fila: entregues e cancelados (p-176) ──────────────────────

export type Saidos = { delivered: StudioOrder[]; cancelled: StudioOrder[] };

/** Os pedidos que saíram da Fila, do mais novo para o mais antigo. */
export function saidosDaFila(pedidos: StudioOrder[]): Saidos {
  const saidos: Saidos = { delivered: [], cancelled: [] };
  for (const o of pedidos) {
    const k = etapaDe(o);
    if (k === "delivered" || k === "cancelled") saidos[k].push(o);
  }
  const maisNovo = (a: StudioOrder, b: StudioOrder) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
  saidos.delivered.sort(maisNovo);
  saidos.cancelled.sort(maisNovo);
  return saidos;
}

// ── Corte pela data de ativação ──────────────────────────────────────────
//
// O trigger trg_sales_studio_status marca studio_production_status =
// 'pending_art' em QUALQUER venda do Caixa com produto personalizável, em
// qualquer empresa, com a frente ligada ou não. Uma loja que já vendia
// personalizável pelo Caixa e liga a frente abriria a Fila com meses de
// vendas antigas paradas em "Aguardando arte", todas já entregues na vida
// real. O mockup: "Pedidos antigos de antes de ligar a frente não entram na
// Fila."
//
// Regra: sai da Fila o pedido que é do Caixa (source 'pdv'), está em
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

/**
 * O prazo vem da data prometida, com o texto do mockup ("Atrasou 1 dia",
 * "Entrega hoje", "Entrega em 6 dias"). Sem data combinada, a idade do
 * pedido.
 */
export function prazoDoCartao(
  o: Pick<StudioOrder, "created_at"> & { promised_date?: string | null },
  agora: number = Date.now(),
): { texto: string; tom: TomDoPrazo } {
  const dias = diasAtePrazo(o.promised_date);
  if (dias !== null && o.promised_date) {
    if (dias < 0) return { texto: `Atrasou ${Math.abs(dias)} ${plural(Math.abs(dias), "dia", "dias")}`, tom: "atrasado" };
    if (dias === 0) return { texto: "Entrega hoje", tom: "atencao" };
    if (dias === 1) return { texto: "Entrega amanhã", tom: "atencao" };
    return { texto: `Entrega em ${dias} dias`, tom: dias <= 3 ? "atencao" : "tranquilo" };
  }
  const horas = (agora - Date.parse(o.created_at)) / 3600000;
  if (!Number.isFinite(horas) || horas < 24) return { texto: "Chegou hoje", tom: "tranquilo" };
  const d = Math.round(horas / 24);
  return { texto: `Há ${d} ${plural(d, "dia", "dias")}`, tom: horas < 72 ? "tranquilo" : "atencao" };
}

/** Largura abaixo da qual o quadro mostra uma etapa por vez. */
export const LARGURA_DO_CELULAR = 768;
