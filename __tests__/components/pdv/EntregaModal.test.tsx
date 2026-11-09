// ============================================================
// Caixa: a trava da venda com frete — EntregaModal (09/11/2026, parte 2;
// mockup "Entrega no Caixa", D e E).
//   - "Para onde vai a entrega?" (cliente sem endereço): sem número e
//     cidade não segue; completo, devolve a entrega do cliente;
//   - "Quem recebe a entrega?" (sem cliente): acha cliente pela busca; quem
//     tem endereço segue direto, quem não tem cai no endereço; cadastro
//     novo exige o nome;
//   - "Voltar" devolve o que foi digitado (rascunho) e o rascunho volta.
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
// O <Modal> do react-native-web monta por portal, que o react-test-renderer
// não desenha: achatado para dentro da árvore, preservando `visible`.
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return { ...RN, Modal: ({ visible, children }: any) => (visible ? children : null) };
});

import React from "react";
import renderer, { act } from "react-test-renderer";
import { EntregaModal, type ClienteDaEntrega } from "@/components/screens/pdv/EntregaModal";
import { ENDERECO_VAZIO, type Endereco } from "@/components/endereco/endereco";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
const porId = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const texto = (tree: renderer.ReactTestRenderer, id: string) => {
  const a = porId(tree, id);
  return a.length ? flattenText(a[0].children) : "";
};
const digitar = (tree: renderer.ReactTestRenderer, id: string, v: string) =>
  act(() => { porId(tree, id)[0].props.onChangeText(v); });
const tocar = (tree: renderer.ReactTestRenderer, id: string) =>
  act(() => { porId(tree, id)[0].props.onPress(); });

const END: Endereco = {
  ...ENDERECO_VAZIO, zip: "01310100", street: "Av. Paulista", number: "1000",
  neighborhood: "Bela Vista", city: "São Paulo", state: "SP",
};
const CLIENTES: ClienteDaEntrega[] = [
  { id: "c-com", name: "Pessoa Com Endereço", phone: "11911112222", endereco: END, hasAddress: true },
  { id: "c-sem", name: "Pessoa Sem Endereço", phone: "11933334444", endereco: { ...ENDERECO_VAZIO }, hasAddress: false },
];

// O ViaCEP nunca é chamado: o CEP fica fora dos testes, o resto é à mão.
const semCep = jest.fn(() => Promise.resolve(null));

function montar(props: Partial<React.ComponentProps<typeof EntregaModal>> = {}) {
  const onVoltar = jest.fn();
  const onConfirmar = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <EntregaModal
        pedido="endereco"
        cliente={{ id: "c-sem", name: "Pessoa Sem Endereço", phone: "11933334444" }}
        clientes={CLIENTES}
        rascunho={null}
        onVoltar={onVoltar}
        onConfirmar={onConfirmar}
        buscarCep={semCep}
        {...props}
      />,
    );
  });
  return { tree, onVoltar, onConfirmar };
}

function preencherEndereco(tree: renderer.ReactTestRenderer) {
  tocar(tree, "entrega-endereco-manual");
  digitar(tree, "entrega-endereco-street", "Rua Jerônimo da Veiga");
  digitar(tree, "entrega-endereco-number", "45");
  digitar(tree, "entrega-endereco-city", "São Paulo");
}

