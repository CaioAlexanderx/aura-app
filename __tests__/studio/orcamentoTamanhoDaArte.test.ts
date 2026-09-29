// Tamanho da arte no vídeo do orçamento (29/09/2026).
//
// O vídeo usava a regra antiga do motor 3D (imagem a 90% da largura e
// 55–85% da altura da área do modelo, sem olhar a medida do produto):
// imagem muito larga, muito alta ou com borda transparente ficava pequena
// na peça. Agora passa pela regra única (`__arte`) com o encaixe do
// orçamento. Estes testes seguram: a ocupação da área, a margem de
// segurança, o recorte pela caixa do conteúdo, o ajuste da lojista e que a
// vitrine continua sem caixa nem recorte.
import {
  resolverArte, caixaDoItem, MARGEM_CM,
  type ArteDoLado, type Medidor, type ItemImagem, type ItemTexto,
} from "@/components/studio/visualEngine/layoutDaArte";
import { caixaDoConteudo, precarregarArte, ALFA_MINIMO } from "@/components/studio/visualEngine/pintarArte";
import { valoresDoMotor } from "@/components/studio/storefront/valoresDoMotor";
import {
  arteNoTamanhoDoOrcamento, caixasDasImagens, ajusteValido, ajusteEhPadrao,
  ESCALA_MIN, ESCALA_MAX, DESLOCAMENTO_MAX, FAIXA_DA_IMAGEM_COM_TEXTO,
} from "@/components/studio/orcamentoVideo/tamanhoDaArte";
import {
  motorDaArte, ajustarTamanhoDaArte, ajusteDaArte, customizacaoComArte,
} from "@/components/studio/orcamentoVideo/pecaDoOrcamento";

jest.mock("@/services/studioApi", () => ({ studioApi: {} }));
jest.mock("@/services/studioVisualApi", () => ({ studioVisualApi: {} }));
jest.mock("@/components/studio/visualEngine/compose3dMug", () => ({ createModelViewer: jest.fn() }));
jest.mock("@/components/studio/visualEngine/compose2d", () => ({ exportPng: jest.fn() }));
jest.mock("@/components/studio/visualEngine/specDaFotoDoProduto", () => ({ specDaFotoDoProdutoMedida: jest.fn() }));

// Medidor determinístico: o aspecto (altura ÷ largura) vem do nome da URL.
const ASPECTOS: Record<string, number> = { quadrada: 1, larga: 400 / 1800, alta: 1400 / 400, logo: 0.5 };
const medir: Medidor = {
  aspecto: (url) => ASPECTOS[url] ?? 1,
  largura: (texto, _f, px) => texto.length * px * 0.5,
};

const AREA = { w: 9, h: 8 };
function arte(p: Partial<ArteDoLado> = {}): ArteDoLado {
  return { v: 1, lado: "front", areaCm: AREA, tecnica: "outra", imagens: [], textos: [], ...p };
}
const img = (url = "quadrada", extra: any = {}) => ({ campo: "f_img", url, ajuste: null, arquivo: null, ...extra });
const txt = (texto = "Ana & Léo") => ({
  campo: "f_txt", texto, cor: "#2C2C2A", fonte: "Georgia, serif", nomeDaFonte: null, tam: null, contorno: false, ajuste: null,
});

/** A imagem resolvida no layout do orçamento (unidade: cm da área). */
function resolver(a: ArteDoLado, ajuste?: any) {
  return resolverArte(arteNoTamanhoDoOrcamento(a, ajuste), AREA.w, AREA.h, medir);
}

