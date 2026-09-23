// ============================================================
// AURA. — Funções puras do import de planilha (Estoque/Clientes/Lançamentos)
//
// Sem React, sem react-native, sem Icon/Toast — só matriz -> rows.
// Separado de hooks/useServerImport.ts de propósito: aquele arquivo
// puxa components/Toast -> components/Icon -> react-native-svg, que
// quebra em jest sem mock nativo (ver __tests__/testarRenderAuraApp
// na memória do projeto). Testar a lógica de verdade — detectar
// cabeçalho, montar rows, traduzir o resumo do backend — não deveria
// depender de mockar SVG nenhum.
//
// Contexto: a primeira cliente de material de construção mandou um
// .xlsx com 3 linhas de título ("ATUALIZADO EM: ...", "TABELA DE
// PREÇO", linha vazia) antes do cabeçalho de verdade — o parser
// antigo assumia cabeçalho na linha 1 e a importação vinha vazia.
// detectHeaderRowIndex procura, nas 10 primeiras linhas, a primeira
// que parece cabeçalho de produto: >=3 células de texto não vazias
// E pelo menos uma parecendo nome de produto (nome/produto/descrição/
// item). Sem bater o critério, cai na linha 0 — comportamento de
// sempre, pra não quebrar CSVs simples (ex: lançamentos, sem coluna
// de nome nenhuma).
// ============================================================

// -- Parser CSV com suporte a campos entre aspas (quoted fields) --
// nomes de produtos com ponto-e-vírgula (ex: "Tênis Ref; 031 ...")
// quebravam um split ingênuo e deslocavam as colunas seguintes.
function parseCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { current += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === sep) { result.push(current); current = ""; }
      else { current += c; }
    }
  }
  result.push(current);
  return result;
}

/** Texto de um .csv/.tsv/.txt para matriz (array de arrays), sem decidir
 *  ainda qual linha é o cabeçalho — isso é trabalho do detectHeaderRowIndex,
 *  compartilhado com o caminho do .xlsx. */
export function csvTextToMatrix(text: string): string[][] {
  const clean = text.replace(/^﻿/, ""); // remove BOM
  const lines = clean.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length === 0) return [];
  const semicolons = (lines[0].match(/;/g) || []).length;
  const commas = (lines[0].match(/,/g) || []).length;
  const tabs = (lines[0].match(/\t/g) || []).length;
  let sep = ",";
  if (tabs > semicolons && tabs > commas) sep = "\t";
  else if (semicolons > commas) sep = ";";
  return lines.map(line => parseCSVLine(line, sep));
}

function normalizeText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Uma célula "de texto" é não-vazia e não é puramente numérica (evita
// contar CUSTO/VALOR DIN/ESTOQUE de uma linha de dado como se fossem
// as 3 células de texto que caracterizam o cabeçalho).
function isTextCell(v: unknown): boolean {
  const t = normalizeText(v);
  if (!t) return false;
  return !/^-?\d+([.,]\d+)?$/.test(t);
}

const HEADER_NAME_KEYWORDS = ["nome", "produto", "descricao", "item"];

function looksLikeHeaderNameCell(v: unknown): boolean {
  const t = stripAccents(normalizeText(v)).toLowerCase();
  if (!t) return false;
  return HEADER_NAME_KEYWORDS.some(kw => t.includes(kw));
}

export function isLikelyHeaderRow(row: unknown[]): boolean {
  const cells = row || [];
  const textCells = cells.filter(isTextCell);
  if (textCells.length < 3) return false;
  return cells.some(looksLikeHeaderNameCell);
}

/** Acha, entre as 10 primeiras linhas, a primeira que parece cabeçalho.
 *  Se nenhuma bater no critério (planilhas sem coluna de nome, tipo
 *  lançamentos), cai pra linha 0 — o comportamento de sempre. */
export function detectHeaderRowIndex(matrix: unknown[][]): number {
  const limit = Math.min(matrix.length, 10);
  for (let i = 0; i < limit; i++) {
    if (isLikelyHeaderRow(matrix[i] || [])) return i;
  }
  return 0;
}

export type AbaPlanilha = { nome: string; matriz: unknown[][] };

/** Planilha real de uma cliente veio com 3 abas: "Gráf1" (1 linha de
 *  gráfico), "Gráf2" (2 mil linhas só de número, sem cabeçalho) e só a
 *  3ª, "relatório geral de custo ", com os dados de verdade. Ler sempre
 *  a 1ª aba (SheetNames[0]) importava a aba de gráfico e não trazia
 *  produto nenhum.
 *
 *  Escolhe a primeira aba em que isLikelyHeaderRow acha cabeçalho nas
 *  10 primeiras linhas; se nenhuma bater (planilha de aba única, sem
 *  coluna de nome), cai pra aba com mais linhas não vazias — nunca
 *  pra aba de gráfico com 1 linha. */
export function escolherAba(abas: AbaPlanilha[]): AbaPlanilha | null {
  if (!abas || abas.length === 0) return null;

  for (const aba of abas) {
    const limit = Math.min(aba.matriz.length, 10);
    for (let i = 0; i < limit; i++) {
      if (isLikelyHeaderRow(aba.matriz[i] || [])) return aba;
    }
  }

  let melhor = abas[0];
  let melhorCount = -1;
  for (const aba of abas) {
    const count = aba.matriz.filter(row => (row || []).some(c => normalizeText(c) !== "")).length;
    if (count > melhorCount) { melhorCount = count; melhor = aba; }
  }
  return melhor;
}

function findNameColumnIndex(headers: string[]): number {
  const priority = ["nome", "produto", "descricao", "item"];
  for (const kw of priority) {
    const idx = headers.findIndex(h => stripAccents(h).toLowerCase().includes(kw));
    if (idx >= 0) return idx;
  }
  return -1;
}

// Número vindo do xlsx (raw:true) vira string no formato que o
// parseBRL do backend entende ("7.44", "7,44", "1.234,56" — aqui
// String(n) basta, o backend decide o resto).
function cellToRowValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

/** Matriz -> rows prontos pra mandar pro backend. Acha o cabeçalho,
 *  ignora linhas totalmente vazias e linhas sem valor na coluna de
 *  nome (quando ela existe). */
export function rowsFromMatrix(matrix: unknown[][]): Record<string, string>[] {
  if (!matrix || matrix.length === 0) return [];
  const headerIdx = detectHeaderRowIndex(matrix);
  const headerRow = (matrix[headerIdx] || []) as unknown[];
  const headers = headerRow.map(normalizeText);
  const nameColIdx = findNameColumnIndex(headers);

  const rows: Record<string, string>[] = [];
  for (const raw of matrix.slice(headerIdx + 1)) {
    if (!raw || raw.length === 0) continue;
    const allEmpty = raw.every(c => normalizeText(c) === "");
    if (allEmpty) continue;
    if (nameColIdx >= 0 && !normalizeText(raw[nameColIdx])) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, i) => { if (h) row[h] = cellToRowValue(raw[i]); });
    if (Object.values(row).some(v => v !== "")) rows.push(row);
  }
  return rows;
}

