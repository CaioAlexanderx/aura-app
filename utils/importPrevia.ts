// ============================================================
// AURA. — Prévia e relatório da importação de produtos por planilha
//
// QA de 23/09/2026: escolher o arquivo já gravava os produtos, e o único
// relatório era um toast de 3 s que errava ("1 já existe na loja" para
// uma linha repetida dentro da própria planilha; "1 com erro" sem dizer
// qual linha nem por quê). A primeira cliente de material de construção
// vai subir ~2.000 produtos — precisa conferir antes de gravar.
//
// Agora o front chama POST /companies/:id/products/import com
// dry_run:true (Aura-backend#739), mostra a conferência e só grava no
// toque em "Importar". Este arquivo traduz a resposta do backend (a da
// prévia e a da importação de verdade, que tem os mesmos campos) para a
// língua do balcão:
//
//   - `index` do backend é a posição em `rows`, não a linha do arquivo.
//     A planilha real tem 3 linhas de título antes do cabeçalho e linhas
//     vazias no meio; `linhas[index]` (utils/importPlanilha.ts,
//     lerLinhasDaMatriz) devolve a linha que o lojista vê no Excel.
//   - duplicata de origem 'lote' = repetida NA PLANILHA; 'banco' = já
//     existe na loja. O toast antigo chamava as duas de "já existe".
//   - motivo do erro sem jargão: "sem preço de venda", não "Preço de
//     venda inválido ou ausente".
//
// Puro (sem React/RN) pelo mesmo motivo do importPlanilha.ts: testar a
// tradução sem mockar Toast/Icon/SVG.
// ============================================================

// ── Formato da resposta do backend (importData.js, products/import) ──

export type DuplicataImport = {
  index: number;
  origem: "lote" | "banco";
  criterio: "codigo_de_barras" | "nome_unidade_marca";
  name?: string | null;
  unit?: string | null;
  brand?: string | null;
  barcode?: string | null;
  /** origem 'lote': índice (em rows) da primeira linha igual. */
  duplicata_de?: number;
  /** origem 'banco': id do produto que já existe. */
  produto_id?: string | null;
};

export type ErroImport = { index: number; error: string; row?: Record<string, string> };

export type ProdutoDaPrevia = {
  name: string;
  price: number | null;
  card_price?: number | null;
  unit?: string | null;
  brand?: string | null;
};

export type RespostaImport = {
  total?: number;
  valid?: number;
  error_count?: number;
  errors?: ErroImport[];
  suggested_map?: Record<string, string>;
  preview?: ProdutoDaPrevia[];
  a_importar?: number;
  duplicate_count?: number;
  duplicatas?: DuplicataImport[];
  unidades_desconhecidas?: { total?: number; valores?: string[] } | null;
  /** Só na importação de verdade. */
  saved?: number;
  duplicates_skipped?: number;
  card_price_ignorado?: boolean;
};

// ── O que a tela mostra ──

export type ContextoLeitura = {
  /** Nome da aba lida (.xlsx). Ausente no CSV. */
  nomeAba?: string | null;
  /** A planilha tem mais de uma aba e lemos uma que não é a primeira. */
  abaNaoEaPrimeira?: boolean;
  nomeArquivo?: string | null;
  cabecalho: string[];
  /** linhas[i] = linha do arquivo de rows[i]. */
  linhas: number[];
  linhaCabecalho: number;
  /** rows mandados ao backend — fallback do nome quando o erro vem sem `row`. */
  rows?: Record<string, string>[];
};

export type ColunaReconhecida = { coluna: string; campo: string; rotulo: string };
export type AmostraProduto = { linha: number | null; nome: string; preco: string; precoCartao: string | null; unidade: string; marca: string | null };
export type LinhaForaDaImportacao = { linha: number; nome: string; motivo: string };

