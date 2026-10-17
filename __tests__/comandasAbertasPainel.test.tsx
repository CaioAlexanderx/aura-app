// ============================================================
// Comandas do Caixa (17/10/2026, tc-02) — o painel das abertas.
//
// O que estes testes seguram (mockup aprovado: docs/mockups/comandas-abertas.html):
//  1. A lista vem com as mais antigas primeiro; "Número" reordena.
//  2. A partir de 3 h aberta o tempo fica âmbar e o cartão ganha a borda.
//  3. O nome aparece; sem nome, "sem nome".
//  4. "Cobrar" e "Lançar" chamam o fluxo com a comanda tocada; com itens no
//     carrinho o botão diz quantos vão.
//  5. Gaveta no computador, folha de baixo no celular (375 px).
//  6. No hook: "Lançar mais" com o carrinho vazio fecha o painel e avisa;
//     com itens abre o modal de lançar já com o número; "Cobrar" abre a
//     conferência já com a comanda.
//  7. Os modais aceitam o número inicial (lançar preenche número e nome;
//     fechar já busca a comanda).
//  8. As contas puras (tempo, ordem, busca).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

let mockLargura = 1280;
jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Modal: ({ visible, children }: any) => (visible ? children : null),
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: mockLargura, height: 800 }),
}));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
// Cada cor vira o próprio nome: dá para ver qual token o estilo usou.
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: (_t, k) => String(k) }) }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("@/components/Toast", () => ({ get toast() { return mockToast; } }));
jest.mock("@/components/screens/pdv/erroNoCaixa", () => ({ textoDoErro: (_e: any, padrao: string) => padrao }));

const mockApi = { listOpen: jest.fn(), get: jest.fn(), addItems: jest.fn(), removeItem: jest.fn(), cancel: jest.fn() };
jest.mock("@/services/comandaApi", () => ({ get comandaApi() { return mockApi; } }));

let mockAbertas: any[] = [];
const mockRefetch = jest.fn();
const mockInvalidate = jest.fn();
const mockUseQuery = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQuery: (o: any) => {
    mockUseQuery(o);
    return { data: { comandas: mockAbertas }, isLoading: false, isError: false, refetch: mockRefetch, dataUpdatedAt: Date.now() };
  },
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

import { ComandasAbertasPanel, ATUALIZA_PAINEL_MS } from "@/components/screens/pdv/ComandasAbertasPanel";
import { AdicionarAComandaModal, FecharComandaModal } from "@/components/screens/pdv/ComandaModals";
import { useComandaNoCaixa } from "@/hooks/useComandaNoCaixa";
import { minutosAberta, tempoDaComanda, comandaVelha, ordenarComandas, filtrarComandas } from "@/utils/comanda";

const AGORA = Date.parse("2026-10-17T23:40:00-03:00");
function abertaHa(min: number) { return new Date(AGORA - min * 60000).toISOString(); }

// As seis do mockup.
const SEIS = [
  { id: "c12", number: 12, name: "João", status: "open", opened_at: abertaHa(134), items_count: 6, subtotal: 148 },
  { id: "c3", number: 3, name: "Mesa do fundo", status: "open", opened_at: abertaHa(212), items_count: 11, subtotal: 236.5 },
  { id: "c27", number: 27, name: null, status: "open", opened_at: abertaHa(18), items_count: 2, subtotal: 37 },
  { id: "c8", number: 8, name: "Carla e amigas", status: "open", opened_at: abertaHa(75), items_count: 4, subtotal: 92 },
  { id: "c41", number: 41, name: "Moto azul", status: "open", opened_at: abertaHa(41), items_count: 3, subtotal: 54.5 },
  { id: "c5", number: 5, name: "Seu Zé", status: "open", opened_at: abertaHa(265), items_count: 9, subtotal: 121 },
];

function porId(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props.testID === id, { deep: false })[0];
}
function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  const c = node.children || [];
  return c.map(texto).join("");
}
function estilo(node: any): any {
  const st = node.props.style;
  return Array.isArray(st) ? Object.assign({}, ...st.filter(Boolean)) : st || {};
}
function ordemNaTela(tree: renderer.ReactTestRenderer): number[] {
  return tree.root
    .findAll((n) => typeof n.props.testID === "string" && /^painel-comanda-\d+$/.test(n.props.testID), { deep: false })
    .map((n) => Number(String(n.props.testID).replace("painel-comanda-", "")));
}
async function esperar() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

