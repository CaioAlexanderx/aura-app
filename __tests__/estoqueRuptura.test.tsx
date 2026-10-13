// ============================================================
// Black Friday › O que vai faltar (13/10/2026) — a seção com as fixtures reais
//
// As respostas são as fixtures do backend (Aura-backend#814,
// tests/fixtures/estoque/ruptura.json e ruptura.grupo.json), copiadas em
// __tests__/__fixtures__/estoque. O que estes testes seguram:
//
// 1. a lista sai na ordem da data prevista, só com quem vai faltar;
// 2. quem já zerou fica numa seção à parte, com o selo;
// 3. o resumo mostra o número do backend (itens, valor em risco);
// 4. trocar a janela ou a data refaz a chamada — e voltar a uma já vista
//    responde do cache, sem chamada nova;
// 5. a busca filtra a lista; "copiar" leva o pedido inteiro;
// 6. consolidado: chama com escopo=grupo pela loja principal e mostra a
//    coluna da loja dona; loja sozinha não mostra;
// 7. vazio, erro e demo têm texto próprio.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: "ListSkeleton" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn() } }));

let mockAuth: any;
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => mockAuth,
}));

jest.mock("@/services/estoqueRupturaApi", () => ({
  estoqueRupturaApi: { get: jest.fn() },
}));
const mockCopiar = jest.fn();
jest.mock("@/utils/clipboard", () => ({ copyText: (...a: any[]) => mockCopiar(...a) }));

import { OQueVaiFaltar } from "@/components/screens/blackfriday/OQueVaiFaltar";
import { estoqueRupturaApi } from "@/services/estoqueRupturaApi";

const get = (estoqueRupturaApi as any).get as jest.Mock;
const LOJA = require("./__fixtures__/estoque/ruptura.json");
const GRUPO = require("./__fixtures__/estoque/ruptura.grupo.json");
const CID = "aaaaaaaa-0000-4000-8000-000000000001";
const FILIAL = "aaaaaaaa-0000-4000-8000-000000000002";

jest.setTimeout(30000);

// Só a data é falsa (13/10/2026): os timers de verdade seguem, que é o que
// o react-query usa para notificar a árvore.
beforeAll(() => {
  jest.useFakeTimers({
    now: new Date("2026-10-13T15:00:00Z"),
    doNotFake: [
      "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate",
      "nextTick", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
      "requestIdleCallback", "cancelIdleCallback", "performance", "hrtime",
    ],
  });
});
afterAll(() => jest.useRealTimers());

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = {
    company: { id: CID, plan: "negocio" }, token: "t", isDemo: false,
    consolidatedView: false, availableCompanies: [{ id: CID, is_primary: true }, { id: FILIAL }],
  };
  get.mockImplementation(async () => LOJA);
});

// O react-query notifica a árvore num setTimeout(0): microtask sozinha não basta.
async function flush() {
  for (let i = 0; i < 3; i++) {
    await act(async () => { await new Promise((res) => setTimeout(res, 5)); });
  }
}

async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let r: renderer.ReactTestRenderer;
  await act(async () => {
    r = renderer.create(
      <QueryClientProvider client={qc}>
        <OQueVaiFaltar />
      </QueryClientProvider>
    );
  });
  await flush();
  return r!;
}

function nos(r: renderer.ReactTestRenderer, testID: string) {
  return r.root.findAllByProps({ testID }, { deep: false });
}
function existe(r: renderer.ReactTestRenderer, testID: string) {
  return nos(r, testID).length > 0;
}
function textoDe(node: any): string {
  return (node.children as any[])
    .map((c) => (typeof c === "string" ? c : textoDe(c)))
    .join("");
}
function textoNo(r: renderer.ReactTestRenderer, testID: string) {
  const n = nos(r, testID);
  if (!n.length) throw new Error("sem nó " + testID);
  return textoDe(n[0]);
}
/** Os testIDs das linhas, na ordem em que aparecem na tela. */
function linhas(r: renderer.ReactTestRenderer): string[] {
  const vistos: string[] = [];
  r.root
    .findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("ruptura-linha-"), { deep: false })
    .forEach((n) => { if (!vistos.includes(n.props.testID)) vistos.push(n.props.testID); });
  return vistos;
}
const id = (n: number, v: number | null = null) =>
  "ruptura-linha-cccccccc-0000-4000-8000-00000000000" + n + ":" + (v ? "dddddddd-0000-4000-8000-00000000000" + v : "p");

