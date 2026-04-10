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
  notes: string;   // descricao/observacoes
  color: string;   // hex e.g. #A3C1FF
  size: string;    // tamanho e.g. P, M, G, 500ml
};

export const UNITS = ["un", "pct", "cx", "kg", "g", "ml", "L", "par", "kit"];
export const DEFAULT_CATEGORIES: string[] = [];
export const TABS = ["Produtos", "Curva ABC", "Alertas", "Etiquetas"];

export const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
