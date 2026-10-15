// ============================================================
// Configurações › Plano › Assento de temporada (13/10/2026)
//
// Aura-backend #811: acesso extra com validade fixa (01/11/2026 a
// 31/01/2027) que expira sozinho. O cartão só aparece de 01/10/2026 a
// 31/01/2027; qualquer membro vê o estado; só o dono contrata e cancela.
// A API é mockada com as formas do contrato do GET/POST/DELETE.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));
const mockRefreshMe = jest.fn();
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel: any) => sel({ refreshMe: mockRefreshMe }),
}));
jest.mock("@/services/billingApi", () => ({
  billingApi: { seatPass: { estado: jest.fn(), contratar: jest.fn(), cancelar: jest.fn() } },
}));

import { AssentoTemporadaCard } from "@/components/screens/configuracoes/AssentoTemporadaCard";
import {
  JANELA_ASSENTO_TEMPORADA, assentoTemporadaVisivel, hojeBrt,
} from "@/components/screens/configuracoes/assentoTemporada";
import { billingApi } from "@/services/billingApi";
import { toast } from "@/components/Toast";

const api = (billingApi as any).seatPass as Record<string, jest.Mock>;
const CID = "00000000-0000-0000-0000-0000000000c1";
const PASSE = "11111111-2222-4333-8444-555555555555";

const TEXTO_PREVIA_1 = "R$ 19,00 por mensalidade (1 assento × R$ 19,00), somados à sua assinatura de 01/11/2026 a 31/01/2027: no máximo 3 mensalidades, R$ 57,00 no total. Depois de 31/01/2027 o assento expira sozinho e o valor da assinatura volta ao normal.";
const TEXTO_PREVIA_2 = "R$ 38,00 por mensalidade (2 assentos × R$ 19,00), somados à sua assinatura de 01/11/2026 a 31/01/2027: no máximo 3 mensalidades, R$ 114,00 no total. Depois de 31/01/2027 o assento expira sozinho e o valor da assinatura volta ao normal.";

function cobranca(qty: number, texto: string) {
  return {
    forma: "assinatura_asaas", valor_unitario: 19, valor_mensal: 19 * qty, mensalidades_ate_o_fim: 3,
    valor_maximo_total: 57 * qty, de: "2026-11-01", ate: "2027-01-31", texto,
  };
}

const ESTADO = (extra: any = {}) => ({
  temporada: { id: "2026-2027", nome: "Temporada de fim de ano 2026/27", starts_at: "2026-11-01", ends_at: "2027-01-31" },
  preco_assento_mensal: 19,
  pode_contratar: true,
  motivo_bloqueio: null,
  limite_restante: 10,
  assentos_ativos: 0,
  assentos_agendados: 0,
  valor_mensal_atual: 0,
  valido_ate: null,
  passes: [],
  ...extra,
});

const PASSE_AGENDADO = {
  id: PASSE, qty: 2, status: "ativo", agendado: true, aplicado: false, starts_at: "2026-11-01", ends_at: "2027-01-31",
  cortesia: false, origem: "loja", sync_pendente: false, encerrado_em: null, motivo_encerramento: null,
  criado_em: "2026-10-13T12:00:00Z", cobranca: cobranca(2, TEXTO_PREVIA_2),
};

jest.setTimeout(30000);

let dateNow: jest.SpyInstance;
function hoje(iso: string) { dateNow.mockReturnValue(new Date(iso + "T15:00:00Z").getTime()); }

beforeEach(() => {
  jest.clearAllMocks();
  dateNow = jest.spyOn(Date, "now");
  hoje("2026-10-13");
  api.estado.mockImplementation(async (_cid: string, qty?: number) => {
    const base = ESTADO();
    if (qty) return { ...base, previa: { qty, ...cobranca(qty, qty === 1 ? TEXTO_PREVIA_1 : TEXTO_PREVIA_2) } };
    return base;
  });
  api.contratar.mockResolvedValue({
    passe: PASSE_AGENDADO, cobranca: cobranca(2, TEXTO_PREVIA_2), comeca_em: "2026-11-01", aplicado_agora: false,
    mensagem: "Assento de temporada agendado: começa em 01/11/2026. " + TEXTO_PREVIA_2,
  });
  api.cancelar.mockResolvedValue({ cancelado: true, assentos_removidos: 0 });
});

afterEach(() => { dateNow.mockRestore(); });

async function flush(vezes = 4) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function mount(props: { isOwner?: boolean; plano?: string } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <AssentoTemporadaCard companyId={CID} isOwner={props.isOwner !== false} plano={props.plano} />
      </QueryClientProvider>,
    );
  });
  await flush();
  return tree!;
}

