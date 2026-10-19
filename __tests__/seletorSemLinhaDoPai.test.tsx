// 19/10/2026 — INC-2026-10-19-01. O seletor "Qual variante?" mostrava a
// linha do produto pai ("Sem variante específica") sempre que o estoque do
// pai era > 0. Vender por ela baixava products.stock_qty e nenhum tamanho,
// e Caixa, Estoque e Painel mostram a soma das variantes: a peça vendida
// continuava "disponível". Regra (Produto): com variante ativa, sem linha do
// pai. Estes testes cobrem o Caixa (teclado, bipe) e a Troca (Step3NewItems),
// que usam o mesmo componente.
import React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => Root };
type Root = { render: (n: React.ReactNode) => void; unmount: () => void };
const act = (React as any).act as (fn: () => void | Promise<void>) => Promise<void>;

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(() => ({ company: { id: "co-1" } }), { getState: () => ({ company: { id: "co-1" } }) }),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, invalidate: jest.fn() }) }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

// Davi Calçados (app#1042): o código do pai é o de etiqueta do produto, e
// nenhum tamanho tem esse código — o bipe abre o seletor sem nada marcado.
const CODIGO_DO_PAI = "7900294991813";
const VARIANTES = [
  { id: "v38", sku_suffix: "38", stock_qty: "0", barcode: "7900123206378", is_active: true },
  { id: "v39", sku_suffix: "39", stock_qty: "3", barcode: "7900123206385", is_active: true },
  { id: "v40", sku_suffix: "40", stock_qty: "1", barcode: "7900123206392", is_active: true },
  { id: "vOff", sku_suffix: "42", stock_qty: "9", barcode: "7900000000001", is_active: false },
];
const SO_INATIVAS = [
  { id: "x1", sku_suffix: "38", stock_qty: "4", barcode: "7900000000201", is_active: false },
  { id: "x2", sku_suffix: "39", stock_qty: "4", barcode: "7900000000202", is_active: false },
];
const mockVariants = jest.fn((..._a: any[]) => Promise.resolve({ variants: VARIANTES as any[] }));
jest.mock("@/services/api", () => ({
  companiesApi: { variants: (...a: any[]) => mockVariants(...a) },
}));
const mockScan = jest.fn((..._a: any[]) => Promise.resolve({} as any));
jest.mock("@/services/pdvApi", () => ({
  pdvApi: { scan: (...a: any[]) => mockScan(...a) },
}));

import { VariantPickerModal, ENTER_LIBERADO_APOS_MS } from "@/components/VariantPickerModal";
import { Step3NewItems } from "@/components/screens/pdv/troca/Step3NewItems";

// Estoque do pai > 0: no Caixa é a soma das variantes (useProducts), na
// Troca é o stock_qty cru. Nos dois casos a linha aparecia.
const PRODUTO = { id: "p1", name: "Vizzano Tênis Samba 1430", price: 249.99, stock: 4 };

let host: HTMLDivElement;
let root: Root;
let relogio = 1_000_000;
const onSelect = jest.fn();
const onClose = jest.fn();
const onScanAgain = jest.fn();

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  relogio = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => relogio);
  onSelect.mockClear(); onClose.mockClear(); onScanAgain.mockClear();
  mockVariants.mockClear(); mockScan.mockClear();
  mockVariants.mockImplementation(() => Promise.resolve({ variants: VARIANTES as any[] }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => { root.unmount(); });
  host.remove();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function esperarVariantes() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}
async function abrirNoCaixa(props: Record<string, any> = {}) {
  await act(async () => {
    root.render(
      <VariantPickerModal visible product={PRODUTO} onSelect={onSelect} onClose={onClose}
        keyboard onScanAgain={onScanAgain} {...props} />,
    );
  });
  await esperarVariantes();
}

const linhaDoPai = () => document.querySelector('[data-testid="variante-do-pai"]');
const linhas = () =>
  Array.from(document.querySelectorAll('[data-testid^="variante-"]')).map((el) =>
    el.getAttribute("data-testid")!.replace("variante-", ""));
