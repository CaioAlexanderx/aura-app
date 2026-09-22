// ============================================================
// novaVersao (PWA Fase 2) — descobrir que um deploy saiu.
//
// O que aqui segura:
//   1. a assinatura e o conjunto de scripts com hash (/_expo/static/js/...)
//      que um HTML referencia, estavel a ordem e a repeticao; sem scripts,
//      null (dev server, teste), e sem assinatura nao ha comparacao;
//   2. a busca no servidor e sem cache e nunca lanca;
//   3. a vigilancia: so checa com a tela visivel, respeita o intervalo
//      minimo ao voltar para a aba, avisa UMA vez e para; cancelar limpa
//      timer e listener.
// ============================================================
import {
  assinaturaAtual,
  assinaturaDoHtml,
  buscarAssinaturaDoServidor,
  haNovaVersao,
  iniciarVigilancia,
  INTERVALO_MINIMO_MS,
  INTERVALO_MS,
} from "@/services/novaVersao";

const HTML_A = `<!doctype html><html><head><script src="/_expo/static/js/web/entry-aaa111.js" defer></script>
<script src="/_expo/static/js/web/vendor-bbb222.js" defer></script></head><body></body></html>`;
const HTML_A_OUTRA_ORDEM = `<script src="/_expo/static/js/web/vendor-bbb222.js"></script><script src="/_expo/static/js/web/entry-aaa111.js"></script>`;
const HTML_B = `<script src="/_expo/static/js/web/entry-ccc333.js"></script>`;

function docFalso(srcs: string[], visibilityState: string = "visible") {
  const listeners = new Map<string, Set<() => void>>();
  const doc: any = {
    visibilityState,
    querySelectorAll: () => srcs.map((src) => ({ getAttribute: (n: string) => (n === "src" ? src : null) })),
    addEventListener: (ev: string, f: () => void) => { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev)!.add(f); },
    removeEventListener: (ev: string, f: () => void) => { listeners.get(ev)?.delete(f); },
    _disparar: (ev: string) => { listeners.get(ev)?.forEach((f) => f()); },
    _quantos: (ev: string) => listeners.get(ev)?.size ?? 0,
  };
  return doc;
}

function fetchDevolvendo(html: string | Error, ok: boolean = true) {
  return jest.fn(async () => {
    if (html instanceof Error) throw html;
    return { ok, text: async () => html } as any;
  });
}

describe("assinaturaDoHtml", () => {
  test("junta os scripts com hash, ordenados e sem repeticao", () => {
    expect(assinaturaDoHtml(HTML_A)).toBe("/_expo/static/js/web/entry-aaa111.js|/_expo/static/js/web/vendor-bbb222.js");
    expect(assinaturaDoHtml(HTML_A_OUTRA_ORDEM)).toBe(assinaturaDoHtml(HTML_A));
    expect(assinaturaDoHtml(HTML_A + HTML_A)).toBe(assinaturaDoHtml(HTML_A));
  });
  test("sem scripts do Expo: null", () => {
    expect(assinaturaDoHtml("<html><script src='/sw.js'></script></html>")).toBeNull();
    expect(assinaturaDoHtml("")).toBeNull();
  });
});

describe("assinaturaAtual", () => {
  test("le os <script src> da pagina", () => {
    expect(assinaturaAtual(docFalso(["/_expo/static/js/web/entry-aaa111.js", "/outra.js"]))).toBe("/_expo/static/js/web/entry-aaa111.js");
  });
  test("pagina sem scripts do Expo (dev): null", () => {
    expect(assinaturaAtual(docFalso(["/index.bundle?platform=web"]))).toBeNull();
    expect(assinaturaAtual(undefined)).toBeNull();
  });
});

describe("buscarAssinaturaDoServidor", () => {
  test("busca '/' sem cache e devolve a assinatura", async () => {
    const f = fetchDevolvendo(HTML_B);
    await expect(buscarAssinaturaDoServidor(f as any)).resolves.toBe("/_expo/static/js/web/entry-ccc333.js");
    expect(f).toHaveBeenCalledWith("/", expect.objectContaining({ cache: "no-store" }));
  });
  test("rede falhou ou resposta ruim: null, sem lancar", async () => {
    await expect(buscarAssinaturaDoServidor(fetchDevolvendo(new Error("offline")) as any)).resolves.toBeNull();
    await expect(buscarAssinaturaDoServidor(fetchDevolvendo("<html>", false) as any)).resolves.toBeNull();
    await expect(buscarAssinaturaDoServidor(undefined)).resolves.toBeNull();
  });
});

