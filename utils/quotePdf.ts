import { Platform } from "react-native";

// ============================================================
// AURA. — Quote PDF generator (D-FIX #5)
//
// Gera HTML do orcamento e abre janela print.
// Funciona sem libs:
//   - Web: window.open(html) + window.print()
//   - Mobile: Linking.openURL(data:url) -> abre no browser
//
// Layout:
//   - Header: logo do cliente (se houver) + nome
//   - Body: tabela itens com desconto
//   - Footer: "Aura - getaura.com.br"
//
// Sem persistencia no DB. Sem migration. Todos os planos.
// ============================================================

export type QuoteItem = {
  name: string;
  qty: number;
  unitPrice: number;
};

export type QuoteData = {
  items: QuoteItem[];
  customerName?: string | null;
  sellerName?: string | null;
  total: number;
  totalAfterDiscount?: number;
  discount?: number;
  notes?: string;
  companyName: string;
  companyLogoUrl?: string | null;
  companyPhone?: string | null;
  companyAddress?: string | null;
  validityDays?: number;  // padrao 7 dias
};

function fmt(n: number) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

function escapeHtml(str: string) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildQuoteHtml(data: QuoteData): string {
  var now = new Date();
  var quoteNumber = "ORC-" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "-" + String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
  var validUntil = new Date(now.getTime() + (data.validityDays || 7) * 24 * 60 * 60 * 1000);
  var dateStr = now.toLocaleDateString("pt-BR");
  var validStr = validUntil.toLocaleDateString("pt-BR");

  var itemRows = data.items.map(function(item) {
    var subtotal = item.qty * item.unitPrice;
    return '<tr>' +
      '<td>' + escapeHtml(item.name) + '</td>' +
      '<td class="num">' + item.qty + '</td>' +
      '<td class="num">' + fmt(item.unitPrice) + '</td>' +
      '<td class="num">' + fmt(subtotal) + '</td>' +
      '</tr>';
  }).join("");

  var displayTotal = data.totalAfterDiscount != null ? data.totalAfterDiscount : data.total;
  var hasDiscount = data.discount && data.discount > 0;

  var logoHtml = data.companyLogoUrl
    ? '<img src="' + escapeHtml(data.companyLogoUrl) + '" alt="logo" class="logo" />'
    : '<div class="logo-placeholder">' + escapeHtml((data.companyName || "?").charAt(0).toUpperCase()) + '</div>';

  return '<!DOCTYPE html>' +
'<html lang="pt-BR">' +
'<head>' +
'<meta charset="UTF-8" />' +
'<title>Orcamento ' + quoteNumber + '</title>' +
'<style>' +
'  * { box-sizing: border-box; margin: 0; padding: 0; }' +
'  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a2e; padding: 32px; max-width: 800px; margin: 0 auto; background: #fff; }' +
'  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #6d28d9; margin-bottom: 24px; }' +
'  .header-left { display: flex; align-items: center; gap: 16px; }' +
'  .logo { max-width: 80px; max-height: 80px; object-fit: contain; }' +
'  .logo-placeholder { width: 64px; height: 64px; background: #6d28d9; color: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; }' +
'  .company-info h1 { font-size: 22px; color: #1a1a2e; margin-bottom: 4px; }' +
'  .company-info .meta { font-size: 12px; color: #666; }' +
'  .quote-info { text-align: right; }' +
'  .quote-info .badge { display: inline-block; background: #f3e8ff; color: #6d28d9; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-bottom: 6px; }' +
'  .quote-info .number { font-size: 16px; font-weight: 700; color: #1a1a2e; }' +
'  .quote-info .date { font-size: 11px; color: #666; margin-top: 2px; }' +
'  .quote-info .valid { font-size: 11px; color: #f59e0b; margin-top: 4px; font-weight: 600; }' +
'  .info-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; padding: 14px; background: #f9fafb; border-radius: 8px; }' +
'  .info-block .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; margin-bottom: 4px; }' +
'  .info-block .value { font-size: 13px; color: #1a1a2e; font-weight: 600; }' +
'  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }' +
'  thead th { background: #6d28d9; color: #fff; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }' +
'  thead th:nth-child(2), thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }' +
'  tbody td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }' +
'  tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }' +
'  tbody tr:nth-child(even) { background: #fafafa; }' +
'  .totals { margin-top: 12px; }' +
'  .totals-row { display: flex; justify-content: space-between; padding: 6px 12px; font-size: 12px; }' +
'  .totals-row.discount { color: #ef4444; }' +
'  .totals-row.grand { background: #f3e8ff; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: 800; color: #6d28d9; margin-top: 6px; }' +
'  .notes { margin-top: 20px; padding: 12px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 11px; color: #78350f; }' +
'  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #999; }' +
'  .footer .brand { color: #6d28d9; font-weight: 700; letter-spacing: 0.5px; }' +
'  @media print { body { padding: 16px; } .no-print { display: none; } }' +
'  .actions { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; }' +
'  .actions button { background: #6d28d9; color: #fff; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 12px; }' +
'  .actions button:hover { background: #5b21b6; }' +
'</style>' +
'</head>' +
'<body>' +
'  <div class="actions no-print">' +
'    <button onclick="window.print()">Imprimir / Salvar PDF</button>' +
'  </div>' +
'  <div class="header">' +
'    <div class="header-left">' +
       logoHtml +
'      <div class="company-info">' +
'        <h1>' + escapeHtml(data.companyName) + '</h1>' +
         (data.companyPhone ? '<div class="meta">' + escapeHtml(data.companyPhone) + '</div>' : '') +
         (data.companyAddress ? '<div class="meta">' + escapeHtml(data.companyAddress) + '</div>' : '') +
'      </div>' +
'    </div>' +
'    <div class="quote-info">' +
'      <div class="badge">ORCAMENTO</div>' +
'      <div class="number">' + quoteNumber + '</div>' +
'      <div class="date">Emitido em ' + dateStr + '</div>' +
'      <div class="valid">Valido ate ' + validStr + '</div>' +
'    </div>' +
'  </div>' +
'  <div class="info-row">' +
'    <div class="info-block">' +
'      <div class="label">Cliente</div>' +
'      <div class="value">' + escapeHtml(data.customerName || "Consumidor final") + '</div>' +
'    </div>' +
     (data.sellerName
       ? '<div class="info-block"><div class="label">Atendido por</div><div class="value">' + escapeHtml(data.sellerName) + '</div></div>'
       : '<div></div>') +
'  </div>' +
'  <table>' +
'    <thead>' +
'      <tr><th>Item</th><th>Qtd</th><th>Unitario</th><th>Subtotal</th></tr>' +
'    </thead>' +
'    <tbody>' + itemRows + '</tbody>' +
'  </table>' +
'  <div class="totals">' +
'    <div class="totals-row"><span>Subtotal</span><span>' + fmt(data.total) + '</span></div>' +
     (hasDiscount ? '<div class="totals-row discount"><span>Desconto</span><span>-' + fmt(data.discount!) + '</span></div>' : '') +
'    <div class="totals-row grand"><span>Total</span><span>' + fmt(displayTotal) + '</span></div>' +
'  </div>' +
   (data.notes ? '<div class="notes">' + escapeHtml(data.notes) + '</div>' : '') +
'  <div class="footer">' +
'    <div>Orcamento gerado por <span class="brand">Aura</span> - getaura.com.br</div>' +
'    <div style="margin-top: 4px;">Este nao e um documento fiscal.</div>' +
'  </div>' +
'</body>' +
'</html>';
}

export function openQuotePdf(data: QuoteData) {
  var html = buildQuoteHtml(data);

  if (Platform.OS === "web" && typeof window !== "undefined") {
    var win = window.open("", "_blank");
    if (!win) {
      alert("Habilite popups pra gerar o orcamento.");
      return;
    }
    win.document.write(html);
    win.document.close();
    return;
  }

  // Mobile: tenta abrir em nova aba via data url (basico).
  // Pra produc UX mobile real, futuramente integrar expo-print.
  if (typeof window !== "undefined" && (window as any).Linking) {
    var dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    (window as any).Linking.openURL(dataUrl);
  }
}

export default openQuotePdf;
