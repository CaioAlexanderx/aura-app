// ============================================================
// Últimos preenchimentos de custo (tela E do mockup de 12/11): quando, quem,
// quantos e de onde vieram os números; "Ver" com os itens; desfazer com
// confirmação dentro do cartão (nunca confirm()) e o aviso do que ficou
// como está porque o custo mudou depois.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", TextInput: "TextInput",
  ActivityIndicator: "ActivityIndicator", StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: (_t, k) => String(k) }), IS_DARK_MODE: false }));

const mockHistorico = jest.fn();
const mockDetalhe = jest.fn();
const mockDesfazer = jest.fn();
jest.mock("@/services/custoEmMassaApi", () => ({
  ...jest.requireActual("@/services/custoEmMassaApi"),
  custoEmMassaApi: {
    historico: (...a: any[]) => mockHistorico(...a),
    detalhe: (...a: any[]) => mockDetalhe(...a),
    desfazer: (...a: any[]) => mockDesfazer(...a),
  },
}));

import { UltimosPreenchimentos } from "@/components/screens/conferencia/custos/UltimosPreenchimentos";
import { resumoDoPreenchimento } from "@/utils/custoEmMassa";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
const porTestID = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const um = (t: renderer.ReactTestRenderer, id: string) => { const n = porTestID(t, id); expect(n.length).toBeGreaterThan(0); return n[0]; };
const existe = (t: renderer.ReactTestRenderer, id: string) => porTestID(t, id).length > 0;
const textoDe = (t: renderer.ReactTestRenderer, id: string) => porTestID(t, id).map((n) => flattenText(n.children)).join("");
async function tocar(t: renderer.ReactTestRenderer, id: string) { await act(async () => { um(t, id).props.onPress(); }); }

const HOJE = new Date().toISOString();
const ATE = new Date(Date.now() + 7 * 86400000).toISOString();
function lote(extra: any = {}) {
  return {
    id: "f1", criado_em: HOJE, por: { id: "u1", nome: "Ana" }, atalho: { modo: "markup", percentual: 100 }, conferencia: null,
    produtos: 23, digitados: 3, sugeridos: 20, mesmo: 0, compartilhados: 1, mudou_no_meio: 0, itens_de_conferencia_atualizados: 0,
    desfazer_ate: ATE, pode_desfazer: true, desfeito_em: null, desfeito_por: null, desfeitos: null, mudaram_depois: null, ...extra,
  };
}

async function montar(props: any = {}) {
  let t!: renderer.ReactTestRenderer;
  await act(async () => { t = renderer.create(<UltimosPreenchimentos companyId="c1" versao={0} {...props} />); });
  return t;
}

beforeEach(() => {
  mockHistorico.mockReset().mockResolvedValue({
    preenchimentos: [lote(), lote({
      id: "f0", criado_em: "2026-11-08T13:05:00.000Z", por: { id: "u2", nome: "Bruno" }, atalho: null,
      produtos: 4, digitados: 4, sugeridos: 0, pode_desfazer: false, desfeito_em: "2026-11-09T12:00:00.000Z",
    })],
    total: 2,
  });
  mockDetalhe.mockReset();
  mockDesfazer.mockReset();
});

test("resumo do lote: quantos, de onde vieram, até quando desfaz", () => {
  const d = new Date(ATE).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  expect(resumoDoPreenchimento(lote() as any)).toBe("23 produtos · 20 pela sugestão de markup 100%, 3 digitados · dá para desfazer até " + d);
  expect(resumoDoPreenchimento(lote({
    produtos: 4, digitados: 4, sugeridos: 0, atalho: null, pode_desfazer: false, desfeito_em: "2026-11-09T12:00:00.000Z",
  }) as any)).toBe("4 produtos · digitados · desfeito em 09/11");
});

test("lista com quem e quando; desfeito sem botão de desfazer", async () => {
  const t = await montar();
  expect(mockHistorico).toHaveBeenCalledWith("c1", { limit: 10 });
  expect(textoDe(t, "preench-f1")).toContain("Hoje, ");
  expect(textoDe(t, "preench-f1")).toContain(" · Ana");
  expect(existe(t, "preench-desfazer-f1")).toBe(true);
  expect(textoDe(t, "preench-f0")).toContain("08/11, ");
  expect(existe(t, "preench-desfeito-f0")).toBe(true);
  expect(existe(t, "preench-desfazer-f0")).toBe(false);
});

test("Ver abre os itens com o custo antes e depois", async () => {
  mockDetalhe.mockResolvedValue({ ...lote(), itens: [
    { product_id: "p1", nome: "Caneca", origem: "sugerido", compartilhado: false, preco: 39.9, custo_antes: null, custo_depois: 19.95, custo_agora: 19.95, desfazer: null },
  ] });
  const t = await montar();
  await tocar(t, "preench-ver-f1");
  expect(mockDetalhe).toHaveBeenCalledWith("c1", "f1");
  expect(textoDe(t, "preench-itens-f1")).toContain("Caneca");
  expect(textoDe(t, "preench-itens-f1")).toContain("sem custo → R$ 19,95");
});

test("desfazer pede confirmação no cartão; avisa o que mudou depois e recarrega os produtos", async () => {
  const mudaram = jest.fn();
  const t = await montar({ onCustosMudaram: mudaram });
  await tocar(t, "preench-desfazer-f1");
  expect(mockDesfazer).not.toHaveBeenCalled();
  expect(textoDe(t, "preench-confirmar-f1")).toContain("Os 23 produtos voltam a ficar sem custo. Se algum ganhou custo novo depois");
  await tocar(t, "preench-manter-f1");
  expect(existe(t, "preench-confirmar-f1")).toBe(false);

  mockDesfazer.mockResolvedValue({
    fill_id: "f1", desfeito_em: HOJE, desfeitos: 21, mudaram_depois: 2, voltaram: [],
    mudou_depois: [{ product_id: "p3", nome: "Bolsa tote lona" }, { product_id: "p1", nome: "Caneca cerâmica 350 ml" }],
  });
  mockHistorico.mockResolvedValue({ preenchimentos: [lote({ pode_desfazer: false, desfeito_em: HOJE })], total: 1 });
  await tocar(t, "preench-desfazer-f1");
  await tocar(t, "preench-confirmar-desfazer-f1");
  expect(mockDesfazer).toHaveBeenCalledWith("c1", "f1");
  expect(textoDe(t, "preench-resultado-f1")).toContain("Pronto, desfeito. 21 produtos voltaram a ficar sem custo.");
  expect(textoDe(t, "preench-mudaram-f1")).toBe("2 ficaram como estão porque o custo mudou depois: Bolsa tote lona e Caneca cerâmica 350 ml.");
  expect(mudaram).toHaveBeenCalled();
  expect(existe(t, "preench-desfazer-f1")).toBe(false);
});

test("prazo encerrado: texto gentil e a lista recarrega", async () => {
  const t = await montar();
  mockDesfazer.mockRejectedValue({ status: 410, data: { code: "PRAZO_ENCERRADO" } });
  await tocar(t, "preench-desfazer-f1");
  await tocar(t, "preench-confirmar-desfazer-f1");
  expect(textoDe(t, "preench-erro-f1")).toContain("O prazo de 7 dias para desfazer este preenchimento terminou.");
  expect(mockHistorico).toHaveBeenCalledTimes(2);
});

test("sem preenchimentos: nada aparece", async () => {
  mockHistorico.mockResolvedValue({ preenchimentos: [], total: 0 });
  const t = await montar();
  expect(existe(t, "preench-lista")).toBe(false);
});
