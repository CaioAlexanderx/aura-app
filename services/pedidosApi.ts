// ============================================================
// AURA. — services/pedidosApi.ts · Pedido separado de venda (A2, p-63b)
//
// POST /companies/:id/pedidos (Aura-backend#1069, B1): guarda o pedido do
// balcão. As peças ficam reservadas (reserva calculada, B2); nada é cobrado,
// o estoque não baixa e o caixa não mexe.
//
// Idempotency-Key no cabeçalho, a MESMA em toda nova tentativa do mesmo
// pedido (erro de rede seguido de "Tentar de novo", e a repetição automática
// do request() na queda de rede): o servidor devolve o pedido já guardado
// (200, idempotent_replay) em vez de guardar outro. Mesmos itens com outra
// chave = pedido novo. Chave já usada com OUTROS itens: 409
// IDEMPOTENCY_KEY_REUSED (quem chama troca a chave).
//
// Respostas que a tela trata:
//   201 {order, avisos}     guardado ("avisos" = peças que passaram do saldo
//                           livre numa loja que vende sem estoque);
//   409 PEDIDO_SEM_SALDO    {faltas: [{nome, quantidade, estoque, reservado,
//                           livre}]} — nada foi guardado;
//   404                     a trava PEDIDO_LIBERADO do backend está desligada
//                           para esta conta (o app nem mostra o botão);
//   422                     corpo recusado, com a frase pronta em `error`.
//
// Multi-CNPJ: o pedido é de UMA loja (a do companyId). Não existe guardar no
// consolidado.
// ============================================================
import { request } from "./api";

export type ItemDoPedido = {
  product_id?: string | null;
  variant_id?: string | null;
  product_name?: string | null;
  variant_label?: string | null;
  /** Peças inteiras (digital_order_items.quantity é INTEGER). */
  quantity: number;
  /** Preço de tabela da linha, congelado. */
  unit_price: number;
  /** Desconto da linha (lápis do Caixa), como no POST /pdv/sale. */
  item_discount?: number;
};

export type CorpoDoPedido = {
  items: ItemDoPedido[];
  /** Desconto do pedido inteiro (cupom + desconto manual). */
  discount?: number;
  /** AAAA-MM-DD, hoje ou depois (fuso de São Paulo). */
  promised_date?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  notes?: string | null;
};

export type PedidoGuardado = {
  id: string;
  order_number: string | number;
  origem: string;
  status: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  promised_date: string | null;
  items: Array<{ id: string; product_id: string | null; variant_id: string | null; product_name: string; quantity: number; unit_price: number; subtotal: number }>;
};

export type FaltaDoPedido = {
  product_id: string | null;
  variant_id: string | null;
  nome: string;
  quantidade: number;
  estoque: number;
  reservado: number;
  livre: number;
};

export type RespostaDoGuardar = {
  order: PedidoGuardado;
  avisos?: FaltaDoPedido[];
  idempotent_replay?: boolean;
};

export const pedidosApi = {
  guardar(companyId: string, corpo: CorpoDoPedido, chave: string): Promise<RespostaDoGuardar> {
    return request<RespostaDoGuardar>(`/companies/${companyId}/pedidos`, {
      method: "POST",
      body: corpo,
      headers: { "Idempotency-Key": chave },
      // A repetição automática na queda de rede reaproveita a mesma chave.
      retry: 1,
      timeout: 15000,
    });
  },
};

/** 409 PEDIDO_SEM_SALDO: as peças que não têm saldo livre para separar. */
export function faltasDoErro(err: any): FaltaDoPedido[] | null {
  const data = err?.data;
  if ((data?.code || err?.code) !== "PEDIDO_SEM_SALDO") return null;
  return Array.isArray(data?.faltas) ? data.faltas : [];
}

export default pedidosApi;
