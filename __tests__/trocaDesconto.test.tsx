// 29/10/2026 — desconto e preço alterado na troca do Caixa (incidente: a
// lojista "não consegue dar descontos/alterar preço na troca").
//
//   1. Regras puras (descontoDaTroca.ts): teto de 50% como o Caixa, lápis
//      vira item_discount, campos discount_type/discount_value e o split
//      simples acompanhando o novo valor.
//   2. Fluxo inteiro no TrocaModal: muda o preço do item novo no lápis, dá
//      desconto em R$ no Finalizar (depois de escolher Pix) e confirma — o
//      POST leva item_discount, discount_type/discount_value e o valor a
//      pagar na tela já sai líquido.
//   3. Sem desconto e sem lápis: payload igual ao de antes (sem campos novos).
// Mocks do padrão do repo (Icon, toast, auth); testID + deep:false.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable, TextInput } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(() => ({ company: { id: "loja-1" }, token: "t" }), { getState: () => ({ token: "t", company: { id: "loja-1" } }) }),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, invalidate: jest.fn() }) }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/VariantPickerModal", () => ({ VariantPickerModal: () => null }));
jest.mock("@/components/screens/pdv/troca/Step5Success", () => ({ Step5Success: () => null }));
jest.mock("@/services/trocaApi", () => ({
  trocaApi: {
    searchSalesForTroca: jest.fn(),
    searchSalesByProductBarcode: jest.fn(),
    create: jest.fn(),
    createV2: jest.fn(),
  },
}));

import { TrocaModal } from "@/components/screens/pdv/TrocaModal";
import { trocaApi } from "@/services/trocaApi";
import { toast } from "@/components/Toast";
import {
  MAX_DESCONTO_PCT, descontoManualDaTroca, camposDoDesconto, itemNovoDoPayload,
  subtotalDosNovos, acertarSplits,
} from "@/components/screens/pdv/troca/descontoDaTroca";

const VENDA_ID = "3f2a9c1e-7b44-4d0a-9e5f-0a1b2c3d4e5f";
const venda = {
  id: VENDA_ID, total_amount: 189.9, payment_method: "pix", status: "completed",
  created_at: "2026-10-20T18:42:10Z", company_id: "loja-1", company_name: "Loja Teste",
  customer_id: null, customer_name: null, cpf_cnpj: null, seller_id: null, seller_name: "Vendedora",
  is_cross_filial: false, has_nfce: false, item_count: 1,
  items: [{
    id: "item-1", product_id: "p1", variant_id: null, product_name_snapshot: "Tênis Antigo",
    quantity: 1, unit_price: 189.9, total_price: 189.9, original_sale_item_id: "item-1",
  }],
};
const PRODUTOS = [{ id: "p9", name: "Tênis Novo", price: 339.99, stock_qty: 5 }];

function textoDe(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join("");
  return textoDe(node.children);
}
const achar = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const tudo = (t: renderer.ReactTestRenderer) => textoDe(t.toJSON());
// Texto de um nó da árvore de instâncias (strings dos filhos, recursivo).
function textoDoNo(n: any): string {
  if (n == null) return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  return (n.children || []).map(textoDoNo).join("");
}
function botao(t: renderer.ReactTestRenderer, texto: string) {
  const b = t.root.findAllByType(Pressable).find((n) => textoDoNo(n).includes(texto));
  if (!b) throw new Error("botão não encontrado: " + texto);
  return b;
}
async function apertar(p: any) { await act(async () => { p.props.onPress?.({ stopPropagation() {} }); }); }

