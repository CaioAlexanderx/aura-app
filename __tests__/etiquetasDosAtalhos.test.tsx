// ============================================================
// 17/11/2026 (p-155 / A3): etiquetas de tecla nos botões e a legenda
// "Atalhos" do Caixa.
//   1. A etiqueta vem do mapa (ATALHOS_DO_CAIXA): tecla F no Windows; ⌘ ou ⌥
//      no Mac (decisão 4 do mockup)
//   2. A legenda só lista tecla que existe no mapa, e todo atalho do mapa
//      aparece nela (sem tecla inventada, sem tecla esquecida)
//   3. Alt+A abre e fecha a legenda (AltGr não; com janela aberta não)
//   4. Só com mouse e teclado: no toque não aparece etiqueta nem "Atalhos"
//   5. Etiquetas nos botões: barra, pagamentos, Finalizar, desconto, troco,
//      Imprimir cupom / Nova venda, busca, "Enter adiciona", dica da busca
// Mocks do padrão do repo; testID + deep:false.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: (p: any) => (p.active ? p.children : null) }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t", isDemo: false }) }));
jest.mock("@/components/screens/pdv/MerchantLogo", () => ({
  MerchantLogo: () => null,
  useMerchantBrand: () => ({ logoUrl: null, name: "Loja", initial: "L" }),
}));
jest.mock("@/services/api", () => ({ BASE_URL: "http://api" }));
jest.mock("@/components/screens/pdv/NfceActions", () => ({ NfceActions: () => null }));
jest.mock("@/components/screens/pdv/OsActions", () => ({ OsActions: () => null }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/utils/clipboard", () => ({ copyText: jest.fn() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return new Proxy(RN, {
    get(alvo: any, nome: string) {
      if (nome === "Modal") return ({ visible, children }: any) => (visible ? children : null);
      return alvo[nome];
    },
  });
});

import React from "react";
import renderer, { act } from "react-test-renderer";
import {
  ATALHOS_DO_CAIXA, acaoDoPagamento, etiquetaDoAtalho, resolverAtalho, sistemaDoTeclado, teclasDaLegenda,
  type AcaoDoCaixa,
} from "@/utils/atalhosDoCaixa";
import { __esquecerSistemaDoTeclado } from "@/hooks/useTemTeclado";
import { EtiquetaDeTecla } from "@/components/screens/pdv/EtiquetaDeTecla";
import { BotaoDosAtalhos, DicaDaBusca, LegendaDosAtalhos, pedacosDaLinha } from "@/components/screens/pdv/LegendaDosAtalhos";
import { LEGENDA_DOS_ATALHOS } from "@/components/screens/pdv/textosDosAtalhos";
import { CartPanel, type CartDisplayItem } from "@/components/screens/pdv/CartPanel";
import { CashChangeModal } from "@/components/screens/pdv/CashChangeModal";
import { ProductGrid } from "@/components/screens/pdv/ProductGrid";
import { SearchBox } from "@/components/screens/pdv/SearchBox";
import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
const etiquetas = (t: renderer.ReactTestRenderer) => porId(t, "etiqueta-de-tecla").map(n => texto(n.children));

let plataforma = "Win32";
function aparelho(comTeclado: boolean, so: "Win32" | "MacIntel" = "Win32") {
  (window as any).matchMedia = (q: string) => ({
    matches: comTeclado && q === "(hover: hover) and (pointer: fine)", media: q,
    addEventListener: () => {}, removeEventListener: () => {},
  });
  plataforma = so;
  __esquecerSistemaDoTeclado();
}
beforeAll(() => {
  Object.defineProperty(window.navigator, "platform", { get: () => plataforma, configurable: true });
});
afterEach(() => { delete (window as any).matchMedia; aparelho(false); delete (window as any).matchMedia; });

