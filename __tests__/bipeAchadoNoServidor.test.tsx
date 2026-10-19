// 19/10/2026 — tq-30, continuação do INC-2026-10-19-01. O app#1103 tirou a
// linha do pai do seletor "Qual variante?", mas dois caminhos punham o pai no
// carrinho SEM abrir o seletor: o bipe que o servidor acha (código de barras
// ou SKU do pai) e que não está na lista local, no Caixa (usePdvState) e na
// Troca (Step3NewItems). Regra (Produto): com pelo menos uma variante ativa,
// abre o seletor; código de um tamanho vem com ele marcado, código só do
// pai vem sem nada marcado. Sem variante ativa, segue entrando direto.
import React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => Root };
type Root = { render: (n: React.ReactNode) => void; unmount: () => void };
const act = (React as any).act as (fn: () => void | Promise<void>) => Promise<void>;

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/stores/auth", () => {
  const estado = { company: { id: "co-1", plan: "negocio" }, user: { id: "u-1" }, isDemo: false, companyLogo: null };
  const useAuthStore = Object.assign(
    (sel?: (s: any) => any) => (typeof sel === "function" ? sel(estado) : estado),
    { getState: () => estado, setState: () => {}, subscribe: () => () => {} },
  );
  return { useAuthStore };
});
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
  useMutation: () => ({ mutate: jest.fn(), mutateAsync: jest.fn() }),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), setParams: jest.fn() }),
  usePathname: () => "/pdv",
}));
// A lista local do Caixa não tem o produto: o bipe vai ao servidor.
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ products: [] }) }));
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: [] }) }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, invalidate: jest.fn() }),
  validateSaleAgainstSettings: () => ({ ok: true, missing: [] }),
}));
jest.mock("@/hooks/useCategories", () => ({ useCategories: () => ({ flattened: [] }) }));
jest.mock("@/hooks/useCaixa", () => ({ useCaixa: () => ({ sessaoAtiva: null, isAberto: true, isLoading: false, invalidate: jest.fn() }) }));
jest.mock("@/hooks/useGlobalBarcodeScanner", () => ({ useGlobalBarcodeScanner: () => {} }));
jest.mock("@/hooks/useCompanyProfile", () => ({ useCompanyProfile: () => null }));
jest.mock("@/hooks/useMatconQuote", () => ({ useMatconQuote: () => ({}) }));
jest.mock("@/hooks/useMatconReferral", () => ({ useMatconReferral: () => ({}) }));
jest.mock("@/hooks/useOrcamentoNoCaixa", () => ({ useOrcamentoNoCaixa: () => {}, chaveDoOrcamento: () => null }));
jest.mock("@/hooks/useComandaNoCaixa", () => ({ useComandaNoCaixa: () => ({}) }));
jest.mock("@/components/screens/pdv/ComandasAbertasPanel", () => ({ useComandasAbertas: () => ({ comandas: [] }) }));
jest.mock("@/components/screens/pdv/flyToCart", () => ({ flyToCart: jest.fn() }));
jest.mock("@/services/nfceApi", () => ({ nfceApi: {} }));
jest.mock("@/services/creditApi", () => ({ creditApi: {} }));
jest.mock("@/services/warrantiesApi", () => ({ warrantiesApi: {} }));

const CODIGO_DO_PAI = "7900294991813";
const SKU_DO_PAI = "VZ-1430";
const CODIGO_DO_40 = "7900123206392";
const VARIANTES = [
  { id: "v38", sku_suffix: "38", stock_qty: "0", barcode: "7900123206378", is_active: true },
  { id: "v39", sku_suffix: "39", stock_qty: "3", barcode: "7900123206385", is_active: true },
  { id: "v40", sku_suffix: "40", stock_qty: "1", barcode: CODIGO_DO_40, is_active: true },
];
// O backend converte numeric em número (config/database.js, setTypeParser 1700).
const PAI = { id: "p1", name: "Vizzano Tênis Samba 1430", price: 249.99, stock_qty: 6 };

