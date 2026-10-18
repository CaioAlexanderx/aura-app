// ============================================================
// Gestão Aura › Hoje › bloco Custos: o botão "Lançar custo do mês" (só
// user.role admin) e o modal que grava em POST /admin/painel/custos
// (Aura-backend, card f5-06). Respostas do backend: __fixtures__/painel.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return {
    __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path"),
    Circle: stub("Circle"), Line: stub("Line"), Text: stub("SvgText"),
  };
});
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return Object.setPrototypeOf({ Modal: ({ visible, children }: any) => (visible ? children : null) }, RN);
});
// A tela da rota lê user.role do store; o painel recebe só o booleano.
let mockAuth: any = { isStaff: true, user: null };
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
jest.mock("@/services/adminApi", () => ({
  adminApi: {
    painel: {
      hoje: jest.fn(), bloco: jest.fn(), ficha: jest.fn(), layout: jest.fn(), salvarLayout: jest.fn(), recalcular: jest.fn(),
      ofx: { extratos: jest.fn(), detalhe: jest.fn() },
      contatos: { registrar: jest.fn() },
      custos: { mes: jest.fn(), lancar: jest.fn() },
    },
    extendTrial: jest.fn(),
  },
}));

import { PainelHoje } from "@/components/admin/painel/PainelHoje";
import GestaoAuraHojeScreen from "../../app/(tabs)/gestao-aura-hoje";
import { PAINEL_FALLBACK_DEV } from "@/components/admin/painel/usePainelHoje";
import { adminApi } from "@/services/adminApi";
import { toast } from "@/components/Toast";

const api = (adminApi as any).painel;
const fx = (nome: string) => JSON.parse(JSON.stringify(require("../__fixtures__/painel/" + nome + ".json")));

// GET /admin/painel/custos de outubro sem lançamento (só o MRR do job).
const OUTUBRO = {
  mes: "2026-10", existe_linha: true, mrr_total: 1843.93, total_costs: 0, taxas_asaas: null, das: null, sem_abertura: null,
  categorias: [
    { id: "infraestrutura", rotulo: "Infraestrutura", ajuda: "Railway, Supabase, Cloudflare, domínio", valor: null, origem: null, observacao: null, lancado_em: null },
    { id: "anthropic", rotulo: "Anthropic", ajuda: "API e assinatura do Claude", valor: null, origem: null, observacao: null, lancado_em: null },
    { id: "meta", rotulo: "Meta", ajuda: "WhatsApp Business e anúncios", valor: null, origem: null, observacao: null, lancado_em: null },
    { id: "outros", rotulo: "Outros", ajuda: "Ferramentas e o que não cabe acima", valor: null, origem: null, observacao: null, lancado_em: null },
  ],
  origens: [{ id: "empresa", rotulo: "Conta da empresa" }, { id: "socio", rotulo: "Conta pessoal do sócio" }, { id: "estimativa", rotulo: "Estimativa" }],
};

// A tela (app/(tabs)/gestao-aura-hoje.tsx) passa user.role === "admin".
let podeLancar = false;
function comoUsuario(role: string | null, _extra: Record<string, any> = {}) {
  podeLancar = role === "admin";
}

beforeEach(() => {
  jest.clearAllMocks();
  PAINEL_FALLBACK_DEV.dadosDeExemplo = false;
  delete (global as any).__DEV__;
  api.hoje.mockImplementation(async () => fx("hoje"));
  api.bloco.mockImplementation(async (id: string) => fx("blocos." + id));
  api.layout.mockImplementation(async () => fx("layout.get"));
  api.ofx.extratos.mockImplementation(async () => ({ meses: [] }));
  api.custos.mes.mockImplementation(async (mes: string) => ({ ...OUTUBRO, mes }));
  api.custos.lancar.mockImplementation(async (corpo: any) => ({ ...OUTUBRO, mes: corpo.mes, total_costs: 730.4, painel_atualizado: true }));
});
afterAll(() => { comoUsuario(null); });

async function flush(vezes = 3) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><PainelHoje podeLancarCusto={podeLancar} /></QueryClientProvider>);
  });
  await flush();
  return tree!;
}
const byTestId = (tree: renderer.ReactTestRenderer, id: string) => tree.root.findAllByProps({ testID: id }, { deep: false });
const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());
async function press(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { byTestId(tree, id)[0].props.onPress(); });
  await flush();
}
async function digitar(tree: renderer.ReactTestRenderer, id: string, valor: string) {
  await act(async () => { byTestId(tree, id)[0].props.onChangeText(valor); });
}

async function abrirModal() {
  const tree = await mount();
  await press(tree, "bloco-expandir-custos");
  await press(tree, "custos-lancar");
  return tree;
}

