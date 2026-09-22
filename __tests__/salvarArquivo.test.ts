// ============================================================
// salvarArquivo (PWA Fase 2) — entregar um arquivo gerado no navegador.
//
// O que aqui segura:
//   1. a decisao "compartilhar em vez de baixar" so acontece no iPhone COM a
//      Aura instalada E com Web Share de arquivos. Android, computador e
//      Safari nao instalado continuam baixando como sempre;
//   2. compartilhar entrega um File com o nome certo; a pessoa fechando a
//      folha e "cancelado" (sem download por cima); share que falha por
//      outro motivo cai para o download;
//   3. o download e o de sempre: <a download>, clique, revoga a URL;
//   4. salvarTexto poe o BOM do Excel em CSV, uma vez so.
// ============================================================
import { baixarBlob, deveCompartilhar, salvarBlob, salvarTexto } from "@/utils/salvarArquivo";

const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36";
const UA_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";

function janela(opts: { ua: string; instalado: boolean; share?: boolean; canShare?: boolean; platform?: string; touch?: number }) {
  const nav: any = {
    userAgent: opts.ua,
    platform: opts.platform ?? "iPhone",
    maxTouchPoints: opts.touch ?? 5,
    standalone: opts.instalado,
  };
  if (opts.share !== false) nav.share = jest.fn().mockResolvedValue(undefined);
  if (opts.canShare !== false) nav.canShare = jest.fn(() => true);
  const w: any = { navigator: nav, matchMedia: () => ({ matches: opts.instalado }) };
  return { nav, w };
}

const arquivo = () => new File(["a;b\n1;2"], "vendas.csv", { type: "text/csv" });

// O Blob do jsdom não tem .text(); FileReader tem.
function lerBlob(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsText(b);
  });
}

// readAsText DESCARTA o BOM ao decodificar UTF-8 (é o que o padrão manda),
// então o BOM só é visível nos bytes: EF BB BF.
function lerBytes(b: Blob): Promise<Uint8Array> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => rej(r.error);
    r.readAsArrayBuffer(b);
  });
}
const comecaComBom = (b: Uint8Array) => b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
function quantosBoms(b: Uint8Array): number {
  let n = 0;
  for (let i = 0; i + 2 < b.length; i++) if (b[i] === 0xef && b[i + 1] === 0xbb && b[i + 2] === 0xbf) n++;
  return n;
}

