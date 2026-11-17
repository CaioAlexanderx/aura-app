// 17/11/2026 (p-150) — variações em cache no seletor de cor e tamanho. A
// segunda abertura do mesmo produto mostra a lista na hora e busca de novo
// por trás; a atualização de trás corrige estoque sem desmarcar o tamanho.
import React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => Root };
type Root = { render: (n: React.ReactNode) => void; unmount: () => void };
const act = (React as any).act as (fn: () => void | Promise<void>) => Promise<void>;

jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "co-1" } }),
}));

const VARIANTES = [
  { id: "v38", sku_suffix: "38", stock_qty: "0", barcode: "7900123206378", is_active: true },
  { id: "v39", sku_suffix: "39", stock_qty: "3", barcode: "7900123206385", is_active: true },
  { id: "v40", sku_suffix: "40", stock_qty: "1", barcode: "7900123206392", is_active: true },
  { id: "v41", sku_suffix: "41", stock_qty: "2", barcode: null, is_active: true },
  { id: "vOff", sku_suffix: "42", stock_qty: "9", barcode: "7900000000001", is_active: false },
];
const mockVariants = jest.fn((..._a: any[]) => Promise.resolve({ variants: VARIANTES }));
jest.mock("@/services/api", () => ({
  companiesApi: { variants: (...a: any[]) => mockVariants(...a) },
}));

import { VariantPickerModal, ENTER_LIBERADO_APOS_MS } from "@/components/VariantPickerModal";
import { esquecerVariacoes } from "@/utils/cacheDeVariacoes";

const PRODUTO = { id: "p1", name: "Vizzano Tênis Samba 1430", price: 249.99 };

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
  onSelect.mockClear(); onClose.mockClear(); onScanAgain.mockClear(); mockVariants.mockClear();
  esquecerVariacoes();
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

async function abrir(props: Record<string, any> = {}) {
  await act(async () => {
    root.render(
      <VariantPickerModal visible product={PRODUTO} onSelect={onSelect} onClose={onClose}
        keyboard onScanAgain={onScanAgain} {...props} />,
    );
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

const linha = (id: string) => document.querySelector(`[data-testid="variante-${id}"]`) as HTMLElement | null;
const marcada = () => {
  const el = document.querySelector('[data-testid^="variante-"][aria-selected="true"]');
  return el ? el.getAttribute("data-testid")!.replace("variante-", "") : null;
};

let ts = 10_000;
async function tecla(key: string, passoMs = 300) {
  ts += passoMs;
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  Object.defineProperty(ev, "timeStamp", { value: ts });
  let passou = true;
  await act(() => { passou = document.body.dispatchEvent(ev); });
  return passou;
}
async function bipar(code: string, fim: "Enter" | null = "Enter") {
  ts += 1000;
  for (const ch of code) await tecla(ch, 8);
  if (fim) await tecla(fim, 8);
}
const liberarEnter = () => { relogio += ENTER_LIBERADO_APOS_MS + 1; };

async function fechar() {
  await act(async () => {
    root.render(<VariantPickerModal visible={false} product={PRODUTO} onSelect={onSelect} onClose={onClose} keyboard onScanAgain={onScanAgain} />);
  });
}

describe("seletor de variante · cache (p-150)", () => {
  it("segunda abertura: lista na hora, antes da resposta do servidor", async () => {
    await abrir();
    expect(linha("v39")).not.toBeNull();
    await fechar();
    let soltar: (v: any) => void = () => {};
    mockVariants.mockImplementationOnce(() => new Promise((r) => { soltar = r; }));
    await act(async () => {
      root.render(<VariantPickerModal visible product={PRODUTO} onSelect={onSelect} onClose={onClose} keyboard onScanAgain={onScanAgain} />);
    });
    // a busca de trás ainda não voltou e a lista já está na tela
    expect(linha("v39")).not.toBeNull();
    expect(mockVariants).toHaveBeenCalledTimes(2);
    await act(async () => { soltar({ variants: VARIANTES }); await Promise.resolve(); });
  });

  it("a atualização de trás corrige o estoque sem desmarcar o tamanho escolhido nas setas", async () => {
    await abrir({ preselectVariantId: "v39" });
    await fechar();
    let soltar: (v: any) => void = () => {};
    mockVariants.mockImplementationOnce(() => new Promise((r) => { soltar = r; }));
    await act(async () => {
      root.render(<VariantPickerModal visible product={PRODUTO} onSelect={onSelect} onClose={onClose} keyboard onScanAgain={onScanAgain} preselectVariantId="v39" />);
    });
    expect(marcada()).toBe("v39");
    liberarEnter();
    await tecla("ArrowDown");
    expect(marcada()).toBe("v40");
    const novas = VARIANTES.map((v) => (v.id === "v40" ? { ...v, stock_qty: "7" } : v));
    await act(async () => { soltar({ variants: novas }); await Promise.resolve(); await Promise.resolve(); });
    expect(marcada()).toBe("v40");
    liberarEnter();
    await tecla("Enter");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "v40", stock: 7 }));
  });

  it("sem rede na segunda abertura: fica a lista do cache", async () => {
    await abrir();
    await fechar();
    mockVariants.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    await abrir();
    expect(linha("v39")).not.toBeNull();
  });
});
