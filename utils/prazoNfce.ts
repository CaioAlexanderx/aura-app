// ============================================================
// AURA. — Prazo de cancelamento da nota no app (17/11/2026)
// Card b-troca-prazo-nfce.
//
// Quem decide é o backend (services/nfcePrazoCancelamento.js, prazo por UF:
// 30 min na NFC-e de SP, AP, RJ e MG; 24 h na NF-e 55). O app só mostra:
//   - troca: usa sale.nfce_troca_estrategia da busca de vendas;
//   - detalhe da venda: usa fiscal[].cancelamento.
// Sem esses campos (backend antigo), a troca mostra a devolução — nunca
// promete um cancelamento que o servidor pode não fazer — e o detalhe
// calcula com o teto nacional (30 min) a partir de authorized_at.
// ============================================================
import type { FiscalStrategy } from "@/components/screens/pdv/troca/types";

/** Teto nacional da NFC-e (Ajuste SINIEF 19/2016, cláusula 15ª). SP, AP, RJ e MG usam o mesmo. */
export const PRAZO_NFCE_MIN = 30;
/** NF-e modelo 55 (services/nfe55Eventos.js). */
export const PRAZO_NFE55_MIN = 24 * 60;

type VendaDaTroca = {
  has_nfce?: boolean;
  nfce_troca_estrategia?: "cancel_reissue" | "devolucao_55" | "none" | string | null;
  nfce_prazo_minutos?: number | null;
};

/** Caminho fiscal da troca para uma venda de origem. */
export function estrategiaDaVenda(s: VendaDaTroca): Exclude<FiscalStrategy, "per_origin"> {
  if (s.has_nfce !== true) return "none";
  const e = s.nfce_troca_estrategia;
  if (e === "cancel_reissue" || e === "devolucao_55") return e;
  if (e === "none") return "none";
  return "devolucao_55";
}

/** Minutos do prazo mostrados na troca (o do backend; senão o teto nacional). */
export function minutosDoPrazoDaTroca(vendas: VendaDaTroca[]): number {
  const m = vendas.map((v) => Number(v.nfce_prazo_minutos)).find((n) => Number.isFinite(n) && n > 0);
  return m || PRAZO_NFCE_MIN;
}

export type NotaDaVenda = {
  id: string;
  tipo: string;
  status: string;
  numero: number | null;
  authorized_at: string | null;
  cancelamento?: { uf?: string; prazo_minutos: number; ate: string | null; dentro: boolean } | null;
};

export type PrazoDaNota = {
  rotulo: "NFC-e" | "NF-e";
  minutos: number;
  ate: string | null;
  /** true = ainda dá para cancelar na SEFAZ. Sem authorized_at: true (a SEFAZ decide). */
  dentro: boolean;
};

/** Prazo de cancelamento de uma nota autorizada da venda. */
export function prazoDaNota(n: NotaDaVenda, agora: number = Date.now()): PrazoDaNota {
  const rotulo = n.tipo === "nfe" ? "NF-e" : "NFC-e";
  if (n.cancelamento && Number.isFinite(Number(n.cancelamento.prazo_minutos))) {
    const ate = n.cancelamento.ate || null;
    // O servidor calculou na hora do GET; reconfere pelo relógio de agora.
    const dentro = ate ? agora <= new Date(ate).getTime() : !!n.cancelamento.dentro || !n.authorized_at;
    return { rotulo, minutos: Number(n.cancelamento.prazo_minutos), ate, dentro };
  }
  const minutos = n.tipo === "nfe" ? PRAZO_NFE55_MIN : PRAZO_NFCE_MIN;
  if (!n.authorized_at) return { rotulo, minutos, ate: null, dentro: true };
  const ateMs = new Date(n.authorized_at).getTime() + minutos * 60000;
  return { rotulo, minutos, ate: new Date(ateMs).toISOString(), dentro: agora <= ateMs };
}
