// ============================================================
// VendasFiltros (I0.6, 16/09/2026)
//
// Extraida de app/(tabs)/vendas.tsx: em telas largas (>=1024px) periodo,
// mes, status e busca precisam caber numa linha so; em telas estreitas
// mantem a pilha original com os rotulos em caixa alta. Este teste cobre
// so o que quebra em silencio numa extracao dessas:
//   1. as duas variantes (wide/estreito) renderizam as mesmas opcoes;
//   2. clicar numa pilula chama o callback certo, sem mudar comportamento;
//   3. o rotulo "PERÍODO"/"STATUS" some no layout largo (a decisao do
//      item I0.6) e continua no estreito.
//
// react-test-renderer direto (nao RTL): sob react-native-web tudo vira
// div e a identidade vem do testID, igual aos outros testes de tela.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { VendasFiltros } from "@/components/screens/vendas/VendasFiltros";

function montar(props: Partial<React.ComponentProps<typeof VendasFiltros>> = {}) {
  const onPeriodChange = jest.fn();
  const onStatusChange = jest.fn();
  const onSearchChange = jest.fn();
  const base: React.ComponentProps<typeof VendasFiltros> = {
    wide: false,
    period: "month",
    onPeriodChange,
    monthAnchor: { y: 2026, m: 8 },
    onMonthAnchorChange: jest.fn(),
    customFromBr: "",
    onCustomFromBrChange: jest.fn(),
    customToBr: "",
    onCustomToBrChange: jest.fn(),
    onCustomFromIsoChange: jest.fn(),
    onCustomToIsoChange: jest.fn(),
    status: "all",
    onStatusChange,
    search: "",
    onSearchChange,
    ...props,
  };
  let tree: any;
  act(() => { tree = renderer.create(<VendasFiltros {...base} />); });
  return { tree, onPeriodChange, onStatusChange, onSearchChange };
}

function textoDe(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join(" ");
  const filhos = node.children || (node.props && node.props.children);
  return filhos ? textoDe(filhos) : "";
}

describe("VendasFiltros", () => {
  it("no layout estreito mostra os rotulos PERÍODO/STATUS", () => {
    const { tree } = montar({ wide: false });
    const txt = textoDe(tree.toJSON());
    expect(txt).toContain("Período");
    expect(txt).toContain("Status");
  });

  it("no layout largo (>=1024px) os rotulos somem — pilulas ja dizem o contexto", () => {
    const { tree } = montar({ wide: true });
    const txt = textoDe(tree.toJSON());
    expect(txt).not.toContain("Período");
    expect(txt).not.toContain("Status");
    // mas as opcoes continuam todas la
    expect(txt).toContain("Hoje");
    expect(txt).toContain("Tudo");
    expect(txt).toContain("Ativas");
    expect(txt).toContain("Canceladas");
  });

  it("clicar numa pilula de periodo chama onPeriodChange com a chave certa", () => {
    const { tree, onPeriodChange } = montar({ wide: false, period: "month" });
    const pilulas = tree.root.findAllByProps({ testID: "vendas-filtro-periodo" })[0];
    const hoje = pilulas.findAllByType(Pressable).find((n: any) => textoDe(n.props.children) === "Hoje");
    act(() => { hoje!.props.onPress(); });
    expect(onPeriodChange).toHaveBeenCalledWith("today");
  });

  it("clicar numa pilula de status chama onStatusChange com a chave certa", () => {
    const { tree, onStatusChange } = montar({ wide: true, status: "all" });
    const pilulas = tree.root.findAllByProps({ testID: "vendas-filtro-status" })[0];
    const canceladas = pilulas.findAllByType(Pressable).find((n: any) => textoDe(n.props.children) === "Canceladas");
    act(() => { canceladas!.props.onPress(); });
    expect(onStatusChange).toHaveBeenCalledWith("cancelled");
  });

  it("o seletor de mes so aparece quando period === 'month'", () => {
    const { tree: comMes } = montar({ period: "month" });
    expect(comMes.root.findAllByProps({ testID: "vendas-filtro-mes" }).length).toBe(1);

    const { tree: semMes } = montar({ period: "all" });
    expect(semMes.root.findAllByProps({ testID: "vendas-filtro-mes" }).length).toBe(0);
  });

  it("o campo de personalizado so aparece quando period === 'custom'", () => {
    const { tree } = montar({ period: "custom" });
    expect(tree.root.findAllByProps({ testID: "vendas-filtro-personalizado" }).length).toBe(1);
  });

  it("digitar na busca chama onSearchChange (comportamento inalterado)", () => {
    const { tree, onSearchChange } = montar({ wide: true });
    const input = tree.root.findAllByProps({ placeholder: "Buscar cliente ou vendedora…" })[0];
    act(() => { input.props.onChangeText("maria"); });
    expect(onSearchChange).toHaveBeenCalledWith("maria");
  });
});
