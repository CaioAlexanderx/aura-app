// ============================================================
// Busca da vitrine — os nomes reais dos produtos
// ============================================================
import { normalizar, casa } from "@/components/studio/storefront/buscaVitrine";

describe("normalizar", () => {
  test("tira acento e caixa", () => {
    expect(normalizar("Macacão Frente Única")).toBe("macacao frente unica");
    expect(normalizar("XÍCARA")).toBe("xicara");
  });

  test("colapsa espaço e apara as pontas", () => {
    expect(normalizar("  Camiseta   Polo  ")).toBe("camiseta polo");
  });

  test("nao quebra com nada", () => {
    expect(normalizar(null)).toBe("");
    expect(normalizar(undefined)).toBe("");
    expect(normalizar(42)).toBe("42");
  });
});

describe("casa", () => {
  test("busca vazia mostra tudo", () => {
    expect(casa("", "qualquer coisa")).toBe(true);
    expect(casa("   ", "qualquer coisa")).toBe(true);
  });

  test("acha ignorando acento nos DOIS lados", () => {
    // O cadastro tem "Xicara" sem acento; quem procura escreve com.
    expect(casa("xícara", "Xicara com pires + colherzinha")).toBe(true);
    expect(casa("macacao", "Macacão Frente Única")).toBe(true);
  });

  test("acha em nome sujo, com caixa alta e medida no meio", () => {
    const nome = "CALCA JEANS MASCULINA SLIM FIT 38x32 AZUL ESCURO";
    expect(casa("calça jeans", nome)).toBe(true);
    expect(casa("azul", nome)).toBe(true);
  });

  test("ordem dos termos nao importa", () => {
    expect(casa("jeans calça", "CALCA JEANS MASCULINA SLIM FIT")).toBe(true);
  });

  test("exige TODOS os termos", () => {
    expect(casa("camiseta vermelha", "Camiseta Polo Marinho")).toBe(false);
  });

  test("procura em mais de um campo", () => {
    expect(casa("polo piquet", "Camiseta Polo Marinho", "Polo piquet, ideal para look semi-formal")).toBe(true);
  });

  test("campo nulo nao atrapalha", () => {
    expect(casa("polo", "Camiseta Polo Marinho", null, undefined)).toBe(true);
  });

  test("nao acha o que nao existe", () => {
    expect(casa("bicicleta", "Camiseta Polo Marinho")).toBe(false);
  });
});
