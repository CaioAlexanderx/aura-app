import { classificarCliente, rotuloDoSegmento, type ClienteSegmentavel, type ContextoDaBase } from "./segmentos";

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  instagram: string;
  birthday: string;
  lastPurchase: string;
  totalSpent: number;
  visits: number;
  firstVisit: string;
  notes: string;
  rating: number | null;
  // MULTICNPJ Onda 2.3: empresa onde foi cadastrado.
  // FE so mostra badge quando companyCount > 1 (multi-CNPJ ativo).
  company_id?: string | null;
  company_name?: string | null;
  // Crediario (mai/2026): saldo devedor por (cliente, empresa).
  // > 0 = cliente deve; <= 0 = quitado/credito.
  creditBalance: number;
};

export const TABS = ["Clientes", "Ranking", "Retenção", "Avaliações"];

export const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// Fase 1 (C1.2): getStatus devolve UMA tag só, delegando pra
// classificarCliente (./segmentos.ts) — que é quem decide a prioridade
// entre Devendo/Perdido/Sumido/Em risco/VIP/Recorrente/Novo/Comprou uma
// vez. Assinatura muda de string[] pra string (era um array de até duas
// tags exibidas por CustomerRow; agora é sempre uma).
//
// `contexto` vem de `contextoDaBase(clientes)` (./segmentos.ts) — sem ele
// (chamada avulsa com um único cliente) ninguém vira VIP, porque VIP é
// relativo à base inteira. Os dois chamadores que precisam do VIP de
// verdade (CustomerRow.tsx, RankingTab.tsx) recebem a lista completa e
// passam o contexto explicitamente.
export function getStatus(c: ClienteSegmentavel, contexto?: ContextoDaBase): string {
  return rotuloDoSegmento(classificarCliente(c, contexto).segmento);
}
