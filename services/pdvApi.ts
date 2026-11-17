import { request } from "./api";

export type PdvScanResult = {
  match: "exact" | "partial" | "none";
  source?: "barcode" | "variant_barcode" | "sku";
  product?: any;
  variant_id?: string;
  effective_price?: number;
  // 08/11/2026 (De/Por, p-87): preço que vale agora (promoção no ar ou o
  // normal). Backend antigo não manda.
  preco_efetivo?: number;
  em_promocao?: boolean;
  suggestions?: any[];
  message?: string;
  error?: string;
};

// Shape retornado por GET /companies/:id/pdv/sale/:saleId
export type PdvSaleItem = {
  id: string;              // id do sale_item
  product_name: string;
  quantity: number;        // quantidade vendida
  unit_price: number;
  total_price: number;
  refunded_quantity?: number; // já devolvida (pode vir undefined em vendas antigas)
};

export type PdvSaleDetail = {
  id: string;
  items: PdvSaleItem[];
  [key: string]: any;      // outros campos da venda (total, status, etc)
};

// 17/10/2026 (tq-15, Aura-backend#850): chave de idempotência da venda.
// O MESMO valor em toda nova tentativa da mesma venda (inclusive as que o
// request() faz sozinho na queda de rede) faz o servidor devolver a venda já
// registrada em vez de gravar outra. Sem a chave, o POST é o de sempre.
function cabecalhoDaChave(idempotencyKey?: string | null): Record<string, string> | undefined {
  return idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
}

// 17/11/2026 (p-145): a venda espera até 30 s pela resposta, e não os 10 s
// padrão do request(). Uma venda com vários itens, vendedora, cliente e
// crediário leva de 5 a 6 s no servidor, e o p99 de uma loja já encostou em
// 10 s: a pessoa via "demorou demais" com a venda gravada. O tempo limite não
// gera nova tentativa (AbortError sai direto), e a chave de idempotência cobre
// o segundo clique. Só nesta chamada: o resto do app segue com 10 s.
var TEMPO_LIMITE_DA_VENDA_MS = 30000;

export var pdvApi = {
  createSale: function(companyId: string, body: any, opts?: { idempotencyKey?: string | null }) {
    return request<any>("/companies/" + companyId + "/pdv/sale", { method: "POST", body: body, headers: cabecalhoDaChave(opts?.idempotencyKey), timeout: TEMPO_LIMITE_DA_VENDA_MS });
  },
  // 17/08/2026 (F3) — venda com sinal: recebe parte agora, saldo numa data
  // combinada. Endpoint próprio, e não /pdv/sale com payments[]: o saldo é
  // DERIVADO do total calculado no servidor, e o cliente é resolvido (ou
  // criado) dentro da mesma transação da venda.
  // 18/10/2026 (tq-18): aceita a mesma chave do createSale (o backend
  // delega ao handleSale, que respeita o Idempotency-Key).
  createSaleComSinal: function(companyId: string, body: any, opts?: { idempotencyKey?: string | null }) {
    return request<any>("/companies/" + companyId + "/pdv/sale-com-sinal", { method: "POST", body: body, headers: cabecalhoDaChave(opts?.idempotencyKey) });
  },
  scan: function(companyId: string, code: string) {
    return request<PdvScanResult>("/companies/" + companyId + "/pdv/scan/" + encodeURIComponent(code), { retry: 0, timeout: 5000 });
  },
  getSale: function(companyId: string, saleId: string) {
    return request<PdvSaleDetail>("/companies/" + companyId + "/pdv/sale/" + saleId);
  },
};