let arvores: renderer.ReactTestRenderer[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(AGORA);
  mockAbertas = SEIS;
  mockLargura = 1280;
});
afterEach(() => {
  arvores.forEach((t) => act(() => { t.unmount(); }));
  arvores = [];
  (Date.now as any).mockRestore?.();
});

function montarPainel(extra: Partial<React.ComponentProps<typeof ComandasAbertasPanel>> = {}) {
  const onCobrar = jest.fn(), onLancar = jest.fn(), onClose = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ComandasAbertasPanel visible companyId="e1" cartItemCount={0} onClose={onClose} onCobrar={onCobrar} onLancar={onLancar} {...extra} />
    );
  });
  arvores.push(tree);
  return { tree, onCobrar, onLancar, onClose };
}

describe("ComandasAbertasPanel", () => {
  it("lista as mais antigas primeiro; Número reordena", () => {
    const { tree } = montarPainel();
    expect(ordemNaTela(tree)).toEqual([5, 3, 12, 8, 41, 27]);
    act(() => { porId(tree, "painel-comandas-ordem-numero").props.onPress(); });
    expect(ordemNaTela(tree)).toEqual([3, 5, 8, 12, 27, 41]);
    act(() => { porId(tree, "painel-comandas-ordem-antigas").props.onPress(); });
    expect(ordemNaTela(tree)).toEqual([5, 3, 12, 8, 41, 27]);
  });

  it("resumo do cabeçalho: quantas e quanto a receber", () => {
    const { tree } = montarPainel();
    expect(texto(porId(tree, "painel-comandas-resumo"))).toBe("6 abertas · R$ 689,00 a receber");
    expect(texto(porId(tree, "painel-comandas-atualizado"))).toBe("Atualizado agora");
  });

  it("a partir de 3 h o tempo fica âmbar e o cartão ganha a borda; antes, não", () => {
    const { tree } = montarPainel();
    const velha = porId(tree, "painel-comanda-tempo-3");
    expect(texto(velha)).toBe("há 3h32");
    expect(estilo(velha).color).toBe("amber");
    expect(estilo(porId(tree, "painel-comanda-3")).borderColor).toBe("rgba(251,191,36,0.45)");

    const nova = porId(tree, "painel-comanda-tempo-41");
    expect(texto(nova)).toBe("há 41 min");
    expect(estilo(nova).color).toBe("ink3");
    expect(estilo(porId(tree, "painel-comanda-41")).borderColor).toBe("border");
  });

  it("o nome aparece; sem nome mostra 'sem nome'", () => {
    const { tree } = montarPainel();
    expect(texto(porId(tree, "painel-comanda-nome-12"))).toBe("João");
    expect(texto(porId(tree, "painel-comanda-nome-27"))).toBe("sem nome");
    expect(texto(porId(tree, "painel-comanda-12"))).toContain("6 itens");
    expect(texto(porId(tree, "painel-comanda-12"))).toContain("R$ 148,00");
  });

  it("Cobrar e Lançar mais chamam o fluxo com a comanda tocada", () => {
    const { tree, onCobrar, onLancar } = montarPainel();
    act(() => { porId(tree, "painel-comanda-cobrar-12").props.onPress(); });
    expect(onCobrar).toHaveBeenCalledWith(expect.objectContaining({ id: "c12", number: 12 }));
    expect(texto(porId(tree, "painel-comanda-lancar-8"))).toBe("Lançar mais");
    act(() => { porId(tree, "painel-comanda-lancar-8").props.onPress(); });
    expect(onLancar).toHaveBeenCalledWith(expect.objectContaining({ number: 8 }));
  });

  it("com itens no carrinho o botão diz quantos vão", () => {
    const { tree } = montarPainel({ cartItemCount: 3 });
    expect(texto(porId(tree, "painel-comanda-lancar-12"))).toBe("Lançar 3 itens");
  });

  it("busca por número ou nome (sem acento)", () => {
    const { tree } = montarPainel();
    act(() => { porId(tree, "painel-comandas-busca").props.onChangeText("ze"); });
    expect(ordemNaTela(tree)).toEqual([5]);
    act(() => { porId(tree, "painel-comandas-busca").props.onChangeText("4"); });
    expect(ordemNaTela(tree)).toEqual([41]);
    act(() => { porId(tree, "painel-comandas-busca").props.onChangeText("xyz"); });
    expect(porId(tree, "painel-comandas-sem-resultado")).toBeTruthy();
  });

  it("nenhuma aberta: mostra o caminho e esconde busca e ordem", () => {
    mockAbertas = [];
    const { tree } = montarPainel();
    expect(texto(porId(tree, "painel-comandas-vazio"))).toContain("Adicionar à comanda");
    expect(porId(tree, "painel-comandas-busca")).toBeUndefined();
    expect(texto(porId(tree, "painel-comandas-resumo"))).toBe("Nenhuma aberta");
  });

  it("gaveta no computador, folha de baixo no celular; atualiza a cada 30 s", () => {
    const desk = montarPainel();
    expect(porId(desk.tree, "painel-comandas-gaveta")).toBeTruthy();
    expect(mockUseQuery).toHaveBeenLastCalledWith(expect.objectContaining({
      queryKey: ["comandas-abertas", "e1"], refetchInterval: ATUALIZA_PAINEL_MS,
    }));
    mockLargura = 375;
    const cel = montarPainel();
    expect(porId(cel.tree, "painel-comandas-folha")).toBeTruthy();
    expect(porId(cel.tree, "painel-comandas-gaveta")).toBeUndefined();
  });

  it("fechado não monta nada", () => {
    const { tree } = montarPainel({ visible: false });
    expect(tree.toJSON()).toBeNull();
    expect(mockUseQuery).not.toHaveBeenCalled();
  });
});

