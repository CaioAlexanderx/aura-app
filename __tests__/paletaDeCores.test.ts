// ============================================================
// A paleta única de cores (CP3 da revisão de cores, 14/11/2026)
// Gêmea de __tests__/paletaDeCores.test.js do backend.
// ============================================================
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { PALETA, FAMILIAS, corPeloNome, hexPeloNome, maisPerto, porFamilia } from "@/utils/paletaDeCores";
import { nameToHex, hexToName } from "@/utils/colorNames";
import { mesclarPaiNaGrade } from "@/components/screens/estoque/item-form/types";

// O MESMO arquivo vive no backend (src/data/paletaDeCores.json), com o
// mesmo hash no teste de lá. Mudou a paleta: copie o arquivo para o outro
// repositório e troque o hash nos DOIS testes.
const SHA256_DA_PALETA = "1b6079ebae74a46a728ccdb72815a8605938f6f18176d8d0a38fe00353c14423";

test("o arquivo é o mesmo do backend (sha256, fim de linha normalizado)", () => {
  const bruto = fs.readFileSync(path.join(__dirname, "../constants/paletaDeCores.json"), "utf8").replace(/\r\n/g, "\n");
  expect(crypto.createHash("sha256").update(bruto).digest("hex")).toBe(SHA256_DA_PALETA);
});

describe("a paleta", () => {
  test("49 cores em 7 famílias, com Caqui e Azul escuro", () => {
    expect(PALETA).toHaveLength(49);
    expect(FAMILIAS).toHaveLength(7);
    expect(PALETA.map((c) => c.nome)).toEqual(expect.arrayContaining(["Caqui", "Azul escuro", "Off white", "Verde-água"]));
    expect(porFamilia().reduce((n, f) => n + f.cores.length, 0)).toBe(49);
  });
  test.each([
    ["Caqui", "#C3B091"], ["preta", "#111111"], ["off-white", "#F3EFE7"], ["verde agua", "#7FD1C1"], ["marinho", "#1B2A4A"],
  ])("%p → %p", (nome, hex) => {
    expect(hexPeloNome(nome)).toBe(hex);
  });
  test("desconhecido → null; mais perto pelo hex", () => {
    expect(corPeloNome("Rosa chiclete")).toBeNull();
    expect(maisPerto("#C3B091")?.nome).toBe("Caqui");
  });
});

describe("nameToHex lê a paleta depois da tabela de sempre", () => {
  test("o que já era lido segue com o mesmo hex", () => {
    expect(nameToHex("azul")).toBe("#3b82f6");
    expect(nameToHex("Preto")).toBe("#000000");
    expect(nameToHex("#ff0000")).toBe("#ff0000");
  });
  test("o que antes caía no vazio agora tem amostra", () => {
    expect(nameToHex("Caqui")).toBe("#C3B091");
    expect(nameToHex("Preta")).toBe("#111111");
    expect(nameToHex("Off White")).toBe("#F3EFE7");
    expect(nameToHex("Rosa chiclete")).toBeNull();
  });
  test("hexToName (a reserva da etiqueta) não muda", () => {
    expect(hexToName("#C3B091")).toBe("Prata");
    expect(hexToName("#F3EFE7")).toBe("Nude");
  });
});

describe("cor do produto (planilha, cadastro rápido) entra na grade com o nome dela", () => {
  const base = {
    cores: [], tamanhos: [], celulas: {}, paiTamanho: null, paiEstoque: 3,
    nomeParaHex: nameToHex, hexParaNome: (h: string) => hexToName(h) || h,
  };
  test("\"Off White\" vira amostra e o nome escrito fica", () => {
    const m = mesclarPaiNaGrade({ ...base, paiCor: "Off White" });
    expect(m.cores).toEqual([{ hex: "#F3EFE7", name: "Off White" }]);
  });
  test("hex segue com o nome da paleta, como antes", () => {
    const m = mesclarPaiNaGrade({ ...base, paiCor: "#C3B091" });
    expect(m.cores).toEqual([{ hex: "#C3B091", name: "Prata" }]);
  });
  test("nome desconhecido continua fora da grade", () => {
    expect(mesclarPaiNaGrade({ ...base, paiCor: "Rosa chiclete" }).cores).toEqual([]);
  });
});

describe("cadastro rápido: a cor digitada entra", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { corDigitada } = require("@/utils/corDigitada");
  test.each([
    ["Preta", { gravar: "Preta", hex: "#111111", nome: "Preta" }],
    ["  Off White ", { gravar: "Off White", hex: "#F3EFE7", nome: "Off White" }],
    ["caqui", { gravar: "Caqui", hex: "#C3B091", nome: "Caqui" }],
    ["Rosa chiclete", { gravar: "Rosa chiclete", hex: null, nome: "Rosa chiclete" }],
    ["#ff0000", { gravar: "#ff0000", hex: "#ff0000", nome: "Vermelho" }],
    ["ff0000", { gravar: "#ff0000", hex: "#ff0000", nome: "Vermelho" }],
    ["", { gravar: null, hex: null, nome: "" }],
  ])("%p", (texto, esperado) => {
    expect(corDigitada(texto)).toEqual(esperado);
  });
});
