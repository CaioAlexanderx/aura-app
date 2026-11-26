// ============================================================
// WhatsApp · Conversas: áudio e foto na conversa aberta.
//
// 1. O botão de áudio só existe onde há microfone + MediaRecorder; foto sempre.
// 2. Gravar → "Gravando 0:07" → Mandar áudio envia o que o Chrome gravou
//    (WebM/Opus, em base64) com o tipo; o servidor converte.
// 3. Cancelar solta o microfone e não envia; microfone negado explica.
// 4. Foto: prévia com legenda, depois Mandar foto.
// 5. Bolha: áudio vira player, foto vira imagem; sem arquivo, texto honesto.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/constants/helpers", () => ({ ...jest.requireActual("@/constants/helpers"), IS_WIDE: true }));

let mockAuth: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));

const mockHub: Record<string, jest.Mock> = {
  settings: jest.fn(), conversations: jest.fn(), messages: jest.fn(), midia: jest.fn(),
  send: jest.fn(), catalogo: jest.fn(), orcamentos: jest.fn(),
};
jest.mock("@/services/hubApi", () => ({
  hubApi: new Proxy({}, { get: (_t, k: string) => (...a: any[]) => (mockHub as any)[k](...a) }),
}));

const mockEscolher = jest.fn();
const mockPrepararFoto = jest.fn();
jest.mock("@/components/screens/hub/midiaWeb", () => ({
  ...jest.requireActual("@/components/screens/hub/midiaWeb"),
  escolherArquivo: (...a: any[]) => mockEscolher(...a),
  prepararFoto: (...a: any[]) => mockPrepararFoto(...a),
}));

import { HubView } from "@/components/screens/hub/HubView";
import { textoDaBolha } from "@/components/screens/hub/BolhaDeMidia";
import { relogio, escolherMimeDeGravacao } from "@/components/screens/hub/midiaWeb";

const COMPANY = "645c1325-8865-48be-af6f-430d93fb2b6c";
const recente = new Date(Date.now() - 2 * 3600000).toISOString();
const CONV = {
  id: "conv-1", channel: "whatsapp", external_id: "5511988887777", customer_id: null, customer_name: "Ana",
  status: "humano", category: null, handoff_reason: null, last_inbound_at: recente,
  last_message_at: recente, last_message_preview: "oi", pending_approvals: 0,
};

// ── MediaRecorder falso ──
let agora = 1_000_000;
let tracksParados = 0;
let negarMicrofone = false;
let quebrarRecorder = false;
let ultimasOpcoes: any = null;
class FakeRecorder {
  static isTypeSupported = (t: string) => t === "audio/webm;codecs=opus";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: any; onstop: any; onerror: any;
  constructor(public stream: any, public opts?: any) {
    if (quebrarRecorder) throw new Error("NotSupportedError");
    ultimasOpcoes = opts;
  }
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(["opus!"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function instalarMicrofone() {
  (globalThis as any).MediaRecorder = FakeRecorder;
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn(async () => {
        if (negarMicrofone) throw new Error("NotAllowedError");
        return { getTracks: () => [{ stop: () => { tracksParados++; } }] };
      }),
    },
  });
}
function removerMicrofone() {
  delete (globalThis as any).MediaRecorder;
  Object.defineProperty(globalThis.navigator, "mediaDevices", { configurable: true, value: undefined });
}

let qc: QueryClient;
let tree: renderer.ReactTestRenderer | null = null;

beforeEach(() => {
  Object.values(mockHub).forEach((f) => f.mockReset());
  mockEscolher.mockReset(); mockPrepararFoto.mockReset();
  mockAuth = { company: { id: COMPANY, member_role: "owner" }, isStaff: false };
  mockHub.settings.mockResolvedValue({ enabled: false, approval_mode: true, model: null, extra_instructions: null });
  mockHub.conversations.mockResolvedValue({ conversations: [CONV], counts: [] });
  mockHub.messages.mockResolvedValue({ conversation: CONV, messages: [], pending_approvals: [] });
  mockHub.midia.mockResolvedValue({ ok: true, wamid: "w1" });
  agora = 1_000_000; tracksParados = 0; negarMicrofone = false; quebrarRecorder = false; ultimasOpcoes = null;
  jest.spyOn(Date, "now").mockImplementation(() => agora);
  instalarMicrofone();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  if (tree) act(() => { tree!.unmount(); });
  tree = null;
  qc.clear();
  removerMicrofone();
  jest.restoreAllMocks();
});

