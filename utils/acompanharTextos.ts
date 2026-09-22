// ============================================================
// AURA. — textos de /acompanhar/[token] por tipo/etapa
//
// 22/09/2026 (Matcon M1 — docs/matcon-faseamento-po-ux.md §3,
// docs/CONTRACT_MATCON.md §M1). Extraído de app/acompanhar/[token].tsx pra
// virar função pura testável: o tipo "entrega" entra do lado de "oculos" e
// "encomenda" (default, `tipo` ausente ou qualquer outro valor), e os três
// nunca podem se confundir.
//
// Campos do backend assumidos aqui (opcionais — ausentes = comportamento
// de hoje, documentado também em PublicTrack em services/studioApi.ts):
//   - `tipo: "entrega"` no retorno de GET /acompanhar/:token
//   - `itens[].entregue`, `itens[].total`, `itens[].unidade`
//   - `proxima_entrega` (data 'YYYY-MM-DD', nullable)
// ============================================================

export type TipoAcompanhamento = "oculos" | "entrega" | string | null | undefined;

/**
 * Título principal da tela, conforme tipo + etapa atual.
 * - "oculos"  : inalterado (prontos pra retirar / acompanhe por aqui).
 * - "entrega" : título muda com a etapa — "saiu" tem título próprio,
 *   a última etapa (index) é "entregue", o resto (aprovado/separando/
 *   pronto) cai em "Estamos separando seu pedido".
 * - default (encomenda): inalterado.
 */
export function tituloAcompanhamento(params: {
  tipo?: TipoAcompanhamento;
  etapaAtualKey?: string | null;
  atual: number;
  totalEtapas: number;
}): string {
  const { tipo, etapaAtualKey, atual, totalEtapas } = params;
  const ultimaEtapa = totalEtapas > 0 && atual >= totalEtapas - 1;

  if (tipo === "oculos") {
    return ultimaEtapa ? "Seus óculos estão prontos para retirar." : "Acompanhe seus óculos por aqui.";
  }
  if (tipo === "entrega") {
    if (ultimaEtapa || etapaAtualKey === "entregue") return "Seu pedido foi entregue";
    if (etapaAtualKey === "saiu") return "Seu pedido saiu para entrega";
    return "Estamos separando seu pedido";
  }
  return ultimaEtapa ? "Sua encomenda está pronta." : "Acompanhe sua encomenda por aqui.";
}

/** Rótulo do bloco de saldo ("SALDO DOS ÓCULOS" / "SALDO DO PEDIDO" / "SALDO DA ENCOMENDA"). */
export function rotuloSaldo(tipo: TipoAcompanhamento): string {
  if (tipo === "oculos") return "SALDO DOS ÓCULOS";
  if (tipo === "entrega") return "SALDO DO PEDIDO";
  return "SALDO DA ENCOMENDA";
}

/** Rótulo do bloco de itens ("SEUS ÓCULOS" / "SEU PEDIDO" — entrega e
 *  encomenda já usavam o mesmo rótulo, "entrega" não muda nada aqui). */
export function rotuloItens(tipo: TipoAcompanhamento): string {
  return tipo === "oculos" ? "SEUS ÓCULOS" : "SEU PEDIDO";
}

/** Rodapé "Pedido #N · feito com Aura[ Studio]". */
export function rodapePedido(tipo: TipoAcompanhamento, pedido: string): string {
  if (tipo === "oculos") return `${pedido} · feito com Aura`;
  if (tipo === "entrega") return `Pedido #${pedido} · feito com Aura`;
  return `Pedido #${pedido} · feito com Aura Studio`;
}

// 22/09/2026 (Matcon M2 — fiscal do Simples, docs/CONTRACT_MATCON.md §M2):
// linha "Nota fiscal · ver DANFE" do rastreio público. Igual nos três
// tipos (oculos/entrega/encomenda) — o texto vive aqui, junto dos outros
// textos da tela, e não é condicionado a `tipo` como os de cima: só
// aparece quando o backend manda `danfe_url` (nota autorizada), qualquer
// que seja o tipo de acompanhamento.
export const LABEL_NOTA_FISCAL = "Nota fiscal";
export const LABEL_VER_DANFE = "ver DANFE ›";

// pt-BR sem zero à direita: "4", "1,5" — mesma regra de fmtQty
// (utils/matconUnits.ts), sem importar daqui pra manter este arquivo sem
// dependência do Matcon "de verdade" (só dos textos).
function fmtNumero(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

// 'YYYY-MM-DD' → 'DD/MM'. Sem `new Date()` (data pura viraria UTC).
function fmtDiaMes(iso: string): string {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0");
}

export type ItemEntregaTexto = {
  /** "6 de 10 sc" — null quando o item não trouxe entregue/total (item de
   *  encomenda/óculos comum, sem entrega parcial). */
  progresso: string | null;
  /** "Os 4 sc restantes vão na próxima viagem. Você não paga nada a mais
   *  por isso." — null quando não há saldo (entregue >= total) ou o item
   *  não é de entrega parcial. */
  saldoFrase: string | null;
};

/**
 * Textos de UM item da lista "SEU PEDIDO" quando o backend manda
 * entregue/total/unidade (entrega parcial do Matcon). Item sem esses
 * campos devolve tudo null — quem chama cai de volta no "nome × qtd" de
 * sempre.
 */
export function textoItemEntrega(item: {
  entregue?: number | null;
  total?: number | null;
  unidade?: string | null;
}, proximaEntrega?: string | null): ItemEntregaTexto {
  if (item.entregue == null || item.total == null) {
    return { progresso: null, saldoFrase: null };
  }
  const sufixoUnidade = item.unidade ? " " + item.unidade : "";
  const progresso = `${fmtNumero(item.entregue)} de ${fmtNumero(item.total)}${sufixoUnidade}`;

  const restante = Math.round((item.total - item.entregue) * 1000) / 1000;
  if (restante <= 0) return { progresso, saldoFrase: null };

  const quando = proximaEntrega ? `no dia ${fmtDiaMes(proximaEntrega)}, na próxima viagem` : "na próxima viagem";
  const saldoFrase =
    `Os ${fmtNumero(restante)}${sufixoUnidade} restantes vão ${quando}. Você não paga nada a mais por isso.`;
  return { progresso, saldoFrase };
}
