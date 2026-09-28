// ============================================================
// O que a cliente lê num pedido cancelado (QA final 28/09/2026, LJ-33/CL-46)
//
// A vitrine dizia "O Pix não foi pago em 72 horas e o pedido cancelou
// sozinho" para TODO pedido Pix cancelado — inclusive o que a loja tinha
// recusado cinco minutos depois de feito. O backend agora manda o tipo e
// o motivo que a loja escreveu (aura-backend, services/cancelamentoDoPedido):
//
//   pix_expirado         o texto das 72 h (só aqui)
//   pagamento_recusado   "A loja não confirmou o seu Pix" + motivo + caminhos
//   cancelado_pela_loja  "A loja cancelou este pedido" + motivo
//
// Sem o campo (backend antigo), só `payment_status = expired` ganha o texto
// das 72 h; o resto cai no texto neutro.
//
// Puro: a página do pedido e as duas páginas de acompanhamento só desenham.
// ============================================================

export type Cancelamento = { tipo?: string | null; motivo?: string | null } | null | undefined;

export interface TextoDoCancelamento {
  tipo: "pix_expirado" | "pagamento_recusado" | "cancelado_pela_loja" | "desconhecido";
  titulo: string;
  texto: string;
  /** O motivo escrito pela loja, já limpo, ou null. */
  motivo: string | null;
  /** Mostrar "Montar de novo" (a cliente ainda pode querer a peça). */
  montarDeNovo: boolean;
}

export function textoDoCancelamento(
  cancelamento: Cancelamento,
  ctx: { loja?: string | null; paymentStatus?: string | null },
): TextoDoCancelamento {
  const loja = String(ctx.loja || "").trim() || "A loja";
  const motivo = String(cancelamento?.motivo || "").trim() || null;
  let tipo = cancelamento?.tipo || null;
  if (!tipo && String(ctx.paymentStatus || "").toLowerCase() === "expired") tipo = "pix_expirado";

  if (tipo === "pix_expirado") {
    return {
      tipo, motivo: null, montarDeNovo: true,
      titulo: "Este pedido foi cancelado",
      texto: "O Pix não foi pago em 72 horas e o pedido cancelou sozinho. Se ainda quiser a peça, é só montar de novo.",
    };
  }
  if (tipo === "pagamento_recusado") {
    return {
      tipo, motivo, montarDeNovo: true,
      titulo: "A loja não confirmou o seu Pix",
      texto: `${loja} não encontrou o seu pagamento e cancelou o pedido. Se você pagou, fale com a loja no WhatsApp e mande o comprovante. Se ainda quiser a peça, dá para montar de novo.`,
    };
  }
  if (tipo === "cancelado_pela_loja") {
    return {
      tipo, motivo, montarDeNovo: true,
      titulo: "A loja cancelou este pedido",
      texto: `${loja} cancelou o pedido. Qualquer dúvida, fale com a loja pelo WhatsApp.`,
    };
  }
  return {
    tipo: "desconhecido", motivo, montarDeNovo: true,
    titulo: "Este pedido foi cancelado",
    texto: `O pedido foi cancelado. Qualquer dúvida, fale com ${loja === "A loja" ? "a loja" : loja} pelo WhatsApp.`,
  };
}