const flush = async (n = 4) => {
  for (let i = 0; i < n; i++) await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
};
async function abrirThread() {
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><HubView /></QueryClientProvider>);
  });
  await flush();
  await act(async () => { tree!.root.findAllByProps({ testID: "hub-conv-conv-1" }, { deep: false })[0].props.onPress(); });
  await flush();
  return tree!;
}
const porId = (r: renderer.ReactTestRenderer, id: string) => r.root.findAllByProps({ testID: id }, { deep: false });
const textoDe = (n: any): string => (typeof n === "string" ? n : Array.isArray(n.children) ? n.children.map(textoDe).join("") : n.children ? textoDe(n.children) : "");
const tudo = (r: renderer.ReactTestRenderer) => textoDe(r.toJSON());

describe("botões", () => {
  it("com microfone: Foto e Áudio", async () => {
    const r = await abrirThread();
    expect(porId(r, "hub-envio-foto")).toHaveLength(1);
    expect(porId(r, "hub-envio-audio")).toHaveLength(1);
  });

  it("sem MediaRecorder o botão de áudio não existe, a foto continua", async () => {
    removerMicrofone();
    const r = await abrirThread();
    expect(porId(r, "hub-envio-audio")).toHaveLength(0);
    expect(porId(r, "hub-envio-foto")).toHaveLength(1);
  });

  it("conversa fechada: nenhum dos dois", async () => {
    const velha = new Date(Date.now() - 30 * 3600000).toISOString();
    mockHub.conversations.mockResolvedValue({ conversations: [{ ...CONV, last_inbound_at: velha }], counts: [] });
    mockHub.messages.mockResolvedValue({ conversation: { ...CONV, last_inbound_at: velha }, messages: [], pending_approvals: [] });
    const r = await abrirThread();
    expect(porId(r, "hub-envio-audio")).toHaveLength(0);
    expect(porId(r, "hub-envio-foto")).toHaveLength(0);
  });
});

describe("gravar áudio", () => {
  it("grava, mostra o tempo e manda o que o Chrome gravou", async () => {
    const r = await abrirThread();
    await act(async () => { await porId(r, "hub-envio-audio")[0].props.onPress(); });
    await flush();
    expect(porId(r, "hub-gravando")).toHaveLength(1);
    agora += 7000;
    await act(async () => { await new Promise((x) => setTimeout(x, 300)); });
    expect(tudo(r)).toContain("Gravando 0:07");
    await act(async () => { await porId(r, "hub-envio-audio")[0].props.onPress(); });
    await flush(6);
    expect(mockHub.midia).toHaveBeenCalledTimes(1);
    const [company, conv, body] = mockHub.midia.mock.calls[0];
    expect([company, conv]).toEqual([COMPANY, "conv-1"]);
    expect(body.kind).toBe("audio");
    expect(body.mime).toBe("audio/webm;codecs=opus");
    expect(Buffer.from(body.data, "base64").toString()).toBe("opus!");
    expect(tracksParados).toBe(1); // microfone solto
    expect(porId(r, "hub-gravando")).toHaveLength(0);
  });

  it("cancelar solta o microfone e não manda nada", async () => {
    const r = await abrirThread();
    await act(async () => { await porId(r, "hub-envio-audio")[0].props.onPress(); });
    await flush();
    await act(async () => { porId(r, "hub-gravacao-cancelar")[0].props.onPress(); });
    expect(mockHub.midia).not.toHaveBeenCalled();
    expect(tracksParados).toBe(1);
    expect(porId(r, "hub-gravando")).toHaveLength(0);
  });

  it("gravação de menos de 1 s é descartada", async () => {
    const r = await abrirThread();
    await act(async () => { await porId(r, "hub-envio-audio")[0].props.onPress(); });
    await flush();
    await act(async () => { await porId(r, "hub-envio-audio")[0].props.onPress(); });
    await flush(6);
    expect(mockHub.midia).not.toHaveBeenCalled();
  });

  it("microfone negado explica o que fazer", async () => {
    negarMicrofone = true;
    const r = await abrirThread();
    await act(async () => { await porId(r, "hub-envio-audio")[0].props.onPress(); });
    await flush();
    expect(tudo(r)).toContain("Libere o microfone no navegador");
    expect(porId(r, "hub-gravando")).toHaveLength(0);
  });

  it("erro do servidor aparece na tela", async () => {
    mockHub.midia.mockRejectedValue(new Error("Não consegui preparar este áudio. Grave de novo."));
    const r = await abrirThread();
    await act(async () => { await porId(r, "hub-envio-audio")[0].props.onPress(); });
    await flush();
    agora += 3000;
    await act(async () => { await porId(r, "hub-envio-audio")[0].props.onPress(); });
    await flush(6);
    expect(tudo(r)).toContain("Grave de novo");
  });
});