async function apertar(r: renderer.ReactTestRenderer, testID: string) {
  await act(async () => { nos(r, testID)[0].props.onPress(); });
  await flush();
}
async function digitar(r: renderer.ReactTestRenderer, testID: string, texto: string) {
  await act(async () => { nos(r, testID)[0].props.onChangeText(texto); });
  await flush();
}

describe("lista e resumo (loja)", () => {
  it("pede a data-alvo padrão (30/11) e a janela de 14 dias", async () => {
    await montar();
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(CID, { ate: "2026-11-30", janela: 14, escopo: undefined });
  });

  it("lista só quem vai faltar, na ordem da data prevista — o item que dá conta fica de fora", async () => {
    // O backend manda ordenado; embaralho para provar que a ordem é da tela.
    get.mockResolvedValue({ ...LOJA, itens: [...LOJA.itens].reverse() });
    const r = await montar();
    expect(linhas(r).filter((l) => l !== id(5, 5))).toEqual([
      id(1, 1), // Vestido — 17/10
      id(4),    // Meia — 08/11
      id(2),    // Cinto — 16/11
    ]);
    expect(existe(r, id(3, 3))).toBe(false); // Calça Jeans: faltara=false
  });

  it("mostra a data, os dias, o estoque, o ritmo e a sugestão de cada item", async () => {
    const r = await montar();
    const vestido = textoNo(r, id(1, 1));
    expect(vestido).toContain("Vestido Midi Canelado");
    expect(vestido).toContain("Preto / M");
    expect(vestido).toContain("7890000000011");
    expect(vestido).toContain("17/10");
    expect(vestido).toContain("em 4 dias");
    expect(vestido).toContain("10 un");
    expect(vestido).toContain("2/dia");
    expect(vestido).toContain("comprar 91 un");
    expect(vestido).toContain("R$ 9.612,60");
  });

  it("quem já zerou fica numa seção à parte, com o selo", async () => {
    const r = await montar();
    const zerados = textoNo(r, "ruptura-zerados");
    expect(zerados).toContain("Já zerou");
    expect(zerados).toContain("Blusa Básica Algodão");
    expect(zerados).toContain("já zerou");
    expect(zerados).toContain("comprar 51 un");
    // e não aparece na lista principal
    expect(textoNo(r, "ruptura-lista")).not.toContain("Blusa Básica Algodão");
  });

  it("o resumo traz os números do backend", async () => {
    const r = await montar();
    expect(textoNo(r, "ruptura-resumo-itens-valor")).toBe("3");
    expect(textoNo(r, "ruptura-resumo-risco-valor")).toBe("R$ 12.177,60"); // não soma o zerado
    expect(textoNo(r, "ruptura-resumo-primeira-valor")).toBe("17/10");
    expect(textoNo(r, "ruptura-resumo-zerados-valor")).toBe("1");
  });

  it("loja sozinha não mostra a coluna da loja", async () => {
    const r = await montar();
    expect(textoNo(r, id(1, 1))).not.toContain("Boutique Aurora");
  });
});

describe("troca de janela e de data", () => {
  it("trocar a janela refaz a chamada; voltar a uma já vista vem do cache", async () => {
    const r = await montar();
    expect(get).toHaveBeenCalledTimes(1);

    await apertar(r, "ruptura-janela-7");
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenLastCalledWith(CID, { ate: "2026-11-30", janela: 7, escopo: undefined });

    await apertar(r, "ruptura-janela-30");
    expect(get).toHaveBeenCalledTimes(3);
    expect(get).toHaveBeenLastCalledWith(CID, { ate: "2026-11-30", janela: 30, escopo: undefined });

    // 14 dias já foi buscada nesta sessão: responde do cache.
    await apertar(r, "ruptura-janela-14");
    expect(get).toHaveBeenCalledTimes(3);
    expect(textoNo(r, "ruptura-resumo-itens-valor")).toBe("3");
  });

  it("trocar a data-alvo para o Natal refaz a chamada com a nova data", async () => {
    const r = await montar();
    await apertar(r, "ruptura-alvo-natal");
    expect(get).toHaveBeenLastCalledWith(CID, { ate: "2026-12-24", janela: 14, escopo: undefined });
  });

  it("'Outra data' lê dd/mm/aaaa e recusa data inválida sem chamar a API", async () => {
    const r = await montar();
    await apertar(r, "ruptura-alvo-outra");
    await digitar(r, "ruptura-outra-data", "31/02/2026");
    await apertar(r, "ruptura-outra-aplicar");
    expect(existe(r, "ruptura-outra-erro")).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);

    await digitar(r, "ruptura-outra-data", "15/12/2026");
    await apertar(r, "ruptura-outra-aplicar");
    expect(existe(r, "ruptura-outra-erro")).toBe(false);
    expect(get).toHaveBeenLastCalledWith(CID, { ate: "2026-12-15", janela: 14, escopo: undefined });
  });
});

