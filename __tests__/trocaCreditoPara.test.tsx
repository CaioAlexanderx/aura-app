// 17/11/2026 (p-166) — cliente do crédito dentro da troca.
//
// Antes o crédito ia sempre para o cliente da venda original; venda sem
// cliente só dava erro no último passo. O que este arquivo segura:
//   1. regras puras (troca/clienteDoCredito): busca por nome sem acento ou
//      pedaço do telefone, cliente efetivo, crédito na conta, erros do servidor;
//   2. venda sem cliente: o passo 3 deixa seguir e avisa no rodapé; no passo 4
//      só o Confirmar trava, com o motivo; escolher o cliente destrava e o
//      payload leva o customer_id escolhido;
//   3. venda com cliente: linha preenchida, payload igual ao de antes; "Trocar"
//      manda outro cliente (caso do presente);
//   4. 422 CREDITO_EXIGE_CLIENTE e 404 CUSTOMER_NOT_FOUND viram mensagem clara;
//   5. "O crédito vale nesta loja" só com mais de uma loja.
// Mocks do padrão do repo; testID + deep:false.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable } from "react-native";

let mockLojas: any[] = [];
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    () => ({ company: { id: "loja-1", name: "Loja Centro", trade_name: "Loja Centro" }, token: "t", availableCompanies: mockLojas }),
    { getState: () => ({ token: "t", company: { id: "loja-1" } }) },
  ),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, invalidate: jest.fn() }) }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/VariantPickerModal", () => ({ VariantPickerModal: () => null }));
jest.mock("@/components/screens/pdv/troca/Step5Success", () => ({ Step5Success: () => null }));
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({
    customers: [
      { id: "cli-1", name: "Marina Duarte", phone: "(12) 99812-4407" },
      { id: "cli-2", name: "João Simões", phone: "" },
      { id: "cli-3", name: "Helena Prado", phone: "(12) 99105-7733" },
    ],
    isLoading: false,
  }),
}));
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
  normalizarTexto, filtrarClientes, iniciais, temCreditoNaConta, clienteEfetivo, erroDoClienteDaTroca,
} from "@/components/screens/pdv/troca/clienteDoCredito";
import { TEXTOS_DO_CLIENTE } from "@/components/screens/pdv/troca/textosDoCliente";

const VENDA_ID = "3f2a9c1e-7b44-4d0a-9e5f-0a1b2c3d4e5f";
function vendaCom(cliente: { id: string; name: string } | null) {
  return {
    id: VENDA_ID, total_amount: 139.9, payment_method: "pix", status: "completed",
    created_at: "2026-11-10T18:42:10Z", company_id: "loja-1", company_name: "Loja Centro",
    customer_id: cliente?.id || null, customer_name: cliente?.name || null, cpf_cnpj: null,
    seller_id: null, seller_name: "Vendedora", is_cross_filial: false, has_nfce: false, item_count: 1,
    items: [{
      id: "item-1", product_id: "p1", variant_id: null, product_name_snapshot: "Blusa Tricot",
      quantity: 1, unit_price: 139.9, total_price: 139.9, original_sale_item_id: "item-1",
    }],
  };
}

function textoDoNo(n: any): string {
  if (n == null) return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  return (n.children || []).map(textoDoNo).join("");
}
const achar = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
function botao(t: renderer.ReactTestRenderer, texto: string) {
  const b = t.root.findAllByType(Pressable).find((n) => textoDoNo(n).includes(texto));
  if (!b) throw new Error("botão não encontrado: " + texto);
  return b;
}
async function apertar(p: any) { await act(async () => { p.props.onPress?.({ stopPropagation() {} }); }); }
const rodape = (t: renderer.ReactTestRenderer) => {
  const info = achar(t, "troca-rodape-info")[0];
  if (info) return textoDoNo(info);
  return textoDoNo(achar(t, "troca-rodape-travado")[0]);
};