describe("robustez", () => {
  it("se o MediaRecorder falhar depois do microfone, o microfone é solto", async () => {
    quebrarRecorder = true;
    const r = await abrirThread();
    await act(async () => { await porId(r, "hub-envio-audio")[0].props.onPress(); });
    await flush();
    expect(tracksParados).toBe(1);
    expect(porId(r, "hub-gravando")).toHaveLength(0);
  });

  it("grava com bitrate fixo (5 min cabem no limite do corpo)", async () => {
    const r = await abrirThread();
    await act(async () => { await porId(r, "hub-envio-audio")[0].props.onPress(); });
    await flush();
    expect(ultimasOpcoes.audioBitsPerSecond).toBe(32000);
    expect(32000 / 8 * 300 * 4 / 3).toBeLessThan(5 * 1024 * 1024);
  });

  it("trocar de conversa não leva a foto nem a gravação para a outra", async () => {
    mockEscolher.mockResolvedValue({ name: "a.jpg", type: "image/jpeg" });
    mockPrepararFoto.mockResolvedValue({ base64: "QUJD", mime: "image/jpeg", previa: "data:image/jpeg;base64,QUJD" });
    const B = { ...CONV, id: "conv-2", external_id: "5511977776666", customer_name: "Bia" };
    mockHub.conversations.mockResolvedValue({ conversations: [CONV, B], counts: [] });
    const r = await abrirThread();
    await act(async () => { await porId(r, "hub-envio-foto")[0].props.onPress(); });
    await flush();
    expect(porId(r, "hub-foto-previa")).toHaveLength(1);
    await act(async () => { porId(r, "hub-conv-conv-2")[0].props.onPress(); });
    await flush();
    expect(porId(r, "hub-foto-previa")).toHaveLength(0);
  });

  it("a URL da mídia não muda entre leituras da thread", async () => {
    const msg = (url: string) => ({ id: "a1", direction: "inbound", content: "[audio]", author: "cliente", created_at: recente, media: { kind: "audio", mime: "audio/ogg", url } });
    mockHub.messages.mockResolvedValue({ conversation: CONV, pending_approvals: [], messages: [msg("https://r2/a.ogg?sig=1")] });
    const r = await abrirThread();
    expect(r.root.findAll((n) => n.type === "audio")[0].props.src).toBe("https://r2/a.ogg?sig=1");
    mockHub.messages.mockResolvedValue({ conversation: CONV, pending_approvals: [], messages: [msg("https://r2/a.ogg?sig=2")] });
    await act(async () => { await qc.invalidateQueries({ queryKey: ["hub-thread", COMPANY, "conv-1"] }); });
    await flush();
    expect(r.root.findAll((n) => n.type === "audio")[0].props.src).toBe("https://r2/a.ogg?sig=1");
  });
});

