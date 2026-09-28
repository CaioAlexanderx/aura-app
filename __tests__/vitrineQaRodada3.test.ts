// ============================================================
// QA final 28/09 · regras da terceira rodada da vitrine
//
// - a rolagem suave que não andou (sem quadro de pintura) pula direto;
// - a cor da peça, com nome, no aviso, na sacola e no checkout (CL-34);
// - a fonte da arte carregada antes do desenho (CL-26);
// - o aviso de contraste no Mockup na foto (item 11);
// - a medida de cada lado vem do cadastro da peça (item 10);
// - o destaque não repete a frase do banner (CL-11);
// - a vitrine antiga conta modelos nos dois lugares (CL-15);
// - a largura do cartão pela largura do conteúdo (CL-15);
// - todo radio da vitrine diz `aria-checked` no web (CL-24/CL-28).
// ============================================================
import * as fs from "fs";
import * as path from "path";
import { rolagemEmpacou } from "@/components/studio/storefront/home/rolagemDaVitrine";
import { corDaPecaDaLinha, resumoDaLinha } from "@/components/studio/storefront/resumoDaPeca";
import {
  declaracaoDaFonte, esperarFonteDaArte, esquecerFontesCarregadas, primeiraFamilia,
} from "@/components/studio/storefront/fonteDaArte";
import { areaDoLado, avisoDeContraste, textoDaArea } from "@/components/studio/storefront/produto/regrasDaPagina";
import {
  TITULO_DO_HERO_SEM_REPETIR, TITULO_FIXO_DO_HERO, larguraDoCartao, mesmoTexto, tituloDoDestaque,
} from "@/components/studio/storefront/home/regrasDaHome";
import { modelosNasEntradas, rotuloDeModelos } from "@/components/studio/storefront/ordenacaoVitrine";

describe("a rolagem suave que não andou", () => {
  test("não saiu do lugar e ainda não chegou: empacou (pula direto)", () => {
    expect(rolagemEmpacou(0, 0, 1047)).toBe(true);
    expect(rolagemEmpacou(300, 301, 1047)).toBe(true);
  });
  test("andou (a caminho, ou a cliente assumiu): deixa", () => {
    expect(rolagemEmpacou(0, 16, 1047)).toBe(false);
    expect(rolagemEmpacou(0, 875, 1047)).toBe(false);
  });
  test("já estava no alvo: nada a fazer", () => {
    expect(rolagemEmpacou(1047, 1047, 1047)).toBe(false);
  });
});

describe("a cor da peça na sacola e no checkout (CL-34/CL-33)", () => {
  const polo = {
    name: "CAMISA A. POLO",
    customization_config: {
      fields: [
        { id: "text", side: "front", type: "text", label: "Texto", config: {} },
        { id: "template", side: "front", type: "template", label: "Escolher template da galeria", config: {} },
        { id: "color", side: "front", type: "color", label: "Cor", config: {} },
      ],
    },
  } as any;

  test("hex sem nome cadastrado vira o nome em português, com o hex para a bolinha", () => {
    expect(corDaPecaDaLinha({ product: polo, values: { color: "#000000" } } as any)).toEqual({ rotulo: "Cor", nome: "preto", hex: "#000000" });
  });

  test("o nome cadastrado pela lojista vence", () => {
    const p = { ...polo, customization_config: { fields: [{ id: "c", type: "color", label: "Cor da peça", config: { choices: [{ value: "#1E3A8A", label: "Azul marinho" }] } }] } };
    expect(corDaPecaDaLinha({ product: p, values: { c: "#1E3A8A" } } as any)).toEqual({ rotulo: "Cor da peça", nome: "Azul marinho", hex: "#1E3A8A" });
  });

  test("sem campo de cor ou sem escolha: nada", () => {
    expect(corDaPecaDaLinha({ product: polo, values: {} } as any)).toBeNull();
    expect(corDaPecaDaLinha({ product: { customization_config: { fields: [] } }, values: { color: "#000" } } as any)).toBeNull();
  });

  test("o resumo da polo do QA diz a cor", () => {
    const linha = { product: polo, values: { text: "HELENA", template: "https://x/arte.png", color: "#000000" } } as any;
    expect(resumoDaLinha(linha)).toEqual(["Sua foto", "Texto: HELENA", "Cor: preto"]);
    // Quem desenha a bolinha à parte (CorDaLinha) não repete no texto.
    expect(resumoDaLinha(linha, { semCorDaPeca: true })).toEqual(["Sua foto", "Texto: HELENA"]);
  });
});

