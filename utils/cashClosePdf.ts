import { Platform } from "react-native";
import { CSS_ESCONDE_NA_IMPRESSAO, ONCLICK_IMPRIMIR, SCRIPT_IMPRIMIR_SEM_BARRA } from "@/utils/printBar";
import {
  contaDoFechamento, linhasDaDiferenca, nomeComQuantidade, resumoDasTrocas, temTrocas,
  valorDaDiferenca, valorDaLinhaDaConta, valorDoDevolvido, valorDoLevado,
  type ResumoDasTrocas, type TrocaDoFechamento,
} from "@/utils/trocasDoFechamento";

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
//   - 4 KPIs do dia (vendas, vendas do periodo, entradas, ticket médio)
//   - Conferência de caixa (esperado vs contado vs diferença)
//   - Entradas no caixa por forma de pagamento (barras horizontais)
//   - Trocas e devoluções da sessão (16/11/2026, só quando houve troca)
//   - Footer com identidade Aura
//
// 16/11/2026 (mockup docs/mockups/fechamento-trocas.html): com troca na
// sessão, o relatório ganha a conta de Vendas do período até Entradas no
// caixa (logo abaixo dos KPIs) e a lista das trocas. SEM troca o HTML sai
// igual ao de antes, byte a byte (__tests__/cashClosePdfTrocas.test.ts):
// o CSS novo só entra quando há troca.
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
  /**
   * Vendas do período (fonte única sales.total_amount, regime competência)
   * — o MESMO número da tela de Vendas. NÃO é o total de entradas no caixa.
   */
  grossRevenue: number;
  /** ticket médio — calculamos se não vier */
  averageTicket?: number;

  /**
   * 12/08/2026 — Entradas no caixa (total_geral do fechamento): o que
   * efetivamente entrou por método na sessão. Num dia com troca ou
   * crediário difere das vendas do período POR DESIGN — o PDF mostra os
   * dois com rótulos distintos pra conferência não parecer furada.
   * Opcional para compat com backend antigo (cai no somatório do mix).
   */
  entradasTotal?: number;
  /** Reembolsos de troca pagos ao cliente (saíram do caixa na sessão). */
  devolucoes?: number;

  // Conferência de caixa
  trocoInicial: number;
  vendasEmDinheiro: number;
  /** 30/10/2026 (sangria/suprimento): reforços e retiradas da sessão. Só
   *  viram linha quando > 0; dinheiroEsperado já os considera. */
  suprimentos?: number;
  sangrias?: number;
  dinheiroEsperado: number;
  dinheiroContado: number;
  /** = contado - esperado (negativo = falta, positivo = sobra, zero = exato) */
  diferenca: number;
  observacao?: string | null;

  // Distribuição
  paymentMix: CashClosePaymentRow[];

  /** 16/11/2026: trocas e devoluções da sessão (fechar() do backend).
   *  Ausente ou vazio = relatório de sempre. */
  trocas?: TrocaDoFechamento[];
  trocasResumo?: ResumoDasTrocas | null;
};

