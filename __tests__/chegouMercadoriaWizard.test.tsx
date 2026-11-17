// ============================================================
// "Chegou mercadoria" (estimativa p-171, Fase 3): o wizard na tela.
// A1: shell no padrão TrocaModal, passo 1 (fornecedor), Esc, chave criada
//     uma vez ao abrir, atalho "Tem o arquivo da nota?".
// A2: "Novo fornecedor" dentro do passo (FornecedorFormSheet com noPasso).
// A3: passo 2 com as três origens e os avisos (arquivo errado, PDF, nota de
//     outro CNPJ, nota repetida).
// A4a: passo 3, conferência: estados da linha, resumo e rodapé travado
//      enquanto falta decidir (pendência 5).
// A4b: painéis da linha (produto novo, ligar, trocar, grade) e a margem dos novos.
// A7: gravar (corpo, chave, erros do servidor), Pronto e o desvio do Matcon.
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
let mockPdv: any = {};
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdv, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/components/screens/estoque/DanfeImportModal", () => ({
  DanfeImportModal: (p: any) => (p.visible ? require("react").createElement("DanfeImportModal", { testID: "danfe-matcon", onClose: p.onClose }) : null),
}));
const mockDarEntrada = jest.fn();
jest.mock("@/services/estoqueEntradasApi", () => ({
  estoqueEntradasApi: {
    darEntrada: (...a: any[]) => mockDarEntrada(...a),
    notaJaLancada: jest.fn(),
    codigosDoFornecedor: jest.fn(),
  },
}));

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
import { XML_ALFA, XML_CONFERENCIA, PRODUTOS_CONFERENCIA } from "./fixtures/chegouNotas";

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
  mockDarEntrada.mockReset();
  mockPdv = {};
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

