// 17/11/2026 (p-167) — "+ Novo cliente" dentro da troca.
//
// O que este arquivo segura:
//   1. "+ Novo cliente" na última linha da busca troca o miolo do passo
//      (sem segundo modal): a barra de passos fica, o passo fica montado e
//      escondido, e o rodapé vira "Cancelar / Salvar cliente";
//   2. mesma validação e mesma rota do cadastro rápido (só o nome é
//      obrigatório; POST /companies/:id/customers na loja da troca);
//   3. salvou: o cliente fica escolhido e a troca segue no mesmo passo, com
//      os itens e o destino no lugar, e o payload leva o id novo;
//   4. cliente parecido (nome sem acento ou telefone): "Usar este" escolhe o
//      existente sem criar; "Criar outro mesmo assim" cria;
//   5. Cancelar e Esc voltam para a troca sem perder nada.
// Mocks do padrão do repo; testID + deep:false.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockClientes = [
  { id: "cli-1", name: "Marina Duarte", phone: "(12) 99812-4407" },
  { id: "cli-2", name: "João Simões", phone: "(12) 99731-0952" },
];
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    () => ({ company: { id: "loja-1", name: "Loja Centro" }, token: "t", availableCompanies: [] }),
    { getState: () => ({ token: "t", company: { id: "loja-1" } }) },
  ),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, invalidate: jest.fn() }) }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/VariantPickerModal", () => ({ VariantPickerModal: () => null }));
jest.mock("@/components/screens/pdv/troca/Step5Success", () => ({ Step5Success: () => null }));
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ customers: mockClientes, isLoading: false }),
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
import { companiesApi } from "@/services/api";
import { camposDaBusca } from "@/components/screens/pdv/troca/NovoClienteNaTroca";
import { TEXTOS_DO_CLIENTE as T } from "@/components/screens/pdv/troca/textosDoCliente";

const VENDA_ID = "3f2a9c1e-7b44-4d0a-9e5f-0a1b2c3d4e5f";
const venda = {
  id: VENDA_ID, total_amount: 139.9, payment_method: "pix", status: "completed",
  created_at: "2026-11-10T18:42:10Z", company_id: "loja-1", company_name: "Loja Centro",
  customer_id: null, customer_name: null, cpf_cnpj: null,
  seller_id: null, seller_name: "Vendedora", is_cross_filial: false, has_nfce: false, item_count: 1,
  items: [{
    id: "item-1", product_id: "p1", variant_id: null, product_name_snapshot: "Blusa Tricot",
    quantity: 1, unit_price: 139.9, total_price: 139.9, original_sale_item_id: "item-1",
  }],
};

function textoDoNo(n: any): string {
  if (n == null) return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  return (n.children || []).map(textoDoNo).join("");
}
const achar = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const campo = (t: renderer.ReactTestRenderer, id: string) =>
  achar(t, id).find((n) => typeof n.props.onChangeText === "function")!;
function botao(t: renderer.ReactTestRenderer, texto: string) {
  const b = t.root.findAllByType(Pressable).find((n) => textoDoNo(n).includes(texto));
  if (!b) throw new Error("botão não encontrado: " + texto);
  return b;
}
async function apertar(p: any) { await act(async () => { p.props.onPress?.({ stopPropagation() {} }); }); }
async function digitar(t: renderer.ReactTestRenderer, id: string, v: string) {
  await act(async () => { campo(t, id).props.onChangeText(v); });
}
const tudo = (t: renderer.ReactTestRenderer) => textoDoNo(t.root);

let criarSpy: jest.SpyInstance;
// Cada troca montada ouve o Esc na janela: desmonta todas no fim do teste.
const montadas: renderer.ReactTestRenderer[] = [];

