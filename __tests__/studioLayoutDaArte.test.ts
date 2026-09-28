// Formatação da arte (28/09/2026): a regra única de diagramação que os
// três desenhos leem, e o que vai para o pedido. Diagnóstico em
// docs/studio/formatacao-da-arte-diagnostico.md.
import {
  resolverArte, ajusteDoItem, avisosDaArte, larguraDoEncaixe, dpiEfetivo, faixaDeNitidez,
  larguraNitidaCm, lerAjuste, tecnicaDoProduto, misturaDaTecnica, altDoTamanho, moverAjuste,
  escalarAjuste, girarAjuste, grudarNoCentro, itemNoPonto, unidadeDaArea, textoDasMedidas,
  type ArteDoLado, type Medidor, type ItemImagem, type ItemTexto,
} from "@/components/studio/visualEngine/layoutDaArte";
import { valuesForSide } from "@/components/studio/customizationConfig";

// Medidor determinístico: imagem 4:3, letra com 0,5 da altura de largura.
const medir: Medidor = {
  aspecto: (url) => (url.includes("quadrada") ? 1 : 0.75),
  largura: (texto, _f, px) => texto.length * px * 0.5,
};

function arte(p: Partial<ArteDoLado> = {}): ArteDoLado {
  return { v: 1, lado: "front", areaCm: { w: 20, h: 9 }, tecnica: "sublimacao", imagens: [], textos: [], ...p };
}
const img = (campo = "image", url = "https://r2/foto.jpg", extra: any = {}) => ({ campo, url, ajuste: null, arquivo: null, ...extra });
const txt = (campo = "text", texto = "Helena", extra: any = {}) => ({
  campo, texto, cor: "#BE185D", fonte: "'Pacifico', serif", nomeDaFonte: "Pacifico", tam: null, contorno: false, ajuste: null, ...extra,
});

describe("layout padrão (sem ajuste)", () => {
  test("só imagem: inteira, centralizada, com respiro", () => {
    const [it] = resolverArte(arte({ imagens: [img()] }), 20, 9, medir) as ItemImagem[];
    expect(it.cx).toBeCloseTo(10);
    expect(it.cy).toBeCloseTo(4.5);
    // 9 × 0,9 = 8,1 de altura → largura 10,8 (4:3), menor que 20 × 0,9
    expect(it.h).toBeCloseTo(8.1);
    expect(it.w).toBeCloseTo(10.8);
  });

  test("imagem e dois textos: TODOS entram — imagem em cima, um texto por linha embaixo", () => {
    const itens = resolverArte(arte({ imagens: [img()], textos: [txt("text", "Helena"), txt("text_2", "12/10")] }), 20, 9, medir);
    expect(itens.map((i) => i.campo)).toEqual(["image", "text", "text_2"]);
    const [im, t1, t2] = itens as [ItemImagem, ItemTexto, ItemTexto];
    expect(im.cy).toBeLessThan(t1.cy);
    expect(t1.cy).toBeLessThan(t2.cy);
    expect(t2.cy).toBeLessThan(9);
  });

  test("texto comprido encolhe até caber em 94% da largura", () => {
    const [t] = resolverArte(arte({ textos: [txt("text", "Um nome bem comprido demais")] }), 20, 9, medir) as ItemTexto[];
    expect(t.w).toBeLessThanOrEqual(20 * 0.94 + 1e-6);
  });

  test("tamanho P/M/G vira altura da letra, com teto em cm", () => {
    expect(altDoTamanho("M", 9)).toBeCloseTo(0.15);
    // camiseta de 35 cm: M não passa de 3,2 cm
    expect(altDoTamanho("M", 35) * 35).toBeCloseTo(3.2);
    const [t] = resolverArte(arte({ textos: [txt("text", "Oi", { tam: "G" })] }), 20, 9, medir) as ItemTexto[];
    expect(t.px).toBeCloseTo(9 * 0.22);
  });
});

