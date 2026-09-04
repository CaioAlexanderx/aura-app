// ============================================================
// Escolher vendo, e fechar pelo WhatsApp (04/09/2026)
//
// Duas lacunas contra o mercado, das decisões do Caio:
//
// 1. Tocar em "Canecas · 9 modelos" abria o PRIMEIRO modelo e os outros
//    oito viravam chips de 104px sem foto. Numa loja que vende variação
//    de louça, a cliente escolhia sempre a mais barata — porque a
//    diferença não era visível.
//
// 2. A DNA Presentes põe "comprar pelo WhatsApp" em todo produto. Nós
//    tínhamos uma âncora de "tirar dúvida" que abre a conversa vazia, e
//    a lojista precisa perguntar de qual peça se trata.
// ============================================================
import {
  modelosOrdenados, eixoQueVaria, faixaDePrecos, resumoDoGrupo, lerModelo,
} from "@/components/studio/storefront/modelosDoGrupo";
import {
  mensagemDoPedido, linhasDaPersonalizacao, linkDoPedido,
} from "@/components/studio/storefront/pedidoPeloWhatsApp";

const peca = (over: any = {}) => ({
  id: over.id || "p1",
  name: over.name || "CANECA BRANCA",
  description: null,
  price: over.price != null ? over.price : 39.9,
  image_url: over.image_url !== undefined ? over.image_url : "https://x/foto.jpg",
  gallery_urls: over.gallery_urls,
  visual_kind: over.visual_kind,
  customization_config: over.customization_config || null,
  templates: [],
  stock_qty: 1,
  category: null,
} as any);

describe("a ordem da grade de modelos", () => {
  test("peça com foto vem antes da sem foto", () => {
    // Um buraco no início faz a grade inteira parecer quebrada.
    const r = modelosOrdenados([
      peca({ id: "sem", name: "Sem foto", image_url: null }),
      peca({ id: "com", name: "Com foto" }),
    ]);
    expect(r.map((m) => m.produto.id)).toEqual(["com", "sem"]);
  });

  test("dentro do grupo, do mais barato ao mais caro", () => {
    const r = modelosOrdenados([
      peca({ id: "cara", price: 89 }), peca({ id: "barata", price: 39.9 }),
    ]);
    expect(r.map((m) => m.produto.id)).toEqual(["barata", "cara"]);
  });

  test("mesmo preço desempata pelo nome, em português", () => {
    const r = modelosOrdenados([
      peca({ id: "z", name: "Ácido" }), peca({ id: "a", name: "Abacaxi" }),
    ]);
    expect(r.map((m) => m.produto.id)).toEqual(["a", "z"]);
  });

  test("lista vazia não quebra", () => {
    expect(modelosOrdenados([])).toEqual([]);
    expect(modelosOrdenados(undefined as any)).toEqual([]);
  });
});

describe("o eixo que varia decide o que a grade grita", () => {
  const comCor = (cores: string[]) => peca({
    customization_config: { fields: [{ id: "c", type: "color", config: { colors: cores } }] },
  });

  test("preços diferentes: é preço que a cliente compara", () => {
    expect(eixoQueVaria(modelosOrdenados([peca({ price: 39.9 }), peca({ id: "b", price: 89 })])))
      .toBe("preco");
  });

  test("mesmo preço, cores diferentes: é cor", () => {
    const r = modelosOrdenados([
      { ...comCor(["#fff"]), id: "a" } as any,
      { ...comCor(["#fff", "#000"]), id: "b" } as any,
    ]);
    expect(eixoQueVaria(r)).toBe("cor");
  });

  test("mesmo preço e mesma cor: sobra o acabamento", () => {
    const r = modelosOrdenados([
      { ...comCor(["#fff"]), id: "a" } as any,
      { ...comCor(["#fff"]), id: "b" } as any,
    ]);
    expect(eixoQueVaria(r)).toBe("acabamento");
  });

  test("um modelo só não tem eixo a comparar", () => {
    expect(eixoQueVaria(modelosOrdenados([peca()]))).toBe("acabamento");
  });
});

describe("o cabeçalho do grupo", () => {
  test("faixa some quando todos custam igual", () => {
    // "De R$ 39,90 a R$ 39,90" é ruído com cara de defeito.
    expect(faixaDePrecos(modelosOrdenados([peca(), peca({ id: "b" })]))).toBeNull();
  });

  test("faixa aparece quando há o que comparar", () => {
    expect(faixaDePrecos(modelosOrdenados([peca({ price: 39.9 }), peca({ id: "b", price: 89 })])))
      .toEqual({ min: 39.9, max: 89 });
  });

  test("o resumo conta quantos têm prévia em 3D — é o argumento da loja", () => {
    const r = modelosOrdenados([
      peca({ id: "a", visual_kind: "model3d" }),
      peca({ id: "b", visual_kind: "model3d" }),
      peca({ id: "c" }),
    ]);
    expect(resumoDoGrupo(r)).toBe("3 modelos · 2 com prévia em 3D");
  });

  test("todos com 3D é dito de outro jeito", () => {
    const r = modelosOrdenados([peca({ id: "a", visual_kind: "model3d" })]);
    expect(resumoDoGrupo(r)).toBe("1 modelo · todos com prévia em 3D");
  });

  test("nenhum com 3D não promete o que não há", () => {
    expect(resumoDoGrupo(modelosOrdenados([peca(), peca({ id: "b" })]))).toBe("2 modelos");
  });
});

