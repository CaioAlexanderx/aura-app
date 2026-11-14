// ============================================================
// Um nome de cor só (CP2b da revisão de cores, 14/11/2026)
//
// utils/nomeDaCor.ts é a gêmea de src/services/nomeDaCor.js do backend
// (cupom, pedido online, vitrine, relatórios). Os casos em comum estão em
// fixtures/nomeDaCor.casos.json — o MESMO arquivo nos dois repositórios.
// A etiqueta segue com nomeGravadoParaEtiqueta, sem mudança.
// ============================================================
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1" } }) }));
jest.mock("@/services/api", () => ({ companiesApi: { variants: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: undefined, isLoading: false, isError: false }) }));

import { nomeDaCor, rotuloDaVariante, nomeDaCorDaVariante, nomeGravadoParaEtiqueta, nomeGravadoQueAparece } from "@/utils/nomeDaCor";
import { rotuloDaVariante as rotuloDaConsulta } from "@/components/screens/estoque/VariantesConsulta";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const casos = require("./fixtures/nomeDaCor.casos.json");

const casosDoNome: Array<[string, any]> = casos.nomeDaCor.map((c: any) => [c.caso, c]);
const casosDoRotulo: Array<[string, any]> = casos.rotuloDaVariante.map((c: any) => [c.caso, c]);

const cor = (hex: string) => ({ attribute: "Cor", value: hex });
const tam = (t: string) => ({ attribute: "Tamanho", value: t });

describe("casos em comum com o backend: nomeDaCor", () => {
  test.each(casosDoNome)("%s", (_caso, c) => {
    expect(nomeDaCor(c.entrada)).toBe(c.nome);
  });
});

describe("casos em comum com o backend: rotuloDaVariante", () => {
  test.each(casosDoRotulo)("%s", (_caso, c) => {
    expect(rotuloDaVariante(c.variante, c.separador)).toBe(c.rotulo);
  });
});

describe("Caixa (seletor de variante → carrinho → nota)", () => {
  test("o nome cortado nunca vai para o carrinho: cai na paleta", () => {
    expect(nomeDaCorDaVariante({ sku_suffix: "AZUL ESCUR-M", color_name: "AZUL ESCUR", attributes: [cor("#1F2A44"), tam("M")] }, "#1F2A44"))
      .toBe("Cinza escuro");
  });
  test("nome inteiro em maiúsculas sai em caixa de frase", () => {
    expect(nomeDaCorDaVariante({ sku_suffix: "OFF WHITE-M", color_name: "OFF WHITE", attributes: [cor("#FAF9F6"), tam("M")] }, "#FAF9F6"))
      .toBe("Off white");
  });
  test("nome da lojista como ela escreveu", () => {
    expect(nomeDaCorDaVariante({ sku_suffix: "PRETA-M", color_name: "Preta", attributes: [cor("#000000"), tam("M")] }, "#000000"))
      .toBe("Preta");
  });
});

describe("a etiqueta não muda", () => {
  test.each([["Off White"], ["AMORA"], ["AZUL ESCUR"], [""], ["#FFFFFF"], [null], ["Azul petróleo"]])(
    "nomeGravadoParaEtiqueta(%p) segue igual e bate com a tela",
    (entrada) => {
      expect(nomeGravadoParaEtiqueta(entrada as any)).toBe(nomeGravadoQueAparece(entrada as any));
    },
  );
  test("a única diferença: 5 dígitos de hex não é nome na tela, e a etiqueta segue como era", () => {
    expect(nomeGravadoQueAparece("FFFFF")).toBeNull();
    expect(nomeGravadoParaEtiqueta("FFFFF")).toBe("Fffff");
  });
});

describe("consulta de variantes do Estoque", () => {
  test("cor sem color_name ganha o nome; cortado vira a paleta", () => {
    expect(rotuloDaConsulta({ sku_suffix: "CAQUI-M", color_name: null, attributes: [cor("#C3B091"), tam("M")] })).toBe("Caqui · M");
    expect(rotuloDaConsulta({ sku_suffix: "AZUL ESCUR-M", color_name: "AZUL ESCUR", attributes: [cor("#1F2A44"), tam("M")] })).toBe("Cinza escuro · M");
    expect(rotuloDaConsulta({ sku_suffix: "", attributes: [] })).toBe("Variante");
  });
});
