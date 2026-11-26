/** @jest-environment jsdom */
// Vídeo do orçamento 3D: medição por flag e opções só da gravação (26/11/2026).
import {
  limitarProgresso, criarCronometro, gravarGiro, abrirPalco, debugVideoLigado, type Palco,
} from "@/components/studio/orcamentoVideo/gravarGiro";
import { createModelViewer } from "@/components/studio/visualEngine/compose3dMug";

jest.mock("@/services/studioVisualApi", () => ({ studioVisualApi: {} }));
jest.mock("@/components/studio/visualEngine/compose3dMug", () => ({ createModelViewer: jest.fn() }));

describe("progresso limitado a ~10 por segundo", () => {
  test("30 quadros/s viram ~10 atualizações/s; 0 e 1 sempre passam", () => {
    let agora = 0;
    const visto: number[] = [];
    const lim = limitarProgresso((f) => visto.push(f), 100, () => agora);
    lim(0);
    const n = 210;
    for (let i = 0; i < n; i++) {
      agora = (i * 1000) / 30;
      lim((i + 1) / n);
    }
    expect(visto[0]).toBe(0);
    expect(visto[visto.length - 1]).toBe(1);
    // 7 s a 10/s = ~70 (+ 0 e 1); nunca perto dos 210 de antes
    expect(visto.length).toBeGreaterThan(60);
    expect(visto.length).toBeLessThan(85);
  });
});

describe("medição só com a flag", () => {
  afterEach(() => { localStorage.clear(); jest.restoreAllMocks(); });

  test("sem a flag nada aparece no console", () => {
    const tabela = jest.spyOn(console, "table").mockImplementation(() => {});
    expect(debugVideoLigado()).toBe(false);
    const c = criarCronometro();
    c.soma("render", c.marca());
    c.tabela({ x: 1 });
    expect(tabela).not.toHaveBeenCalled();
  });

  test("com aura_debug_video=1 sai um console.table com as etapas", () => {
    localStorage.setItem("aura_debug_video", "1");
    const tabela = jest.spyOn(console, "table").mockImplementation(() => {});
    let t = 0;
    const c = criarCronometro(debugVideoLigado(), () => (t += 10));
    c.soma("render", c.marca());
    c.soma("render", c.marca());
    c.tabela({ "pré-roll": 500 });
    expect(tabela).toHaveBeenCalledTimes(1);
    const linhas = tabela.mock.calls[0][0] as any;
    expect(linhas.render.quadros).toBe(2);
    expect(linhas["pré-roll"].totalMs).toBe(500);
  });

  test("localStorage que lança não quebra", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(debugVideoLigado()).toBe(false);
  });
});

describe("opções da gravação", () => {
  const spec: any = {};

  test("o palco da gravação abre com pixelRatio 1, mesmo que as opções peçam outro", async () => {
    (createModelViewer as jest.Mock).mockResolvedValue({ dispose: jest.fn() });
    const palco = await abrirPalco(spec, {}, { pixelRatio: 2 } as any);
    const opts = (createModelViewer as jest.Mock).mock.calls.at(-1)![3];
    expect(opts.pixelRatio).toBe(1);
    expect(opts.cenario).toBe("estudio");
    palco.fechar();
  });

  function palcoFalso() {
    const modo = jest.fn();
    const canvas = document.createElement("canvas");
    canvas.width = 720; canvas.height = 900;
    const palco = { viewer: { modoGravacao: modo, renderizarQuadro: jest.fn() }, canvas, fechar: jest.fn() } as unknown as Palco;
    return { palco, modo };
  }

  test("liga o modo de gravação e restaura ao terminar (sem codificador: devolve null)", async () => {
    const { palco, modo } = palcoFalso();
    const v = await gravarGiro(palco, { nome: "Loja" }, false);
    expect(v).toBeNull();
    expect(modo.mock.calls).toEqual([[true], [false]]);
  });

  test("restaura também quando a gravação falha", async () => {
    const { palco, modo } = palcoFalso();
    (palco.viewer.renderizarQuadro as jest.Mock).mockImplementation(() => { throw new Error("gl perdido"); });
    (globalThis as any).MediaRecorder = class { static isTypeSupported() { return false; } start() { throw new Error("falhou"); } };
    (HTMLCanvasElement.prototype as any).captureStream = () => ({});
    try {
      await expect(gravarGiro(palco, { nome: "Loja" }, false)).rejects.toThrow();
    } finally {
      delete (globalThis as any).MediaRecorder;
      delete (HTMLCanvasElement.prototype as any).captureStream;
    }
    expect(modo.mock.calls).toEqual([[true], [false]]);
  });
});
