// ============================================================
// AURA Studio — S4: os três caminhos da arte
//
// Eram dois: o cliente manda a arte pronta, ou a lojista cria do zero.
// Faltava o do meio — o cliente manda e a arte precisa ser ajustada para
// caber no produto e para as cores de impressão. Isso acontece na maioria
// dos pedidos, e a lojista absorvia o custo porque não havia onde cobrar.
//
// O motor de preço já funcionava: `art_service` é `type: 'option'` e
// computeChoicesDelta (backend e app) soma o price_delta da choice.
// Confirmado antes de escrever este item — diferente do qty_tiers (S6),
// que estava só armazenado.
//
// O caso mais importante aqui é a INTERAÇÃO COM O S0: só `designer`
// dispensa o envio de arte. Em `adjust` o cliente MANDA a arte, então o
// grupo de origem continua obrigatório. Se alguém "simplificar" isso, a
// loja passa a aceitar pedido de ajuste sem arte para ajustar.
// ============================================================
import {
  buildArtServiceChoices, parseArtPrice, priceLabel, choiceHint,
  dispensaEnvioDeArte, briefingFor,
  ART_NONE, ART_ADJUST, ART_DESIGNER,
} from "@/components/studio/artService";
import { validateRequiredFields } from "@/components/studio/storefront/useStorefront";

describe("buildArtServiceChoices", () => {
  it("grava os três caminhos, na ordem em que o cliente decide", () => {
    const c = buildArtServiceChoices("10,00", "30,00");
    expect(c.map((x) => x.value)).toEqual([ART_NONE, ART_ADJUST, ART_DESIGNER]);
    expect(c.map((x) => x.price_delta)).toEqual([0, 10, 30]);
  });

  // Ajuste grátis continua sendo uma escolha: informa o cliente e avisa a
  // lojista de que aquele pedido precisa de trabalho antes de imprimir.
  it("ajuste com preço 0 continua aparecendo", () => {
    const c = buildArtServiceChoices("0", "30");
    expect(c.find((x) => x.value === ART_ADJUST)).toEqual({
      value: ART_ADJUST, label: expect.any(String), price_delta: 0,
    });
  });

  it("preço vazio ou inválido vira 0, nunca NaN", () => {
    const c = buildArtServiceChoices("", "abc");
    expect(c.every((x) => Number.isFinite(x.price_delta))).toBe(true);
    expect(c.map((x) => x.price_delta)).toEqual([0, 0, 0]);
  });
});

describe("parseArtPrice", () => {
  it("aceita o que a lojista digita", () => {
    expect(parseArtPrice("30")).toBe(30);
    expect(parseArtPrice("30,00")).toBe(30);
    expect(parseArtPrice("30.00")).toBe(30);
    expect(parseArtPrice("1.250,50")).toBe(1250.5);
    expect(parseArtPrice(45)).toBe(45);
  });

  it("valor sem sentido vira 0", () => {
    expect(parseArtPrice("")).toBe(0);
    expect(parseArtPrice(null)).toBe(0);
    expect(parseArtPrice("grátis")).toBe(0);
    expect(parseArtPrice(-10)).toBe(0);
  });
});

describe("priceLabel / choiceHint", () => {
  it("só rotula o que tem custo", () => {
    expect(priceLabel(10)).toBe("+R$ 10,00");
    expect(priceLabel(0)).toBeNull();
    expect(priceLabel(null)).toBeNull();
  });

  it("cada caminho explica o que é, sem jargão", () => {
    expect(choiceHint(ART_ADJUST)).toMatch(/tamanho e as cores/);
    expect(choiceHint(ART_DESIGNER)).toMatch(/do zero/);
    expect(choiceHint("desconhecido")).toBe("");
  });
});

describe("briefing", () => {
  it("pede coisas diferentes em cada caminho pago", () => {
    expect(briefingFor(ART_DESIGNER)?.title).toMatch(/sua ideia/);
    expect(briefingFor(ART_ADJUST)?.title).toMatch(/ajuste/i);
  });

  it("não aparece para quem já tem a arte pronta", () => {
    expect(briefingFor(ART_NONE)).toBeNull();
    expect(briefingFor(undefined)).toBeNull();
  });
});

// ── A regra que não pode ser "simplificada" ──────────────────
describe("S4 × S0 — só a criação dispensa o envio da arte", () => {
  const cfg: any = {
    fields: [
      { id: "image", type: "image", label: "Sua arte", required: true, config: {} },
      {
        id: "art_service", type: "option", label: "Serviço de arte", required: false,
        config: { is_art_service: true, choices: buildArtServiceChoices("10", "30") },
      },
    ],
  };

  it("dispensaEnvioDeArte só é verdade em designer", () => {
    expect(dispensaEnvioDeArte(ART_DESIGNER)).toBe(true);
    expect(dispensaEnvioDeArte(ART_ADJUST)).toBe(false);
    expect(dispensaEnvioDeArte(ART_NONE)).toBe(false);
  });

  it("criação da arte: pode fechar sem enviar arquivo", () => {
    expect(validateRequiredFields(cfg, { art_service: ART_DESIGNER }, false)).toBeNull();
  });

  // O cliente pediu AJUSTE: ajustar o quê, se ele não mandou nada?
  it("ajuste sem arte enviada continua barrado", () => {
    expect(validateRequiredFields(cfg, { art_service: ART_ADJUST }, false))
      .toMatch(/Envie sua arte/);
  });

  it("ajuste com arte enviada passa", () => {
    expect(validateRequiredFields(cfg, {
      art_service: ART_ADJUST, image: "https://cdn/arte.png",
    }, false)).toBeNull();
  });
});
