// ============================================================
// AURA. — Matcon: esteira de Compras (M4)
//
// 22/09/2026. Funções puras, sem React — mesmo desenho de
// components/matcon/quotesUtil.ts e deliveriesUtil.ts: a tela
// /matcon/compras só formata o que sai daqui.
//
// docs/CONTRACT_MATCON.md seção M4 (Compras) e
// docs/mockups/matcon-m4-profundidade.html #compras/#pedido.
//
// Três contas que o dono lê de manhã (esteira Sugestão → Pedido enviado →
// Recebido):
//   1. A sugestão é AGRUPADA por fornecedor — o fornecedor vem do último
//      XML importado daquele produto (services/matconApi.ts:
//      PurchaseSuggestion.supplier_name/supplier_cnpj/supplier_phone).
//      `agruparPorFornecedor` monta os cards da estação Sugestão, do
//      fornecedor com mais dinheiro faltando para o com menos.
//   2. `fraseDaSugestao` é a linha que o mockup mostra por item: "tem 12
//      sc, mínimo 40, vende 18/semana → sugerimos 60 sc (~R$ 1.974)".
//   3. `progressoDoPedido` é o "40 de 60 sc" do recebimento parcial
//      (pedido fica em "Pedido enviado" até fechar sozinho com o XML).
// ============================================================
import type { PurchaseOrder, PurchaseOrderItem, PurchaseSuggestion } from "@/services/matconApi";
import { fmtQty } from "@/utils/matconUnits";

function round3(n: number | null | undefined): number {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

/** "~R$ 1.974" — dinheiro aproximado, sem centavos (é o que se lê de longe). */
export function fmtMoneyApprox(n: number | null | undefined): string {
  return "~R$ " + Math.round(Number(n) || 0).toLocaleString("pt-BR");
}

// ── Sugestão agrupada por fornecedor ────────────────────────

export type FornecedorSugestoes = {
  /** Chave estável para agrupar/filtrar (cnpj, senão o nome, senão "sem-fornecedor"). */
  key: string;
  supplier_name: string;
  supplier_cnpj: string | null;
  supplier_phone: string | null;
  items: PurchaseSuggestion[];
  total_est: number;
  /** O menor `days_to_stockout` entre os itens do fornecedor; null se nenhum item tem prazo. */
  min_days_to_stockout: number | null;
};

/**
 * Agrupa as sugestões por fornecedor e ordena do que tem mais dinheiro
 * faltando para o que tem menos — é a ordem em que o dono decide onde
 * gastar primeiro. Sem fornecedor cadastrado (produto nunca chegou por
 * XML) cai no grupo "Sem fornecedor identificado", ao final.
 */
export function agruparPorFornecedor(suggestions: PurchaseSuggestion[]): FornecedorSugestoes[] {
  const grupos: Record<string, FornecedorSugestoes> = {};
  const ordem: string[] = [];

  (suggestions || []).forEach((s) => {
    const key = s.supplier_cnpj || s.supplier_name || "sem-fornecedor";
    if (!grupos[key]) {
      grupos[key] = {
        key,
        supplier_name: s.supplier_name || "Sem fornecedor identificado",
        supplier_cnpj: s.supplier_cnpj || null,
        supplier_phone: s.supplier_phone || null,
        items: [],
        total_est: 0,
        min_days_to_stockout: null,
      };
      ordem.push(key);
    }
    const grupo = grupos[key];
    grupo.items.push(s);
    grupo.total_est = round3(grupo.total_est + (Number(s.est_cost) || 0));
    if (s.days_to_stockout !== null && s.days_to_stockout !== undefined) {
      grupo.min_days_to_stockout =
        grupo.min_days_to_stockout === null ? s.days_to_stockout : Math.min(grupo.min_days_to_stockout, s.days_to_stockout);
    }
  });

  return ordem.map((key) => grupos[key]).sort((a, b) => b.total_est - a.total_est);
}

// ── A linha de cada item da sugestão ────────────────────────

/**
 * "tem 12 sc, mínimo 40, vende 18/semana → sugerimos 60 sc (~R$ 1.974)" —
 * a frase que o card mostra por item, do jeito que o balcão fala.
 */
export function fraseDaSugestao(s: PurchaseSuggestion): string {
  const unidade = s.unit ? " " + s.unit : "";
  return (
    "tem " + fmtQty(s.stock) + unidade +
    ", mínimo " + fmtQty(s.min_stock) +
    ", vende " + fmtQty(s.weekly_sales) + "/semana" +
    " → sugerimos " + fmtQty(s.suggested_qty) + unidade +
    " (" + fmtMoneyApprox(s.est_cost) + ")"
  );
}

// ── O texto pronto para o WhatsApp do fornecedor ────────────

/**
 * O texto que sai pronto para o WhatsApp — é assim que a loja de bairro
 * compra hoje, só que de cabeça (mockup #pedido). Uma linha por item,
 * quantidade editável já aplicada pelo vendedor.
 */
export function textoPedidoWhatsApp(order: PurchaseOrder, nomeDaLoja: string): string {
  const loja = (nomeDaLoja || "").trim() || "nossa loja";
  const linhas = (order.items || []).map((it) => {
    const unidade = it.unit ? it.unit : "un";
    return "· " + fmtQty(it.quantity) + " " + unidade + " de " + it.name;
  });
  return (
    "Bom dia! Aqui é do " + loja + ".\n" +
    "Preciso de:\n" +
    linhas.join("\n") + "\n" +
    "Consegue entregar esta semana? Obrigado!"
  );
}

// ── Progresso do pedido (recebimento total ou parcial) ──────

export type ProgressoItemPedido = {
  product_id: string;
  name: string;
  /** "40 de 60 sc" */
  label: string;
  pct: number; // 0-100
  completo: boolean;
};

export type ProgressoPedido = {
  itens: ProgressoItemPedido[];
  /** Percentual geral, ponderado pelo valor estimado de cada item (0-100). */
  pct: number;
};

/**
 * "40 de 60 sc" por item — o card em "Pedido enviado" mostra isso quando
 * o recebimento veio parcial (docs/CONTRACT_MATCON.md §M4: "se vier menos
 * do que foi pedido, o card mostra o que faltou e continua em 'Pedido
 * enviado'"). O percentual geral pondera pelo valor estimado, para o
 * mesmo pedido com itens de preços bem diferentes não enganar o dono.
 */
export function progressoDoPedido(order: PurchaseOrder): ProgressoPedido {
  const items = order.items || [];

  const itens: ProgressoItemPedido[] = items.map((it: PurchaseOrderItem) => {
    const recebido = round3(it.received_qty);
    const total = round3(it.quantity);
    const unidade = it.unit ? " " + it.unit : "";
    const pct = total > 0 ? Math.min(100, (recebido / total) * 100) : 0;
    return {
      product_id: it.product_id,
      name: it.name,
      label: fmtQty(recebido) + " de " + fmtQty(total) + unidade,
      pct: pct,
      completo: total > 0 && recebido >= total,
    };
  });

  const valorTotal = items.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_cost_est) || 0), 0);
  const valorRecebido = items.reduce((acc, it) => {
    const recebido = Math.min(Number(it.received_qty) || 0, Number(it.quantity) || 0);
    return acc + recebido * (Number(it.unit_cost_est) || 0);
  }, 0);
  const pctGeral = valorTotal > 0 ? Math.min(100, Math.round((valorRecebido / valorTotal) * 100)) : 0;

  return { itens, pct: pctGeral };
}
