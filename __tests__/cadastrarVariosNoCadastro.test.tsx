// ============================================================
// E2 (17/11/2026): a faixa "Cadastrar vários" no "+ Produto".
// Mockup aprovado: estoque-portas-mockup-17-11.html, partes 2 e 3.
//
// O que estes testes seguram:
//   1. a faixa aparece no cadastro novo de produto (computador e 375 px),
//      com os textos aprovados;
//   2. não aparece na edição, no serviço, no demo, no consolidado nem
//      quando o pai não entrega as ações (sem a prop, o modal é o de antes);
//   3. tocar nela troca o miolo pela escolha da origem; "Voltar para um só"
//      volta ao formulário; as origens chamam o que o pai entregou;
//   4. com algo digitado, pergunta antes (o mesmo aviso do fechar);
//   5. `abrirNaEscolha` abre o modal direto na escolha (o "← Voltar" da lista).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/components/BarcodeQRSection", () => ({ BarcodeQRSection: () => null }));
jest.mock("@/components/catalog/CategoryTreePicker", () => ({ CategoryTreePicker: () => null }));
jest.mock("@/components/ProductImageUpload", () => ({ ProductImageUpload: () => null }));
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ children, active }: any) => (active ? children : null),
}));
jest.mock("@/hooks/useDigitalChannel", () => ({ useDigitalChannel: () => ({ config: { slug: "loja-qa" } }) }));

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
let mockAuth: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/hooks/useVisibleModules", () => ({
  ...jest.requireActual("@/hooks/useVisibleModules"),
  useVisibleModules: () => new Set<string>(["estoque"]),
  useVisibleModulesProntos: () => true,
}));
jest.mock("@/hooks/useProducts", () => {
  const real = jest.requireActual("@/hooks/useProducts");
  return {
    camposNfseDoCorpo: real.camposNfseDoCorpo,
    useProducts: () => ({ products: [], addProduct: jest.fn(), updateProduct: jest.fn() }),
  };
});
jest.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ byId: {}, assignProductCategories: jest.fn(), flattened: [], tree: [] }),
}));
jest.mock("@/hooks/useProductCategories", () => ({ useProductCategories: () => ({ categories: [] }) }));
jest.mock("@/services/api", () => ({
  companiesApi: { checkDuplicate: jest.fn().mockResolvedValue({ duplicates: [] }) },
  request: jest.fn(),
}));
jest.mock("@/services/nfceApi", () => ({ nfceApi: { getConfig: jest.fn() } }));
jest.mock("@/services/productImagesApi", () => ({ productImagesApi: { upload: jest.fn(), list: jest.fn() } }));
jest.mock("@/services/productsVariationsApi", () => ({
  matrixKey: (hex: string | null, size: string | null) => (hex || "") + "|" + (size || ""),
  productsVariationsApi: { get: jest.fn(), save: jest.fn().mockResolvedValue({}) },
}));
jest.mock("@/services/matconApi", () => ({ matconApi: { createLot: jest.fn() } }));

import { ItemFormModal } from "@/components/screens/estoque/ItemFormModal";
import { TEXTOS_CADASTRAR_VARIOS as T } from "@/components/screens/estoque/CadastrarVarios";
import { PERFIL_PADRAO } from "@/components/screens/estoque/item-form/perfis";

const CANECA: any = {
  id: "p-1", name: "Caneca branca", code: "CAN-1", barcode: "", category: "Canecas", price: 39.9,
  cost: 12, stock: 7, minStock: 2, unit: "un", brand: "", notes: "", color: "", size: "",
  isGroupShared: false, ownerCompanyId: "empresa-1",
};
const SERVICO: any = { ...CANECA, id: "s-1", name: "Arte do zero", unit: "srv" };

