// O que a cliente preencheu, traduzido para as chaves que os motores
// 2D/3D leem. Sem esta tradução o mockup 3D girava uma caneca vazia.
import { valoresDoMotor } from "@/components/studio/storefront/valoresDoMotor";

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