describe("foto de verdade", () => {
  test("galeria conta como foto", () => {
    expect(lerModelo(peca({ image_url: null, gallery_urls: ["https://x/a.jpg"] })).temFoto).toBe(true);
  });

  test("string vazia não conta", () => {
    expect(lerModelo(peca({ image_url: "   " })).temFoto).toBe(false);
  });
});

describe("o pedido que chega escrito no WhatsApp", () => {
  const produto = peca({
    name: "CANECA BRANCA",
    customization_config: { fields: [
      { id: "f1", type: "text", label: "Nome a estampar" },
      { id: "f2", type: "color", label: "Cor da arte" },
      { id: "f3", type: "image", label: "Foto do cliente" },
    ] },
  });

  test("só entra o que a cliente preencheu", () => {
    // Uma mensagem com "Foto: —" é pior que uma curta: a lojista lê
    // tudo para descobrir que não há nada ali.
    const linhas = linhasDaPersonalizacao(produto, { f1: "Vovó Lúcia", f2: "", f3: null });
    expect(linhas).toEqual([{ rotulo: "Nome a estampar", valor: "Vovó Lúcia" }]);
  });

  test("a foto vira o endereço do arquivo, que a lojista abre", () => {
    const linhas = linhasDaPersonalizacao(produto, { f3: "https://r2/arte.png" });
    expect(linhas[0]).toEqual({ rotulo: "Foto do cliente", valor: "https://r2/arte.png" });
  });

  test("a mensagem diz de onde a pessoa veio, na primeira linha", () => {
    // A lojista atende por vários canais.
    const m = mensagemDoPedido({ produto, nomeDaLoja: "Ateliê Bem-Querer" });
    expect(m.split("\n")[0]).toContain("Ateliê Bem-Querer");
  });

  test("leva a peça, a quantidade e a conta", () => {
    const m = mensagemDoPedido({ produto, quantidade: 3, precoUnitario: 39.9 });
    expect(m).toContain("CANECA BRANCA");
    expect(m).toContain("3 × R$ 39,90 = R$ 119,70");
  });

  test("uma peça só não vira multiplicação", () => {
    const m = mensagemDoPedido({ produto, quantidade: 1, precoUnitario: 39.9 });
    expect(m).toContain("R$ 39,90");
    expect(m).not.toContain("×");
  });

  test("sem preço calculado, ainda diz a quantidade", () => {
    expect(mensagemDoPedido({ produto, quantidade: 4 })).toContain("Quantidade: 4");
  });

  test("mensagem gigante é cortada — link truncado chega pela metade", () => {
    const gigante = { ...produto, name: "X".repeat(3000) } as any;
    expect(mensagemDoPedido({ produto: gigante }).length).toBeLessThanOrEqual(1200);
  });
});

describe("o botão só existe quando há para onde mandar", () => {
  const produto = peca();

  test("com número, devolve o link do wa.me", () => {
    const l = linkDoPedido({ numero: "(12) 99614-5447", produto });
    expect(l).toContain("https://wa.me/5512996145447?text=");
  });

  test("sem número, devolve null — botão que abre conversa vazia é pior", () => {
    expect(linkDoPedido({ numero: null, produto })).toBeNull();
    expect(linkDoPedido({ numero: "  ", produto })).toBeNull();
  });

  test("o texto vai codificado, senão o link quebra na primeira quebra de linha", () => {
    const l = linkDoPedido({ numero: "12996145447", produto, nomeDaLoja: "Ateliê" })!;
    expect(l).not.toContain("\n");
    expect(decodeURIComponent(l.split("text=")[1])).toContain("Ateliê");
  });
});

describe("as telas estão ligadas", () => {
  const fs = require("fs");
  const path = require("path");
  const RAIZ = path.join(__dirname, "..", "components", "studio", "storefront");

  test("o cartão do grupo abre a grade, não o primeiro modelo", () => {
    const lista = fs.readFileSync(path.join(RAIZ, "ProductList.tsx"), "utf8");
    expect(lista).toContain("sf.abrirGrupo(category, products)");
    expect(lista).not.toContain("sf.openConfigure(products[0], products)");
  });

  test("o estágio novo é aditivo: quem não conhece cai em list", () => {
    const tipos = fs.readFileSync(path.join(RAIZ, "types.ts"), "utf8");
    expect(tipos).toContain('"lote" | "modelos"');
  });

  test("o configurador oferece o caminho do WhatsApp", () => {
    const conf = fs.readFileSync(path.join(RAIZ, "ProductConfigurator.tsx"), "utf8");
    expect(conf).toContain("linkDoPedido({");
    expect(conf).toContain("Prefere pedir pelo WhatsApp?");
  });
});
