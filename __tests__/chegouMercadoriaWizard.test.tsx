// ============================================================
// "Chegou mercadoria" (estimativa p-171, Fase 3): o wizard na tela.
// A1: shell no padrão TrocaModal, passo 1 (fornecedor), Esc, chave criada
//     uma vez ao abrir, atalho "Tem o arquivo da nota?".
// A2: "Novo fornecedor" dentro do passo (FornecedorFormSheet com noPasso).
// A3: passo 2 com as três origens e os avisos (arquivo errado, PDF, nota de
//     outro CNPJ, nota repetida).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: ({ children, visible }: any) => (visible ? children : null) }));
jest.mock("@/hooks/useAtalhosDoCaixa", () => ({ dialogoAbertoNaTela: () => false }));

let mockQueries: Record<string, any> = {};
const mockInvalidate = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey, enabled }: any) =>
    enabled === false ? { data: undefined, isLoading: false, isError: false } : (mockQueries[queryKey[0]] || { data: undefined, isLoading: false, isError: false }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

const mockLookup = jest.fn();
const mockCreate = jest.fn();
jest.mock("@/services/suppliersApi", () => ({
  suppliersApi: {
    list: jest.fn(),
    lookupCnpj: (...a: any[]) => mockLookup(...a),
    create: (...a: any[]) => mockCreate(...a),
  },
}));

let mockArquivo: { name: string; conteudo: string } | null = null;
jest.mock("@/components/screens/estoque/chegou/escolherArquivo", () => ({
  ACEITA_NOTA: ".xml",
  escolherArquivo: jest.fn(async () => (mockArquivo ? { name: mockArquivo.name } : null)),
  lerTextoDoArquivo: jest.fn(async () => (mockArquivo ? mockArquivo.conteudo : "")),
}));

const mockChaves: string[] = [];
jest.mock("@/components/screens/estoque/chegou/chegouRegras", () => {
  const real = jest.requireActual("@/components/screens/estoque/chegou/chegouRegras");
  return {
    ...real,
    novaChaveDaEntrada: () => {
      const k = "chave-" + (mockChaves.length + 1) + "-abcdefgh";
      mockChaves.push(k);
      return k;
    },
  };
});

import { ChegouMercadoriaModal } from "@/components/screens/estoque/chegou/ChegouMercadoriaModal";
import { TEXTOS_CHEGOU as T } from "@/components/screens/estoque/chegou/textosChegou";
import { XML_ALFA } from "./fixtures/chegouNotas";

const ALFA = {
  id: "f-alfa", company_id: "c1", name: "Distribuidora Alfa", cnpj: "11222333000181", contact_name: "Marcos",
  phone: null, email: null, notes: null, is_active: true, product_count: 38, last_delivery_at: "2026-11-12T15:00:00Z",
};
const BRAS = {
  id: "f-bras", company_id: "c1", name: "Distribuidora Brás", cnpj: "23456789000101", contact_name: null,
  phone: null, email: null, notes: null, is_active: true, product_count: 22, last_delivery_at: "2026-11-02T15:00:00Z",
};

function porId(tree: any, id: string): any[] {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}
const tem = (tree: any, id: string) => porId(tree, id).length > 0;
const texto = (tree: any) => JSON.stringify(tree.toJSON());
async function tocar(tree: any, id: string) {
  const no = porId(tree, id)[0];
  if (!no) throw new Error("não achei " + id);
  await act(async () => { no.props.onPress(); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
}
async function montar(props: Record<string, unknown> = {}) {
  let tree: any;
  const el = (p: any) => (
    <ChegouMercadoriaModal visible companyId="c1" lojaNome="Flor de Maio · Centro" products={[]} semCusto={false} onClose={jest.fn()} {...p} />
  );
  await act(async () => { tree = renderer.create(el(props)); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return { tree, el };
}
function rodape(tree: any): string {
  return JSON.stringify(porId(tree, "chegou-rodape-info")[0].props.children);
}
const desabilitado = (tree: any, id: string) => !!porId(tree, id)[0].props.disabled;

beforeEach(() => {
  mockQueries = { suppliers: { data: { suppliers: [BRAS, ALFA], total: 2 }, isLoading: false, isError: false } };
  mockArquivo = null;
  mockChaves.length = 0;
  mockLookup.mockReset();
  mockCreate.mockReset();
  mockInvalidate.mockReset();
  (global as any).innerWidth = 1280;
});

describe("A1 · shell", () => {
  test("cabeçalho com a loja, quatro passos e o passo 1 aberto", async () => {
    const { tree } = await montar();
    const t = texto(tree);
    expect(t).toContain(T.titulo);
    expect(t).toContain(T.subtitulo("Flor de Maio · Centro"));
    for (const n of [1, 2, 3, 4] as const) expect(t).toContain(T.passos[n]);
    expect(tem(tree, "chegou-passo-1")).toBe(true);
    expect(t).toContain(T.pergunta1);
  });

  test("fechado não desenha nada", async () => {
    const { tree } = await montar({ visible: false });
    expect(tree.toJSON()).toBeNull();
  });

  test("a chave nasce uma vez ao abrir, fica a mesma entre os passos e muda ao reabrir", async () => {
    const { tree, el } = await montar();
    expect(mockChaves).toHaveLength(1);
    await tocar(tree, "chegou-fornecedor-f-alfa");
    await tocar(tree, "chegou-continuar");
    await tocar(tree, "chegou-voltar");
    expect(mockChaves).toHaveLength(1);
    await act(async () => { tree.update(el({ visible: false })); });
    await act(async () => { tree.update(el({ visible: true })); });
    expect(mockChaves).toHaveLength(2);
  });

  test("no celular: 'Passo 1 de 4' no lugar da barra", async () => {
    (global as any).innerWidth = 375;
    const { tree } = await montar();
    expect(tem(tree, "chegou-barra-passos")).toBe(false);
    expect(texto(tree)).toContain(T.passoCelular(1, T.passos[1]));
  });

  test("Esc fecha sem perguntar quando nada foi lido", async () => {
    const onClose = jest.fn();
    await montar({ onClose });
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("A1 · passo 1", () => {
  test("'Mais usados' pela última entrega, com produtos e a data", async () => {
    const { tree } = await montar();
    const t = texto(tree);
    expect(t).toContain(T.maisUsados);
    expect(t).toContain(T.linhaProdutos(38));
    expect(t).toContain(T.linhaUltimaEntrega("12/11"));
    // Alfa (12/11) vem antes de Brás (02/11), mesmo vindo depois na lista.
    const ids = tree.root.findAll((n: any) => n.props && /^chegou-fornecedor-f-/.test(n.props.testID || ""), { deep: false }).map((n: any) => n.props.testID);
    expect(ids).toEqual(["chegou-fornecedor-f-alfa", "chegou-fornecedor-f-bras"]);
  });

  test("Continuar travado até escolher; rodapé diz o fornecedor", async () => {
    const { tree } = await montar();
    expect(desabilitado(tree, "chegou-continuar")).toBe(true);
    expect(rodape(tree)).toContain(T.rodapeSemEscolha);
    await tocar(tree, "chegou-fornecedor-f-alfa");
    expect(desabilitado(tree, "chegou-continuar")).toBe(false);
    expect(rodape(tree)).toContain(T.rodapeFornecedor("Distribuidora Alfa"));
    await tocar(tree, "chegou-continuar");
    expect(tem(tree, "chegou-passo-2")).toBe(true);
    expect(texto(tree)).toContain(T.passoFeitoFornecedor("Distribuidora Alfa"));
  });

  test("busca por CNPJ", async () => {
    const { tree } = await montar();
    const campo = porId(tree, "chegou-busca-fornecedor")[0];
    await act(async () => { campo.props.onChangeText("23.456.789"); });
    expect(tem(tree, "chegou-fornecedor-f-bras")).toBe(true);
    expect(tem(tree, "chegou-fornecedor-f-alfa")).toBe(false);
  });

  test("'Seguir sem fornecedor' tem botão próprio e vai ao passo 2", async () => {
    const { tree } = await montar();
    expect(texto(tree)).toContain(T.semApoio);
    await tocar(tree, "chegou-sem-fornecedor");
    expect(tem(tree, "chegou-passo-2")).toBe(true);
  });

  test("lista que não carregou: avisa e deixa cadastrar ou seguir sem", async () => {
    mockQueries = { suppliers: { data: undefined, isLoading: false, isError: true } };
    const { tree } = await montar();
    expect(tem(tree, "chegou-fornecedores-erro")).toBe(true);
    expect(tem(tree, "chegou-novo-fornecedor")).toBe(true);
    expect(tem(tree, "chegou-sem-fornecedor")).toBe(true);
  });

  test("cartão 'Tem o arquivo da nota?': acha o fornecedor pelo CNPJ e pula para o passo 2", async () => {
    mockArquivo = { name: "nota.xml", conteudo: XML_ALFA };
    const { tree } = await montar();
    expect(texto(tree)).toContain(T.notaCartaoTitulo);
    await tocar(tree, "chegou-cartao-nota-botao");
    expect(tem(tree, "chegou-passo-2")).toBe(true);
    // O passo 1 aparece feito com o fornecedor achado pela nota.
    expect(texto(tree)).toContain(T.passoFeitoFornecedor("Distribuidora Alfa"));
  });

  test("cartão com a janela de arquivo cancelada: fica no passo 1", async () => {
    mockArquivo = null;
    const { tree } = await montar();
    await tocar(tree, "chegou-cartao-nota-botao");
    expect(tem(tree, "chegou-passo-1")).toBe(true);
  });

  test("com a nota lida, fechar pergunta antes", async () => {
    mockArquivo = { name: "nota.xml", conteudo: XML_ALFA };
    const onClose = jest.fn();
    const { tree } = await montar({ onClose });
    await tocar(tree, "chegou-cartao-nota-botao");
    await tocar(tree, "chegou-fechar");
    expect(onClose).not.toHaveBeenCalled();
    expect(tem(tree, "chegou-pergunta-sair")).toBe(true);
    // Esc com a pergunta na tela: fica.
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(tem(tree, "chegou-pergunta-sair")).toBe(false);
    await tocar(tree, "chegou-fechar");
    await tocar(tree, "chegou-sair-sair");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("A2 · novo fornecedor dentro do passo", () => {
  test("troca o miolo pelo formulário, sem folha própria, com 'Salvar e continuar'", async () => {
    const { tree } = await montar();
    await tocar(tree, "chegou-novo-fornecedor");
    expect(tem(tree, "fornecedor-form-no-passo")).toBe(true);
    expect(tem(tree, "fornecedor-form-fechar")).toBe(false);
    expect(tem(tree, "fornecedor-form-salvar-outro")).toBe(false);
    const t = texto(tree);
    expect(t).toContain(T.novoSalvar);
    expect(t).toContain(T.novoRodape);
    expect(t).toContain(T.voltarParaLista);
    // O rodapé do wizard some (o formulário tem o dele).
    expect(tem(tree, "chegou-rodape-info")).toBe(false);
  });

  test("salvar escolhe o fornecedor novo e segue para o passo 2", async () => {
    mockCreate.mockResolvedValue({ ...ALFA, id: "f-gama", name: "Gama Cosméticos", cnpj: null });
    const { tree } = await montar();
    await tocar(tree, "chegou-novo-fornecedor");
    const nome = porId(tree, "fornecedor-form-nome")[0];
    await act(async () => { nome.props.onChangeText("Gama Cosméticos"); });
    await tocar(tree, "fornecedor-form-salvar");
    expect(mockCreate).toHaveBeenCalledWith("c1", expect.objectContaining({ name: "Gama Cosméticos" }));
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["suppliers", "c1"] });
    expect(tem(tree, "chegou-passo-2")).toBe(true);
    expect(texto(tree)).toContain(T.passoFeitoFornecedor("Gama Cosméticos"));
  });

  test("CNPJ já cadastrado: 'Usar [nome]' escolhe o que existe", async () => {
    mockLookup.mockResolvedValue({ cnpj: "11222333000181", existing: { id: "f-alfa", name: "Distribuidora Alfa" } });
    const { tree } = await montar();
    await tocar(tree, "chegou-novo-fornecedor");
    const cnpj = porId(tree, "fornecedor-form-cnpj")[0];
    await act(async () => { cnpj.props.onChangeText("11.222.333/0001-81"); });
    await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
    expect(tem(tree, "fornecedor-form-abrir-existente")).toBe(false);
    const t = texto(tree);
    expect(t).toContain(T.usarExistente("Distribuidora Alfa"));
    expect(t).toContain(T.existenteRodape);
    await tocar(tree, "fornecedor-form-usar-existente");
    expect(tem(tree, "chegou-passo-2")).toBe(true);
    expect(texto(tree)).toContain(T.passoFeitoFornecedor("Distribuidora Alfa"));
  });

  test("Voltar e Esc devolvem à lista, com a busca no lugar", async () => {
    const { tree } = await montar();
    const campo = porId(tree, "chegou-busca-fornecedor")[0];
    await act(async () => { campo.props.onChangeText("bras"); });
    await tocar(tree, "chegou-novo-fornecedor");
    await tocar(tree, "fornecedor-form-voltar");
    expect(tem(tree, "fornecedor-form-no-passo")).toBe(false);
    expect(porId(tree, "chegou-busca-fornecedor")[0].props.value).toBe("bras");
    await tocar(tree, "chegou-novo-fornecedor");
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(tem(tree, "fornecedor-form-no-passo")).toBe(false);
    expect(tem(tree, "chegou-passo-1")).toBe(true);
  });
});

describe("A3 · passo 2", () => {
  async function irAoPasso2(tree: any, fornecedorId: string | null) {
    if (fornecedorId) {
      await tocar(tree, "chegou-fornecedor-" + fornecedorId);
      await tocar(tree, "chegou-continuar");
    } else {
      await tocar(tree, "chegou-sem-fornecedor");
    }
  }

  test("as três origens; só a nota funciona por enquanto; rodapé do PDF", async () => {
    const { tree } = await montar();
    await irAoPasso2(tree, "f-alfa");
    const t = texto(tree);
    expect(t).toContain(T.pergunta2);
    expect(t).toContain(T.origemNotaTitulo);
    expect(t).toContain(T.origemPlanilhaTitulo);
    expect(t).toContain(T.origemDigitarTitulo);
    expect(desabilitado(tree, "chegou-origem-nota-botao")).toBe(false);
    expect(desabilitado(tree, "chegou-origem-planilha-botao")).toBe(true);
    expect(desabilitado(tree, "chegou-origem-digitar-botao")).toBe(true);
    expect(rodape(tree)).toContain(T.rodapePdf);
    expect(desabilitado(tree, "chegou-continuar")).toBe(true);
  });

  test("nota do mesmo fornecedor: lida, sem pergunta, Continuar livre", async () => {
    mockArquivo = { name: "nota.xml", conteudo: XML_ALFA };
    const { tree } = await montar();
    await irAoPasso2(tree, "f-alfa");
    await tocar(tree, "chegou-origem-nota-botao");
    expect(texto(tree)).toContain(T.notaLida("004512", "Distribuidora Alfa", 3));
    expect(tem(tree, "chegou-outro-cnpj")).toBe(false);
    expect(desabilitado(tree, "chegou-continuar")).toBe(false);
    await tocar(tree, "chegou-continuar");
    expect(texto(tree)).toContain(T.passoFeitoNota("004512"));
  });

  test("nota de outro CNPJ: pergunta e nunca troca sozinho; 'Manter' segue com o escolhido", async () => {
    mockArquivo = { name: "nota.xml", conteudo: XML_ALFA };
    const { tree } = await montar();
    await irAoPasso2(tree, "f-bras");
    await tocar(tree, "chegou-origem-nota-botao");
    const t = texto(tree);
    expect(t).toContain(T.outroCnpjTitulo("Distribuidora Alfa", "Distribuidora Brás"));
    expect(t).toContain(T.outroCnpjDetalhe("11.222.333/0001-81", "004512", 3));
    expect(t).toContain(T.usarEmitente("Distribuidora Alfa"));
    expect(t).toContain(T.manterFornecedor("Distribuidora Brás"));
    expect(desabilitado(tree, "chegou-continuar")).toBe(true);
    await tocar(tree, "chegou-manter-fornecedor");
    expect(tem(tree, "chegou-outro-cnpj")).toBe(false);
    expect(desabilitado(tree, "chegou-continuar")).toBe(false);
    expect(texto(tree)).toContain(T.passoFeitoFornecedor("Distribuidora Brás"));
    // Voltou e trocou o fornecedor: a pergunta volta para a nova escolha.
    await tocar(tree, "chegou-voltar");
    await tocar(tree, "chegou-sem-fornecedor");
    expect(tem(tree, "chegou-outro-cnpj")).toBe(true);
    expect(texto(tree)).toContain(T.semFornecedorLigar("Distribuidora Alfa"));
  });

  test("nota de outro CNPJ: 'Usar [emitente]' troca só com o clique", async () => {
    mockArquivo = { name: "nota.xml", conteudo: XML_ALFA };
    const { tree } = await montar();
    await irAoPasso2(tree, "f-bras");
    await tocar(tree, "chegou-origem-nota-botao");
    await tocar(tree, "chegou-usar-emitente");
    expect(tem(tree, "chegou-outro-cnpj")).toBe(false);
    expect(texto(tree)).toContain(T.passoFeitoFornecedor("Distribuidora Alfa"));
  });

  test("sem fornecedor e emitente sem cadastro: 'Cadastrar [emitente]' abre o novo já preenchido", async () => {
    mockQueries = { suppliers: { data: { suppliers: [BRAS], total: 1 }, isLoading: false, isError: false } };
    mockArquivo = { name: "nota.xml", conteudo: XML_ALFA };
    mockCreate.mockResolvedValue({ ...ALFA, id: "f-nova-alfa" });
    const { tree } = await montar();
    await irAoPasso2(tree, null);
    await tocar(tree, "chegou-origem-nota-botao");
    expect(texto(tree)).toContain(T.semFornecedorLigar("Distribuidora Alfa"));
    expect(texto(tree)).toContain(T.cadastrarEmitente("Distribuidora Alfa"));
    await tocar(tree, "chegou-cadastrar-emitente");
    expect(porId(tree, "fornecedor-form-nome")[0].props.value).toBe("Distribuidora Alfa");
    expect(porId(tree, "fornecedor-form-cnpj")[0].props.value).toBe("11.222.333/0001-81");
    await tocar(tree, "fornecedor-form-salvar");
    expect(tem(tree, "chegou-passo-2")).toBe(true);
    expect(tem(tree, "chegou-outro-cnpj")).toBe(false);
    expect(desabilitado(tree, "chegou-continuar")).toBe(false);
  });

  test("PDF ou arquivo errado: aviso gentil e Continuar travado", async () => {
    mockArquivo = { name: "danfe.pdf", conteudo: "%PDF-1.7" };
    const { tree } = await montar();
    await irAoPasso2(tree, "f-alfa");
    await tocar(tree, "chegou-origem-nota-botao");
    const t = texto(tree);
    expect(t).toContain(T.arquivoErradoTitulo);
    expect(t).toContain(T.arquivoErradoTexto);
    expect(desabilitado(tree, "chegou-continuar")).toBe(true);
    // Escolher outro arquivo, agora o certo.
    mockArquivo = { name: "nota.xml", conteudo: XML_ALFA };
    await tocar(tree, "chegou-outro-arquivo");
    expect(tem(tree, "chegou-arquivo-errado")).toBe(false);
    expect(desabilitado(tree, "chegou-continuar")).toBe(false);
  });

  test("nota repetida: avisa, mostra aquela entrada e só segue com 'Seguir mesmo assim'", async () => {
    mockQueries["stock-receipts-nota"] = {
      data: {
        receipts: [{ id: "r1", created_at: "2026-11-14T17:30:00Z", invoice_number: "4512", nfe_key: null, origin: "nota", supplier_id: "f-alfa", supplier_name: "Distribuidora Alfa", lines: 18 }],
        legacy: [],
      },
      isLoading: false,
    };
    mockArquivo = { name: "nota.xml", conteudo: XML_ALFA };
    const { tree } = await montar();
    await irAoPasso2(tree, "f-alfa");
    await tocar(tree, "chegou-origem-nota-botao");
    expect(texto(tree)).toContain(T.repetidaTitulo("004512", "Distribuidora Alfa", "14/11"));
    expect(desabilitado(tree, "chegou-continuar")).toBe(true);
    await tocar(tree, "chegou-ver-entrada");
    expect(texto(tree)).toContain(T.repetidaDetalhe("14/11", "14:30", 18));
    await tocar(tree, "chegou-seguir-mesmo-assim");
    expect(tem(tree, "chegou-nota-repetida")).toBe(false);
    expect(desabilitado(tree, "chegou-continuar")).toBe(false);
  });

  test("consulta da nota repetida que falhou não trava", async () => {
    mockQueries["stock-receipts-nota"] = { data: undefined, isLoading: false, isError: true };
    mockArquivo = { name: "nota.xml", conteudo: XML_ALFA };
    const { tree } = await montar();
    await irAoPasso2(tree, "f-alfa");
    await tocar(tree, "chegou-origem-nota-botao");
    expect(desabilitado(tree, "chegou-continuar")).toBe(false);
  });
});
