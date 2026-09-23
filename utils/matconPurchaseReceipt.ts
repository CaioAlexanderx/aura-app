// ============================================================
// AURA. — Matcon M4: a nota do fornecedor entrou (funcoes puras + chamada)
//
// 23/09/2026 — docs/CONTRACT_MATCON.md (M4 › Compras) e Aura-backend#741
// (POST /companies/:id/matcon/purchase-receipts).
//
// A conferencia do XML (DanfeImportModal) soma o estoque produto a produto
// por PATCH. O backend nunca ficava sabendo o que entrou — e o pedido de
// compra enviado ao fornecedor ficava "Pedido enviado" para sempre. Depois
// que o estoque entra, a tela chama registrarEntradaDaNota UMA vez com os
// itens que viraram estoque de um produto; o backend grava "quem vendeu e
// por quanto" e fecha o pedido `sent` do mesmo CNPJ (parcial fica `sent`).
//
// Tres regras:
//   1) quantity e unit_cost vao COMO NA CONFERENCIA, na unidade de COMPRA
//      (10 cx a R$ 89,90) — nunca os ja convertidos para m². Quem converte
//      e o backend, pelo purchase_factor do produto.
//   2) Falhar aqui NAO desfaz nada: o estoque ja entrou. A funcao nunca
//      lanca; devolve o aviso em portugues simples para a tela mostrar.
//   3) Os pedidos que a nota mexeu viram uma frase por pedido no resumo.
// ============================================================

import { matconApi } from "@/services/matconApi";
import type {
  PurchaseOrder,
  PurchaseReceiptBody,
  PurchaseReceiptItem,
} from "@/services/matconApi";

/** Emitente e numero da nota, lidos do XML (NF-e: emit/xNome, emit/CNPJ, ide/nNF). */
export type NotaDoFornecedor = {
  supplier_name: string | null;
  supplier_cnpj: string | null;
  supplier_phone: string | null;
  invoice_number: string | null;
};

/** Uma linha da conferencia que virou estoque de um produto. */
export type EntradaDeItem = {
  product_id: string | null | undefined;
  /** Quantidade da nota, na unidade de COMPRA (qCom). */
  quantity: number;
  /** Custo unitario da conferencia, na unidade de COMPRA (sem dividir pelo fator). */
  unit_cost: number;
};

export const AVISO_FALHA_ENTRADA =
  "A nota entrou no estoque, mas não consegui registrar a compra no módulo de materiais de construção.";

export const NOTA_VAZIA: NotaDoFornecedor = {
  supplier_name: null,
  supplier_cnpj: null,
  supplier_phone: null,
  invoice_number: null,
};

function textoDoNo(doc: Document, seletores: string[]): string | null {
  for (var i = 0; i < seletores.length; i++) {
    var el = doc.querySelector(seletores[i]);
    var v = el && el.textContent ? el.textContent.trim() : "";
    if (v) return v;
  }
  return null;
}

/**
 * Emitente da NF-e (o fornecedor) e o numero da nota. Leitura tolerante:
 * campo que nao existe volta null, XML quebrado volta tudo null — a
 * importacao nunca para por causa disto.
 */
export function lerNotaDoFornecedor(xmlText: string): NotaDoFornecedor {
  try {
    var doc = new DOMParser().parseFromString(xmlText, "text/xml");
    return {
      supplier_name: textoDoNo(doc, ["emit > xNome", "emit > xFant"]),
      // Fornecedor pessoa fisica (produtor rural) vem com CPF no lugar do CNPJ.
      supplier_cnpj: textoDoNo(doc, ["emit > CNPJ", "emit > CPF"]),
      supplier_phone: textoDoNo(doc, ["emit > enderEmit > fone"]),
      invoice_number: textoDoNo(doc, ["ide > nNF", "nNF"]),
    };
  } catch {
    return { ...NOTA_VAZIA };
  }
}

/**
 * Corpo do POST /matcon/purchase-receipts. So entram linhas com produto
 * (a que o lojista deixou de fora nunca chega aqui, e a que falhou ao
 * gravar tambem nao). Quantidade e custo seguem sem conversao.
 * Sem nenhum item: null — nao ha o que registrar.
 */
export function montarEntradaDaNota(nota: NotaDoFornecedor, entradas: EntradaDeItem[]): PurchaseReceiptBody | null {
  var items: PurchaseReceiptItem[] = [];
  (entradas || []).forEach(function (e) {
    if (!e || !e.product_id) return;
    var q = Number(e.quantity);
    if (!Number.isFinite(q) || q <= 0) return;
    var c = Number(e.unit_cost);
    items.push({ product_id: String(e.product_id), quantity: q, unit_cost: Number.isFinite(c) && c > 0 ? c : 0 });
  });
  if (!items.length) return null;
  var body: PurchaseReceiptBody = {
    supplier_name: nota.supplier_name || null,
    supplier_cnpj: nota.supplier_cnpj || null,
    invoice_number: nota.invoice_number || null,
    items: items,
  };
  if (nota.supplier_phone) body.supplier_phone = nota.supplier_phone;
  return body;
}

export type ResultadoDaEntrada = { orders: PurchaseOrder[]; aviso: string | null };

type ApiDaEntrada = Pick<typeof matconApi, "registerPurchaseReceipt">;

/**
 * Registra a entrada da nota. Nunca lanca: em qualquer falha (rede, 403
 * MATCON_DISABLED, 500) devolve o aviso — o estoque ja entrou e fica.
 */
export async function registrarEntradaDaNota(
  companyId: string,
  body: PurchaseReceiptBody | null,
  api: ApiDaEntrada = matconApi,
): Promise<ResultadoDaEntrada> {
  if (!companyId || !body) return { orders: [], aviso: null };
  try {
    var res = await api.registerPurchaseReceipt(companyId, body);
    return { orders: Array.isArray(res && res.orders) ? res.orders : [], aviso: null };
  } catch {
    return { orders: [], aviso: AVISO_FALHA_ENTRADA };
  }
}

/** "Pedido de compra C-0042 recebido por completo" / "… recebido em parte". */
export function frasesDosPedidos(orders: PurchaseOrder[]): string[] {
  return (orders || [])
    .filter(function (o) { return o && (o.status === "received" || o.status === "sent"); })
    .map(function (o) {
      return "Pedido de compra " + o.number + (o.status === "received" ? " recebido por completo" : " recebido em parte");
    });
}