/** Até o formulário "Novo cliente", aberto pela busca do passo 3. */
async function abrirNovoCliente(busca: string) {
  (trocaApi.searchSalesForTroca as jest.Mock).mockResolvedValue([venda]);
  (trocaApi.createV2 as jest.Mock).mockResolvedValue({ sale: { id: "troca-1" } });
  const qc = new QueryClient();
  qc.setQueryData(["customers", "loja-1", "recent"], { customers: mockClientes });
  let t!: renderer.ReactTestRenderer;
  await act(async () => {
    t = renderer.create(
      <QueryClientProvider client={qc}>
        <TrocaModal visible companyId="loja-1" products={[]} onClose={() => {}} vale={{ saleId: VENDA_ID }} />
      </QueryClientProvider>,
    );
  });
  montadas.push(t);
  await act(async () => {});
  await apertar(achar(t, "troca-dev-inc-p1")[0]);
  await apertar(botao(t, "Continuar"));
  await apertar(botao(t, "Crédito na conta"));
  await apertar(achar(t, "troca-credito-para-escolher")[0]);
  if (busca) await digitar(t, "troca-credito-para-q", busca);
  await apertar(achar(t, "troca-credito-para-novo")[0]);
  return t;
}

beforeEach(() => {
  jest.clearAllMocks();
  criarSpy = jest.spyOn(companiesApi, "createCustomer").mockResolvedValue({ id: "cli-novo", name: "Rafael Antunes", phone: "12991234567" });
});
afterEach(() => {
  criarSpy.mockRestore();
  act(() => { montadas.splice(0).forEach((m) => m.unmount()); });
});

describe("camposDaBusca", () => {
  it("com número vira telefone; sem número vira nome", () => {
    expect(camposDaBusca("Rafael")).toEqual({ nome: "Rafael", tel: "" });
    expect(camposDaBusca("12991234567").nome).toBe("");
    expect(camposDaBusca("12991234567").tel.replace(/\D/g, "")).toBe("12991234567");
    expect(camposDaBusca("  ")).toEqual({ nome: "", tel: "" });
  });
});