describe("A4a · passo 3, conferência", () => {
  async function irAoPasso3(props: Record<string, unknown> = {}) {
    mockQueries["supplier-codes"] = { data: { supplier_id: "f-alfa", items: [], map: { "AL-0391": "p-acetona" } }, isLoading: false };
    mockArquivo = { name: "nota.xml", conteudo: XML_CONFERENCIA };
    const r = await montar({ products: PRODUTOS_CONFERENCIA, ...props });
    await tocar(r.tree, "chegou-cartao-nota-botao");
    await tocar(r.tree, "chegou-continuar");
    return r;
  }
  const textoDe = (no: any): string =>
    typeof no === "string" ? no : (no.children || []).map(textoDe).join(" ");
  const valor = (tree: any, id: string) => textoDe(porId(tree, "chegou-resumo-" + id)[0]);
  const travado = (tree: any) => !!porId(tree, "chegou-dar-entrada")[0].props.accessibilityState.disabled;

  test("casa as linhas e mostra como achou cada uma", async () => {
    const { tree } = await irAoPasso3();
    expect(tem(tree, "chegou-passo-3")).toBe(true);
    const t = texto(tree);
    expect(t).toContain("Esmalte Cremoso Vermelho 8 ml");
    expect(t).toContain(T.achadoPor.codigo_barras);
    expect(t).toContain(T.achadoPor.codigo_fornecedor);
    expect(t).toContain(T.previaEstoque("12", "36", "un"));
    expect(t).toContain(T.semParTitulo);
    expect(t).toContain(T.erroQtdZero);
    expect(t).toContain(T.confere("R$ 48,00", "R$ 4,80"));
    expect(t).toContain(T.totalBate("R$ 795,60"));
  });

  test("resumo e rodapé travado enquanto falta decidir", async () => {
    const { tree } = await irAoPasso3();
    expect(valor(tree, "itens")).toContain("5");
    expect(valor(tree, "prontos")).toContain("3");
    expect(valor(tree, "falta")).toContain("1");
    expect(valor(tree, "fora")).toContain("1");
    expect(tem(tree, "chegou-rodape-travado")).toBe(true);
    expect(rodape(tree)).toContain(T.rodapeFaltam(1));
    expect(travado(tree)).toBe(true);
    expect(texto(tree)).toContain(T.darEntrada(3));
  });

  test("'Cadastrar novo' (preço sugerido) destrava; 'Ligar' trava com o nome; 'Deixar de fora' destrava", async () => {
    const { tree } = await irAoPasso3();
    await tocar(tree, "chegou-linha-4-novo");
    expect(texto(tree)).toContain(T.vivoNovo("18", "R$ 7,40"));
    expect(valor(tree, "novos")).toContain("1");
    expect(tem(tree, "chegou-rodape-travado")).toBe(false);
    expect(travado(tree)).toBe(false);
    expect(texto(tree)).toContain(T.darEntrada(4));

    await tocar(tree, "chegou-linha-4-ligar");
    expect(texto(tree)).toContain(T.vivoLigar);
    expect(rodape(tree)).toContain(T.rodapeFaltaLigar("BASE FORTALECEDORA 10ML"));
    expect(travado(tree)).toBe(true);

    await tocar(tree, "chegou-linha-4-fora");
    expect(texto(tree)).toContain(T.vivoFora);
    expect(valor(tree, "fora")).toContain("2");
    expect(travado(tree)).toBe(false);
    expect(texto(tree)).toContain(T.darEntrada(3));

    // Tocar de novo na escolha desfaz.
    await tocar(tree, "chegou-linha-4-fora");
    expect(travado(tree)).toBe(true);
  });

  test("'Confere?' não trava; 'Está certo' tira o aviso", async () => {
    const { tree } = await irAoPasso3();
    expect(tem(tree, "chegou-linha-3-confere")).toBe(true);
    await tocar(tree, "chegou-linha-3-esta-certo");
    expect(tem(tree, "chegou-linha-3-confere")).toBe(false);
  });

  test("'Corrigir o custo' muda o custo da linha", async () => {
    const { tree } = await irAoPasso3();
    await tocar(tree, "chegou-linha-3-corrigir");
    await act(async () => { porId(tree, "chegou-linha-3-custo")[0].props.onChangeText("480"); });
    expect(tem(tree, "chegou-linha-3-confere")).toBe(false);
    expect(texto(tree)).toContain("R$ 4,80");
  });

  test("quantidade zero: 'Dizer quantos' traz a linha de volta", async () => {
    const { tree } = await irAoPasso3();
    await tocar(tree, "chegou-linha-5-dizer-quantos");
    await act(async () => { porId(tree, "chegou-linha-5-quantos")[0].props.onChangeText("6"); });
    expect(tem(tree, "chegou-linha-5-erro")).toBe(false);
    // Removedor não está na loja: vira linha sem par, que trava.
    expect(valor(tree, "falta")).toContain("2");
  });

  test("quem não vê custo: sem coluna de custo, sem total e o novo pede o preço", async () => {
    const { tree } = await irAoPasso3({ semCusto: true });
    const t = texto(tree);
    expect(t).not.toContain(T.colCusto);
    expect(tem(tree, "chegou-resumo-total")).toBe(false);
    expect(tem(tree, "chegou-usar-medio")).toBe(false);
    expect(t).not.toContain("R$ 48,00");
    await tocar(tree, "chegou-linha-4-novo");
    // Sem preço sugerido, o novo ainda falta (o painel do preço é o A4b).
    expect(travado(tree)).toBe(true);
  });

  test("códigos do fornecedor chegando: a conferência espera", async () => {
    const { tree } = await irAoPasso3();
    mockQueries["supplier-codes"] = { data: undefined, isLoading: true };
    await act(async () => { porId(tree, "chegou-usar-medio")[0].props.onPress(); });
    expect(tem(tree, "chegou-conferindo")).toBe(true);
    expect(texto(tree)).toContain(T.lendoTitulo);
  });

  test("no celular: rodapé curto e 'Dar entrada'", async () => {
    (global as any).innerWidth = 375;
    const { tree } = await irAoPasso3();
    expect(rodape(tree)).toContain(T.rodapeFaltaCelular(1));
    expect(texto(tree)).toContain(T.darEntradaCelular);
    expect(texto(tree)).toContain(T.passoCelular(3, T.passos[3]));
  });
});

