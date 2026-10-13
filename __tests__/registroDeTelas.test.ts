// ============================================================
// Registro de telas visitadas — a lógica (services/registroDeTelas.ts).
//
// O QUE ESTES TESTES GUARDAM:
//
// 1. O nome da tela é o da ROTA: grupos "(x)" e parâmetros "[x]" saem,
//    telas de autenticação não contam, 64 caracteres no máximo.
// 2. O lote sai a cada 60 s e na saída da página (aba escondida), uma
//    vez, e o acumulado zera.
// 3. Erro de envio (404 — endpoint ainda não existe —, 5xx, rede) some
//    em silêncio: sem retry, sem fila, uma linha de console.debug.
// 4. O lote é do TOKEN em que foi acumulado: trocar de empresa não
//    atribui visita à empresa errada.
// ============================================================
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({
  BASE_URL: "http://api.test/v1",
  request: (...a: any[]) => mockRequest(...a),
}));

import {
  criarRegistroDeTelas,
  nomeDaTela,
  INTERVALO_DO_LOTE_MS,
  MAX_NOME_DA_TELA,
  MAX_TELAS_POR_LOTE,
} from "@/services/registroDeTelas";

function esconderAba(estado: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => estado });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("nomeDaTela — nome da rota", () => {
  test("segmentos viram o caminho, sem grupos", () => {
    expect(nomeDaTela(["(tabs)", "pdv"])).toBe("pdv");
    expect(nomeDaTela(["(tabs)", "estoque"])).toBe("estoque");
    expect(nomeDaTela(["(tabs)", "crediario"])).toBe("crediario");
    expect(nomeDaTela(["(tabs)", "configuracoes"])).toBe("configuracoes");
    expect(nomeDaTela(["studio", "(estudio)", "pedidos"])).toBe("studio/pedidos");
    expect(nomeDaTela(["food", "(salao)", "mesas"])).toBe("food/mesas");
  });

  test("parâmetros dinâmicos saem", () => {
    expect(nomeDaTela(["(tabs)", "clientes", "[id]"])).toBe("clientes");
    expect(nomeDaTela(["karate", "[slug]", "ranking"])).toBe("karate/ranking");
    expect(nomeDaTela(["(tabs)", "docs", "[...resto]"])).toBe("docs");
  });

  test("raiz do shell é o painel", () => {
    expect(nomeDaTela(["(tabs)"])).toBe("painel");
  });

  test("autenticação, rota não encontrada e só-parâmetro não contam", () => {
    expect(nomeDaTela(["(auth)", "login"])).toBeNull();
    expect(nomeDaTela(["(auth)"])).toBeNull();
    expect(nomeDaTela(["+not-found"])).toBeNull();
    expect(nomeDaTela(["[slug]"])).toBeNull();
    expect(nomeDaTela([])).toBeNull();
    expect(nomeDaTela(undefined)).toBeNull();
  });

  test("limita a 64 caracteres, sem barra sobrando no fim", () => {
    const longo = nomeDaTela(["a".repeat(40), "b".repeat(40)])!;
    expect(longo.length).toBeLessThanOrEqual(MAX_NOME_DA_TELA);
    expect(longo.endsWith("/")).toBe(false);
    // corte caindo exatamente na barra
    const naBarra = nomeDaTela(["a".repeat(63), "b".repeat(10)])!;
    expect(naBarra).toBe("a".repeat(63));
  });
});

