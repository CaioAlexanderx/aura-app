// ============================================================
// RA-06 — Situação da sua conta (Recebe na Aura).
//
// Regra do Caio: com RECEBE_NA_AURA_ENABLED desligada nenhum lojista vê
// item de menu, rota, botão nem aviso novo, e a rota direta não abre.
// Estes testes seguram:
// 1. lojista comum: 404 (flag desligada) ou 403 → a tela não desenha nada
//    e manda para Configurações; nem durante o carregamento aparece o nome;
// 2. e-mail @getaura.com.br SEM is_staff gravado é lojista (domínio não
//    conta);
// 3. equipe (is_staff gravado) vê prévia marcada, com dados de exemplo;
// 4. flag ligada e dono: os 4 blocos na ordem, selo e canais da Asaas, e
//    "Atualizar" chama o backend;
// 5. não existe item de menu nem link para /recebe em lugar nenhum.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn(), replace: (...a: any[]) => mockReplace(...a) } }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

var mockUser: any = null;
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = { user: mockUser, company: { id: "loja-1", plan: "negocio" }, token: "t", isHydrated: true };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));

jest.mock("@/hooks/useVisibleModules", () => ({
  useVisibleModules: () => new Set(["configuracoes", "recebe.status"]),
  useVisibleModulesProntos: () => true,
}));

var mockGetStatus = jest.fn();
var mockAtualizar = jest.fn();
jest.mock("@/services/recebeApi", () => ({
  recebeApi: {
    getStatus: (id: string) => mockGetStatus(id),
    atualizarStatus: (id: string) => mockAtualizar(id),
  },
}));

import RecebeStatusScreen from "@/app/(tabs)/recebe/status";
import { ehContaDaEquipe } from "@/hooks/useRecebeNaAura";

const RAIZ = path.resolve(__dirname, "..", "..");

const LOJISTA = { id: "u1", email: "dona@loja.com.br", is_staff: false };
const LOJISTA_DOMINIO = { id: "u2", email: "alguem@getaura.com.br", is_staff: false };
const EQUIPE = { id: "u3", email: "qa@exemplo.com", is_staff: true };

function erro(status: number) {
  return Object.assign(new Error("x"), { status, data: { code: status === 404 ? "RECEBE_INDISPONIVEL" : "SOMENTE_DONO_OU_ADMIN" } });
}

const STATUS_REAL = {
  enabled: true, product_name: "Recebe na Aura", status: "docs_pending", holder_type: "PJ",
  onboarding_url: "https://exemplo.invalid/onboarding", account: null,
  blocks: [
    { key: "geral", status: "PENDING" },
    { key: "dados_comerciais", status: "APPROVED" },
    { key: "documentos", status: "PENDING" },
    { key: "dados_bancarios", status: "AWAITING_APPROVAL" },
  ],
  blocks_updated_at: "2026-11-12T14:00:00.000Z", created_at: "2026-11-10T12:00:00Z",
};

async function flush() {
  // O React Query notifica por setTimeout(0): micro-tarefas não bastam.
  await act(async () => {
    for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
  });
}

async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><RecebeStatusScreen /></QueryClientProvider>);
  });
  await flush();
  return tree;
}

const porId = (tree: any, id: string) => tree.root.findAllByProps({ testID: id }, { deep: false });
const texto = (tree: any) => JSON.stringify(tree.toJSON() || "");

beforeEach(() => {
  mockReplace.mockClear();
  mockGetStatus.mockReset();
  mockAtualizar.mockReset();
});

describe("lojista comum não enxerga nada", () => {
  it.each([
    ["flag desligada (404)", LOJISTA, 404],
    ["não é dono nem admin (403)", LOJISTA, 403],
    ["e-mail da Aura sem is_staff gravado (404)", LOJISTA_DOMINIO, 404],
  ])("%s: tela vazia e volta para Configurações", async (_n, user, st) => {
    mockUser = user;
    mockGetStatus.mockRejectedValue(erro(st as number));
    const tree = await montar();
    expect(tree.toJSON()).toBeNull();
    expect(texto(tree)).not.toContain("Recebe na Aura");
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/configuracoes");
    tree.unmount();
  });

  it("carregando: só o indicador, sem nome do produto", async () => {
    mockUser = LOJISTA;
    mockGetStatus.mockReturnValue(new Promise(() => {}));
    const tree = await montar();
    expect(porId(tree, "recebe-carregando").length).toBe(1);
    expect(texto(tree)).not.toContain("Recebe");
    expect(texto(tree)).not.toContain("Asaas");
    tree.unmount();
  });

  it("domínio do e-mail nunca faz de alguém equipe", () => {
    expect(ehContaDaEquipe(LOJISTA_DOMINIO)).toBe(false);
    expect(ehContaDaEquipe({ email: "x@getaura.com.br" })).toBe(false);
    expect(ehContaDaEquipe({ is_staff: "true" })).toBe(false);
    expect(ehContaDaEquipe(EQUIPE)).toBe(true);
  });

  it("não há item de menu nem link para /recebe fora da própria tela", () => {
    const achados: string[] = [];
    function varrer(dir: string) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!p.includes(path.join("app", "(tabs)", "recebe"))) varrer(p); continue; }
        if (!/\.tsx?$/.test(e.name)) continue;
        const t = fs.readFileSync(p, "utf8");
        if (/["'`]\/(\(tabs\)\/)?recebe(\/|["'`])/.test(t)) achados.push(path.relative(RAIZ, p));
      }
    }
    ["app", "components", "constants", "hooks"].forEach((d) => varrer(path.join(RAIZ, d)));
    expect(achados).toEqual([]);
  });
});