describe("A4b · painéis da linha", () => {
  async function irAoPasso3(props: Record<string, unknown> = {}) {
    mockQueries["supplier-codes"] = { data: { supplier_id: "f-alfa", items: [], map: { "AL-0391": "p-acetona" } }, isLoading: false };
    mockArquivo = { name: "nota.xml", conteudo: XML_CONFERENCIA };
    const r = await montar({ products: PRODUTOS_CONFERENCIA, ...props });
    await tocar(r.tree, "chegou-cartao-nota-botao");
    await tocar(r.tree, "chegou-continuar");
    return r;
  }
  const travado = (tree: any) => !!porId(tree, "chegou-dar-entrada")[0].props.accessibilityState.disabled;
  const campo = (tree: any, id: string) => porId(tree, id)[0];
  async function digitar(tree: any, id: string, v: string) {
    await act(async () => { campo(tree, id).props.onChangeText(v); });
  }

  test("produto novo: nome da nota, preço sugerido e editável; sem preço trava", async () => {
    const { tree } = await irAoPasso3();
    await tocar(tree, "chegou-linha-4-novo");
    expect(tem(tree, "chegou-linha-4-painel-novo")).toBe(true);
    expect(campo(tree, "chegou-linha-4-novo-nome").props.value).toBe("BASE FORTALECEDORA 10ML");
    expect(campo(tree, "chegou-linha-4-novo-preco").props.value).toBe("14,80");
    expect(texto(tree)).toContain(T.novoMargem(100));
    expect(texto(tree)).toContain(T.novoNcm("33043000"));
    await digitar(tree, "chegou-linha-4-novo-nome", "Base fortalecedora 10 ml");
    await digitar(tree, "chegou-linha-4-novo-categoria", "Esmaltes");
    expect(travado(tree)).toBe(false);
    await digitar(tree, "chegou-linha-4-novo-preco", "");
    expect(travado(tree)).toBe(true);
    expect(texto(tree)).toContain(T.novoPrecoFalta);
    await digitar(tree, "chegou-linha-4-novo-preco", "1590");
    expect(campo(tree, "chegou-linha-4-novo-preco").props.value).toBe("15,90");
    expect(travado(tree)).toBe(false);
  });

  test("quem não vê custo digita o preço, sem sugestão", async () => {
    const { tree } = await irAoPasso3({ semCusto: true });
    await tocar(tree, "chegou-linha-4-novo");
    expect(campo(tree, "chegou-linha-4-novo-preco").props.value).toBe("");
    expect(texto(tree)).not.toContain(T.novoMargem(100));
    expect(travado(tree)).toBe(true);
    await digitar(tree, "chegou-linha-4-novo-preco", "1490");
    expect(travado(tree)).toBe(false);
  });

  test("margem do lote: 'Aplicar' refaz o preço dos novos", async () => {
    const { tree } = await irAoPasso3();
    await tocar(tree, "chegou-linha-4-novo");
    await digitar(tree, "chegou-margem-campo", "50");
    await tocar(tree, "chegou-margem-aplicar");
    expect(campo(tree, "chegou-linha-4-novo-preco").props.value).toBe("11,10");
  });

  test("ligar: busca, escolhe e a linha fica pronta; avisa que guarda o código", async () => {
    const { tree } = await irAoPasso3();
    await tocar(tree, "chegou-linha-4-ligar");
    expect(texto(tree)).toContain(T.ligarCodigo("AL-1120"));
    await digitar(tree, "chegou-linha-4-ligar-busca", "algod");
    expect(texto(tree)).toContain("Algodão em disco 50 un");
    await tocar(tree, "chegou-linha-4-ligar-p-algodao");
    expect(tem(tree, "chegou-linha-4-painel-ligar")).toBe(false);
    expect(travado(tree)).toBe(false);
    expect(texto(tree)).toContain(T.previaEstoque("8", "26", "un"));
  });

  test("ligar sem achar: 'Nenhum produto com esse nome.'", async () => {
    const { tree } = await irAoPasso3();
    await tocar(tree, "chegou-linha-4-ligar");
    await digitar(tree, "chegou-linha-4-ligar-busca", "xyz");
    expect(texto(tree)).toContain(T.ligarVazio);
  });

  test("'Trocar produto' numa linha pronta liga a outro", async () => {
    const { tree } = await irAoPasso3();
    await tocar(tree, "chegou-linha-1-trocar");
    await digitar(tree, "chegou-linha-1-ligar-busca", "acetona");
    await tocar(tree, "chegou-linha-1-ligar-p-acetona");
    expect(tem(tree, "chegou-linha-1-achado")).toBe(false);
    expect(texto(tree)).toContain(T.previaEstoque("4", "28", "un"));
  });

  test("grade: 'Quantas chegaram de cada?' destrava a linha", async () => {
    const comGrade = PRODUTOS_CONFERENCIA.map((p: any) => (p.id === "p-lixa" ? { ...p, has_variants: true } : p));
    mockQueries["estoque-consulta-variantes"] = {
      data: { variants: [{ id: "v-p", size: "P", stock_qty: 1 }, { id: "v-m", size: "M", stock_qty: 2 }] }, isLoading: false,
    };
    const { tree } = await irAoPasso3({ products: comGrade });
    expect(texto(tree)).toContain(T.gradeTexto);
    expect(texto(tree)).toContain(T.gradeTitulo);
    // A base (linha 4) também falta: deixa de fora para olhar só a grade.
    await tocar(tree, "chegou-linha-4-fora");
    expect(travado(tree)).toBe(true);
    expect(rodape(tree)).toContain(T.rodapeFaltaGrade("Lixa de unha (pacote com 12)"));
    await digitar(tree, "chegou-linha-3-grade-v-p", "4");
    await digitar(tree, "chegou-linha-3-grade-v-m", "6");
    expect(travado(tree)).toBe(false);
  });
});