const mockVariants = jest.fn((..._a: any[]) => Promise.resolve({ variants: VARIANTES as any[] }));
const mockScan = jest.fn((..._a: any[]) => Promise.resolve({} as any));
jest.mock("@/services/api", () => ({
  companiesApi: { variants: (...a: any[]) => mockVariants(...a) },
  pdvApi: { scan: (...a: any[]) => mockScan(...a), createSale: jest.fn() },
  couponsApi: {},
  employeesApi: { list: jest.fn() },
}));
jest.mock("@/services/pdvApi", () => ({
  pdvApi: { scan: (...a: any[]) => mockScan(...a) },
}));

import { temVarianteAtiva, ehVarianteAtiva } from "@/utils/varianteAtivaNoBipe";
import { usePdvState } from "@/hooks/usePdvState";
import { VariantPickerModal } from "@/components/VariantPickerModal";
import { Step3NewItems } from "@/components/screens/pdv/troca/Step3NewItems";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch {}
  mockVariants.mockReset(); mockScan.mockReset();
  mockVariants.mockImplementation(() => Promise.resolve({ variants: VARIANTES as any[] }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => { root.unmount(); });
  host.remove();
});

async function esperar() {
  await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
}
const linhas = () =>
  Array.from(document.querySelectorAll('[data-testid^="variante-"]')).map((el) =>
    el.getAttribute("data-testid")!.replace("variante-", ""));
const marcada = () => {
  const el = document.querySelector('[data-testid^="variante-"][aria-selected="true"]');
  return el ? el.getAttribute("data-testid")!.replace("variante-", "") : null;
};
const textoDaTela = () => document.body.textContent || "";

