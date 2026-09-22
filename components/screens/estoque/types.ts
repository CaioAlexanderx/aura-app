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
  // 22/09/2026 (Matcon M0, docs/CONTRACT_MATCON.md §2): unidade em que a
  // loja COMPRA e quantas unidades de venda cabem em 1 unidade de compra
  // (caixa de 2,32 m²). null = compra na mesma unidade que vende. Só o
  // cadastro com matcon_enabled escreve aqui; todo mundo mais ignora.
  purchaseUnit?: string | null;
  purchaseFactor?: number | null;
  weightKg?: number | null;
  // 22/09/2026 (Matcon M2, docs/CONTRACT_MATCON.md §M2): fiscal do Simples.
  // cest: 7 dígitos, obrigatório na NFC-e de item com ST. origem: 0–8 (tabela
  // SEFAZ; 0 = nacional). icmsStPaid: "o imposto já veio recolhido na nota
  // do fornecedor?" -> CSOSN 500 na emissão (senão 102). Só o cadastro com
  // matcon_enabled escreve aqui.
  cest?: string | null;
  origem?: number | null;
  icmsStPaid?: boolean | null;
  // 22/09/2026 (Matcon M4, docs/CONTRACT_MATCON.md §M4): saldo por lote,
  // devolvido pelo GET /products só quando `matcon_lots_enabled` está
  // ligado. Com ele a lista mostra "148,48 m² em 2 lotes"; sem ele (todo
  // mundo hoje) o estoque é o número de sempre.
  lotsSummary?: { count: number; lots: Array<{ id: string; lot_code: string; qty: number }> } | null;
  brand: string;
  notes: string;
  // Migration 305 — ficha tecnica. Opcionais: a maioria dos catalogos
  // hoje nao tem nenhum dos tres, e a loja simplesmente nao mostra a
  // secao quando estao vazios.
  material?: string;
  medidas?: string;
  cuidados?: string;
  color: string;
  size: string;
  // Migration 323 — duração do SERVIÇO, em minutos. null = não informada.
  // undefined em produto (a coluna nem vai no corpo do PATCH). Antes disso
  // a duração era texto colado no fim da descrição ("| Duração: 45 min");
  // item-form/types.lerDuracaoDoServico ainda lê o formato antigo.
  durationMinutes?: number | null;
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