describe("a tecla da etiqueta vem do mapa", () => {
  const casos: [AcaoDoCaixa, string, string][] = [
    ["codigoManual", "F1", "⌥M"],
    ["vendedora", "F2", "⌥V"],
    ["cliente", "F3", "⌥C"],
    ["cupom", "F4", "⌥U"],
    ["troca", "F5", "⌥T"],
    ["busca", "F6", "⌘K"],
    ["desconto", "F7", "⌥S"],
    ["removerUltimo", "F8", "⌥X"],
    ["finalizar", "F9", "⌘↵"],
    ["pagamento1", "Alt+1", "⌥1"],
    ["pagamento5", "Alt+5", "⌥5"],
    ["novaVenda", "Enter", "Enter"],
    ["imprimir", "Ctrl+P", "⌘P"],
    ["legenda", "Alt+A", "⌥A"],
  ];
  it.each(casos)("%s: %s no Windows, %s no Mac", (acao, win, mac) => {
    expect(etiquetaDoAtalho(acao, "windows")).toBe(win);
    expect(etiquetaDoAtalho(acao, "mac")).toBe(mac);
  });

  it("legenda: todas as teclas, sem as repetidas do numérico", () => {
    expect(teclasDaLegenda("finalizar", "windows")).toEqual(["F9", "Ctrl+Enter"]);
    expect(teclasDaLegenda("finalizar", "mac")).toEqual(["F9", "⌘↵"]);
    expect(teclasDaLegenda("novaVenda", "windows")).toEqual(["Enter", "Esc", "F9"]);
    expect(teclasDaLegenda("busca", "mac")).toEqual(["F6", "⌘K"]);
  });

  it("sistema: Mac pelo navegador (platform ou userAgentData), o resto é Windows", () => {
    expect(sistemaDoTeclado({ platform: "MacIntel" })).toBe("mac");
    expect(sistemaDoTeclado({ userAgentData: { platform: "macOS" }, platform: "" })).toBe("mac");
    expect(sistemaDoTeclado({ platform: "Win32" })).toBe("windows");
    expect(sistemaDoTeclado({ platform: "Linux x86_64" })).toBe("windows");
    expect(sistemaDoTeclado(null)).toBe("windows");
  });

  it("pagamento pela chave, na ordem de PAYMENTS", () => {
    expect(["dinheiro", "pix", "debito", "cartao", "crediario", "outro"].map(acaoDoPagamento))
      .toEqual(["pagamento1", "pagamento2", "pagamento3", "pagamento4", "pagamento5", null]);
  });
});

describe("a legenda e o mapa andam juntos", () => {
  const naLegenda = new Set<string>();
  for (const g of LEGENDA_DOS_ATALHOS) for (const l of g.linhas) {
    (l.acoes || []).forEach(a => naLegenda.add(a));
    if (l.faixa) ["pagamento1", "pagamento2", "pagamento3", "pagamento4", "pagamento5"].forEach(a => naLegenda.add(a));
  }

  it("quatro grupos, na ordem da venda", () => {
    expect(LEGENDA_DOS_ATALHOS.map(g => g.titulo)).toEqual(["Achar o produto", "Ajustar a venda", "Receber", "Depois da venda"]);
  });

  it("toda linha tem tecla, e só tecla que existe no mapa", () => {
    const acoesDoMapa = new Set(ATALHOS_DO_CAIXA.map(a => a.acao));
    for (const g of LEGENDA_DOS_ATALHOS) for (const l of g.linhas) {
      for (const a of l.acoes || []) expect(acoesDoMapa.has(a)).toBe(true);
      expect(pedacosDaLinha(l, "windows").filter(p => p.tecla).length).toBeGreaterThan(0);
    }
  });

  it("todo atalho do mapa aparece na legenda (menos o Esc genérico que fecha janelas)", () => {
    const fora = ATALHOS_DO_CAIXA.map(a => a.acao).filter(a => a !== "fechar" && !naLegenda.has(a));
    expect(fora).toEqual([]);
  });

  it("linhas: 'ou' entre alternativas, 'a' na faixa dos pagamentos, ↑ ↓ juntas", () => {
    const linha = (t: string) => LEGENDA_DOS_ATALHOS.flatMap(g => g.linhas).find(l => l.texto === t)!;
    const plano = (t: string, so: "windows" | "mac") => pedacosDaLinha(linha(t), so).map(p => p.tecla || p.palavra).join(" ");
    expect(plano("Buscar produto", "windows")).toBe("F6 ou Ctrl+K");
    expect(plano("Buscar produto", "mac")).toBe("F6 ou ⌘K");
    expect(plano("Dinheiro, Pix, Débito, Crédito, Crediário", "windows")).toBe("Alt+1 a Alt+5");
    expect(plano("Trocar o destaque", "windows")).toBe("↑ ↓");
    expect(plano("Começar a próxima venda", "windows")).toBe("Enter ou Esc ou F9");
  });
});

