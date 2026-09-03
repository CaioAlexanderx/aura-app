// ============================================================
// Os selos e chips do cartão (S3 · 03/09/2026)
//
// O handoff desenha quatro chips no card e três selos. Quase tudo já
// existia no payload e o cartão nunca leu.
//
// A decisão que este teste guarda com mais cuidado é a exclusão:
// "Restam N" NÃO existe na vitrine Studio. Personalizado é feito sob
// encomenda, e o `stock_qty` da Sheid é 1 a 3 por modelo porque é
// INSUMO — caneca crua na prateleira —, não peça pronta. "Restam 2" em
// toda caneca é urgência falsa, e o CDC trata isso como publicidade
// enganosa.
// ============================================================
import {
  seloDoProduto, chipsDoProduto, linhaDeEscada, pecaMaisPedida, ehNovo,
  DIAS_PARA_NOVO, PEDIDOS_PARA_MAIS_VENDIDO,
} from "@/components/studio/storefront/selosDoProduto";
import type { StudioStoreProduct } from "@/components/studio/storefront/types";

function produto(over: Partial<StudioStoreProduct> = {}): StudioStoreProduct {
  return {
    id: "p1", name: "Caneca Branca", description: null, price: 39.9,
    image_url: "https://x/f.jpg", category: null, stock_qty: 2,
    customization_config: null, templates: [], ...over,
  } as StudioStoreProduct;
}

const diasAtras = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

describe("o selo de canto", () => {
  test("no máximo um: dois viram etiqueta de liquidação sobre a peça", () => {
    const p = produto({ pedidos: 20, created_at: diasAtras(1) } as any);
    const s = seloDoProduto(p, "p1");
    expect(s).toEqual({ texto: "Mais pedido", tom: "marca" });
  });

  test("mais pedido só para a campeã da loja, e só com pedidos de verdade", () => {
    expect(seloDoProduto(produto({ pedidos: 20 }), "p1")?.texto).toBe("Mais pedido");
    // É a campeã, mas com 2 pedidos — 1 ou 2 não é recorde.
    expect(seloDoProduto(produto({ pedidos: PEDIDOS_PARA_MAIS_VENDIDO - 1 }), "p1")).toBeNull();
    // Tem pedidos, mas não é a campeã.
    expect(seloDoProduto(produto({ pedidos: 20 }), "outro")).toBeNull();
  });

  test("novo vale por 14 dias", () => {
    expect(ehNovo(diasAtras(3))).toBe(true);
    expect(ehNovo(diasAtras(DIAS_PARA_NOVO))).toBe(true);
    expect(ehNovo(diasAtras(DIAS_PARA_NOVO + 1))).toBe(false);
    expect(ehNovo(null)).toBe(false);
    expect(ehNovo("data ruim")).toBe(false);
  });

  test("peça antiga e sem pedidos não ganha selo nenhum", () => {
    expect(seloDoProduto(produto({ created_at: diasAtras(200) } as any), null)).toBeNull();
  });
});

describe('"Restam N" não existe na vitrine Studio', () => {
  test("estoque baixo não vira selo nem chip", () => {
    const p = produto({ stock_qty: 1, created_at: diasAtras(400) } as any);
    expect(seloDoProduto(p, null)).toBeNull();
    expect(JSON.stringify(chipsDoProduto(p))).not.toMatch(/[Rr]estam|[Úú]ltim|[Ee]stoque/);
  });

  test("o módulo inteiro não fala de estoque", () => {
    const fs = require("fs");
    const path = require("path");
    const fonte = fs.readFileSync(
      path.join(__dirname, "../components/studio/storefront/selosDoProduto.ts"), "utf8");
    // Só o comentário que explica a decisão pode citar stock_qty.
    const codigo = fonte.split("\n").filter((l: string) => !l.trim().startsWith("//")).join("\n");
    expect(codigo).not.toContain("stock_qty");
  });
});

