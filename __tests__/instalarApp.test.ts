// ============================================================
// Instalar a Aura como app (PWA Fase 1) — a lógica sem React.
//
// O que aqui segura:
//   1. detectar iPhone/iPad, inclusive o iPad que finge ser Mac;
//   2. "já está instalado" via display-mode standalone OU navigator.standalone,
//      sem quebrar quando matchMedia não existe (jsdom, navegadores velhos);
//   3. o convite do Chrome: capturado pelo evento OU pelo que o index.html
//      guardou em window.__auraConvite antes do JS do app; preventDefault
//      chamado (senão o Chrome mostra a barrinha dele na hora que quiser);
//      serve UMA vez; appinstalled limpa; ouvintes são avisados;
//   4. "Agora não" por 14 dias, com localStorage ausente, lançando ou com
//      lixo dentro — nunca derruba o Painel, sempre cai para "não dispensado".
// ============================================================
import {
  _resetParaTestes,
  aoMudar,
  DIAS_DE_DISPENSA,
  dispensar,
  ehIos,
  estaDispensado,
  estadoDaInstalacao,
  estaInstalado,
  instalar,
} from "@/services/instalarApp";

function definirNavigator(campos: Record<string, unknown>) {
  for (const [k, v] of Object.entries(campos)) {
    Object.defineProperty(window.navigator, k, { value: v, configurable: true });
  }
}

function conviteFalso(outcome: "accepted" | "dismissed" = "accepted") {
  const ev: any = new Event("beforeinstallprompt", { cancelable: true });
  ev.prompt = jest.fn().mockResolvedValue(undefined);
  ev.userChoice = Promise.resolve({ outcome });
  return ev;
}

const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36";
const UA_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";

beforeEach(() => {
  _resetParaTestes();
  delete (window as any).matchMedia;
  definirNavigator({ userAgent: UA_ANDROID, maxTouchPoints: 0, platform: "Linux armv8l", standalone: undefined });
  try { window.localStorage.clear(); } catch { /* jsdom sem storage */ }
});

describe("ehIos", () => {
  test("iPhone e iPad pelo user agent", () => {
    expect(ehIos(UA_IPHONE)).toBe(true);
    expect(ehIos("Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X)")).toBe(true);
  });
  test("iPadOS 13+ se apresenta como Mac; o toque entrega", () => {
    expect(ehIos(UA_MAC, 5, "MacIntel")).toBe(true);
  });
  test("Mac de verdade e Android não são iOS", () => {
    expect(ehIos(UA_MAC, 0, "MacIntel")).toBe(false);
    expect(ehIos(UA_ANDROID, 5, "Linux armv8l")).toBe(false);
  });
});

describe("estaInstalado", () => {
  test("display-mode: standalone", () => {
    expect(estaInstalado({ matchMedia: () => ({ matches: true }), navigator: {} })).toBe(true);
    expect(estaInstalado({ matchMedia: () => ({ matches: false }), navigator: {} })).toBe(false);
  });
  test("navigator.standalone (Safari antigo) vale como instalado", () => {
    expect(estaInstalado({ navigator: { standalone: true } })).toBe(true);
    expect(estaInstalado({ navigator: { standalone: false } })).toBe(false);
  });
  test("matchMedia ausente ou quebrado não derruba: cai no navigator", () => {
    expect(estaInstalado({ navigator: {} })).toBe(false);
    expect(estaInstalado({ matchMedia: () => { throw new Error("x"); }, navigator: { standalone: true } })).toBe(true);
  });
  test("sem janela, não está instalado", () => {
    expect(estaInstalado(undefined)).toBe(false);
  });
});

describe("estadoDaInstalacao", () => {
  test("Android sem convite: nada a oferecer ainda", () => {
    const e = estadoDaInstalacao();
    expect(e).toEqual({ instalado: false, podeInstalar: false, ehIphone: false, plataforma: "android" });
  });

  test("iPhone fora do app: guia, não botão", () => {
    definirNavigator({ userAgent: UA_IPHONE, maxTouchPoints: 5, platform: "iPhone" });
    const e = estadoDaInstalacao();
    expect(e.ehIphone).toBe(true);
    expect(e.podeInstalar).toBe(false);
    expect(e.plataforma).toBe("iphone");
  });

  test("iPhone já instalado: nem guia nem botão", () => {
    definirNavigator({ userAgent: UA_IPHONE, maxTouchPoints: 5, platform: "iPhone", standalone: true });
    const e = estadoDaInstalacao();
    expect(e.instalado).toBe(true);
    expect(e.ehIphone).toBe(false);
    expect(e.podeInstalar).toBe(false);
  });

  test("computador sem convite: plataforma desktop, nada a oferecer", () => {
    definirNavigator({ userAgent: UA_MAC, maxTouchPoints: 0, platform: "MacIntel" });
    expect(estadoDaInstalacao().plataforma).toBe("desktop");
    expect(estadoDaInstalacao().podeInstalar).toBe(false);
  });
});

