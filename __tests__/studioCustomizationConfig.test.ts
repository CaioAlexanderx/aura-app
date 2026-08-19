// ============================================================
// __tests__/studioCustomizationConfig.test.ts
//
// A forma canônica de `customization_config` (19/08/2026).
//
// O caso que dá nome a este arquivo é o da Sheid Mania: 9 canecas
// configuradas pelo painel antigo, com ids `f_<timestamp>`, config
// vazio e os quatro campos marcados obrigatórios ao mesmo tempo. A
// loja estava publicada e ninguém conseguia comprar.
//
// Os testes abaixo cobrem os três sintomas separadamente, porque cada
// um quebra uma coisa diferente: o id quebra o motor visual, o config
// vazio quebra swatches e preço, e a obrigatoriedade cumulativa quebra
// a compra.
// ============================================================
import {
  normalizeCustomizationConfig,
  isCanonicalConfig,
  canonicalizeIds,
  canonicalFieldId,
  artSourceRequired,
  makeField,
  makeArtServiceFields,
  ART_SERVICE_FIELD_ID,
  ART_SERVICE_BRIEF_ID,
  TEXT_MAX_CHARS_PADRAO,
} from "@/components/studio/customizationConfig";
import { validateRequiredFields } from "@/components/studio/storefront/useStorefront";
import { ART_DESIGNER } from "@/components/studio/artService";

/** A config real que o painel antigo produzia, reduzida ao essencial. */
function configDaSheid(): any {
  return {
    print_area: { width_cm: 9, height_cm: 9, position: "center" },
    fields: [
      { id: "f_1747000000001", type: "text",     label: "Texto",                       required: true, config: {} },
      { id: "f_1747000000002", type: "image",    label: "Foto do cliente",             required: true, config: {} },
      { id: "f_1747000000003", type: "template", label: "Escolher template da galeria", required: true, config: {} },
      { id: "f_1747000000004", type: "color",    label: "Cor",                          required: true, config: {} },
    ],
  };
}

describe("ids canônicos", () => {
  it("troca f_<timestamp> pelo nome que o motor visual procura", () => {
    const cfg = normalizeCustomizationConfig(configDaSheid());
    expect(cfg.fields.map((f) => f.id)).toEqual(["text", "image", "template", "color"]);
  });

  it("numera do segundo campo do mesmo tipo em diante", () => {
    const { fields } = canonicalizeIds([
      makeField("text"), makeField("text"), makeField("text"),
    ]);
    expect(fields.map((f) => f.id)).toEqual(["text", "text_2", "text_3"]);
  });

  it("separa frente de verso no id", () => {
    expect(canonicalFieldId("image", "front", 0)).toBe("image");
    expect(canonicalFieldId("image", "back", 0)).toBe("image_back");
    expect(canonicalFieldId("image", "back", 1)).toBe("image_back_2");
  });

  it("devolve o mapa antigo→novo para quem tem valores em memória", () => {
    const { idMap } = canonicalizeIds(configDaSheid().fields);
    expect(idMap["f_1747000000001"]).toBe("text");
    expect(idMap["f_1747000000002"]).toBe("image");
  });

  it("preserva os ids fixos do serviço de arte", () => {
    const cfg = normalizeCustomizationConfig({
      print_area: { width_cm: 10, height_cm: 10 },
      fields: [makeField("text"), ...makeArtServiceFields(10, 40)],
    } as any);
    const ids = cfg.fields.map((f) => f.id);
    expect(ids).toContain(ART_SERVICE_FIELD_ID);
    expect(ids).toContain(ART_SERVICE_BRIEF_ID);
    // O briefing é `type:'text'` e não pode roubar o id `text` do campo
    // de texto de verdade — é ele que o motor visual estampa na peça.
    expect(cfg.fields.find((f) => f.type === "text")!.id).toBe("text");
  });

  it("o motor visual acha o valor pelo id depois de normalizar", () => {
    const cfg = normalizeCustomizationConfig(configDaSheid());
    const values: Record<string, any> = {};
    for (const f of cfg.fields) values[f.id] = f.type === "text" ? "Marília" : "x";
    // compose2d.ts / compose3dMug.ts: `values.image || values.template`.
    expect(values.text).toBe("Marília");
    expect(values.image || values.template).toBeTruthy();
  });
});

