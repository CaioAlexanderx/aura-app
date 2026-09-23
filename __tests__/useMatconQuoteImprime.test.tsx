// ============================================================
// QA 23/09/2026 — "Orçamento" com o Matcon ligado não imprimia.
//
// POST /matcon/quotes ainda não existe no backend (404, "Rota nao
// encontrada"). Salvar que falha tem de imprimir pelo caminho de sempre
// (onSaveFailed), sem mostrar o texto do sistema; e depois de um 404 o
// botão volta a imprimir direto (saveQuote some).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/utils/whatsapp", () => ({ openWhatsApp: jest.fn() }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
const mockCreateQuote = jest.fn();
jest.mock("@/services/matconApi", () => ({
  matconApi: { createQuote: (...a: any[]) => mockCreateQuote(...a), markQuoteSent: jest.fn() },
}));

import { toast } from "@/components/Toast";
import { useMatconQuote } from "@/hooks/useMatconQuote";
import { ehRotaAusente, textoDoErro } from "@/components/screens/pdv/erroNoCaixa";

let api: ReturnType<typeof useMatconQuote>;
function Harness({ onSaveFailed }: { onSaveFailed?: () => void }) {
  api = useMatconQuote({
    companyId: "empresa-1",
    matconEnabled: true,
    cart: [{ productId: "p1", name: "Cimento", price: 38, qty: 10, unit: "sc" }],
    onSaveFailed,
  });
  return null;
}
function montar(onSaveFailed?: () => void) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Harness onSaveFailed={onSaveFailed} />); });
  return tree;
}
function erroDaApi(status: number, message: string) {
  return Object.assign(new Error(message), { status, data: { error: message }, isNetworkError: false });
}

beforeEach(() => { jest.clearAllMocks(); });

describe("salvar falhou → imprime", () => {
  test("404 (rota ainda não existe): imprime, nada de 'Rota nao encontrada', e o botão passa a imprimir direto", async () => {
    mockCreateQuote.mockRejectedValueOnce(erroDaApi(404, "Rota nao encontrada"));
    const imprimir = jest.fn();
    const tree = montar(imprimir);
    expect(typeof api.saveQuote).toBe("function");
    await act(async () => { await api.saveQuote!(); });
    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(api.saveQuote).toBeUndefined();
    expect(api.saving).toBe(false);
    tree.unmount();
  });

  test("outro erro (500, rede): imprime também, e o salvar continua disponível", async () => {
    mockCreateQuote.mockRejectedValueOnce(erroDaApi(500, "Internal Server Error"));
    const imprimir = jest.fn();
    const tree = montar(imprimir);
    await act(async () => { await api.saveQuote!(); });
    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(typeof api.saveQuote).toBe("function");
    tree.unmount();
  });

  test("salvou: não imprime sozinho", async () => {
    mockCreateQuote.mockResolvedValueOnce({ quote: { id: "q1", number: 12, total: 380, valid_until: "2026-09-30" } });
    const imprimir = jest.fn();
    const tree = montar(imprimir);
    await act(async () => { await api.saveQuote!(); });
    expect(imprimir).not.toHaveBeenCalled();
    expect(api.savedQuote?.number).toBe(12);
    tree.unmount();
  });

  test("sem onSaveFailed: o toast é neutro, nunca o texto do sistema", async () => {
    mockCreateQuote.mockRejectedValueOnce(erroDaApi(404, "Rota nao encontrada"));
    const tree = montar();
    await act(async () => { await api.saveQuote!(); });
    expect(toast.error).toHaveBeenCalledWith("Não deu para salvar o orçamento");
    tree.unmount();
  });
});

describe("textoDoErro", () => {
  test("404, rede e texto de sistema viram o texto neutro", () => {
    expect(textoDoErro(erroDaApi(404, "Rota nao encontrada"), "neutro")).toBe("neutro");
    expect(textoDoErro({ message: "Rota não encontrada", status: 400 }, "neutro")).toBe("neutro");
    expect(textoDoErro({ message: "Failed to fetch", isNetworkError: true }, "neutro")).toBe("neutro");
    expect(textoDoErro({ message: "Internal Server Error", status: 500 }, "neutro")).toBe("neutro");
    expect(textoDoErro(null, "neutro")).toBe("neutro");
  });
  test("frase do backend para o lojista passa como veio", () => {
    expect(textoDoErro(erroDaApi(400, "Cupom expirado"), "neutro")).toBe("Cupom expirado");
    expect(textoDoErro({ status: 400, data: { error: "Valor minimo: R$ 50,00" }, message: "x" }, "neutro")).toBe("Valor minimo: R$ 50,00");
  });
  test("ehRotaAusente só no 404", () => {
    expect(ehRotaAusente({ status: 404 })).toBe(true);
    expect(ehRotaAusente({ status: 400 })).toBe(false);
    expect(ehRotaAusente(null)).toBe(false);
  });
});