describe("registro — acúmulo e envio", () => {
  let enviar: jest.Mock;
  let debug: jest.SpyInstance;
  let relogio: number;
  const agora = () => new Date(relogio);

  beforeEach(() => {
    jest.useFakeTimers();
    relogio = Date.UTC(2026, 9, 13, 12, 0, 0);
    enviar = jest.fn().mockResolvedValue({});
    debug = jest.spyOn(console, "debug").mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    debug.mockRestore();
    esconderAba("visible");
  });

  test("cada entrada soma 1 e guarda primeira e última vez", () => {
    const r = criarRegistroDeTelas(enviar, agora);
    r.registrar("pdv", "tk");
    relogio += 5000;
    r.registrar("pdv", "tk");
    relogio += 5000;
    r.registrar("estoque", "tk");
    r.descarregar();

    expect(enviar).toHaveBeenCalledTimes(1);
    const [token, views] = enviar.mock.calls[0];
    expect(token).toBe("tk");
    expect(views).toEqual([
      { screen: "pdv", count: 2, first_at: "2026-10-13T12:00:00.000Z", last_at: "2026-10-13T12:00:05.000Z" },
      { screen: "estoque", count: 1, first_at: "2026-10-13T12:00:10.000Z", last_at: "2026-10-13T12:00:10.000Z" },
    ]);
  });

  test("lote sai após 60 s e o acumulado zera", () => {
    const r = criarRegistroDeTelas(enviar, agora);
    const parar = r.iniciar();
    r.registrar("pdv", "tk");

    jest.advanceTimersByTime(INTERVALO_DO_LOTE_MS - 1);
    expect(enviar).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(r.pendentes()).toBe(0);

    // nada novo: o próximo tique não manda lote vazio
    jest.advanceTimersByTime(INTERVALO_DO_LOTE_MS);
    expect(enviar).toHaveBeenCalledTimes(1);
    parar();
  });

  test("aba escondida manda na hora, uma vez; voltar à aba não manda nada", () => {
    const r = criarRegistroDeTelas(enviar, agora);
    const parar = r.iniciar();
    r.registrar("relatorios", "tk");

    esconderAba("visible");
    expect(enviar).not.toHaveBeenCalled();
    esconderAba("hidden");
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][2]).toBe(true); // aoSair → fetch keepalive
    esconderAba("hidden");
    expect(enviar).toHaveBeenCalledTimes(1);
    parar();
  });

  test("pagehide manda na hora", () => {
    const r = criarRegistroDeTelas(enviar, agora);
    const parar = r.iniciar();
    r.registrar("pdv", "tk");
    window.dispatchEvent(new Event("pagehide"));
    expect(enviar).toHaveBeenCalledTimes(1);
    parar();
  });

  test("desligar manda o que sobrou e solta os ouvintes", () => {
    const r = criarRegistroDeTelas(enviar, agora);
    const parar = r.iniciar();
    r.registrar("pdv", "tk");
    parar();
    expect(enviar).toHaveBeenCalledTimes(1);

    r.registrar("pdv", "tk");
    esconderAba("hidden");
    jest.advanceTimersByTime(INTERVALO_DO_LOTE_MS * 2);
    expect(enviar).toHaveBeenCalledTimes(1); // ninguém mais ouve
  });

  test("troca de token manda o lote antigo com o token antigo", () => {
    const r = criarRegistroDeTelas(enviar, agora);
    r.registrar("pdv", "empresa-A");
    r.registrar("estoque", "empresa-B");

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0]).toBe("empresa-A");
    expect(enviar.mock.calls[0][1].map((v: any) => v.screen)).toEqual(["pdv"]);

    r.descarregar();
    expect(enviar.mock.calls[1][0]).toBe("empresa-B");
    expect(enviar.mock.calls[1][1].map((v: any) => v.screen)).toEqual(["estoque"]);
  });

  test("passa de 50 telas: sai em partes de no máximo 50", () => {
    const r = criarRegistroDeTelas(enviar, agora);
    for (let i = 0; i < 120; i++) r.registrar("tela-" + i, "tk");
    r.descarregar();
    const tamanhos = enviar.mock.calls.map((c) => c[1].length);
    expect(tamanhos).toEqual([MAX_TELAS_POR_LOTE, MAX_TELAS_POR_LOTE, 20]);
  });

  test("sem token ou sem tela não registra", () => {
    const r = criarRegistroDeTelas(enviar, agora);
    r.registrar("pdv", "");
    r.registrar("", "tk");
    expect(r.pendentes()).toBe(0);
    r.descarregar();
    expect(enviar).not.toHaveBeenCalled();
  });
});

describe("registro — falha some em silêncio", () => {
  let debug: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    debug = jest.spyOn(console, "debug").mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    debug.mockRestore();
  });

  async function esperar() {
    await Promise.resolve();
    await Promise.resolve();
  }

  test("404 descarta, não repete e não faz barulho além de um debug", async () => {
    const enviar = jest.fn().mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    const r = criarRegistroDeTelas(enviar);
    const parar = r.iniciar();

    r.registrar("pdv", "tk");
    jest.advanceTimersByTime(INTERVALO_DO_LOTE_MS);
    await esperar();
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(r.pendentes()).toBe(0); // foi descartado, não volta

    // outro lote com a mesma falha: nenhum log novo
    r.registrar("estoque", "tk");
    jest.advanceTimersByTime(INTERVALO_DO_LOTE_MS);
    await esperar();
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(debug).toHaveBeenCalledTimes(1);
    expect(aviso).not.toHaveBeenCalled();
    expect(erro).not.toHaveBeenCalled();

    aviso.mockRestore();
    erro.mockRestore();
    parar();
  });

  test("exceção síncrona do envio não escapa", () => {
    const enviar = jest.fn(() => {
      throw new Error("boom");
    });
    const r = criarRegistroDeTelas(enviar as any);
    r.registrar("pdv", "tk");
    expect(() => r.descarregar()).not.toThrow();
    expect(r.pendentes()).toBe(0);
  });
});

describe("envio padrão", () => {
  beforeEach(() => {
    mockRequest.mockReset();
    jest.spyOn(console, "debug").mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).fetch;
  });

  test("no intervalo usa o cliente autenticado, com o token do lote e sem retry", async () => {
    mockRequest.mockResolvedValue({});
    const r = criarRegistroDeTelas();
    r.registrar("pdv", "tk-1");
    r.descarregar();
    await Promise.resolve();

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const [path, opts] = mockRequest.mock.calls[0];
    expect(path).toBe("/usage/screens");
    expect(opts).toMatchObject({ method: "POST", token: "tk-1", retry: 0 });
    expect(opts.body.views[0]).toMatchObject({ screen: "pdv", count: 1 });
  });

  test("na saída da página usa fetch keepalive com Authorization", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as any).fetch = fetchMock;
    const r = criarRegistroDeTelas();
    r.registrar("pdv", "tk-2");
    r.descarregar(true);
    await Promise.resolve();

    expect(mockRequest).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/v1/usage/screens");
    expect(init.keepalive).toBe(true);
    expect(init.headers.Authorization).toBe("Bearer tk-2");
    expect(JSON.parse(init.body).views[0].screen).toBe("pdv");
  });

  test("fetch que rejeita (rede) também some em silêncio", async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const r = criarRegistroDeTelas();
    r.registrar("pdv", "tk");
    expect(() => r.descarregar(true)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(r.pendentes()).toBe(0);
  });
});