async function irAtePasso3(cliente: { id: string; name: string } | null) {
  (trocaApi.searchSalesForTroca as jest.Mock).mockResolvedValue([vendaCom(cliente)]);
  (trocaApi.createV2 as jest.Mock).mockResolvedValue({ sale: { id: "troca-1" } });
  let t!: renderer.ReactTestRenderer;
  await act(async () => {
    t = renderer.create(
      <TrocaModal visible companyId="loja-1" products={[]} onClose={() => {}} vale={{ saleId: VENDA_ID }} />,
    );
  });
  await act(async () => {});
  await apertar(achar(t, "troca-dev-inc-p1")[0]);
  await apertar(botao(t, "Continuar"));
  return t;
}

async function creditoNaContaAtePasso4(t: renderer.ReactTestRenderer) {
  await apertar(botao(t, "Crédito na conta"));
  await apertar(botao(t, "Continuar"));
  await apertar(botao(t, "Crédito conta"));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLojas = [];
});

describe("clienteDoCredito — regras puras", () => {
  const lista = [
    { id: "a", name: "João Simões", phone: "(12) 99812-4407" },
    { id: "b", name: "Mariana Souza", phone: "" },
    { id: "c", name: "Marcos Lima", phone: "(12) 98844-1620" },
  ];
  it("busca por nome sem acento e sem maiúscula", () => {
    expect(normalizarTexto("  JOÃO   Simões ")).toBe("joao simoes");
    expect(filtrarClientes(lista, "joao").map((c) => c.id)).toEqual(["a"]);
    expect(filtrarClientes(lista, "MAR").map((c) => c.id)).toEqual(["b", "c"]);
  });
  it("busca por pedaço do telefone (3 dígitos ou mais), com ou sem máscara", () => {
    expect(filtrarClientes(lista, "99812").map((c) => c.id)).toEqual(["a"]);
    expect(filtrarClientes(lista, "(12) 988").map((c) => c.id)).toEqual(["c"]);
    expect(filtrarClientes(lista, "12").map((c) => c.id)).toEqual([]);
  });
  it("sem busca, os primeiros da lista (recentes); limites respeitados", () => {
    expect(filtrarClientes(lista, "", { recentes: 2 }).map((c) => c.id)).toEqual(["a", "b"]);
    expect(filtrarClientes(lista, "a", { resultados: 1 })).toHaveLength(1);
  });
  it("iniciais do avatar", () => {
    expect(iniciais("Marina Duarte")).toBe("MD");
    expect(iniciais("joão")).toBe("J");
    expect(iniciais("")).toBe("?");
  });
  it("crédito na conta só com estorno crediario_credito acima de zero", () => {
    expect(temCreditoNaConta([{ method: "crediario_credito", amount: 10 }] as any)).toBe(true);
    expect(temCreditoNaConta([{ method: "pix", amount: 10 }] as any)).toBe(false);
    expect(temCreditoNaConta([{ method: "crediario_credito", amount: 0 }] as any)).toBe(false);
    expect(temCreditoNaConta(undefined)).toBe(false);
  });
  it("cliente efetivo: sem escolha, o da venda; escolha vale; null é ninguém", () => {
    const vendas = [vendaCom({ id: "v", name: "Da Venda" })] as any;
    expect(clienteEfetivo(undefined, vendas)).toEqual({ id: "v", name: "Da Venda", phone: null });
    expect(clienteEfetivo({ id: "x", name: "X", phone: null }, vendas)?.id).toBe("x");
    expect(clienteEfetivo(null, vendas)).toBeNull();
    expect(clienteEfetivo(undefined, [vendaCom(null)] as any)).toBeNull();
  });
  it("erros do servidor pelo código", () => {
    expect(erroDoClienteDaTroca({ status: 422, data: { code: "CREDITO_EXIGE_CLIENTE" } }))
      .toEqual({ mensagem: TEXTOS_DO_CLIENTE.erroCreditoExigeCliente, limparEscolha: false });
    expect(erroDoClienteDaTroca({ status: 404, data: { code: "CUSTOMER_NOT_FOUND" } }))
      .toEqual({ mensagem: TEXTOS_DO_CLIENTE.erroClienteNaoEncontrado, limparEscolha: true });
    expect(erroDoClienteDaTroca({ status: 500, message: "x" })).toBeNull();
  });
});

