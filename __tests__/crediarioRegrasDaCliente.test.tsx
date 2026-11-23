// ============================================================
// "Limite e regras": regras só para esta cliente (QA 23/11/2026, P1-3)
//
// Em branco tem de voltar à regra da loja: o PUT de termos só mexe nos
// campos que vêm no corpo (null limpa). Antes, em branco mandava corpo null
// (400 "Nenhum campo de termo fornecido") e um campo só deixava o outro preso.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));

import { corpoDasRegras, erroAoSalvarRegras } from "@/utils/crediarioRegrasDaCliente";
import { TabConta } from "@/components/crediario/ficha/TabConta";

describe("corpoDasRegras", () => {
  test("em branco: os dois campos vão null (volta à regra da loja)", () => {
    expect(corpoDasRegras("", "")).toEqual({ max_installments: null, interest_rate: null });
    expect(corpoDasRegras("  ", " ")).toEqual({ max_installments: null, interest_rate: null });
  });
  test("um campo só: o outro vai null (não fica preso)", () => {
    expect(corpoDasRegras("3", "")).toEqual({ max_installments: 3, interest_rate: null });
    expect(corpoDasRegras("", "2")).toEqual({ max_installments: null, interest_rate: 0.02 });
  });
  test("vírgula e ponto", () => {
    expect(corpoDasRegras("6", "1,5")).toEqual({ max_installments: 6, interest_rate: 0.015 });
    expect(corpoDasRegras("x", "abc")).toEqual({ max_installments: null, interest_rate: null });
  });
  test("erro na tela", () => {
    expect(erroAoSalvarRegras({ data: { error: "Falhou" } })).toBe("Não foi possível salvar as regras: Falhou");
    expect(erroAoSalvarRegras(new Error("rede"))).toBe("Não foi possível salvar as regras. Confira a conexão e tente de novo.");
  });
});

describe("TabConta: o placeholder mostra a regra da LOJA", () => {
  const ajustes: any = {
    termsMaxInst: "3", setTermsMaxInst: jest.fn(), termsInterest: "2", setTermsInterest: jest.fn(),
    termsDirty: false, setTermsDirty: jest.fn(), savingTerms: false, saveTerms: jest.fn(),
    blockReason: "", setBlockReason: jest.fn(), blockingAction: null, setBlockingAction: jest.fn(),
    handleBlockToggle: jest.fn(), confirmBlock: jest.fn(), blockPending: false,
  };
  const profile = {
    credit_limit: 0, credit_used: 0, credit_score: 600,
    terms: { effective: { max_installments: 3, interest_rate: 0.02 }, overrides: { max_installments: 3, interest_rate: 0.02 } },
  };
  function montar(extra: any = {}) {
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(
        <TabConta profile={profile} isBlocked={false} scoreLabel="bom" availableLimit={0} totalBalance={0}
          openInst={[]} nextDueDate="" hasTermsOverride realCarnes={[]} ajustes={ajustes}
          regraDaLoja={{ max_installments: 10, interest_rate: 0.01 }} {...extra} />,
      );
    });
    return t;
  }
  test("cliente com 3x e 2%: o placeholder diz 10 e 1,00% (loja), não 3 e 2%", () => {
    const t = montar();
    const placeholders = t.root.findAll((n: any) => n.props && typeof n.props.placeholder === "string" && n.props.onChangeText)
      .map((n: any) => n.props.placeholder);
    expect(placeholders).toContain("10 (regra da loja)");
    expect(placeholders).toContain("1,00 (regra da loja)");
  });
  test("o erro ao salvar fica na tela", () => {
    const t = montar({ ajustes: { ...ajustes, erroTermos: "Não foi possível salvar as regras: x" } });
    expect(t.root.findAllByProps({ testID: "limite-regras-erro" }, { deep: false } as any)).toHaveLength(1);
  });
});

describe("Vendas a prazo (QA P2)", () => {
  const base: any = {
    termsMaxInst: "", setTermsMaxInst: jest.fn(), termsInterest: "", setTermsInterest: jest.fn(),
    termsDirty: false, setTermsDirty: jest.fn(), savingTerms: false, saveTerms: jest.fn(),
    blockReason: "", setBlockReason: jest.fn(), blockingAction: null, setBlockingAction: jest.fn(),
    handleBlockToggle: jest.fn(), confirmBlock: jest.fn(), blockPending: false,
  };
  function montar(isBlocked: boolean, ajustes: any = base) {
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(<TabConta profile={{ credit_limit: 0 }} isBlocked={isBlocked} scoreLabel={null} availableLimit={0}
        totalBalance={0} openInst={[]} nextDueDate="" hasTermsOverride={false} realCarnes={[]} ajustes={ajustes} />);
    });
    return t;
  }
  test("ligado = liberadas, com rótulo para leitor de tela", () => {
    const sw = montar(false).root.findAllByProps({ testID: "limite-regras-vendas-a-prazo" }, { deep: false } as any)[0];
    expect(sw.props.value).toBe(true);
    expect(sw.props.accessibilityLabel).toBe("Vendas a prazo liberadas para este cadastro. Toque para bloquear");
    const bloq = montar(true).root.findAllByProps({ testID: "limite-regras-vendas-a-prazo" }, { deep: false } as any)[0];
    expect(bloq.props.value).toBe(false);
  });
  test("pedir o bloqueio mostra Motivo e Confirmar", () => {
    const t = montar(false, { ...base, blockingAction: "block" });
    expect(t.root.findAllByProps({ testID: "limite-regras-motivo" }, { deep: false } as any)).toHaveLength(1);
  });
});