describe("encaixe do orçamento: só imagem", () => {
  test.each(["quadrada", "larga", "alta", "logo"])("imagem %s entra inteira, centrada, dentro da margem de segurança", (nome) => {
    const [it] = resolver(arte({ imagens: [img(nome)] })) as ItemImagem[];
    const c = caixaDoItem(it);
    expect(it.encaixe).toBe("ajustar");
    expect(it.cx).toBeCloseTo(AREA.w / 2);
    expect(it.cy).toBeCloseTo(AREA.h / 2);
    expect(c.x).toBeGreaterThanOrEqual(MARGEM_CM - 1e-6);
    expect(c.y).toBeGreaterThanOrEqual(MARGEM_CM - 1e-6);
    expect(c.x + c.w).toBeLessThanOrEqual(AREA.w - MARGEM_CM + 1e-6);
    expect(c.y + c.h).toBeLessThanOrEqual(AREA.h - MARGEM_CM + 1e-6);
    // Mantém a proporção da imagem (nunca esticada nem cortada).
    expect(it.h / it.w).toBeCloseTo(ASPECTOS[nome]);
  });

  test("ocupa o máximo: encosta na margem no lado que limita", () => {
    const larga = resolver(arte({ imagens: [img("larga")] }))[0] as ItemImagem;
    expect(larga.w).toBeCloseTo(AREA.w - 2 * MARGEM_CM); // limitada pela largura
    const alta = resolver(arte({ imagens: [img("alta")] }))[0] as ItemImagem;
    expect(alta.h).toBeCloseTo(AREA.h - 2 * MARGEM_CM); // limitada pela altura
    const q = resolver(arte({ imagens: [img("quadrada")] }))[0] as ItemImagem;
    expect(q.h).toBeCloseTo(AREA.h - 2 * MARGEM_CM); // quadrada numa área mais larga que alta
  });

  test("a regra antiga deixava a quadrada em 85% da altura e com folga de 10% na largura; a nova usa a margem de 0,3 cm", () => {
    const [antes] = resolverArte(arte({ imagens: [img("quadrada")] }), AREA.w, AREA.h, medir) as ItemImagem[];
    const [depois] = resolver(arte({ imagens: [img("quadrada")] })) as ItemImagem[];
    expect(depois.h).toBeGreaterThan(antes.h * 0.8); // não encolhe
    expect(depois.h).toBeLessThanOrEqual(AREA.h - 2 * MARGEM_CM + 1e-6); // e não passa da margem (o padrão da vitrine passa)
  });
});

describe("encaixe do orçamento: imagem e texto", () => {
  test("a imagem fica na faixa de cima e o texto na de baixo, sem se sobrepor", () => {
    const [im, t] = resolver(arte({ imagens: [img("quadrada")], textos: [txt()] })) as [ItemImagem, ItemTexto];
    const ci = caixaDoItem(im), ct = caixaDoItem(t);
    expect(ci.y + ci.h).toBeLessThan(FAIXA_DA_IMAGEM_COM_TEXTO * AREA.h);
    expect(ci.y).toBeGreaterThanOrEqual(MARGEM_CM - 1e-6);
    expect(ct.y).toBeGreaterThanOrEqual(ci.y + ci.h - 1e-6);
    expect(ct.y + ct.h).toBeLessThanOrEqual(AREA.h + 1e-6);
  });

  test("a divisão acompanha o layout padrão (62% / 38%): o texto não muda de lugar", () => {
    const [, tPadrao] = resolverArte(arte({ imagens: [img("quadrada")], textos: [txt()] }), AREA.w, AREA.h, medir) as [ItemImagem, ItemTexto];
    const [, tNovo] = resolver(arte({ imagens: [img("quadrada")], textos: [txt()] })) as [ItemImagem, ItemTexto];
    expect(tNovo.cy).toBeCloseTo(tPadrao.cy);
    expect(tNovo.px).toBeCloseTo(tPadrao.px);
  });

  test("duas imagens: uma coluna cada, lado a lado, dentro da margem", () => {
    const a = arte({ imagens: [img("quadrada"), { ...img("logo"), campo: "f_img2" }] });
    const [a1, a2] = resolver(a) as ItemImagem[];
    expect(a1.cx).toBeLessThan(AREA.w / 2);
    expect(a2.cx).toBeGreaterThan(AREA.w / 2);
    expect(caixaDoItem(a1).x + caixaDoItem(a1).w).toBeLessThanOrEqual(caixaDoItem(a2).x);
    expect(caixaDoItem(a1).x).toBeGreaterThanOrEqual(MARGEM_CM - 1e-6);
    expect(caixaDoItem(a2).x + caixaDoItem(a2).w).toBeLessThanOrEqual(AREA.w - MARGEM_CM + 1e-6);
  });
});

