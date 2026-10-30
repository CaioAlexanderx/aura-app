// ============================================================
// Etiquetas no celular (QA de 30/10/2026 a 375×812, depois do app#1163).
//
// · A barra de impressão (total, "Ver no tamanho real", Imprimir) fica
//   sempre à vista no celular: vira um bloco do shell, entre a área que rola
//   e a barra de navegação de baixo — nunca atrás dela e sem cobrir o fim
//   da lista (a área que rola encolhe). No desktop continua no fim da tela,
//   com sticky.
// · Na linha do produto com variantes, selo de estoque, preço e "Ver
//   variantes" descem para uma segunda linha no celular; o nome fica com a
//   largura toda (antes virava "V…").
// O shell é montado à mão com a mesma forma do ramo "Web narrow" de
// app/(tabs)/_layout.tsx (topbar, div que rola com a PageTransition, MBar).
// ============================================================
import React, { useState } from "react";
import renderer, { act as actTR } from "react-test-renderer";
import { StyleSheet } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => Root };
type Root = { render: (n: React.ReactNode) => void; unmount: () => void };
const act = (React as any).act as (fn: () => void | Promise<void>) => Promise<void>;

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1", name: "Loja" }, token: "t" }) }));
const mockVariants = jest.fn();
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({
  request: (...a: any[]) => mockRequest(...a),
  companiesApi: { variants: (...a: any[]) => mockVariants(...a) },
  pdvSettingsApi: { get: jest.fn(() => Promise.resolve({})), save: jest.fn(() => Promise.resolve({})), saveLabelConfig: jest.fn(() => Promise.resolve({})) },
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }) }));
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));
jest.mock("@/components/ImpressaoNoIphone", () => ({ avisarImpressaoNoIphone: jest.fn() }));

import { PrintLabels, acharVagaDaBarraNoCelular } from "@/components/PrintLabels";

// Nome com mais de 20 caracteres: no celular ele precisa aparecer.
const NOME_LONGO = "Vestido Longo Estampado Floral";
const prod = (id: string, over: any = {}): any => ({ id, name: NOME_LONGO, code: "C" + id, barcode: "7891033948208", category: "Roupas", price: 189.9, stock: 4, unit: "un", size: "", color: "", has_variants: true, ...over });
const vars = (pid: string): any[] => [
  { id: pid + "-p", product_id: pid, stock_qty: "3", is_active: true, attributes: [{ attribute: "Tamanho", value: "P" }] },
  { id: pid + "-m", product_id: pid, stock_qty: "1", is_active: true, attributes: [{ attribute: "Tamanho", value: "M" }] },
];

function Tela({ products }: { products: any[] }) {
  const [sel, setSel] = useState<string[]>([]);
  return <PrintLabels products={products} selectedIds={sel} onSelectionChange={setSel} />;
}

// Largura da janela que o RNW enxerga (Dimensions lê clientWidth no jsdom).
function larguraDaTela(px: number) {
  Object.defineProperty(document.documentElement, "clientWidth", { value: px, configurable: true });
  window.dispatchEvent(new Event("resize"));
}

// Shell com a forma do ramo "Web narrow" de app/(tabs)/_layout.tsx.
function montaShell() {
  const shell = document.createElement("div");
  shell.style.display = "flex";
  shell.style.flexDirection = "column";
  shell.style.height = "812px";
  const topbar = document.createElement("div");
  const rolagem = document.createElement("div");
  rolagem.style.flex = "1";
  rolagem.style.overflow = "auto";
  const transicao = document.createElement("div");
  transicao.className = "aura-page-enter";
  const host = document.createElement("div");
  transicao.appendChild(host);
  rolagem.appendChild(transicao);
  const mbar = document.createElement("div");
  mbar.setAttribute("data-shell", "mbar");
  shell.appendChild(topbar);
  shell.appendChild(rolagem);
  shell.appendChild(mbar);
  document.body.appendChild(shell);
  return { shell, rolagem, mbar, host };
}

