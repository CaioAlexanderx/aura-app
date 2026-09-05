// ============================================================
// As decisões da rodada 1 (04/09/2026)
//
// Depois do QA, o Caio decidiu catorze pontos. Este arquivo guarda as
// regras puras que nasceram de sete deles — o que dá para testar sem
// tela, e que por isso fica em módulo.
// ============================================================
import { precoNoPix } from "@/components/studio/storefront/precoNoPix";
import {
  mensagemDoCarrinho, linkDoOrcamentoDoCarrinho,
} from "@/components/studio/storefront/pedidoPeloWhatsApp";
import { versoAtivo, versoPreenchido } from "@/components/studio/storefront/versoDoPedido";
import { fraseDoPrazo } from "@/components/studio/storefront/loteDaVitrine";
import { itensDaFaixa } from "@/components/studio/precisaDeVoce";

// ── Decisão 2: preço no Pix em todo cartão ──────────────────────────────
describe("o preço no Pix, no cartão", () => {
  test("é a mesma conta do checkout, numa unidade", () => {
    // checkout: Math.round(subtotal * pct) / 100 → para 1 un de 39,90 a 10%
    expect(precoNoPix(39.9, 10)).toBe(35.91);
  });

  test("sem desconto, não há linha — '0%' seria ruído", () => {
    expect(precoNoPix(39.9, 0)).toBeNull();
    expect(precoNoPix(39.9, null)).toBeNull();
    expect(precoNoPix(39.9, undefined)).toBeNull();
  });

  test("preço inválido não vira Pix de graça", () => {
    expect(precoNoPix(0, 10)).toBeNull();
    expect(precoNoPix(NaN, 10)).toBeNull();
  });
});

// ── Decisão 8: orçamento do carrinho, apartado do checkout ─────────────
describe("o orçamento do carrinho inteiro", () => {
  const produto = (name: string, price: number, fields: any[] = []) => ({
    id: name, name, price, description: null, image_url: null, stock_qty: 1,
    category: null, templates: [], customization_config: fields.length ? { fields } : null,
  } as any);
  const linhas = [
    { lineId: "1", qty: 2, product: produto("CANECA BRANCA", 39.9, [{ id: "f1", type: "text", label: "Nome" }]), values: { f1: "Vovó" } },
    { lineId: "2", qty: 1, product: produto("CANECA CHOPP", 70), values: {} },
  ];

  test("leva cada peça, com quantidade e personalização", () => {
    const m = mensagemDoCarrinho({ linhas, nomeDaLoja: "Ateliê" });
    expect(m).toContain("*CANECA BRANCA* × 2");
    expect(m).toContain("Nome: Vovó");
    expect(m).toContain("*CANECA CHOPP* × 1");
  });

  test("a estimativa é pelo preço de tabela, e diz isso", () => {
    const m = mensagemDoCarrinho({ linhas });
    expect(m).toContain("Estimativa pelo preço de tabela: R$ 149,80");
  });

  test("carrinho vazio ou loja sem WhatsApp: sem botão", () => {
    expect(linkDoOrcamentoDoCarrinho({ numero: "12996145447", linhas: [] })).toBeNull();
    expect(linkDoOrcamentoDoCarrinho({ numero: null, linhas })).toBeNull();
  });

  test("com número, o link vai codificado", () => {
    const l = linkDoOrcamentoDoCarrinho({ numero: "(12) 99614-5447", linhas })!;
    expect(l).toContain("https://wa.me/5512996145447?text=");
    expect(l).not.toContain("\n");
  });
});

// ── Decisão 9: o verso só existe quando escolhido E preenchido ─────────
describe("o verso vai para a produção?", () => {
  const cfg = (over: any = {}) => ({
    has_back: true,
    back_charge_enabled: false,
    fields: [
      { id: "frente", type: "text", side: "front" },
      { id: "verso", type: "text", side: "back" },
    ],
    ...over,
  } as any);

  test("verso incluso no preço e NADA preenchido: não vai", () => {
    // Era o "Personalizar o verso: Sim" em todo pedido — a ficha mandava
    // prensar um verso que a cliente nunca tocou.
    expect(versoAtivo(cfg(), undefined, { frente: "Ana" })).toBe(false);
  });

  test("verso incluso e preenchido: vai", () => {
    expect(versoAtivo(cfg(), undefined, { frente: "Ana", verso: "2026" })).toBe(true);
  });

  test("verso cobrado à parte exige a chave ligada, mesmo preenchido", () => {
    const c = cfg({ back_charge_enabled: true });
    expect(versoAtivo(c, false, { verso: "2026" })).toBe(false);
    expect(versoAtivo(c, true, { verso: "2026" })).toBe(true);
  });

  test("chave ligada mas verso vazio: não vai", () => {
    expect(versoAtivo(cfg({ back_charge_enabled: true }), true, { frente: "Ana" })).toBe(false);
  });

  test("peça sem verso nunca tem verso", () => {
    expect(versoAtivo(cfg({ has_back: false }), true, { verso: "x" })).toBe(false);
  });

  test("espaço em branco não conta como preenchido", () => {
    expect(versoPreenchido(cfg(), { verso: "   " })).toBe(false);
    expect(versoPreenchido(cfg(), { verso: null })).toBe(false);
  });
});

