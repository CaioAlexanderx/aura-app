// ============================================================
// Trava do WhatsApp oficial (utils/whatsappOficialLiberado.ts), 18/11/2026.
//
// O App Review da Meta ainda não saiu: nenhuma loja conecta o número
// oficial. Decisão do Caio: tudo o que promete "WhatsApp automático /
// oficial" some atrás de UMA trava até a Meta aprovar. Exceção: quem já
// tem o número conectado (hoje, o dojô Kondei) segue vendo tudo.
//
// O que este teste segura:
//   1. a trava nasce desligada e a regra trava OU conectada;
//   2. a vitrine de planos sem as linhas do WhatsApp oficial (render);
//   3. o Agendamento sem o cartão de notificações de mentira (render);
//   4. a exceção da loja conectada no cartão do aniversário (render);
//   5. o menu sem o item WhatsApp (o filtro em buildRawNav, lido do fonte
//      como em __tests__/modulosOcultos.test.ts).
// ============================================================
import fs from "fs";
import path from "path";
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));

jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = {
        company: { id: "loja-1", name: "Loja Exemplo", plan: "negocio" },
        token: "t",
        isDemo: false,
        refreshMe: () => Promise.resolve(),
      };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));
var mockQueryData: any = null;
var mockQueryOpts: any = null;
jest.mock("@tanstack/react-query", () => ({
  useQuery: (o: any) => { mockQueryOpts = o; return { data: mockQueryData }; },
}));
jest.mock("@/services/api", () => ({ billingApi: { status: jest.fn() } }));

// Agendamento: só a aba de configurações interessa.
jest.mock("@/hooks/useAppointments", () => ({
  useAppointments: () => ({
    appointments: [], isLoading: false,
    kpis: { total: 0, confirmed: 0, pending: 0, revenue: 0 },
    updateAppointment: jest.fn(), cancelAppointment: jest.fn(),
  }),
}));
jest.mock("@/components/ScreenHero", () => {
  const R = require("react");
  return {
    ScreenHero: () => null,
    ScreenTabs: (p: any) => R.createElement("ScreenTabs", { ...p, testID: "abas" }),
  };
});
jest.mock("@/components/SummaryCard", () => ({ SummaryCard: () => null }));

// Aniversário: o status vem do /whatsapp/status.
var mockStatus: any = null;
jest.mock("@/services/waApi", () => {
  const actual = jest.requireActual("@/services/waApi");
  return { ...actual, waApi: { getStatus: () => Promise.resolve(mockStatus) } };
});
jest.mock("@/services/birthdayApi", () => ({
  birthdayApi: {
    getSettings: () => Promise.resolve({ wa_birthday_auto: false }),
    saveSettings: jest.fn(),
  },
}));
jest.mock("@/components/whatsapp/PreviaMarketingModal", () => ({ PreviaMarketingModal: () => null }));

import {
  WHATSAPP_OFICIAL_LIBERADO, lojaJaConectada, whatsappOficialVisivel, MODULO_WHATSAPP_OFICIAL,
} from "@/utils/whatsappOficialLiberado";
import PlanosScreen from "@/app/(tabs)/planos";
import AgendamentoScreen from "@/app/(tabs)/agendamento";
import { AniversarioAutoCard } from "@/components/whatsapp/AniversarioAutoCard";
import { ReativacaoEntrada } from "@/components/screens/clientes/ReativacaoEntrada";
import { useWhatsappOficialVisivel } from "@/hooks/useWhatsappOficialVisivel";

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function textoDe(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join(" ");
  const filhos = node.children || (node.props && node.props.children);
  return filhos ? textoDe(filhos) : "";
}

function temTestId(tree: any, id: string): boolean {
  return tree.root.findAllByProps({ testID: id }).length > 0;
}

describe("a trava", () => {
  test("nasce desligada", () => {
    expect(WHATSAPP_OFICIAL_LIBERADO).toBe(false);
  });

  test("desligada: só a loja conectada vê", () => {
    expect(whatsappOficialVisivel({ connected: true })).toBe(true);
    expect(whatsappOficialVisivel({ connected: false })).toBe(false);
    expect(whatsappOficialVisivel(null)).toBe(false);
    expect(whatsappOficialVisivel(undefined)).toBe(false);
  });

  test("token vencido é loja conectada (precisa ver o aviso de reconectar)", () => {
    expect(lojaJaConectada({ connected: false, token_expired: true })).toBe(true);
    expect(whatsappOficialVisivel({ connected: false, token_expired: true })).toBe(true);
  });

  test("ligada: todo mundo vê, conectado ou não", () => {
    expect(whatsappOficialVisivel(null, true)).toBe(true);
    expect(whatsappOficialVisivel({ connected: false }, true)).toBe(true);
  });
});