export type ResumoImport = {
  aba: string | null;
  nomeArquivo: string | null;
  linhaCabecalho: number;
  totalLinhas: number;
  colunas: ColunaReconhecida[];
  naoUsadas: string[];
  /** Campos indispensáveis que nenhuma coluna preencheu (nome, preço). */
  faltando: string[];
  aImportar: number;
  amostra: AmostraProduto[];
  repetidasNaPlanilha: LinhaForaDaImportacao[];
  jaExistem: LinhaForaDaImportacao[];
  problemas: LinhaForaDaImportacao[];
  unidadesDesconhecidas: { total: number; valores: string[] };
  /** suggested_map do backend, mandado de volta no import de verdade para
   *  gravar exatamente o que a prévia mostrou. */
  mapaColunas: Record<string, string>;
};

export type ResultadoImport = {
  gravados: number;
  totalLinhas: number;
  repetidasNaPlanilha: LinhaForaDaImportacao[];
  jaExistem: LinhaForaDaImportacao[];
  problemas: LinhaForaDaImportacao[];
  unidadesDesconhecidas: { total: number; valores: string[] };
  precoCartaoIgnorado: boolean;
};

// ── Campos do backend -> português de balcão ──

export const ROTULO_CAMPO: Record<string, string> = {
  name: "nome do produto",
  price: "preço no dinheiro e PIX",
  card_price: "preço no cartão",
  cost_price: "preço de custo",
  stock_qty: "estoque",
  stock_min: "estoque mínimo",
  barcode: "código de barras",
  sku: "código interno",
  category: "categoria",
  color: "cor",
  size: "tamanho",
  unit: "unidade",
  brand: "marca",
  description: "descrição",
  ncm: "código fiscal (NCM)",
};

const CAMPOS_OBRIGATORIOS: [string, string][] = [
  ["name", "o nome do produto"],
  ["price", "o preço de venda"],
];

// Unidade gravada (grafia canônica do backend) -> como o balcão fala.
const NOME_UNIDADE: Record<string, string> = {
  un: "unidade", m: "metro", "m²": "m²", "m³": "m³", rolo: "rolo", "pç": "peça",
  kg: "kg", g: "grama", L: "litro", l: "litro", ml: "ml", pct: "pacote", cx: "caixa",
  sc: "saco", br: "barra", dz: "dúzia", cartela: "cartela", mlh: "milheiro",
  ton: "tonelada", par: "par", kit: "kit", lata: "lata", balde: "balde", gl: "galão",
};

export function nomeDaUnidade(u: string | null | undefined): string {
  const t = String(u ?? "").trim();
  if (!t) return "unidade";
  return NOME_UNIDADE[t] || NOME_UNIDADE[t.toLowerCase()] || t;
}

export function reais(n: number | null | undefined): string {
  const v = Number(n);
  if (n === null || n === undefined || !Number.isFinite(v)) return "—";
  const [inteiro, dec] = Math.abs(v).toFixed(2).split(".");
  return (v < 0 ? "-" : "") + "R$ " + inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + dec;
}

