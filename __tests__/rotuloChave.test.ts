// ============================================================
// Rotulo das chaves da personalizacao — quem le isso e a oficina
// ============================================================
import { rotuloDaChave, valorDaChave } from "@/components/studio/customizationConfig";

const campos = {
  text: { label: "Nome a estampar" },
  text_middle: { label: "Faixa central" },
  image: { label: "Sua arte" },
} as Record<string, { label?: string } | undefined>;

describe("rotuloDaChave", () => {
  test("campo normal usa o label que a lojista escreveu", () => {
    expect(rotuloDaChave("text", campos)).toBe("Nome a estampar");
  });

  test("cor da arte diz de QUAL campo e", () => {
    expect(rotuloDaChave("text_cor", campos)).toBe("Cor da arte — Nome a estampar");
    expect(rotuloDaChave("text_middle_cor", campos)).toBe("Cor da arte — Faixa central");
  });

  test("cor de campo desconhecido ainda e legivel", () => {
    expect(rotuloDaChave("sumido_cor", campos)).toBe("Cor da arte");
  });

  test("as outras chaves laterais que ja existiam", () => {
    expect(rotuloDaChave("art_service_brief", campos)).toBe("Briefing da arte");
    expect(rotuloDaChave("has_back_selected", campos)).toBe("Personalizar o verso");
    expect(rotuloDaChave("has_middle_selected", campos)).toBe("Personalizar o meio");
  });

  test("chave que ninguem conhece aparece crua, nao some", () => {
    // Sumir com o dado seria pior: a oficina precisa ver o que veio.
    expect(rotuloDaChave("chave_nova_qualquer", campos)).toBe("chave_nova_qualquer");
  });

  test("label do campo vence o padrao de sufixo", () => {
    const comCampo = { ...campos, text_cor: { label: "Tom especial" } };
    expect(rotuloDaChave("text_cor", comCampo)).toBe("Tom especial");
  });
});

describe("valorDaChave", () => {
  test("booleano vira Sim/Nao — 'true' nao e resposta pra oficina", () => {
    expect(valorDaChave(true)).toBe("Sim");
    expect(valorDaChave(false)).toBe("Não");
  });

  test("vazio vira travessao", () => {
    expect(valorDaChave(null)).toBe("—");
    expect(valorDaChave(undefined)).toBe("—");
  });

  test("o resto passa como texto", () => {
    expect(valorDaChave("#BE185D")).toBe("#BE185D");
    expect(valorDaChave("Nathalia")).toBe("Nathalia");
    expect(valorDaChave(3)).toBe("3");
  });
});