describe("bloco Custos", () => {
  it("o card mostra o mês sem custo lançado (sem R$ 0) e o detalhe em reais", async () => {
    comoUsuario("admin");
    const tree = await mount();
    const out = text(tree);
    expect(out).toContain("Outubro sem custo lançado");
    await press(tree, "bloco-expandir-custos");
    const det = text(tree);
    expect(det).toContain("R$ 871,17");
    expect(det).toContain("Conta pessoal do sócio");
    tree.unmount();
  });

  it("equipe Aura (user.role admin) vê o botão; dono da loja com companyRole admin não", async () => {
    const montarTela = async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      let tree: renderer.ReactTestRenderer;
      await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}><GestaoAuraHojeScreen /></QueryClientProvider>); });
      await flush();
      return tree!;
    };
    mockAuth = { isStaff: true, user: { id: "u1", role: "admin" } };
    let tree = await montarTela();
    await press(tree, "bloco-expandir-custos");
    expect(byTestId(tree, "custos-lancar")).toHaveLength(1);
    tree.unmount();

    // staff que entrou pelo papel da loja: member_role/companyRole admin, user.role client
    mockAuth = { isStaff: true, user: { id: "u2", role: "client", member_role: "admin", companyRole: "admin" }, company: { member_role: "admin" } };
    tree = await montarTela();
    await press(tree, "bloco-expandir-custos");
    expect(byTestId(tree, "custos-lancar")).toHaveLength(0);
    expect(byTestId(tree, "lancar-custo")).toHaveLength(0);
    tree.unmount();
  });

  it("lança duas categorias: o POST leva só as mexidas, em número, e recarrega o painel", async () => {
    comoUsuario("admin");
    const tree = await abrirModal();
    expect(api.custos.mes).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/));
    expect(byTestId(tree, "custo-salvar")[0].props.disabled).toBe(true);

    await digitar(tree, "custo-valor-infraestrutura", "180,40");
    await press(tree, "custo-origem-infraestrutura-empresa");
    await digitar(tree, "custo-obs-infraestrutura", "Railway + Supabase");
    await digitar(tree, "custo-valor-anthropic", "550");
    await press(tree, "custo-origem-anthropic-socio");
    await digitar(tree, "custo-motivo", "fechamento parcial");
    expect([].concat(byTestId(tree, "custo-total")[0].props.children).join("")).toMatch(/R\$ 730,40$/);
    expect(byTestId(tree, "custo-salvar")[0].props.disabled).toBe(false);

    const antes = api.hoje.mock.calls.length;
    await press(tree, "custo-salvar");
    expect(api.custos.lancar).toHaveBeenCalledTimes(1);
    const corpo = api.custos.lancar.mock.calls[0][0];
    expect(corpo.categorias).toEqual({
      infraestrutura: { valor: 180.4, origem: "empresa", observacao: "Railway + Supabase" },
      anthropic: { valor: 550, origem: "socio", observacao: null },
    });
    expect(corpo.motivo).toBe("fechamento parcial");
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("R$ 730,40"));
    expect(byTestId(tree, "lancar-custo")).toHaveLength(0);
    expect(api.hoje.mock.calls.length).toBeGreaterThan(antes);
    tree.unmount();
  });

  it("valor negativo ou sem origem não salva e diz o porquê", async () => {
    comoUsuario("admin");
    const tree = await abrirModal();
    await digitar(tree, "custo-valor-meta", "49,90");
    expect(byTestId(tree, "custo-salvar")[0].props.disabled).toBe(true);
    await act(async () => { byTestId(tree, "custo-salvar")[0].props.onPress(); });
    expect(byTestId(tree, "custo-erro-meta")).toHaveLength(1);
    expect(text(tree)).toContain("Escolha de onde saiu o dinheiro.");
    expect(api.custos.lancar).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("erro do backend aparece no modal, que continua aberto", async () => {
    comoUsuario("admin");
    api.custos.lancar.mockRejectedValueOnce(new Error("meta: valor não pode ser negativo"));
    const tree = await abrirModal();
    await digitar(tree, "custo-valor-meta", "10");
    await press(tree, "custo-origem-meta-empresa");
    await press(tree, "custo-salvar");
    expect(byTestId(tree, "custo-erro")).toHaveLength(1);
    expect(text(tree)).toContain("meta: valor não pode ser negativo");
    expect(byTestId(tree, "lancar-custo")).toHaveLength(1);
    tree.unmount();
  });

  it("trocar o mês busca o mês escolhido", async () => {
    comoUsuario("admin");
    const tree = await abrirModal();
    const chips = tree.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("custo-mes-") && typeof n.type !== "string");
    const ids = chips.map((n) => n.props.testID as string).filter((v, i, a) => a.indexOf(v) === i);
    expect(ids).toHaveLength(6);
    await press(tree, ids[1]);
    expect(api.custos.mes).toHaveBeenLastCalledWith(ids[1].replace("custo-mes-", ""));
    tree.unmount();
  });
});
