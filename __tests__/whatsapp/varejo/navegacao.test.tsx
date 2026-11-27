// ============================================================
// Navegação da tela do WhatsApp (27/11/2026, revisão de UX da Nina)
//
//   - as abas ficam na linha do topo, em todas as telas: Conversas (com o módulo),
//     Automáticas, Venda+ e Configurações (artboard Main);
//   - Configurações = Conexão + Mensagens (Mensagens junta os antigos Templates e
//     Cobranças; a palavra "Templates" não aparece);
//   - Aniversário e Crediário só abrem pelas Automáticas ("Ajustar"), com o
//     voltar "← Automáticas", e a aba destacada continua "Automáticas".
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, Redirect: () => null }));
jest.mock("@/components/screens/whatsapp/TabConversas", () => ({ TabConversas: () => null }));
jest.mock("@/components/screens/whatsapp/TabAutomacoes", () => ({ TabAutomacoes: () => null }));
jest.mock("@/components/screens/whatsapp/TabCampanhas", () => ({ TabCampanhas: () => null }));
jest.mock("@/components/screens/whatsapp/TabConfig", () => ({ TabConfig: () => null }));
jest.mock("@/hooks/useVisibleModules", () => ({ useVisibleModules: () => new Set<string>(["hub_social"]) }));
jest.mock("@/components/screens/hub/HubView", () => ({ HubView: () => null }));
jest.mock("@/hooks/useClientesPrevia", () => ({ useClientesPrevia: () => [] }));
jest.mock("@/hooks/useWaPacotes", () => ({
  useWaPacotes: () => ({ comprar: () => {}, comprando: null, erro: null, abaBloqueada: false, manual: null, pendentes: [], abrir: () => {} }),
}));

jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      const state = { user: { id: "u-2", email: "caio@getaura.com.br", is_staff: true }, company: { id: "aura-1", name: "Aura." }, token: "t", isDemo: false };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));
jest.mock("@/hooks/useWhatsApp", () => ({
  useWhatsApp: () => ({
    conversations: [], messages: [], automations: [], campaigns: [], unreadCount: 0, openCount: 0, activeAutomations: 0, totalSent: 0,
    isConnected: false, isDemo: false, isLoading: false, toggleAutomation: jest.fn(), sendMessage: jest.fn(),
  }),
}));
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: [], isLoading: false, plan: "negocio", consolidatedView: false, companyCount: 1 }) }));

const mockStatus: any = {
  connected: false, phone_display: null, waba_id: null, queue: {}, schema_pending: false, addon_active: true,
  usage: { today_sent: 0, month_sent: 0, daily_cap: 300 },
  embedded_signup: { app_id: "1", config_id: "cfg-1", graph_version: "v21.0" },
};
jest.mock("@/services/waApi", () => {
  const actual = jest.requireActual("@/services/waApi");
  return {
    ...actual,
    waApi: {
      getStatus: () => Promise.resolve(mockStatus), listTemplates: () => Promise.resolve({ data: [] }), listOutbox: () => Promise.resolve({ data: [] }),
      createTemplate: jest.fn(), syncTemplates: jest.fn(), connect: jest.fn(), disconnect: jest.fn(), getPreview: jest.fn(),
    },
  };
});

