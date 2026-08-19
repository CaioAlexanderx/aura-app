// ============================================================
// AURA Studio — S0: campos de arte deixam de ser cumulativos
//
// Espelho de __tests__/studioStorefrontRequired.test.js no aura-backend.
// Os mesmos casos rodam dos dois lados de proposito: se as validacoes
// divergirem, o item entra no carrinho aqui e o pedido leva 400 no
// fechamento la — o pior resultado possivel pro cliente.
//
// O bug que isto fecha: a Sheid Mania (loja publicada) marcou
// "Obrigatorio" em Texto, Foto do cliente, Template da galeria e Cor ao
// mesmo tempo. Como image e template preenchem o mesmo slot de arte,
// exigir os dois juntos e impossivel de satisfazer.
// ============================================================
import { validateRequiredFields } from "@/components/studio/storefront/useStorefront";

// Config real da Sheid: os 4 campos required ao mesmo tempo.
function sheidConfig(): any {
  return {
    print_area: { width_cm: 9, height_cm: 9 },
    has_back: true,
    fields: [
      { id: "f_1", type: "text",     label: "Texto",                        required: true, config: {} },
      { id: "f_2", type: "image",    label: "Foto do cliente",              required: true, config: {} },
      { id: "f_3", type: "template", label: "Escolher template da galeria", required: true, config: {} },
      { id: "f_4", type: "color",    label: "Cor",                          required: true, config: {} },
    ],
  };
}

describe("S0 — grupo de origem da arte", () => {
  it("config da Sheid: upload preenchido basta, sem exigir tambem a galeria", () => {
    expect(validateRequiredFields(sheidConfig(), {
      f_1: "Feliz aniversario", f_2: "https://cdn/arte.png", f_4: "#FFFFFF",
    }, false)).toBeNull();
  });

  it("config da Sheid: galeria preenchida basta, sem exigir tambem o upload", () => {
    expect(validateRequiredFields(sheidConfig(), {
      f_1: "Feliz aniversario", f_3: "tpl-42", f_4: "#FFFFFF",
    }, false)).toBeNull();
  });

  it("nenhuma das duas origens preenchida ainda e erro, citando as duas opcoes", () => {
    const err = validateRequiredFields(sheidConfig(), { f_1: "Texto", f_4: "#FFF" }, false);
    expect(err).toMatch(/Envie sua arte/);
    expect(err).toContain("Foto do cliente");
    expect(err).toContain("Escolher template da galeria");
  });

  it("campo required fora do grupo segue exigido isoladamente", () => {
    expect(validateRequiredFields(sheidConfig(), { f_2: "https://cdn/a.png", f_4: "#FFF" }, false))
      .toBe('Preencha "Texto"');
    expect(validateRequiredFields(sheidConfig(), { f_1: "Texto", f_2: "https://cdn/a.png" }, false))
      .toBe('Preencha "Cor"');
  });

  it("string em branco nao conta como preenchida", () => {
    expect(validateRequiredFields(sheidConfig(), { f_1: "Texto", f_2: "   ", f_4: "#FFF" }, false))
      .toMatch(/Envie sua arte/);
  });

  // Sem relaxamento onde a lojista pediu UM campo so.
  it("origem unica required continua obrigatoria", () => {
    const cfg: any = {
      fields: [{ id: "image", type: "image", label: "Sua arte", required: true, config: {} }],
    };
    expect(validateRequiredFields(cfg, {}, false)).toBe('Envie sua arte em "Sua arte"');
    expect(validateRequiredFields(cfg, { image: "https://cdn/a.png" }, false)).toBeNull();
  });

  it("origem de arte NAO required nao passa a ser exigida pelo grupo", () => {
    const cfg: any = {
      fields: [
        { id: "image",    type: "image",    label: "Sua arte", required: false, config: {} },
        { id: "template", type: "template", label: "Galeria",  required: false, config: {} },
      ],
    };
    expect(validateRequiredFields(cfg, {}, false)).toBeNull();
  });
});

describe('S0 — "crie minha arte pra mim" dispensa o envio', () => {
  function comArtService(): any {
    const cfg = sheidConfig();
    cfg.fields.push({
      id: "art_service", type: "option", label: "Crie minha arte", required: false,
      config: {
        is_art_service: true,
        choices: [
          { value: "none",     label: "Vou enviar minha arte",   price_delta: 0 },
          { value: "designer", label: "Crie minha arte pra mim", price_delta: 40 },
        ],
      },
    });
    return cfg;
  }

  it("designer satisfaz o grupo sem upload nem galeria", () => {
    expect(validateRequiredFields(comArtService(), {
      f_1: "Nome", f_4: "#FFF", art_service: "designer",
    }, false)).toBeNull();
  });

  it("none mantem a exigencia de enviar a arte", () => {
    expect(validateRequiredFields(comArtService(), {
      f_1: "Nome", f_4: "#FFF", art_service: "none",
    }, false)).toMatch(/Envie sua arte/);
  });

  it("designer nao dispensa campos fora do grupo", () => {
    expect(validateRequiredFields(comArtService(), { f_4: "#FFF", art_service: "designer" }, false))
      .toBe('Preencha "Texto"');
  });
});

describe("S0 — campo do verso so e exigido com o verso ativo", () => {
  const cfg: any = {
    has_back: true,
    back_charge_enabled: true,
    fields: [
      { id: "frente", type: "text", label: "Frente", required: true, config: {}, side: "front" },
      { id: "verso",  type: "text", label: "Verso",  required: true, config: {}, side: "back"  },
    ],
  };

  it("verso inativo: campo do verso nao e cobrado", () => {
    expect(validateRequiredFields(cfg, { frente: "A" }, false)).toBeNull();
  });

  it("verso ativo: campo do verso volta a ser exigido", () => {
    expect(validateRequiredFields(cfg, { frente: "A" }, true)).toBe('Preencha "Verso"');
  });

  it("grupo de arte do verso e independente do grupo da frente", () => {
    const c: any = {
      has_back: true,
      back_charge_enabled: true,
      fields: [
        { id: "img_f", type: "image",    label: "Arte frente",    required: true, config: {}, side: "front" },
        { id: "tpl_f", type: "template", label: "Galeria frente", required: true, config: {}, side: "front" },
        { id: "img_v", type: "image",    label: "Arte verso",     required: true, config: {}, side: "back"  },
      ],
    };
    expect(validateRequiredFields(c, { tpl_f: "tpl-1" }, true)).toBe('Envie sua arte em "Arte verso"');
    expect(validateRequiredFields(c, { tpl_f: "tpl-1" }, false)).toBeNull();
  });
});

describe("S0 — casos que nao podem regredir", () => {
  it("produto nao personalizavel (config null) segue livre", () => {
    expect(validateRequiredFields(null, {}, false)).toBeNull();
  });

  it("config sem fields segue livre", () => {
    expect(validateRequiredFields({ print_area: {} } as any, {}, false)).toBeNull();
  });
});
