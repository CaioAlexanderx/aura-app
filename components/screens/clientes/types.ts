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

export const TABS = ["Clientes", "Ranking", "Retencao", "Avaliacoes"];

export const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export function getStatus(c: { visits: number; totalSpent: number; lastPurchase: string; creditBalance?: number }): string[] {
  const t: string[] = [];
  if ((c.creditBalance || 0) > 0) t.push("Devendo");
  if (c.totalSpent >= 2000) t.push("VIP");
  if (c.visits >= 10) t.push("Frequente");
  if (c.visits <= 3) t.push("Novo");
  const p = c.lastPurchase.split("/");
  if (p.length === 3) {
    const d = new Date(+p[2], +p[1] - 1, +p[0]);
    if ((Date.now() - d.getTime()) / 864e5 > 30) t.push("Inativo");
  }
  return t;
}
