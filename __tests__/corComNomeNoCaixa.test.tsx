// tq-55 (26/10/2026): no Caixa, a cor aparece com o nome que a lojista deu
// ("Off", "Militar"), lido do sku_suffix, em vez do nome da paleta. Duas
// cores do mesmo produto não saem mais com o mesmo nome.
import React from "react";
import { nomeProprioDaCor, nomeDaCorDaVariante } from "@/utils/nomeDaCor";
import { hexToName } from "@/utils/colorNames";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => Root };
type Root = { render: (n: React.ReactNode) => void; unmount: () => void };
const act = (React as any).act as (fn: () => void | Promise<void>) => Promise<void>;

jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "co-1" } }),
}));

const cor = (hex: string) => ({ attribute: "Cor", value: hex });
const tam = (t: string) => ({ attribute: "Tamanho", value: t });
// Como o Leibert (19/10): Off e Branco são duas cores quase brancas.
const VARIANTES = [
  { id: "vOffP", sku_suffix: "OFF-P", stock_qty: "3", barcode: null, is_active: true, attributes: [cor("#F4F1EA"), tam("P")] },
  { id: "vBrP", sku_suffix: "BRANCO-P", stock_qty: "2", barcode: null, is_active: true, attributes: [cor("#FFFFFF"), tam("P")] },
  { id: "vMil", sku_suffix: "MILITAR-M", stock_qty: "1", barcode: null, is_active: true, attributes: [cor("#4B5320"), tam("M")] },
  { id: "vHex", sku_suffix: "3B82F6-G", stock_qty: "1", barcode: null, is_active: true, attributes: [cor("#3B82F6"), tam("G")] },
  // tq-55b: gravada depois da 414, com o nome inteiro (10+ letras).
  { id: "vPet", sku_suffix: "AZUL PETRÓ-GG", color_name: "Azul petróleo", stock_qty: "1", barcode: null, is_active: true, attributes: [cor("#1F5F6B"), tam("GG")] },
];
const mockVariants = jest.fn((..._a: any[]) => Promise.resolve({ variants: VARIANTES }));
jest.mock("@/services/api", () => ({
  companiesApi: { variants: (...a: any[]) => mockVariants(...a) },
}));

import { VariantPickerModal } from "@/components/VariantPickerModal";

describe("nomeProprioDaCor", () => {
  it("lê o nome do sufixo e escreve em caixa de frase", () => {
    expect(nomeProprioDaCor("PASSION-M", "#8E1B3A", "M")).toBe("Passion");
    expect(nomeProprioDaCor("OFF WHITE", "#F4F1EA")).toBe("Off white");
    expect(nomeProprioDaCor("CAFÉ-38", "#6F4E37", "38")).toBe("Café");
    expect(nomeProprioDaCor("OFF-WHITE-GG", "#F4F1EA", "GG")).toBe("Off-white");
  });

  it("o nome igual ao da paleta fica com a grafia da paleta", () => {
    expect(nomeProprioDaCor("BRANCO-P", "#FFFFFF", "P")).toBeNull();
    expect(nomeProprioDaCor("VERDE AGUA", "#8BE8B3")).toBeNull();
  });

  it("não adivinha: sufixo sem nome, cortado ou em outro formato dá null", () => {
    expect(nomeProprioDaCor("3B82F6-G", "#3B82F6", "G")).toBeNull();   // sem nome: o hex
    expect(nomeProprioDaCor("FFFFFF", "#FFFFFF")).toBeNull();            // hex só com letras
    expect(nomeProprioDaCor("FFFFF-P", "#FFFFFF", "P")).toBeNull();      // lote antigo (5 do hex)
    expect(nomeProprioDaCor("P-FFFFF", "#FFFFFF", "P")).toBeNull();      // tamanho antes da cor
    expect(nomeProprioDaCor("AZUL PETRÓ-M", "#1F5F6B", "M")).toBeNull(); // 10 letras: pode ter sido cortado
    expect(nomeProprioDaCor("V3", "#000000")).toBeNull();
    expect(nomeProprioDaCor("Passion", "#8E1B3A")).toBeNull();           // não é o formato do backend
    expect(nomeProprioDaCor(null, "#8E1B3A")).toBeNull();
    expect(nomeProprioDaCor("PASSION", "vermelho")).toBeNull();          // cor não é hex
  });

  it("sem nome próprio, nomeDaCorDaVariante devolve o da paleta", () => {
    expect(nomeDaCorDaVariante({ sku_suffix: "3B82F6", attributes: [cor("#3B82F6")] }, "#3B82F6")).toBe(hexToName("#3B82F6"));
    expect(nomeDaCorDaVariante({ sku_suffix: "UVA-G", attributes: [cor("#5B2A4E"), tam("G")] }, "#5B2A4E")).toBe("Uva");
  });
});

