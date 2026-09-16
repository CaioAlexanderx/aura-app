import { diasSemComprar, estaInativo } from "./diasSemComprar";

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

export function getStatus(c: { visits: number; totalSpent: number; lastPurchase: string; creditBalance?: number }): string[] {
  const t: string[] = [];
  if ((c.creditBalance || 0) > 0) t.push("Devendo");
  if (c.totalSpent >= 2000) t.push("VIP");
  if (c.visits >= 10) t.push("Frequente");
  // Régua única (./diasSemComprar): "Inativo" passa a ser 61 dias ou mais.
  // Era MAIS DE 30 — o que marcava como inativo justamente quem a tela de
  // reativação chamava de "em risco" e não listava como inativo.
  //
  // E quem sumiu prevalece sobre quem é novo: com 61+ dias parado a tag
  // "Novo" não sai, senão o mesmo cliente aparecia recém-chegado e sumido
  // ao mesmo tempo — duas informações que se anulam na leitura.
  const inativo = estaInativo(diasSemComprar(c.lastPurchase));
  if (c.visits <= 3 && !inativo) t.push("Novo");
  if (inativo) t.push("Inativo");
  return t;
}