describe("o convite do Chrome (beforeinstallprompt)", () => {
  test("chega pelo evento: preventDefault, podeInstalar, ouvintes avisados", () => {
    const ouvinte = jest.fn();
    aoMudar(ouvinte);
    expect(estadoDaInstalacao().podeInstalar).toBe(false);

    const ev = conviteFalso();
    window.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(estadoDaInstalacao().podeInstalar).toBe(true);
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  test("chega antes do JS do app: lido de window.__auraConvite (index.html)", () => {
    (window as any).__auraConvite = conviteFalso();
    expect(estadoDaInstalacao().podeInstalar).toBe(true);
  });

  test("instalar() chama o prompt, devolve 'aceito' e o convite não serve de novo", async () => {
    const ev = conviteFalso("accepted");
    window.dispatchEvent(ev);
    const ouvinte = jest.fn();
    aoMudar(ouvinte);

    await expect(instalar()).resolves.toBe("aceito");
    expect(ev.prompt).toHaveBeenCalledTimes(1);
    expect(estadoDaInstalacao().podeInstalar).toBe(false);
    expect((window as any).__auraConvite).toBeNull();
    expect(ouvinte).toHaveBeenCalled();
    await expect(instalar()).resolves.toBe("indisponivel");
  });

  test("recusado no diálogo do Chrome vira 'recusado'", async () => {
    window.dispatchEvent(conviteFalso("dismissed"));
    await expect(instalar()).resolves.toBe("recusado");
  });

  test("prompt() que lança vira 'indisponivel', não exceção", async () => {
    const ev = conviteFalso();
    ev.prompt = jest.fn().mockRejectedValue(new Error("já mostrado"));
    window.dispatchEvent(ev);
    await expect(instalar()).resolves.toBe("indisponivel");
  });

  test("appinstalled limpa o convite e avisa", () => {
    window.dispatchEvent(conviteFalso());
    const ouvinte = jest.fn();
    aoMudar(ouvinte);
    window.dispatchEvent(new Event("appinstalled"));
    expect(estadoDaInstalacao().podeInstalar).toBe(false);
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  test("convite não vale quando já está instalado", () => {
    (window as any).matchMedia = () => ({ matches: true, addEventListener: () => {} });
    window.dispatchEvent(conviteFalso());
    const e = estadoDaInstalacao();
    expect(e.instalado).toBe(true);
    expect(e.podeInstalar).toBe(false);
  });

  test("cancelar a inscrição para de avisar; ouvinte quebrado não derruba os outros", () => {
    const quebrado = jest.fn(() => { throw new Error("boom"); });
    const sao = jest.fn();
    const cancelar = aoMudar(quebrado);
    aoMudar(sao);
    window.dispatchEvent(conviteFalso());
    expect(sao).toHaveBeenCalledTimes(1);
    cancelar();
    window.dispatchEvent(new Event("appinstalled"));
    expect(quebrado).toHaveBeenCalledTimes(1);
    expect(sao).toHaveBeenCalledTimes(2);
  });
});

describe("'Agora não' por 14 dias", () => {
  const AGORA = Date.UTC(2026, 8, 22, 12, 0, 0);

  function storageEmMemoria(): Storage {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
      setItem: (k: string, v: string) => { m.set(k, String(v)); },
      removeItem: (k: string) => { m.delete(k); },
      clear: () => m.clear(),
      key: () => null,
      get length() { return m.size; },
    } as Storage;
  }

  test("dispensar grava uma data exatamente 14 dias à frente", () => {
    const s = storageEmMemoria();
    dispensar(AGORA, s);
    const gravado = Date.parse(s.getItem("aura.instalarApp.dispensadoAte")!);
    expect(gravado - AGORA).toBe(DIAS_DE_DISPENSA * 864e5);
  });

  test("vale até o dia 14 e cai no dia 15", () => {
    const s = storageEmMemoria();
    dispensar(AGORA, s);
    expect(estaDispensado(AGORA, s)).toBe(true);
    expect(estaDispensado(AGORA + 13 * 864e5, s)).toBe(true);
    expect(estaDispensado(AGORA + DIAS_DE_DISPENSA * 864e5, s)).toBe(false);
    expect(estaDispensado(AGORA + 40 * 864e5, s)).toBe(false);
  });

  test("sem nada gravado, não está dispensado", () => {
    expect(estaDispensado(AGORA, storageEmMemoria())).toBe(false);
  });

  test("lixo no storage não é dispensa", () => {
    const s = storageEmMemoria();
    s.setItem("aura.instalarApp.dispensadoAte", "ontem à tarde");
    expect(estaDispensado(AGORA, s)).toBe(false);
  });

  test("storage ausente: ler é false, gravar não lança", () => {
    expect(estaDispensado(AGORA, null)).toBe(false);
    expect(() => dispensar(AGORA, null)).not.toThrow();
  });

  test("storage que lança (modo privado, cota): ler é false, gravar não lança", () => {
    const explosivo = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceededError"); },
    } as unknown as Storage;
    expect(estaDispensado(AGORA, explosivo)).toBe(false);
    expect(() => dispensar(AGORA, explosivo)).not.toThrow();
  });

  test("usa o localStorage da janela por padrão", () => {
    dispensar(AGORA);
    expect(estaDispensado(AGORA)).toBe(true);
    expect(estaDispensado(AGORA + 15 * 864e5)).toBe(false);
  });
});
