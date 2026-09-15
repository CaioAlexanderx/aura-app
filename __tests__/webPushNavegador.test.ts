// ============================================================
// Aviso de pedido no computador — inscrição do navegador (10/09/2026)
//
// Navegador simulado: service worker, PushManager e Notification. O que
// trava: permissão negada vira "bloqueado", a chave VAPID do servidor chega
// ao subscribe em bytes, a inscrição vai para a empresa certa, e navegador
// sem suporte não quebra o painel.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn() }));

import { request } from "@/services/api";
import {
  ativarAviso, desativarAviso, estadoDoAviso, sincronizarInscricao, suportaAvisoNoNavegador, _resetRegistro,
} from "@/services/webPush";

const CHAVE = "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const req = request as jest.Mock;

function navegador({ permissao = "default", resposta = "granted", inscrito = false } = {}) {
  const inscricao = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "x", auth: "y" } }),
    unsubscribe: jest.fn().mockResolvedValue(true),
  };
  let atual: any = inscrito ? inscricao : null;
  const pushManager = {
    getSubscription: jest.fn(async () => atual),
    subscribe: jest.fn(async () => { atual = inscricao; return inscricao; }),
  };
  const reg = { pushManager };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: jest.fn().mockResolvedValue(reg),
      ready: Promise.resolve(reg),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  });
  (window as any).PushManager = function () {};
  const Notif: any = function () {};
  Notif.permission = permissao;
  Notif.requestPermission = jest.fn(async () => { Notif.permission = resposta; return resposta; });
  (window as any).Notification = Notif;
  (global as any).Notification = Notif;
  return { pushManager, inscricao, Notif };
}

beforeEach(() => {
  _resetRegistro();
  req.mockReset();
  req.mockImplementation(async (url: string) => (url.endsWith("/public-key") ? { public_key: CHAVE } : { ok: true }));
});

afterEach(() => {
  delete (navigator as any).serviceWorker;
  delete (window as any).PushManager;
  delete (window as any).Notification;
  delete (global as any).Notification;
});

test("sem suporte: indisponível, e nada chama o servidor", async () => {
  expect(suportaAvisoNoNavegador()).toBe(false);
  expect(await estadoDoAviso()).toBe("indisponivel");
  expect(await ativarAviso("c1")).toBe("indisponivel");
  expect(req).not.toHaveBeenCalled();
});

test("ativar: pede permissão, inscreve com a chave do servidor em bytes e registra na empresa", async () => {
  const { pushManager } = navegador();
  expect(await estadoDoAviso()).toBe("inativo");
  expect(await ativarAviso("c1")).toBe("ativo");
  const [{ applicationServerKey, userVisibleOnly }] = pushManager.subscribe.mock.calls[0] as any;
  expect(userVisibleOnly).toBe(true);
  expect(applicationServerKey).toHaveLength(65);
  expect(req).toHaveBeenCalledWith("/companies/c1/web-push/public-key");
  expect(req).toHaveBeenCalledWith("/companies/c1/web-push/subscribe", expect.objectContaining({ method: "POST" }));
  expect(await estadoDoAviso()).toBe("ativo");
});

test("permissão negada vira bloqueado e não inscreve", async () => {
  const { pushManager } = navegador({ resposta: "denied" });
  expect(await ativarAviso("c1")).toBe("bloqueado");
  expect(pushManager.subscribe).not.toHaveBeenCalled();
  expect(await estadoDoAviso()).toBe("bloqueado");
});

test("navegador já inscrito reaproveita a inscrição", async () => {
  const { pushManager } = navegador({ permissao: "granted", inscrito: true });
  expect(await ativarAviso("c1")).toBe("ativo");
  expect(pushManager.subscribe).not.toHaveBeenCalled();
});

test("abrir o painel reafirma a inscrição só com permissão dada", async () => {
  navegador({ permissao: "granted", inscrito: true });
  await sincronizarInscricao("c2");
  expect(req).toHaveBeenCalledWith("/companies/c2/web-push/subscribe", expect.objectContaining({ method: "POST" }));
});

test("desativar avisa o servidor e desinscreve o navegador", async () => {
  const { inscricao } = navegador({ permissao: "granted", inscrito: true });
  expect(await desativarAviso("c1")).toBe("inativo");
  expect(req).toHaveBeenCalledWith("/companies/c1/web-push/unsubscribe", { method: "POST", body: { endpoint: inscricao.endpoint } });
  expect(inscricao.unsubscribe).toHaveBeenCalled();
});
