import { temPersonalizacaoVisivel } from "@/components/studio/customizationConfig";

const cfg = (fields: any[]) => ({ fields }) as any;

describe("temPersonalizacaoVisivel", () => {
  test("texto preenchido conta", () => {
    expect(temPersonalizacaoVisivel(cfg([{ id: "text", type: "text" }]), { text: "Ana" })).toBe(true);
  });

  test("texto vazio ou só espaço não conta", () => {
    // É o caso do QA: gravação opcional que o cliente deixou em branco.
    expect(temPersonalizacaoVisivel(cfg([{ id: "text", type: "text" }]), { text: "" })).toBe(false);
    expect(temPersonalizacaoVisivel(cfg([{ id: "text", type: "text" }]), { text: "   " })).toBe(false);
    expect(temPersonalizacaoVisivel(cfg([{ id: "text", type: "text" }]), {})).toBe(false);
  });

  test("arte enviada e template contam", () => {
    expect(temPersonalizacaoVisivel(cfg([{ id: "image", type: "image" }]), { image: "https://x/a.png" })).toBe(true);
    expect(temPersonalizacaoVisivel(cfg([{ id: "template", type: "template" }]), { template: "https://x/t.png" })).toBe(true);
  });

  test("cor sozinha não conta — quadrado colorido de 56px não diz qual produto é", () => {
    expect(temPersonalizacaoVisivel(cfg([{ id: "text_cor", type: "color" }]), { text_cor: "#EC4899" })).toBe(false);
  });

  test("olha o lado certo — verso preenchido conta", () => {
    const c = cfg([{ id: "text", type: "text" }, { id: "text_back", type: "text" }]);
    expect(temPersonalizacaoVisivel(c, { text: "", text_back: "Verso" })).toBe(true);
  });

  test("config ausente não quebra", () => {
    expect(temPersonalizacaoVisivel(null, { text: "Ana" })).toBe(false);
    expect(temPersonalizacaoVisivel(cfg([{ id: "text", type: "text" }]), null)).toBe(false);
    expect(temPersonalizacaoVisivel(undefined, undefined)).toBe(false);
  });
});
