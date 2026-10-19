// ============================================================
// Check-in: pergunta da frente para conta sem frente (19/10/2026, tq-33).
//
// Decisão da Nina: conta com companies.segment vazio (7 de 20 cadastros
// desde 05/10, a consulta do CNPJ não trouxe o CNAE) vê "O que a sua loja
// vende?" antes das três perguntas, com as frentes do cartão "Sua frente"
// de Configurações. Um toque grava por PATCH /companies/:id/segment, a rota
// do cartão — o backend (routes/companySegment.js) grava
// segment_source = 'user'. Quem já tem frente não vê.
// ============================================================
import fs from "fs";
import path from "path";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: (...a: any[]) => mockReplace(...a), push: jest.fn() }),
  router: { replace: (...a: any[]) => mockReplace(...a) },
}));

let mockAuth: any;
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) { return typeof selector === "function" ? selector(mockAuth) : mockAuth; },
    { getState: () => mockAuth },
  ),
}));

let mockModulos: Set<string> = new Set();
jest.mock("@/hooks/useVisibleModules", () => {
  const real = jest.requireActual("@/hooks/useVisibleModules");
  return { ...real, useVisibleModules: () => mockModulos };
});

const mockGet = jest.fn();
const mockPut = jest.fn();
jest.mock("@/services/checkinApi", () => {
  const real = jest.requireActual("@/services/checkinApi");
  return { ...real, checkinApi: { get: (...a: any[]) => mockGet(...a), put: (...a: any[]) => mockPut(...a) } };
});

jest.mock("@/hooks/useTemProduto", () => ({
  temProdutoQueryKey: (cid: any) => ["tem-produto", cid || null],
  useTemProduto: () => ({ data: false }),
  garantirTemProduto: () => Promise.resolve(false),
}));

// A gravação da frente: o mesmo frenteApi.trocar do cartão "Sua frente"
// (a URL e o método reais são conferidos no teste de fonte, abaixo).
const mockRequest = jest.fn();
jest.mock("@/services/primeirosPassosApi", () => {
  const real = jest.requireActual("@/services/primeirosPassosApi");
  return {
    ...real,
    frenteApi: { trocar: (cid: string, body: any) => mockRequest("/companies/" + cid + "/segment", { method: "PATCH", body }) },
  };
});

import { CheckinEntrada } from "@/components/onboarding/CheckinEntrada";
import { FrenteDaLoja } from "@/components/screens/configuracoes/FrenteDaLoja";
import { MOD_CHECKIN } from "@/constants/checkin";
import { SEGMENT_LABEL, SEGMENTOS } from "@/constants/primeirosPassos";
import { opcoesDeFrente, precisaPerguntarFrente } from "@/utils/checkinRegras";

const HABILITADO = { habilitado: true, respondido: false, pulou: false, versao: 1, respostas: {} };

function resetar(company: any = {}) {
  mockReplace.mockReset(); mockGet.mockReset(); mockPut.mockReset(); mockRequest.mockReset();
  mockGet.mockResolvedValue(HABILITADO);
  mockPut.mockResolvedValue({ ok: true });
  mockRequest.mockImplementation((_url: string, opts: any) => Promise.resolve({
    segment: opts?.body?.segment ?? null, segment_source: "user", vertical_active: opts?.body?.segment === "studio" ? "studio" : null,
    flags: { matcon_enabled: false, otica_enabled: false, os_enabled: false, studio_enabled: false },
  }));
  mockModulos = new Set(["estoque", "pdv", "nfe", "painel", MOD_CHECKIN]);
  mockAuth = {
    token: "t", isStaff: false, isDemo: false, consolidatedView: false,
    updateCompany: jest.fn((p: any) => { mockAuth.company = { ...mockAuth.company, ...p }; }),
    company: { id: "loja-1", name: "Loja", plan: "essencial", member_role: "owner", segment: null, vertical_active: null, ...company },
  };
}

async function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => { tree = renderer.create(<QueryClientProvider client={client}><CheckinEntrada /></QueryClientProvider>); });
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}
const achar = (t: any, id: string) => t.root.findAllByProps({ testID: id });
const esvaziar = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const chamadasDaFrente = () => mockRequest.mock.calls.filter((c) => String(c[0]).endsWith("/segment"));

describe("regra pura", () => {
  test("só pergunta para conta sem frente e sem vertical", () => {
    expect(precisaPerguntarFrente({ segment: null })).toBe(true);
    expect(precisaPerguntarFrente({ segment: "" })).toBe(true);
    expect(precisaPerguntarFrente({})).toBe(true);
    expect(precisaPerguntarFrente({ segment: "varejo" })).toBe(false);
    expect(precisaPerguntarFrente({ segment: "outro" })).toBe(false);
    expect(precisaPerguntarFrente({ segment: null, vertical_active: "studio" })).toBe(false);
    expect(precisaPerguntarFrente({ segment: null, vertical_active: "odonto" })).toBe(false);
    expect(precisaPerguntarFrente(null)).toBe(false);
  });

  test("mesmas frentes do cartão 'Sua frente'; Personalizados só com plano que tem Studio", () => {
    expect(opcoesDeFrente("negocio")).toEqual(SEGMENTOS);
    expect(opcoesDeFrente("essencial")).toEqual(["varejo", "matcon", "otica", "assistencia", "outro"]);
    expect(opcoesDeFrente(undefined)).not.toContain("studio");
  });
});