function porId(tree: any, id: string): any[] {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}
function tem(tree: any, id: string): boolean {
  return porId(tree, id).length > 0;
}
function texto(tree: any): string {
  return JSON.stringify(tree.toJSON());
}
// O cabeçalho, o corpo e o rodapé do formulário ficam escondidos (não
// desmontados) na escolha: display none no estilo de um ancestral.
function escondido(no: any): boolean {
  for (let n = no; n; n = n.parent) {
    const flat = ([] as any[]).concat(n.props && n.props.style).flat(Infinity).filter(Boolean);
    if (flat.some((st: any) => st && st.display === "none")) return true;
  }
  return false;
}
function campoDoNome(tree: any): any {
  return tree.root.findAll(
    (n: any) => n.props && typeof n.props.onChangeText === "function" && n.props.placeholder === PERFIL_PADRAO.item.exemploDoNome,
    { deep: false },
  )[0];
}
async function montar(el: React.ReactElement) {
  let tree: any;
  await act(async () => { tree = renderer.create(el); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return tree;
}
function acoes(extra: Record<string, unknown> = {}) {
  return { onPlanilha: jest.fn(), onLista: jest.fn(), planilhaOcupada: false, ...extra };
}

beforeEach(() => {
  mockAuth = {
    company: { id: "empresa-1", plan: "negocio", vertical_active: null },
    consolidatedView: false, isDemo: false, token: "t", refreshMe: jest.fn(),
  };
  (global as any).innerWidth = 1280;
});

describe("onde a faixa aparece", () => {
  test("cadastro novo de produto, no computador: faixa com os textos aprovados", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={acoes()} />);
    expect(tem(tree, "faixa-cadastrar-varios")).toBe(true);
    expect(tem(tree, "faixa-cadastrar-varios-botao")).toBe(true);
    const t = texto(tree);
    expect(t).toContain(T.faixaTitulo);
    expect(t).toContain(T.faixaBotao);
    expect(T.faixaTitulo).toBe("Tem muitos para cadastrar?");
    expect(T.faixaBotao).toBe("Cadastrar vários");
  });

  test("cadastro novo de produto, em 375 px: a faixa inteira é o botão", async () => {
    (global as any).innerWidth = 375;
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={acoes()} />);
    const faixa = porId(tree, "faixa-cadastrar-varios");
    expect(faixa).toHaveLength(1);
    expect(typeof faixa[0].props.onPress).toBe("function");
    expect(tem(tree, "faixa-cadastrar-varios-botao")).toBe(false);
    const t = texto(tree);
    expect(t).toContain("Cadastrar vários de uma vez");
    expect(t).toContain("Planilha ou lista colada");
  });

  test("sem a prop, o cadastro é o de antes (nenhuma faixa, mesma árvore)", async () => {
    const sem = await montar(<ItemFormModal visible onClose={jest.fn()} />);
    expect(tem(sem, "faixa-cadastrar-varios")).toBe(false);
    expect(tem(sem, "cadastrar-varios")).toBe(false);
  });

  test("edição do produto: não aparece", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} cadastrarVarios={acoes()} />);
    expect(tem(tree, "faixa-cadastrar-varios")).toBe(false);
  });

  test("serviço (novo ou em edição): não aparece", async () => {
    const novo = await montar(<ItemFormModal visible onClose={jest.fn()} initialType="service" cadastrarVarios={acoes()} />);
    expect(tem(novo, "faixa-cadastrar-varios")).toBe(false);
    const edicao = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={SERVICO} cadastrarVarios={acoes()} />);
    expect(tem(edicao, "faixa-cadastrar-varios")).toBe(false);
  });

  test("trocar para Serviço no cabeçalho esconde a faixa; voltar para Produto mostra de novo", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={acoes()} />);
    const tipo = (rotulo: string) => tree.root.findAll(
      (n: any) => n.props && n.props.accessibilityLabel === rotulo && typeof n.props.onPress === "function", { deep: false },
    )[0];
    await act(async () => { tipo("Serviço").props.onPress(); });
    expect(tem(tree, "faixa-cadastrar-varios")).toBe(false);
    await act(async () => { tipo("Produto").props.onPress(); });
    expect(tem(tree, "faixa-cadastrar-varios")).toBe(true);
  });

  test("demo: não aparece", async () => {
    mockAuth.isDemo = true;
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={acoes()} />);
    expect(tem(tree, "faixa-cadastrar-varios")).toBe(false);
  });

  test("consolidado multi-CNPJ: não aparece", async () => {
    mockAuth.consolidatedView = true;
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={acoes()} />);
    expect(tem(tree, "faixa-cadastrar-varios")).toBe(false);
  });
});

