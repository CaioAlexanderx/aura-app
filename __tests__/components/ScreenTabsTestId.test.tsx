// ============================================================
// ScreenTabs — testID por aba (I1.3, 16/09/2026).
//
// /whatsapp precisou manter os testIDs históricos das abas
// (wa-varejo-aba-N) ao trocar as pílulas manuais pelo ScreenTabs
// compartilhado (o mesmo componente que /clientes, /vendas, /crediario e
// /estoque já usam). Sem um jeito de passar testID por aba, a migração
// teria quebrado todo teste que clica em aba pelo testID — este teste
// segura que o ScreenTabs aceita e repassa `testID` por item, e que ele
// continua opcional (nenhuma das outras telas passa esse campo).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { ScreenTabs } from "@/components/ScreenHero";

function achar(tree: any, id: string): any {
  return tree.root.findAllByProps({ testID: id })[0];
}
function tem(tree: any, id: string): boolean {
  return tree.root.findAllByProps({ testID: id }).length > 0;
}

describe("ScreenTabs — testID por aba", () => {
  it("repassa o testID de cada item para o Pressable", async () => {
    const onSelect = jest.fn();
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <ScreenTabs
          tabs={[
            { key: "0", label: "Conexão", testID: "wa-varejo-aba-0" },
            { key: "1", label: "Cobranças", testID: "wa-varejo-aba-1" },
          ]}
          active="0"
          onSelect={onSelect}
        />
      );
    });

    expect(tem(tree, "wa-varejo-aba-0")).toBe(true);
    expect(tem(tree, "wa-varejo-aba-1")).toBe(true);

    await act(async () => { achar(tree, "wa-varejo-aba-1").props.onPress(); });
    expect(onSelect).toHaveBeenCalledWith("1");
    tree.unmount();
  });

  it("sem testID nos itens, a aba continua funcionando (campo opcional)", async () => {
    const onSelect = jest.fn();
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <ScreenTabs
          tabs={[{ key: "lista", label: "Lista" }, { key: "ranking", label: "Ranking" }]}
          active="lista"
          onSelect={onSelect}
        />
      );
    });

    const abas = tree.root.findAllByType(Pressable);
    expect(abas.length).toBe(2);
    await act(async () => { abas[1].props.onPress(); });
    expect(onSelect).toHaveBeenCalledWith("ranking");
    tree.unmount();
  });
});