describe("A7 · gravar e Pronto", () => {
  const { toast } = require("@/components/Toast");
  async function irAoPasso3(props: Record<string, unknown> = {}) {
    mockQueries["supplier-codes"] = { data: { supplier_id: "f-alfa", items: [], map: { "AL-0391": "p-acetona" } }, isLoading: false };
    mockArquivo = { name: "nota.xml", conteudo: XML_CONFERENCIA };
    const r = await montar({ products: PRODUTOS_CONFERENCIA, ...props });
    await tocar(r.tree, "chegou-cartao-nota-botao");
    await tocar(r.tree, "chegou-continuar");
    return r;
  }
  const RESPOSTA = {
    receipt: { id: "r-1" },
    supplier: { id: "f-alfa", name: "Distribuidora Alfa", created: false },
    lines: [
      { index: 0, product_id: "p-esmalte", name: "Esmalte", quantity: 24 },
      { index: 1, product_id: "p-acetona", name: "Acetona", quantity: 12 },
      { index: 2, product_id: "p-lixa", name: "Lixa", quantity: 10 },
      { index: 3, product_id: "p-novo", name: "Base", quantity: 18, created: true },
    ],
    totals: { lines: 4, products: 4, created_products: 1, quantity: 64, total_cost: 795.6 },
  };

  test("'Dar entrada' manda a nota com a chave desta abertura e mostra o Pronto", async () => {
    mockDarEntrada.mockResolvedValue(RESPOSTA);
    const onFeito = jest.fn();
    const onVerNovos = jest.fn();
    const onClose = jest.fn();
    const { tree } = await irAoPasso3({ onFeito, onVerNovos, onClose });
    await tocar(tree, "chegou-linha-4-novo");
    await tocar(tree, "chegou-dar-entrada");
    expect(mockDarEntrada).toHaveBeenCalledTimes(1);
    const [cid, corpo] = mockDarEntrada.mock.calls[0];
    expect(cid).toBe("c1");
    expect(corpo).toMatchObject({
      idempotency_key: mockChaves[0], origin: "nota", supplier_id: "f-alfa", invoice_number: "7731",
      nfe_key: "35261111222333000181550010000077311000077310", update_cost: true,
    });
    expect(corpo.items).toHaveLength(4);
    expect(corpo.items[1]).toEqual({ product_id: "p-acetona", quantity: 12, unit_cost: 3.2, supplier_code: "AL-0391" });
    expect(corpo.items[3]).toMatchObject({ new_product: { name: "BASE FORTALECEDORA 10ML", price: 14.8 }, quantity: 18 });

    expect(tem(tree, "chegou-pronto")).toBe(true);
    const t = texto(tree);
    expect(t).toContain(T.prontoTitulo);
    expect(t).toContain(T.prontoComEntrada(4));
    expect(t).toContain(T.prontoComEntradaDetalhe(3, 1));
    expect(t).toContain(T.prontoLigados(4, "Distribuidora Alfa", true));
    expect(t).toContain(T.prontoForaUm("REMOV CUTICULA 60ML", T.motivoQtdZero));
    expect(t).toContain(T.prontoSemDobro);
    expect(onFeito).toHaveBeenCalledWith([RESPOSTA]);
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["products"] });
    await tocar(tree, "chegou-ver-novos");
    expect(onVerNovos).toHaveBeenCalledWith(["p-novo"]);
    await tocar(tree, "chegou-fechar-pronto");
    expect(onClose).toHaveBeenCalled();
  });

  test("linha recusada pelo servidor: fica no passo 3, com o motivo na linha", async () => {
    mockDarEntrada.mockRejectedValue({ status: 400, data: { code: "LINHAS_COM_ERRO", lines: [{ index: 3, error: "Este código de barras já é do produto \"X\". Ligue o item a ele." }] } });
    const { tree } = await irAoPasso3();
    await tocar(tree, "chegou-linha-4-novo");
    await tocar(tree, "chegou-dar-entrada");
    expect(tem(tree, "chegou-passo-3")).toBe(true);
    expect(tem(tree, "chegou-linha-4-erro-servidor")).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(T.erroLinhas);
  });

  test("limite do plano e recurso indisponível: mensagens próprias, nada muda", async () => {
    mockDarEntrada.mockRejectedValueOnce({ status: 403, data: { code: "LIMITE_DO_PLANO", limit: 2000 } });
    const { tree } = await irAoPasso3();
    await tocar(tree, "chegou-linha-4-fora");
    await tocar(tree, "chegou-dar-entrada");
    expect(toast.error).toHaveBeenCalledWith(T.erroLimite(2000));
    mockDarEntrada.mockRejectedValueOnce({ status: 503, data: { code: "SCHEMA_PENDENTE" } });
    await tocar(tree, "chegou-dar-entrada");
    expect(toast.error).toHaveBeenCalledWith(T.erroIndisponivel);
    expect(tem(tree, "chegou-passo-3")).toBe(true);
    // A chave é a mesma nas duas tentativas.
    expect(mockDarEntrada.mock.calls[0][1].idempotency_key).toBe(mockDarEntrada.mock.calls[1][1].idempotency_key);
  });

  test("Matcon: a nota abre o DanfeImportModal de hoje (pendência 4)", async () => {
    mockPdv = { matcon_enabled: true };
    mockArquivo = { name: "nota.xml", conteudo: XML_CONFERENCIA };
    const onClose = jest.fn();
    const { tree } = await montar({ onClose });
    await tocar(tree, "chegou-cartao-nota-botao");
    expect(tem(tree, "danfe-matcon")).toBe(true);
    expect(tem(tree, "chegou-passo-1")).toBe(false);
    await act(async () => { porId(tree, "danfe-matcon")[0].props.onClose(); });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("A7 · parte não entrou (Passo4Pronto)", () => {
  const { Passo4Pronto } = require("@/components/screens/estoque/chegou/Passo4Pronto");
  test("diz quantos entraram e oferece repetir e baixar a lista", async () => {
    const onRepetir = jest.fn();
    const onBaixar = jest.fn();
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <Passo4Pronto estreito={false} semCusto={false} numeroDaNota="7731" fora={[]}
          resumo={{ comEntrada: 300, jaTinha: 300, cadastrados: 0, fornecedor: null, totalDaCompra: null }}
          falha={{ feitos: 300, total: 650 }} onRepetir={onRepetir} onBaixar={onBaixar} />,
      );
    });
    const t = texto(tree);
    expect(t).toContain(T.falhaTitulo(300, 650));
    expect(t).toContain(T.falhaTexto(300, 350));
    expect(t).toContain(T.falhaSemDobro(300));
    await tocar(tree, "chegou-falha-repetir");
    await tocar(tree, "chegou-falha-baixar");
    expect(onRepetir).toHaveBeenCalled();
    expect(onBaixar).toHaveBeenCalled();
  });
});