describe("ajuste da cliente", () => {
  test("imagem segue centro, largura e rotação; a caixa gira junto", () => {
    const a = arte({ imagens: [img("image", "u", { ajuste: { v: 1, cx: 0.25, cy: 0.5, larg: 0.4, rot: 90 } })] });
    const [it] = resolverArte(a, 20, 9, medir) as ItemImagem[];
    expect(it.cx).toBeCloseTo(5);
    expect(it.w).toBeCloseTo(8);
    expect(it.h).toBeCloseTo(6);
    expect(it.bw).toBeCloseTo(6);
    expect(it.bh).toBeCloseTo(8);
  });

  test("ajuste do item → pedido: frações, retrato em cm, pixels e DPI", () => {
    const a = arte({ imagens: [img("image", "u", { arquivo: { w: 2400, h: 1800 }, ajuste: { v: 1, cx: 0.5, cy: 0.5, larg: 0.5 } })] });
    const [it] = resolverArte(a, 20, 9, medir);
    const aj = ajusteDoItem(it, 20, 9, true);
    expect(aj).toMatchObject({ v: 1, cx: 0.5, cy: 0.5, larg: 0.5, rot: 0, arquivo: { w: 2400, h: 1800 } });
    expect(aj.cm).toEqual({ x: 5, y: 0.75, w: 10, h: 7.5 });
    // 2400 px em 10 cm = 609,6 dpi
    expect(aj.dpi).toBe(610);
    // e o que volta do pedido reproduz o mesmo item
    const [de_novo] = resolverArte(arte({ imagens: [img("image", "u", { ajuste: lerAjuste(aj) })] }), 20, 9, medir);
    expect(de_novo.cx).toBeCloseTo(it.cx);
    expect(de_novo.w).toBeCloseTo(it.w);
  });

  test("sem medida em cm não inventa retrato nem DPI", () => {
    const [it] = resolverArte(arte({ areaCm: null, imagens: [img("image", "u", { arquivo: { w: 800, h: 600 } })] }), 400, 180, medir);
    const aj = ajusteDoItem(it, 400, 180, false);
    expect(aj.cm).toBeUndefined();
    expect(aj.dpi).toBeUndefined();
  });

  test("ajuste malformado vale o padrão (null); limites espelham o backend", () => {
    expect(lerAjuste(null)).toBeNull();
    expect(lerAjuste({ v: 2, cx: 0.5, cy: 0.5 })).toBeNull();
    expect(lerAjuste({ v: 1, cx: "x", cy: 0.5 })).toBeNull();
    const a = lerAjuste({ v: 1, cx: 9, cy: -9, larg: 99, rot: 45, encaixe: "torto", lixo: 1 })!;
    expect(a).toEqual({ v: 1, cx: 1.5, cy: -0.5, larg: 3, rot: 0 });
  });

  test("mover, escalar e girar trabalham em frações e marcam o encaixe como livre", () => {
    const a = { v: 1 as const, cx: 0.5, cy: 0.5, larg: 0.5, encaixe: "ajustar" as const };
    expect(moverAjuste(a, 2, 0, 20, 9)).toMatchObject({ cx: 0.6, encaixe: "livre" });
    expect(escalarAjuste(a, 2)).toMatchObject({ larg: 1, encaixe: "livre" });
    expect(escalarAjuste(a, 100).larg).toBe(3);
    expect(girarAjuste({ ...a, rot: 270 }).rot).toBe(0);
    expect(escalarAjuste({ v: 1, cx: 0.5, cy: 0.5, alt: 0.1 }, 2).alt).toBeCloseTo(0.2);
  });

  test("o centro gruda nas guias do meio", () => {
    expect(grudarNoCentro(10.2, 3, 20, 9, 0.3)).toEqual({ cx: 10, cy: 3, guiaV: true, guiaH: false });
  });

  test("toque acha o item de cima (texto sobre imagem)", () => {
    const itens = resolverArte(arte({
      imagens: [img("image", "u", { ajuste: { v: 1, cx: 0.5, cy: 0.5, larg: 0.9 } })],
      textos: [txt("text", "Oi", { ajuste: { v: 1, cx: 0.5, cy: 0.5, alt: 0.2 } })],
    }), 20, 9, medir);
    expect(itemNoPonto(itens, 10, 4.5)?.campo).toBe("text");
    expect(itemNoPonto(itens, 2, 4.5)?.campo).toBe("image");
    expect(itemNoPonto(itens, -3, 4.5)).toBeNull();
  });
});

describe("encaixe em um toque", () => {
  test("Ajustar: inteira dentro da margem de 3 mm", () => {
    // 4:3 numa área 20 × 9: manda a altura (9 − 0,6) → largura 11,2
    expect(larguraDoEncaixe("ajustar", 0.75, 0, 20, 9, 0.3) * 20).toBeCloseTo(11.2);
  });
  test("Preencher: cobre a área inteira (corta o excesso)", () => {
    expect(larguraDoEncaixe("preencher", 0.75, 0, 20, 9, 0.3) * 20).toBeCloseTo(20);
  });
  test("deitada (90°) troca os lados da conta", () => {
    // girada, a altura da caixa é a largura da imagem: ≤ 8,4
    expect(larguraDoEncaixe("ajustar", 0.75, 90, 20, 9, 0.3) * 20).toBeCloseTo(8.4);
  });
});