export function numeroBR(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** `index` do backend (posição em rows) -> linha do arquivo. Sem o mapa
 *  (não deveria acontecer), supõe linhas contíguas logo abaixo do cabeçalho. */
export function linhaDoArquivo(index: number, linhas: number[], linhaCabecalho: number): number {
  const l = linhas[index];
  if (typeof l === "number") return l;
  return linhaCabecalho + index + 1;
}

function colunaDoCampo(mapa: Record<string, string>, campo: string): string | null {
  for (const [coluna, c] of Object.entries(mapa)) if (c === campo) return coluna;
  return null;
}

function nomeDaLinha(row: Record<string, string> | undefined, mapa: Record<string, string>): string {
  if (!row) return "";
  const col = colunaDoCampo(mapa, "name");
  return String((col && row[col]) || "").trim();
}

/** Motivo do backend em português de balcão. `row` e o mapa servem para
 *  distinguir "sem preço" de "preço que não dá pra ler". */
export function motivoEmPortugues(erro: string, row?: Record<string, string>, mapa: Record<string, string> = {}): string {
  const e = String(erro || "");
  const semAcento = e.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (semAcento.includes("nome")) return "sem nome do produto";
  if (semAcento.includes("preco")) {
    const col = colunaDoCampo(mapa, "price");
    const valor = col && row ? String(row[col] ?? "").trim() : "";
    if (!valor) return "sem preço de venda";
    return `preço de venda “${valor}” não é um valor em reais`;
  }
  return e || "linha não pôde ser lida";
}

function trimAba(nome: string | null | undefined): string | null {
  const t = String(nome ?? "").trim();
  return t || null;
}

function listasFora(resp: RespostaImport, ctx: ContextoLeitura, mapa: Record<string, string>) {
  const linha = (i: number) => linhaDoArquivo(i, ctx.linhas, ctx.linhaCabecalho);

  const problemas: LinhaForaDaImportacao[] = (resp.errors || []).map(err => {
    const row = err.row || ctx.rows?.[err.index];
    return {
      linha: linha(err.index),
      nome: nomeDaLinha(row, mapa) || "(sem nome)",
      motivo: motivoEmPortugues(err.error, row, mapa),
    };
  });

  const repetidasNaPlanilha: LinhaForaDaImportacao[] = [];
  const jaExistem: LinhaForaDaImportacao[] = [];
  for (const d of resp.duplicatas || []) {
    const nome = String(d.name || "").trim() || "(sem nome)";
    if (d.origem === "lote") {
      const igual = typeof d.duplicata_de === "number" ? linha(d.duplicata_de) : null;
      const motivo = d.criterio === "codigo_de_barras"
        ? (igual ? `mesmo código de barras da linha ${igual}` : "código de barras repetido na planilha")
        : (igual ? `igual à linha ${igual} (mesmo nome, unidade e marca)` : "repetida na planilha");
      repetidasNaPlanilha.push({ linha: linha(d.index), nome, motivo });
    } else {
      const motivo = d.criterio === "codigo_de_barras"
        ? "já existe na sua loja um produto com esse código de barras"
        : "já existe na sua loja (mesmo nome, unidade e marca)";
      jaExistem.push({ linha: linha(d.index), nome, motivo });
    }
  }
  const porLinha = (a: LinhaForaDaImportacao, b: LinhaForaDaImportacao) => a.linha - b.linha;
  problemas.sort(porLinha);
  repetidasNaPlanilha.sort(porLinha);
  jaExistem.sort(porLinha);
  return { problemas, repetidasNaPlanilha, jaExistem };
}

function unidadesDe(resp: RespostaImport) {
  const u = resp.unidades_desconhecidas;
  const valores = Array.isArray(u?.valores) ? u!.valores!.map(String) : [];
  return { total: Number(u?.total) || 0, valores };
}

/** Resposta do dry_run -> tudo que a conferência mostra. */
export function montarResumoImport(resp: RespostaImport, ctx: ContextoLeitura): ResumoImport {
  const mapa = (resp.suggested_map && typeof resp.suggested_map === "object") ? resp.suggested_map : {};
  const total = typeof resp.total === "number" ? resp.total : ctx.linhas.length;

  const colunas: ColunaReconhecida[] = [];
  const naoUsadas: string[] = [];
  for (const coluna of ctx.cabecalho) {
    const campo = mapa[coluna];
    if (campo) colunas.push({ coluna, campo, rotulo: ROTULO_CAMPO[campo] || campo });
    else naoUsadas.push(coluna);
  }
  // Coluna que o backend mapeou e o cabeçalho local não tinha (não deveria
  // acontecer — os dois saem das mesmas rows), entra no fim.
  for (const [coluna, campo] of Object.entries(mapa)) {
    if (campo && !ctx.cabecalho.includes(coluna)) colunas.push({ coluna, campo, rotulo: ROTULO_CAMPO[campo] || campo });
  }
  const camposUsados = new Set(colunas.map(c => c.campo));
  const faltando = CAMPOS_OBRIGATORIOS.filter(([campo]) => !camposUsados.has(campo)).map(([, rotulo]) => rotulo);

  const { problemas, repetidasNaPlanilha, jaExistem } = listasFora(resp, ctx, mapa);

  // preview = 5 primeiras linhas VÁLIDAS (sem erro), incluindo as que são
  // duplicata. preview[k] é a k-ésima linha sem erro; tira dela as que não
  // vão entrar, para a amostra só mostrar o que entra de fato.
  const comErro = new Set((resp.errors || []).map(e => e.index));
  const repetida = new Set((resp.duplicatas || []).map(d => d.index));
  const indicesValidos: number[] = [];
  const preview = Array.isArray(resp.preview) ? resp.preview : [];
  for (let i = 0; i < total && indicesValidos.length < preview.length; i++) {
    if (!comErro.has(i)) indicesValidos.push(i);
  }
  const amostra: AmostraProduto[] = [];
  preview.forEach((p, k) => {
    const idx = indicesValidos[k];
    if (typeof idx === "number" && repetida.has(idx)) return;
    amostra.push({
      linha: typeof idx === "number" ? linhaDoArquivo(idx, ctx.linhas, ctx.linhaCabecalho) : null,
      nome: String(p.name || "").trim(),
      preco: reais(p.price),
      precoCartao: p.card_price ? reais(p.card_price) : null,
      unidade: nomeDaUnidade(p.unit),
      marca: p.brand ? String(p.brand) : null,
    });
  });

  const aImportar = typeof resp.a_importar === "number"
    ? resp.a_importar
    : Math.max(0, total - problemas.length - repetidasNaPlanilha.length - jaExistem.length);

  return {
    aba: trimAba(ctx.nomeAba),
    nomeArquivo: ctx.nomeArquivo || null,
    linhaCabecalho: ctx.linhaCabecalho,
    totalLinhas: total,
    colunas,
    naoUsadas,
    faltando,
    aImportar,
    amostra,
    repetidasNaPlanilha,
    jaExistem,
    problemas,
    unidadesDesconhecidas: unidadesDe(resp),
    mapaColunas: mapa,
  };
}

/** Resposta da importação de verdade -> relatório final. O backend corta
 *  `errors` em 20 na gravação; quando a contagem bate com a da prévia, a
 *  lista completa da prévia é a mesma (mesmas rows, mesmo mapa). */
export function montarResultadoImport(resp: RespostaImport, previa: ResumoImport, ctx: ContextoLeitura): ResultadoImport {
  const mapa = previa.mapaColunas;
  const listas = listasFora(resp, ctx, mapa);
  const errosCompletos = typeof resp.error_count === "number" && resp.error_count === previa.problemas.length;
  return {
    gravados: Number(resp.saved) || 0,
    totalLinhas: previa.totalLinhas,
    repetidasNaPlanilha: Array.isArray(resp.duplicatas) ? listas.repetidasNaPlanilha : previa.repetidasNaPlanilha,
    jaExistem: Array.isArray(resp.duplicatas) ? listas.jaExistem : previa.jaExistem,
    problemas: errosCompletos || !Array.isArray(resp.errors) ? previa.problemas : listas.problemas,
    unidadesDesconhecidas: resp.unidades_desconhecidas ? unidadesDe(resp) : previa.unidadesDesconhecidas,
    precoCartaoIgnorado: resp.card_price_ignorado === true,
  };
}

function celulaCsv(v: string | number): string {
  const s = String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Lista das linhas que não entraram (com problema, repetidas na planilha
 *  e já existentes na loja), em ordem de linha. Separador ";" — o Excel em
 *  português abre direto em colunas. O BOM fica por conta do downloadCSV. */
export function gerarCsvProblemas(r: {
  problemas: LinhaForaDaImportacao[];
  repetidasNaPlanilha: LinhaForaDaImportacao[];
  jaExistem: LinhaForaDaImportacao[];
}): string {
  const todas = [
    ...r.problemas,
    ...r.repetidasNaPlanilha.map(l => ({ ...l, motivo: `repetida na planilha: ${l.motivo}` })),
    ...r.jaExistem,
  ].sort((a, b) => a.linha - b.linha);
  const linhas = ["Linha;Produto;Motivo", ...todas.map(l => [l.linha, l.nome, l.motivo].map(celulaCsv).join(";"))];
  return linhas.join("\r\n") + "\r\n";
}

/** Quantas linhas ficaram de fora (para o botão de baixar a lista). */
export function totalForaDaImportacao(r: { problemas: unknown[]; repetidasNaPlanilha: unknown[]; jaExistem: unknown[] }): number {
  return r.problemas.length + r.repetidasNaPlanilha.length + r.jaExistem.length;
}

export function plural(n: number, um: string, varios: string): string {
  return `${numeroBR(n)} ${n === 1 ? um : varios}`;
}