describe("haNovaVersao", () => {
  test("so quando as duas existem e diferem", () => {
    expect(haNovaVersao("a", "b")).toBe(true);
    expect(haNovaVersao("a", "a")).toBe(false);
    expect(haNovaVersao(null, "b")).toBe(false);
    expect(haNovaVersao("a", null)).toBe(false);
  });
});

describe("iniciarVigilancia", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const ATUAL = ["/_expo/static/js/web/entry-aaa111.js", "/_expo/static/js/web/vendor-bbb222.js"];

  async function avancar(ms: number) {
    jest.advanceTimersByTime(ms);
    // deixa as promises do fetch falso resolverem
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  }

  test("servidor igual: nada; servidor diferente no proximo tick: avisa UMA vez e para", async () => {
    let html = HTML_A;
    const f = jest.fn(async () => ({ ok: true, text: async () => html }));
    const doc = docFalso(ATUAL);
    const aoDetectar = jest.fn();
    iniciarVigilancia({ aoDetectar, doc, fetchFn: f as any, agora: () => Date.now() });

    await avancar(INTERVALO_MS);
    expect(f).toHaveBeenCalledTimes(1);
    expect(aoDetectar).not.toHaveBeenCalled();

    html = HTML_B;
    await avancar(INTERVALO_MS);
    expect(aoDetectar).toHaveBeenCalledTimes(1);

    // parou: mais ticks nao buscam nem avisam de novo
    await avancar(INTERVALO_MS * 3);
    expect(f).toHaveBeenCalledTimes(2);
    expect(aoDetectar).toHaveBeenCalledTimes(1);
    expect(doc._quantos("visibilitychange")).toBe(0);
  });

  test("tela escondida: nao checa; ao voltar, checa (respeitando o minimo)", async () => {
    const f = fetchDevolvendo(HTML_B);
    const doc = docFalso(ATUAL, "hidden");
    const aoDetectar = jest.fn();
    let t = 1_000_000;
    iniciarVigilancia({ aoDetectar, doc, fetchFn: f as any, agora: () => t });

    t += INTERVALO_MS; await avancar(INTERVALO_MS);
    expect(f).not.toHaveBeenCalled();

    doc.visibilityState = "visible";
    doc._disparar("visibilitychange");
    await avancar(0);
    expect(f).toHaveBeenCalledTimes(1);
    expect(aoDetectar).toHaveBeenCalledTimes(1);
  });

  test("voltar para a aba logo depois de uma checagem nao checa de novo", async () => {
    const f = fetchDevolvendo(HTML_A);
    const doc = docFalso(ATUAL);
    let t = 5_000_000;
    iniciarVigilancia({ aoDetectar: jest.fn(), doc, fetchFn: f as any, agora: () => t });

    t += INTERVALO_MS; await avancar(INTERVALO_MS);
    expect(f).toHaveBeenCalledTimes(1);

    t += INTERVALO_MINIMO_MS - 1000;
    doc._disparar("visibilitychange");
    await avancar(0);
    expect(f).toHaveBeenCalledTimes(1);

    t += 2000;
    doc._disparar("visibilitychange");
    await avancar(0);
    expect(f).toHaveBeenCalledTimes(2);
  });

  test("sem assinatura na propria pagina (dev server): nao vigia", async () => {
    const f = fetchDevolvendo(HTML_B);
    const doc = docFalso(["/index.bundle?platform=web"]);
    const parar = iniciarVigilancia({ aoDetectar: jest.fn(), doc, fetchFn: f as any });
    await avancar(INTERVALO_MS * 2);
    expect(f).not.toHaveBeenCalled();
    expect(doc._quantos("visibilitychange")).toBe(0);
    expect(() => parar()).not.toThrow();
  });

  test("cancelar limpa timer e listener", async () => {
    const f = fetchDevolvendo(HTML_A);
    const doc = docFalso(ATUAL);
    const parar = iniciarVigilancia({ aoDetectar: jest.fn(), doc, fetchFn: f as any });
    expect(doc._quantos("visibilitychange")).toBe(1);
    parar();
    expect(doc._quantos("visibilitychange")).toBe(0);
    await avancar(INTERVALO_MS * 2);
    expect(f).not.toHaveBeenCalled();
  });
});