describe("a fonte da arte carregada antes do desenho (CL-26)", () => {
  const original = (document as any).fonts;
  afterEach(() => {
    esquecerFontesCarregadas();
    Object.defineProperty(document, "fonts", { value: original, configurable: true });
    jest.useRealTimers();
  });

  test("a primeira família da pilha e a declaração do motor (peso 600)", () => {
    expect(primeiraFamilia("'Pacifico', 'Instrument Serif', Georgia, serif")).toBe("Pacifico");
    expect(declaracaoDaFonte("'Pacifico', serif")).toBe("600 48px 'Pacifico', serif");
  });

  test("sem API de fontes (nativo, teste): nada a esperar, desenha na hora", () => {
    Object.defineProperty(document, "fonts", { value: undefined, configurable: true });
    expect(esperarFonteDaArte("'Pacifico', serif")).toBeNull();
  });

  test("com a API: espera a Pacifico; depois de carregada, desenha na hora", async () => {
    let soltar: (v: any) => void = () => undefined;
    const load = jest.fn(() => new Promise((r) => { soltar = r; }));
    Object.defineProperty(document, "fonts", { value: { load }, configurable: true });
    const espera = esperarFonteDaArte("'Pacifico', 'Instrument Serif', serif");
    expect(espera).not.toBeNull();
    // Pedidos seguidos da mesma fonte esperam a mesma carga.
    expect(esperarFonteDaArte("'Pacifico', 'Instrument Serif', serif")).toBe(espera);
    await Promise.resolve();
    await Promise.resolve();
    expect(load).toHaveBeenCalledWith("600 48px 'Pacifico', 'Instrument Serif', serif", expect.any(String));
    soltar([{ family: "Pacifico" }]);
    await espera;
    expect(esperarFonteDaArte("'Pacifico', 'Instrument Serif', serif")).toBeNull();
  });

  test("fonte que não chega não trava a prévia: o teto solta a espera", async () => {
    jest.useFakeTimers();
    Object.defineProperty(document, "fonts", { value: { load: () => new Promise(() => undefined) }, configurable: true });
    const espera = esperarFonteDaArte("'Caveat', serif", 2500)!;
    let soltou = false;
    espera.then(() => { soltou = true; });
    jest.advanceTimersByTime(2600);
    await Promise.resolve();
    expect(soltou).toBe(true);
  });
});

describe("o aviso de contraste no Mockup na foto (item 11)", () => {
  test("sem contraste baixo: nenhum aviso", () => {
    expect(avisoDeContraste({ quaseSome: false, fotoNaCorFotografada: true, nomeDaCorDaPeca: "preto" })).toBeNull();
  });
  test("prévia que pinta a peça: o aviso de sempre", () => {
    expect(avisoDeContraste({ quaseSome: true })).toBe("Essa cor quase some nesta peça. Experimente outra.");
  });
  test("foto na cor fotografada: o aviso diz de qual peça fala e não contradiz a imagem", () => {
    const a = avisoDeContraste({ quaseSome: true, fotoNaCorFotografada: true, nomeDaCorDaPeca: "preto" })!;
    expect(a).toContain("na peça em preto");
    expect(a).toContain("a foto mostra a cor fotografada");
    expect(a).not.toContain("nesta peça");
  });
});

describe("a medida de cada lado vem do cadastro da peça (item 10)", () => {
  // A "Básico 2" da aura-qa: frente 7 × 7, costas 28 × 28; o modelo 3D diz 28 × 35.
  const basico2 = {
    fields: [],
    has_back: true,
    print_area: { position: "center", width_cm: 7, height_cm: 7 },
    back_print_area: { position: "center", width_cm: 28, height_cm: 28 },
  } as any;
  const doModelo = [{ id: "front", width_cm: 28, height_cm: 35 }, { id: "back", width_cm: 28, height_cm: 35 }];

  test("frente e costas do cadastro, não do modelo", () => {
    expect(textoDaArea(areaDoLado(basico2, "front", doModelo)!)).toBe("7 × 7 cm");
    expect(textoDaArea(areaDoLado(basico2, "back", doModelo)!)).toBe("28 × 28 cm");
  });
  test("sem cadastro do lado: a área do modelo com o mesmo nome", () => {
    const soFrente = { fields: [], print_area: { width_cm: 7, height_cm: 7 } } as any;
    expect(areaDoLado(soFrente, "back", doModelo)).toMatchObject({ larguraCm: 28, alturaCm: 35, origem: "modelo" });
  });
  test("sem nenhuma das duas: null (a página não fala de área)", () => {
    expect(areaDoLado({ fields: [] } as any, "back", null)).toBeNull();
  });
});

