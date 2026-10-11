// 11/10/2026 — o bipe confirma o tamanho. O Caixa lançava direto a variante
// do código bipado, sem dar chance de conferir. Agora o seletor abre com o
// tamanho bipado já marcado e os outros à vista: Enter confirma, setas
// trocam, e um bipe novo com o seletor aberto confirma e segue.
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

describe("seletor de variante · tamanho bipado", () => {
  it("abre com a variante do servidor marcada e com o selo Bipado; as outras continuam à vista", async () => {
    await abrir({ preselectVariantId: "v39" });
    expect(marcada()).toBe("v39");
    expect(linha("v39")!.textContent).toContain("Bipado");
    expect(linha("v38")).not.toBeNull();
    expect(linha("v40")).not.toBeNull();
    expect(linha("v40")!.textContent).not.toContain("Bipado");
    expect(linha("vOff")).toBeNull(); // inativa não aparece
    expect(onSelect).not.toHaveBeenCalled(); // nada entra no carrinho sozinho
  });

  it("sem o id, marca pela variante que tem o código de barras bipado", async () => {
    await abrir({ preselectBarcode: "7900123206392" });
    expect(marcada()).toBe("v40");
  });

  it("código que é só do produto pai: abre sem nada marcado e o Enter não escolhe por ninguém", async () => {
    await abrir({ preselectBarcode: "7900294991813" });
    expect(marcada()).toBeNull();
    liberarEnter();
    await tecla("Enter");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("Enter confirma o tamanho bipado, com rótulo, preço e estoque certos", async () => {
    await abrir({ preselectVariantId: "v39" });
    liberarEnter();
    const passou = await tecla("Enter");
    expect(passou).toBe(false); // o Enter não vaza para o botão que ficou atrás
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ id: "v39", label: "39", price: 249.99, stock: 3, barcode: "7900123206385" });
  });

  it("o segundo Enter do próprio leitor (CR+LF) não confirma sozinho", async () => {
    await abrir({ preselectVariantId: "v39" });
    await tecla("Enter"); // chega colado na abertura
    expect(onSelect).not.toHaveBeenCalled();
    liberarEnter();
    await tecla("Enter");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("setas trocam o tamanho antes de confirmar", async () => {
    await abrir({ preselectVariantId: "v39" });
    liberarEnter();
    await tecla("ArrowDown");
    expect(marcada()).toBe("v40");
    expect(linha("v39")!.textContent).toContain("Bipado"); // o selo fica no que foi bipado
    await tecla("ArrowUp");
    await tecla("ArrowUp");
    expect(marcada()).toBe("v38");
    await tecla("ArrowUp"); // já é o primeiro: fica
    expect(marcada()).toBe("v38");
    await tecla("ArrowDown");
    await tecla("ArrowDown");
    await tecla("Enter");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "v40", label: "40" }));
  });

  it("clicar em outro tamanho continua valendo", async () => {
    await abrir({ preselectVariantId: "v39" });
    await act(() => { linha("v41")!.click(); });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "v41" }));
  });

  it("bipe novo com o seletor aberto: confirma o marcado e manda o código novo adiante", async () => {
    await abrir({ preselectVariantId: "v39" });
    liberarEnter();
    await bipar("7891234567895");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "v39" }));
    expect(onScanAgain).toHaveBeenCalledTimes(1);
    expect(onScanAgain).toHaveBeenCalledWith("7891234567895");
  });

  it("bipe novo de leitor sem Enter também segue", async () => {
    await abrir({ preselectVariantId: "v39" });
    liberarEnter();
    await bipar("7891234567895", null);
    expect(onSelect).not.toHaveBeenCalled();
    await act(() => { jest.advanceTimersByTime(300); });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "v39" }));
    expect(onScanAgain).toHaveBeenCalledWith("7891234567895");
  });

  it("bipe novo sem nada marcado não decide por ninguém", async () => {
    await abrir({});
    liberarEnter();
    await bipar("7891234567895");
    expect(onSelect).not.toHaveBeenCalled();
    expect(onScanAgain).not.toHaveBeenCalled();
  });

  it("sem `keyboard` (Troca, venda retroativa) o teclado não faz nada e não há rodapé", async () => {
    await abrir({ preselectVariantId: "v39", keyboard: false });
    expect(marcada()).toBe("v39"); // a marcação é só visual
    liberarEnter();
    const passou = await tecla("Enter");
    expect(passou).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("Enter confirma");
  });

  it("com blockOutOfStock, tamanho esgotado não vem marcado nem entra pelas setas", async () => {
    await abrir({ preselectVariantId: "v38", blockOutOfStock: true });
    expect(marcada()).toBeNull();
    liberarEnter();
    await tecla("ArrowDown");
    expect(marcada()).toBe("v39"); // pula o 38 esgotado
    await tecla("ArrowUp");
    expect(marcada()).toBe("v39");
  });
});