describe("a escolha da origem", () => {
  test("tocar na faixa sem nada digitado troca o miolo pela escolha, sem perguntar", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={acoes()} />);
    await act(async () => { porId(tree, "faixa-cadastrar-varios-botao")[0].props.onPress(); });
    expect(tem(tree, "cadastrar-varios")).toBe(true);
    const t = texto(tree);
    for (const frase of [
      "Cadastrar vários", "Você confere tudo antes de gravar.", "Voltar para um só",
      "Planilha (Excel ou CSV)", "Digitar ou colar uma lista",
      "Cadastra vários produtos de uma vez. Use a sua planilha ou o nosso modelo.",
      "Um produto por linha: nome, preço, tamanho, cor e estoque. Dá para colar direto do Excel.",
      "Escolher planilha", "Baixar modelo", "Abrir a lista",
    ]) expect(t).toContain(frase);
    // A nota do fornecedor não mora aqui (Fase 3: "Chegou mercadoria").
    expect(t).not.toContain("Chegou com a nota");
    // O formulário fica escondido, não desmonta.
    expect(tem(tree, "faixa-cadastrar-varios")).toBe(true);
    expect(escondido(campoDoNome(tree))).toBe(true);
    expect(escondido(porId(tree, "cadastrar-varios")[0])).toBe(false);
  });

  test("as origens chamam o que o pai entregou; o X fecha", async () => {
    const a = acoes();
    const onClose = jest.fn();
    const tree = await montar(<ItemFormModal visible onClose={onClose} cadastrarVarios={a} />);
    await act(async () => { porId(tree, "faixa-cadastrar-varios-botao")[0].props.onPress(); });
    await act(async () => { porId(tree, "cadastrar-varios-escolher-planilha")[0].props.onPress(); });
    expect(a.onPlanilha).toHaveBeenCalledTimes(1);
    await act(async () => { porId(tree, "cadastrar-varios-abrir-lista")[0].props.onPress(); });
    expect(a.onLista).toHaveBeenCalledTimes(1);
    // O modelo é o link de download de sempre (BaixarModelo).
    expect(tem(tree, "cadastrar-varios-modelo")).toBe(true);
    await act(async () => { porId(tree, "cadastrar-varios-fechar")[0].props.onPress(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("planilha ocupada: o botão não chama de novo", async () => {
    const a = acoes({ planilhaOcupada: true });
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={a} />);
    await act(async () => { porId(tree, "faixa-cadastrar-varios-botao")[0].props.onPress(); });
    const botao = porId(tree, "cadastrar-varios-escolher-planilha")[0];
    expect(botao.props.onPress).toBeUndefined();
    expect(a.onPlanilha).not.toHaveBeenCalled();
  });

  test("Voltar para um só devolve o formulário", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={acoes()} />);
    await act(async () => { porId(tree, "faixa-cadastrar-varios-botao")[0].props.onPress(); });
    await act(async () => { porId(tree, "cadastrar-varios-voltar")[0].props.onPress(); });
    expect(tem(tree, "cadastrar-varios")).toBe(false);
    expect(tem(tree, "faixa-cadastrar-varios")).toBe(true);
    expect(texto(tree)).toContain("Salvar produto");
  });

  test("abrirNaEscolha abre direto na escolha (o ← Voltar da lista)", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={acoes({ abrirNaEscolha: true })} />);
    expect(tem(tree, "cadastrar-varios")).toBe(true);
  });

  test("abrirNaEscolha não vale na edição", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={CANECA} cadastrarVarios={acoes({ abrirNaEscolha: true })} />);
    expect(tem(tree, "cadastrar-varios")).toBe(false);
  });
});

