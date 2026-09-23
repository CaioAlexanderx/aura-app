// ============================================================
// AURA. — buildQuoteHtml
// Gera HTML de orcamento para impressao
// Logo do cliente + itens + total + rodape Aura
//
// 22/09/2026 (Matcon M0): o item pode trazer a unidade de venda. Com ela, a
// coluna Qtd imprime "12,5 m²" (fmtQty, virgula e sufixo); sem ela, imprime
// o numero cru como sempre imprimiu.
//
// 22/09/2026 (preco no cartao): o botao do Caixa usa utils/quotePdf.ts; este
// gemeo recebe a mesma mudanca pra os dois nao divergirem — `cardTotal` e
// `cardUnitPrice` opcionais; sem eles o HTML e o de sempre.
// ============================================================

import { quantidadeImpressa } from "@/utils/quotePdf";

export type QuoteItem = {
  name: string;
  qty: number;
  unitPrice: number;
  unit?: string | null;
  cardUnitPrice?: number;
};

export type QuoteOptions = {
  companyName: string;
  companyCnpj?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyLogo?: string;
  customerName?: string;
  items: QuoteItem[];
  total: number;
  /** Preco no cartao: total no cartao. Ausente = um preco so. */
  cardTotal?: number;
  sellerName?: string;
  validDays?: number;
  notes?: string;
};