// ── O hook: o que "Lançar mais" e "Cobrar" fazem ─────────────

let h: ReturnType<typeof useComandaNoCaixa>;
function Harness(props: { cart: any[]; comanda?: any }) {
  h = useComandaNoCaixa({
    companyId: "e1", enabled: true, isDemo: false,
    cart: props.cart, comanda: props.comanda ?? null, setComanda: jest.fn(),
    limpar: jest.fn(), addToCart: jest.fn(), setQty: jest.fn(), products: [],
  });
  return null;
}
function montarHook(cart: any[], comanda: any = null) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Harness cart={cart} comanda={comanda} />); });
  arvores.push(tree);
  return tree;
}
const UM_ITEM = [{ productId: "p1", name: "Cerveja", price: 14, qty: 1 }];

describe("useComandaNoCaixa — painel", () => {
  it("Lançar mais com o carrinho vazio fecha o painel e avisa", () => {
    montarHook([]);
    act(() => { h.abrirPainel(); });
    expect(h.showPainel).toBe(true);
    act(() => { h.lancarMais({ number: 12 }); });
    expect(h.showPainel).toBe(false);
    expect(h.showAdicionar).toBe(false);
    expect(mockToast.info).toHaveBeenCalledWith("Adicione os produtos e toque em Adicionar à comanda");
  });

  it("Lançar mais com itens abre o modal de lançar já com o número", () => {
    montarHook(UM_ITEM);
    act(() => { h.abrirPainel(); });
    act(() => { h.lancarMais({ number: 12 }); });
    expect(h.showPainel).toBe(false);
    expect(h.showAdicionar).toBe(true);
    expect(h.numeroParaLancar).toBe(12);
    // "Adicionar à comanda" do rodapé abre sem número.
    act(() => { h.fecharAdicionar(); });
    act(() => { h.abrirAdicionar(); });
    expect(h.numeroParaLancar).toBeNull();
  });

  it("Lançar mais num carrinho que já é uma comanda sendo cobrada não abre o lançar", () => {
    montarHook(UM_ITEM, { id: "c5", number: 5, feePct: 0 });
    act(() => { h.abrirPainel(); });
    act(() => { h.lancarMais({ number: 12 }); });
    expect(h.showAdicionar).toBe(false);
    expect(mockToast.info).toHaveBeenCalledWith(expect.stringContaining("já é a comanda 5"));
  });

  it("Cobrar abre a conferência já com a comanda", () => {
    montarHook([]);
    act(() => { h.abrirPainel(); });
    act(() => { h.cobrarDoPainel({ number: 3 }); });
    expect(h.showPainel).toBe(false);
    expect(h.showFechar).toBe(true);
    expect(h.numeroParaCobrar).toBe(3);
  });

  it("o carrinho largou a comanda (venda feita): recarrega a contagem", () => {
    const tree = montarHook(UM_ITEM, { id: "c5", number: 5, feePct: 0 });
    expect(mockInvalidate).not.toHaveBeenCalled();
    act(() => { tree.update(<Harness cart={[]} comanda={null} />); });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["comandas-abertas", "e1"] });
  });
});

