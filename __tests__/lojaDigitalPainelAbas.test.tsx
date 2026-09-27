// ============================================================
// Loja Digital do Studio · QA do painel (26/09/2026) — abas montadas
//
// Pedidos pela loja com a data limite passada e o recado guardado, e a
// Entrega perguntando antes de ficar sem retirada nem entrega.
// ============================================================
import React from "react";
import { render, screen, fireEvent, configure, act } from "@testing-library/react-native";

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
    Circle: stub("Circle"), Rect: stub("Rect"), Ellipse: stub("Ellipse"), G: stub("G"),
  };
});
jest.mock("@/components/Toast", () => ({ toast: { show: jest.fn(), error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

let mockSessao: any = { company: { id: "c1", name: "Sheid" }, consolidatedView: false };
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockSessao }));

import { TabStudioPedidosPelaLoja } from "@/components/screens/studio-loja-digital/TabStudioPedidosPelaLoja";
import { TabEntrega } from "@/components/screens/canal/TabEntrega";
import { Text, StyleSheet } from "react-native";
import { PaletaDoCanal, paletaDoStudio, PALETA_DO_NEGOCIO } from "@/components/screens/canal/paletaDoCanal";
import { StudioColors } from "@/constants/studio-tokens";

const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);

describe("Pedidos pela loja: fechada pela data limite", () => {
  const CONFIG = {
    slug: "sheid", site_name: "Sheid", primary_color: "#1a1612",
    pedidos_pausados: false, pedidos_ate: "2020-01-10", pedidos_recado: null,
    courier_pickup_enabled: false, ga4_measurement_id: null, meta_pixel_id: null,
  };

  test("título diz fechada pela data; o interruptor fica desligado e travado", () => {
    render(<TabStudioPedidosPelaLoja config={CONFIG} saveConfig={jest.fn()} isSaving={false} />);
    expect(naTela("Loja fechada pela data limite")).toBe(true);
    const sw = screen.getByLabelText("Aceitando pedidos pela loja (fechada pela data limite)");
    expect(sw.props["aria-checked"]).toBe(false);
    expect(sw.props["aria-disabled"]).toBe(true);
    fireEvent.press(sw);
    // Travado: o clique não liga nada — quem reabre é a data.
    expect(naTela("Loja fechada pela data limite")).toBe(true);
    expect(naTela("Alterações ainda não salvas.")).toBe(false);
  });

  test("recado gravado aparece com a loja aberta, com a nota de quando vale", () => {
    const aberta = { ...CONFIG, pedidos_ate: null, pedidos_recado: "Voltamos em janeiro." };
    render(<TabStudioPedidosPelaLoja config={aberta} saveConfig={jest.fn()} isSaving={false} />);
    expect(naTela("Aceitando pedidos pela loja")).toBe(true);
    expect(naTela("Voltamos em janeiro.")).toBe(true);
    expect(naTela("Aparece quando a loja fechar")).toBe(true);
  });

  test("avisa a página quando há alteração não salva (contrato onAlteracoes)", () => {
    const onAlteracoes = jest.fn();
    render(<TabStudioPedidosPelaLoja config={{ ...CONFIG, pedidos_ate: null }} saveConfig={jest.fn()} isSaving={false} onAlteracoes={onAlteracoes} />);
    expect(onAlteracoes).toHaveBeenLastCalledWith(false);
    fireEvent.press(screen.getByLabelText("Retirada por app de entrega"));
    expect(onAlteracoes).toHaveBeenLastCalledWith(true);
  });
});

describe("Entrega: sem retirada nem entrega", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  // O Switch do react-native-web não expõe o testID no elemento de
  // entrada: chama-se o onValueChange do componente, como a lojista faria.
  const desligarRetirada = () => {
    const sw = screen.UNSAFE_getByProps({ testID: "toggle-retirada" });
    act(() => { sw.props.onValueChange(false); });
  };

  function montar(config: any, onAlteracoes = jest.fn()) {
    const saveConfig = jest.fn().mockResolvedValue({});
    render(<TabEntrega vitrine="studio" config={config} saveConfig={saveConfig} isSaving={false} onAlteracoes={onAlteracoes} />);
    return { saveConfig, onAlteracoes };
  }

  test("desligar a última pergunta antes; 'Manter ligada' não salva nada", () => {
    const { saveConfig, onAlteracoes } = montar({ pickup_enabled: true, delivery_enabled: false });
    desligarRetirada();
    expect(naTela("Sem retirada nem entrega, o cliente não tem como receber o pedido.")).toBe(true);
    expect(onAlteracoes).toHaveBeenLastCalledWith(true);
    fireEvent.press(screen.getByText("Manter ligada"));
    act(() => { jest.advanceTimersByTime(1000); });
    expect(saveConfig).not.toHaveBeenCalled();
    expect(onAlteracoes).toHaveBeenLastCalledWith(false);
  });

  test("'Desligar mesmo assim' salva e o aviso fica na tela", () => {
    const { saveConfig } = montar({ pickup_enabled: true, delivery_enabled: false });
    desligarRetirada();
    fireEvent.press(screen.getByText("Desligar mesmo assim"));
    act(() => { jest.advanceTimersByTime(1000); });
    expect(saveConfig).toHaveBeenCalledWith({ pickup_enabled: false });
    expect(naTela("Ligue a retirada ou a entrega.")).toBe(true);
  });

  test("com a outra ligada, desliga direto", () => {
    const { saveConfig } = montar({ pickup_enabled: true, delivery_enabled: true });
    desligarRetirada();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(saveConfig).toHaveBeenCalledWith({ pickup_enabled: false });
  });

  test("prazo em dias úteis no Studio, sem emoji nos títulos", () => {
    montar({ pickup_enabled: true, delivery_enabled: true });
    expect(naTela("Ex: Pronta em 3 dias úteis após a aprovação da arte")).toBe(true);
    expect(naTela("Em até 1 hora")).toBe(false);
    expect(naTela("Aparece para o cliente")).toBe(true);
    const json = JSON.stringify(screen.toJSON());
    expect(json).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});

describe("tema claro do Studio chega nas abas do canal", () => {
  function corDoTitulo(paleta?: any) {
    const arvore = <TabEntrega config={{ pickup_enabled: true }} saveConfig={jest.fn()} isSaving={false} />;
    render(paleta ? <PaletaDoCanal paleta={paleta}>{arvore}</PaletaDoCanal> : arvore);
    const titulo = screen.UNSAFE_getAllByType(Text).find((n) => n.props.children === "Horário de funcionamento")!;
    return StyleSheet.flatten(titulo.props.style).color;
  }

  test("com a paleta do Studio claro, a tinta é a do Studio (escura)", () => {
    expect(corDoTitulo(paletaDoStudio(StudioColors))).toBe(StudioColors.ink);
  });

  test("sem provider, o Negócio segue com a paleta de sempre", () => {
    expect(corDoTitulo()).toBe(PALETA_DO_NEGOCIO.ink);
  });
});
