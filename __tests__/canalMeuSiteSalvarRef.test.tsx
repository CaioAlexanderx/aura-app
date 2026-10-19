// ============================================================
// Meu Site (aba real) · a ref de salvar usada pela pergunta de troca de aba
// (tq-49, 19/10/2026). Garante que "Salvar" da pergunta roda o MESMO
// handleSave dos botões (corpo completo, toast) e que a aba avisa
// `onAlteracoes` ao editar e ao voltar ao estado salvo.
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
    Defs: stub("Defs"), LinearGradient: stub("LinearGradient"), Stop: stub("Stop"),
  };
});
jest.mock("@/components/Toast", () => ({ toast: { show: jest.fn(), error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
const mockToast: Record<string, jest.Mock> = jest.requireMock("@/components/Toast").toast;

let mockSessao: any = { company: { id: "c1", name: "Sheid", plan: "negocio" }, consolidatedView: false };
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockSessao) : mockSessao),
}));
jest.mock("@/components/screens/canal/MpGatewayCard", () => ({ MpGatewayCard: () => null }));
jest.mock("@/hooks/usePaymentGateways", () => ({ usePaymentGateways: () => ({ mpGateway: null }) }));

import { TabMeuSite } from "@/components/screens/canal/TabMeuSite";

const CONFIG = { exists: true, slug: "sheid", site_name: "Sheid", is_published: false };

function montar(over: Partial<React.ComponentProps<typeof TabMeuSite>> = {}) {
  const props: any = {
    config: CONFIG,
    saveConfig: jest.fn().mockResolvedValue({ config: { ...CONFIG, site_name: "Sheid Novo" } }),
    isSaving: false,
    requestDomain: jest.fn(), isRequestingDomain: false,
    uploadImage: jest.fn(), isUploadingImage: false,
    setupPix: jest.fn(), isSettingUpPix: false,
    ...over,
  };
  render(<TabMeuSite {...props} />);
  return props;
}

beforeEach(() => { Object.values(mockToast).forEach((f) => f.mockClear()); });

describe("TabMeuSite: onAlteracoes e salvarRef", () => {
  test("editar avisa alteração; a ref grava com o mesmo handleSave e resolve true", async () => {
    const onAlteracoes = jest.fn();
    const salvarRef: any = { current: null };
    const props = montar({ onAlteracoes, salvarRef });
    expect(onAlteracoes).toHaveBeenLastCalledWith(false);
    expect(typeof salvarRef.current).toBe("function");

    fireEvent.changeText(screen.getByPlaceholderText("Ex: Ateliê da Helena · Personalizados"), "Sheid Novo");
    expect(onAlteracoes).toHaveBeenLastCalledWith(true);

    let ok: boolean | undefined;
    await act(async () => { ok = await salvarRef.current(); });
    expect(ok).toBe(true);
    expect(props.saveConfig).toHaveBeenCalledTimes(1);
    expect(props.saveConfig.mock.calls[0][0].site_name).toBe("Sheid Novo");
    expect(mockToast.success).toHaveBeenCalledWith("Configurações salvas.");
    // Salvo: a aba volta a dizer que não há nada pendente.
    expect(onAlteracoes).toHaveBeenLastCalledWith(false);
  });

  test("save que falha resolve false e a edição continua pendente", async () => {
    const onAlteracoes = jest.fn();
    const salvarRef: any = { current: null };
    montar({ onAlteracoes, salvarRef, saveConfig: jest.fn().mockRejectedValue(new Error("x")) });
    fireEvent.changeText(screen.getByPlaceholderText("Ex: Ateliê da Helena · Personalizados"), "Outro");
    let ok: boolean | undefined;
    await act(async () => { ok = await salvarRef.current(); });
    expect(ok).toBe(false);
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(onAlteracoes).toHaveBeenLastCalledWith(true);
  });

  test("sem salvarRef nem onAlteracoes a aba funciona como antes", () => {
    montar();
    fireEvent.changeText(screen.getByPlaceholderText("Ex: Ateliê da Helena · Personalizados"), "Outro");
    expect(screen.getByDisplayValue("Outro")).toBeTruthy();
  });
});