describe("Para onde vai a entrega? (cliente sem endereço)", () => {
  test("título e texto do mockup", () => {
    const { tree } = montar();
    expect(texto(tree, "entrega-titulo")).toBe("Para onde vai a entrega?");
    expect(flattenText(tree.toJSON())).toContain("Pessoa Sem Endereço ainda não tem endereço. Ele fica guardado no cadastro para as próximas entregas.");
    expect(texto(tree, "entrega-confirmar")).toBe("Salvar e continuar");
    expect(porId(tree, "entrega-busca")).toHaveLength(0);
    tree.unmount();
  });

  test("sem o mínimo não segue e diz o que falta", () => {
    const { tree, onConfirmar } = montar();
    tocar(tree, "entrega-confirmar");
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(texto(tree, "entrega-falta")).toBe("Falta CEP ou rua, número e cidade para levar a entrega.");
    tree.unmount();
  });

  test("completo: devolve a entrega do cliente, com o recado", () => {
    const { tree, onConfirmar } = montar();
    preencherEndereco(tree);
    digitar(tree, "entrega-recado", "interfone 32");
    tocar(tree, "entrega-confirmar");
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    const [entrega, cliente] = onConfirmar.mock.calls[0];
    expect(cliente).toBeNull();
    expect(entrega).toMatchObject({
      customerId: "c-sem", nome: "Pessoa Sem Endereço", telefone: "11933334444",
      recado: "interfone 32", novoCliente: false,
    });
    expect(entrega.endereco).toMatchObject({ street: "Rua Jerônimo da Veiga", number: "45", city: "São Paulo" });
    tree.unmount();
  });

  test("Voltar devolve o rascunho, e o rascunho volta ao abrir de novo", () => {
    const { tree, onVoltar } = montar();
    preencherEndereco(tree);
    tocar(tree, "entrega-voltar");
    expect(onVoltar).toHaveBeenCalledTimes(1);
    const rascunho = onVoltar.mock.calls[0][0];
    expect(rascunho.endereco.number).toBe("45");
    tree.unmount();

    const outra = montar({ rascunho });
    expect(porId(outra.tree, "entrega-endereco-number")[0].props.value).toBe("45");
    outra.tree.unmount();
  });
});

describe("Quem recebe a entrega? (sem cliente)", () => {
  const quem = { pedido: "quem" as const, cliente: null };

  test("título, busca e cadastro", () => {
    const { tree } = montar(quem);
    expect(texto(tree, "entrega-titulo")).toBe("Quem recebe a entrega?");
    expect(porId(tree, "entrega-busca")).toHaveLength(1);
    expect(porId(tree, "entrega-nome")).toHaveLength(1);
    expect(texto(tree, "entrega-confirmar")).toBe("Cadastrar e continuar");
    tree.unmount();
  });

  test("busca acha cliente com endereço: segue direto com ele", () => {
    const { tree, onConfirmar } = montar(quem);
    digitar(tree, "entrega-busca", "com end");
    tocar(tree, "entrega-cliente-c-com");
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    const [entrega, cliente] = onConfirmar.mock.calls[0];
    expect(cliente.id).toBe("c-com");
    expect(entrega).toMatchObject({ customerId: "c-com", novoCliente: false });
    expect(entrega.endereco.street).toBe("Av. Paulista");
    tree.unmount();
  });

  test("busca pelo telefone acha cliente sem endereço: pede o endereço dele", () => {
    const { tree, onConfirmar } = montar(quem);
    digitar(tree, "entrega-busca", "3333-44");
    tocar(tree, "entrega-cliente-c-sem");
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(texto(tree, "entrega-titulo")).toBe("Para onde vai a entrega?");
    preencherEndereco(tree);
    tocar(tree, "entrega-confirmar");
    const [entrega, cliente] = onConfirmar.mock.calls[0];
    expect(cliente.id).toBe("c-sem");
    expect(entrega).toMatchObject({ customerId: "c-sem", novoCliente: false });
    tree.unmount();
  });

  test("cadastro novo: sem nome não segue; com nome vira cliente novo", () => {
    const { tree, onConfirmar } = montar(quem);
    preencherEndereco(tree);
    tocar(tree, "entrega-confirmar");
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(texto(tree, "entrega-falta")).toBe("Falta nome para levar a entrega.");
    digitar(tree, "entrega-nome", "Pessoa Nova");
    digitar(tree, "entrega-telefone", "21955554321");
    tocar(tree, "entrega-confirmar");
    const [entrega, cliente] = onConfirmar.mock.calls[0];
    expect(cliente).toBeNull();
    expect(entrega).toMatchObject({ customerId: null, nome: "Pessoa Nova", telefone: "(21) 95555-4321", novoCliente: true });
    tree.unmount();
  });

  test("loja sem Clientes no Caixa: sem busca, só o cadastro", () => {
    const { tree } = montar({ ...quem, clientes: [] });
    expect(porId(tree, "entrega-busca")).toHaveLength(0);
    expect(porId(tree, "entrega-nome")).toHaveLength(1);
    tree.unmount();
  });

  test("fechado (pedido null): não desenha nada", () => {
    const { tree } = montar({ pedido: null });
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });
});