const byTestId = (tree: renderer.ReactTestRenderer, id: string) => tree.root.findAllByProps({ testID: id }, { deep: false });
// Texto visível da árvore, com os pedaços de cada <Text> juntos.
function plano(no: any): string {
  if (no == null) return "";
  if (typeof no === "string") return no;
  if (Array.isArray(no)) return no.map(plano).join("");
  return plano(no.children);
}
const text = (tree: renderer.ReactTestRenderer) => plano(tree.toJSON());

async function press(tree: renderer.ReactTestRenderer, id: string) {
  const alvo = byTestId(tree, id);
  if (!alvo.length) throw new Error("testID não encontrado: " + id);
  await act(async () => { alvo[0].props.onPress(); });
  await flush();
}

describe("janela de exibição", () => {
  it("a constante cobre 01/10/2026 a 31/01/2027", () => {
    expect(JANELA_ASSENTO_TEMPORADA).toEqual({ visivelDe: "2026-10-01", visivelAte: "2027-01-31" });
    expect(assentoTemporadaVisivel("2026-09-30")).toBe(false);
    expect(assentoTemporadaVisivel("2026-10-01")).toBe(true);
    expect(assentoTemporadaVisivel("2027-01-31")).toBe(true);
    expect(assentoTemporadaVisivel("2027-02-01")).toBe(false);
  });

  it("hojeBrt usa o dia de Brasília, não o de UTC", () => {
    // 01:30 UTC de 01/02 ainda é 31/01 às 22:30 em Brasília.
    expect(hojeBrt(new Date("2027-02-01T01:30:00Z"))).toBe("2027-01-31");
    expect(hojeBrt(new Date("2027-02-01T03:30:00Z"))).toBe("2027-02-01");
  });

  it("antes de 01/10/2026 o cartão não aparece e a API nem é chamada", async () => {
    hoje("2026-09-30");
    const tree = await mount();
    expect(tree.toJSON()).toBeNull();
    expect(api.estado).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("depois de 31/01/2027 o cartão não aparece", async () => {
    hoje("2027-02-01");
    const tree = await mount();
    expect(tree.toJSON()).toBeNull();
    expect(api.estado).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("no último dia da temporada ainda aparece", async () => {
    hoje("2027-01-31");
    const tree = await mount();
    expect(byTestId(tree, "assento-temporada")).toHaveLength(1);
    tree.unmount();
  });
});

describe("estado", () => {
  it("mostra validade, valor por assento e 'nenhum assento contratado'", async () => {
    const tree = await mount();
    expect(api.estado).toHaveBeenCalledWith(CID);
    expect(byTestId(tree, "assento-temporada")).toHaveLength(1);
    const out = text(tree);
    expect(out).toContain("Assento de temporada");
    expect(out).toContain("01/11/2026 a 31/01/2027");
    expect(out).toContain("R$ 19,00 por mensalidade");
    expect(out).toContain("Nenhum assento contratado");
    expect(byTestId(tree, "assento-contratar")).toHaveLength(1);
    tree.unmount();
  });

  it("assentos ativos: quantidade, valor mensal e validade; passe com cancelar", async () => {
    api.estado.mockImplementation(async () => ESTADO({
      assentos_ativos: 2, valor_mensal_atual: 38, valido_ate: "2027-01-31",
      passes: [{ ...PASSE_AGENDADO, agendado: false, aplicado: true }],
    }));
    const tree = await mount();
    const out = text(tree);
    expect(out).toContain("2 assentos ativos");
    expect(out).toContain("R$ 38,00 por mês");
    expect(out).toContain("até 31/01/2027");
    expect(byTestId(tree, "assento-passe-" + PASSE)).toHaveLength(1);
    expect(byTestId(tree, "assento-cancelar-" + PASSE)).toHaveLength(1);
    tree.unmount();
  });

  it("assento agendado aparece com a data de início", async () => {
    api.estado.mockImplementation(async () => ESTADO({ assentos_agendados: 2, passes: [PASSE_AGENDADO] }));
    const tree = await mount();
    expect(text(tree)).toContain("2 assentos agendados");
    expect(text(tree)).toContain("começa em 01/11/2026");
    tree.unmount();
  });

  it("503 (migration pendente): 'disponível em breve'", async () => {
    api.estado.mockRejectedValue(Object.assign(new Error("x"), { status: 503, data: { code: "MIGRATION_PENDING" } }));
    const tree = await mount();
    expect(byTestId(tree, "assento-em-breve")).toHaveLength(1);
    expect(text(tree)).toContain("disponível em breve");
    expect(byTestId(tree, "assento-contratar")).toHaveLength(0);
    tree.unmount();
  });

  it("erro comum: 'tentar de novo' refaz a chamada", async () => {
    api.estado.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 500, data: {} }));
    const tree = await mount();
    expect(byTestId(tree, "assento-erro")).toHaveLength(1);
    await press(tree, "assento-tentar-de-novo");
    expect(api.estado).toHaveBeenCalledTimes(2);
    expect(byTestId(tree, "assento-erro")).toHaveLength(0);
    tree.unmount();
  });
});

describe("contratar", () => {
  it("abre com 1 assento e a prévia da cobrança antes de confirmar", async () => {
    const tree = await mount();
    await press(tree, "assento-contratar");
    expect(api.estado).toHaveBeenLastCalledWith(CID, 1);
    expect(byTestId(tree, "assento-contratar-painel")).toHaveLength(1);
    expect(text(tree)).toContain(TEXTO_PREVIA_1);
    expect(api.contratar).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("mudar a quantidade (1 a 10) refaz a prévia", async () => {
    const tree = await mount();
    await press(tree, "assento-contratar");
    expect(byTestId(tree, "assento-qty-menos")[0].props.disabled).toBe(true);
    await press(tree, "assento-qty-mais");
    expect(api.estado).toHaveBeenLastCalledWith(CID, 2);
    expect(text(tree)).toContain(TEXTO_PREVIA_2);
    expect(JSON.stringify(byTestId(tree, "assento-qty")[0].props.children)).toBe("2");
    tree.unmount();
  });

  it("o teto do seletor respeita o limite restante da loja", async () => {
    api.estado.mockImplementation(async (_c: string, qty?: number) => ({
      ...ESTADO({ limite_restante: 2 }),
      ...(qty ? { previa: { qty, ...cobranca(qty, "texto " + qty) } } : {}),
    }));
    const tree = await mount();
    await press(tree, "assento-contratar");
    await press(tree, "assento-qty-mais");
    expect(byTestId(tree, "assento-qty-mais")[0].props.disabled).toBe(true);
    await press(tree, "assento-qty-mais");
    expect(api.estado).toHaveBeenLastCalledWith(CID, 2);
    tree.unmount();
  });

  it("confirmar: POST com a quantidade, texto pronto da cobrança e atualização do estado", async () => {
    const tree = await mount();
    await press(tree, "assento-contratar");
    await press(tree, "assento-qty-mais");
    const antes = api.estado.mock.calls.length;
    await press(tree, "assento-contratar-confirmar");
    expect(api.contratar).toHaveBeenCalledWith(CID, 2);
    expect(byTestId(tree, "assento-sucesso")).toHaveLength(1);
    expect(text(tree)).toContain("Assento de temporada agendado: começa em 01/11/2026.");
    expect(byTestId(tree, "assento-contratar-painel")).toHaveLength(0);
    expect(toast.success).toHaveBeenCalledWith("Assento de temporada agendado.");
    // Recarrega o estado e pede ao /me os acessos novos.
    expect(api.estado.mock.calls.length).toBeGreaterThan(antes);
    expect(mockRefreshMe).toHaveBeenCalled();
    tree.unmount();
  });

  it("voltar da prévia não contrata", async () => {
    const tree = await mount();
    await press(tree, "assento-contratar");
    await press(tree, "assento-contratar-cancelar");
    expect(byTestId(tree, "assento-contratar-painel")).toHaveLength(0);
    expect(api.contratar).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("409 SEM_ASSINATURA no POST mostra o motivo", async () => {
    api.contratar.mockRejectedValue(Object.assign(new Error("x"), { status: 409, data: { code: "SEM_ASSINATURA" } }));
    const tree = await mount();
    await press(tree, "assento-contratar");
    await press(tree, "assento-contratar-confirmar");
    expect(byTestId(tree, "assento-aviso")).toHaveLength(1);
    expect(text(tree)).toContain("precisa de uma assinatura ativa");
    tree.unmount();
  });

  it("409 VALOR_CUSTOMIZADO no POST: texto claro, sem erro genérico", async () => {
    api.contratar.mockRejectedValue(Object.assign(new Error("x"), { status: 409, data: { code: "VALOR_CUSTOMIZADO" } }));
    const tree = await mount();
    await press(tree, "assento-contratar");
    await press(tree, "assento-contratar-confirmar");
    expect(text(tree)).toContain("Esta empresa tem valor combinado; fale com a equipe.");
    expect(text(tree)).not.toContain("Não consegui contratar");
    tree.unmount();
  });

  it("502 (Asaas fora): nada foi concedido nem cobrado", async () => {
    api.contratar.mockRejectedValue(Object.assign(new Error("x"), { status: 502, data: { code: "FALHA_ASAAS" } }));
    const tree = await mount();
    await press(tree, "assento-contratar");
    await press(tree, "assento-contratar-confirmar");
    expect(text(tree)).toContain("Nada foi concedido nem cobrado");
    tree.unmount();
  });

  it("503 no POST: disponível em breve", async () => {
    api.contratar.mockRejectedValue(Object.assign(new Error("x"), { status: 503, data: { code: "MIGRATION_PENDING" } }));
    const tree = await mount();
    await press(tree, "assento-contratar");
    await press(tree, "assento-contratar-confirmar");
    expect(text(tree)).toContain("disponível em breve");
    tree.unmount();
  });
});

describe("cancelar", () => {
  it("pede confirmação e só então chama o DELETE", async () => {
    api.estado.mockImplementation(async () => ESTADO({ assentos_agendados: 2, passes: [PASSE_AGENDADO] }));
    const tree = await mount();
    await press(tree, "assento-cancelar-" + PASSE);
    expect(byTestId(tree, "assento-cancelar-confirmacao-" + PASSE)).toHaveLength(1);
    expect(text(tree)).toContain("Cancelar este assento?");
    expect(api.cancelar).not.toHaveBeenCalled();

    await press(tree, "assento-cancelar-voltar");
    expect(byTestId(tree, "assento-cancelar-confirmacao-" + PASSE)).toHaveLength(0);
    expect(api.cancelar).not.toHaveBeenCalled();

    await press(tree, "assento-cancelar-" + PASSE);
    await press(tree, "assento-cancelar-confirmar");
    expect(api.cancelar).toHaveBeenCalledWith(CID, PASSE);
    expect(toast.success).toHaveBeenCalledWith("Assento de temporada cancelado.");
    expect(mockRefreshMe).toHaveBeenCalled();
    tree.unmount();
  });

  it("passe de cortesia da Aura aparece sem valor de cobrança", async () => {
    api.estado.mockImplementation(async () => ESTADO({
      assentos_ativos: 1, valor_mensal_atual: 0, valido_ate: "2027-01-31",
      passes: [{ ...PASSE_AGENDADO, qty: 1, agendado: false, aplicado: true, cortesia: true, origem: "admin" }],
    }));
    const tree = await mount();
    expect(text(tree)).toContain("Cortesia da Aura, sem cobrança.");
    tree.unmount();
  });
});

describe("sem como contratar", () => {
  it("sem assinatura ativa: explica e leva ao checkout do plano atual", async () => {
    api.estado.mockImplementation(async () => ESTADO({ pode_contratar: false, motivo_bloqueio: "sem_assinatura" }));
    const tree = await mount({ plano: "essencial" });
    expect(byTestId(tree, "assento-contratar")).toHaveLength(0);
    expect(byTestId(tree, "assento-sem-assinatura")).toHaveLength(1);
    expect(text(tree)).toContain("precisa de uma assinatura ativa");
    await press(tree, "assento-ir-checkout");
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/checkout?plan=essencial");
    tree.unmount();
  });

  it("valor combinado vigente: sem botão e com o motivo claro", async () => {
    api.estado.mockImplementation(async () => ESTADO({ pode_contratar: false, motivo_bloqueio: "valor_customizado" }));
    const tree = await mount();
    expect(byTestId(tree, "assento-contratar")).toHaveLength(0);
    expect(text(tree)).toContain("Esta empresa tem valor combinado; fale com a equipe.");
    tree.unmount();
  });

  it("limite de assentos atingido: sem botão e com o motivo", async () => {
    api.estado.mockImplementation(async () => ESTADO({ pode_contratar: false, motivo_bloqueio: "limite_de_assentos", limite_restante: 0, assentos_ativos: 10 }));
    const tree = await mount();
    expect(byTestId(tree, "assento-contratar")).toHaveLength(0);
    expect(text(tree)).toContain("máximo de assentos de temporada");
    tree.unmount();
  });
});

describe("membro (não é o dono)", () => {
  it("vê o estado, sem botões de contratar nem cancelar", async () => {
    api.estado.mockImplementation(async () => ESTADO({
      assentos_ativos: 2, valor_mensal_atual: 38, valido_ate: "2027-01-31",
      passes: [{ ...PASSE_AGENDADO, agendado: false, aplicado: true }],
    }));
    const tree = await mount({ isOwner: false });
    const out = text(tree);
    expect(out).toContain("2 assentos ativos");
    expect(byTestId(tree, "assento-passe-" + PASSE)).toHaveLength(1);
    expect(byTestId(tree, "assento-contratar")).toHaveLength(0);
    expect(byTestId(tree, "assento-cancelar-" + PASSE)).toHaveLength(0);
    expect(byTestId(tree, "assento-so-dono")).toHaveLength(1);
    tree.unmount();
  });
});
