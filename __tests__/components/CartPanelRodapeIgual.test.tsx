// ============================================================
// Pedido separado de venda (A1, p-63a, 17/11/2026): o rodapé do Caixa de
// quem NÃO tem o recurso fica igual ao de antes, botão a botão.
//
// Como a prova funciona: as impressões em
// __tests__/fixtures/cartPanelRodape.json foram tiradas do CartPanel de
// origin/main ANTES do "Guardar" existir (8fe2df91, com GERAR_FIXTURE=1).
// Cada cenário renderiza o carrinho inteiro (rodapé, atalhos, cartões do
// Matcon e da Comanda) e compara o sha256 da árvore com a impressão
// gravada. Qualquer diferença de texto, testID, estilo ou ordem quebra.
//
// Cenários sem `pedido` (como antes) e com `pedido={null}` (o que o Caixa
// passa com a trava PEDIDO_LIBERADO desligada, sem o módulo, no consolidado
// ou na demonstração): os dois precisam bater com a impressão de antes.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

let mockPdvSettings: any = {};
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t", isDemo: false }),
}));
jest.mock("@/components/screens/pdv/MerchantLogo", () => ({
  MerchantLogo: () => null,
  useMerchantBrand: () => ({ logoUrl: null, name: "Loja", initial: "L" }),
}));

import { CartPanel } from "@/components/screens/pdv/CartPanel";

const FIXTURE = path.join(__dirname, "..", "fixtures", "cartPanelRodape.json");
const METODOS = [{ key: "pix", label: "PIX", icon: "dollar" }, { key: "dinheiro", label: "Dinheiro", icon: "dollar" }];
const ITEM = {
  productId: "p-vestido", productBaseId: "p-vestido",
  name: "Vestido Midi Linho", price: 189.9, qty: 1, listPrice: 189.9,
  unit: "un", purchaseUnit: null, purchaseFactor: null,
};
const fn = () => () => {};

type Cenario = { settings?: any; props: Record<string, any> };

const COMANDA = { onAdd: fn(), onList: fn(), openCount: 3, charging: null };
const CENARIOS: Record<string, Cenario> = {
  "orcamento-vazio": { props: { items: [], showOrcamento: true, onGenerateQuote: fn() } },
  "orcamento-com-item": { props: { items: [ITEM], showOrcamento: true, onGenerateQuote: fn() } },
  "orcamento-processando": { props: { items: [ITEM], showOrcamento: true, onGenerateQuote: fn(), isProcessing: true } },
  "orcamento-compacto": { props: { items: [ITEM], showOrcamento: true, onGenerateQuote: fn(), compact: true } },
  "sem-orcamento": { props: { items: [ITEM] } },
  "matcon": { settings: { matcon_enabled: true }, props: { items: [ITEM], showOrcamento: true, onGenerateQuote: fn(), onSaveQuote: fn() } },
  "matcon-salvando": { settings: { matcon_enabled: true }, props: { items: [ITEM], showOrcamento: true, onGenerateQuote: fn(), onSaveQuote: fn(), savingQuote: true } },
  "matcon-editando": { settings: { matcon_enabled: true }, props: { items: [ITEM], showOrcamento: true, onGenerateQuote: fn(), onSaveQuote: fn(), editingQuote: { number: 12, onCancel: fn() } } },
  "matcon-salvo": {
    settings: { matcon_enabled: true },
    props: {
      items: [ITEM], showOrcamento: true, onGenerateQuote: fn(), onSaveQuote: fn(),
      savedQuote: { number: 7, total: 189.9, cardTotal: null, validUntilLabel: "24/11", onSendWhatsApp: fn(), onViewEsteira: fn(), onDismiss: fn() },
    },
  },
  "comanda": { props: { items: [ITEM], showOrcamento: true, onGenerateQuote: fn(), onSaveQuote: fn(), comanda: COMANDA } },
  "comanda-vazio": { props: { items: [], showOrcamento: true, onGenerateQuote: fn(), comanda: { ...COMANDA, openCount: 0 } } },
  "comanda-compacto": { props: { items: [ITEM], showOrcamento: true, onGenerateQuote: fn(), comanda: COMANDA, compact: true } },
  "comanda-cobrando": {
    props: { items: [ITEM], showOrcamento: true, onGenerateQuote: fn(), comanda: { ...COMANDA, charging: { number: 4, name: "Mesa 4", feePct: 10, onCancel: fn() } } },
  },
  "comanda-matcon": { settings: { matcon_enabled: true }, props: { items: [ITEM], showOrcamento: true, onGenerateQuote: fn(), onSaveQuote: fn(), comanda: COMANDA } },
};

function impressao(c: Cenario, extra: Record<string, any> = {}): string {
  mockPdvSettings = c.settings || {};
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <CartPanel
        subtotal={189.9} discountAmount={0} total={189.9} itemCount={1}
        payMethods={METODOS as any} activePay="pix"
        onPay={fn()} onInc={fn()} onDec={fn()} onRemove={fn()} onClear={fn()} onFinalize={fn()}
        items={[]}
        {...c.props}
        {...extra}
      />
    );
  });
  const json = JSON.stringify(tree.toJSON());
  tree.unmount();
  mockPdvSettings = {};
  return createHash("sha256").update(json).digest("hex");
}

if (process.env.GERAR_FIXTURE === "1") {
  test("grava as impressões do rodapé de antes", () => {
    const out: Record<string, string> = {};
    for (const [nome, c] of Object.entries(CENARIOS)) out[nome] = impressao(c);
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, JSON.stringify(out, null, 2) + "\n");
    expect(Object.keys(out)).toHaveLength(Object.keys(CENARIOS).length);
  });
} else {
  const gravado: Record<string, string> = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));

  describe("rodapé do Caixa sem o Pedido: igual ao de antes", () => {
    test("todo cenário tem impressão gravada", () => {
      expect(Object.keys(gravado).sort()).toEqual(Object.keys(CENARIOS).sort());
    });
    for (const [nome, c] of Object.entries(CENARIOS)) {
      test(`${nome}: sem a prop pedido`, () => {
        expect(impressao(c)).toBe(gravado[nome]);
      });
      test(`${nome}: com pedido={null} (trava desligada ou sem o módulo)`, () => {
        expect(impressao(c, { pedido: null })).toBe(gravado[nome]);
      });
    }
  });
}