describe("o destaque não repete a frase do banner (CL-11)", () => {
  test("banner automático com o slogan igual ao título fixo: o destaque usa outra frase", () => {
    expect(tituloDoDestaque({ textoDoBanner: "Presentes que ninguém mais tem" })).toBe(TITULO_DO_HERO_SEM_REPETIR);
    expect(tituloDoDestaque({ textoDoBanner: "  presentes que NINGUÉM mais tem.  " })).toBe(TITULO_DO_HERO_SEM_REPETIR);
  });
  test("banner com outra frase, ou sem banner: o título fixo", () => {
    expect(tituloDoDestaque({ textoDoBanner: "Canecas que contam história" })).toBe(TITULO_FIXO_DO_HERO);
    expect(tituloDoDestaque()).toBe(TITULO_FIXO_DO_HERO);
  });
  test("a frase nova não repete a da grade nem o título fixo", () => {
    expect(mesmoTexto(TITULO_DO_HERO_SEM_REPETIR, TITULO_FIXO_DO_HERO)).toBe(false);
    expect(mesmoTexto(TITULO_DO_HERO_SEM_REPETIR, "Escolha a peça. A arte é sua.")).toBe(false);
    expect(mesmoTexto("Presentes que ninguém mais tem", TITULO_FIXO_DO_HERO)).toBe(true);
  });
});

describe("a vitrine antiga conta modelos nos dois lugares (CL-15)", () => {
  test("o cartão da categoria conta os modelos dele", () => {
    const entradas = [
      { kind: "category", products: new Array(10).fill({}) },
      ...new Array(21).fill({ kind: "product" }),
    ];
    // Eram "22 itens" (cartões) contra "31 modelos" no topo.
    expect(modelosNasEntradas(entradas)).toBe(31);
    expect(rotuloDeModelos(31)).toBe("31 modelos");
    expect(rotuloDeModelos(1)).toBe("1 modelo");
  });
});

describe("a largura do cartão pela largura do conteúdo (CL-15)", () => {
  test("390 px com barra de rolagem de desktop: os dois cartões cabem lado a lado", () => {
    // Pela janela: (390 − 32 − 12) / 2 = 173 → 2 × 173 + 12 = 358 > 343 e a grade virava uma coluna.
    const conteudo = 375 - 32;
    const w = larguraDoCartao(conteudo, 2, 12);
    expect(w).toBe(165);
    expect(2 * w + 12).toBeLessThanOrEqual(conteudo);
  });
  test("nunca negativo nem com colunas inválidas", () => {
    expect(larguraDoCartao(0, 2, 12)).toBe(0);
    expect(larguraDoCartao(300, 0, 12)).toBe(300);
  });
});

describe("todo radio da vitrine diz aria-checked no web (CL-24/CL-28)", () => {
  // O react-native-web 0.19 ignora `accessibilityState`: o `checked` nunca
  // chegava ao DOM e o leitor de tela não sabia qual cor, modelo ou
  // caminho da arte estava marcado.
  const raiz = path.join(__dirname, "..", "components", "studio", "storefront");
  const arquivos: string[] = [];
  const andar = (d: string) => {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      if (fs.statSync(p).isDirectory()) andar(p);
      else if (p.endsWith(".tsx")) arquivos.push(p);
    }
  };
  andar(raiz);

  test("accessibilityState com checked sempre vem com aria-checked ao lado", () => {
    const faltando: string[] = [];
    for (const p of arquivos) {
      const src = fs.readFileSync(p, "utf8");
      const re = /accessibilityState=\{\{[^{}]*\bchecked\b[^{}]*\}\}([^\n]*)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        if (!/aria-checked=/.test(m[1])) faltando.push(path.relative(raiz, p) + ": " + m[0].slice(0, 80));
      }
    }
    expect(faltando).toEqual([]);
  });
});