// ── O helper ────────────────────────────────────────────────────────────────
describe("temVarianteAtiva", () => {
  it("variante ativa = is_active !== false (a mesma do seletor)", () => {
    expect(ehVarianteAtiva({ id: "a" })).toBe(true);
    expect(ehVarianteAtiva({ id: "a", is_active: true })).toBe(true);
    expect(ehVarianteAtiva({ id: "a", is_active: false })).toBe(false);
    expect(ehVarianteAtiva(null)).toBe(false);
  });

  it("scan pelo código do pai: decide pelas variants que o scan já trouxe, sem outra consulta", async () => {
    const buscar = jest.fn();
    expect(await temVarianteAtiva("co-1", { id: "p1", variants: [{ id: "v1" }] }, buscar)).toBe(true);
    expect(await temVarianteAtiva("co-1", { id: "p1", variants: [] }, buscar)).toBe(false);
    expect(await temVarianteAtiva("co-1", { id: "p1", variants: [{ id: "v1", is_active: false }] }, buscar)).toBe(false);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("scan pelo SKU (sem variants no retorno): consulta as variantes do produto", async () => {
    const com = jest.fn(() => Promise.resolve({ variants: [{ id: "v1", is_active: true }] }));
    expect(await temVarianteAtiva("co-1", { id: "p1" }, com)).toBe(true);
    expect(com).toHaveBeenCalledWith("co-1", "p1");
    const soInativas = jest.fn(() => Promise.resolve({ variants: [{ id: "v1", is_active: false }] }));
    expect(await temVarianteAtiva("co-1", { id: "p1" }, soInativas)).toBe(false);
    const nenhuma = jest.fn(() => Promise.resolve({ variants: [] }));
    expect(await temVarianteAtiva("co-1", { id: "p1" }, nenhuma)).toBe(false);
  });

  it("consulta que falha segue como hoje (entra direto)", async () => {
    const falha = jest.fn(() => Promise.reject(new Error("rede")));
    expect(await temVarianteAtiva("co-1", { id: "p1" }, falha)).toBe(false);
    expect(await temVarianteAtiva("co-1", null, falha)).toBe(false);
  });
});

// ── Caixa: o usePdvState de verdade, com a lista local vazia ────────────────
let st: ReturnType<typeof usePdvState>;
function Caixa() {
  st = usePdvState();
  return (
    <VariantPickerModal
      visible={!!st.pendingProduct}
      product={st.pendingProduct as any}
      onSelect={st.handleVariantSelected as any}
      onClose={() => {}}
      keyboard
      preselectVariantId={st.pendingBipe?.variantId || null}
      preselectBarcode={st.pendingBipe?.code || null}
    />
  );
}
async function abrirCaixa() {
  await act(async () => { root.render(<Caixa />); });
  await esperar();
}
async function biparNoCaixa(code: string) {
  let lancou: boolean | undefined;
  await act(async () => { lancou = await st.handleScan(code); });
  await esperar();
  return lancou;
}
const carrinho = () => st.displayItems as Array<{ productId: string; qty: number }>;

describe("Caixa · bipe achado no servidor, produto fora da lista local", () => {
  it("código do pai, com variante ativa: abre o seletor sem nada marcado e não põe nada no carrinho", async () => {
    mockScan.mockImplementation(() => Promise.resolve({
      match: "exact", source: "barcode", product: { ...PAI, variants: VARIANTES },
    }));
    await abrirCaixa();
    expect(await biparNoCaixa(CODIGO_DO_PAI)).toBe(true);
    expect(st.pendingProduct).toEqual(expect.objectContaining({ id: "p1", name: PAI.name }));
    expect(st.pendingBipe).toEqual({ code: CODIGO_DO_PAI });
    expect(carrinho()).toHaveLength(0);
    expect(textoDaTela()).toContain("Qual variante?");
    expect(linhas()).toEqual(["v38", "v39", "v40"]);
    expect(marcada()).toBeNull();
    // O scan já trouxe as variantes: nenhuma consulta a mais para decidir.
    // (A única chamada é a do próprio seletor, para montar a lista.)
    expect(mockVariants).toHaveBeenCalledTimes(1);

    // A lojista escolhe o tamanho: entra com a variante.
    await act(() => { (document.querySelector('[data-testid="variante-v39"]') as HTMLElement).click(); });
    expect(carrinho()).toEqual([expect.objectContaining({ productId: "p1__v39", qty: 1 })]);
    expect(st.pendingProduct).toBeNull();
  });

  it("SKU do pai, com variante ativa: consulta as variantes e abre o seletor sem nada marcado", async () => {
    mockScan.mockImplementation(() => Promise.resolve({ match: "exact", source: "sku", product: { ...PAI } }));
    await abrirCaixa();
    expect(await biparNoCaixa(SKU_DO_PAI)).toBe(true);
    expect(mockVariants).toHaveBeenCalledWith("co-1", "p1");
    expect(st.pendingBipe).toEqual({ code: SKU_DO_PAI });
    expect(carrinho()).toHaveLength(0);
    expect(textoDaTela()).toContain("Qual variante?");
    expect(marcada()).toBeNull();
  });

  it("código de um tamanho: abre o seletor com esse tamanho marcado (caminho de antes, sem mudança)", async () => {
    mockScan.mockImplementation(() => Promise.resolve({
      match: "exact", source: "variant_barcode", variant_id: "v40", effective_price: 249.99,
      product: { ...PAI, variant_id: "v40", sku_suffix: "40" },
    }));
    await abrirCaixa();
    expect(await biparNoCaixa(CODIGO_DO_40)).toBe(true);
    expect(st.pendingBipe).toEqual({ code: CODIGO_DO_40, variantId: "v40" });
    expect(carrinho()).toHaveLength(0);
    expect(marcada()).toBe("v40");
  });

  it("produto sem variante ativa: segue entrando direto no carrinho, sem seletor", async () => {
    mockScan.mockImplementation(() => Promise.resolve({
      match: "exact", source: "barcode", product: { id: "p2", name: "Meia soquete", price: 19.9, variants: [] },
    }));
    await abrirCaixa();
    expect(await biparNoCaixa("7890000000999")).toBe(true);
    expect(st.pendingProduct).toBeNull();
    expect(carrinho()).toEqual([expect.objectContaining({ productId: "p2", qty: 1 })]);
    expect(textoDaTela()).not.toContain("Qual variante?");
    expect(mockVariants).not.toHaveBeenCalled();
  });

  it("SKU de produto sem variante ativa: consulta, não acha tamanho e entra direto", async () => {
    mockVariants.mockImplementation(() => Promise.resolve({ variants: [] }));
    mockScan.mockImplementation(() => Promise.resolve({ match: "exact", source: "sku", product: { id: "p2", name: "Meia soquete", price: 19.9 } }));
    await abrirCaixa();
    expect(await biparNoCaixa("MEIA-01")).toBe(true);
    expect(st.pendingProduct).toBeNull();
    expect(carrinho()).toEqual([expect.objectContaining({ productId: "p2", qty: 1 })]);
  });
});

// ── Troca (Step3NewItems): mesmo caso ────────────────────────────────────────
const onChangeEntries = jest.fn();
async function abrirTroca() {
  onChangeEntries.mockClear();
  await act(async () => {
    root.render(
      <Step3NewItems products={[]} newEntries={[]} onChangeEntries={onChangeEntries}
        returnedValue={249.99} newValue={0} netAmount={-249.99} />,
    );
  });
}
async function biparNaTroca(code: string) {
  const input = document.querySelector('input[placeholder="Bipe o código de barras…"]') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(() => { setter.call(input, code); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await Promise.resolve(); await Promise.resolve();
  });
  await esperar();
}

describe("Troca · bipe achado no servidor, produto fora da lista local", () => {
  it("código do pai, com variante ativa: abre o seletor sem nada marcado e não lança nada sozinho", async () => {
    mockScan.mockImplementation(() => Promise.resolve({
      match: "exact", source: "barcode", product: { ...PAI, variants: VARIANTES },
    }));
    await abrirTroca();
    await biparNaTroca(CODIGO_DO_PAI);
    expect(onChangeEntries).not.toHaveBeenCalled();
    expect(textoDaTela()).toContain("Qual variante?");
    expect(linhas()).toEqual(["v38", "v39", "v40"]);
    expect(marcada()).toBeNull();
    await act(() => { (document.querySelector('[data-testid="variante-v39"]') as HTMLElement).click(); });
    expect(onChangeEntries).toHaveBeenCalledWith([
      expect.objectContaining({ product_id: "p1", variant_id: "v39", quantity: 1, unit_price: 249.99 }),
    ]);
  });

  it("SKU do pai, com variante ativa: consulta as variantes e abre o seletor", async () => {
    mockScan.mockImplementation(() => Promise.resolve({ match: "exact", source: "sku", product: { ...PAI } }));
    await abrirTroca();
    await biparNaTroca(SKU_DO_PAI);
    expect(mockVariants).toHaveBeenCalledWith("co-1", "p1");
    expect(onChangeEntries).not.toHaveBeenCalled();
    expect(textoDaTela()).toContain("Qual variante?");
  });

  it("código de um tamanho: entra com o variant_id (caminho de antes, sem mudança)", async () => {
    mockScan.mockImplementation(() => Promise.resolve({
      match: "exact", source: "variant_barcode", variant_id: "v40", effective_price: 249.99,
      product: { ...PAI, variant_id: "v40", sku_suffix: "40" },
    }));
    await abrirTroca();
    await biparNaTroca(CODIGO_DO_40);
    expect(onChangeEntries).toHaveBeenCalledWith([
      expect.objectContaining({ product_id: "p1", variant_id: "v40", quantity: 1 }),
    ]);
  });

  it("produto sem variante ativa: segue entrando direto", async () => {
    mockScan.mockImplementation(() => Promise.resolve({
      match: "exact", source: "barcode", product: { id: "p2", name: "Meia soquete", price: 19.9, variants: [] },
    }));
    await abrirTroca();
    await biparNaTroca("7890000000999");
    expect(onChangeEntries).toHaveBeenCalledWith([
      expect.objectContaining({ product_id: "p2", variant_id: null, quantity: 1, unit_price: 19.9 }),
    ]);
    expect(textoDaTela()).not.toContain("Qual variante?");
  });
});
