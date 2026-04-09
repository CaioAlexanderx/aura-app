// ============================================================
// CSV Import/Export Utilities — pure JS, no external deps
// ============================================================
import { Platform } from "react-native";
import { toast } from "@/components/Toast";

// ── Export ───────────────────────────────────────────────────

function escapeCSV(val: any): string {
  if (val == null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function arrayToCSV(rows: Record<string, any>[], columns: { key: string; label: string }[]): string {
  const header = columns.map(c => escapeCSV(c.label)).join(",");
  const body = rows.map(row => columns.map(c => escapeCSV(row[c.key])).join(",")).join("\n");
  return header + "\n" + body;
}

export function downloadCSV(csv: string, filename: string) {
  if (Platform.OS !== "web") { toast.info("Export disponivel apenas na versao web"); return; }
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} exportado!`);
}

// ── Import ───────────────────────────────────────────────────

// Detect separator from header line: if more ; than , → semicolon file (Excel BR)
function detectSeparator(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function parseCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { current += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === sep) { result.push(current.trim()); current = ""; }
      else { current += c; }
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const sep = detectSeparator(headerLine);
  const headers = parseCSVLine(headerLine, sep).map(h => h.toLowerCase().trim());
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line, sep);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });
}

export function pickFileAndParse(): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== "web") { toast.info("Import disponivel apenas na versao web"); reject(new Error("web only")); return; }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt,.tsv";
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) { reject(new Error("no file")); return; }
      if (file.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande (max 5MB)"); reject(new Error("too large")); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(parseCSV(reader.result as string)); }
        catch (err) { toast.error("Erro ao ler CSV"); reject(err); }
      };
      reader.onerror = () => reject(new Error("read error"));
      reader.readAsText(file, "UTF-8");
    };
    input.click();
  });
}

// ── Column Definitions ──────────────────────────────────────

export const TRANSACTION_COLUMNS = [
  { key: "type", label: "Tipo" },
  { key: "amount", label: "Valor" },
  { key: "desc", label: "Descricao" },
  { key: "category", label: "Categoria" },
  { key: "date", label: "Data" },
];

export const PRODUCT_COLUMNS = [
  { key: "name", label: "Nome" },
  { key: "code", label: "Codigo" },
  { key: "barcode", label: "Codigo de barras" },
  { key: "category", label: "Categoria" },
  { key: "price", label: "Preco venda" },
  { key: "cost", label: "Custo" },
  { key: "stock", label: "Estoque" },
  { key: "minStock", label: "Estoque minimo" },
  { key: "unit", label: "Unidade" },
];

export const CUSTOMER_COLUMNS = [
  { key: "name", label: "Nome" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefone" },
  { key: "instagram", label: "Instagram" },
  { key: "birthday", label: "Aniversario" },
  { key: "notes", label: "Observacoes" },
];

// ── Row Mappers (CSV → app format) ──────────────────────────

export function mapImportedTransaction(row: Record<string, string>): { type: string; amount: number; description: string; category: string } | null {
  const desc = row.descricao || row.description || row.desc || row.nome || "";
  const amount = parseFloat((row.valor || row.amount || row.value || "0").replace(/[^0-9.,]/g, "").replace(",", "."));
  if (!desc || amount <= 0) return null;
  const rawType = (row.tipo || row.type || "").toLowerCase();
  const type = rawType.includes("despesa") || rawType.includes("expense") || rawType.includes("saida") ? "expense" : "income";
  const category = row.categoria || row.category || "Importado";
  return { type, amount, description: desc, category };
}

export function mapImportedProduct(row: Record<string, string>): Record<string, any> | null {
  const name = row.nome || row.name || row.produto || "";
  if (!name) return null;
  return {
    name,
    sku: row.codigo || row.code || row.sku || undefined,
    barcode: row["codigo de barras"] || row.barcode || row.ean || undefined,
    category: row.categoria || row.category || "Importado",
    price: parseFloat((row["preco venda"] || row.preco || row.price || "0").replace(/[^0-9.,]/g, "").replace(",", ".")) || 0,
    cost_price: parseFloat((row.custo || row.cost || row.cost_price || "0").replace(/[^0-9.,]/g, "").replace(",", ".")) || 0,
    stock_qty: parseInt(row.estoque || row.stock || row.quantidade || "0") || 0,
    min_stock: parseInt(row["estoque minimo"] || row.min_stock || row.minstock || "0") || 0,
    unit: row.unidade || row.unit || "un",
  };
}

export function mapImportedCustomer(row: Record<string, string>): Record<string, any> | null {
  const name = row.nome || row.name || row.cliente || "";
  if (!name) return null;
  return {
    name,
    email: row.email || undefined,
    phone: row.telefone || row.phone || row.whatsapp || row.celular || undefined,
    instagram_handle: row.instagram || undefined,
    birth_date: row.aniversario || row.birthday || row.nascimento || undefined,
    notes: row.observacoes || row.notes || row.obs || undefined,
  };
}