describe("busca e lista de compra", () => {
  it("a busca filtra a lista e a seção de zerados", async () => {
    const r = await montar();
    await digitar(r, "ruptura-busca", "cinto");
    expect(linhas(r)).toEqual([id(2)]);
    expect(existe(r, id(5, 5))).toBe(false);

    await digitar(r, "ruptura-busca", "blusa");
    expect(existe(r, id(5, 5))).toBe(true);
    expect(existe(r, "ruptura-sem-resultado")).toBe(true); // a lista principal ficou sem resultado

    await digitar(r, "ruptura-busca", "");
    expect(linhas(r)).toHaveLength(4);
  });

  it("'Copiar lista de compra' entrega o texto simples do pedido inteiro", async () => {
    const r = await montar();
    expect(textoNo(r, "ruptura-copiar")).toContain("Copiar lista de compra (4)");
    await apertar(r, "ruptura-copiar");
    expect(mockCopiar).toHaveBeenCalledTimes(1);
    expect(mockCopiar.mock.calls[0][0]).toBe([
      "Lista de compra (até 30/11)",
      "Blusa Básica Algodão (Branco / P): 51 un",
      "Vestido Midi Canelado (Preto / M): 91 un",
      "Meia Cano Curto Kit 3 Pares: 38 un",
      "Cinto Couro Fivela Dourada: 41 un",
    ].join("\n"));
  });

  it("a busca não recorta o pedido ao fornecedor", async () => {
    const r = await montar();
    await digitar(r, "ruptura-busca", "cinto");
    await apertar(r, "ruptura-copiar");
    expect(mockCopiar.mock.calls[0][0].split("\n")).toHaveLength(5);
  });
});

describe("consolidado (multi-CNPJ)", () => {
  beforeEach(() => {
    mockAuth = { ...mockAuth, company: null, consolidatedView: true };
    get.mockImplementation(async () => GRUPO);
  });

  it("chama pela loja principal com escopo=grupo", async () => {
    await montar();
    expect(get).toHaveBeenCalledWith(CID, { ate: "2026-11-30", janela: 14, escopo: "grupo" });
  });

  it("mostra a loja dona do estoque em cada linha e marca o compartilhado", async () => {
    const r = await montar();
    expect(textoNo(r, id(1, 1))).toContain("Boutique Aurora — Matriz");
    const bolsa = textoNo(r, id(6));
    expect(bolsa).toContain("Boutique Aurora — Filial");
    expect(bolsa).not.toContain("estoque compartilhado");
    expect(textoNo(r, id(4))).toContain("estoque compartilhado");
  });

  it("a lista de compra leva a loja de cada item", async () => {
    const r = await montar();
    await apertar(r, "ruptura-copiar");
    expect(mockCopiar.mock.calls[0][0]).toContain("Bolsa Tiracolo Caramelo: 25 un [Boutique Aurora — Filial]");
  });

  it("estoque compartilhado aparece uma vez só", async () => {
    const r = await montar();
    const meia = linhas(r).filter((l) => l === id(4));
    expect(meia).toHaveLength(1);
  });

  it("cada loja tem a sua chave de cache: trocar de empresa não reaproveita a conta da outra", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let r: renderer.ReactTestRenderer;
    const tela = () => (
      <QueryClientProvider client={qc}>
        <OQueVaiFaltar />
      </QueryClientProvider>
    );
    await act(async () => { r = renderer.create(tela()); });
    await flush();
    expect(get).toHaveBeenCalledTimes(1);

    // mesma janela e data, mas fora do consolidado e em outra loja → chave diferente
    mockAuth = { ...mockAuth, company: { id: FILIAL }, consolidatedView: false };
    get.mockImplementation(async () => LOJA);
    await act(async () => { r!.update(tela()); });
    await flush();
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenLastCalledWith(FILIAL, { ate: "2026-11-30", janela: 14, escopo: undefined });
  });
});

