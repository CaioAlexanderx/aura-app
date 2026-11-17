// ============================================================
// AURA. — "Chegou mercadoria": origem "Planilha" (A6)
//
// Lê a planilha com o mesmo leitor da importação de produtos
// (hooks/useServerImport.lerArquivoPlanilha + utils/importPlanilha, que
// acha o cabeçalho e a aba certa) e transforma cada linha num item da
// conferência do A4a: nome ou código, quantidade e custo. Daí em diante é a
// mesma conferência da nota (achar o produto, novo, ligar, deixar de fora).
//
// A planilha sem quantidade ("só ligar ao fornecedor") é a Fase 4 (F2).
// ============================================================
import { lerLinhasDaMatriz } from "@/utils/importPlanilha";
import { semAcento, type ItemParaConferir } from "./chegouRegras";

/** Colunas aceitas, pelo cabeçalho sem acento e sem pontuação. */
const COLUNAS = {
  nome: ["nome", "produto", "descricao", "descricao do produto", "nome do produto", "item", "xprod", "mercadoria"],
  codigo: ["codigo", "cod", "codigo do fornecedor", "codigo fornecedor", "referencia", "ref", "sku", "cprod", "codigo do produto"],
  barras: ["codigo de barras", "cod barras", "codigo barras", "ean", "gtin", "barcode", "cean", "ean13"],
  quantidade: ["quantidade", "qtd", "qtde", "quant", "qty", "qcom", "quantidade recebida", "quantidade que chegou"],
  custo: ["custo", "preco de custo", "custo unitario", "valor unitario", "preco custo", "valor de custo", "vuncom", "unitario", "preco unitario"],
} as const;

type Campo = keyof typeof COLUNAS;

const chaveDoCabecalho = (h: string) => semAcento(h).replace(/[^a-z0-9]+/g, " ").trim();

export function acharColunas(cabecalho: string[]): Partial<Record<Campo, string>> {
  const achadas: Partial<Record<Campo, string>> = {};
  const usados = new Set<string>();
  // Código de barras antes de código: "código de barras" não pode virar "código".
  for (const campo of ["barras", "nome", "quantidade", "custo", "codigo"] as Campo[]) {
    const aceitos = COLUNAS[campo] as readonly string[];
    const h = cabecalho.find((c) => !usados.has(c) && aceitos.includes(chaveDoCabecalho(c)));
    if (h) { achadas[campo] = h; usados.add(h); }
  }
  return achadas;
}

/** "1.234,56", "1234,56", "7.44" ou "R$ 7,44" -> número. */
export function numeroDaPlanilha(v: string | null | undefined): number {
  let t = String(v ?? "").replace(/[R$\s]/g, "");
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

export type LeituraDaPlanilhaDeEntrada =
  | { ok: true; itens: ItemParaConferir[] }
  | { ok: false; motivo: "ilegivel" };

export function itensDaPlanilha(matriz: unknown[][]): LeituraDaPlanilhaDeEntrada {
  const lidas = lerLinhasDaMatriz(matriz);
  const col = acharColunas(lidas.cabecalho);
  if (!lidas.rows.length || (!col.nome && !col.codigo && !col.barras)) return { ok: false, motivo: "ilegivel" };
  const itens: ItemParaConferir[] = [];
  lidas.rows.forEach((row, i) => {
    const nome = col.nome ? String(row[col.nome] || "").trim() : "";
    const codigo = col.codigo ? String(row[col.codigo] || "").trim() : "";
    let barras = col.barras ? String(row[col.barras] || "").replace(/\D/g, "") : "";
    // Sem coluna própria, código só de dígitos com tamanho de EAN também é código de barras.
    if (!barras && /^\d{8,14}$/.test(codigo)) barras = codigo;
    if (!nome && !codigo && !barras) return;
    const quantidade = col.quantidade ? Math.max(0, numeroDaPlanilha(row[col.quantidade])) : 0;
    const custo = col.custo ? Math.max(0, numeroDaPlanilha(row[col.custo])) : 0;
    itens.push({
      n: i + 1,
      descricao: nome || codigo || barras,
      codigoFornecedor: codigo || null,
      codigoBarras: barras.length >= 8 && barras.length <= 14 ? barras : null,
      ncm: null,
      quantidade: Math.round(quantidade * 1000) / 1000,
      custoUnitario: custo,
      total: Math.round(quantidade * custo * 100) / 100,
    });
  });
  return itens.length ? { ok: true, itens } : { ok: false, motivo: "ilegivel" };
}

/** Modelo de entrada para baixar (CSV, abre no Excel). */
export const MODELO_DE_ENTRADA = {
  arquivo: "modelo-entrada-de-mercadoria-aura.csv",
  conteudo: "nome;codigo;codigo de barras;quantidade;custo\nEsmalte cremoso vermelho 8 ml;AL-0100;7891234567895;24;6,00\n",
};

export function baixarModeloDeEntrada(): void {
  if (typeof document === "undefined") return;
  try {
    const blob = new Blob(["﻿" + MODELO_DE_ENTRADA.conteudo], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = MODELO_DE_ENTRADA.arquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {}
}