// Só entra no <style> quando a sessão teve troca. Cabe na térmica de 80 mm:
// abaixo de 620 px, Devolveu/Levou empilham e os totais vão para 2 colunas.
const CSS_TROCAS =
  ".conta { background: #f5f1ff; border: 1px solid rgba(109,40,217,0.22); border-radius: 8px; padding: 12px 16px; margin-top: 14px; }" +
  ".conta .row { border-bottom: 1px dashed rgba(109,40,217,0.15); gap: 12px; }" +
  ".conta .row .val { text-align: right; white-space: nowrap; }" +
  ".conta .row .obs { color: #8a83a8; }" +
  ".conta .row.tot { border-bottom: none; border-top: 1px solid rgba(109,40,217,0.35); margin-top: 2px; padding-top: 8px; }" +
  ".conta .row.tot .lab, .conta .row.tot .val { font-weight: 700; color: #4c1d95; }" +
  ".trocas-sec { margin-top: 22px; }" +
  ".troca { border: 1px solid rgba(109,40,217,0.16); border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; background: #fff; page-break-inside: avoid; break-inside: avoid; }" +
  ".troca-h { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; flex-wrap: wrap; font-size: 12px; margin-bottom: 8px; }" +
  ".troca-h .k { font-weight: 700; color: #4c1d95; }" +
  ".troca-h .t { font-family: ui-monospace, monospace; color: #6a608e; font-size: 11px; }" +
  ".cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }" +
  ".col h4 { margin: 0 0 4px; font-size: 10px; color: #6a608e; text-transform: uppercase; letter-spacing: 0.5px; }" +
  ".it { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; padding: 2px 0; }" +
  ".it span:first-child { min-width: 0; color: #2d2850; overflow-wrap: anywhere; }" +
  ".it span:last-child { font-variant-numeric: tabular-nums; white-space: nowrap; }" +
  ".it.sub { border-top: 1px solid rgba(109,40,217,0.10); margin-top: 3px; padding-top: 4px; font-weight: 600; }" +
  ".it.nada span:first-child { color: #8a83a8; }" +
  ".dif { margin-top: 8px; font-size: 12px; padding: 7px 10px; border-radius: 6px; background: #faf9fd; display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }" +
  ".dif b { font-variant-numeric: tabular-nums; }" +
  ".dif.in b { color: #047857; }" +
  ".dif.out b { color: #b91c1c; }" +
  ".dif.zero b { color: #4a4366; }" +
  ".tot-trocas { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 4px; }" +
  ".tot-trocas div { background: #faf9fd; border-radius: 6px; padding: 8px 10px; font-size: 10px; color: #6a608e; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600; min-width: 0; }" +
  ".tot-trocas div b { display: block; font-size: 14px; color: #18172b; text-transform: none; letter-spacing: 0; margin-top: 2px; }" +
  "@media (max-width: 620px) { .cols { grid-template-columns: minmax(0, 1fr); } .tot-trocas { grid-template-columns: repeat(2, minmax(0, 1fr)); } }";

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

/** A conta de Vendas do período até Entradas no caixa (só com troca). */
function contaHtml(vendas: number, entradas: number, trocas: TrocaDoFechamento[], resumo?: ResumoDasTrocas | null): string {
  const conta = contaDoFechamento({ vendas, entradas, trocas, resumo });
  return (
    '<div class="conta">' +
    conta.linhas
      .map((l) =>
        '<div class="row"><span class="lab">' + escapeHtml(l.rotulo) +
        (l.obs ? ' <span class="obs">· ' + escapeHtml(l.obs) + "</span>" : "") +
        '</span><span class="val">' + valorDaLinhaDaConta(l, fmt) + "</span></div>"
      )
      .join("") +
    '<div class="row tot"><span class="lab">= Entradas no caixa</span><span class="val">' + fmt(conta.entradas) + "</span></div>" +
    "</div>"
  );
}

function itemHtml(nome: string, valor: number): string {
  return '<div class="it"><span>' + escapeHtml(nome) + "</span><span>" + fmt(valor) + "</span></div>";
}

