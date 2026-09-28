// O que a cliente preencheu, traduzido para as chaves que os motores
// 2D/3D leem. Sem esta tradução o mockup 3D girava uma caneca vazia.
import { valoresDoMotor, arteDoLado, valoresComArte } from "@/components/studio/storefront/valoresDoMotor";

const cfg: any = {
  fields: [
    { id: "f_txt", type: "text", label: "Texto", config: { max_chars: 30, colors: ["#111111", "#D62828"], fonts: ["Pacifico"] } },
    { id: "f_img", type: "image", label: "Foto do cliente", config: {} },
    { id: "f_tpl", type: "template", label: "Escolher template", config: {} },
    { id: "f_cor", type: "color", label: "Cor", config: { colors: ["#FFFFFF"] } },
    { id: "f_txt_verso", type: "text", label: "Texto do verso", side: "back", config: {} },
  ],
};

describe("valoresDoMotor", () => {
  it("traduz texto, foto e arte pronta pelo TIPO do campo, não pelo id", () => {
    const r = valoresDoMotor(cfg, {
      f_txt: "Vovó Lúcia",
      f_img: "https://r2/foto.png",
      f_tpl: "https://r2/arte.png",
    });
    expect(r.values).toEqual({
      text: "Vovó Lúcia",
      image: "https://r2/foto.png",
      template: "https://r2/arte.png",
    });
  });

  it("campo vazio ou só espaço não vira chave — o motor pinta a peça lisa", () => {
    const r = valoresDoMotor(cfg, { f_txt: "   ", f_img: "" });
    expect(r.values).toEqual({});
  });

  it("a cor da arte é a escolha da cliente; sem escolha, a primeira da paleta", () => {
    expect(valoresDoMotor(cfg, { f_txt: "Oi", f_txt_cor: "#2E86DE" }).artColor).toBe("#2E86DE");
    expect(valoresDoMotor(cfg, { f_txt: "Oi" }).artColor).toBe("#111111");
    // valor inválido na chave lateral cai na paleta, não quebra
    expect(valoresDoMotor(cfg, { f_txt: "Oi", f_txt_cor: "vermelho" }).artColor).toBe("#111111");
  });

  it("sem campo de texto não inventa cor — o motor fica no padrão dele", () => {
    const soFoto: any = { fields: [{ id: "f_img", type: "image", config: {} }] };
    expect(valoresDoMotor(soFoto, { f_img: "x" }).artColor).toBeUndefined();
  });

  it("a fonte de arte da lojista vai na pilha, com a serifada da marca de fallback", () => {
    expect(valoresDoMotor(cfg, {}).font).toContain("Pacifico");
    expect(valoresDoMotor(cfg, {}).font).toContain("Instrument Serif");
  });

  it("o verso lê só os campos do verso", () => {
    const r = valoresDoMotor(cfg, { f_txt: "frente", f_txt_verso: "atrás" }, "back");
    expect(r.values).toEqual({ text: "atrás" });
  });

  it("config nula ou sem campos devolve vazio sem estourar", () => {
    expect(valoresDoMotor(null, { f_txt: "x" }).values).toEqual({});
    expect(valoresDoMotor({ fields: [] } as any, null).values).toEqual({});
  });
});

// 28/09/2026 — formatação da arte: a arte INTEIRA do lado para o pintor único.
describe("arteDoLado", () => {
  const cfg2: any = {
    print_area: { width_cm: 20, height_cm: 9 },
    back_print_area: { width_cm: 28, height_cm: 35 },
    has_back: true,
    fields: [
      { id: "text", type: "text", label: "Nome", config: { colors: ["#111111"], fonts: ["Pacifico", "Bebas Neue"] } },
      { id: "text_2", type: "text", label: "Data", config: {} },
      { id: "image", type: "image", label: "Foto", config: {} },
      { id: "template", type: "template", label: "Arte pronta", config: {} },
      { id: "art_service_brief", type: "text", label: "Briefing", config: {} },
      { id: "text_back", type: "text", label: "Verso", side: "back", config: {} },
    ],
  };

  it("todos os textos do lado entram (o segundo sumia da prévia), sem o briefing", () => {
    const a = arteDoLado(cfg2, { text: "Helena", text_2: "12/10", art_service_brief: "praia", text_back: "x" });
    expect(a.textos.map((t) => t.campo)).toEqual(["text", "text_2"]);
    expect(a.areaCm).toEqual({ w: 20, h: 9 });
  });

  it("fonte da cliente só se a lojista liberou; tamanho e contorno pelas chaves laterais", () => {
    const a = arteDoLado(cfg2, { text: "Oi", text_fonte: "Bebas Neue", text_tam: "G", text_contorno: true });
    expect(a.textos[0]).toMatchObject({ nomeDaFonte: "Bebas Neue", tam: "G", contorno: true, cor: "#111111" });
    expect(arteDoLado(cfg2, { text: "Oi", text_fonte: "Comic Sans" }).textos[0].nomeDaFonte).toBe("Pacifico");
    // sem paleta, a cor padrão do motor
    expect(arteDoLado(cfg2, { text_2: "Oi" }).textos[0].cor).toBe("#2C2C2A");
  });

  it("arquivo e arte pronta são o mesmo lugar: a pronta só entra sem arquivo", () => {
    expect(arteDoLado(cfg2, { image: "https://r2/a.jpg", template: "https://r2/t.png" }).imagens.map((i) => i.campo)).toEqual(["image"]);
    expect(arteDoLado(cfg2, { template: "https://r2/t.png" }).imagens.map((i) => i.campo)).toEqual(["template"]);
  });

  it("ajuste do pedido e pixels medidos chegam ao item; ajuste inválido vale o padrão", () => {
    const a = arteDoLado(cfg2, { image: "https://r2/a.jpg", image_ajuste: { v: 1, cx: 0.3, cy: 0.5, larg: 0.4 } }, "front", {
      arquivo: () => ({ w: 2400, h: 1800 }),
    });
    expect(a.imagens[0]).toMatchObject({ ajuste: { v: 1, cx: 0.3, cy: 0.5, larg: 0.4, rot: 0 }, arquivo: { w: 2400, h: 1800 } });
    expect(arteDoLado(cfg2, { image: "u", image_ajuste: "lixo" }).imagens[0].ajuste).toBeNull();
  });

  it("verso usa a área do verso e só os campos dele", () => {
    const a = arteDoLado(cfg2, { text: "frente", text_back: "costas" }, "back");
    expect(a.areaCm).toEqual({ w: 28, h: 35 });
    expect(a.textos.map((t) => t.texto)).toEqual(["costas"]);
  });

  it("técnica: a do produto, senão o padrão da peça", () => {
    expect(arteDoLado({ ...cfg2, tecnica: "dtf" }, {}, "front", { peca: "caneca" }).tecnica).toBe("dtf");
    expect(arteDoLado(cfg2, {}, "front", { peca: "caneca" }).tecnica).toBe("sublimacao");
    expect(arteDoLado(cfg2, {}).tecnica).toBe("outra");
  });

  it("valoresComArte junta as chaves de sempre e a arte para o motor", () => {
    const m = valoresDoMotor(cfg2, { text: "Oi" });
    const v = valoresComArte(m);
    expect(v.text).toBe("Oi");
    expect(v.__arte.textos[0].texto).toBe("Oi");
  });
});
