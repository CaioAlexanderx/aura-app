import { request, ApiError } from "@/services/api";

// ============================================================
// AURA. -- Reajuste de preço em lote (p-52/p-53, 30/10/2026)
//
// Backend: Aura-backend#939 (prévia e aplicar) e #940 (desfazer, lista,
// detalhe). Contrato: POST /companies/:cid/products/price-adjustments
// (dry_run padrão true: sem `dry_run: false` nada é gravado).
// `cid` é sempre a empresa ativa (multi-CNPJ: a mesma do resto do Estoque).
// ============================================================

export type ModoReajuste = "percent" | "fixed" | "markup" | "margin";
export type DirecaoReajuste = "up" | "down";
export type Terminacao = "none" | "90" | "99" | "00";

export type PedidoReajuste = {
  product_ids: string[];
  mode: ModoReajuste;
  direction?: DirecaoReajuste;
  value: number;
  rounding: Terminacao;
  dry_run?: boolean;
  allow_below_cost?: boolean;
};

export type ItemReajuste = {
  product_id: string;
  variant_id: string | null;
  name: string;
  variant_label: string | null;
  sku: string | null;
  cost_price: number | null;
  price_before: number;
  price_after: number | null;
  change_abs: number | null;
  change_pct: number | null;
  margin_before: number | null;
  margin_after: number | null;
  card_price_mode: "auto" | "manual" | null;
  card_price_before: number | null;
  card_price_after: number | null;
  below_cost: boolean;
  group_shared: boolean;
  owner_company_id: string | null;
  owner_is_other: boolean;
  status: "change" | "unchanged" | "skipped";
  skip_reason: "no_cost" | "not_positive" | null;
};

export type ResumoReajuste = {
  selected: number;
  not_found: number;
  products_changed: number;
  variants_changed: number;
  items_changed: number;
  unchanged: number;
  skipped_no_cost: number;
  skipped_not_positive: number;
  below_cost: number;
  group_shared: number;
  owner_is_other: number;
  card_price_changed: number;
  margin_avg_before: number | null;
  margin_avg_after: number | null;
};

export type RespostaReajuste = {
  dry_run: boolean;
  adjustment_id: string | null;
  mode: ModoReajuste;
  direction: DirecaoReajuste | null;
  value: number;
  rounding: Terminacao;
  allow_below_cost: boolean;
  summary: ResumoReajuste;
  items: ItemReajuste[];
  not_found_ids: string[];
};

function base(companyId: string) {
  return "/companies/" + companyId + "/products/price-adjustments";
}

/** Código de erro do backend (`code` no corpo), quando houver. */
export function codigoDoErro(err: unknown): string | null {
  if (err instanceof ApiError) return (err.data && (err.data as any).code) || err.code || null;
  return null;
}

export var priceAdjustmentsApi = {
  /** Prévia: nada é gravado. */
  previa: function (companyId: string, pedido: PedidoReajuste) {
    return request<RespostaReajuste>(base(companyId), {
      method: "POST",
      body: { ...pedido, dry_run: true, allow_below_cost: false },
      retry: 0,
      timeout: 30000,
    });
  },

  /**
   * O backend novo está no ar? Uma prévia vazia responde 400 INVALID_INPUT
   * quando a rota existe; sem ela, 404. Qualquer outra coisa (rede, 500)
   * conta como "não" até a próxima conferência: melhor esconder o botão do
   * que mostrar uma função que falha.
   */
  disponivel: function (companyId: string): Promise<boolean> {
    return request<any>(base(companyId), {
      method: "POST",
      body: { product_ids: [], dry_run: true },
      retry: 0,
    }).then(function () { return true; }).catch(function (err) {
      return err instanceof ApiError && err.status === 400 && codigoDoErro(err) === "INVALID_INPUT";
    });
  },
};

export default priceAdjustmentsApi;
