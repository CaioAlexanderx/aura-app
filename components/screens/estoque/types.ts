export type Product = {
  id: string;
  name: string;
  code: string;
  barcode: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  abc: "A" | "B" | "C";
  sold30d: number;
  unit: string;
  brand: string;
  notes: string;
};

export const UNITS = ["un", "pct", "cx", "kg", "g", "ml", "L", "par", "kit"];
export const DEFAULT_CATEGORIES = ["Produtos", "Servicos", "Bebidas", "Consumiveis", "Equipamentos", "Materiais", "Roupas", "Acessorios"];
export const TABS = ["Produtos", "Curva ABC", "Alertas"];

export const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