// -- Resumo opcional do dry_run/import: unidades desconhecidas, --
// -- duplicatas e mapeamento de colunas sugerido pelo backend.   --
// Campos novos no backend, podem não vir — nesse caso não mostra nada.
const FIELD_LABELS_PT: Record<string, string> = {
  nome: "nome do produto",
  produto: "nome do produto",
  descricao: "nome do produto",
  preco_dinheiro: "preço no dinheiro",
  valor_dinheiro: "preço no dinheiro",
  preco_cartao: "preço no cartão",
  valor_cartao: "preço no cartão",
  marca: "marca",
  custo: "preço de custo",
  unidade: "unidade",
  unid: "unidade",
  estoque: "estoque",
  codigo: "código",
  sku: "código",
  categoria: "categoria",
  codigo_barras: "código de barras",
  barcode: "código de barras",
};

export function describeSuggestedMap(suggestedMap: unknown): { recognized: string[]; ignored: string[] } {
  if (!suggestedMap || typeof suggestedMap !== "object") return { recognized: [], ignored: [] };
  const recognized: string[] = [];
  const ignored: string[] = [];
  Object.entries(suggestedMap as Record<string, unknown>).forEach(([col, field]) => {
    if (!field) { ignored.push(col); return; }
    const key = String(field).toLowerCase();
    const label = FIELD_LABELS_PT[key] || String(field);
    recognized.push(`${col} → ${label}`);
  });
  return { recognized, ignored };
}

/** Mensagens extras e opcionais pra mostrar depois do resumo principal
 *  do import — só aparecem se o backend mandar os campos. */
export function buildImportExtras(data: unknown): string[] {
  const d = (data || {}) as Record<string, any>;
  const extras: string[] = [];

  if (Array.isArray(d.unidades_desconhecidas) && d.unidades_desconhecidas.length > 0) {
    extras.push(`Unidades que não reconhecemos: ${d.unidades_desconhecidas.join(", ")}`);
  }

  const dupList = Array.isArray(d.duplicates) ? d.duplicates : (Array.isArray(d.duplicate_rows) ? d.duplicate_rows : null);
  if (dupList && dupList.length > 0) {
    const n = dupList.length;
    const plural = n > 1;
    extras.push(`${n} produto${plural ? "s" : ""} já existe${plural ? "m" : ""} na sua loja e não v${plural ? "ão" : "ai"} entrar`);
  }

  const { recognized, ignored } = describeSuggestedMap(d.suggested_map);
  if (recognized.length > 0) extras.push(`Colunas reconhecidas: ${recognized.join("; ")}`);
  if (ignored.length > 0) extras.push(`Colunas não usadas: ${ignored.join(", ")}`);

  return extras;
}