describe("config vazio ganha o padrão do tipo", () => {
  it("texto sem config recebe limite, fontes e cores", () => {
    const cfg = normalizeCustomizationConfig(configDaSheid());
    const texto = cfg.fields.find((f) => f.id === "text")!;
    expect(texto.config.max_chars).toBe(TEXT_MAX_CHARS_PADRAO);
    expect(texto.config.fonts!.length).toBeGreaterThan(0);
    expect(texto.config.colors!.length).toBeGreaterThan(0);
  });

  it("imagem sem config recebe formatos, tamanho e dpi", () => {
    const cfg = normalizeCustomizationConfig(configDaSheid());
    const img = cfg.fields.find((f) => f.id === "image")!;
    expect(img.config.formats).toContain("png");
    expect(img.config.max_mb).toBeGreaterThan(0);
    expect(img.config.min_dpi).toBeGreaterThan(0);
  });

  it("cor e opção sem valor NÃO são inventadas", () => {
    // Fronteira deliberada: paleta e choices são fato do produto, não
    // decisão de apresentação. Inventar P/M/G numa caneca porque o
    // campo estava vazio escreveria no banco algo que ninguém disse.
    const cfg = normalizeCustomizationConfig({
      print_area: { width_cm: 9, height_cm: 9 },
      fields: [
        { id: "a", type: "color",  label: "Cor",    required: false, config: {} },
        { id: "b", type: "option", label: "Opções", required: false, config: {} },
      ],
    } as any);
    expect(cfg.fields[0].config.colors).toBeUndefined();
    expect(cfg.fields[1].config.choices).toBeUndefined();
  });

  it("mas um campo novo no editor nasce com ponto de partida", () => {
    // Ali tem alguém olhando para a tela, e vai editar em cima.
    expect((makeField("color").config.colors || []).length).toBeGreaterThan(2);
    expect((makeField("option").config.choices || []).length).toBe(3);
  });

  it("não sobrescreve o que a lojista escolheu", () => {
    const cfg = normalizeCustomizationConfig({
      print_area: { width_cm: 20, height_cm: 8 },
      fields: [{ id: "x", type: "text", label: "Nome", required: false, config: { max_chars: 5 } }],
    } as any);
    expect(cfg.fields[0].config.max_chars).toBe(5);
    expect(cfg.fields[0].config.fonts!.length).toBeGreaterThan(0);
  });
});