import { DIVISAO_PADRAO, lerAutomaticas } from "@/components/whatsapp/waDivisao";
const zero = { aniversario: 0, venda_mais: 0, crediario: 0 };
const mockAutoInfo = lerAutomaticas({
  mes: "2026-12", aceite_novidades_em: "2026-12-01T00:00:00Z",
  novidades: { total: 10, livres: 10, divisao: DIVISAO_PADRAO, usadas: zero, sem_dono: 0 },
  automaticas: [
    { key: "aniversario", ligada: false, livres: 4, config: { tom: "carinhoso", presente: null, quando: "no_dia" } },
    { key: "venda_mais", ligada: false, livres: 4, config: { segmento: "sumindo", presente: null, automatico: false } },
    { key: "crediario_cobrar", ligada: false, config: { pontos: { antes3: true, dia: true, depois1: true, depois7: false, depois15: false } } },
    { key: "crediario_vender", ligada: false, livres: 2, config: {} },
  ],
});
jest.mock("@/hooks/useWaAutomaticas", () => ({
  useWaAutomaticas: () => ({
    info: mockAutoInfo, carregando: false, falhou: false, salvando: false, erro: null,
    recarregar: jest.fn(), ajustar: jest.fn(), aplicarDivisao: jest.fn(), ligar: jest.fn(), salvarConfig: jest.fn(),
  }),
}));
jest.mock("@/hooks/useWaSaldo", () => ({ useWaSaldo: () => ({ saldo: null, carregando: false, falhou: false, recarregar: jest.fn() }) }));
jest.mock("@/hooks/useWaAutomatica", () => ({
  useWaPublico: () => ({ publico: null, corte: null, carregando: false, falhou: false, enviando: false, erro: null, enviado: null, recarregar: jest.fn(), enviarAgora: jest.fn() }),
  useWaModelos: () => ({ modelos: [], carregando: false, recarregar: jest.fn() }),
}));

import WhatsAppScreen from "@/app/(tabs)/whatsapp";

async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); }
const achar = (t: any, id: string) => t.root.findAllByProps({ testID: id })[0];
const tem = (t: any, id: string) => t.root.findAllByProps({ testID: id }).length > 0;
const toque = async (t: any, id: string) => { await act(async () => { achar(t, id).props.onPress(); }); await flush(); };
/** O texto que a pessoa lê (sem os testIDs). */
const lido = (t: any) => JSON.stringify(t.toJSON()).replace(/"data-testid":"[^"]*"/g, "").replace(/","/g, "");
async function montar() { let t: any; await act(async () => { t = renderer.create(<WhatsAppScreen />); }); await flush(); return t; }