describe("foto", () => {
  it("escolhe, vê a prévia, põe legenda e manda", async () => {
    mockEscolher.mockResolvedValue({ name: "a.jpg", type: "image/jpeg" });
    mockPrepararFoto.mockResolvedValue({ base64: "QUJD", mime: "image/jpeg", previa: "data:image/jpeg;base64,QUJD" });
    const r = await abrirThread();
    await act(async () => { await porId(r, "hub-envio-foto")[0].props.onPress(); });
    await flush();
    expect(porId(r, "hub-foto-previa")).toHaveLength(1);
    await act(async () => { porId(r, "hub-foto-legenda")[0].props.onChangeText("Olha a cor"); });
    await act(async () => { await porId(r, "hub-foto-mandar")[0].props.onPress(); });
    await flush();
    expect(mockHub.midia).toHaveBeenCalledWith(COMPANY, "conv-1", { kind: "foto", mime: "image/jpeg", data: "QUJD", caption: "Olha a cor" });
    expect(porId(r, "hub-foto-previa")).toHaveLength(0);
  });

  it("cancelar a escolha não faz nada", async () => {
    mockEscolher.mockResolvedValue(null);
    const r = await abrirThread();
    await act(async () => { await porId(r, "hub-envio-foto")[0].props.onPress(); });
    await flush();
    expect(porId(r, "hub-foto-previa")).toHaveLength(0);
    expect(mockHub.midia).not.toHaveBeenCalled();
  });

  it("foto que o preparo recusa mostra o motivo", async () => {
    mockEscolher.mockResolvedValue({ name: "a.gif", type: "image/gif" });
    mockPrepararFoto.mockRejectedValue(new Error("Escolha uma foto JPEG ou PNG."));
    const r = await abrirThread();
    await act(async () => { await porId(r, "hub-envio-foto")[0].props.onPress(); });
    await flush();
    expect(tudo(r)).toContain("Escolha uma foto JPEG ou PNG.");
  });
});

describe("na thread", () => {
  it("áudio guardado vira player; foto guardada vira imagem; o '[audio]' some", async () => {
    mockHub.messages.mockResolvedValue({
      conversation: CONV, pending_approvals: [],
      messages: [
        { id: "a1", direction: "inbound", content: "[audio]", author: "cliente", created_at: recente, media: { kind: "audio", mime: "audio/ogg", url: "https://r2.assinado/a.ogg" } },
        { id: "f1", direction: "inbound", content: "Olha esse", author: "cliente", created_at: recente, media: { kind: "image", mime: "image/jpeg", url: "https://r2.assinado/f.jpg" } },
      ],
    });
    const r = await abrirThread();
    const player = r.root.findAll((n) => n.type === "audio");
    expect(player).toHaveLength(1);
    expect(player[0].props.src).toBe("https://r2.assinado/a.ogg");
    expect(porId(r, "hub-msg-midia-f1")).toHaveLength(1);
    expect(tudo(r)).not.toContain("[audio]");
    expect(tudo(r)).toContain("Olha esse");
  });

  it("sem arquivo guardado a bolha diz o que era, sem mentir", () => {
    expect(textoDaBolha({ content: "[audio]", direction: "inbound", media: null })).toBe("Áudio recebido (o arquivo não ficou guardado)");
    expect(textoDaBolha({ content: "[image]", direction: "inbound", media: null })).toBe("Foto recebido (o arquivo não ficou guardado)");
    expect(textoDaBolha({ content: "[audio]", direction: "outbound", media: null })).toBe("Áudio");
    expect(textoDaBolha({ content: "[audio]", direction: "inbound", media: { kind: "audio", mime: "audio/ogg", url: "https://x" } })).toBeNull();
    expect(textoDaBolha({ content: "oi", direction: "inbound", media: null })).toBe("oi");
  });
});

describe("utilitários", () => {
  it("relógio", () => { expect(relogio(7)).toBe("0:07"); expect(relogio(125)).toBe("2:05"); });
  it("prefere OGG/Opus, depois WebM/Opus", () => {
    expect(escolherMimeDeGravacao({ isTypeSupported: (t) => t === "audio/webm;codecs=opus" })).toBe("audio/webm;codecs=opus");
    expect(escolherMimeDeGravacao({ isTypeSupported: () => true })).toBe("audio/ogg;codecs=opus");
    expect(escolherMimeDeGravacao({ isTypeSupported: () => false })).toBeNull();
  });
});