describe("nitidez e avisos", () => {
  test("DPI efetivo pelo tamanho impresso, com faixas 150 / 100", () => {
    expect(dpiEfetivo(1200, 20.32)).toBeCloseTo(150);
    expect(faixaDeNitidez(150)).toBe("boa");
    expect(faixaDeNitidez(120)).toBe("aceitavel");
    expect(faixaDeNitidez(99)).toBe("ruim");
    expect(faixaDeNitidez(null)).toBeNull();
    expect(larguraNitidaCm(400)).toBeCloseTo(6.77, 1);
  });

  test("foto pequena grande demais na peça: aviso (não trava)", () => {
    // 400 px em 12 cm ≈ 85 dpi
    const a = arte({ imagens: [img("image", "u", { arquivo: { w: 400, h: 300 }, ajuste: { v: 1, cx: 0.5, cy: 0.5, larg: 0.6 } })] });
    const itens = resolverArte(a, 20, 9, medir);
    expect(avisosDaArte(itens, 20, 9, true)).toContainEqual(expect.objectContaining({ tipo: "nitidez", campo: "image", dpi: 85 }));
    // em 10 cm são 102 dpi: aceitável, sem aviso
    const menor = resolverArte(arte({ imagens: [img("image", "u", { arquivo: { w: 400, h: 300 }, ajuste: { v: 1, cx: 0.5, cy: 0.5, larg: 0.5 } })] }), 20, 9, medir);
    expect(avisosDaArte(menor, 20, 9, true)).toEqual([]);
  });

  test("arte passando da área: cortada; encostada na borda: margem; Preencher não avisa", () => {
    const cortada = resolverArte(arte({ imagens: [img("image", "u", { ajuste: { v: 1, cx: 0.9, cy: 0.5, larg: 0.4 } })] }), 20, 9, medir);
    expect(avisosDaArte(cortada, 20, 9, true).map((a) => a.tipo)).toEqual(["cortada"]);
    const borda = resolverArte(arte({ textos: [txt("text", "Oi", { ajuste: { v: 1, cx: 0.03, cy: 0.5, alt: 0.1 } })] }), 20, 9, medir);
    expect(avisosDaArte(borda, 20, 9, true).map((a) => a.tipo)).toEqual(["margem"]);
    const preenche = resolverArte(arte({ imagens: [img("image", "u", { ajuste: { v: 1, cx: 0.5, cy: 0.5, larg: 1.2, encaixe: "preencher" } })] }), 20, 9, medir);
    expect(avisosDaArte(preenche, 20, 9, true)).toEqual([]);
  });

  test("área sem medida usa o retângulo do motor", () => {
    expect(unidadeDaArea({ areaCm: null }, { w: 400, h: 180 })).toEqual({ W: 400, H: 180, emCm: false });
    expect(unidadeDaArea({ areaCm: { w: 20, h: 9 } }, { w: 400, h: 180 })).toEqual({ W: 20, H: 9, emCm: true });
    expect(textoDasMedidas(8.44, 6.3)).toBe("8,4 × 6,3 cm");
  });
});

describe("técnica de impressão", () => {
  test("escolha da lojista primeiro; sem escolha, o padrão da peça", () => {
    expect(tecnicaDoProduto({ tecnica: "dtf" }, "caneca")).toBe("dtf");
    expect(tecnicaDoProduto({}, "caneca")).toBe("sublimacao");
    expect(tecnicaDoProduto(null, "camiseta")).toBe("dtf");
    expect(tecnicaDoProduto({ tecnica: "laser" }, "chaveiro")).toBe("outra");
  });
  test("sublimação mistura (o branco some); DTF é opaco; outra deixa o motor decidir", () => {
    expect(misturaDaTecnica("sublimacao")).toBe("multiply");
    expect(misturaDaTecnica("dtf")).toBe("normal");
    expect(misturaDaTecnica("outra")).toBeNull();
  });
});

describe("valuesForSide (bug do \\d, 28/09)", () => {
  test("o segundo campo do verso e as chaves laterais chegam ao motor", () => {
    const v = { text_back: "a", text_back_2: "b", text_back_cor: "#000", text_back_2_ajuste: { v: 1 }, image_back_ajuste: { v: 1 }, text: "frente" };
    expect(valuesForSide(v, "back")).toEqual({ text: "a", text_2: "b", text_cor: "#000", text_2_ajuste: { v: 1 }, image_ajuste: { v: 1 } });
  });
});