// ── Os modais com o número inicial ───────────────────────────

describe("modais com numeroInicial", () => {
  it("lançar: número e nome da comanda já vêm preenchidos", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AdicionarAComandaModal visible companyId="e1" itemCount={1} total={14} saving={false} onClose={jest.fn()} onConfirm={jest.fn()} numeroInicial={12} />
      );
    });
    arvores.push(tree);
    expect(porId(tree, "comanda-numero").props.value).toBe("12");
    expect(porId(tree, "comanda-nome").props.value).toBe("João");
    expect(texto(porId(tree, "comanda-lancar"))).toBe("Lançar na comanda 12");
  });

  it("fechar: já busca a comanda e mostra a conferência", async () => {
    mockApi.get.mockResolvedValue({
      comanda: {
        id: "c3", number: 3, name: "Mesa do fundo", status: "open", opened_at: "", items_count: 1, subtotal: 50,
        items: [{ id: "i1", product_id: null, variant_id: null, name: "Copão Gin", unit: null, quantity: 2, unit_price: 25, total: 50 }],
      },
    });
    const onCobrar = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FecharComandaModal visible companyId="e1" loja="Adega" onClose={jest.fn()} onCobrar={onCobrar} numeroInicial={3} />
      );
    });
    arvores.push(tree);
    await esperar();
    expect(mockApi.get).toHaveBeenCalledWith("e1", 3);
    expect(texto(porId(tree, "fechar-comanda-consumo"))).toContain("Consumo da comanda 3 · Mesa do fundo");
    act(() => { porId(tree, "fechar-comanda-cobrar").props.onPress(); });
    expect(onCobrar).toHaveBeenCalledWith(expect.objectContaining({ number: 3 }), 0);
  });
});

// ── As contas puras ──────────────────────────────────────────

describe("utils do painel", () => {
  it("tempo aberta", () => {
    expect(minutosAberta(abertaHa(134), AGORA)).toBe(134);
    expect(minutosAberta("lixo", AGORA)).toBeNull();
    expect(minutosAberta(new Date(AGORA + 60000).toISOString(), AGORA)).toBe(0);
    expect(tempoDaComanda(0)).toBe("agora");
    expect(tempoDaComanda(18)).toBe("há 18 min");
    expect(tempoDaComanda(134)).toBe("há 2h14");
    expect(tempoDaComanda(180)).toBe("há 3h");
    expect(tempoDaComanda(3 * 1440)).toBe("há 3 dias");
    expect(tempoDaComanda(null)).toBe("");
  });

  it("alerta a partir de 3 h", () => {
    expect(comandaVelha(179)).toBe(false);
    expect(comandaVelha(180)).toBe(true);
    expect(comandaVelha(null)).toBe(false);
  });

  it("ordem: sem data vai para o fim; não muda a lista recebida", () => {
    const l = [{ number: 2, opened_at: "" }, { number: 9, opened_at: abertaHa(10) }, { number: 1, opened_at: abertaHa(50) }];
    expect(ordenarComandas(l, "antigas").map((c) => c.number)).toEqual([1, 9, 2]);
    expect(ordenarComandas(l, "numero").map((c) => c.number)).toEqual([1, 2, 9]);
    expect(l.map((c) => c.number)).toEqual([2, 9, 1]);
  });

  it("busca", () => {
    expect(filtrarComandas(SEIS, "").length).toBe(6);
    expect(filtrarComandas(SEIS, "MESA").map((c) => c.number)).toEqual([3]);
    expect(filtrarComandas(SEIS, "1").map((c) => c.number)).toEqual([12]);
  });
});
