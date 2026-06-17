// utils/dreReport.ts
//
// Geração do relatório financeiro em modelo DRE (gerencial) para exportação
// em PDF. 100% client-side: monta um HTML A4 estilizado e abre uma janela de
// impressão (o usuário escolhe "Salvar como PDF"). Sem dependência de lib de
// PDF (o projeto não tem, e não dá pra mexer no lock do npm ci).
//
// Estrutura do PDF (decisões 17/06/2026):
//   - Cabeçalho: empresa (ou "Consolidado · N empresas"), período, emissão.
//   - DRE gerencial por categoria: Receitas, Despesas, Resultado + margem.
//   - Consolidado: DRE somado + um bloco resumido por empresa.
//   - Anexo: tabela com TODOS os lançamentos do período.
//
// Considera apenas lançamentos CONFIRMADOS (realizado) no DRE; o anexo lista
// todos (confirmados e pendentes), com a coluna Status.
import { Platform } from "react-native";
import type { Transaction } from "@/components/screens/financeiro/types";

function round2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }

function brl(n: number): string {
  return "R$ " + round2(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s: any): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function txDateRaw(t: Transaction): string {
  return (t as any).due_date || (t as any).created_at || (t as any).paid_at || t.date || "";
}

function fmtDateBR(raw: string): string {
  if (!raw) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    var p = raw.slice(0, 10).split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }
  var d = new Date(raw);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export type CatRow = { category: string; amount: number; pct: number };
export type DreModel = {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  marginPct: number;
  income: CatRow[];
  expenses: CatRow[];
};

// Monta o DRE (somente confirmados) agrupando por categoria.
export function buildDreModel(txs: Transaction[]): DreModel {
  var conf = txs.filter(function (t) { return t.status === "confirmed"; });

  function group(kind: "income" | "expense"): { rows: CatRow[]; total: number } {
    var map: Record<string, number> = {};
    conf.filter(function (t) { return t.type === kind; })
      .forEach(function (t) { var c = t.category || "Outros"; map[c] = (map[c] || 0) + (t.amount || 0); });
    var total = Object.keys(map).reduce(function (s, k) { return s + map[k]; }, 0);
    var rows = Object.keys(map).map(function (k) {
      return { category: k, amount: map[k], pct: total > 0 ? (map[k] / total) * 100 : 0 };
    });
    rows.sort(function (a, b) { return b.amount - a.amount; });
    return { rows: rows, total: total };
  }

  var inc = group("income");
  var exp = group("expense");
  var net = inc.total - exp.total;
  return {
    totalIncome: inc.total,
    totalExpenses: exp.total,
    net: net,
    marginPct: inc.total > 0 ? (net / inc.total) * 100 : 0,
    income: inc.rows,
    expenses: exp.rows,
  };
}

function dreTableHtml(m: DreModel): string {
  function catRows(rows: CatRow[], sign: string, cls: string): string {
    if (rows.length === 0) return '<tr><td class="cat">—</td><td class="num">' + sign + brl(0) + "</td><td class=\"pct\">—</td></tr>";
    return rows.map(function (r) {
      return '<tr><td class="cat">' + esc(r.category) + '</td><td class="num ' + cls + '">' + sign + brl(r.amount) +
        '</td><td class="pct">' + r.pct.toFixed(1).replace(".", ",") + "%</td></tr>";
    }).join("");
  }
  var netCls = m.net >= 0 ? "pos" : "neg";
  return '' +
    '<table class="dre">' +
    '<thead><tr><th>Categoria</th><th class="num">Valor</th><th class="pct">%</th></tr></thead>' +
    '<tbody>' +
    '<tr class="grp"><td colspan="3">RECEITAS</td></tr>' +
    catRows(m.income, "", "pos") +
    '<tr class="subtotal"><td>Total de receitas</td><td class="num pos">' + brl(m.totalIncome) + '</td><td class="pct"></td></tr>' +
    '<tr class="grp"><td colspan="3">DESPESAS</td></tr>' +
    catRows(m.expenses, "− ", "neg") +
    '<tr class="subtotal"><td>Total de despesas</td><td class="num neg">− ' + brl(m.totalExpenses) + '</td><td class="pct"></td></tr>' +
    '<tr class="result"><td>RESULTADO LÍQUIDO</td><td class="num ' + netCls + '">' + (m.net >= 0 ? "" : "− ") + brl(Math.abs(m.net)) +
      '</td><td class="pct">' + m.marginPct.toFixed(1).replace(".", ",") + "%</td></tr>" +
    '</tbody></table>';
}

function annexHtml(txs: Transaction[], showCompany: boolean): string {
  var sorted = txs.slice().sort(function (a, b) {
    return txDateRaw(b).localeCompare(txDateRaw(a));
  });
  var rows = sorted.map(function (t) {
    var isInc = t.type === "income";
    var val = (isInc ? "" : "− ") + brl(t.amount || 0);
    return "<tr>" +
      '<td>' + fmtDateBR(txDateRaw(t)) + "</td>" +
      (showCompany ? '<td>' + esc((t as any).company_name || "—") + "</td>" : "") +
      '<td>' + esc(t.desc) + "</td>" +
      '<td>' + esc(t.category || "Outros") + "</td>" +
      '<td>' + (isInc ? "Receita" : "Despesa") + "</td>" +
      '<td>' + (t.status === "confirmed" ? "Confirmado" : "Pendente") + "</td>" +
      '<td class="num ' + (isInc ? "pos" : "neg") + '">' + val + "</td>" +
      "</tr>";
  }).join("");
  return '' +
    '<h2 class="annex-title">Anexo — Lançamentos do período (' + sorted.length + ")</h2>" +
    '<table class="annex">' +
    "<thead><tr><th>Data</th>" + (showCompany ? "<th>Empresa</th>" : "") +
    "<th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Status</th><th class=\"num\">Valor</th></tr></thead>" +
    "<tbody>" + (rows || '<tr><td colspan="' + (showCompany ? 7 : 6) + '" class="empty">Nenhum lançamento no período.</td></tr>') + "</tbody></table>";
}

export type DreReportOpts = {
  periodLabel: string;
  companyLabel: string;
  consolidated: boolean;
  transactions: Transaction[];
};

// Monta o HTML completo e abre a janela de impressão. Retorna false se bloqueado.
export function exportDreReport(opts: DreReportOpts): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;

  var model = buildDreModel(opts.transactions);
  var now = new Date();
  var emitido = now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Seção por empresa (consolidado): agrupa transações por company_name.
  var perCompany = "";
  if (opts.consolidated) {
    var byCo: Record<string, Transaction[]> = {};
    opts.transactions.forEach(function (t) {
      var name = (t as any).company_name || "Sem empresa";
      (byCo[name] = byCo[name] || []).push(t);
    });
    var names = Object.keys(byCo).sort();
    perCompany = '<h2 class="section-title">Resultado por empresa</h2>' +
      '<table class="bycompany"><thead><tr><th>Empresa</th><th class="num">Receitas</th><th class="num">Despesas</th><th class="num">Resultado</th><th class="pct">Margem</th></tr></thead><tbody>' +
      names.map(function (n) {
        var mm = buildDreModel(byCo[n]);
        var cls = mm.net >= 0 ? "pos" : "neg";
        return "<tr><td>" + esc(n) + '</td><td class="num pos">' + brl(mm.totalIncome) +
          '</td><td class="num neg">− ' + brl(mm.totalExpenses) + '</td><td class="num ' + cls + '">' +
          (mm.net >= 0 ? "" : "− ") + brl(Math.abs(mm.net)) + '</td><td class="pct">' +
          mm.marginPct.toFixed(1).replace(".", ",") + "%</td></tr>";
      }).join("") +
      "</tbody></table>";
  }

  var html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    "<title>DRE — " + esc(opts.companyLabel) + "</title>" +
    "<style>" +
    "@page { size: A4; margin: 16mm 14mm; }" +
    "* { box-sizing: border-box; }" +
    "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; margin: 0; font-size: 12px; }" +
    ".head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #7c3aed; padding-bottom: 12px; margin-bottom: 18px; }" +
    ".brand { font-size: 22px; font-weight: 800; color: #7c3aed; letter-spacing: -0.5px; }" +
    ".brand small { display:block; font-size: 11px; font-weight: 600; color: #6b7280; letter-spacing: 2px; margin-top: 2px; }" +
    ".meta { text-align: right; font-size: 11px; color: #4b5563; line-height: 1.6; }" +
    ".meta b { color: #1a1a2e; }" +
    "h1 { font-size: 16px; margin: 0 0 2px; }" +
    ".section-title, .annex-title { font-size: 13px; font-weight: 800; color: #7c3aed; text-transform: uppercase; letter-spacing: 1px; margin: 22px 0 8px; }" +
    "table { width: 100%; border-collapse: collapse; }" +
    ".dre th, .dre td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }" +
    ".dre th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #d1d5db; }" +
    ".num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }" +
    ".pct { text-align: right; color: #6b7280; width: 64px; }" +
    ".cat { padding-left: 22px; color: #374151; }" +
    ".grp td { background: #f5f3ff; font-weight: 800; font-size: 10px; letter-spacing: 1px; color: #6d28d9; text-transform: uppercase; padding: 6px 10px; }" +
    ".subtotal td { font-weight: 700; border-top: 1px solid #d1d5db; }" +
    ".result td { font-weight: 800; font-size: 13px; border-top: 2px solid #7c3aed; background: #faf8ff; }" +
    ".pos { color: #059669; }" +
    ".neg { color: #dc2626; }" +
    ".bycompany th, .bycompany td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }" +
    ".bycompany th { font-size: 10px; text-transform: uppercase; color: #6b7280; }" +
    ".annex { margin-top: 4px; }" +
    ".annex th, .annex td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 10.5px; text-align: left; }" +
    ".annex th { background: #f9fafb; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #6b7280; }" +
    ".annex .empty { text-align: center; color: #9ca3af; padding: 16px; }" +
    ".annex-title { page-break-before: always; }" +
    ".foot { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9.5px; color: #9ca3af; text-align: center; }" +
    "@media print { .noprint { display: none !important; } }" +
    ".noprint { position: fixed; top: 12px; right: 12px; }" +
    ".noprint button { background: #7c3aed; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }" +
    "</style></head><body>" +
    '<div class="noprint"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>' +
    '<div class="head">' +
    '<div><div class="brand">Aura.<small>FINANCEIRO</small></div></div>' +
    '<div class="meta"><b>' + esc(opts.companyLabel) + "</b><br>Período: <b>" + esc(opts.periodLabel) + "</b><br>Emitido em " + esc(emitido) + "</div>" +
    "</div>" +
    "<h1>Demonstrativo de Resultados (DRE gerencial)</h1>" +
    dreTableHtml(model) +
    perCompany +
    annexHtml(opts.transactions, opts.consolidated) +
    '<div class="foot">Relatório gerencial gerado pela Aura · não substitui a contabilidade oficial.</div>' +
    "<script>window.onload=function(){setTimeout(function(){window.print();},350);};</script>" +
    "</body></html>";

  var w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