const marcada = () => {
  const el = document.querySelector('[data-testid^="variante-"][aria-selected="true"]');
  return el ? el.getAttribute("data-testid")!.replace("variante-", "") : null;
};
const textoDaTela = () => document.body.textContent || "";

let ts = 10_000;
async function tecla(key: string, passoMs = 300) {
  ts += passoMs;
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  Object.defineProperty(ev, "timeStamp", { value: ts });
  await act(() => { document.body.dispatchEvent(ev); });
}
async function bipar(code: string) {
  ts += 1000;
  for (const ch of code) await tecla(ch, 8);
  await tecla("Enter", 8);
}
const liberarEnter = () => { relogio += ENTER_LIBERADO_APOS_MS + 1; };
/** Nenhuma escolha que chegou ao Caixa foi o pai (id ""). */
const nenhumaEscolhaDoPai = () =>
  onSelect.mock.calls.every((c) => c[0] && typeof c[0].id === "string" && c[0].id !== "");

describe("Caixa · seletor sem a linha do pai", () => {
  it("produto com variante ativa e estoque do pai > 0: só os tamanhos, sem a linha do pai", async () => {
    await abrirNoCaixa();
    expect(linhas()).toEqual(["v38", "v39", "v40"]);
    expect(linhaDoPai()).toBeNull();
    expect(textoDaTela()).not.toContain("Sem variante específica");
    expect(textoDaTela()).not.toContain("genérico");
  });

  it("pai com cor e tamanho próprios também não ganha linha (o rótulo era a cor · tamanho do pai)", async () => {
    await abrirNoCaixa({ product: { ...PRODUTO, color: "#000000", size: "U" } });
    expect(linhaDoPai()).toBeNull();
    expect(textoDaTela()).not.toContain("estoque do produto pai");
    expect(linhas()).toEqual(["v38", "v39", "v40"]);
  });

  it("produto sem variante ativa segue como antes: aviso de vazio e nada para escolher", async () => {
    mockVariants.mockImplementation(() => Promise.resolve({ variants: SO_INATIVAS as any[] }));
    await abrirNoCaixa();
    expect(textoDaTela()).toContain("Nenhuma variante ativa encontrada");
    expect(linhas()).toEqual([]);
    liberarEnter();
    await tecla("ArrowDown");
    await tecla("Enter");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("bipe com o código só do pai: abre sem nada marcado e não confirma sem escolha", async () => {
    await abrirNoCaixa({ preselectBarcode: CODIGO_DO_PAI });
    expect(linhaDoPai()).toBeNull();
    expect(linhas()).toEqual(["v38", "v39", "v40"]);
    expect(marcada()).toBeNull();
    expect(textoDaTela()).toContain("↑ ↓ escolhe · Enter confirma");
    liberarEnter();
    await tecla("Enter");
    expect(onSelect).not.toHaveBeenCalled();
    // O bipe seguinte, sem nada marcado, não decide por ninguém.
    await bipar("7891234567895");
    expect(onSelect).not.toHaveBeenCalled();
    expect(onScanAgain).not.toHaveBeenCalled();
  });

  it("bipe com o código só do pai: as setas escolhem um tamanho e o Enter confirma o tamanho, nunca o pai", async () => {
    await abrirNoCaixa({ preselectBarcode: CODIGO_DO_PAI });
    liberarEnter();
    await tecla("ArrowUp"); // sem nada marcado, ↑ vai para o último tamanho
    expect(marcada()).toBe("v40");
    for (let i = 0; i < 5; i++) await tecla("ArrowDown"); // não passa do último
    expect(marcada()).toBe("v40");
    await tecla("ArrowUp");
    expect(marcada()).toBe("v39");
    await tecla("Enter");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ id: "v39", label: "39", price: 249.99, stock: 3, barcode: "7900123206385" });
    expect(nenhumaEscolhaDoPai()).toBe(true);
  });

  it("bipe com o código só do pai: depois de marcar, o bipe seguinte confirma o tamanho marcado", async () => {
    await abrirNoCaixa({ preselectBarcode: CODIGO_DO_PAI });
    liberarEnter();
    await tecla("ArrowDown");
    expect(marcada()).toBe("v38");
    await bipar("7891234567895");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "v38" }));
    expect(onScanAgain).toHaveBeenCalledWith("7891234567895");
    expect(nenhumaEscolhaDoPai()).toBe(true);
  });

  it("código do pai igual ao de um tamanho (Davi, app#1042): marca esse tamanho, sem linha do pai", async () => {
    await abrirNoCaixa({ preselectBarcode: "7900123206392" });
    expect(marcada()).toBe("v40");
    expect(linhaDoPai()).toBeNull();
    liberarEnter();
    await tecla("Enter");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "v40" }));
  });
});

