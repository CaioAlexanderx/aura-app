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
  color: string;
  size: string;
  image_url?: string;
  has_variants?: boolean;
};

export const UNITS = ["un", "pct", "cx", "kg", "g", "ml", "L", "par", "kit"];
export const DEFAULT_CATEGORIES: string[] = [];
export const TABS = ["Produtos", "Curva ABC", "Alertas", "Etiquetas"];

export const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