async function irAteFinalizar(opts: { precoNovo?: string } = {}) {
  (trocaApi.searchSalesForTroca as jest.Mock).mockResolvedValue([venda]);
  (trocaApi.create as jest.Mock).mockResolvedValue({ sale: { id: "troca-1" } });
  let t!: renderer.ReactTestRenderer;
  await act(async () => {
    t = renderer.create(
      <TrocaModal visible companyId="loja-1" products={PRODUTOS} onClose={() => {}} vale={{ saleId: VENDA_ID }} />,
    );
  });
  await act(async () => {});
  // Passo 2: devolve o tênis antigo.
  await apertar(achar(t, "troca-dev-inc-p1")[0]);
  await apertar(botao(t, "Continuar"));
  // Passo 3: leva o tênis novo.
  await apertar(botao(t, "Tênis Novo"));
  if (opts.precoNovo) {
    await apertar(achar(t, "troca-preco-0")[0]);
    const campo = t.root.findAll((n) => n.props && n.props.testID === "troca-preco-input-0" && typeof n.props.onChangeText === "function")[0];
    await act(async () => { campo.props.onChangeText(opts.precoNovo); });
    await act(async () => { campo.props.onBlur?.(); });
  }
  await apertar(botao(t, "Continuar"));
  return t;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("descontoDaTroca — regras puras", () => {
  it("desconto em % e em R$ com o mesmo teto de 50% do Caixa", () => {
    expect(MAX_DESCONTO_PCT).toBe(50);
    expect(descontoManualDaTroca(200, "%", "10")).toBe(20);
    expect(descontoManualDaTroca(200, "%", "80")).toBe(100);
    expect(descontoManualDaTroca(200, "R$", "15,50")).toBe(15.5);
    expect(descontoManualDaTroca(200, "R$", "150")).toBe(100);
    expect(descontoManualDaTroca(0, "R$", "10")).toBe(0);
    expect(descontoManualDaTroca(200, "%", "")).toBe(0);
  });

  it("campos do corpo seguem o contrato do POST /pdv/sale", () => {
    expect(camposDoDesconto("%", "10", 20)).toEqual({ discount_type: "percent", discount_value: 10 });
    expect(camposDoDesconto("%", "80", 100)).toEqual({ discount_type: "percent", discount_value: 50 });
    expect(camposDoDesconto("R$", "15,5", 15.5)).toEqual({ discount_type: "fixed", discount_value: 15.5 });
    expect(camposDoDesconto("R$", "", 0)).toEqual({});
  });

  it("lápis: preço abaixo da tabela vira item_discount; acima vai como preço", () => {
    const abaixo = itemNovoDoPayload({ product_id: "p", quantity: 2, unit_price: 90, list_price: 100, product_name_snapshot: "X" });
    expect(abaixo).toEqual(expect.objectContaining({ unit_price: 100, item_discount: 20 }));
    const acima = itemNovoDoPayload({ product_id: "p", quantity: 1, unit_price: 120, list_price: 100, product_name_snapshot: "X" });
    expect(acima.unit_price).toBe(120);
    expect(acima.item_discount).toBeUndefined();
    const semTabela = itemNovoDoPayload({ product_id: "p", quantity: 1, unit_price: 50, product_name_snapshot: "X" });
    expect(semTabela).toEqual(expect.objectContaining({ unit_price: 50, item_discount: undefined }));
    expect(subtotalDosNovos([{ product_id: "p", quantity: 2, unit_price: 90, product_name_snapshot: "X" }])).toBe(180);
  });

  it("split simples acompanha o novo valor; dividido é limpo; sem mudança devolve a mesma lista", () => {
    const pay = [{ method: "pix" as const, amount: 150 }];
    expect(acertarSplits(140, pay, []).paymentSplits).toEqual([{ method: "pix", amount: 140 }]);
    expect(acertarSplits(150, pay, []).paymentSplits).toBe(pay);
    const dividido = [{ method: "pix" as const, amount: 100 }, { method: "dinheiro" as const, amount: 50 }];
    expect(acertarSplits(140, dividido, []).paymentSplits).toEqual([]);
    // virou devolução: o pagamento sai
    const r = acertarSplits(-10, pay, [{ method: "dinheiro", amount: 5 }]);
    expect(r.paymentSplits).toEqual([]);
    expect(r.refundSplits).toEqual([{ method: "dinheiro", amount: 10 }]);
  });
});

describe("TrocaModal — desconto e preço na troca", () => {
  it("lápis no preço + desconto em R$ depois de escolher Pix: tela e POST líquidos", async () => {
    const t = await irAteFinalizar({ precoNovo: "319,99" });

    // Passo 4: escolhe Pix antes do desconto (o valor tem que acompanhar).
    expect(achar(t, "troca-desconto")).toHaveLength(1);
    await apertar(botao(t, "Pix"));
    await apertar(botao(t, "R$"));
    const campoDesconto = t.root.findAllByType(TextInput).find((n) => n.props.placeholder === "0,00");
    await act(async () => { campoDesconto!.props.onChangeText("10"); });

    // 319,99 − 10,00 − 189,90 = 120,09
    expect(tudo(t)).toContain("R$ 120,09");
    expect(achar(t, "troca-resumo-desconto")).toHaveLength(1);

    await apertar(botao(t, "Confirmar troca"));
    expect(toast.error).not.toHaveBeenCalled();
    expect(trocaApi.create).toHaveBeenCalledTimes(1);
    const body = (trocaApi.create as jest.Mock).mock.calls[0][1];
    expect(body.new_items).toEqual([expect.objectContaining({ product_id: "p9", unit_price: 339.99, item_discount: 20, quantity: 1 })]);
    expect(body.discount_type).toBe("fixed");
    expect(body.discount_value).toBe(10);
    expect(body.payment_method).toBe("pix");
  });

  it("desconto em % aparece no valor a pagar e vai como percent", async () => {
    const t = await irAteFinalizar();
    const campoDesconto = t.root.findAllByType(TextInput).find((n) => n.props.placeholder === "0");
    await act(async () => { campoDesconto!.props.onChangeText("10"); });
    // 339,99 − 34,00 − 189,90 = 116,09
    expect(tudo(t)).toContain("R$ 116,09");
    await apertar(botao(t, "Pix"));
    await apertar(botao(t, "Confirmar troca"));
    const body = (trocaApi.create as jest.Mock).mock.calls[0][1];
    expect(body.discount_type).toBe("percent");
    expect(body.discount_value).toBe(10);
    expect(body.new_items[0].item_discount).toBeUndefined();
  });

  it("sem desconto e sem lápis: payload de sempre, sem campos de desconto", async () => {
    const t = await irAteFinalizar();
    expect(tudo(t)).toContain("R$ 150,09");
    await apertar(botao(t, "Pix"));
    await apertar(botao(t, "Confirmar troca"));
    const body = (trocaApi.create as jest.Mock).mock.calls[0][1];
    expect(body).not.toHaveProperty("discount_type");
    expect(body).not.toHaveProperty("discount_value");
    expect(body.new_items[0]).toEqual(expect.objectContaining({ unit_price: 339.99, item_discount: undefined }));
  });
});
