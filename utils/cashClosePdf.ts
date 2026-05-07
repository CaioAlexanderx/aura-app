import { Platform } from "react-native";

// ============================================================
// AURA. — Cash Close PDF generator
//
// Espelha o padrão de quotePdf.ts: gera HTML do relatório de
// fechamento de caixa e abre janela print.
//
// Funciona sem libs:
//   - Web: window.open(html) + window.print()
//   - Mobile: data:url via Linking
//
// Layout (Aura DNA):
//   - Header: gradiente violeta (#6d28d9 -> #4f5bd5) + logo
//   - 4 KPIs do dia (vendas, clientes novos, faturamento, ticket médio)
//   - Conferência de caixa (esperado vs contado vs diferença)
//   - Distribuição por forma de pagamento (barras horizontais)
//   - Footer com identidade Aura
// ============================================================

export type CashClosePaymentRow = {
  /** Label visível ("Pix", "Crédito", "Dinheiro", etc) */
  label: string;
  amount: number;
};

export type CashCloseData = {
  /** Nome da empresa para o header */
  companyName: string;
  /** CNPJ formatado, opcional */
  companyCnpj?: string | null;
  /** Operador responsável pelo caixa */
  operatorName: string;
  /** ISO timestamps */
  openedAtIso: string;
  closedAtIso: string;
  /** Identificador curto da sessão (#00184) */
  sessaoLabel?: string;

  // Métricas do dia
  salesCount: number;
  newCustomersCount: number;
  grossRevenue: number;
  /** ticket médio — calculamos se não vier */
  averageTicket?: number;

  // Conferência de caixa
  trocoInicial: number;
  vendasEmDinheiro: number;
  dinheiroEsperado: number;
  dinheiroContado: number;
  /** = contado - esperado (negativo = falta, positivo = sobra, zero = exato) */
  diferenca: number;
  observacao?: string | null;

  // Distribuição
  paymentMix: CashClosePaymentRow[];
};

