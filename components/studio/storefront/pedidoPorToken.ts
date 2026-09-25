// ============================================================
// components/studio/storefront/pedidoPorToken.ts
//
// A página do pedido, lida do servidor pelo token (Fase 2, Telas 5, 6 e
// 7 do mockup; contrato B2: GET /storefront/:slug/studio/pedido/:token).
//
// Antes a confirmação era estado na memória da aba (`sentOrder`): um F5
// apagava o pedido da tela, e o status do Pix era fixo — "Aguardando
// produção da arte" antes de o Pix ser pago (SentConfirmation.tsx). Agora
// a mesma URL mostra sempre o mesmo pedido, e a tela MUDA quando o
// pagamento entra: esperando o Pix → aguardando a loja → pagamento
// recebido → a confirmação com a linha do tempo.
//
// Este módulo decide QUAL tela o pedido pede. Puro, com teste; a tela só
// desenha.
// ============================================================

export type EtapaDoPedido = { chave: string; rotulo: string; estado: "feito" | "atual" | "futuro" };

export type PedidoPublico = {
  numero: string | null;
  criado_em: string | null;
  cliente_primeiro_nome: string | null;
  status: string | null;
  payment_status: string | null;
  payment_method: "pix" | "card" | "on_delivery" | string | null;
  subtotal: number;
  desconto_pix: number;
  frete: number;
  total: number;
  entrega: {
    tipo: "pickup" | "delivery" | "courier" | string;
    prazo_texto: string | null;
    retirada_endereco: string | null;
    bairro_cidade: string | null;
    courier_a_informar: boolean;
  };
  itens: Array<{
    nome: string; quantidade: number; preco_unitario: number; total: number;
    imagem_url: string | null; resumo: string[];
  }>;
  pix: { qrcode: string | null; copia_e_cola: string; expira_em: string | null; modo: string | null } | null;
  cartao: { init_point: string } | null;
  comprovante_enviado: boolean;
  etapas: EtapaDoPedido[];
  prazo_dias_uteis: number | null;
  revisoes: { max_included: number; extra_price: number; policy_text: string | null } | null;
  acompanhar_url: string | null;
  loja: { nome: string | null; whatsapp: string | null } | null;
};

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

/** As quatro etapas de sempre, quando o servidor não mandou as dele. */
export const ETAPAS_PADRAO: EtapaDoPedido[] = [
  { chave: "recebido", rotulo: "Pedido recebido", estado: "atual" },
  { chave: "arte", rotulo: "Criando a arte", estado: "futuro" },
  { chave: "producao", rotulo: "Em produção", estado: "futuro" },
  { chave: "pronto", rotulo: "Pronto", estado: "futuro" },
];

/**
 * A resposta do servidor, com tudo que a tela lê garantido. Campo que
 * faltar vira o vazio seguro: a página nunca quebra por dado ausente.
 */
export function lerPedidoPublico(j: any): PedidoPublico | null {
  if (!j || typeof j !== "object" || j.error) return null;
  const e = j.entrega && typeof j.entrega === "object" ? j.entrega : {};
  const pix = j.pix && typeof j.pix === "object" && str(j.pix.copia_e_cola)
    ? { qrcode: str(j.pix.qrcode), copia_e_cola: String(j.pix.copia_e_cola), expira_em: str(j.pix.expira_em), modo: str(j.pix.modo) }
    : null;
  const etapas: EtapaDoPedido[] = Array.isArray(j.etapas) && j.etapas.length
    ? j.etapas
        .filter((x: any) => x && typeof x === "object")
        .map((x: any) => ({
          chave: String(x.chave || ""),
          rotulo: String(x.rotulo || ""),
          estado: x.estado === "feito" || x.estado === "atual" ? x.estado : "futuro",
        }))
    : ETAPAS_PADRAO;
  return {
    numero: j.numero != null ? String(j.numero) : null,
    criado_em: str(j.criado_em),
    cliente_primeiro_nome: str(j.cliente_primeiro_nome),
    status: str(j.status),
    payment_status: str(j.payment_status),
    payment_method: str(j.payment_method),
    subtotal: num(j.subtotal),
    desconto_pix: num(j.desconto_pix),
    frete: num(j.frete),
    total: num(j.total),
    entrega: {
      tipo: str(e.tipo) || "pickup",
      prazo_texto: str(e.prazo_texto),
      retirada_endereco: str(e.retirada_endereco),
      bairro_cidade: str(e.bairro_cidade),
      courier_a_informar: e.courier_a_informar === true,
    },
    itens: Array.isArray(j.itens)
      ? j.itens.map((i: any) => ({
          nome: String(i?.nome || "Peça personalizada"),
          quantidade: Math.max(0, Math.floor(num(i?.quantidade))),
          preco_unitario: num(i?.preco_unitario),
          total: num(i?.total),
          imagem_url: str(i?.imagem_url),
          resumo: Array.isArray(i?.resumo) ? i.resumo.filter((x: any) => typeof x === "string") : [],
        }))
      : [],
    pix,
    cartao: j.cartao && str(j.cartao.init_point) ? { init_point: String(j.cartao.init_point) } : null,
    comprovante_enviado: j.comprovante_enviado === true,
    etapas,
    prazo_dias_uteis: Number.isFinite(Number(j.prazo_dias_uteis)) && Number(j.prazo_dias_uteis) > 0
      ? Math.round(Number(j.prazo_dias_uteis)) : null,
    revisoes: j.revisoes && typeof j.revisoes === "object"
      ? { max_included: num(j.revisoes.max_included), extra_price: num(j.revisoes.extra_price), policy_text: str(j.revisoes.policy_text) }
      : null,
    acompanhar_url: str(j.acompanhar_url),
    loja: j.loja && typeof j.loja === "object" ? { nome: str(j.loja.nome), whatsapp: str(j.loja.whatsapp) } : null,
  };
}

