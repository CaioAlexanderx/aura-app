// ============================================================
// Tom das mensagens, itens 8, 9, 12 e extra 2 (25/10/2026), na tela:
//   · banner do teste: "o Caixa continua com você" só no shell Negócio, e o
//     botão "Falar com a gente" no fim do teto sem primeira venda;
//   · "Nenhum módulo vertical ativo" só para a equipe Aura;
//   · cartão de indicação com "Como funciona" recolhível.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Linking } from "react-native";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
const mockPush = jest.fn();
jest.mock("expo-router", () => {
  const R = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    useRouter: () => ({ push: (...a: any[]) => mockPush(...a), replace: jest.fn() }),
    router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn() },
    Redirect: (p: any) => R.createElement(View, { testID: "redirect", href: p.href }),
  };
});
let mockAuth: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
jest.mock("@/services/api", () => ({
  referralsApi: { mine: jest.fn().mockResolvedValue({ code: null, stats: { total: 0, completed: 0, pending: 0 } }), generate: jest.fn() },
}));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/PageHeader", () => {
  const R = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");
  return { PageHeader: (p: any) => R.createElement(Text, { testID: "page-header" }, p.title) };
});
jest.mock("@/components/verticals/OdontoScreen", () => () => null);
jest.mock("@/components/verticals/BarberScreen", () => () => null);

import { TrialBanner } from "@/components/TrialBanner";
import { ReferralCard } from "@/components/ReferralCard";
import VerticalTab from "@/app/(tabs)/vertical";
import { COMO_FUNCIONA_INDICACAO, MSG_PEDIDO_DE_AJUDA } from "@/utils/mensagensDoApp";
import { waAura } from "@/constants/suporteAura";

const trial = (extra: Record<string, unknown> = {}) => ({
  mode: "primeira_venda",
  ends_at: "2026-10-26T12:00:00Z",
  started_by_sale_at: null,
  dias_restantes: 1,
  teto_em: "2026-10-26T12:00:00Z",
  aguardando_primeira_venda: true,
  dias_apos_primeira_venda: 7,
  ...extra,
});
const vendeu = trial({ aguardando_primeira_venda: false, started_by_sale_at: "2026-10-20T12:00:00Z" });

function banner(company: any) {
  mockAuth = { trialActive: true, trialEndsAt: "2026-10-26T12:00:00Z", isDemo: false, isStaff: false, company };
  let r!: renderer.ReactTestRenderer;
  act(() => { r = renderer.create(<TrialBanner />); });
  const corpo = r.root.findAllByProps({ testID: "trial-banner-corpo" }, { deep: false })[0];
  const titulo = r.root.findAllByProps({ testID: "trial-banner-titulo" }, { deep: false })[0];
  return { r, corpo: String(corpo.props.children), titulo: String(titulo.props.children) };
}

describe("TrialBanner", () => {
  it("varejo, teste acabando: cita o Caixa", () => {
    const { corpo } = banner({ plan: "negocio", vertical_active: null, trial: vendeu });
    expect(corpo).toBe("Seu teste está acabando. Se estiver gostando, é só escolher o plano. O Caixa continua com você de qualquer jeito.");
  });

  it.each(["odonto", "food", "studio"])("%s, teste acabando: sem o Caixa", (v) => {
    const { corpo } = banner({ plan: "negocio", vertical_active: v, trial: vendeu });
    expect(corpo).toBe("Seu teste está acabando. Se estiver gostando, é só escolher o plano.");
  });

  it("fim do teto sem venda: termina amanhã e 'Falar com a gente' abre o WhatsApp da Aura", () => {
    const abrir = jest.spyOn(Linking, "openURL").mockResolvedValue(true as any);
    const { r, titulo, corpo } = banner({ plan: "negocio", vertical_active: null, trial: trial() });
    expect(titulo).toBe("Seu teste termina amanhã.");
    expect(corpo).toBe("Se alguma coisa travou na primeira venda, a gente ajuda agora.");
    const ajuda = r.root.findAllByProps({ testID: "trial-banner-ajuda" }, { deep: false });
    expect(ajuda).toHaveLength(1);
    act(() => { ajuda[0].props.onPress(); });
    expect(abrir).toHaveBeenCalledWith(waAura(MSG_PEDIDO_DE_AJUDA));
    abrir.mockRestore();
  });

  it("teste em curso: sem o botão de ajuda", () => {
    const { r } = banner({ plan: "negocio", vertical_active: null, trial: trial({ dias_restantes: 6 }) });
    expect(r.root.findAllByProps({ testID: "trial-banner-ajuda" }, { deep: false })).toHaveLength(0);
  });
});

describe("Módulo vertical sem vertical ativa", () => {
  it("lojista: vai para o Painel, sem 'Nenhum módulo vertical ativo'", () => {
    mockAuth = { company: { vertical_active: null }, isStaff: false };
    let r!: renderer.ReactTestRenderer;
    act(() => { r = renderer.create(<VerticalTab />); });
    expect(r.root.findAllByProps({ testID: "redirect" }, { deep: false })[0].props.href).toBe("/(tabs)");
    expect(JSON.stringify(r.toJSON())).not.toContain("Nenhum módulo vertical ativo");
  });

  it("equipe Aura: continua vendo o aviso interno", () => {
    mockAuth = { company: { vertical_active: null }, isStaff: true };
    let r!: renderer.ReactTestRenderer;
    act(() => { r = renderer.create(<VerticalTab />); });
    expect(r.root.findAllByProps({ testID: "redirect" }, { deep: false })).toHaveLength(0);
    expect(JSON.stringify(r.toJSON())).toContain("Nenhum módulo vertical ativo");
  });
});

describe("ReferralCard: Como funciona", () => {
  it("fica recolhido e abre no toque com as regras", async () => {
    mockAuth = { user: { email_verified: true }, isDemo: false, token: "t" };
    let r!: renderer.ReactTestRenderer;
    await act(async () => { r = renderer.create(<ReferralCard />); });
    expect(r.root.findAllByProps({ testID: "indicacao-regras" }, { deep: false })).toHaveLength(0);
    const botao = r.root.findAllByProps({ testID: "indicacao-como-funciona" }, { deep: false });
    expect(botao).toHaveLength(1);
    act(() => { botao[0].props.onPress(); });
    expect(r.root.findAllByProps({ testID: "indicacao-regras" }, { deep: false })).toHaveLength(1);
    const out = JSON.stringify(r.toJSON());
    for (const regra of COMO_FUNCIONA_INDICACAO) expect(out).toContain(regra);
    act(() => { r.root.findAllByProps({ testID: "indicacao-como-funciona" }, { deep: false })[0].props.onPress(); });
    expect(r.root.findAllByProps({ testID: "indicacao-regras" }, { deep: false })).toHaveLength(0);
  });

  it("também na conta demo", () => {
    mockAuth = { user: null, isDemo: true, token: null };
    let r!: renderer.ReactTestRenderer;
    act(() => { r = renderer.create(<ReferralCard />); });
    expect(r.root.findAllByProps({ testID: "indicacao-como-funciona" }, { deep: false })).toHaveLength(1);
  });
});