describe("TrocaModal — venda sem cliente", () => {
  it("passo 3 deixa seguir e avisa; passo 4 trava só o Confirmar, com o motivo", async () => {
    const t = await irAtePasso3(null);
    await apertar(botao(t, "Crédito na conta"));
    expect(achar(t, "troca-credito-para-vazio-cliente")).toHaveLength(1);
    expect(rodape(t)).toContain(TEXTOS_DO_CLIENTE.rodapeFaltaCliente);
    expect(botao(t, "Continuar").props.disabled).toBe(false);

    await apertar(botao(t, "Continuar"));
    // Sem crédito escolhido no passo 4 ainda: nada trava por cliente.
    expect(rodape(t)).toBe("Confira e confirme");
    await apertar(botao(t, "Crédito conta"));
    expect(achar(t, "troca-rodape-travado")).toHaveLength(1);
    expect(rodape(t)).toBe(TEXTOS_DO_CLIENTE.rodapeTravado);
    expect(botao(t, "Confirmar devolução").props.disabled).toBe(true);
    expect(achar(t, "troca-credito-para-vazio-cliente")).toHaveLength(1);
  });

  it("escolher o cliente na busca destrava e o payload leva o customer_id escolhido", async () => {
    const t = await irAtePasso3(null);
    await creditoNaContaAtePasso4(t);
    await apertar(achar(t, "troca-credito-para-escolher")[0]);
    const campo = achar(t, "troca-credito-para-q").find((n) => typeof n.props.onChangeText === "function")!;
    await act(async () => { campo.props.onChangeText("joao"); });
    expect(achar(t, "troca-credito-para-opcao-cli-1")).toHaveLength(0);
    await apertar(achar(t, "troca-credito-para-opcao-cli-2")[0]);

    expect(achar(t, "troca-credito-para-preenchido")).toHaveLength(1);
    expect(rodape(t)).toBe("Confira e confirme");
    const confirmar = botao(t, "Confirmar devolução");
    expect(confirmar.props.disabled).toBe(false);
    await apertar(confirmar);
    expect(trocaApi.createV2).toHaveBeenCalledTimes(1);
    const corpo = (trocaApi.createV2 as jest.Mock).mock.calls[0][1];
    expect(corpo.customer_id).toBe("cli-2");
    expect(corpo.refund_splits).toEqual([{ method: "crediario_credito", amount: 139.9 }]);
  });

  it("o rodapé do passo 3 mostra para quem vai o crédito depois de escolher", async () => {
    const t = await irAtePasso3(null);
    await apertar(botao(t, "Crédito na conta"));
    await apertar(achar(t, "troca-credito-para-escolher")[0]);
    await apertar(achar(t, "troca-credito-para-opcao-cli-3")[0]);
    expect(rodape(t)).toContain(TEXTOS_DO_CLIENTE.rodapeCreditoPara("Helena Prado"));
    // Voltando do passo 4, o destino e o cliente continuam.
    await apertar(botao(t, "Continuar"));
    await apertar(botao(t, "Voltar"));
    expect(achar(t, "troca-credito-para-preenchido")).toHaveLength(1);
  });
});