describe("planos com a trava desligada", () => {
  test("o Negócio não promete WhatsApp oficial; o Essencial segue com o wa.me", async () => {
    let tree: any;
    await act(async () => { tree = renderer.create(<PlanosScreen />); });
    await flush();
    const negocio = textoDe(tree.root.findAllByProps({ testID: "plano-card-negocio" })[0]);
    expect(negocio).not.toContain("Reativação automática de clientes inativos pelo WhatsApp oficial");
    expect(negocio).not.toContain("Cobranças automáticas pelo WhatsApp oficial");
    expect(negocio).not.toContain("100 mensagens promocionais");
    const essencial = textoDe(tree.root.findAllByProps({ testID: "plano-card-essencial" })[0]);
    expect(essencial).toContain("Cobrança pelo WhatsApp: manual (wa.me)");
    expect(textoDe(tree.toJSON())).not.toContain("Mensagens promocionais extras");
    tree.unmount();
  });
});

describe("Agendamento", () => {
  test("a aba de configurações não diz mais 'Ativo via WhatsApp'", async () => {
    let tree: any;
    await act(async () => { tree = renderer.create(<AgendamentoScreen />); });
    const abas = tree.root.findAllByProps({ testID: "abas" })[0];
    await act(async () => { abas.props.onSelect("2"); });
    const txt = textoDe(tree.toJSON());
    expect(txt).toContain("Horário de funcionamento");
    expect(txt).not.toContain("Ativo via WhatsApp");
    expect(txt).not.toContain("Confirmação automática");
    expect(txt).not.toContain("Ativo - 24h antes");
    tree.unmount();
  });
});

describe("aniversário no Painel: a exceção da loja conectada", () => {
  test("loja sem número: o cartão do envio automático some", async () => {
    mockStatus = { connected: false, queue: {}, schema_pending: false };
    let tree: any;
    await act(async () => { tree = renderer.create(<AniversarioAutoCard companyId="loja-1" />); });
    await flush();
    expect(temTestId(tree, "aniversario-wa-auto")).toBe(false);
    tree.unmount();
  });

  test("loja já conectada: o cartão fica como hoje", async () => {
    mockStatus = { connected: true, phone_display: "5511912345678", queue: {}, schema_pending: false };
    let tree: any;
    await act(async () => { tree = renderer.create(<AniversarioAutoCard companyId="loja-1" />); });
    await flush();
    expect(temTestId(tree, "aniversario-wa-auto")).toBe(true);
    tree.unmount();
  });
});

describe("useWhatsappOficialVisivel (aba WhatsApp das Mensalidades do dojô)", () => {
  function Sonda() {
    const v = useWhatsappOficialVisivel();
    return React.createElement("Sonda", { testID: "sonda", v });
  }
  afterEach(() => { mockQueryData = null; });

  test("pergunta o status no cache compartilhado e esconde sem número", async () => {
    mockQueryData = { connected: false };
    let tree: any;
    await act(async () => { tree = renderer.create(<Sonda />); });
    expect(mockQueryOpts.queryKey).toEqual(["wa-status", "loja-1"]);
    expect(mockQueryOpts.enabled).toBe(true);
    expect(tree.root.findAllByProps({ testID: "sonda" })[0].props.v).toBe(false);
    tree.unmount();
  });

  test("dojô conectado (Kondei) segue vendo", async () => {
    mockQueryData = { connected: true };
    let tree: any;
    await act(async () => { tree = renderer.create(<Sonda />); });
    expect(tree.root.findAllByProps({ testID: "sonda" })[0].props.v).toBe(true);
    tree.unmount();
  });
});

describe("entrada da Reativação no Negócio", () => {
  test("com a trava desligada, o caminho é o do wa.me (sem cupom pago)", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<ReativacaoEntrada customers={[]} plan="negocio" idBase="porta" />);
    });
    const txt = textoDe(tree.toJSON());
    expect(txt).toContain("Chamar quem sumiu");
    expect(txt).not.toContain("Ver e mandar cupom");
    expect(txt).not.toContain("Mensagem de marketing");
    tree.unmount();
  });
});

describe("menu", () => {
  test("buildRawNav tira o item WhatsApp enquanto a trava estiver desligada", () => {
    const layout = fs.readFileSync(path.join(__dirname, "..", "app/(tabs)/_layout.tsx"), "utf8");
    const i = layout.indexOf("function buildRawNav(");
    expect(i).toBeGreaterThan(-1);
    const corpo = layout.slice(i, layout.indexOf("\n}", i));
    expect(corpo).toContain("item.mod === MODULO_WHATSAPP_OFICIAL && !WHATSAPP_OFICIAL_LIBERADO");
    expect(MODULO_WHATSAPP_OFICIAL).toBe("whatsapp");
  });
});
