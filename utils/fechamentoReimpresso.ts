// ============================================================
// AURA. — reimpressão do relatório de um fechamento já fechado
//
// 23/11/2026 (pedido do Caio): a aba Fechamentos (Vendas) ganha
// "Imprimir fechamento". O relatório é o MESMO do fim do fechamento
// (buildCashClosePdfHtml), montado com os mesmos campos que o modal do
// Caixa usa (OpenCloseCashModal.handleDownloadPdf), agora lidos do detalhe
// da sessão (GET /caixa/sessao/:id).
//
// Diferenças possíveis em relação ao papel do dia, todas pequenas:
//   - "Dinheiro (líquido na sessão)": no dia vinha do status ao vivo do
//     caixa; aqui vem do snapshot (total_dinheiro), gravado no fechamento.
//   - Vendas, ticket médio, clientes novos, devoluções e trocas não ficam no
//     snapshot: o backend recalcula com a mesma conta e a mesma janela.
//     Backend sem isso: Vendas e clientes novos saem 0 e "Vendas do
//     período" cai nas entradas, como já acontecia com backend antigo.
//
// window.open precisa sair direto do clique (bloqueio de pop-up): a janela
// abre no clique com "Preparando…" e o relatório é escrito quando o
// detalhe chega, como o próprio openCashClosePdf faz.
// ============================================================
import { Platform } from "react-native";
import type { CaixaSessaoHistorico, CaixaTrocaDaSessao, CaixaTrocasResumo } from "@/services/caixaApi";
import { buildCashClosePdfHtml, openCashClosePdf, type CashCloseData } from "@/utils/cashClosePdf";
import { formasDoFechamento } from "@/utils/formasDoFechamento";

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v));
  return isFinite(n) ? n : 0;
}

/** O detalhe da sessão com os campos do relatório (backend de 23/11/2026). */
export type SessaoParaRelatorio = Partial<CaixaSessaoHistorico> & {
  id: string;
  opened_at: string;
  sessao_label?: string | null;
  sales_count?: number | null;
  new_customers_count?: number | null;
  total_vendas?: number | string | null;
  total_devolucoes?: number | string | null;
  trocas?: CaixaTrocaDaSessao[];
  trocas_resumo?: CaixaTrocasResumo;
};

export type LojaDoRelatorio = { companyName: string; companyCnpj?: string | null };

export function rotuloDaSessao(id: string): string {
  return "#" + String(id || "").replace(/-/g, "").slice(0, 5).toUpperCase();
}

/** Os dados do relatório de um fechamento antigo, campo a campo como no dia. */
export function dadosDoFechamentoReimpresso(s: SessaoParaRelatorio, loja: LojaDoRelatorio): CashCloseData {
  return {
    companyName: loja.companyName,
    companyCnpj: loja.companyCnpj || null,
    operatorName: s.opened_by_name || "Operador",
    openedAtIso: s.opened_at,
    closedAtIso: s.closed_at || s.opened_at,
    sessaoLabel: s.sessao_label || rotuloDaSessao(s.id),
    salesCount: toNum(s.sales_count),
    newCustomersCount: toNum(s.new_customers_count),
    grossRevenue: s.total_vendas != null ? toNum(s.total_vendas) : toNum(s.total_geral),
    entradasTotal: toNum(s.total_geral),
    devolucoes: toNum(s.total_devolucoes),
    trocoInicial: toNum(s.troco_inicial),
    vendasEmDinheiro: toNum(s.total_dinheiro),
    suprimentos: toNum(s.total_suprimentos),
    sangrias: toNum(s.total_sangrias),
    dinheiroEsperado: toNum(s.dinheiro_esperado),
    dinheiroContado: toNum(s.dinheiro_contado),
    diferenca: toNum(s.diferenca),
    observacao: s.obs_fechamento || null,
    paymentMix: formasDoFechamento(s),
    trocas: s.trocas,
    trocasResumo: s.trocas_resumo,
  };
}

const ESTILO_AVISO =
  'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#4a4366;' +
  "display:flex;align-items:center;justify-content:center;min-height:90vh;margin:0;text-align:center;padding:24px;}";

function paginaDeAviso(texto: string): string {
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" /><title>Fechamento de caixa</title><style>' +
    ESTILO_AVISO + "</style></head><body><p>" + texto + "</p></body></html>";
}

export const TEXTO_PREPARANDO = "Preparando o relatório do fechamento…";
export const TEXTO_ERRO = "Não conseguimos buscar este fechamento agora. Feche esta janela e tente de novo em instantes.";
export const TEXTO_POPUP = "Para imprimir o fechamento, permita as janelas do Aura neste navegador e toque de novo.";

function escrever(win: Window, html: string) {
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/**
 * Chamar DIRETO no clique. Na web, abre a janela já (antes de buscar) e
 * escreve o relatório quando `buscar` responde. Fora da web, busca e abre
 * com openCashClosePdf.
 * Devolve false quando o navegador bloqueou a janela.
 */
export function imprimirFechamento(
  buscar: () => Promise<SessaoParaRelatorio>,
  loja: LojaDoRelatorio,
  onErro?: () => void,
): boolean {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const win = window.open("", "_blank");
    if (!win) return false;
    escrever(win, paginaDeAviso(TEXTO_PREPARANDO));
    buscar()
      .then((s) => { escrever(win, buildCashClosePdfHtml(dadosDoFechamentoReimpresso(s, loja))); })
      .catch(() => { escrever(win, paginaDeAviso(TEXTO_ERRO)); onErro?.(); });
    return true;
  }
  buscar()
    .then((s) => openCashClosePdf(dadosDoFechamentoReimpresso(s, loja)))
    .catch(() => { onErro?.(); });
  return true;
}