describe("os chips do que dá para personalizar", () => {
  const cfg = (fields: any[], extra: any = {}) => ({ fields, ...extra });

  test("a Caneca Branca da Sheid, com a config real dela", () => {
    const p = produto({
      visual_kind: "model3d",
      customization_config: cfg(
        [{ id: "text", type: "text", config: {} },
         { id: "image", type: "image", config: {} },
         { id: "template", type: "template", config: {} },
         { id: "color", type: "color", config: {} },
         { id: "art_service", type: "option", config: { is_art_service: true } }],
        { has_back: true },
      ) as any,
    });
    expect(chipsDoProduto(p).map((c) => c.texto)).toEqual(
      ["Mockup 3D", "Frente e verso", "Escolha a cor"]);
  });

  test("no máximo três — do quarto em diante o cartão vira formulário", () => {
    const p = produto({
      visual_kind: "model3d",
      customization_config: cfg(
        [{ id: "c", type: "color" }, { id: "t", type: "text" }, { id: "i", type: "image" }],
        { has_back: true },
      ) as any,
    });
    expect(chipsDoProduto(p)).toHaveLength(3);
  });

  test("produto sem 3D e sem verso mostra o que ele tem", () => {
    const p = produto({
      customization_config: cfg([{ id: "t", type: "text" }, { id: "i", type: "image" }]) as any,
    });
    expect(chipsDoProduto(p).map((c) => c.texto)).toEqual(["Nome ou frase", "Sua arte"]);
  });

  test("o campo de briefing não conta como campo de texto", () => {
    const p = produto({
      customization_config: cfg([
        { id: "art_service_brief", type: "text", config: { is_art_service: true } },
      ]) as any,
    });
    expect(chipsDoProduto(p)).toEqual([]);
  });

  test("template 2D anuncia prévia, não mockup 3D", () => {
    expect(chipsDoProduto(produto({ visual_kind: "photo2d" }))[0].texto).toBe("Prévia da arte");
  });

  test("produto sem configuração não quebra", () => {
    expect(chipsDoProduto(produto())).toEqual([]);
    expect(chipsDoProduto(produto({ customization_config: {} as any }))).toEqual([]);
  });
});

describe("a linha de escada", () => {
  test("sem faixa configurada, não existe — que é o caso de toda loja hoje", () => {
    expect(linhaDeEscada(produto({ qty_tiers: [] }))).toBeNull();
    expect(linhaDeEscada(produto())).toBeNull();
  });

  test("uma faixa só não é escada", () => {
    expect(linhaDeEscada(produto({
      qty_tiers: [{ min_qty: 1, max_qty: null, unit_price: 39.9, discount_pct: 0 }],
    }))).toBeNull();
  });

  test("com escada, anuncia o melhor preço e a partir de quanto", () => {
    const l = linhaDeEscada(produto({
      price: 49.9,
      qty_tiers: [
        { min_qty: 1, max_qty: 9, unit_price: 49.9, discount_pct: 0 },
        { min_qty: 10, max_qty: 49, unit_price: 44.9, discount_pct: 10 },
        { min_qty: 50, max_qty: null, unit_price: 39.9, discount_pct: 20 },
      ],
    }));
    expect(l).toBe("R$ 39,90 cada 50 un ou mais");
  });

  test("faixa que não barateia nada não vira anúncio", () => {
    expect(linhaDeEscada(produto({
      price: 39.9,
      qty_tiers: [
        { min_qty: 1, max_qty: 9, unit_price: 39.9, discount_pct: 0 },
        { min_qty: 10, max_qty: null, unit_price: 39.9, discount_pct: 0 },
      ],
    }))).toBeNull();
  });
});

describe("a campeã da loja", () => {
  test("é a mais pedida, e só se tiver pedidos de sobra", () => {
    expect(pecaMaisPedida([
      produto({ id: "a", pedidos: 2 }), produto({ id: "b", pedidos: 9 }),
    ])).toBe("b");
    expect(pecaMaisPedida([produto({ id: "a", pedidos: 2 })])).toBeNull();
  });

  test("loja sem pedido nenhum não tem campeã — a Sheid de hoje", () => {
    expect(pecaMaisPedida([produto({ id: "a" }), produto({ id: "b" })])).toBeNull();
    expect(pecaMaisPedida([])).toBeNull();
  });
});
