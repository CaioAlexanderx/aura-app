// ============================================================
// AURA STUDIO · K2 — Modo Vitrine
//
// A vitrine é uma tela PÚBLICA: TV na parede da loja, ou o fundo de um
// story. O nome do cliente sai abreviado por PADRÃO — não é um toggle que
// alguém precise lembrar de ligar antes de expor a clientela.
//
// Estes testes travam a abreviação. É a regra de privacidade da fase, e o
// tipo de coisa que quebra silenciosamente com um nome fora do formato
// esperado (só um nome, espaços a mais, string vazia).
// ============================================================

// Importa a MESMA função que a tela usa. Reimplementar a regra aqui faria o
// teste passar mesmo depois de a tela mudar — protegeria nada.
import { abreviarNome as abreviar } from "../../components/studio/abreviarNome";

describe("abreviação de nome na tela pública", () => {
  test("nome completo vira primeiro nome + inicial do último sobrenome", () => {
    expect(abreviar("Maria Fernanda Souza")).toBe("Maria S.");
    expect(abreviar("Ana Paula")).toBe("Ana P.");
  });

  test("nome único passa inteiro — não há sobrenome pra esconder", () => {
    expect(abreviar("Maria")).toBe("Maria");
  });

  test("sem nome, a tela mostra “Encomenda” e não um vão", () => {
    expect(abreviar(null)).toBe("Encomenda");
    expect(abreviar(undefined)).toBe("Encomenda");
    expect(abreviar("")).toBe("Encomenda");
    expect(abreviar("   ")).toBe("Encomenda");
  });

  test("espaços extras não viram inicial vazia", () => {
    expect(abreviar("  Maria   Fernanda   Souza  ")).toBe("Maria S.");
    expect(abreviar("Maria  ")).toBe("Maria");
  });

  test("a inicial sai maiúscula mesmo com o cadastro em minúsculas", () => {
    expect(abreviar("maria souza")).toBe("maria S.");
  });

  // A regra que importa: o sobrenome NUNCA aparece inteiro. Se alguém
  // "simplificar" isso pra só cortar o texto, este teste cai.
  test("nenhum sobrenome completo escapa pra tela", () => {
    const casos = ["Maria Fernanda Souza", "João Pedro Albuquerque", "Ana Lima"];
    for (const nome of casos) {
      const ultimo = nome.trim().split(/\s+/).pop() as string;
      expect(abreviar(nome)).not.toContain(ultimo);
    }
  });
});