describe("TrocaModal — + Novo cliente", () => {
  it("troca o miolo do passo, mantém a barra de passos e muda o rodapé", async () => {
    const t = await abrirNovoCliente("Rafael");
    expect(achar(t, "troca-novo-cliente")).toHaveLength(1);
    expect(campo(t, "troca-novo-cliente-nome").props.value).toBe("Rafael");
    // barra de passos no lugar; rodapé do formulário no lugar do da troca
    expect(tudo(t)).toContain("Levar (opcional)");
    expect(tudo(t)).toContain(T.rodapeNovoCliente);
    expect(achar(t, "troca-rodape-info")).toHaveLength(0);
    // o passo continua montado (escondido), com o destino crédito
    const corpo = t.root.findAll((n) => n.props && n.props.contentContainerStyle && n.props.keyboardShouldPersistTaps === "handled" && Array.isArray(n.props.style), { deep: false })[0];
    expect(JSON.stringify(corpo.props.style)).toContain("none");
    expect(achar(t, "troca-credito-para-vazio-cliente")).toHaveLength(1);
  });

  it("Salvar só acende com o nome; salvou, o cliente fica escolhido e a troca segue", async () => {
    const t = await abrirNovoCliente("R");
    expect(achar(t, "troca-novo-cliente-salvar")[0].props.disabled).toBe(true);
    await digitar(t, "troca-novo-cliente-nome", "Rafael Antunes");
    await digitar(t, "troca-novo-cliente-tel", "12991234567");
    expect(achar(t, "troca-novo-cliente-salvar")[0].props.disabled).toBe(false);
    await apertar(achar(t, "troca-novo-cliente-salvar")[0]);

    expect(criarSpy).toHaveBeenCalledWith("loja-1", expect.objectContaining({
      name: "Rafael Antunes", phone: "12991234567", source: "pdv",
    }));
    expect(achar(t, "troca-novo-cliente")).toHaveLength(0);
    const linha = achar(t, "troca-credito-para-preenchido")[0];
    expect(textoDoNo(linha)).toContain("Rafael Antunes");
    expect(achar(t, "troca-credito-para-salvo")).toHaveLength(1);
    expect(textoDoNo(achar(t, "troca-rodape-info")[0])).toContain(T.rodapeCreditoPara("Rafael Antunes"));

    // mesmo passo, itens no lugar: segue até o fim e o crédito vai para o novo
    await apertar(botao(t, "Continuar"));
    await apertar(botao(t, "Crédito conta"));
    await apertar(botao(t, "Confirmar devolução"));
    const corpo = (trocaApi.createV2 as jest.Mock).mock.calls[0][1];
    expect(corpo.customer_id).toBe("cli-novo");
    expect(corpo.returned_items).toHaveLength(1);
  });

  it("telefone digitado na busca vem no campo de telefone", async () => {
    const t = await abrirNovoCliente("12 99123");
    expect(campo(t, "troca-novo-cliente-nome").props.value).toBe("");
    expect(campo(t, "troca-novo-cliente-tel").props.value.replace(/\D/g, "")).toBe("1299123");
  });

  it("nome parecido (sem acento): Usar este escolhe o existente, sem criar", async () => {
    const t = await abrirNovoCliente("joao simoes");
    await apertar(achar(t, "troca-novo-cliente-salvar")[0]);
    const aviso = achar(t, "troca-novo-cliente-parecido")[0];
    expect(textoDoNo(aviso)).toContain(T.parecido("nome"));
    expect(textoDoNo(aviso)).toContain("João Simões");
    expect(criarSpy).not.toHaveBeenCalled();
    await apertar(achar(t, "troca-novo-cliente-usar-este")[0]);
    expect(achar(t, "troca-novo-cliente")).toHaveLength(0);
    expect(textoDoNo(achar(t, "troca-credito-para-preenchido")[0])).toContain("João Simões");
    expect(achar(t, "troca-credito-para-salvo")).toHaveLength(0);
  });

  it("telefone parecido: Criar outro mesmo assim cria", async () => {
    const t = await abrirNovoCliente("Outra Pessoa");
    await digitar(t, "troca-novo-cliente-tel", "(12) 99731-0952");
    await apertar(achar(t, "troca-novo-cliente-salvar")[0]);
    expect(textoDoNo(achar(t, "troca-novo-cliente-parecido")[0])).toContain(T.parecido("telefone"));
    await apertar(achar(t, "troca-novo-cliente-criar-mesmo")[0]);
    expect(criarSpy).toHaveBeenCalledTimes(1);
    expect(achar(t, "troca-credito-para-preenchido")).toHaveLength(1);
  });

  it("Cancelar volta para a troca sem perder nada", async () => {
    const t = await abrirNovoCliente("Rafael");
    await apertar(achar(t, "troca-novo-cliente-cancelar")[0]);
    expect(achar(t, "troca-novo-cliente")).toHaveLength(0);
    expect(achar(t, "troca-credito-para-vazio-cliente")).toHaveLength(1);
    expect(textoDoNo(achar(t, "troca-rodape-info")[0])).toContain(T.rodapeFaltaCliente);
    expect(criarSpy).not.toHaveBeenCalled();
  });

  it("Esc fecha o formulário, não a troca", async () => {
    const t = await abrirNovoCliente("Rafael");
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    });
    expect(achar(t, "troca-novo-cliente")).toHaveLength(0);
    expect(tudo(t)).not.toContain("Descartar esta operação?");
    expect(achar(t, "troca-credito-para-vazio-cliente")).toHaveLength(1);
  });

  it("busca sem resultado convida a cadastrar", async () => {
    (trocaApi.searchSalesForTroca as jest.Mock).mockResolvedValue([venda]);
    const qc = new QueryClient();
    let t!: renderer.ReactTestRenderer;
    await act(async () => {
      t = renderer.create(
        <QueryClientProvider client={qc}>
          <TrocaModal visible companyId="loja-1" products={[]} onClose={() => {}} vale={{ saleId: VENDA_ID }} />
        </QueryClientProvider>,
      );
    });
    montadas.push(t);
    await act(async () => {});
    await apertar(achar(t, "troca-dev-inc-p1")[0]);
    await apertar(botao(t, "Continuar"));
    await apertar(botao(t, "Crédito na conta"));
    await apertar(achar(t, "troca-credito-para-escolher")[0]);
    await digitar(t, "troca-credito-para-q", "Zuleica");
    expect(textoDoNo(achar(t, "troca-credito-para-vazio")[0])).toBe(T.semResultado);
    expect(achar(t, "troca-credito-para-novo")).toHaveLength(1);
  });
});
