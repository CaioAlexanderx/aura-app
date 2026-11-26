// ============================================================
// AURA. — Nova condicional · peças: busca, bipe e variantes (C6)
//
// Funções puras sobre os produtos da loja (GET /products) e as variantes
// (GET /products/:id/variants). Uma peça = uma unidade (a condicional não
// tem quantidade por linha).
// ============================================================
import { mapApiProduct } from "@/hooks/useProducts";
import { ehUnidadeServico } from "@/utils/notaDoItem";
import { corETamanhoDaVariante, nomeDaCorDaVariante } from "@/utils/nomeDaCor";
import { hexToName } from "@/utils/colorNames";
import { ordenarVariantes } from "@/utils/ordemDeTamanhos";
import { precoDaVariante } from "@/utils/precoEfetivo";
import { reservaDoProdutoCru, livresParaLevar, type ReservaDoProduto } from "./livre";

export type ClienteDaCondicional = { id: string; name: string; phone: string | null };

export type ProdutoDaBusca = {
  id: string;
  name: string;
  code: string;
  barcode: string;
  /** Códigos de barras das variantes (para o bipe achar o produto). */
  variantBarcodes: string[];
  /** Nomes das cores das variantes (a busca acha pela cor). */
  coresDasVariantes: string[];
  /** Preço que vale hoje (promoção no ar ou o normal). */
  preco: number;
  /** Preço normal (base da variante com preço próprio). */
  price: number;
  emPromocao: boolean;
  precoEfetivo: number | null;
  /** Estoque da prateleira (soma das variantes quando há). */
  estoque: number;
  temVariantes: boolean;
  reserva: ReservaDoProduto;
};

export type VarianteDaBusca = {
  id: string;
  cor: string | null;
  tamanho: string | null;
  /** Texto da opção quando a variante não tem cor nem tamanho (só o sufixo do SKU). */
  rotulo: string;
  barcode: string;
  preco: number;
  /** Livres para levar (estoque − com clientes − reservado). */
  livre: number;
  /** Peças desta variante com clientes agora. */
  comCliente: number;
};

export type PecaDaCondicional = {
  /** Identifica a linha na lista (uma unidade por linha). */
  chave: string;
  productId: string;
  variantId: string | null;
  nome: string;
  cor: string | null;
  tamanho: string | null;
  preco: number;
  /** Entrou sem unidade livre (loja que vende sem estoque): aviso âmbar na linha. */
  semLivre: boolean;
};