// ── Troca (Step3NewItems): mesmo componente, com blockOutOfStock ───────────
const PRODUTOS_DA_TROCA = [
  { id: "p1", name: "Vizzano Tênis Samba 1430", price: 249.99, stock_qty: 6, has_variants: true, barcode: CODIGO_DO_PAI },
  { id: "p2", name: "Meia soquete", price: 19.9, stock_qty: 10, has_variants: false, barcode: "7890000000999" },
];
const onChangeEntries = jest.fn();

async function abrirTroca() {
  onChangeEntries.mockClear();
  await act(async () => {
    root.render(
      <Step3NewItems products={PRODUTOS_DA_TROCA} newEntries={[]} onChangeEntries={onChangeEntries}
        returnedValue={249.99} newValue={0} netAmount={-249.99} />,
    );
  });
}
function clicarNoTexto(texto: string) {
  // O texto mais interno; o clique sobe até o Pressable do cartão.
  const alvo = Array.from(document.querySelectorAll("div")).find((el) => el.textContent === texto);
  if (!alvo) throw new Error("não achei " + texto);
  (alvo as HTMLElement).click();
}
async function biparNaTroca(code: string) {
  const input = document.querySelector('input[placeholder="Bipe o código de barras…"]') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(() => { setter.call(input, code); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await Promise.resolve(); await Promise.resolve();
  });
  await esperarVariantes();
}

describe("Troca · seletor sem a linha do pai", () => {
  it("tocar no produto com tamanhos abre o seletor sem a linha do pai, e o tamanho escolhido entra com variant_id", async () => {
    await abrirTroca();
    await act(() => { clicarNoTexto("Escolher tamanho"); });
    await esperarVariantes();
    expect(textoDaTela()).toContain("Qual variante?");
    expect(linhaDoPai()).toBeNull();
    expect(textoDaTela()).not.toContain("Sem variante específica");
    expect(linhas()).toEqual(["v38", "v39", "v40"]);
    expect(textoDaTela()).toContain("Esgotado"); // blockOutOfStock da Troca continua
    await act(() => { (document.querySelector('[data-testid="variante-v39"]') as HTMLElement).click(); });
    expect(onChangeEntries).toHaveBeenCalledTimes(1);
    expect(onChangeEntries.mock.calls[0][0]).toEqual([
      expect.objectContaining({ product_id: "p1", variant_id: "v39", quantity: 1, unit_price: 249.99 }),
    ]);
  });

  it("bipe do código do pai na Troca abre o seletor sem a linha do pai e não lança nada sozinho", async () => {
    mockScan.mockImplementation(() => Promise.resolve({ match: "exact", source: "barcode", product: { id: "p1" } }));
    await abrirTroca();
    await biparNaTroca(CODIGO_DO_PAI);
    expect(textoDaTela()).toContain("Qual variante?");
    expect(linhaDoPai()).toBeNull();
    expect(marcada()).toBeNull();
    expect(onChangeEntries).not.toHaveBeenCalled();
  });

  it("produto sem tamanho continua entrando direto na Troca", async () => {
    await abrirTroca();
    await act(() => { clicarNoTexto("Meia soquete"); });
    expect(onChangeEntries).toHaveBeenCalledWith([
      expect.objectContaining({ product_id: "p2", variant_id: null, quantity: 1 }),
    ]);
    expect(textoDaTela()).not.toContain("Qual variante?");
  });
});
