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
};

export const TABS = ["Clientes", "Ranking", "Retencao", "Avaliacoes"];

export const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export function getStatus(c: { visits: number; totalSpent: number; lastPurchase: string }): string[] {
  const t: string[] = [];
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