describe("VariantPickerModal (Caixa)", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(() => { root.unmount(); });
    host.remove();
  });

  it("mostra o nome da lojista e manda ele no rótulo do item do carrinho", async () => {
    const onSelect = jest.fn();
    await act(async () => {
      root.render(<VariantPickerModal visible product={{ id: "p1", name: "Legging Fit", price: 89.9 }} onSelect={onSelect} onClose={jest.fn()} />);
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const linha = (id: string) => document.querySelector(`[data-testid="variante-${id}"]`) as HTMLElement;

    expect(linha("vOffP").textContent).toContain("Off · P");
    expect(linha("vBrP").textContent).toContain("Branco · P");
    expect(linha("vMil").textContent).toContain("Militar · M");
    expect(linha("vHex").textContent).toContain(hexToName("#3B82F6") + " · G");
    expect(linha("vPet").textContent).toContain("Azul petróleo · GG");

    await act(() => { linha("vOffP").click(); });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "vOffP", label: "Off · P" }));
  });
});

// tq-55b (26/10/2026): o backend grava o nome da cor (migration 414) e o GET
// /products/:pid/variants devolve color_name. Ordem: color_name → sufixo →
// paleta.
describe("nomeDaCorDaVariante com color_name (tq-55b)", () => {
  it("color_name vem primeiro, com a grafia da lojista e sem o corte de 10", () => {
    expect(nomeDaCorDaVariante({ sku_suffix: "AZUL PETRÓ-M", color_name: "Azul petróleo", attributes: [cor("#1F5F6B"), tam("M")] }, "#1F5F6B"))
      .toBe("Azul petróleo");
    expect(nomeDaCorDaVariante({ sku_suffix: "OFF-P", color_name: "  off white ", attributes: [cor("#F4F1EA"), tam("P")] }, "#F4F1EA"))
      .toBe("off white");
    // mesmo quando é igual ao nome da paleta: é o nome que a lojista deu
    expect(nomeDaCorDaVariante({ sku_suffix: "BRANCO-P", color_name: "Branco", attributes: [cor("#FFFFFF"), tam("P")] }, "#FFFFFF"))
      .toBe("Branco");
  });

  it("sem color_name (variante antiga), vazio ou hex: segue o sufixo e depois a paleta, como antes", () => {
    expect(nomeDaCorDaVariante({ sku_suffix: "UVA-G", color_name: null, attributes: [cor("#5B2A4E"), tam("G")] }, "#5B2A4E")).toBe("Uva");
    expect(nomeDaCorDaVariante({ sku_suffix: "UVA-G", color_name: "   ", attributes: [cor("#5B2A4E"), tam("G")] }, "#5B2A4E")).toBe("Uva");
    expect(nomeDaCorDaVariante({ sku_suffix: "UVA-G", color_name: "#5B2A4E", attributes: [cor("#5B2A4E"), tam("G")] }, "#5B2A4E")).toBe("Uva");
    expect(nomeDaCorDaVariante({ sku_suffix: "AZUL PETRÓ-M", attributes: [cor("#1F5F6B"), tam("M")] }, "#1F5F6B")).toBe(hexToName("#1F5F6B"));
  });
});