/**
 * Qual tela o pedido pede.
 *
 * - `pix`          Tela 5: esperando o Pix (código, QR, "Já paguei")
 * - `aguardando`   Tela 5, 2º estado: a cliente disse que pagou; a loja confere
 * - `cartao_analise` Tela 6: o cartão voltou "em análise" (ou aprovado e o
 *                  webhook ainda não chegou)
 * - `cartao_recusado` Tela 6: o cartão não foi aprovado
 * - `cartao_pendente` pagamento no cartão ainda não feito (sem volta do MP)
 * - `confirmado`   Tela 7: pago, ou "pagar na retirada" (pedido firme)
 * - `cancelado`    o Pix venceu, ou a loja cancelou
 */
export type SituacaoDoPedido =
  | "pix" | "aguardando" | "cartao_analise" | "cartao_recusado" | "cartao_pendente"
  | "confirmado" | "cancelado";

export function estaPago(p: Pick<PedidoPublico, "status" | "payment_status"> | null | undefined): boolean {
  if (!p) return false;
  const ps = String(p.payment_status || "").toLowerCase();
  if (ps === "paid" || ps === "confirmed" || ps === "received" || ps === "approved") return true;
  return ["confirmed", "preparing", "ready", "delivered", "in_production", "completed"].includes(String(p.status || ""));
}

export function situacaoDoPedido(
  p: PedidoPublico,
  retorno?: "approved" | "pending" | "failed" | null,
): SituacaoDoPedido {
  if (p.status === "cancelled" || String(p.payment_status || "").toLowerCase() === "expired") return "cancelado";
  if (p.payment_method === "on_delivery") return "confirmado";
  if (estaPago(p)) return "confirmado";
  if (p.status === "awaiting_approval") return "aguardando";
  if (p.payment_method === "card") {
    if (retorno === "failed" || String(p.payment_status || "").toLowerCase() === "rejected") return "cartao_recusado";
    if (retorno === "approved" || retorno === "pending") return "cartao_analise";
    return "cartao_pendente";
  }
  if (p.payment_method === "pix") return p.pix ? "pix" : "aguardando";
  return "confirmado";
}

/** A tela ainda espera alguma coisa do servidor? (consulta a cada 4 s) */
export function deveConsultar(s: SituacaoDoPedido): boolean {
  return s === "pix" || s === "aguardando" || s === "cartao_analise";
}

/** Intervalo da consulta, como pix.js da Negócio. */
export const INTERVALO_DA_CONSULTA_MS = 4000;

const p2 = (n: number) => String(n).padStart(2, "0");

/** "28/09 às 14:32", no fuso de quem lê. Vazio sem data válida. */
export function diaEHora(iso: string | null | undefined): string {
  const t = iso ? new Date(iso) : null;
  if (!t || !Number.isFinite(t.getTime())) return "";
  return `${p2(t.getDate())}/${p2(t.getMonth() + 1)} às ${p2(t.getHours())}:${p2(t.getMinutes())}`;
}

/** "25/09/2026". */
export function dataCompleta(iso: string | null | undefined): string {
  const t = iso ? new Date(iso) : null;
  if (!t || !Number.isFinite(t.getTime())) return "";
  return `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()}`;
}

/** A validade do Pix, como a cliente lê (72 h, decisão do PO). */
export function fraseDaValidade(expiraEm: string | null | undefined): string {
  const quando = diaEHora(expiraEm);
  return quando
    ? `O código vale por 72 horas, até ${quando}. Depois disso o pedido cancela sozinho.`
    : "O código vale por 72 horas. Depois disso o pedido cancela sozinho.";
}

/** "#00123" — o número com zeros, como a loja comum mostra. */
export function numeroDoPedido(n: string | null | undefined): string {
  const s = String(n || "").trim();
  if (!s) return "";
  return /^\d+$/.test(s) ? "#" + s.padStart(5, "0") : "#" + s;
}

/**
 * A linha de baixo de cada etapa da linha do tempo. Etapas, nunca
 * horário (princípio 4 da JORNADA): previsão furada destrói mais
 * confiança que a ausência dela.
 */
export function detalheDaEtapa(
  chave: string,
  ctx: { loja: string; forma: string | null; tipo: string; prazo: number | null; pago: boolean },
): string {
  const loja = ctx.loja || "A loja";
  if (chave === "recebido") {
    if (ctx.forma === "pix") return ctx.pago ? "Hoje, pago no Pix" : "Hoje, esperando o Pix";
    if (ctx.forma === "card") return ctx.pago ? "Hoje, pago no cartão" : "Hoje, esperando o cartão";
    return "Hoje";
  }
  if (chave === "arte") return `${loja} prepara o mockup e manda para você aprovar`;
  if (chave === "producao") return "Começa assim que você aprovar";
  if (chave === "pronto") {
    const prazo = ctx.prazo ? `, ${ctx.prazo === 1 ? "1 dia útil" : ctx.prazo + " dias úteis"} após a aprovação` : "";
    if (ctx.tipo === "delivery") return `Sai para entrega${prazo}`;
    if (ctx.tipo === "courier") return `Pronto para o entregador buscar${prazo}`;
    return `Para retirar na loja${prazo}`;
  }
  return "";
}

/** O link para guardar no WhatsApp (a cliente escolhe para quem manda). */
export function linkParaGuardar(url: string, nomeDaLoja: string | null | undefined): string {
  const loja = String(nomeDaLoja || "").trim();
  const texto = `Meu pedido${loja ? " na " + loja : ""}: ${url}`;
  return "https://wa.me/?text=" + encodeURIComponent(texto);
}
