// ============================================================
// "Orçamento" do Caixa com o Matcon ligado: IMPRIME E SALVA no mesmo
// clique (QA final 23/09/2026).
//
//   - imprime ANTES de esperar a API (o navegador só abre a janela de
//     impressão dentro do clique) — o `onPrint` roda de forma síncrona,
//     antes de o createQuote responder;
//   - salvou: card "Orçamento #N salvo" (savedQuote) e toast "impresso e
//     salvo";
//   - salvar falhou (404 "Rota nao encontrada", 500, rede): o papel já
//     saiu, o toast diz em português simples que não ficou guardado —
//     nunca o texto do sistema — e o salvar continua disponível no
//     próximo clique (o backend pode chegar no meio do dia).
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
function Harness({ onPrint, cart }: { onPrint?: () => void; cart?: any[] }) {
  api = useMatconQuote({
    companyId: "empresa-1",
    matconEnabled: true,
    cart: cart ?? [{ productId: "p1__v1", name: "Cimento", price: 38, qty: 10, unit: "sc" }],
    onPrint,
  });
  return null;
}
function montar(onPrint?: () => void, cart?: any[]) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Harness onPrint={onPrint} cart={cart} />); });
  return tree;
}
function erroDaApi(status: number, message: string) {
  return Object.assign(new Error(message), { status, data: { error: message }, isNetworkError: false });
}
const QUOTE = { id: "q1", number: 12, total: 380, valid_until: "2026-09-30", public_token: "tok", customer_name: null };

beforeEach(() => { jest.clearAllMocks(); });

describe("um clique = imprime e salva", () => {
  test("imprime no clique, ANTES da resposta da API; salvou → card e toast 'impresso e salvo'", async () => {
    let responder!: (v: any) => void;
    mockCreateQuote.mockImplementationOnce(() => new Promise((r) => { responder = r; }));
    const imprimir = jest.fn();
    const tree = montar(imprimir);

    let promessa!: Promise<void>;
    act(() => { promessa = api.saveQuote!(); });
    // A API ainda não respondeu e o papel já saiu.
    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(mockCreateQuote).toHaveBeenCalledTimes(1);
    expect(api.saving).toBe(true);
    expect(imprimir.mock.invocationCallOrder[0]).toBeLessThan(mockCreateQuote.mock.invocationCallOrder[0]);

    await act(async () => { responder({ quote: QUOTE }); await promessa; });
    expect(api.savedQuote?.number).toBe(12);
    expect(api.savedQuote?.validUntilLabel).toBe("30/09");
    expect(api.saving).toBe(false);
    expect(toast.success).toHaveBeenCalledWith("Orçamento #12 impresso e salvo em Orçamentos");
    // product_id sem o sufixo da variante.
    expect(mockCreateQuote.mock.calls[0][1].items[0]).toMatchObject({ product_id: "p1", quantity: 10, unit_price: 38, unit: "sc" });
    tree.unmount();
  });

  test("404 (rota ainda não existe): imprimiu, avisa sem jargão e o salvar continua disponível", async () => {
    mockCreateQuote.mockRejectedValueOnce(erroDaApi(404, "Rota nao encontrada"));
    const imprimir = jest.fn();
    const tree = montar(imprimir);
    await act(async () => { await api.saveQuote!(); });

    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("O orçamento foi impresso, mas não ficou guardado em Orçamentos. Tente de novo daqui a pouco.");
    expect(JSON.stringify((toast.error as jest.Mock).mock.calls)).not.toContain("Rota");
    expect(api.savedQuote).toBeNull();
    expect(typeof api.saveQuote).toBe("function");
    expect(api.saving).toBe(false);

    // O backend chegou: o próximo clique imprime e salva.
    mockCreateQuote.mockResolvedValueOnce({ quote: QUOTE });
    await act(async () => { await api.saveQuote!(); });
    expect(imprimir).toHaveBeenCalledTimes(2);
    expect(api.savedQuote?.number).toBe(12);
    tree.unmount();
  });

  test("500 e rede também imprimem, com a frase simples", async () => {
    mockCreateQuote.mockRejectedValueOnce(erroDaApi(500, "Internal Server Error"));
    const imprimir = jest.fn();
    const tree = montar(imprimir);
    await act(async () => { await api.saveQuote!(); });
    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("O orçamento foi impresso, mas não ficou guardado em Orçamentos. Tente de novo daqui a pouco.");
    tree.unmount();
  });

  test("frase do backend para o lojista passa como veio", async () => {
    mockCreateQuote.mockRejectedValueOnce(erroDaApi(400, "Cliente bloqueado para orçamento"));
    const tree = montar(jest.fn());
    await act(async () => { await api.saveQuote!(); });
    expect(toast.error).toHaveBeenCalledWith("Cliente bloqueado para orçamento");
    tree.unmount();
  });

  test("carrinho vazio: nem imprime nem chama a API", async () => {
    const imprimir = jest.fn();
    const tree = montar(imprimir, []);
    await act(async () => { await api.saveQuote!(); });
    expect(imprimir).not.toHaveBeenCalled();
    expect(mockCreateQuote).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
    tree.unmount();
  });

  test("sem onPrint: só salva, e o erro é neutro", async () => {
    mockCreateQuote.mockRejectedValueOnce(erroDaApi(404, "Rota nao encontrada"));
    const tree = montar();
    await act(async () => { await api.saveQuote!(); });
    expect(toast.error).toHaveBeenCalledWith("Não consegui salvar o orçamento. Tente de novo daqui a pouco.");
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
