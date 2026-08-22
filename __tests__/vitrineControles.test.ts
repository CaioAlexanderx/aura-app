import {
  ordenarEntradas, mostrarControles, colunasComDensidade, LIMIAR_CONTROLES,
} from "@/components/studio/storefront/ordenacaoVitrine";
import { numeroWhatsApp, linkWhatsApp } from "@/components/studio/storefront/AncoraWhatsApp";

const lista = [
  { nome: "Camiseta", preco: 50, criadoEm: "2026-01-02" },
  { nome: "Almofada", preco: 30, criadoEm: "2026-03-01" },
  { nome: "Ábaco", preco: 90, criadoEm: "2026-02-01" },
];

describe("ordenarEntradas", () => {
  test("destaque preserva a curadoria da lojista", () => {
    expect(ordenarEntradas(lista, "destaque").map((e) => e.nome)).toEqual(["Camiseta", "Almofada", "Ábaco"]);
  });

  test("preço sobe e desce", () => {
    expect(ordenarEntradas(lista, "preco_asc").map((e) => e.preco)).toEqual([30, 50, 90]);
    expect(ordenarEntradas(lista, "preco_desc").map((e) => e.preco)).toEqual([90, 50, 30]);
  });

  test("nome respeita acento do português", () => {
    // Sem localeCompare("pt-BR"), "Ábaco" cai depois de "Camiseta".
    expect(ordenarEntradas(lista, "nome").map((e) => e.nome)).toEqual(["Ábaco", "Almofada", "Camiseta"]);
  });

  test("novidades põe a mais recente primeiro", () => {
    expect(ordenarEntradas(lista, "novidades").map((e) => e.nome)).toEqual(["Almofada", "Ábaco", "Camiseta"]);
  });

  test("não muta a lista recebida", () => {
    // sf.vitrine é memoizado: mutar faz a ordem vazar pro próximo filtro.
    const antes = lista.map((e) => e.nome);
    ordenarEntradas(lista, "preco_asc");
    expect(lista.map((e) => e.nome)).toEqual(antes);
  });

  test("data ausente não quebra a ordenação", () => {
    const semData = [{ nome: "A", preco: 1 }, { nome: "B", preco: 2, criadoEm: "2026-01-01" }];
    expect(() => ordenarEntradas(semData, "novidades")).not.toThrow();
    expect(ordenarEntradas(semData, "novidades")[0].nome).toBe("B");
  });
});

describe("limiar dos controles", () => {
  test("loja pequena não ganha a barra", () => {
    // Numa vitrine de 9 itens a barra é mais alta que a vitrine.
    expect(mostrarControles(9)).toBe(false);
    expect(mostrarControles(LIMIAR_CONTROLES - 1)).toBe(false);
  });

  test("a partir do limiar, aparece", () => {
    expect(mostrarControles(LIMIAR_CONTROLES)).toBe(true);
    expect(mostrarControles(30)).toBe(true);
  });
});

describe("densidade", () => {
  test("mais uma coluna quando denso, com teto", () => {
    expect(colunasComDensidade(4, true)).toBe(5);
    expect(colunasComDensidade(6, true)).toBe(6);
  });

  test("nunca desce de 2 — cartão de uma coluna só vira lista", () => {
    expect(colunasComDensidade(2, false)).toBe(2);
    expect(colunasComDensidade(1, false)).toBe(2);
  });
});

describe("WhatsApp da loja", () => {
  test("aceita como a lojista digita", () => {
    expect(numeroWhatsApp("(34) 98412-4181")).toBe("5534984124181");
    expect(numeroWhatsApp("34 9 8412 4181")).toBe("5534984124181");
    expect(numeroWhatsApp("+55 34 98412-4181")).toBe("5534984124181");
    expect(numeroWhatsApp("3432221100")).toBe("553432221100");
  });

  test("número impossível não vira link quebrado", () => {
    // Botão que não leva a lugar nenhum é pior que ausência de botão.
    expect(numeroWhatsApp("123")).toBeNull();
    expect(numeroWhatsApp("")).toBeNull();
    expect(numeroWhatsApp(null)).toBeNull();
    expect(numeroWhatsApp("abc")).toBeNull();
    expect(linkWhatsApp("123", "Loja")).toBeNull();
  });

  test("o link já leva a primeira mensagem escrita", () => {
    const url = linkWhatsApp("(34) 98412-4181", "Finesse")!;
    expect(url).toContain("https://wa.me/5534984124181");
    expect(decodeURIComponent(url)).toContain("Vim pela loja Finesse");
  });

  test("sem nome da loja ainda gera mensagem válida", () => {
    expect(decodeURIComponent(linkWhatsApp("34984124181", null)!)).toContain("Vim pela loja e");
  });
});
