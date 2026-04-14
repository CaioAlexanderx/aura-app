// ============================================================
// CSV Import/Export Utilities — pure JS, no external deps
// FIX: mapImportedTransaction handles empty descriptions,
//      DD/MM/YYYY dates, comma decimals, vendedor field
// ============================================================
import { Platform } from "react-native";
import { toast } from "@/components/Toast";

// -- Export --
const SEP = ";";
function escapeCSV(val: any): string { if (val == null) return ""; const str = String(val); if (str.includes(SEP) || str.includes('"') || str.includes("\n")) return '"' + str.replace(/"/g, '""') + '"'; return str; }
function fmtBRL(val: any): string { const n = parseFloat(val); if (isNaN(n)) return ""; return n.toFixed(2).replace(".", ","); }

export function arrayToCSV(rows: Record<string, any>[], columns: { key: string; label: string; format?: "brl" | "int" | "text" }[]): string {
  const header = columns.map(c => escapeCSV(c.label)).join(SEP);
  const body = rows.map(row => columns.map(c => { const val = row[c.key]; if (c.format === "brl") return fmtBRL(val); if (c.format === "int") return val != null ? String(Math.round(Number(val))) : ""; return escapeCSV(val); }).join(SEP)).join("\n");
  return header + "\n" + body;
}

export function downloadCSV(csv: string, filename: string) {
  if (Platform.OS !== "web") { toast.info("Export disponivel apenas na versao web"); return; }
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} exportado!`);
}

// -- Import --
function detectSeparator(headerLine: string): string { const semicolons = (headerLine.match(/;/g) || []).length; const commas = (headerLine.match(/,/g) || []).length; return semicolons > commas ? ";" : ","; }

function parseCSVLine(line: string, sep: string): string[] {
  const result: string[] = []; let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) { if (c === '"' && line[i + 1] === '"') { current += '"'; i++; } else if (c === '"') { inQuotes = false; } else { current += c; } }
    else { if (c === '"') { inQuotes = true; } else if (c === sep) { result.push(current.trim()); current = ""; } else { current += c; } }
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
    input.type = "file"; input.accept = ".csv,.txt,.tsv,.xlsx";
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) { reject(new Error("no file")); return; }
      if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo muito grande (max 10MB)"); reject(new Error("too large")); return; }
      const reader = new FileReader();
      reader.onload = () => { try { resolve(parseCSV(reader.result as string)); } catch (err) { toast.error("Erro ao ler CSV"); reject(err); } };
      reader.onerror = () => reject(new Error("read error"));
      reader.readAsText(file, "UTF-8");
    };
    input.click();
  });
}

// -- Column Definitions --
export const TRANSACTION_COLUMNS: { key: string; label: string; format?: any }[] = [
  { key: "type", label: "Tipo" }, { key: "amount", label: "Valor (R$)", format: "brl" },
  { key: "desc", label: "Descricao" }, { key: "category", label: "Categoria" }, { key: "date", label: "Data" },
];

export const PRODUCT_COLUMNS: { key: string; label: string; format?: any }[] = [
  { key: "name", label: "Nome do produto" }, { key: "code", label: "SKU / Codigo interno" },
  { key: "barcode", label: "Codigo de barras (EAN)" }, { key: "category", label: "Categoria" },
  { key: "brand", label: "Marca" }, { key: "unit", label: "Unidade" },
  { key: "price", label: "Preco de venda (R$)", format: "brl" }, { key: "cost", label: "Preco de custo (R$)", format: "brl" },
  { key: "stock", label: "Estoque atual", format: "int" }, { key: "minStock", label: "Estoque minimo", format: "int" },
  { key: "sold30d", label: "Vendas ultimos 30 dias", format: "int" }, { key: "abc", label: "Curva ABC" },
  { key: "color", label: "Cor" }, { key: "size", label: "Tamanho" }, { key: "notes", label: "Observacoes" },
];

export const CUSTOMER_COLUMNS: { key: string; label: string; format?: any }[] = [
  { key: "name", label: "Nome" }, { key: "email", label: "Email" }, { key: "phone", label: "Telefone" },
  { key: "instagram", label: "Instagram" }, { key: "birthday", label: "Aniversario" },
  { key: "totalSpent", label: "Total gasto (R$)", format: "brl" }, { key: "visits", label: "Visitas", format: "int" },
  { key: "lastPurchase", label: "Ultima compra" }, { key: "notes", label: "Observacoes" },
];

// -- Helpers --
function parseBRDate(d: string): string {
  if (!d) return "";
  const s = d.trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  // DD/MM/YY
  const brShort = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (brShort) { const yr = parseInt(brShort[3]) > 50 ? "19" + brShort[3] : "20" + brShort[3]; return `${yr}-${brShort[2].padStart(2, "0")}-${brShort[1].padStart(2, "0")}`; }
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

function parseBRAmount(v: string): number {
  if (!v) return 0;
  let raw = v.replace(/[R$\s]/g, "");
  // 1.500,00 → 1500.00
  if (raw.includes(".") && raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  else if (raw.includes(",")) raw = raw.replace(",", ".");
  return parseFloat(raw) || 0;
}

// -- Row Mappers --

// FIX: handles empty descriptions, DD/MM/YYYY dates, comma decimals, vendedor
export function mapImportedTransaction(row: Record<string, string>): {
  type: string; amount: number; description: string; category: string;
  due_date: string; vendedor?: string;
} | null {
  // Parse amount (handles comma decimal and R$ prefix)
  const rawAmt = row.valor || row["valor (r$)"] || row.amount || row.value || "0";
  const amount = parseBRAmount(rawAmt);
  if (amount <= 0) return null;

  // Parse type (accepts Portuguese)
  const rawType = (row.tipo || row.type || "").toLowerCase().trim();
  const type = (rawType.includes("despesa") || rawType.includes("expense") || rawType.includes("saida") || rawType.includes("debito") || rawType.includes("custo"))
    ? "expense" : "income";

  // Parse date (handles DD/MM/YYYY)
  const rawDate = row.data || row.date || row.due_date || row.vencimento || "";
  const due_date = parseBRDate(rawDate);

  // Parse description — AUTO-GENERATE if empty
  let desc = (row.descricao || row.description || row.desc || row.nome || "").trim();
  const vendedor = (row.vendedor || row.employee_name || row.seller || row.funcionario || "").trim();
  const category = (row.categoria || row.category || "").trim() || "Importado";

  if (!desc) {
    // Build from context: "Venda Kaila 18/03/2025" or "Despesa Fixas 05/10/2025"
    const parts: string[] = [];
    parts.push(type === "income" ? "Venda" : "Despesa");
    if (vendedor) parts.push(vendedor);
    if (category && category !== "Importado") parts.push(category);
    if (rawDate) parts.push(rawDate);
    desc = parts.join(" ");
  }

  const result: any = { type, amount, description: desc, category, due_date };
  if (vendedor) result.vendedor = vendedor;
  return result;
}

export function mapImportedProduct(row: Record<string, string>): Record<string, any> | null {
  const name = row["nome do produto"] || row.nome || row.name || row.produto || "";
  if (!name) return null;
  return {
    name,
    sku: row["sku / codigo interno"] || row.sku || row.codigo || undefined,
    barcode: row["codigo de barras (ean)"] || row["codigo de barras"] || row.barcode || row.ean || undefined,
    category: row.categoria || row.category || "Importado",
    brand: row.marca || row.brand || undefined,
    price: parseBRAmount(row["preco de venda (r$)"] || row["preco venda"] || row.preco || row.price || "0"),
    cost_price: parseBRAmount(row["preco de custo (r$)"] || row["preco custo"] || row.custo || row.cost || "0"),
    stock_qty: parseInt(row["estoque atual"] || row.estoque || row.stock || row.quantidade || "0") || 0,
    min_stock: parseInt(row["estoque minimo"] || row.min_stock || row.minstock || "0") || 0,
    unit: row.unidade || row.unit || "un",
    color: row.cor || row.color || undefined,
    size: row.tamanho || row.size || undefined,
    notes: row.observacoes || row.notes || undefined,
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