describe("recorte pela caixa do conteúdo", () => {
  // RGBA 10x10 com um bloco 4x2 opaco em (3,5).
  function rgba(w: number, h: number, bloco?: { x: number; y: number; w: number; h: number; cor?: number[] }) {
    const d = new Uint8ClampedArray(w * h * 4);
    if (bloco) {
      const [r, g, b] = bloco.cor || [10, 20, 30];
      for (let y = bloco.y; y < bloco.y + bloco.h; y++) for (let x = bloco.x; x < bloco.x + bloco.w; x++) {
        const i = (y * w + x) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    return d;
  }

  test("acha a caixa do que tem tinta, ignorando a borda transparente", () => {
    expect(caixaDoConteudo(rgba(10, 10, { x: 3, y: 5, w: 4, h: 2 }), 10, 10)).toEqual({ x: 3, y: 5, w: 4, h: 2 });
  });

  test("imagem toda transparente: nada a recortar (null)", () => {
    expect(caixaDoConteudo(rgba(10, 10), 10, 10)).toBeNull();
  });

  test("alfa quase invisível (pó de antialiasing) não conta", () => {
    const d = rgba(10, 10, { x: 4, y: 4, w: 2, h: 2 });
    d[3] = ALFA_MINIMO - 1; // canto (0,0) quase transparente
    expect(caixaDoConteudo(d, 10, 10)).toEqual({ x: 4, y: 4, w: 2, h: 2 });
  });

  test("branco só conta como vazio quando pedido (sublimação)", () => {
    const d = rgba(10, 10, { x: 0, y: 0, w: 10, h: 10, cor: [255, 255, 255] });
    // miolo colorido dentro de um fundo branco opaco
    for (let y = 3; y < 6; y++) for (let x = 2; x < 8; x++) { const i = (y * 10 + x) * 4; d[i] = 200; d[i + 1] = 0; d[i + 2] = 0; }
    expect(caixaDoConteudo(d, 10, 10)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(caixaDoConteudo(d, 10, 10, true)).toEqual({ x: 2, y: 3, w: 6, h: 3 });
  });

  test("entrada curta ou medida inválida não estoura", () => {
    expect(caixaDoConteudo(new Uint8ClampedArray(4), 10, 10)).toBeNull();
    expect(caixaDoConteudo(new Uint8ClampedArray(0), 0, 0)).toBeNull();
  });

  test("precarregarArte só recorta quem pede, e sem canvas devolve a original", async () => {
    const original = { width: 100, height: 50 } as any;
    const carregar = async () => original;
    const semPedir = await precarregarArte(arte({ imagens: [img("quadrada")] }), carregar);
    expect(semPedir.get("quadrada")).toBe(original);
    const pedindo = await precarregarArte(arte({ imagens: [img("quadrada", { aparar: true })] }), carregar);
    // jsdom não tem canvas 2D: cai na imagem original em vez de quebrar
    expect(pedindo.get("quadrada")).toBe(original);
  });

  test("o orçamento pede o recorte em toda imagem; a vitrine não", () => {
    const doOrcamento = arteNoTamanhoDoOrcamento(arte({ imagens: [img("quadrada")] }));
    expect(doOrcamento.imagens[0].aparar).toBe(true);
    expect(doOrcamento.imagens[0].caixa).toBeDefined();
  });
});

describe("ajuste manual da lojista", () => {
  test("ajusteValido segura os limites e números estranhos", () => {
    expect(ajusteValido(null)).toEqual({ escala: 1, dx: 0, dy: 0 });
    expect(ajusteValido({ escala: 99, dx: 9, dy: -9 })).toEqual({ escala: ESCALA_MAX, dx: DESLOCAMENTO_MAX, dy: -DESLOCAMENTO_MAX });
    expect(ajusteValido({ escala: 0 }).escala).toBe(ESCALA_MIN);
    expect(ajusteValido({ escala: NaN, dx: Infinity }).escala).toBe(1);
    expect(ajusteEhPadrao({ escala: 1, dx: 0, dy: 0 })).toBe(true);
    expect(ajusteEhPadrao({ escala: 1.1 })).toBe(false);
  });

  test("escala 1,5 cresce a imagem em torno do centro; 0,5 encolhe", () => {
    const base = resolver(arte({ imagens: [img("quadrada")] }))[0] as ItemImagem;
    const maior = resolver(arte({ imagens: [img("quadrada")] }), { escala: 1.5 })[0] as ItemImagem;
    const menor = resolver(arte({ imagens: [img("quadrada")] }), { escala: 0.5 })[0] as ItemImagem;
    expect(maior.w).toBeCloseTo(base.w * 1.5);
    expect(menor.w).toBeCloseTo(base.w * 0.5);
    expect(maior.cx).toBeCloseTo(base.cx);
    expect(menor.cy).toBeCloseTo(base.cy);
  });

  test("dx e dy movem a imagem em fração da área", () => {
    const base = resolver(arte({ imagens: [img("quadrada")] }))[0] as ItemImagem;
    const movida = resolver(arte({ imagens: [img("quadrada")] }), { dx: 0.1, dy: -0.05 })[0] as ItemImagem;
    expect(movida.cx - base.cx).toBeCloseTo(0.1 * AREA.w);
    expect(movida.cy - base.cy).toBeCloseTo(-0.05 * AREA.h);
  });

  test("ajustarTamanhoDaArte devolve a arte nova, dentro dos limites; null volta ao automático", () => {
    const a0 = { texto: "", imagem: "u", cor: null };
    const a1 = ajustarTamanhoDaArte(a0, { escala: 2 });
    expect(a1.ajuste).toEqual({ escala: ESCALA_MAX, dx: 0, dy: 0 });
    expect(a0).toEqual({ texto: "", imagem: "u", cor: null }); // não muta
    const a2 = ajustarTamanhoDaArte(a1, { dx: 0.2 });
    expect(a2.ajuste).toEqual({ escala: ESCALA_MAX, dx: 0.2, dy: 0 });
    expect(ajusteDaArte(a2).dx).toBe(0.2);
    expect(ajustarTamanhoDaArte(a2, null).ajuste).toBeNull();
    expect(ajusteDaArte(ajustarTamanhoDaArte(a2, null))).toEqual({ escala: 1, dx: 0, dy: 0 });
    // voltar ao padrão à mão também zera
    expect(ajustarTamanhoDaArte({ ...a0, ajuste: { escala: 1.2, dx: 0, dy: 0 } }, { escala: 1 }).ajuste).toBeNull();
  });

  test("mexer no ajuste muda a assinatura da arte (o modal regrava o vídeo)", () => {
    const a0 = { texto: "", imagem: "u", cor: null };
    expect(JSON.stringify(ajustarTamanhoDaArte(a0, { escala: 1.2 }))).not.toBe(JSON.stringify(a0));
  });

  test("a cliente que ajustou na vitrine (com largura) manda, até a lojista mexer", () => {
    const ajCliente = { v: 1, cx: 0.5, cy: 0.5, larg: 0.4, rot: 0, encaixe: "livre" } as any;
    const a = arte({ imagens: [img("quadrada", { ajuste: ajCliente })] });
    const [padrao] = resolver(a) as ItemImagem[];
    expect(padrao.w).toBeCloseTo(0.4 * AREA.w);
    const [mexido] = resolver(a, { escala: 1.2 }) as ItemImagem[];
    expect(mexido.w).not.toBeCloseTo(0.4 * AREA.w);
  });
});

describe("motorDaArte: regra única no orçamento, vitrine intacta", () => {
  const cfg: any = {
    print_area: { width_cm: 9, height_cm: 8 },
    fields: [
      { id: "f_txt", type: "text", label: "Nome", required: false, config: {} },
      { id: "f_img", type: "image", label: "Foto", required: false, config: {} },
    ],
  };

  test("com os campos do produto, a arte vai em __arte com o encaixe do orçamento", () => {
    const m = motorDaArte(cfg, {}, { texto: "Ana", imagem: "https://r2/a.png", cor: null });
    expect(m.values.text).toBe("Ana");
    expect(m.values.image).toBe("https://r2/a.png");
    const a = m.values.__arte as ArteDoLado;
    expect(a.areaCm).toEqual({ w: 9, h: 8 });
    expect(a.imagens[0].aparar).toBe(true);
    expect(a.imagens[0].caixa).toBeDefined();
    expect(a.textos[0].texto).toBe("Ana");
  });

  test("o ajuste da lojista muda a caixa que o motor recebe", () => {
    const base = motorDaArte(cfg, {}, { texto: "", imagem: "u", cor: null }).values.__arte as ArteDoLado;
    const maior = motorDaArte(cfg, {}, { texto: "", imagem: "u", cor: null, ajuste: { escala: 0.5, dx: 0, dy: 0 } }).values.__arte as ArteDoLado;
    expect(maior.imagens[0].caixa!.w).toBeCloseTo(base.imagens[0].caixa!.w * 0.5);
  });

  test("produto sem os campos: a imagem vai pelas chaves legíveis e vale a regra antiga (sem __arte vazio)", () => {
    const sem = motorDaArte({ fields: [] } as any, {}, { texto: "Ana", imagem: "u", cor: null });
    expect(sem.values).toEqual({ text: "Ana", image: "u" });
    const semCfg = motorDaArte(null, {}, { texto: "", imagem: "u", cor: null });
    expect(semCfg.values.__arte).toBeUndefined();
  });

  test("só o texto tem campo: a imagem não se perde (cai na regra antiga)", () => {
    const soTexto = { fields: [cfg.fields[0]] } as any;
    const m = motorDaArte(soTexto, {}, { texto: "Ana", imagem: "u", cor: null });
    expect(m.values.__arte).toBeUndefined();
    expect(m.values.image).toBe("u");
  });

  test("sem arte nenhuma, nada de __arte", () => {
    expect(motorDaArte(cfg, {}, { texto: "", imagem: null, cor: null }).values.__arte).toBeUndefined();
  });

  test("a técnica da peça entra quando o chamador informa", () => {
    const m = motorDaArte(cfg, {}, { texto: "", imagem: "u", cor: null }, "caneca");
    expect((m.values.__arte as ArteDoLado).tecnica).toBe("sublimacao");
    expect((motorDaArte(cfg, {}, { texto: "", imagem: "u", cor: null }).values.__arte as ArteDoLado).tecnica).toBe("outra");
  });

  test("o pedido gravado no item não leva o ajuste (só texto, imagem e cor)", () => {
    const c = customizacaoComArte(cfg, {}, { texto: "Ana", imagem: "u", cor: null, ajuste: { escala: 1.2, dx: 0, dy: 0 } });
    expect(c).toEqual({ f_txt: "Ana", f_img: "u" });
  });

  test("a VITRINE não muda: a arte de valoresDoMotor não traz caixa nem recorte", () => {
    const { arte: daVitrine } = valoresDoMotor(cfg, { f_img: "u", f_txt: "Ana" }, "front");
    expect(daVitrine.imagens[0]).toEqual({ campo: "f_img", url: "u", ajuste: null, arquivo: null });
    expect("caixa" in daVitrine.imagens[0]).toBe(false);
    expect("aparar" in daVitrine.imagens[0]).toBe(false);
  });

  test("sem caixa, o layout é o padrão de sempre (byte a byte)", () => {
    const a = arte({ imagens: [img("quadrada")], textos: [txt()] });
    const semCampos = resolverArte(a, AREA.w, AREA.h, medir);
    const comCaixaVazia = resolverArte({ ...a, imagens: a.imagens.map((i) => ({ ...i, caixa: undefined })) }, AREA.w, AREA.h, medir);
    expect(comCaixaVazia).toEqual(semCampos);
  });
});

describe("caixasDasImagens", () => {
  test("sem medida em cm, usa 3% de cada lado", () => {
    const [c] = caixasDasImagens(1, false, null);
    expect(c.x).toBeCloseTo(0.03);
    expect(c.w).toBeCloseTo(0.94);
    expect(c.y).toBeCloseTo(0.03);
    expect(c.h).toBeCloseTo(0.94);
  });
  test("zero imagens: nenhuma caixa", () => {
    expect(caixasDasImagens(0, true, AREA)).toEqual([]);
  });
});