describe("Alt+A abre e fecha a legenda", () => {
  const caixa = { telaFinal: false, janelaAberta: false, temItens: false };
  it("Alt+A (⌥A) no Caixa", () => {
    expect(resolverAtalho({ key: "a", code: "KeyA", altKey: true }, caixa)).toEqual({ acao: "legenda", segurar: true });
    expect(resolverAtalho({ key: "å", code: "KeyA", altKey: true }, caixa)).toEqual({ acao: "legenda", segurar: true });
  });
  it("AltGr, janela aberta, ⌥A escrevendo num campo do Mac e tela final: não", () => {
    expect(resolverAtalho({ key: "a", code: "KeyA", altKey: true, ctrlKey: true }, caixa).acao).toBeNull();
    expect(resolverAtalho({ key: "a", code: "KeyA", altKey: true }, { ...caixa, janelaAberta: true }).acao).toBeNull();
    expect(resolverAtalho({ key: "å", code: "KeyA", altKey: true, emCampo: true }, caixa).acao).toBeNull();
    expect(resolverAtalho({ key: "a", code: "KeyA", altKey: true }, { telaFinal: true, janelaAberta: false }).acao).toBeNull();
  });
});

describe("só com mouse e teclado", () => {
  it("EtiquetaDeTecla: some no toque; no Windows F3, no Mac ⌥C", () => {
    aparelho(false);
    let t = renderer.create(<EtiquetaDeTecla acao="cliente" />);
    expect(etiquetas(t)).toEqual([]);
    aparelho(true, "Win32");
    act(() => { t = renderer.create(<EtiquetaDeTecla acao="cliente" />); });
    expect(etiquetas(t)).toEqual(["F3"]);
    aparelho(true, "MacIntel");
    act(() => { t = renderer.create(<EtiquetaDeTecla acao="cliente" />); });
    expect(etiquetas(t)).toEqual(["⌥C"]);
  });

  it("botão Atalhos e dica da busca: só com teclado", () => {
    aparelho(false);
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<><BotaoDosAtalhos aberta={false} onPress={jest.fn()} /><DicaDaBusca visivel /></>); });
    expect(porId(t, "pdv-botao-atalhos")).toHaveLength(0);
    expect(porId(t, "pdv-dica-da-busca")).toHaveLength(0);
    aparelho(true);
    const abrir = jest.fn();
    act(() => { t = renderer.create(<><BotaoDosAtalhos aberta={false} onPress={abrir} /><DicaDaBusca visivel /></>); });
    expect(texto(porId(t, "pdv-botao-atalhos")[0].children)).toContain("Atalhos");
    expect(etiquetas(t)).toEqual(["Alt+A", "Enter", "↑", "↓", "Esc"]);
    expect(texto(porId(t, "pdv-dica-da-busca")[0].children)).toBe("Entercoloca na venda·↑↓trocam o destaque·Esclimpa a busca");
    act(() => { porId(t, "pdv-botao-atalhos")[0].props.onPress(); });
    expect(abrir).toHaveBeenCalled();
  });
});

describe("a legenda", () => {
  it("fechada não aparece; aberta: título, quatro grupos, rodapé e × que fecha", () => {
    aparelho(true);
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<LegendaDosAtalhos aberta={false} onFechar={jest.fn()} />); });
    expect(porId(t, "legenda-dos-atalhos")).toHaveLength(0);
    const fechar = jest.fn();
    act(() => { t = renderer.create(<LegendaDosAtalhos aberta onFechar={fechar} />); });
    const tudo = texto(porId(t, "legenda-dos-atalhos")[0].children);
    expect(tudo).toContain("Atalhos do Caixa");
    expect(tudo).toContain("na ordem da venda");
    expect(tudo).toContain("O Enter sozinho nunca finaliza a venda");
    expect(["1", "2", "3", "4"].map(n => porId(t, "legenda-grupo-" + n).length)).toEqual([1, 1, 1, 1]);
    act(() => { porId(t, "legenda-fechar")[0].props.onPress(); });
    act(() => { porId(t, "legenda-fundo")[0].props.onPress(); });
    expect(fechar).toHaveBeenCalledTimes(2);
  });
});