const porTestId = (id: string) => document.querySelector('[data-testid="' + id + '"]') as HTMLElement | null;
async function flush() { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); }

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  mockVariants.mockReset();
  mockRequest.mockReset();
  mockRequest.mockImplementation((path: string) => {
    const ids = decodeURIComponent(path.split("product_ids=")[1] || "").split(",");
    const m: any = {};
    ids.forEach((id) => { m[id] = vars(id); });
    return Promise.resolve({ variants_by_product: m });
  });
  mockVariants.mockImplementation((_cid: string, pid: string) => Promise.resolve({ variants: vars(pid) }));
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("barra de impressão", () => {
  test("no celular (375 px) fica logo acima da barra de navegação, fora da área que rola", async () => {
    larguraDaTela(375);
    const { shell, rolagem, mbar, host } = montaShell();
    const root = createRoot(host);
    await act(async () => { root.render(<Tela products={[prod("s", { has_variants: false, stock: 2, name: "Saia" })]} />); });
    await flush();

    const barra = porTestId("etiquetas-barra")!;
    expect(barra).not.toBeNull();
    // Um bloco do shell entre a área que rola e a barra de navegação de baixo.
    const vaga = barra.parentElement!;
    expect(vaga.parentElement).toBe(shell);
    expect(vaga.previousElementSibling).toBe(rolagem);
    expect(vaga.nextElementSibling).toBe(mbar);
    expect(vaga.style.flexShrink).toBe("0");
    // Não rola junto com a lista (e por isso nunca cobre o último item).
    expect(rolagem.contains(barra)).toBe(false);
    expect(document.querySelectorAll('[data-testid="etiquetas-barra"]')).toHaveLength(1);

    // Continua viva: marcar um produto atualiza o total e o Imprimir.
    await act(() => { (porTestId("etiquetas-marcar-todos") as HTMLElement).click(); });
    expect(porTestId("etiquetas-total")!.textContent).toBe("2 etiquetas");
    expect(porTestId("etiquetas-imprimir")!.textContent).toBe("Imprimir 2 etiquetas");
    expect(porTestId("etiquetas-ver-tamanho-real")!.textContent).toBe("Ver no tamanho real");

    // Saiu da aba: a vaga sai junto.
    await act(() => { root.unmount(); });
    expect(shell.querySelector(".aura-etiquetas-barra")).toBeNull();
    expect(shell.children).toHaveLength(3);
  });

  test("no desktop continua no fim da tela, dentro da página (sticky)", async () => {
    larguraDaTela(1280);
    const { shell, rolagem, host } = montaShell();
    const root = createRoot(host);
    await act(async () => { root.render(<Tela products={[prod("s", { has_variants: false, stock: 2, name: "Saia" })]} />); });
    await flush();

    const barra = porTestId("etiquetas-barra")!;
    expect(rolagem.contains(barra)).toBe(true);
    expect(shell.querySelector(".aura-etiquetas-barra")).toBeNull();
    await act(() => { root.unmount(); });
  });

  test("vaga só existe no shell do celular (flex em coluna, com área que rola)", () => {
    const { host, rolagem, mbar } = montaShell();
    expect(acharVagaDaBarraNoCelular(host)).toEqual({ pai: rolagem.parentElement, antes: mbar });
    // Fora da PageTransition (nativo, testes): sem vaga, a barra fica no lugar.
    const solto = document.createElement("div");
    document.body.appendChild(solto);
    expect(acharVagaDaBarraNoCelular(solto)).toBeNull();
    expect(acharVagaDaBarraNoCelular(null)).toBeNull();
    // Shell em linha (desktop, com a sidebar ao lado): sem vaga.
    rolagem.parentElement!.style.flexDirection = "row";
    expect(acharVagaDaBarraNoCelular(host)).toBeNull();
  });
});

describe("linha do produto com variantes", () => {
  const acha = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
  async function flushTR() { for (let i = 0; i < 6; i++) await actTR(async () => { await Promise.resolve(); }); }
  function flatten(node: any): string {
    if (node == null || node === false) return "";
    if (typeof node === "string") return node;
    if (typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(flatten).join("");
    return flatten(node.children);
  }

  test("no celular, selo, preço e 'Ver variantes' descem e o nome fica com a largura toda", async () => {
    larguraDaTela(375);
    let t!: renderer.ReactTestRenderer;
    actTR(() => { t = renderer.create(<Tela products={[prod("a")]} />); });
    await flushTR();

    const nome = acha(t, "etiquetas-nome-a")[0];
    // O nome inteiro está lá (mais de 20 caracteres) e pode ocupar a linha.
    expect(flatten(nome)).toContain(NOME_LONGO);
    expect(StyleSheet.flatten(nome.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
    const textoDoNome = nome.findAll((n: any) => n.props && n.props.numberOfLines === 1 && flatten(n) === NOME_LONGO, { deep: false })[0];
    expect(StyleSheet.flatten(textoDoNome.props.style)).toMatchObject({ flexShrink: 1, minWidth: 0 });

    // A primeira linha só tem o quadradinho e o nome; o resto está embaixo.
    const linhaDoNome = nome.parent!;
    const naLinha = linhaDoNome.findAll((n: any) => n.props && n.props.testID === "etiquetas-ver-variantes-a", { deep: false });
    expect(naLinha).toHaveLength(0);
    expect(flatten(linhaDoNome)).not.toContain("em estoque");
    const acoes = acha(t, "etiquetas-acoes-a")[0];
    expect(flatten(acoes)).toContain("4 em estoque");
    expect(flatten(acoes)).toContain("R$ 189,90");
    expect(flatten(acoes)).toContain("Ver variantes");

    // "Ver variantes" continua abrindo o produto.
    actTR(() => { acha(t, "etiquetas-ver-variantes-a")[0].props.onPress(); });
    expect(acha(t, "etiquetas-variantes-a")).toHaveLength(1);
    t.unmount();
  });

  test("no desktop a linha fica como estava: tudo numa linha só", async () => {
    larguraDaTela(1280);
    let t!: renderer.ReactTestRenderer;
    actTR(() => { t = renderer.create(<Tela products={[prod("a")]} />); });
    await flushTR();
    expect(acha(t, "etiquetas-acoes-a")).toHaveLength(0);
    const linhaDoNome = acha(t, "etiquetas-nome-a")[0].parent!;
    expect(linhaDoNome.findAll((n: any) => n.props && n.props.testID === "etiquetas-ver-variantes-a", { deep: false })).toHaveLength(1);
    expect(flatten(linhaDoNome)).toContain("4 em estoque");
    t.unmount();
  });
});