function fmt(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildCashClosePdfHtml(data: CashCloseData): string {
  const total = Math.max(
    1,
    data.paymentMix.reduce((acc, p) => acc + p.amount, 0)
  );
  const ticket =
    data.averageTicket != null
      ? data.averageTicket
      : data.salesCount > 0
        ? data.grossRevenue / data.salesCount
        : 0;

  const diffColor = data.diferenca === 0 ? "#059669" : data.diferenca > 0 ? "#6d28d9" : "#dc2626";
  const diffLabel =
    data.diferenca === 0
      ? "Exato"
      : data.diferenca > 0
        ? "+ " + fmt(data.diferenca) + " (sobra)"
        : "- " + fmt(Math.abs(data.diferenca)) + " (falta)";

  const sortedMix = [...data.paymentMix].sort((a, b) => b.amount - a.amount);
  const mixRows = sortedMix
    .map((p) => {
      const pct = (p.amount / total) * 100;
      return (
        '<div class="pay-row">' +
        '<span class="pay-name">' + escapeHtml(p.label) + "</span>" +
        '<div class="bar-wrap"><div class="bar" style="width:' + pct.toFixed(1) + '%;"></div></div>' +
        '<span class="pay-pct">' + pct.toFixed(1).replace(".", ",") + "%</span>" +
        '<span class="pay-val">' + fmt(p.amount) + "</span>" +
        "</div>"
      );
    })
    .join("");

  return (
    "<!DOCTYPE html>" +
    '<html lang="pt-BR">' +
    "<head>" +
    '<meta charset="UTF-8" />' +
    "<title>Fechamento de Caixa - " + escapeHtml(data.companyName) + "</title>" +
    "<style>" +
    "* { box-sizing: border-box; margin: 0; padding: 0; }" +
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #18172b; max-width: 800px; margin: 0 auto; background: #fff; }' +
    ".head { padding: 24px 28px; background: linear-gradient(135deg, #6d28d9 0%, #4f5bd5 100%); color: #fff; display: flex; align-items: center; gap: 16px; }" +
    ".head .logo { width: 46px; height: 46px; border-radius: 11px; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.28); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; flex-shrink: 0; }" +
    ".head h1 { font-size: 17px; font-weight: 700; letter-spacing: -0.2px; }" +
    ".head .sub { margin-top: 3px; font-size: 11px; opacity: 0.82; letter-spacing: 0.4px; text-transform: uppercase; }" +
    '.head .meta { margin-left: auto; text-align: right; font-size: 10px; opacity: 0.85; line-height: 1.5; font-family: ui-monospace, "SF Mono", Menlo, monospace; }' +
    ".head .meta b { font-weight: 700; }" +
    ".body { padding: 26px 28px; }" +
    ".s-title { font-size: 11px; color: #6a608e; text-transform: uppercase; letter-spacing: 0.7px; font-weight: 700; margin-bottom: 12px; }" +
    ".s-title + .s-title { margin-top: 22px; }" +
    ".kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }" +
    ".kpi { background: #faf9fd; border: 1px solid rgba(109,40,217,0.16); border-radius: 8px; padding: 12px 14px; }" +
    ".kpi .l { font-size: 10px; color: #6a608e; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }" +
    ".kpi .v { font-size: 19px; font-weight: 700; color: #1a1730; margin-top: 4px; letter-spacing: -0.3px; }" +
    ".kpi .v.violet { color: #6d28d9; }" +
    ".summary { background: #faf9fd; border-radius: 8px; padding: 14px 18px; border: 1px solid rgba(109,40,217,0.10); }" +
    ".row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 12px; border-bottom: 1px solid rgba(109,40,217,0.08); }" +
    ".row:last-child { border-bottom: none; }" +
    ".row .lab { color: #4a4366; }" +
    ".row .val { color: #18172b; font-weight: 600; font-variant-numeric: tabular-nums; }" +
    ".row .val.diff { font-weight: 700; }" +
    ".pay-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(109,40,217,0.08); }" +
    ".pay-row:last-child { border-bottom: none; }" +
    ".pay-name { font-size: 12px; width: 110px; color: #4a4366; font-weight: 500; }" +
    ".bar-wrap { flex: 1; height: 8px; background: #f0eef7; border-radius: 4px; overflow: hidden; }" +
    ".bar { height: 100%; background: linear-gradient(90deg, #6d28d9, #8b5cf6); border-radius: 4px; }" +
    ".pay-pct { font-size: 11px; color: #6a608e; width: 56px; text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, monospace; }" +
    ".pay-val { font-size: 11px; color: #18172b; width: 96px; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }" +
    ".foot { padding: 14px 28px; border-top: 1px solid #ece8f5; background: #faf9fd; font-size: 10px; color: #6a608e; display: flex; justify-content: space-between; gap: 16px; align-items: center; }" +
    ".foot .brand { color: #6d28d9; font-weight: 700; }" +
    ".actions { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; }" +
    ".actions button { background: #6d28d9; color: #fff; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 12px; }" +
    ".actions button:hover { background: #5b21b6; }" +
    "@media print { body { padding: 0; } .no-print { display: none; } .head { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }" +
    "</style>" +
    "</head>" +
    "<body>" +
    '<div class="actions no-print"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>' +
    '<div class="head">' +
    '<div class="logo">' + escapeHtml((data.companyName || "?").charAt(0).toUpperCase()) + "</div>" +
    "<div>" +
    "<h1>Fechamento de caixa</h1>" +
    '<div class="sub">' + escapeHtml(data.companyName) + (data.companyCnpj ? " - CNPJ " + escapeHtml(data.companyCnpj) : "") + "</div>" +
    "</div>" +
    '<div class="meta">' +
    (data.sessaoLabel ? "<div><b>" + escapeHtml(data.sessaoLabel) + "</b></div>" : "") +
    "<div>" + fmtDateTime(data.openedAtIso).split(" ")[0] + "</div>" +
    "<div>" + fmtTime(data.openedAtIso) + " -> " + fmtTime(data.closedAtIso) + "</div>" +
    "</div>" +
    "</div>" +
    '<div class="body">' +
    '<div class="s-title">Resumo do dia</div>' +
    '<div class="kpi-grid">' +
    '<div class="kpi"><div class="l">Vendas</div><div class="v violet">' + data.salesCount + "</div></div>" +
    '<div class="kpi"><div class="l">Clientes novos</div><div class="v violet">' + data.newCustomersCount + "</div></div>" +
    '<div class="kpi"><div class="l">Faturamento</div><div class="v">' + fmt(data.grossRevenue) + "</div></div>" +
    '<div class="kpi"><div class="l">Ticket medio</div><div class="v">' + fmt(ticket) + "</div></div>" +
    "</div>" +
    '<div class="s-title">Conferencia de caixa</div>' +
    '<div class="summary">' +
    '<div class="row"><span class="lab">Operador</span><span class="val">' + escapeHtml(data.operatorName) + "</span></div>" +
    '<div class="row"><span class="lab">Troco de abertura</span><span class="val">' + fmt(data.trocoInicial) + "</span></div>" +
    '<div class="row"><span class="lab">Vendas em dinheiro</span><span class="val">' + fmt(data.vendasEmDinheiro) + "</span></div>" +
    '<div class="row"><span class="lab">Esperado em caixa</span><span class="val">' + fmt(data.dinheiroEsperado) + "</span></div>" +
    '<div class="row"><span class="lab">Contado em caixa</span><span class="val">' + fmt(data.dinheiroContado) + "</span></div>" +
    '<div class="row"><span class="lab">Diferenca</span><span class="val diff" style="color:' + diffColor + ';">' + diffLabel + "</span></div>" +
    (data.observacao
      ? '<div class="row"><span class="lab">Observacao</span><span class="val" style="font-style:italic; color:#6a608e; font-weight:500;">' + escapeHtml(data.observacao) + "</span></div>"
      : "") +
    "</div>" +
    '<div class="s-title">Distribuicao por forma de pagamento</div>' +
    (mixRows ||
      '<div style="font-size:12px; color:#6a608e; padding:8px 0;">Sem pagamentos registrados nesta sessao.</div>') +
    "</div>" +
    '<div class="foot">' +
    '<span>Gerado por <span class="brand">Aura</span> - getaura.com.br</span>' +
    "<span>" + fmtDateTime(data.closedAtIso) + (data.sessaoLabel ? " - sessao " + escapeHtml(data.sessaoLabel) : "") + "</span>" +
    "</div>" +
    "</body>" +
    "</html>"
  );
}

export function openCashClosePdf(data: CashCloseData) {
  const html = buildCashClosePdfHtml(data);

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const win = window.open("", "_blank");
    if (!win) {
      alert("Habilite popups para gerar o relatorio de fechamento.");
      return;
    }
    win.document.write(html);
    win.document.close();
    return;
  }

  // Mobile: data: url
  if (typeof window !== "undefined" && (window as any).Linking) {
    const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    (window as any).Linking.openURL(dataUrl);
  }
}

export default openCashClosePdf;