describe("as etiquetas nos botões", () => {
  const A: CartDisplayItem = { productId: "a", productBaseId: "a", name: "Camiseta", price: 50, qty: 1, listPrice: 50 } as any;
  const PAG = ["dinheiro", "pix", "debito", "cartao", "crediario"].map(k => ({ key: k, label: k, icon: "dollar" }));
  function carrinho() {
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(
        <CartPanel
          items={[A]} subtotal={50} discountAmount={0} total={50} itemCount={1}
          payMethods={PAG as any} activePay="pix"
          onPay={jest.fn()} onInc={jest.fn()} onDec={jest.fn()} onRemove={jest.fn()} onClear={jest.fn()} onFinalize={jest.fn()}
          discountType="%" setDiscountType={jest.fn()} discountValue="" setDiscountValue={jest.fn()} manualDiscountAmount={0} clearDiscount={jest.fn()}
        />,
      );
    });
    return t;
  }

  it("carrinho: Alt+1…5 nos pagamentos, F7 no desconto, F9 no Finalizar (Windows)", () => {
    aparelho(true);
    const e = etiquetas(carrinho());
    expect(e).toEqual(expect.arrayContaining(["Alt+1", "Alt+2", "Alt+3", "Alt+4", "Alt+5", "F7", "F9"]));
  });

  it("carrinho no Mac: ⌥1…5, ⌥S, ⌘↵", () => {
    aparelho(true, "MacIntel");
    const e = etiquetas(carrinho());
    expect(e).toEqual(expect.arrayContaining(["⌥1", "⌥5", "⌥S", "⌘↵"]));
    expect(e).not.toContain("F9");
  });

  it("carrinho no toque: nenhuma etiqueta", () => {
    aparelho(false);
    expect(etiquetas(carrinho())).toEqual([]);
  });

  it("troco: Enter no Confirmar venda", () => {
    aparelho(true);
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<CashChangeModal visible total={50} onCancel={jest.fn()} onConfirm={jest.fn()} />); });
    expect(etiquetas(t)).toEqual(["Enter"]);
  });

  it("busca: F6 no Windows, ⌘K no Mac (era ⌘K fixo); some no toque", () => {
    aparelho(true);
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<SearchBox value="" onChange={jest.fn()} />); });
    expect(etiquetas(t)).toEqual(["F6"]);
    aparelho(true, "MacIntel");
    act(() => { t = renderer.create(<SearchBox value="" onChange={jest.fn()} />); });
    expect(etiquetas(t)).toEqual(["⌘K"]);
    aparelho(false);
    act(() => { t = renderer.create(<SearchBox value="" onChange={jest.fn()} />); });
    expect(etiquetas(t)).toEqual([]);
  });

  it("grade: 'Enter adiciona' só no produto destacado e só com teclado", () => {
    const P = [{ id: "p1", name: "Blusa", price: 40, stock_qty: 3 }, { id: "p2", name: "Cinto", price: 50, stock_qty: 3 }] as any;
    aparelho(true);
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<ProductGrid products={P} qtyById={{}} onAdd={jest.fn()} destaqueId="p2" />); });
    expect(porId(t, "grade-enter-adiciona")).toHaveLength(1);
    expect(texto(porId(t, "grade-enter-adiciona")[0].children)).toBe("Enteradiciona");
    aparelho(false);
    act(() => { t = renderer.create(<ProductGrid products={P} qtyById={{}} onAdd={jest.fn()} destaqueId="p2" />); });
    expect(porId(t, "grade-enter-adiciona")).toHaveLength(0);
  });

  it("tela final: Ctrl+P no Imprimir cupom e Enter no Nova venda (Mac: ⌘P e Enter)", () => {
    const VENDA = { id: "v-1", saleNumber: 7, total: 40, payment: "pix", items: [{ productId: "p1", name: "Blusa", price: 40, qty: 1 }], date: "" } as any;
    const montar = () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      let t!: renderer.ReactTestRenderer;
      act(() => { t = renderer.create(<QueryClientProvider client={qc}><SaleComplete sale={VENDA} onNewSale={jest.fn()} /></QueryClientProvider>); });
      return t;
    };
    aparelho(true);
    expect(etiquetas(montar())).toEqual(["Ctrl+P", "Enter"]);
    aparelho(true, "MacIntel");
    expect(etiquetas(montar())).toEqual(["⌘P", "Enter"]);
    aparelho(false);
    expect(etiquetas(montar())).toEqual([]);
  });
});