describe("obrigatoriedade da origem da arte", () => {
  it("colapsa image+template no grupo, em vez de exigir os dois", () => {
    const cfg = normalizeCustomizationConfig(configDaSheid());
    expect(artSourceRequired(cfg.fields, "front")).toBe(true);
    // O texto e a cor continuam obrigatórios individualmente: só a
    // origem da arte é grupo.
    expect(cfg.fields.find((f) => f.id === "text")!.required).toBe(true);
    expect(cfg.fields.find((f) => f.id === "color")!.required).toBe(true);
  });

  it("a config normalizada da Sheid deixa de travar a compra", () => {
    const cfg = normalizeCustomizationConfig(configDaSheid());
    // Cliente digita o texto, escolhe a cor e manda UMA arte.
    const values = { text: "Marília", color: "#0F172A", image: "https://r2/arte.png" };
    expect(validateRequiredFields(cfg as any, values, false)).toBeNull();
  });

  it("sem nenhuma arte, a mensagem oferece os dois caminhos", () => {
    const cfg = normalizeCustomizationConfig(configDaSheid());
    const erro = validateRequiredFields(
      cfg as any,
      { text: "Marília", color: "#0F172A" },
      false
    );
    expect(erro).toMatch(/Foto do cliente/);
    expect(erro).toMatch(/galeria/);
  });

  it("o serviço de arte e o briefing nunca são obrigatórios", () => {
    const cfg = normalizeCustomizationConfig({
      print_area: { width_cm: 10, height_cm: 10 },
      fields: makeArtServiceFields(0, 30).map((f) => ({ ...f, required: true })),
    } as any);
    expect(cfg.fields.every((f) => f.required === false)).toBe(true);
  });

  it("quem contrata a criação não precisa enviar arte", () => {
    const cfg = normalizeCustomizationConfig({
      ...configDaSheid(),
      fields: [...configDaSheid().fields, ...makeArtServiceFields(0, 30)],
    });
    const values = { text: "Marília", color: "#0F172A", [ART_SERVICE_FIELD_ID]: ART_DESIGNER };
    expect(validateRequiredFields(cfg as any, values, false)).toBeNull();
  });

  it("cada lado tem o seu grupo", () => {
    const cfg = normalizeCustomizationConfig({
      print_area: { width_cm: 10, height_cm: 10 },
      has_back: true,
      back_print_area: { width_cm: 10, height_cm: 10 },
      fields: [
        { id: "a", type: "image", label: "Frente", required: true,  config: {}, side: "front" },
        { id: "b", type: "image", label: "Verso",  required: false, config: {}, side: "back"  },
      ],
    } as any);
    expect(artSourceRequired(cfg.fields, "front")).toBe(true);
    expect(artSourceRequired(cfg.fields, "back")).toBe(false);
    expect(cfg.fields.map((f) => f.id)).toEqual(["image", "image_back"]);
  });
});

describe("verso e chaves de raiz", () => {
  it("verso desligado rebaixa os campos para a frente", () => {
    const cfg = normalizeCustomizationConfig({
      print_area: { width_cm: 10, height_cm: 10 },
      fields: [{ id: "a", type: "text", label: "T", required: false, config: {}, side: "back" }],
    } as any);
    // O backend recusa side='back' sem has_back — mandar assim era 400.
    expect((cfg.fields[0] as any).side).toBe("front");
    expect((cfg as any).has_back).toBeUndefined();
  });

  it("cobrança de verso sem verso não sobrevive", () => {
    const cfg = normalizeCustomizationConfig({
      print_area: { width_cm: 10, height_cm: 10 },
      back_charge_enabled: true,
      back_price_delta: 12,
      fields: [makeField("text")],
    } as any);
    expect((cfg as any).back_charge_enabled).toBeUndefined();
    expect((cfg as any).back_price_delta).toBeUndefined();
  });

  it("size_guide atravessa intacto — é de outro dono", () => {
    const guia = { file_url: "https://r2/guia.pdf", content_type: "application/pdf" };
    const cfg = normalizeCustomizationConfig({
      print_area: { width_cm: 10, height_cm: 10 },
      size_guide: guia,
      fields: [makeField("text")],
    } as any);
    expect((cfg as any).size_guide).toEqual(guia);
  });

  it("print_area inválido vira um valor usável, não um 400", () => {
    const cfg = normalizeCustomizationConfig({ fields: [makeField("text")] } as any);
    expect(cfg.print_area.width_cm).toBeGreaterThan(0);
    expect(cfg.print_area.height_cm).toBeGreaterThan(0);
    expect(cfg.print_area.position).toBe("center");
  });
});

