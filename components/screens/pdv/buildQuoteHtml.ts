// ============================================================
// AURA. — buildQuoteHtml
// Generates an HTML document for a printable quote/orcamento
// Includes company logo, items table, totals, and Aura footer
// ============================================================

export type QuoteItem = {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
};

export type QuoteOptions = {
  companyName: string;
  companyLogo?: string | null;
  companyPhone?: string;
  companyEmail?: string;
  companyCnpj?: string;
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod?: string;
  sellerName?: string;
  customerName?: string;
  notes?: string;
  validDays?: number;
};

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ","); };

export function buildQuoteHtml(opts: QuoteOptions): string {
  var date = new Date();
  var dateStr = date.toLocaleDateString("pt-BR");
  var quoteNum = "ORC-" + date.getFullYear() + String(date.getMonth() + 1).padStart(2, "0") + String(date.getDate()).padStart(2, "0") + "-" + String(Math.floor(Math.random() * 9999)).padStart(4, "0");
  var validUntil = new Date(date.getTime() + (opts.validDays || 15) * 86400000).toLocaleDateString("pt-BR");

  var logoHtml = opts.companyLogo
    ? '<img src="' + opts.companyLogo + '" style="max-height:60px;max-width:180px;object-fit:contain;border-radius:8px" />'
    : '<div style="width:60px;height:60px;background:#6d28d9;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:800">' + (opts.companyName || "A").charAt(0).toUpperCase() + '</div>';

  var rows = opts.items.map(function(item, i) {
    return '<tr>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937">' + (i + 1) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;font-weight:500">' + item.name + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center">' + item.qty + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:right">' + fmt(item.unitPrice) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;font-weight:600;text-align:right">' + fmt(item.total) + '</td>' +
      '</tr>';
  }).join("");

  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>Orcamento ' + quoteNum + '</title>' +
    '<style>' +
    '* { margin:0; padding:0; box-sizing:border-box; }' +
    'body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:#f9fafb; color:#1f2937; }' +
    '.page { max-width:800px; margin:20px auto; background:#fff; border-radius:16px; box-shadow:0 2px 12px rgba(0,0,0,0.08); overflow:hidden; }' +
    '.header { display:flex; justify-content:space-between; align-items:flex-start; padding:32px 32px 24px; border-bottom:2px solid #6d28d9; }' +
    '.company { display:flex; align-items:center; gap:16px; }' +
    '.company-info h1 { font-size:18px; font-weight:700; color:#1f2937; }' +
    '.company-info p { font-size:11px; color:#6b7280; margin-top:2px; }' +
    '.quote-info { text-align:right; }' +
    '.quote-info .num { font-size:16px; font-weight:700; color:#6d28d9; }' +
    '.quote-info .date { font-size:12px; color:#6b7280; margin-top:4px; }' +
    '.meta { display:flex; gap:24px; padding:16px 32px; background:#f3f4f6; flex-wrap:wrap; }' +
    '.meta-item { font-size:12px; color:#6b7280; }' +
    '.meta-item span { font-weight:600; color:#1f2937; }' +
    'table { width:100%; border-collapse:collapse; }' +
    'thead th { padding:10px 12px; font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.8px; border-bottom:2px solid #e5e7eb; text-align:left; }' +
    'thead th:nth-child(3),thead th:nth-child(4),thead th:nth-child(5) { text-align:center; }' +
    'thead th:nth-child(4),thead th:nth-child(5) { text-align:right; }' +
    '.totals { padding:20px 32px; display:flex; justify-content:flex-end; }' +
    '.totals-box { min-width:250px; }' +
    '.total-row { display:flex; justify-content:space-between; padding:6px 0; font-size:13px; color:#6b7280; }' +
    '.total-row.grand { font-size:20px; font-weight:800; color:#6d28d9; padding-top:10px; margin-top:8px; border-top:2px solid #6d28d9; }' +
    '.total-row.discount { color:#ef4444; }' +
    '.notes { padding:16px 32px; }' +
    '.notes-box { background:#f3f4f6; border-radius:10px; padding:14px; font-size:12px; color:#6b7280; line-height:1.5; }' +
    '.validity { padding:8px 32px 16px; font-size:11px; color:#6b7280; text-align:center; font-style:italic; }' +
    '.footer { background:#1a1a2e; padding:16px 32px; display:flex; justify-content:space-between; align-items:center; }' +
    '.footer-left { font-size:10px; color:rgba(255,255,255,0.5); }' +
    '.footer-right { display:flex; align-items:center; gap:6px; }' +
    '.footer-right span { font-size:11px; color:rgba(255,255,255,0.7); font-weight:600; letter-spacing:0.5px; }' +
    '.footer-dot { width:6px; height:6px; border-radius:3px; background:#6d28d9; }' +
    '.no-print { text-align:center; padding:16px; }' +
    '.no-print button { background:#6d28d9; color:#fff; border:none; padding:12px 32px; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; margin:0 8px; }' +
    '.no-print button.secondary { background:#e5e7eb; color:#374151; }' +
    '@media print { .no-print { display:none; } .page { box-shadow:none; margin:0; border-radius:0; } body { background:#fff; } }' +
    '</style></head><body>' +
    '<div class="no-print"><button onclick="window.print()">Imprimir orcamento</button><button class="secondary" onclick="window.close()">Fechar</button></div>' +
    '<div class="page">' +
    '<div class="header">' +
    '<div class="company">' + logoHtml + '<div class="company-info"><h1>' + (opts.companyName || "") + '</h1>' +
    (opts.companyPhone ? '<p>' + opts.companyPhone + '</p>' : '') +
    (opts.companyEmail ? '<p>' + opts.companyEmail + '</p>' : '') +
    (opts.companyCnpj ? '<p>CNPJ: ' + opts.companyCnpj + '</p>' : '') +
    '</div></div>' +
    '<div class="quote-info"><div class="num">' + quoteNum + '</div><div class="date">Data: ' + dateStr + '</div></div>' +
    '</div>' +
    '<div class="meta">' +
    (opts.customerName ? '<div class="meta-item">Cliente: <span>' + opts.customerName + '</span></div>' : '') +
    (opts.sellerName ? '<div class="meta-item">Vendedor(a): <span>' + opts.sellerName + '</span></div>' : '') +
    (opts.paymentMethod ? '<div class="meta-item">Pagamento: <span>' + opts.paymentMethod + '</span></div>' : '') +
    '<div class="meta-item">Validade: <span>' + validUntil + '</span></div>' +
    '</div>' +
    '<table><thead><tr>' +
    '<th>#</th><th>Item</th><th style="text-align:center">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Total</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div class="totals"><div class="totals-box">' +
    '<div class="total-row"><span>Subtotal (' + opts.items.length + ' ' + (opts.items.length === 1 ? 'item' : 'itens') + ')</span><span>' + fmt(opts.subtotal) + '</span></div>' +
    (opts.discount > 0 ? '<div class="total-row discount"><span>Desconto</span><span>-' + fmt(opts.discount) + '</span></div>' : '') +
    '<div class="total-row grand"><span>Total</span><span>' + fmt(opts.total) + '</span></div>' +
    '</div></div>' +
    (opts.notes ? '<div class="notes"><div class="notes-box">' + opts.notes + '</div></div>' : '') +
    '<div class="validity">Este orcamento e valido ate ' + validUntil + '. Valores sujeitos a alteracao apos esta data.</div>' +
    '<div class="footer">' +
    '<div class="footer-left">Documento gerado em ' + dateStr + ' as ' + date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + '</div>' +
    '<div class="footer-right"><div class="footer-dot"></div><span>Aura.</span><span style="color:rgba(255,255,255,0.4);font-weight:400"> www.getaura.com.br</span></div>' +
    '</div>' +
    '</div></body></html>';
}

export default buildQuoteHtml;