describe("navegação da tela do WhatsApp", () => {
  it("abas do topo: Conversas, Automáticas, Venda+ e Configurações (nesta ordem, com o Guias)", async () => {
    const t = await montar();
    const ordem = ["conversas", "automaticas", "venda_mais", "config"].map((k) => { expect(tem(t, `wa-varejo-aba-${k}`)).toBe(true); return JSON.stringify(t.toJSON()).indexOf(`wa-varejo-aba-${k}`); });
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    expect(tem(t, "wa-varejo-guias")).toBe(true);
    t.unmount();
  });

  it("Configurações tem só Conexão e Mensagens; a palavra Templates não aparece", async () => {
    const t = await montar();
    await toque(t, "wa-varejo-aba-config");
    expect(tem(t, "wa-varejo-secao-conexao")).toBe(true);
    expect(tem(t, "wa-varejo-secao-mensagens")).toBe(true);
    for (const velho of ["aniversario", "crediario", "venda_mais", "cobrancas", "templates"]) expect(tem(t, `wa-varejo-secao-${velho}`)).toBe(false);
    await toque(t, "wa-varejo-secao-mensagens");
    expect(tem(t, "wa-varejo-bloco-mensagens")).toBe(true);
    expect(tem(t, "wa-varejo-templates")).toBe(true); // o cartão existe (testID histórico)...
    expect(lido(t)).not.toMatch(/template/i); // ...mas a palavra não aparece na tela
    expect(lido(t)).toContain("Mensagens da loja");
    t.unmount();
  });

  it("o Ajustar do Venda+ leva à aba Venda+ (sem voltar; a aba fica destacada)", async () => {
    const t = await montar();
    await toque(t, "wa-varejo-aba-automaticas");
    await toque(t, "wa-auto-ajustar-venda_mais");
    expect(tem(t, "wa-varejo-bloco-venda-mais")).toBe(true);
    expect(achar(t, "wa-varejo-aba-venda_mais").props.estado.selected).toBe(true);
    expect(tem(t, "wa-varejo-voltar-automaticas")).toBe(false);
    expect(tem(t, "wa-varejo-bloco-automaticas")).toBe(false);
    await toque(t, "wa-varejo-aba-venda_mais"); // a aba também abre direto
    expect(tem(t, "wa-varejo-bloco-venda-mais")).toBe(true);
    t.unmount();
  });

  it("Aniversário e Crediário abrem pelo Ajustar das Automáticas, com o voltar '← Automáticas'", async () => {
    const t = await montar();
    await toque(t, "wa-varejo-aba-automaticas");
    expect(tem(t, "wa-varejo-bloco-automaticas")).toBe(true);
    expect(tem(t, "wa-varejo-voltar-automaticas")).toBe(false);
    for (const [ajustar, bloco] of [["aniversario", "wa-varejo-bloco-aniversario"], ["crediario_vender", "wa-varejo-bloco-crediario"]]) {
      await toque(t, `wa-auto-ajustar-${ajustar}`);
      expect(tem(t, bloco)).toBe(true);
      expect(tem(t, "wa-varejo-voltar-automaticas")).toBe(true);
      expect(achar(t, "wa-varejo-aba-automaticas").props.estado.selected).toBe(true); // a aba destacada segue "Automáticas"
      expect(tem(t, "wa-varejo-bloco-automaticas")).toBe(false);
      await toque(t, "wa-varejo-voltar-automaticas");
      expect(tem(t, bloco)).toBe(false);
      expect(tem(t, "wa-varejo-bloco-automaticas")).toBe(true);
    }
    t.unmount();
  });

  it("com a trava, a subaba Conexão NÃO renderiza o UsoCard (Uso do mês); a Conexão e os saldos continuam", async () => {
    const t = await montar();
    await toque(t, "wa-varejo-aba-config");
    expect(tem(t, "wa-varejo-bloco-conexao")).toBe(true);
    expect(tem(t, "wa-varejo-conexao")).toBe(true);
    expect(tem(t, "wa-varejo-uso")).toBe(false);
    expect(lido(t)).not.toContain("Uso do mês");
    t.unmount();
  });

  it("a sobrancelha usa o nome cadastrado da empresa, sem acrescentar ponto", async () => {
    const t = await montar();
    await toque(t, "wa-varejo-aba-config");
    expect(lido(t)).toContain("WhatsApp da Aura.");   // o nome da empresa do mock é "Aura." (o ponto é do cadastro)
    expect(lido(t)).not.toContain("WhatsApp da Aura..");
    t.unmount();
  });

  it("Configurações: as duas colunas (Conexão e saldos) encolhem e quebram em uma só no celular (sem passar da tela)", async () => {
    const t = await montar();
    await toque(t, "wa-varejo-aba-config");
    const plano = (el: any) => Object.assign({}, ...[].concat(el.props.style || []).flat(3).filter(Boolean));
    for (const id of ["wa-varejo-conexao-col", "wa-varejo-saldos-col"]) {
      const est = plano(achar(t, id));
      expect(est.flexShrink).toBe(1);
      expect(est.minWidth).toBe(0);
      expect(est.maxWidth).toBe("100%");
      expect(est.flexBasis).toBeGreaterThan(0);
    }
    t.unmount();
  });

  it("trocar de aba fecha a página de dentro das Automáticas", async () => {
    const t = await montar();
    await toque(t, "wa-varejo-aba-automaticas");
    await toque(t, "wa-auto-ajustar-aniversario");
    await toque(t, "wa-varejo-aba-config");
    await toque(t, "wa-varejo-aba-automaticas");
    expect(tem(t, "wa-varejo-bloco-aniversario")).toBe(false);
    expect(tem(t, "wa-varejo-bloco-automaticas")).toBe(true);
    t.unmount();
  });

  it("as abas ficam na linha do topo, antes do título, em todas as telas", async () => {
    const t = await montar();
    for (const aba of ["automaticas", "config", "conversas"]) {
      await toque(t, `wa-varejo-aba-${aba}`);
      const html = JSON.stringify(t.toJSON());
      expect(html.indexOf("wa-varejo-abas-topo") !== -1 || html.indexOf("wa-varejo-aba-conversas") !== -1).toBe(true);
      expect(html.indexOf("wa-varejo-aba-config")).toBeLessThan(html.indexOf("WhatsApp da"));
    }
    t.unmount();
  });
});
