// ============================================================
// Painel · aba "Pedidos pela loja" (Fase 1C · 25/09/2026)
//
// Teste de TELA da aba que a Sheid usa para encerrar o Natal: fechar a
// loja, ver a prévia mudar, validar o Pixel ao digitar e mostrar o 400
// do servidor com a mensagem dele. Multi-CNPJ: na visão consolidada não
// há loja para configurar, e a aba diz isso em vez de salvar no vazio.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import { render, screen, fireEvent, waitFor, configure } from "@testing-library/react-native";

configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);

jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return {
    __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path"),
    Circle: stub("Circle"), Rect: stub("Rect"), G: stub("G"),
  };
});

// A sessão: a empresa ativa (multi-CNPJ). O store real puxa o
// expo-secure-store, que não carrega no jest.
let mockSessao: any = { company: { id: "c1", name: "Sheid" }, consolidatedView: false };
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockSessao }));

import { TabStudioPedidosPelaLoja } from "@/components/screens/studio-loja-digital/TabStudioPedidosPelaLoja";
import { RECADO_PADRAO } from "@/components/screens/studio-loja-digital/pedidosPelaLoja";

const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);

const CONFIG = {
  slug: "sheid-mania", site_name: "Sheid Mania", primary_color: "#1a1612",
  pedidos_pausados: false, pedidos_ate: null, pedidos_recado: null,
  courier_pickup_enabled: false, ga4_measurement_id: null, meta_pixel_id: null,
};

function montar(saveConfig = jest.fn().mockResolvedValue({})) {
  render(<TabStudioPedidosPelaLoja config={CONFIG} saveConfig={saveConfig} isSaving={false} />);
  return saveConfig;
}

beforeEach(() => {
  mockSessao = { company: { id: "c1", name: "Sheid" }, consolidatedView: false };
});

test("fechar a loja: a prévia troca o botão e mostra o recado padrão; salvar grava pausada", async () => {
  const save = montar();
  expect(naTela("Aceitando pedidos pela loja")).toBe(true);
  expect(naTela("Adicionar à sacola")).toBe(true);

  fireEvent.press(screen.getByLabelText("Aceitando pedidos pela loja"));
  expect(naTela("Loja fechada para pedidos")).toBe(true);
  expect(naTela("Pedir orçamento")).toBe(true);
  expect(naTela(RECADO_PADRAO.pausado)).toBe(true);

  fireEvent.changeText(screen.getByLabelText("Recado para o cliente"), "Voltamos em 6 de janeiro.");
  expect(naTela("25/280")).toBe(true);

  fireEvent.press(screen.getByText("Salvar alterações"));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][0]).toEqual({
    pedidos_pausados: true, pedidos_ate: null, pedidos_recado: "Voltamos em 6 de janeiro.",
    courier_pickup_enabled: false, ga4_measurement_id: null, meta_pixel_id: null,
  });
  await waitFor(() => expect(naTela("Salvo.")).toBe(true));
});

test("Pixel curto: avisa ao digitar e não deixa salvar", () => {
  const save = montar();
  fireEvent.changeText(screen.getByLabelText("Pixel da Meta"), "741852");
  expect(naTela("Faltam dígitos — o Pixel da Meta tem 15 ou 16 números")).toBe(true);
  fireEvent.press(screen.getByText("Salvar alterações"));
  expect(save).not.toHaveBeenCalled();
});

test("400 do servidor aparece com a mensagem dele", async () => {
  const erro = Object.assign(new Error("ID do Google Analytics inválido. O formato é G- seguido de 6 a 14 letras ou números (ex.: G-8Q3FQ2N1KM)."), { status: 400 });
  const save = montar(jest.fn().mockRejectedValue(erro));
  fireEvent.press(screen.getByLabelText("Retirada por app de entrega"));
  fireEvent.press(screen.getByText("Salvar alterações"));
  await waitFor(() => expect(save).toHaveBeenCalled());
  await waitFor(() => expect(naTela("ID do Google Analytics inválido.")).toBe(true));
});

test("visão consolidada: não há loja para configurar", () => {
  mockSessao = { company: null, consolidatedView: true };
  montar();
  expect(naTela("Escolha uma empresa")).toBe(true);
  expect(naTela("Salvar alterações")).toBe(false);
});

test("a aba entra na Loja Digital entre Entrega e Pedidos, sem mod próprio (é aba, não tela)", () => {
  const painel = fs.readFileSync(path.join(__dirname, "..", "app/studio/(estudio)/vendas/loja-digital.tsx"), "utf8");
  expect(painel).toContain('{ key: "pedidos_loja",  label: "Pedidos pela loja"');
  expect(painel).toContain("<TabStudioPedidosPelaLoja");
  expect(painel.indexOf('key: "delivery"')).toBeLessThan(painel.indexOf('key: "pedidos_loja"'));
  expect(painel.indexOf('key: "pedidos_loja"')).toBeLessThan(painel.indexOf('key: "orders"'));
});
