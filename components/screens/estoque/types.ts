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
  unit: string;
  brand: string;
  notes: string;
  color: string;
  size: string;
  image_url?: string;
  has_variants?: boolean;
  // 19/05/2026: barcodes das variantes ativas vinculadas a este pai.
  // Backend GET /products devolve via ARRAY_AGG; usado pelo scanner local
  // do Estoque pra achar o pai bipando barcode de uma variante.
  variant_barcodes?: string[];
  ncm?: string;
};

export const UNITS = ["un", "pct", "cx", "kg", "g", "ml", "L", "par", "kit"];
export const DEFAULT_CATEGORIES: string[] = [];
// Curva ABC migrou pro Financeiro/Receitas (calculada a partir de vendas reais).
// As 3 abas restantes do estoque: Produtos / Alertas / Etiquetas.
export const TABS = ["Produtos", "Alertas", "Etiquetas"];

export const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
