// ============================================================
// QA 28/09 · "Mockup na foto" mostrava a arte sem a foto
//
// A foto do R2 ficava no cache do navegador sem cabeçalho CORS (a galeria
// a carrega como <img> comum) e o pedido CORS do motor para a mesma URL
// falhava: quadro cinza, sem aviso. O motor agora:
//   1. pede a foto numa URL própria (`?mockup=1`), outra entrada de cache;
//   2. se ainda assim falhar, desenha a foto como <img> comum, sem a luz,
//      e a prévia mostra "Sem a luz da foto neste navegador".
// ============================================================
import {
  PARAMETRO_DO_MOTOR, caixaDoQuad, carregarImagemDoMotor, composeView, notaDaComposicao, urlDoMotor,
} from "@/components/studio/visualEngine/compose2d";
import type { VisualQuad, VisualView } from "@/services/studioVisualApi";

describe("a URL do motor", () => {
  test("acrescenta mockup=1 sem mexer no resto", () => {
    expect(PARAMETRO_DO_MOTOR).toBe("mockup");
    expect(urlDoMotor("https://pub.r2.dev/a/foto.jpg")).toBe("https://pub.r2.dev/a/foto.jpg?mockup=1");
    expect(urlDoMotor("https://pub.r2.dev/foto.jpg?v=3")).toBe("https://pub.r2.dev/foto.jpg?v=3&mockup=1");
    expect(urlDoMotor("https://pub.r2.dev/foto.jpg?v=3#topo")).toBe("https://pub.r2.dev/foto.jpg?v=3&mockup=1#topo");
    expect(urlDoMotor("https://pub.r2.dev/foto.jpg?")).toBe("https://pub.r2.dev/foto.jpg?mockup=1");
  });

  test("é idempotente (chamar duas vezes dá o mesmo)", () => {
    const u = urlDoMotor("https://pub.r2.dev/foto.jpg?v=3");
    expect(urlDoMotor(u)).toBe(u);
    expect(urlDoMotor("https://x/f.jpg?mockup=0")).toBe("https://x/f.jpg?mockup=0");
  });

  test("não confunde parâmetro parecido", () => {
    expect(urlDoMotor("https://x/f.jpg?mockups=2")).toBe("https://x/f.jpg?mockups=2&mockup=1");
  });

  test("data: e blob: e vazio ficam como estão", () => {
    expect(urlDoMotor("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(urlDoMotor("blob:https://loja/abc")).toBe("blob:https://loja/abc");
    expect(urlDoMotor("")).toBe("");
  });
});

describe("a nota da prévia", () => {
  test("só quando a foto entrou sem a luz, ou não entrou", () => {
    expect(notaDaComposicao({ luzDaFoto: "sem-luz" })).toBe("Sem a luz da foto neste navegador");
    expect(notaDaComposicao({ luzDaFoto: "sem-foto" })).toBe("A foto da peça não carregou agora");
    expect(notaDaComposicao({ luzDaFoto: "com-luz" })).toBeNull();
    expect(notaDaComposicao({ luzDaFoto: null })).toBeNull();
    expect(notaDaComposicao(null)).toBeNull();
  });
});

// ── O carregador com o degrau sem CORS ───────────────────────
// Image de mentira: `corsFalha` decide se o pedido COM crossOrigin falha
// (a entrada de cache sem cabeçalho); sem crossOrigin, sempre carrega.
const pedidos: Array<{ src: string; cors: boolean }> = [];
let corsFalha = (_src: string) => false;
const ImageOriginal = (global as any).Image;
beforeAll(() => {
  (global as any).Image = class {
    onload: any; onerror: any; width = 800; height = 960; naturalWidth = 800; naturalHeight = 960; crossOrigin = "";
    private _src = "";
    get src() { return this._src; }
    set src(v: string) {
      this._src = v;
      const cors = this.crossOrigin === "anonymous";
      pedidos.push({ src: v, cors });
      setTimeout(() => (cors && corsFalha(v) ? this.onerror?.() : this.onload?.()), 0);
    }
  };
});
afterAll(() => { (global as any).Image = ImageOriginal; });
beforeEach(() => { pedidos.length = 0; corsFalha = () => false; });

describe("carregarImagemDoMotor", () => {
  test("pede com CORS na URL do motor", async () => {
    const r = await carregarImagemDoMotor("https://r2/cors-ok.jpg");
    expect(r?.comCors).toBe(true);
    expect(pedidos).toEqual([{ src: "https://r2/cors-ok.jpg?mockup=1", cors: true }]);
  });

  test("CORS falhou: cai no <img> comum da URL original", async () => {
    corsFalha = () => true;
    const r = await carregarImagemDoMotor("https://r2/sem-cors.jpg");
    expect(r?.comCors).toBe(false);
    expect(pedidos).toEqual([
      { src: "https://r2/sem-cors.jpg?mockup=1", cors: true },
      { src: "https://r2/sem-cors.jpg", cors: false },
    ]);
  });
});

// ── A composição: sem CORS, foto sem luz e a nota ────────────
type Op = [string, ...any[]];
function canvasFalso(registro: Op[], nome: string) {
  const cv: any = { width: 0, height: 0, nome };
  let tainted = false;
  const ctx: any = new Proxy(
    { canvas: cv },
    {
      get(alvo: any, prop: string) {
        if (prop in alvo) return alvo[prop];
        if (prop === "measureText") return (t: string) => ({ width: t.length * 10 });
        if (prop === "getImageData") return (_x: number, _y: number, w: number, h: number) => {
          // Canvas "sujo" por foto sem CORS: o navegador não deixa ler.
          if (tainted) throw new Error("SecurityError");
          return { data: new Uint8ClampedArray(w * h * 4).fill(230), width: w, height: h };
        };
        if (prop === "createImageData") return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
        if (prop === "drawImage") return (img: any, ...resto: any[]) => {
          if (img && typeof img.src === "string" && img.crossOrigin !== "anonymous") tainted = true;
          registro.push([nome + ".drawImage", img && img.src ? "<img " + img.src + ">" : img && img.nome ? "<" + img.nome + ">" : img, ...resto]);
        };
        return (...args: any[]) => { registro.push([nome + "." + prop, ...args]); };
      },
      set(alvo: any, prop: string, valor: any) {
        registro.push([nome + "." + prop + "=", valor]);
        alvo[prop] = valor;
        return true;
      },
    }
  );
  cv.getContext = () => ctx;
  return cv;
}

const QUAD: VisualQuad = [{ x: 310, y: 240 }, { x: 690, y: 262 }, { x: 660, y: 700 }, { x: 330, y: 668 }];
function vista(foto: string): VisualView {
  return {
    id: "front", label: "Frente", base: { w: 1000, h: 1200 }, photo_url: foto, shading_url: null,
    shading_from_photo: { strength: 0.6 }, garment: null,
    areas: [{ id: "front", width_cm: 28, height_cm: 32, quad: QUAD, rect: caixaDoQuad(QUAD) }],
  };
}

describe("composeView e a luz da foto", () => {
  let criados = 0;
  let registro: Op[] = [];
  beforeAll(() => {
    jest.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag === "canvas") return canvasFalso(registro, "c" + ++criados);
      throw new Error("inesperado: " + tag);
    }) as any);
  });
  afterAll(() => { (document.createElement as any).mockRestore(); });

  test("com CORS: a foto entra, com luz, sem nota", async () => {
    registro = []; criados = 0;
    const alvo = canvasFalso(registro, "alvo");
    const r = await composeView(alvo, vista("https://r2/luz-ok.jpg"), { text: "HELENA" }, { pixelWidth: 400 });
    expect(r).toEqual({ luzDaFoto: "com-luz" });
    expect(notaDaComposicao(r)).toBeNull();
    // A camada da arte leva o sombreado (multiply sobre a camada).
    expect(registro.some((op) => op[0].startsWith("c") && op[0].endsWith(".globalCompositeOperation=") && op[1] === "multiply")).toBe(true);
  });

  test("sem CORS: a foto entra como <img> comum, a arte vai sem sombreado e a nota aparece", async () => {
    corsFalha = () => true;
    registro = []; criados = 0;
    const alvo = canvasFalso(registro, "alvo");
    const r = await composeView(alvo, vista("https://r2/so-galeria.jpg"), { text: "HELENA" }, { pixelWidth: 400 });
    expect(r).toEqual({ luzDaFoto: "sem-luz" });
    expect(notaDaComposicao(r)).toBe("Sem a luz da foto neste navegador");
    // A foto foi desenhada (não é o quadro cinza).
    expect(registro).toContainEqual(["alvo.drawImage", "<img https://r2/so-galeria.jpg>", 0, 0, 1000, 1200]);
    // A arte entra por cima, normal e opaca (sem ler a luz, não há multiply).
    expect(registro.some((op) => op[0] === "alvo.globalCompositeOperation=" && op[1] === "source-over")).toBe(true);
    expect(registro.some((op) => op[0] === "alvo.globalCompositeOperation=" && op[1] === "multiply")).toBe(false);
  });

  test("foto que não carrega de jeito nenhum: nota de foto ausente", async () => {
    const Img = (global as any).Image;
    (global as any).Image = class extends Img {
      set src(v: string) { setTimeout(() => (this as any).onerror?.(), 0); }
    };
    try {
      registro = []; criados = 0;
      const alvo = canvasFalso(registro, "alvo");
      const r = await composeView(alvo, vista("https://r2/quebrada.jpg"), { text: "HELENA" }, { pixelWidth: 400 });
      expect(r).toEqual({ luzDaFoto: "sem-foto" });
    } finally {
      (global as any).Image = Img;
    }
  });
});