describe("TrocaModal — venda com cliente", () => {
  const MARINA = { id: "cli-1", name: "Marina Duarte" };

  it("linha preenchida com o cliente da venda; payload igual ao de antes", async () => {
    const t = await irAtePasso3(MARINA);
    await creditoNaContaAtePasso4(t);
    const linha = achar(t, "troca-credito-para-preenchido")[0];
    expect(textoDoNo(linha)).toContain("Marina Duarte");
    // telefone completado pela lista do Caixa
    expect(textoDoNo(linha)).toContain("(12) 99812-4407");
    expect(textoDoNo(linha)).toContain(TEXTOS_DO_CLIENTE.daVendaOriginal);
    expect(textoDoNo(linha)).toContain(TEXTOS_DO_CLIENTE.dicaPresente);
    expect(achar(t, "troca-credito-para-loja")).toHaveLength(0);
    await apertar(botao(t, "Confirmar devolução"));
    expect((trocaApi.createV2 as jest.Mock).mock.calls[0][1].customer_id).toBe("cli-1");
  });

  it("presente: Trocar escolhe outra pessoa e o crédito vai para ela", async () => {
    const t = await irAtePasso3(MARINA);
    await creditoNaContaAtePasso4(t);
    await apertar(achar(t, "troca-credito-para-trocar")[0]);
    expect(achar(t, "troca-credito-para-busca")).toHaveLength(1);
    await apertar(achar(t, "troca-credito-para-opcao-cli-3")[0]);
    const linha = achar(t, "troca-credito-para-preenchido")[0];
    expect(textoDoNo(linha)).toContain("Helena Prado");
    expect(textoDoNo(linha)).not.toContain(TEXTOS_DO_CLIENTE.daVendaOriginal);
    await apertar(botao(t, "Confirmar devolução"));
    expect((trocaApi.createV2 as jest.Mock).mock.calls[0][1].customer_id).toBe("cli-3");
  });

  it("devolução em dinheiro: sem linha e o cliente da venda segue no payload", async () => {
    const t = await irAtePasso3(MARINA);
    await apertar(botao(t, "Devolver em dinheiro"));
    await apertar(botao(t, "Continuar"));
    await apertar(botao(t, "Pix"));
    expect(achar(t, "troca-credito-para-preenchido")).toHaveLength(0);
    await apertar(botao(t, "Confirmar devolução"));
    // Pix sozinho segue no contrato v1, com o cliente da venda, como antes.
    expect(trocaApi.create).toHaveBeenCalledTimes(1);
    expect((trocaApi.create as jest.Mock).mock.calls[0][1].customer_id).toBe("cli-1");
  });

  it("com mais de uma loja, avisa em qual loja o crédito vale", async () => {
    mockLojas = [{ id: "loja-1" }, { id: "loja-2" }];
    const t = await irAtePasso3(MARINA);
    await creditoNaContaAtePasso4(t);
    const loja = achar(t, "troca-credito-para-loja")[0];
    expect(textoDoNo(loja)).toContain(TEXTOS_DO_CLIENTE.lojaDoCredito);
    expect(textoDoNo(loja)).toContain("Loja Centro");
  });
});

describe("TrocaModal — respostas do servidor", () => {
  it("422 CREDITO_EXIGE_CLIENTE vira mensagem clara", async () => {
    const t = await irAtePasso3({ id: "cli-1", name: "Marina Duarte" });
    await creditoNaContaAtePasso4(t);
    (trocaApi.createV2 as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("texto do servidor"), { status: 422, data: { code: "CREDITO_EXIGE_CLIENTE" } }),
    );
    await apertar(botao(t, "Confirmar devolução"));
    expect(toast.error).toHaveBeenCalledWith(TEXTOS_DO_CLIENTE.erroCreditoExigeCliente);
  });

  it("404 CUSTOMER_NOT_FOUND avisa e pede o cliente de novo", async () => {
    const t = await irAtePasso3(null);
    await creditoNaContaAtePasso4(t);
    await apertar(achar(t, "troca-credito-para-escolher")[0]);
    await apertar(achar(t, "troca-credito-para-opcao-cli-2")[0]);
    (trocaApi.createV2 as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("Cliente não encontrado"), { status: 404, data: { code: "CUSTOMER_NOT_FOUND" } }),
    );
    await apertar(botao(t, "Confirmar devolução"));
    expect(toast.error).toHaveBeenCalledWith(TEXTOS_DO_CLIENTE.erroClienteNaoEncontrado);
    expect(achar(t, "troca-credito-para-vazio-cliente")).toHaveLength(1);
    expect(botao(t, "Confirmar devolução").props.disabled).toBe(true);
  });
});