var fmtBrl = function(n: number) {
  return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export function buildQuoteHtml(opts: QuoteOptions): string {
  var now = new Date();
  var dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  var validDays = opts.validDays || 15;
  var validDate = new Date(now.getTime() + validDays * 86400000);
  var validStr = validDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  var quoteNum = "ORC-" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "-" + String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");

  var itemsHtml = opts.items.map(function(item, i) {
    var lineTotal = item.qty * item.unitPrice;
    // Milheiro: "0,5 milheiro (500 peças)" — o preço é por milheiro, a conta
    // fecha com a coluna ao lado, e o cliente lê quantos tijolos vêm. Mesma
    // regra do utils/quotePdf.ts (quantidadeImpressa).
    var qtyStr = quantidadeImpressa(item.qty, item.unit);
    return '<tr>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937">' + (i + 1) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;font-weight:500">' + escHtml(item.name) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center">' + escHtml(qtyStr) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:right">' + fmtBrl(item.unitPrice) + cartaoSmall(opts.cardTotal != null ? (item.cardUnitPrice ?? item.unitPrice) : null) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;font-weight:600;text-align:right">' + fmtBrl(lineTotal) + cartaoSmall(opts.cardTotal != null ? item.qty * (item.cardUnitPrice ?? item.unitPrice) : null) + '</td>' +
      '</tr>';
  }).join("\n");

  var logoHtml = opts.companyLogo
    ? '<img src="' + opts.companyLogo + '" style="max-height:60px;max-width:180px;object-fit:contain" />'
    : '<div style="width:60px;height:60px;border-radius:14px;background:#6d28d9;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:800">' + (opts.companyName || "A").charAt(0).toUpperCase() + '</div>';

  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orçamento ' + quoteNum + '</title>' +
    '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1f2937;background:#fff;padding:40px}' +
    '@media print{body{padding:20px}@page{margin:15mm 10mm;size:A4}}' +
    '.container{max-width:720px;margin:0 auto}' +
    '</style></head><body>' +
    '<div class="container">' +

    // Header
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #6d28d9">' +
      '<div style="display:flex;align-items:center;gap:16px">' + logoHtml +
        '<div>' +
          '<div style="font-size:18px;font-weight:700;color:#1f2937">' + escHtml(opts.companyName) + '</div>' +
          (opts.companyCnpj ? '<div style="font-size:11px;color:#6b7280;margin-top:2px">CNPJ: ' + escHtml(opts.companyCnpj) + '</div>' : '') +
          (opts.companyPhone ? '<div style="font-size:11px;color:#6b7280">' + escHtml(opts.companyPhone) + '</div>' : '') +
          (opts.companyAddress ? '<div style="font-size:11px;color:#6b7280">' + escHtml(opts.companyAddress) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div style="text-align:right">' +
        '<div style="font-size:20px;font-weight:800;color:#6d28d9">ORÇAMENTO</div>' +
        '<div style="font-size:11px;color:#6b7280;margin-top:4px">' + quoteNum + '</div>' +
        '<div style="font-size:11px;color:#6b7280">Data: ' + dateStr + '</div>' +
        '<div style="font-size:11px;color:#6b7280">Válido até: ' + validStr + '</div>' +
      '</div>' +
    '</div>' +

    // Cliente
    (opts.customerName ? '<div style="margin-bottom:20px;padding:12px 16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb"><span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Cliente:</span> <span style="font-size:13px;font-weight:600;color:#1f2937">' + escHtml(opts.customerName) + '</span></div>' : '') +

    // Table
    '<table style="width:100%;border-collapse:collapse;margin-bottom:24px">' +
      '<thead><tr style="background:#f3f4f6">' +
        '<th style="padding:10px 12px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;width:40px">#</th>' +
        '<th style="padding:10px 12px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Item</th>' +
        '<th style="padding:10px 12px;text-align:center;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;width:120px">Quantidade</th>' +
        '<th style="padding:10px 12px;text-align:right;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;width:100px">Preço unitário</th>' +
        '<th style="padding:10px 12px;text-align:right;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;width:100px">Total</th>' +
      '</tr></thead>' +
      '<tbody>' + itemsHtml + '</tbody>' +
    '</table>' +

    // Total
    '<div style="display:flex;justify-content:flex-end;margin-bottom:24px">' +
      '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 24px;min-width:220px;text-align:right">' +
        '<div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">' + (opts.items.length === 1 ? '1 item' : opts.items.length + ' itens') + '</div>' +
        (opts.cardTotal != null
          ? '<div style="font-size:11px;color:#6b7280">Dinheiro ou PIX</div>' +
            '<div style="font-size:24px;font-weight:800;color:#1f2937">' + fmtBrl(opts.total) + '</div>' +
            '<div style="font-size:11px;color:#6b7280;margin-top:6px">No cart\u00e3o (d\u00e9bito ou cr\u00e9dito)</div>' +
            '<div style="font-size:24px;font-weight:800;color:#6d28d9">' + fmtBrl(opts.cardTotal) + '</div>'
          : '<div style="font-size:28px;font-weight:800;color:#6d28d9">' + fmtBrl(opts.total) + '</div>') +
      '</div>' +
    '</div>' +

    // Notes
    (opts.notes ? '<div style="margin-bottom:24px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e">' + escHtml(opts.notes) + '</div>' : '') +

    // Seller
    (opts.sellerName ? '<div style="margin-bottom:20px;font-size:12px;color:#6b7280">Vendedor(a): <strong style="color:#1f2937">' + escHtml(opts.sellerName) + '</strong></div>' : '') +

    // Conditions
    '<div style="margin-bottom:32px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">' +
      '<div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Condições</div>' +
      '<div style="font-size:11px;color:#6b7280;line-height:18px">' +
        'Este orçamento tem validade de ' + validDays + ' dias a partir da data de emissão.<br>' +
        'Valores sujeitos a alteração após o vencimento.<br>' +
        'Este documento não possui valor fiscal.' +
      '</div>' +
    '</div>' +

    // Footer: Aura branding
    '<div style="text-align:center;padding-top:20px;border-top:1px solid #e5e7eb">' +
      '<div style="font-size:11px;color:#9ca3af">Documento gerado por</div>' +
      '<div style="font-size:14px;font-weight:700;color:#6d28d9;margin-top:2px">Aura.</div>' +
      '<div style="font-size:11px;color:#9ca3af">www.getaura.com.br</div>' +
    '</div>' +

    '</div>' +
    '<script>window.onload=function(){window.print()}</script>' +
    '</body></html>';
}

function cartaoSmall(v: number | null): string {
  if (v == null) return "";
  return '<div style="font-size:10px;color:#6d28d9;margin-top:2px">cart\u00e3o ' + fmtBrl(v) + '</div>';
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
