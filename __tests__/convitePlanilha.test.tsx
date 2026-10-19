// ============================================================
// Convite "Importar sua planilha" no Estoque (19/10/2026, tq-31).
//
// Chega com ?importar=planilha (check-in: planilha, até 300 produtos).
//   · montagem dupla (PageTransition, troca de tema) mostra o convite: nada
//     é limpo no mount;
//   · "Agora não" e "Escolher planilha" encerram na sessão (sessionStorage):
//     não volta ao remontar nem com o parâmetro de novo;
//   · sem storage, não quebra;
//   · o setParams com undefined vira "undefined", que não reabre.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

const mockSetParams = jest.fn();
jest.mock("expo-router", () => ({ router: { setParams: (...a: any[]) => mockSetParams(...a) } }));

import {
  CHAVE_CONVITE_PLANILHA, ConvitePlanilha, conviteEncerradoNaSessao,
} from "@/components/screens/estoque/ConvitePlanilha";
import { querImportarPlanilha } from "@/utils/checkinDestino";

function montar(props: Partial<React.ComponentProps<typeof ConvitePlanilha>> = {}) {
  const onEscolher = jest.fn();
  let tree: any;
  act(() => { tree = renderer.create(<ConvitePlanilha importar="planilha" onEscolher={onEscolher} {...props} />); });
  return { tree, onEscolher };
}
const visivel = (t: any) => t.root.findAll((n: any) => n.props?.testID === "estoque-convite-planilha", { deep: false }).length > 0;
const botao = (t: any, id: string) => t.root.findAll((n: any) => n.props?.testID === id, { deep: false })[0];

beforeEach(() => {
  mockSetParams.mockReset();
  window.sessionStorage.clear();
});

describe("convite da planilha", () => {
  test("montagem dupla: a segunda montagem (a visível) mostra o convite, e o mount não limpa a URL", () => {
    const a = montar();
    expect(visivel(a.tree)).toBe(true);
    act(() => { a.tree.unmount(); });
    const b = montar();
    expect(visivel(b.tree)).toBe(true);
    expect(mockSetParams).not.toHaveBeenCalled();
    // um convite só na tela
    expect(b.tree.root.findAll((n: any) => n.props?.testID === "estoque-convite-planilha", { deep: false })).toHaveLength(1);
    act(() => { b.tree.unmount(); });
  });

  test("sem o parâmetro (ou com a string 'undefined' do setParams): não aparece", () => {
    expect(querImportarPlanilha("undefined")).toBe(false);
    const a = montar({ importar: "undefined" });
    expect(visivel(a.tree)).toBe(false);
    const b = montar({ importar: undefined });
    expect(visivel(b.tree)).toBe(false);
  });

  test("'Agora não' esconde, grava na sessão e não volta ao remontar nem com o parâmetro de novo", () => {
    const a = montar();
    act(() => { botao(a.tree, "estoque-convite-planilha-fechar").props.onPress(); });
    expect(visivel(a.tree)).toBe(false);
    expect(window.sessionStorage.getItem(CHAVE_CONVITE_PLANILHA)).toBe("1");
    expect(mockSetParams).toHaveBeenCalledWith({ importar: undefined });
    // o check-in manda ?importar=planilha outra vez, na mesma tela montada
    act(() => { a.tree.update(<ConvitePlanilha importar="planilha" onEscolher={jest.fn()} />); });
    expect(visivel(a.tree)).toBe(false);
    act(() => { a.tree.unmount(); });
    // remontou (outra visita ao Estoque na mesma sessão)
    const b = montar();
    expect(visivel(b.tree)).toBe(false);
    expect(conviteEncerradoNaSessao()).toBe(true);
  });

  test("'Escolher planilha' abre o seletor no mesmo toque e apaga o convite", () => {
    const a = montar();
    act(() => { botao(a.tree, "estoque-convite-planilha-escolher").props.onPress(); });
    expect(a.onEscolher).toHaveBeenCalledTimes(1);
    expect(visivel(a.tree)).toBe(false);
    act(() => { a.tree.unmount(); });
    expect(visivel(montar().tree)).toBe(false);
  });

  test("escondido (consolidado ou importação já aberta): não aparece e não encerra", () => {
    const a = montar({ escondido: true });
    expect(visivel(a.tree)).toBe(false);
    expect(conviteEncerradoNaSessao()).toBe(false);
  });

  test("sem sessionStorage (bloqueado): não quebra; 'Agora não' vale enquanto a tela está montada", () => {
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
    try {
      expect(conviteEncerradoNaSessao()).toBe(false);
      const a = montar();
      expect(visivel(a.tree)).toBe(true);
      act(() => { botao(a.tree, "estoque-convite-planilha-fechar").props.onPress(); });
      expect(visivel(a.tree)).toBe(false);
    } finally {
      if (original) Object.defineProperty(window, "sessionStorage", original);
    }
  });

  test("storage que falha ao gravar também não quebra", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceeded"); });
    try {
      const a = montar();
      act(() => { botao(a.tree, "estoque-convite-planilha-fechar").props.onPress(); });
      expect(visivel(a.tree)).toBe(false);
    } finally {
      setItem.mockRestore();
    }
  });
});
