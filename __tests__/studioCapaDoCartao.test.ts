// ============================================================
// __tests__/studioCapaDoCartao.test.ts
//
// Capa do cartão da fila de Produção — achado 4c do QA (27/09/2026).
// A foto do catálogo traz a arte de EXEMPLO do produto; quando o pedido
// tem personalização desenhável, o cartão desenha a da cliente.
// ============================================================
import { capaDoCartao } from "@/components/studio/capaDoCartao";
import type { CustomizationConfig } from "@/services/studioApi";

const FOTO = "https://cdn/produto.jpg";

const cfgFrente: CustomizationConfig = {
  print_area: { width_cm: 10, height_cm: 5 },
  fields: [
    { id: "text", type: "text", label: "Nome", required: false, config: {} },
    { id: "image", type: "image", label: "Imagem", required: false, config: {} },
  ],
};

const cfgFrenteVerso: CustomizationConfig = {
  print_area: { width_cm: 10, height_cm: 5 },
  has_back: true,
  back_print_area: { width_cm: 10, height_cm: 5 },
  fields: [
    { id: "text", type: "text", label: "Frente", required: false, config: {} },
    { id: "text_back", type: "text", label: "Verso", required: false, side: "back", config: {} },
  ],
};

describe("capaDoCartao", () => {
  it("mockup com url é arte", () => {
    expect(capaDoCartao({ card_image_url: "https://m.png", card_image_source: "mockup" }))
      .toEqual({ tipo: "arte", url: "https://m.png" });
  });

  it("render com url é arte, mesmo com personalização disponível", () => {
    expect(capaDoCartao({
      card_image_url: "https://r.png",
      card_image_source: "render",
      card_customization: { values: { text: "Marina & João" }, config: cfgFrente },
    })).toEqual({ tipo: "arte", url: "https://r.png" });
  });

  it("foto do produto + texto na frente vira prévia da frente", () => {
    const capa = capaDoCartao({
      card_image_url: FOTO,
      card_image_source: "product",
      card_customization: { values: { text: "Marina & João" }, config: cfgFrente },
    });
    expect(capa).toEqual({
      tipo: "previa", config: cfgFrente, values: { text: "Marina & João" }, side: "front",
    });
  });

  it("só o verso preenchido desenha o verso", () => {
    const capa = capaDoCartao({
      card_image_url: FOTO,
      card_image_source: "product",
      card_customization: { values: { text: "  ", text_back: "Marina" }, config: cfgFrenteVerso },
    });
    expect(capa.tipo).toBe("previa");
    expect(capa.tipo === "previa" && capa.side).toBe("back");
  });

  it("imagem enviada (truthy) também é prévia", () => {
    const capa = capaDoCartao({
      card_image_url: FOTO,
      card_image_source: "product",
      card_customization: { values: { image: "https://upload/arte.png" }, config: cfgFrente },
    });
    expect(capa.tipo).toBe("previa");
  });

  it("source null sem url, mas com personalização, é prévia", () => {
    const capa = capaDoCartao({
      card_image_url: null,
      card_image_source: null,
      card_customization: { values: { text: "Ana" }, config: cfgFrente },
    });
    expect(capa.tipo).toBe("previa");
  });

  it("values vazio (PDV sem nada preenchido) mantém a foto", () => {
    expect(capaDoCartao({
      card_image_url: FOTO,
      card_image_source: "product",
      card_customization: { values: {}, config: cfgFrente },
    })).toEqual({ tipo: "foto", url: FOTO });
  });

  it("config sem fields mantém a foto", () => {
    expect(capaDoCartao({
      card_image_url: FOTO,
      card_image_source: "product",
      card_customization: {
        values: { text: "Ana" },
        config: { print_area: { width_cm: 10, height_cm: 5 }, fields: [] },
      },
    })).toEqual({ tipo: "foto", url: FOTO });
  });

  it("config null mantém a foto", () => {
    expect(capaDoCartao({
      card_image_url: FOTO,
      card_image_source: "product",
      card_customization: { values: { text: "Ana" }, config: null },
    })).toEqual({ tipo: "foto", url: FOTO });
  });

  it("source product sem personalização é foto", () => {
    expect(capaDoCartao({ card_image_url: FOTO, card_image_source: "product", card_customization: null }))
      .toEqual({ tipo: "foto", url: FOTO });
  });

  it("nada disponível é monograma", () => {
    expect(capaDoCartao({ card_image_url: null, card_image_source: null, card_customization: null }))
      .toEqual({ tipo: "monograma" });
  });

  it("mockup sem url cai no monograma", () => {
    expect(capaDoCartao({ card_image_url: null, card_image_source: "mockup" }))
      .toEqual({ tipo: "monograma" });
  });

  describe("backend antigo (sem os campos novos)", () => {
    it("com url é foto, como antes", () => {
      expect(capaDoCartao({ card_image_url: FOTO })).toEqual({ tipo: "foto", url: FOTO });
    });
    it("sem url é monograma, como antes", () => {
      expect(capaDoCartao({})).toEqual({ tipo: "monograma" });
      expect(capaDoCartao({ card_image_url: null })).toEqual({ tipo: "monograma" });
    });
  });
});