describe("com algo digitado, pergunta antes", () => {
  test("Continuar fica no formulário com o que foi digitado", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={acoes()} />);
    await act(async () => { campoDoNome(tree).props.onChangeText("Esmalte Nude"); });
    await act(async () => { porId(tree, "faixa-cadastrar-varios-botao")[0].props.onPress(); });
    expect(tem(tree, "cadastrar-varios")).toBe(false);
    expect(texto(tree)).toContain("Sair sem salvar?");
    await act(async () => { porId(tree, "confirmar-saida-ficar")[0].props.onPress(); });
    expect(texto(tree)).not.toContain("Sair sem salvar?");
    expect(tem(tree, "cadastrar-varios")).toBe(false);
    expect(campoDoNome(tree).props.value).toBe("Esmalte Nude");
  });

  test("Sair sem salvar vai para a escolha e o formulário volta limpo", async () => {
    const onClose = jest.fn();
    const tree = await montar(<ItemFormModal visible onClose={onClose} cadastrarVarios={acoes()} />);
    await act(async () => { campoDoNome(tree).props.onChangeText("Esmalte Nude"); });
    await act(async () => { porId(tree, "faixa-cadastrar-varios-botao")[0].props.onPress(); });
    await act(async () => { porId(tree, "confirmar-saida-sair")[0].props.onPress(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(tem(tree, "cadastrar-varios")).toBe(true);
    await act(async () => { porId(tree, "cadastrar-varios-voltar")[0].props.onPress(); });
    expect(campoDoNome(tree).props.value).toBe("");
  });

  test("fechar pelo X com algo digitado continua perguntando e fecha (comportamento de antes)", async () => {
    const onClose = jest.fn();
    const tree = await montar(<ItemFormModal visible onClose={onClose} cadastrarVarios={acoes()} />);
    await act(async () => { campoDoNome(tree).props.onChangeText("Esmalte Nude"); });
    const x = tree.root.findAll((n: any) => n.props && n.props.accessibilityLabel === "Fechar" && typeof n.props.onPress === "function", { deep: false });
    await act(async () => { x[0].props.onPress(); });
    expect(texto(tree)).toContain("Sair sem salvar?");
    await act(async () => { porId(tree, "confirmar-saida-sair")[0].props.onPress(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(tem(tree, "cadastrar-varios")).toBe(false);
  });
});

// A8 (17/11/2026): a nota saiu do "Importar" e virou origem do "Chegou
// mercadoria". Na escolha do "Cadastrar vários", o aviso leva até lá.
describe("A8: aviso \"Chegou com a nota do fornecedor?\"", () => {
  test("computador: texto aprovado e o botão chama onChegou", async () => {
    const a = acoes({ onChegou: jest.fn() });
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={a} />);
    await act(async () => { porId(tree, "faixa-cadastrar-varios-botao")[0].props.onPress(); });
    expect(tem(tree, "cadastrar-varios-aviso-nota")).toBe(true);
    const t = texto(tree);
    expect(t).toContain("Chegou com a nota do fornecedor?");
    expect(t).toContain(": ele cadastra o que faltar e já dá entrada no estoque, com o custo da nota.");
    expect(t).toContain("Ir para Chegou mercadoria");
    await act(async () => { porId(tree, "cadastrar-varios-ir-chegou")[0].props.onPress(); });
    expect((a as any).onChegou).toHaveBeenCalledTimes(1);
  });

  test("375 px: \"Use Chegou mercadoria.\" e o link \"Ir para lá\" (alvo de 44 px)", async () => {
    (global as any).innerWidth = 375;
    const a = acoes({ onChegou: jest.fn() });
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={a} />);
    await act(async () => { porId(tree, "faixa-cadastrar-varios")[0].props.onPress(); });
    const t = texto(tree);
    expect(t).toContain("Use Chegou mercadoria.");
    expect(t).toContain("Ir para lá");
    const link = porId(tree, "cadastrar-varios-ir-chegou")[0];
    const estilo = ([] as any[]).concat(link.props.style).flat(Infinity).filter(Boolean);
    expect(estilo.some((st: any) => st.minHeight === 44)).toBe(true);
    await act(async () => { link.props.onPress(); });
    expect((a as any).onChegou).toHaveBeenCalledTimes(1);
  });

  test("sem onChegou o aviso não aparece", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} cadastrarVarios={acoes()} />);
    await act(async () => { porId(tree, "faixa-cadastrar-varios-botao")[0].props.onPress(); });
    expect(tem(tree, "cadastrar-varios-aviso-nota")).toBe(false);
  });
});