describe("a tela", () => {
  test("conta sem frente vê a pergunta, com as frentes do cartão de Configurações", async () => {
    resetar();
    const tree = await montar();
    expect(achar(tree, "checkin-pergunta-frente").length).toBeGreaterThan(0);
    ["varejo", "matcon", "otica", "assistencia", "outro"].forEach((s) =>
      expect(achar(tree, `checkin-chip-frente-${s}`).length).toBeGreaterThan(0));
    // Essencial: Personalizados some (nada desabilitado).
    expect(achar(tree, "checkin-chip-frente-studio").length).toBe(0);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("O que a sua loja vende?");
    expect(json).toContain(SEGMENT_LABEL.matcon);
    expect(json).toContain("Quatro perguntas para abrir do seu jeito");
    expect(json).not.toContain("Sua Aura já abre como loja em geral.");
    // as três de sempre continuam
    ["comeco", "onde_anota", "produtos_faixa"].forEach((c) =>
      expect(achar(tree, `checkin-pergunta-${c}`).length).toBeGreaterThan(0));
    tree.unmount();
  });

  test("conta com frente não vê a pergunta nem grava frente", async () => {
    resetar({ segment: "otica" });
    const tree = await montar();
    expect(achar(tree, "checkin-pergunta-frente").length).toBe(0);
    expect(JSON.stringify(tree.toJSON())).toContain("Três perguntas para abrir do seu jeito");
    expect(chamadasDaFrente()).toHaveLength(0);
    tree.unmount();
  });

  test("um toque grava pela rota do cartão (PATCH /segment, origem 'user' no servidor)", async () => {
    resetar();
    const tree = await montar();
    await act(async () => { achar(tree, "checkin-chip-frente-matcon")[0].props.onPress(); });
    await esvaziar();
    const chamadas = chamadasDaFrente();
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0][0]).toBe("/companies/loja-1/segment");
    // o check-in manda only_if_empty (grava só se a conta ainda não tem frente)
    expect(chamadas[0][1]).toEqual({ method: "PATCH", body: { segment: "matcon", only_if_empty: true } });
    expect(mockAuth.updateCompany).toHaveBeenCalledWith({ segment: "matcon" });
    // a pergunta continua na tela, marcada, e o Continuar libera
    const chip = achar(tree, "checkin-chip-frente-matcon")[0];
    expect(chip.props.accessibilityState.selected).toBe(true);
    expect(achar(tree, "checkin-continuar")[0].props.disabled).toBe(false);
    tree.unmount();
  });

  test("trocar de ideia regrava; tocar na mesma não repete", async () => {
    resetar();
    const tree = await montar();
    await act(async () => { achar(tree, "checkin-chip-frente-varejo")[0].props.onPress(); });
    await esvaziar();
    await act(async () => { achar(tree, "checkin-chip-frente-varejo")[0].props.onPress(); });
    await esvaziar();
    await act(async () => { achar(tree, "checkin-chip-frente-otica")[0].props.onPress(); });
    await esvaziar();
    expect(chamadasDaFrente().map((c) => c[1].body.segment)).toEqual(["varejo", "otica"]);
    tree.unmount();
  });

  test("não sobrescreve frente que chegou pelo /auth/me revalidado", async () => {
    resetar();
    // O /auth/me ainda em voo no toque; quando volta, a conta já tem frente.
    let soltar: () => void = () => {};
    mockAuth.refreshMe = jest.fn(() => new Promise<void>((r) => {
      soltar = () => { mockAuth.company = { ...mockAuth.company, segment: "otica" }; r(); };
    }));
    const tree = await montar();
    await act(async () => { achar(tree, "checkin-chip-frente-matcon")[0].props.onPress(); });
    await esvaziar();
    expect(chamadasDaFrente()).toHaveLength(0); // espera a revalidação antes de gravar
    await act(async () => { soltar(); });
    await esvaziar();
    expect(chamadasDaFrente()).toHaveLength(0);
    expect(achar(tree, "checkin-pergunta-frente").length).toBe(0);
    tree.unmount();
  });

  test("resposta { applied: false, segment }: sucesso, nada muda na tela", async () => {
    resetar();
    mockRequest.mockResolvedValueOnce({ applied: false, segment: "otica", segment_source: "cnae", vertical_active: null, flags: {} });
    const tree = await montar();
    await act(async () => { achar(tree, "checkin-chip-frente-matcon")[0].props.onPress(); });
    await esvaziar();
    expect(chamadasDaFrente()).toHaveLength(1);
    // a escolha continua marcada, sem erro, e o Continuar libera
    expect(achar(tree, "checkin-chip-frente-matcon")[0].props.accessibilityState.selected).toBe(true);
    expect(achar(tree, "checkin-frente-erro").length).toBe(0);
    expect(achar(tree, "checkin-pergunta-frente").length).toBeGreaterThan(0);
    expect(achar(tree, "checkin-continuar")[0].props.disabled).toBe(false);
    // o store fica com a frente do servidor, não com a escolhida
    expect(mockAuth.updateCompany).toHaveBeenCalledWith({ segment: "otica" });
    expect(mockAuth.updateCompany).not.toHaveBeenCalledWith({ segment: "matcon" });
    tree.unmount();
  });

  test("o cartão 'Sua frente' de Configurações NÃO manda only_if_empty", async () => {
    resetar({ segment: "varejo" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let tree: any;
    await act(async () => {
      tree = renderer.create(<QueryClientProvider client={client}><FrenteDaLoja display={{}} /></QueryClientProvider>);
    });
    await act(async () => { achar(tree, "pdv-settings-frente-trocar")[0].props.onPress(); });
    await act(async () => { achar(tree, "pdv-settings-frente-opcao-matcon")[0].props.onPress(); });
    await act(async () => { achar(tree, "pdv-settings-frente-salvar")[0].props.onPress(); });
    await act(async () => { await achar(tree, "pdv-settings-frente-confirmar")[0].props.onPress(); });
    await esvaziar();
    const chamadas = chamadasDaFrente();
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0][1].body.segment).toBe("matcon");
    expect(chamadas[0][1].body).not.toHaveProperty("only_if_empty");
    tree.unmount();
  });

  test("falha ao gravar: desmarca e mostra o erro, sem travar a tela", async () => {
    resetar();
    mockRequest.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 500 }));
    const tree = await montar();
    await act(async () => { achar(tree, "checkin-chip-frente-matcon")[0].props.onPress(); });
    await esvaziar();
    expect(achar(tree, "checkin-chip-frente-matcon")[0].props.accessibilityState.selected).toBe(false);
    expect(achar(tree, "checkin-frente-erro").length).toBeGreaterThan(0);
    expect(achar(tree, "checkin-pular").length).toBeGreaterThan(0);
    tree.unmount();
  });

  test("Personalizados (Negócio): o Continuar abre o Aura Studio", async () => {
    resetar({ plan: "negocio" });
    const tree = await montar();
    await act(async () => { achar(tree, "checkin-chip-frente-studio")[0].props.onPress(); });
    await esvaziar();
    // a vertical só entra no store no Continuar (o guard raiz troca de shell)
    expect(mockAuth.updateCompany).toHaveBeenCalledWith({ segment: "studio" });
    expect(mockAuth.updateCompany).not.toHaveBeenCalledWith({ vertical_active: "studio" });
    await act(async () => { await achar(tree, "checkin-continuar")[0].props.onPress(); });
    await esvaziar();
    expect(mockAuth.updateCompany).toHaveBeenCalledWith({ vertical_active: "studio" });
    expect(mockReplace).toHaveBeenCalledWith("/studio");
    tree.unmount();
  });

  test("só a frente respondida: o Continuar segue (Painel, sem 'por onde começar')", async () => {
    resetar();
    const tree = await montar();
    await act(async () => { achar(tree, "checkin-chip-frente-outro")[0].props.onPress(); });
    await esvaziar();
    await act(async () => { await achar(tree, "checkin-continuar")[0].props.onPress(); });
    await esvaziar();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    tree.unmount();
  });
});