/** A seção "Trocas e devoluções da sessão (N)": um bloco por troca e os 4 totais. */
function trocasHtml(trocas: TrocaDoFechamento[], resumo?: ResumoDasTrocas | null): string {
  const tot = resumoDasTrocas(trocas, resumo);
  const blocos = trocas
    .map((t) => {
      const dev = t.devolvidos || [];
      const lev = t.levados || [];
      const somaDev = dev.reduce((a, d) => a + valorDoDevolvido(d), 0);
      const somaLev = lev.reduce((a, l) => a + valorDoLevado(l), 0);
      return (
        '<div class="troca">' +
        '<div class="troca-h"><span class="k">' + (t.tipo === "devolucao" ? "Devolução" : "Troca") + '</span><span class="t">' + fmtTime(t.created_at) + "</span></div>" +
        '<div class="cols">' +
        '<div class="col"><h4>Devolveu</h4>' +
        dev.map((d) => itemHtml(nomeComQuantidade(d.product_name_snapshot || "Produto", d.quantity), valorDoDevolvido(d))).join("") +
        (dev.length > 1 ? '<div class="it sub"><span>Total</span><span>' + fmt(somaDev) + "</span></div>" : "") +
        "</div>" +
        '<div class="col"><h4>Levou</h4>' +
        (lev.length
          ? lev.map((l) => itemHtml(nomeComQuantidade(l.product_name || "Produto", l.quantity), valorDoLevado(l))).join("")
          : '<div class="it nada"><span>Nada</span><span></span></div>') +
        (lev.length > 1 ? '<div class="it sub"><span>Total</span><span>' + fmt(somaLev) + "</span></div>" : "") +
        "</div>" +
        "</div>" +
        linhasDaDiferenca(t, fmt)
          .map((d) => '<div class="dif ' + d.kind + '"><span>' + escapeHtml(d.texto) + "</span><b>" + valorDaDiferenca(d.valor, fmt) + "</b></div>")
          .join("") +
        "</div>"
      );
    })
    .join("");
  return (
    '<div class="trocas-sec">' +
    '<div class="s-title">Trocas e devoluções da sessão (' + trocas.length + ")</div>" +
    blocos +
    '<div class="tot-trocas">' +
    "<div>Peças devolvidas<b>" + fmt(tot.pecas_devolvidas) + "</b></div>" +
    "<div>Peças levadas<b>" + fmt(tot.pecas_levadas) + "</b></div>" +
    "<div>Diferença recebida<b>" + fmt(tot.diferenca_recebida) + "</b></div>" +
    "<div>Devolvido ao cliente<b>" + fmt(tot.devolvido_cliente) + "</b></div>" +
    "</div>" +
    "</div>"
  );
}