// ── Decisão 13: o prazo do lote é da lojista ───────────────────────────
describe("a frase do prazo no lote", () => {
  test("com prazo declarado, diz o número", () => {
    expect(fraseDoPrazo(5)).toBe("Prazo estimado: 5 dias úteis.");
    expect(fraseDoPrazo(1)).toBe("Prazo estimado: 1 dia útil.");
  });

  test("sem prazo, diz que a loja informa — não inventa", () => {
    expect(fraseDoPrazo(null)).toMatch(/a loja informa/);
    expect(fraseDoPrazo(undefined)).toMatch(/a loja informa/);
    expect(fraseDoPrazo(0)).toMatch(/a loja informa/);
  });
});

// ── Decisão 6: a faixa "precisa de você" ───────────────────────────────
describe("a faixa acima dos KPIs", () => {
  test("zero pendências, zero faixa", () => {
    expect(itensDaFaixa({ artes_aguardando_cliente: 0, pedidos_nao_pagos: 0, orcamentos_novos: 0 })).toEqual([]);
    expect(itensDaFaixa(null)).toEqual([]);
  });

  test("a ordem é a do dia dela: orçamento, pagamento, arte", () => {
    const i = itensDaFaixa({ artes_aguardando_cliente: 2, pedidos_nao_pagos: 1, orcamentos_novos: 3 });
    expect(i.map((x) => x.texto)).toEqual([
      "3 orçamentos novos esperando resposta",
      "1 pedido aguardando pagamento",
      "2 artes esperando a cliente aprovar",
    ]);
  });

  test("arte esperando a CLIENTE não é urgente para a lojista", () => {
    const i = itensDaFaixa({ artes_aguardando_cliente: 1 });
    expect(i[0].urgente).toBe(false);
    expect(i[0].rota).toBe("/studio/producao");
  });
});

// ── As telas estão ligadas ─────────────────────────────────────────────
describe("as telas", () => {
  const fs = require("fs");
  const path = require("path");
  const RAIZ = path.join(__dirname, "..");
  const le = (rel: string) => fs.readFileSync(path.join(RAIZ, rel), "utf8");

  test("os dois cartões da vitrine e a grade mostram o Pix", () => {
    expect((le("components/studio/storefront/ProductList.tsx").match(/precoPix=\{precoNoPix\(/g) || []).length).toBe(2);
    expect(le("components/studio/storefront/GradeDeModelos.tsx")).toContain("precoPix={precoNoPix(");
    expect(le("components/studio/storefront/ProductCard.tsx")).toContain("no Pix");
  });

  test("a barra do carrinho tem o orçamento, pequeno e apartado", () => {
    const cart = le("components/studio/storefront/Cart.tsx");
    expect(cart).toContain("linkDoOrcamentoDoCarrinho({");
    expect(cart).toContain("Finalizar →");
  });

  test("o pedido manda o verso pela regra nova", () => {
    expect(le("components/studio/storefront/useStorefront.ts")).toContain("const backActive = versoAtivo(");
  });

  test("min_dpi saiu do padrão do campo de imagem (decisão 4)", () => {
    expect(le("components/studio/customizationConfig.ts")).not.toMatch(/min_dpi:\s*IMAGE_MIN_DPI_PADRAO/);
  });

  test("a faixa de tiragem tem o prazo (decisão 13)", () => {
    const p = le("app/studio/(estudio)/configuracoes/precificacao.tsx");
    expect(p).toContain("lead_days");
    expect(p).toContain("Prazo desta tiragem");
  });

  test("o Início tem a faixa de pendências (decisão 6)", () => {
    expect(le("app/studio/(estudio)/index.tsx")).toContain("itensDaFaixa(painel?.precisa_de_voce)");
  });
});