function normalizar(s: string): string {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Produtos que podem sair em condicional: peça física (serviço não). */
export function produtosDaResposta(resposta: any): ProdutoDaBusca[] {
  const arr = resposta?.products || resposta?.rows || resposta;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((cru: any) => !ehUnidadeServico(cru?.unit))
    .map((cru: any) => {
      const p: any = mapApiProduct(cru);
      const emPromocao = p.emPromocao === true && Number(p.precoEfetivo) > 0 && Number(p.precoEfetivo) < p.price - 0.001;
      return {
        id: String(p.id),
        name: String(p.name),
        code: p.code === "---" ? "" : String(p.code || ""),
        barcode: String(p.barcode || ""),
        variantBarcodes: (p.variant_barcodes || []).map(String),
        coresDasVariantes: (p.variant_color_names || []).map(String),
        preco: emPromocao ? Number(p.precoEfetivo) : p.price,
        price: p.price,
        emPromocao,
        precoEfetivo: emPromocao ? Number(p.precoEfetivo) : null,
        estoque: p.stock,
        temVariantes: p.has_variants === true,
        reserva: reservaDoProdutoCru(cru),
      } as ProdutoDaBusca;
    });
}

/** Busca por nome, código, código de barras ou cor. Vazio = sem sugestões. */
export function filtrarProdutos(produtos: ProdutoDaBusca[], busca: string, limite = 8): ProdutoDaBusca[] {
  const q = normalizar(busca);
  if (!q) return [];
  const achados: ProdutoDaBusca[] = [];
  for (const p of produtos) {
    const alvo = normalizar([p.name, p.code, p.barcode, ...p.coresDasVariantes].join(" "));
    if (alvo.includes(q) || p.variantBarcodes.some((b) => normalizar(b) === q)) achados.push(p);
    if (achados.length >= limite) break;
  }
  return achados;
}

/** O código bipado é de qual produto? (SKU, código de barras ou de variante.) */
export function acharPeloCodigo(produtos: ProdutoDaBusca[], codigo: string): { produto: ProdutoDaBusca; codigoDeVariante: boolean } | null {
  const c = String(codigo || "").trim();
  if (!c) return null;
  const igual = (a: string) => !!a && a.trim().toLowerCase() === c.toLowerCase();
  for (const p of produtos) if (igual(p.barcode) || igual(p.code)) return { produto: p, codigoDeVariante: false };
  for (const p of produtos) if (p.variantBarcodes.some(igual)) return { produto: p, codigoDeVariante: true };
  return null;
}

/** Variantes ativas do produto, na ordem cor → tamanho, com livres e "com cliente". */
export function variantesDoProduto(produto: ProdutoDaBusca, cruas: any[]): VarianteDaBusca[] {
  const ativas = (cruas || []).filter((v: any) => v && v.is_active !== false);
  const chave = (v: any) => {
    const ct = corETamanhoDaVariante(v);
    return { cor: ct.cor, tamanho: ct.tamanho ?? (!ct.cor && v.sku_suffix ? String(v.sku_suffix) : null) };
  };
  return ordenarVariantes(ativas, chave).map((v: any) => {
    const ct = corETamanhoDaVariante(v);
    let cor: string | null = ct.cor;
    if (cor && /^#[0-9a-fA-F]{6}$/.test(cor)) cor = nomeDaCorDaVariante(v, cor) || hexToName(cor);
    const tamanho = ct.tamanho ?? (!ct.cor && v.sku_suffix ? String(v.sku_suffix) : null);
    const estoque = parseFloat(v.stock_qty) || 0;
    const reservado = (produto.reserva.reservadoPorVariante[v.id] || 0) + (produto.reserva.resolverPorVariante[v.id] || 0);
    const comCliente = produto.reserva.comClientePorVariante[v.id] || 0;
    const pv = precoDaVariante(v, { price: produto.price, emPromocao: produto.emPromocao, precoEfetivo: produto.precoEfetivo });
    return {
      id: String(v.id),
      cor,
      tamanho,
      rotulo: tamanho || cor || String(v.sku_suffix || "Única"),
      barcode: String(v.barcode || ""),
      preco: pv.price,
      livre: livresParaLevar(estoque, reservado, comCliente),
      comCliente,
    };
  });
}

/** Produto sem variantes: livres do produto. */
export function livresDoProduto(p: ProdutoDaBusca): number {
  return livresParaLevar(p.estoque, p.reserva.reservadoTotal, p.reserva.comClienteTotal, p.reserva.resolverTotal);
}

/** Quantas unidades desta peça (produto + variante) já estão na lista. */
export function jaNaLista(pecas: PecaDaCondicional[], productId: string, variantId: string | null): number {
  return pecas.filter((x) => x.productId === productId && (x.variantId || null) === (variantId || null)).length;
}

export function totalDasPecas(pecas: PecaDaCondicional[]): number {
  return Math.round(pecas.reduce((s, p) => s + (Number(p.preco) || 0), 0) * 100) / 100;
}

/** A faixa de tamanhos para o subtítulo da sugestão ("P ao G"). */
export function faixaDeTamanhos(vs: VarianteDaBusca[]): string {
  const t = vs.map((v) => v.tamanho).filter((x): x is string => !!x);
  const unicos = Array.from(new Set(t));
  if (unicos.length === 0) return "";
  if (unicos.length === 1) return unicos[0];
  return unicos[0] + " ao " + unicos[unicos.length - 1];
}
