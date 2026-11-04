// ============================================================
// AURA. — ConviteDeAvisos: o card do Painel/Caixa (04/11/2026)
//
// Renderiza de verdade: aparece só com o aviso "inativo" e para quem
// decide; "Ligar avisos" chama ativarAviso e some; "Agora não" some e
// grava a dispensa; bloqueado/ativo/indisponível não mostram nada.
// ============================================================
// jest.mock e icado acima dos imports: o mock nasce dentro da fabrica e e
// lido de volta pelo modulo (mockWebPush) depois dos imports.
jest.mock("@/services/webPush", () => ({ estadoDoAviso: jest.fn(), ativarAviso: jest.fn() }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

let mockPerm: any = { is_owner: true };
let mockAuth: any = { company: { id: "c1", member_role: "owner" }, token: "t", consolidatedView: false, isDemo: false };
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: mockPerm, isLoading: false }) }));
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  RN.Platform.OS = "web";
  return RN;
});

import React from "react";
import { Pressable, Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import { ConviteDeAvisos } from "@/components/ConviteDeAvisos";
import * as webPushMod from "@/services/webPush";
const mockWebPush = webPushMod as unknown as { estadoDoAviso: jest.Mock; ativarAviso: jest.Mock };
import { toast } from "@/components/Toast";
import { CHAVE_DO_CONVITE } from "@/utils/avisosNoCelular";

const store: Record<string, string> = {};
// O jsdom nao deixa trocar o window: troca-se so o localStorage dele.
beforeAll(() => {
  const w = (globalThis as any).window || ((globalThis as any).window = {});
  Object.defineProperty(w, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    },
  });
});
beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(store)) delete store[k];
  mockPerm = { is_owner: true };
  mockAuth = { company: { id: "c1", member_role: "owner" }, token: "t", consolidatedView: false, isDemo: false };
  mockWebPush.estadoDoAviso.mockResolvedValue("inativo");
  mockWebPush.ativarAviso.mockResolvedValue("ativo");
});

const textos = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t: any) => String(t.props.children)).join(" | ");
const botao = (tree: renderer.ReactTestRenderer, txt: string) =>
  tree.root.findAllByType(Pressable).find((p: any) => {
    try { return p.findAllByType(Text).some((t: any) => String(t.props.children) === txt); } catch { return false; }
  })!;

async function montar() {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<ConviteDeAvisos />); });
  await act(async () => { await Promise.resolve(); });
  return tree;
}

test("dona com o aviso inativo ve o convite", async () => {
  const tree = await montar();
  expect(textos(tree)).toMatch(/Saiba de cada venda no celular/);
  expect(textos(tree)).toMatch(/Ligar avisos/);
});

test('"Ligar avisos" liga neste aparelho, agradece e o card some', async () => {
  const tree = await montar();
  await act(async () => { botao(tree, "Ligar avisos").props.onPress(); });
  expect(mockWebPush.ativarAviso).toHaveBeenCalledWith("c1");
  expect(toast.success).toHaveBeenCalledWith("Avisos ligados neste aparelho.");
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
  expect(store[CHAVE_DO_CONVITE]).toBe("1");
});

test('"Agora nao" some e nao volta', async () => {
  const tree = await montar();
  await act(async () => { botao(tree, "Agora não").props.onPress(); });
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
  expect(store[CHAVE_DO_CONVITE]).toBe("1");
  const outra = await montar();
  expect(outra.root.findAllByType(Text)).toHaveLength(0);
  expect(mockWebPush.estadoDoAviso).toHaveBeenCalledTimes(1);
});

test("ja ativo, bloqueado ou sem suporte: nada", async () => {
  for (const e of ["ativo", "bloqueado", "indisponivel"]) {
    mockWebPush.estadoDoAviso.mockResolvedValue(e);
    const tree = await montar();
    expect(tree.root.findAllByType(Text)).toHaveLength(0);
  }
});

test("operadora de caixa nao decide: nada", async () => {
  mockPerm = { is_owner: false, role: "member", permissions: { pdv: true, estoque: true } };
  mockAuth = { ...mockAuth, company: { id: "c1", member_role: "caixa" } };
  const tree = await montar();
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
});

test("gerente com acesso total decide", async () => {
  mockPerm = { is_owner: false, role: "member", permissions: null };
  mockAuth = { ...mockAuth, company: { id: "c1", member_role: "gerente" } };
  const tree = await montar();
  expect(textos(tree)).toMatch(/Ligar avisos/);
});

test("navegador bloqueou ao pedir: avisa e nao insiste", async () => {
  mockWebPush.ativarAviso.mockResolvedValue("bloqueado");
  const tree = await montar();
  await act(async () => { botao(tree, "Ligar avisos").props.onPress(); });
  expect(toast.error).toHaveBeenCalled();
  expect(store[CHAVE_DO_CONVITE]).toBe("1");
});
