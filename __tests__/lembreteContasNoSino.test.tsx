// ============================================================
// Lembrete de conta a pagar no sino (25/09/2026) — "visualizou, sumiu".
//
// O backend manda 'loja_conta_vencendo' 2 dias antes do vencimento. Trava:
//   · catálogo: card de atenção ("Precisa de você"), CTA para o Financeiro,
//     e a linha na tela de preferências;
//   · idsQueSomemAoVer: só o tipo que some ao ver, e só se ainda não lido;
//   · hook: o que estava na tela quando o sino ABRIU some quando ele FECHA
//     (lido no servidor e fora da lista na hora); o que chegou com a gaveta
//     aberta fica para a próxima; os outros eventos não são tocados.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

const mockList = jest.fn();
const mockMarkEventRead = jest.fn((..._a: any[]) => Promise.resolve({}));
jest.mock("@/services/notificationsApi", () => ({
  notificationsApi: {
    list: (...a: any[]) => mockList(...a),
    markEventRead: (...a: any[]) => mockMarkEventRead(...a),
    markBannerRead: jest.fn(() => Promise.resolve({})),
    markAllRead: jest.fn(() => Promise.resolve({})),
    markAllBannersRead: jest.fn(() => Promise.resolve({})),
    getPreferences: jest.fn(() => Promise.resolve({ preferences: {} })),
    savePreferences: jest.fn(() => Promise.resolve({})),
  },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel: any) => sel({ company: { id: "empresa-1" } }),
}));
jest.mock("@/utils/somDePedido", () => ({ tocarAvisoDePedido: jest.fn(), instalarDesbloqueioDoSom: jest.fn() }));
jest.mock("@/services/webPush", () => ({
  registrarServiceWorker: jest.fn(() => Promise.resolve()),
  sincronizarInscricao: jest.fn(() => Promise.resolve()),
  ouvirAvisosDoServiceWorker: jest.fn(() => () => {}),
}));

import { useNotifications } from "@/hooks/useNotifications";
import {
  visualForEvent, idsQueSomemAoVer, SOME_AO_VER, PREF_ROWS, buildFeed,
} from "@/components/notificationEventModel";

const CONTA = {
  id: "n-conta", type: "loja_conta_vencendo", title: "2 contas a pagar vencem em 27/09",
  body: "Total R$ 1.042,07", severity: "atencao" as const, cta_route: "/financeiro",
  created_at: "2026-09-25T11:00:00Z", read_at: null,
};
const PIX = {
  id: "n-pix", type: "loja_pix_expirado", title: "PIX expirou", severity: "atencao" as const,
  created_at: "2026-09-25T10:00:00Z", read_at: null,
};

describe("catálogo", () => {
  test("card de atenção com CTA para o Financeiro e linha nas preferências", () => {
    const v = visualForEvent({ type: "loja_conta_vencendo" } as any);
    expect(v).toMatchObject({ label: "Conta a pagar vencendo", severity: "atencao", requiresAction: true, fallbackRoute: "/financeiro" });
    expect(PREF_ROWS.find((r) => r.type === "loja_conta_vencendo")).toMatchObject({ padrao: true });
    expect(SOME_AO_VER.has("loja_conta_vencendo")).toBe(true);
    expect(SOME_AO_VER.has("loja_pix_expirado")).toBe(false);
  });

  test("idsQueSomemAoVer: só o tipo certo e ainda não lido", () => {
    expect(idsQueSomemAoVer([CONTA, PIX, { ...CONTA, id: "lido", read_at: "2026-09-25T12:00:00Z" }] as any)).toEqual(["n-conta"]);
  });
});

describe("hook: visualizou, sumiu", () => {
  let api: ReturnType<typeof useNotifications>;
  function Sonda() { api = useNotifications(); return null; }

  async function montar(eventos: any[]) {
    mockList.mockResolvedValue({ banners: [], orders: [], events: eventos, unread_count: eventos.length });
    let t!: renderer.ReactTestRenderer;
    await act(async () => { t = renderer.create(<Sonda />); });
    await act(async () => { await Promise.resolve(); });
    return t;
  }

  beforeEach(() => { mockList.mockReset(); mockMarkEventRead.mockClear(); });

  test("abrir não tira nada; fechar tira o lembrete e o marca lido no servidor", async () => {
    const t = await montar([CONTA, PIX]);
    expect(api.events.map((e) => e.id).sort()).toEqual(["n-conta", "n-pix"]);

    act(() => { api.markSeen(); });            // abriu o sino
    expect(api.events.map((e) => e.id)).toContain("n-conta");
    expect(mockMarkEventRead).not.toHaveBeenCalled();

    act(() => { api.dispensarVistos(); });     // fechou
    expect(api.events.map((e) => e.id)).toEqual(["n-pix"]);
    expect(mockMarkEventRead).toHaveBeenCalledTimes(1);
    expect(mockMarkEventRead).toHaveBeenCalledWith("empresa-1", "n-conta");
    t.unmount();
  });

  test("lembrete que chegou com a gaveta aberta não foi visto: fica", async () => {
    const t = await montar([PIX]);
    act(() => { api.markSeen(); });            // abriu sem lembrete na tela
    mockList.mockResolvedValue({ banners: [], orders: [], events: [PIX, CONTA], unread_count: 2 });
    await act(async () => { await api.refresh(); });   // chegou pelo poll
    act(() => { api.dispensarVistos(); });     // fechou
    expect(api.events.map((e) => e.id)).toContain("n-conta");
    expect(mockMarkEventRead).not.toHaveBeenCalled();
    t.unmount();
  });

  test("fechar sem ter aberto não faz nada", async () => {
    const t = await montar([CONTA]);
    act(() => { api.dispensarVistos(); });
    expect(api.events.map((e) => e.id)).toEqual(["n-conta"]);
    expect(mockMarkEventRead).not.toHaveBeenCalled();
    t.unmount();
  });
});

test("o lembrete entra em 'Precisa de você'", () => {
  const feed = buildFeed([CONTA as any], Date.parse("2026-09-25T12:00:00Z"));
  expect(feed.acoes.map((i: any) => i.event.id)).toContain("n-conta");
});