beforeEach(() => {
  (URL as any).createObjectURL = jest.fn(() => "blob:aura/teste");
  (URL as any).revokeObjectURL = jest.fn();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("deveCompartilhar", () => {
  test("iPhone instalado com Web Share de arquivos: sim", () => {
    const { nav, w } = janela({ ua: UA_IPHONE, instalado: true });
    expect(deveCompartilhar(arquivo(), nav, w)).toBe(true);
    expect(nav.canShare).toHaveBeenCalledWith({ files: [expect.any(File)] });
  });

  test("iPhone no Safari, sem instalar: nao (o download do Safari funciona)", () => {
    const { nav, w } = janela({ ua: UA_IPHONE, instalado: false });
    expect(deveCompartilhar(arquivo(), nav, w)).toBe(false);
  });

  test("Android, mesmo instalado e com share: nao (la baixar funciona)", () => {
    const { nav, w } = janela({ ua: UA_ANDROID, instalado: true, platform: "Linux armv8l" });
    expect(deveCompartilhar(arquivo(), nav, w)).toBe(false);
  });

  test("computador: nao", () => {
    const { nav, w } = janela({ ua: UA_MAC, instalado: false, platform: "MacIntel", touch: 0 });
    expect(deveCompartilhar(arquivo(), nav, w)).toBe(false);
  });

  test("iPhone instalado mas sem share de arquivos: nao", () => {
    expect(deveCompartilhar(arquivo(), ...Object.values(janela({ ua: UA_IPHONE, instalado: true, share: false })) as [any, any])).toBe(false);
    expect(deveCompartilhar(arquivo(), ...Object.values(janela({ ua: UA_IPHONE, instalado: true, canShare: false })) as [any, any])).toBe(false);
    const { nav, w } = janela({ ua: UA_IPHONE, instalado: true });
    nav.canShare = jest.fn(() => false);
    expect(deveCompartilhar(arquivo(), nav, w)).toBe(false);
  });

  test("canShare que lanca e tratado como nao", () => {
    const { nav, w } = janela({ ua: UA_IPHONE, instalado: true });
    nav.canShare = jest.fn(() => { throw new TypeError("x"); });
    expect(deveCompartilhar(arquivo(), nav, w)).toBe(false);
  });

  test("sem janela ou navigator: nao", () => {
    expect(deveCompartilhar(arquivo(), undefined, undefined)).toBe(false);
  });
});

describe("salvarBlob", () => {
  const blob = () => new Blob(["x"], { type: "text/plain" });

  test("iPhone instalado: compartilha um File com o nome pedido", async () => {
    const { nav, w } = janela({ ua: UA_IPHONE, instalado: true });
    const r = await salvarBlob(blob(), "relatorio.txt", { nav, w, doc: document });
    expect(r).toBe("compartilhado");
    const chamada = nav.share.mock.calls[0][0];
    expect(chamada.title).toBe("relatorio.txt");
    expect(chamada.files[0]).toBeInstanceOf(File);
    expect(chamada.files[0].name).toBe("relatorio.txt");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  test("a pessoa fechou a folha (AbortError): 'cancelado', sem download por cima", async () => {
    const { nav, w } = janela({ ua: UA_IPHONE, instalado: true });
    nav.share = jest.fn().mockRejectedValue(Object.assign(new Error("abort"), { name: "AbortError" }));
    const r = await salvarBlob(blob(), "a.txt", { nav, w, doc: document });
    expect(r).toBe("cancelado");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  test("share falhou por outro motivo: cai para o download", async () => {
    const { nav, w } = janela({ ua: UA_IPHONE, instalado: true });
    nav.share = jest.fn().mockRejectedValue(new Error("NotAllowedError"));
    const r = await salvarBlob(blob(), "a.txt", { nav, w, doc: document });
    expect(r).toBe("baixado");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  test("Android: baixa como sempre, sem tocar no share", async () => {
    const { nav, w } = janela({ ua: UA_ANDROID, instalado: true, platform: "Linux armv8l" });
    const r = await salvarBlob(blob(), "a.txt", { nav, w, doc: document });
    expect(r).toBe("baixado");
    expect(nav.share).not.toHaveBeenCalled();
  });

  test("fora do web: 'indisponivel', nada acontece", async () => {
    const r = await salvarBlob(blob(), "a.txt", { nav: undefined, w: undefined, doc: undefined });
    expect(r).toBe("indisponivel");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

describe("baixarBlob (o download de sempre)", () => {
  test("cria o <a download>, clica, remove e revoga a URL depois", () => {
    const clique = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const antes = document.body.childElementCount;
    baixarBlob(new Blob(["x"]), "arquivo.csv");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clique).toHaveBeenCalledTimes(1);
    expect(document.body.childElementCount).toBe(antes); // o <a> nao fica pendurado
    expect(URL.revokeObjectURL).not.toHaveBeenCalled(); // so depois: Safari perde o arquivo se revogar na hora
    jest.advanceTimersByTime(4000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:aura/teste");
    clique.mockRestore();
  });
});

describe("salvarTexto", () => {
  test("CSV ganha o BOM do Excel, uma vez so", async () => {
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    let capturado: Blob | null = null;
    (URL as any).createObjectURL = jest.fn((b: Blob) => { capturado = b; return "blob:x"; });
    await expect(salvarTexto("a;b\n1;2", "v.csv", "text/csv;charset=utf-8")).resolves.toBe("baixado");
    const bytes = await lerBytes(capturado as unknown as Blob);
    expect(comecaComBom(bytes)).toBe(true);
    expect(quantosBoms(bytes)).toBe(1);
    expect(await lerBlob(capturado as unknown as Blob)).toBe("a;b\n1;2"); // o conteudo em si intacto
    // ja com BOM: nao duplica
    await salvarTexto("﻿a;b", "v2.csv", "text/csv;charset=utf-8");
    expect(quantosBoms(await lerBytes(capturado as unknown as Blob))).toBe(1);
  });

  test("texto comum nao ganha BOM", async () => {
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    let capturado: Blob | null = null;
    (URL as any).createObjectURL = jest.fn((b: Blob) => { capturado = b; return "blob:x"; });
    await salvarTexto("ola", "nota.txt");
    expect(await lerBlob(capturado as unknown as Blob)).toBe("ola");
    expect(comecaComBom(await lerBytes(capturado as unknown as Blob))).toBe(false);
  });
});