describe("fonte", () => {
  test("frenteApi.trocar é o PATCH /companies/:id/segment (o backend grava segment_source = 'user')", () => {
    const api = fs.readFileSync(path.join(__dirname, "..", "services/primeirosPassosApi.ts"), "utf8");
    expect(api).toContain('"/companies/" + companyId + "/segment", { method: "PATCH", body: body, retry: 0 }');
  });

  test("reaproveita a lista e a rota do cartão 'Sua frente'", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "components/onboarding/CheckinEntrada.tsx"), "utf8");
    expect(src).toContain('import { frenteApi, type Segmento, type TrocarFrenteResponse } from "@/services/primeirosPassosApi";');
    expect(src).toContain("frenteApi.trocar(companyId, { segment: seg, only_if_empty: true })");
    expect(fs.readFileSync(path.join(__dirname, "..", "components/screens/configuracoes/FrenteDaLoja.tsx"), "utf8"))
      .not.toContain("only_if_empty");
    const regras = fs.readFileSync(path.join(__dirname, "..", "utils/checkinRegras.ts"), "utf8");
    expect(regras).toContain('import { PLANOS_COM_STUDIO, SEGMENTOS } from "@/constants/primeirosPassos";');
    const cartao = fs.readFileSync(path.join(__dirname, "..", "components/screens/configuracoes/FrenteDaLoja.tsx"), "utf8");
    expect(cartao).toContain("PLANOS_COM_STUDIO");
    expect(cartao).toContain("SEGMENTOS.filter");
  });
});
