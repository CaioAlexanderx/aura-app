// ============================================================
// AURA. — Matcon na tela final da venda (SaleComplete)
//
// QA 23/09/2026. Depois de "virar pedido" a venda terminava num "Venda
// registrada!" mudo — o vendedor não sabia que a entrega já existia, nem
// que o pedreiro que indicou tinha ganhado os pontos. O POST /pdv/sale
// devolve `matcon` (aura-backend src/services/matconSaleHooks.js):
//   · venda de orçamento: { quote_id, delivery_id, delivery_token }
//   · venda indicada: { referral: { credited, points, points_balance,
//     professional_id } | { credited: false, reason } }
// As duas partes são opcionais e podem vir juntas. Sem `matcon` (loja sem o
// módulo, venda de balcão) as frases saem null e a tela é a de sempre.
//
// A data da entrega não vem na resposta: é hoje + matcon_default_delivery_
// days (a mesma conta que o backend fez ao criar). Funções puras; `agora`
// só existe para o teste.
// ============================================================

export type MatconReferralDaVenda = {
  credited: boolean;
  points?: number;
  points_balance?: number;
  professional_id?: string;
  reason?: string;
};

export type MatconDaVenda = {
  quote_id?: string;
  delivery_id?: string;
  delivery_token?: string;
  referral?: MatconReferralDaVenda;
};

/** Hoje + `dias`, em "DD/MM" (data local do aparelho — a loja está no Brasil). */
export function dataDaEntrega(dias: number, agora?: Date): string {
  const base = agora ? new Date(agora.getTime()) : new Date();
  const n = Number.isFinite(Number(dias)) ? Math.max(0, Math.round(Number(dias))) : 0;
  const alvo = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  const dd = String(alvo.getDate()).padStart(2, "0");
  const mm = String(alvo.getMonth() + 1).padStart(2, "0");
  return dd + "/" + mm;
}

export type FrasesMatconDaVenda = {
  /** "Entrega nº 1 criada para 25/09 — acompanhe em Entregas" */
  entrega: string | null;
  /** "Abbey ganhou 10 pontos com esta venda" */
  pontos: string | null;
};

export function frasesMatconDaVenda(
  matcon: MatconDaVenda | null | undefined,
  opts: { diasDeEntrega: number; nomeDoIndicado?: string | null; agora?: Date },
): FrasesMatconDaVenda {
  if (!matcon || typeof matcon !== "object") return { entrega: null, pontos: null };

  const entrega = matcon.delivery_id
    ? "Entrega nº 1 criada para " + dataDaEntrega(opts.diasDeEntrega, opts.agora) + " — acompanhe em Entregas"
    : null;

  let pontos: string | null = null;
  const ref = matcon.referral;
  if (ref && ref.credited === true) {
    const nome = (opts.nomeDoIndicado || "").trim() || "O profissional que indicou";
    const n = Math.max(0, Math.round(Number(ref.points) || 0));
    pontos = n > 0
      ? nome + " ganhou " + n + (n === 1 ? " ponto" : " pontos") + " com esta venda"
      : "Indicação de " + nome + " registrada nesta venda";
  }

  return { entrega, pontos };
}