// ── Casos vindos do banco de produção (19/08/2026) ──────────
// Consultados no projeto Aura via Supabase. 29 produtos
// personalizáveis, todos da Sheid Mania, 29 com id volátil, 26 com
// config vazio, 18 com origem de arte cumulativa. Os três abaixo são
// formas que nenhum teste sintético tinha previsto.
describe("formas que existem no banco", () => {
  it("dois campos image no mesmo produto — CAMISA Algodão SUEDINI", () => {
    const cfg = normalizeCustomizationConfig({
      print_area: { width_cm: 8, height_cm: 8 },
      has_back: true,
      back_print_area: { width_cm: 38, height_cm: 40 },
      fields: [
        { id: "f_1779814198452", side: "front", type: "text",  label: "Texto",           required: true, config: { max_chars: 30 } },
        { id: "f_1779814199068", side: "front", type: "image", label: "Foto do cliente", required: true, config: {} },
        { id: "f_1779814199747", side: "front", type: "image", label: "Foto do cliente", required: true, config: {} },
        { id: "f_1779814204974", side: "front", type: "color", label: "Cor",             required: true, config: {} },
      ],
    } as any);
    expect(cfg.fields.map((f) => f.id)).toEqual(["text", "image", "image_2", "color"]);
    // O motor lê `values.image`: quem fica com o nome curto é o primeiro.
    expect(cfg.fields[1].id).toBe("image");
  });

  it("dois campos text no mesmo produto — Adesivo Premium", () => {
    const cfg = normalizeCustomizationConfig({
      print_area: { width_cm: 8, height_cm: 8 },
      fields: [
        { id: "f_1779813077614", side: "front", type: "text",     label: "Texto",          required: true,  config: {} },
        { id: "f_1779813101083", side: "front", type: "image",    label: "Foto",           required: true,  config: {} },
        { id: "f_1779813113267", side: "front", type: "text",     label: "Sua ideia aqui", required: true,  config: { max_chars: 30 } },
        { id: "f_1779813340867", side: "front", type: "color",    label: "Cor",            required: true,  config: {} },
        { id: "f_1779813345611", side: "front", type: "template", label: "Galeria",        required: false, config: {} },
      ],
    } as any);
    expect(cfg.fields.map((f) => f.id)).toEqual(["text", "image", "text_2", "color", "template"]);
    // `image` estava required e `template` não: o grupo nivela por cima.
    expect(cfg.fields.find((f) => f.id === "template")!.required).toBe(true);
  });

  it("has_back sem nenhum campo no verso — o caso mais comum lá", () => {
    const cfg = normalizeCustomizationConfig({
      print_area: { width_cm: 7, height_cm: 7 },
      has_back: true,
      back_print_area: { width_cm: 28, height_cm: 28 },
      back_charge_enabled: true,
      back_price_delta: 10,
      fields: [
        { id: "f_1779814247857", side: "front", type: "text",  label: "Texto", required: true, config: { max_chars: 30 } },
        { id: "f_1779814248717", side: "front", type: "image", label: "Foto",  required: true, config: {} },
        { id: "f_1779814250981", side: "front", type: "color", label: "Cor",   required: true, config: {} },
      ],
    } as any);
    // A cobrança do verso é dado da lojista e não pode sumir na
    // normalização só porque nenhum campo mora lá ainda.
    expect((cfg as any).has_back).toBe(true);
    expect((cfg as any).back_price_delta).toBe(10);
    expect((cfg as any).back_print_area.width_cm).toBe(28);
  });
});

describe("idempotência", () => {
  it("normalizar duas vezes dá o mesmo resultado", () => {
    const uma = normalizeCustomizationConfig(configDaSheid());
    const duas = normalizeCustomizationConfig(uma);
    expect(duas).toEqual(uma);
  });

  it("isCanonicalConfig separa o que a migração precisa tocar", () => {
    expect(isCanonicalConfig(configDaSheid())).toBe(false);
    expect(isCanonicalConfig(normalizeCustomizationConfig(configDaSheid()))).toBe(true);
  });

  it("campo de tipo inválido é descartado, não propagado", () => {
    const cfg = normalizeCustomizationConfig({
      print_area: { width_cm: 10, height_cm: 10 },
      fields: [{ id: "a", type: "assinatura", label: "?", required: true, config: {} }, makeField("text")],
    } as any);
    expect(cfg.fields).toHaveLength(1);
    expect(cfg.fields[0].id).toBe("text");
  });
});