export function buildCashClosePdfHtml(data: CashCloseData): string {
  const mixSum = data.paymentMix.reduce((acc, p) => acc + p.amount, 0);
  const total = Math.max(1, mixSum);
  const entradas = data.entradasTotal != null ? data.entradasTotal : mixSum;
  // 16/11/2026: sem troca, nada abaixo muda (nem o CSS).
  const trocas = temTrocas(data.trocas) ? data.trocas : null;
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
    (trocas ? CSS_TROCAS : "") +
    // 07/10/2026: a barra só tem aparência na tela; na impressão, some
    // (ver utils/printBar.ts — no orçamento, `.actions { display: flex }`
    // declarado depois do @media print fazia o botão sair no papel).
    "@media screen {" +
    ".actions { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; }" +
    ".actions button { background: #6d28d9; color: #fff; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 12px; }" +
    ".actions button:hover { background: #5b21b6; }" +
    "}" +
    CSS_ESCONDE_NA_IMPRESSAO +
    "@media print { body { padding: 0; } .head { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }" +
    "</style>" +
    "</head>" +
    "<body>" +
    '<div class="actions no-print"><button type="button" onclick="' + ONCLICK_IMPRIMIR + '">Imprimir / Salvar PDF</button></div>' +
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
    '<div class="kpi"><div class="l">Vendas do periodo</div><div class="v">' + fmt(data.grossRevenue) + "</div></div>" +
    '<div class="kpi"><div class="l">Entradas no caixa</div><div class="v violet">' + fmt(entradas) + "</div></div>" +
    '<div class="kpi"><div class="l">Ticket medio</div><div class="v">' + fmt(ticket) + "</div></div>" +
    "</div>" +
    (trocas ? contaHtml(data.grossRevenue, entradas, trocas, data.trocasResumo) : "") +
    '<div style="font-size:10px; color:#6a608e; margin-top:8px; line-height:1.5;">' +
    (trocas
      ? "Vendas do periodo = valor vendido (mesmo numero da tela de Vendas). A troca não entra em Vendas: a peça devolvida já tinha sido vendida antes. Crediário e venda com data anterior paga nesta sessão também fazem os dois números diferirem — isso não e falta no caixa."
      : "Vendas do periodo = valor vendido (mesmo numero da tela de Vendas). Entradas no caixa = o que entrou por forma de pagamento nesta sessao" +
        (data.devolucoes && data.devolucoes > 0
          ? ", ja descontados " + fmt(data.devolucoes) + " devolvidos ao cliente em trocas"
          : "") +
        ". Trocas, crediário e venda com data anterior paga nesta sessão fazem os dois números diferirem — isso não e falta no caixa.") +
    "</div>" +
    '<div class="s-title">Conferencia de caixa</div>' +
    '<div class="summary">' +
    '<div class="row"><span class="lab">Operador</span><span class="val">' + escapeHtml(data.operatorName) + "</span></div>" +
    '<div class="row"><span class="lab">Clientes novos</span><span class="val">' + data.newCustomersCount + "</span></div>" +
    '<div class="row"><span class="lab">Troco de abertura</span><span class="val">' + fmt(data.trocoInicial) + "</span></div>" +
    '<div class="row"><span class="lab">Dinheiro (liquido na sessao)</span><span class="val">' + fmt(data.vendasEmDinheiro) + "</span></div>" +
    (data.suprimentos && data.suprimentos > 0
      ? '<div class="row"><span class="lab">Reforcos de troco</span><span class="val">+ ' + fmt(data.suprimentos) + "</span></div>"
      : "") +
    (data.sangrias && data.sangrias > 0
      ? '<div class="row"><span class="lab">Retiradas (sangrias)</span><span class="val">- ' + fmt(data.sangrias) + "</span></div>"
      : "") +
    '<div class="row"><span class="lab">Esperado em caixa</span><span class="val">' + fmt(data.dinheiroEsperado) + "</span></div>" +
    '<div class="row"><span class="lab">Contado em caixa</span><span class="val">' + fmt(data.dinheiroContado) + "</span></div>" +
    '<div class="row"><span class="lab">Diferenca</span><span class="val diff" style="color:' + diffColor + ';">' + diffLabel + "</span></div>" +
    (data.observacao
      ? '<div class="row"><span class="lab">Observacao</span><span class="val" style="font-style:italic; color:#6a608e; font-weight:500;">' + escapeHtml(data.observacao) + "</span></div>"
      : "") +
    "</div>" +
    '<div class="s-title">Entradas no caixa por forma de pagamento</div>' +
    (mixRows ||
      '<div style="font-size:12px; color:#6a608e; padding:8px 0;">Sem pagamentos registrados nesta sessao.</div>') +
    (mixRows
      ? '<div class="pay-row" style="border-top:1px solid rgba(109,40,217,0.16);">' +
        '<span class="pay-name" style="font-weight:700;">Total de entradas</span>' +
        '<div class="bar-wrap" style="background:transparent;"></div>' +
        '<span class="pay-pct"></span>' +
        '<span class="pay-val" style="font-weight:700;">' + fmt(entradas) + "</span>" +
        "</div>"
      : "") +
    (trocas ? trocasHtml(trocas, data.trocasResumo) : "") +
    "</div>" +
    '<div class="foot">' +
    '<span>Gerado por <span class="brand">Aura</span> - getaura.com.br</span>' +
    "<span>" + fmtDateTime(data.closedAtIso) + (data.sessaoLabel ? " - sessão " + escapeHtml(data.sessaoLabel) : "") + "</span>" +
    "</div>" +
    SCRIPT_IMPRIMIR_SEM_BARRA +
    "</body>" +
    "</html>"
  );
}

export function openCashClosePdf(data: CashCloseData) {
  const html = buildCashClosePdfHtml(data);

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const win = window.open("", "_blank");
    if (!win) {
      alert("Habilite popups para gerar o relatório de fechamento.");
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