describe("estados", () => {
  it("vazio: 'nada vai faltar até dd/mm no ritmo atual'", async () => {
    get.mockResolvedValue({
      ...LOJA,
      itens: LOJA.itens.map((i: any) => ({ ...i, faltara: false, sugestao_compra: 0, valor_em_risco: 0 })),
      zerados: [],
      resumo: { ...LOJA.resumo, itens_em_risco: 0, valor_em_risco: 0, sugestao_total: 0, primeira_ruptura: null, zerados: 0, top: [] },
    });
    const r = await montar();
    expect(textoNo(r, "ruptura-vazio")).toContain("Nada vai faltar até 30/11 no ritmo atual");
    expect(existe(r, "ruptura-lista")).toBe(false);
    expect(existe(r, "ruptura-zerados")).toBe(false);
    // sem o que comprar não há busca nem "copiar": a barra some
    expect(existe(r, "ruptura-copiar")).toBe(false);
    expect(existe(r, "ruptura-busca")).toBe(false);
  });

  it("sem nenhuma venda na janela, o texto não promete que nada vai faltar", async () => {
    get.mockResolvedValue({
      ...LOJA, itens: [], zerados: [],
      resumo: { ...LOJA.resumo, itens_com_venda: 0, itens_em_risco: 0, valor_em_risco: 0, primeira_ruptura: null, zerados: 0, top: [] },
    });
    const r = await montar();
    const t = textoNo(r, "ruptura-vazio");
    expect(t).toContain("Ainda não há vendas para projetar");
    expect(t).not.toContain("Nada vai faltar");
  });

  it("só zerados: a lista principal diz que nada mais vai faltar e a seção dos zerados continua", async () => {
    get.mockResolvedValue({
      ...LOJA,
      itens: [],
      resumo: { ...LOJA.resumo, itens_em_risco: 0, valor_em_risco: 0, primeira_ruptura: null, top: [] },
    });
    const r = await montar();
    expect(existe(r, "ruptura-vazio")).toBe(true);
    expect(existe(r, "ruptura-zerados")).toBe(true);
    expect(nos(r, "ruptura-copiar")[0].props.disabled).toBe(false);
  });

  it("erro: mensagem, nada de lista, e 'Tentar de novo' refaz a chamada", async () => {
    get.mockRejectedValueOnce(new Error("falhou"));
    const r = await montar();
    expect(textoNo(r, "ruptura-erro")).toContain("Não consegui calcular o que vai faltar");
    expect(existe(r, "ruptura-lista")).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);

    await apertar(r, "ruptura-tentar-de-novo");
    expect(get).toHaveBeenCalledTimes(2);
    expect(existe(r, "ruptura-erro")).toBe(false);
    expect(existe(r, "ruptura-lista")).toBe(true);
  });

  it("carregando: esqueleto, sem lista", async () => {
    get.mockImplementation(() => new Promise(() => {}));
    const r = await montar();
    expect(existe(r, "ruptura-carregando")).toBe(true);
    expect(existe(r, "ruptura-lista")).toBe(false);
  });

  it("demo: não chama a API e explica por quê", async () => {
    mockAuth = { ...mockAuth, isDemo: true };
    const r = await montar();
    expect(get).not.toHaveBeenCalled();
    expect(existe(r, "ruptura-demo")).toBe(true);
  });
});

describe("frase do cabeçalho", () => {
  it("diz quantos dos que venderam não chegam e quando é a primeira ruptura", async () => {
    const r = await montar();
    const t = textoDe(r.root);
    expect(t).toContain(
      "Dos 5 itens que venderam nos últimos 14 dias, 3 não chegam até 30/11 no ritmo atual e 1 já zerou. A primeira ruptura é em 17/10."
    );
  });
});
