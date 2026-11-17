// ============================================================
// AURA. — "Chegou mercadoria": leitura do arquivo da nota (XML da NF-e)
//
// Card A3 da estimativa p-171: o leitor de hoje (DanfeImportModal +
// utils/matconPurchaseReceipt.lerNotaDoFornecedor) não traz o código de
// barras (cEAN), o código do item no fornecedor (cProd) nem a chave da
// nota (chNFe). Este leitor traz tudo numa passada, sem ir ao servidor.
// O DanfeImportModal não muda (continua sendo o caminho do Matcon).
//
// Puro (DOMParser): roda no navegador e no jsdom dos testes.
// ============================================================

export type ItemDaNota = {
  /** Posição na nota (det nItem), começando em 1. */
  n: number;
  /** xProd, como veio. */
  descricao: string;
  /** cProd: o código do item no fornecedor. */
  codigoFornecedor: string | null;
  /** cEAN (ou cEANTrib), só dígitos; null para "SEM GTIN" ou vazio. */
  codigoBarras: string | null;
  ncm: string | null;
  /** uCom ("UN", "CX", "PCT"…). */
  unidade: string | null;
  quantidade: number;
  /** Custo de cada um, já com o desconto do item. */
  custoUnitario: number;
  /** vProd − vDesc do item. */
  total: number;
};

export type NotaLida = {
  numero: string;
  serie: string | null;
  /** 44 dígitos, ou null quando o arquivo não traz. */
  chave: string | null;
  /** "aaaa-mm-dd" da emissão, ou null. */
  emitidaEm: string | null;
  emitente: { nome: string; cnpj: string | null; telefone: string | null };
  /** Soma dos produtos da nota (ICMSTot vProd − vDesc); null se não vier. */
  totalDosProdutos: number | null;
  /** Valor total da nota (vNF); null se não vier. */
  totalDaNota: number | null;
  itens: ItemDaNota[];
};

export type LeituraDaNota = { ok: true; nota: NotaLida } | { ok: false; motivo: "pdf" | "nao_e_nota" };

const so = (v: string | null | undefined) => (v || "").replace(/\D/g, "");

function num(v: string | null | undefined): number {
  const n = parseFloat(String(v || "").trim());
  return Number.isFinite(n) ? n : 0;
}

function texto(el: Element | Document | null, seletores: string[]): string {
  if (!el) return "";
  for (const sel of seletores) {
    const t = el.querySelector(sel)?.textContent?.trim();
    if (t) return t;
  }
  return "";
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Código de barras útil: só dígitos, 8 a 14, nunca "SEM GTIN". */
export function codigoDeBarrasDaNota(v: string | null | undefined): string | null {
  const d = so(v);
  if (d.length < 8 || d.length > 14) return null;
  if (/^0+$/.test(d)) return null;
  return d;
}

/** O arquivo é um PDF? (pelo nome ou pelo começo do conteúdo) */
export function pareceUmPdf(nome: string | null | undefined, conteudo: string | null | undefined): boolean {
  if (nome && /\.pdf$/i.test(nome.trim())) return true;
  return !!conteudo && conteudo.slice(0, 1024).trimStart().startsWith("%PDF");
}

export function lerNota(xml: string, nomeDoArquivo?: string | null): LeituraDaNota {
  if (pareceUmPdf(nomeDoArquivo, xml)) return { ok: false, motivo: "pdf" };
  if (!xml || !/<\s*(?:[\w-]+:)?(?:infNFe|NFe|nfeProc)\b/.test(xml)) return { ok: false, motivo: "nao_e_nota" };
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "text/xml");
  } catch {
    return { ok: false, motivo: "nao_e_nota" };
  }
  if (doc.getElementsByTagName("parsererror").length) return { ok: false, motivo: "nao_e_nota" };

  const itens: ItemDaNota[] = [];
  doc.querySelectorAll("det").forEach((det, i) => {
    const prod = det.querySelector("prod");
    if (!prod) return;
    const descricao = texto(prod, ["xProd"]);
    if (!descricao) return;
    const quantidade = num(texto(prod, ["qCom"]));
    const vProd = num(texto(prod, ["vProd"]));
    const vDesc = num(texto(prod, ["vDesc"]));
    const total = r2(Math.max(0, vProd - vDesc));
    const vUn = num(texto(prod, ["vUnCom"]));
    const custoUnitario = quantidade > 0 && vDesc > 0 ? Math.round((total / quantidade) * 10000) / 10000 : vUn;
    const nItem = parseInt(det.getAttribute("nItem") || "", 10);
    itens.push({
      n: Number.isFinite(nItem) ? nItem : i + 1,
      descricao,
      codigoFornecedor: texto(prod, ["cProd"]) || null,
      codigoBarras: codigoDeBarrasDaNota(texto(prod, ["cEAN"])) || codigoDeBarrasDaNota(texto(prod, ["cEANTrib"])),
      ncm: so(texto(prod, ["NCM"])) || null,
      unidade: texto(prod, ["uCom"]) || null,
      quantidade,
      custoUnitario,
      total,
    });
  });
  if (!itens.length) return { ok: false, motivo: "nao_e_nota" };

  // Chave: protNFe/infProt/chNFe ou o Id do infNFe ("NFe" + 44 dígitos).
  let chave = so(texto(doc, ["infProt > chNFe", "chNFe"]));
  if (chave.length !== 44) chave = so(doc.querySelector("infNFe")?.getAttribute("Id"));
  const emissao = texto(doc, ["ide > dhEmi", "ide > dEmi"]);
  const vProdTot = texto(doc, ["ICMSTot > vProd"]);
  const vDescTot = texto(doc, ["ICMSTot > vDesc"]);
  const vNF = texto(doc, ["ICMSTot > vNF"]);

  return {
    ok: true,
    nota: {
      numero: texto(doc, ["ide > nNF", "nNF"]),
      serie: texto(doc, ["ide > serie"]) || null,
      chave: chave.length === 44 ? chave : null,
      emitidaEm: /^\d{4}-\d{2}-\d{2}/.test(emissao) ? emissao.slice(0, 10) : null,
      emitente: {
        nome: texto(doc, ["emit > xFant", "emit > xNome"]) || texto(doc, ["emit > xNome"]),
        // Produtor rural vem com CPF no lugar do CNPJ.
        cnpj: so(texto(doc, ["emit > CNPJ", "emit > CPF"])) || null,
        telefone: so(texto(doc, ["emit > enderEmit > fone"])) || null,
      },
      totalDosProdutos: vProdTot ? r2(num(vProdTot) - num(vDescTot)) : null,
      totalDaNota: vNF ? r2(num(vNF)) : null,
      itens,
    },
  };
}