describe("equipe (is_staff gravado): prévia marcada", () => {
  it("404 do servidor: faixa de prévia, dados de exemplo e troca de cenário", async () => {
    mockUser = EQUIPE;
    mockGetStatus.mockRejectedValue(erro(404));
    const tree = await montar();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(porId(tree, "recebe-previa-equipe").length).toBe(1);
    expect(texto(tree)).toContain("RECEBE_NA_AURA_ENABLED desligada no servidor");
    expect(texto(tree)).toContain("Dados de exemplo");
    // Prévia nunca oferece atualizar nem enviar documento de verdade.
    expect(porId(tree, "recebe-atualizar").length).toBe(0);

    await act(async () => { porId(tree, "recebe-previa-pendente")[0].props.onPress(); });
    expect(texto(tree)).toContain("falta documento");
    expect(porId(tree, "recebe-enviar-documentos").length).toBe(0);
    tree.unmount();
  });
});

describe("flag ligada, dono da loja", () => {
  it("4 blocos na ordem da tela, selo e canais da Asaas", async () => {
    mockUser = LOJISTA;
    mockGetStatus.mockResolvedValue(STATUS_REAL);
    const tree = await montar();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(porId(tree, "recebe-previa-equipe").length).toBe(0);

    const t = texto(tree);
    const pos = ["Dados da empresa", "Documentos", "Dados bancários", "Situação geral"].map((n) => t.indexOf(n));
    expect(pos.every((x) => x >= 0)).toBe(true);
    expect([...pos].sort((x, y) => x - y)).toEqual(pos);
    for (const k of ["dados_comerciais", "documentos", "dados_bancarios", "geral"]) {
      expect(porId(tree, `recebe-bloco-${k}`).length).toBe(1);
    }
    expect(t).toContain("Dados da empresa");
    expect(t).toContain("falta documento");
    expect(t).toContain("em análise");
    expect(t).toContain("Envie os documentos que faltam.");
    expect(porId(tree, "recebe-enviar-documentos").length).toBe(1);
    expect(porId(tree, "recebe-resumo")[0]).toBeTruthy();
    expect(t).toContain("ação sua");
    expect(porId(tree, "recebe-canais-asaas").length).toBe(1);
    expect(porId(tree, "recebe-selo-asaas").length).toBe(1);
    expect(t).toContain("0800 009 0037");
    // Nenhuma promessa de prazo de aprovação ("24 horas" é o horário do
    // WhatsApp da Asaas, não prazo).
    expect(t).not.toMatch(/dias úteis|em até|prazo|aprovad[ao] em \d/i);
    tree.unmount();
  });

  it("Atualizar chama o backend e mostra o retorno", async () => {
    mockUser = LOJISTA;
    mockGetStatus.mockResolvedValue(STATUS_REAL);
    mockAtualizar.mockResolvedValue({
      ...STATUS_REAL, status: "approved",
      blocks: STATUS_REAL.blocks.map((b) => ({ ...b, status: "APPROVED" })),
    });
    const tree = await montar();
    await act(async () => { porId(tree, "recebe-atualizar")[0].props.onPress(); });
    await flush();
    expect(mockAtualizar).toHaveBeenCalledWith("loja-1");
    expect(texto(tree)).toContain("Pronto. A loja online já pode receber.");
    expect(texto(tree)).toContain("ativo");
    tree.unmount();
  });

  it("sem subconta: só a frase, sem blocos nem botão", async () => {
    mockUser = LOJISTA;
    mockGetStatus.mockResolvedValue({ ...STATUS_REAL, status: "none", blocks: null, blocks_updated_at: null });
    const tree = await montar();
    expect(porId(tree, "recebe-sem-conta").length).toBe(1);
    expect(porId(tree, "recebe-atualizar").length).toBe(0);
    tree.unmount();
  });
});
