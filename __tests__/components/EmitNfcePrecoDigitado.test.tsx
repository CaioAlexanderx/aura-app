// 23/11/2026 (p-199): na NFC-e manual, digitar 119,90 tecla a tecla virava
// 11990 (subtotal R$ 11.990,00). O campo guardava número a cada tecla e
// "119," voltava a "119". Agora o texto digitado fica no campo e o número
// sai dele só para o subtotal e o envio.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/nfceApi", () => ({ nfceApi: { emit: jest.fn(() => new Promise(() => {})) } }));
jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-font", () => ({ isLoaded: () => true, loadAsync: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: (sel: any) => sel({ company: null, token: null }) }));
jest.mock("@/services/api", () => ({ BASE_URL: "" }));
jest.mock("@/services/nfe55Api", () => ({ nfe55Api: {} }));
jest.mock("@/components/nfe55/nfe55Acoes", () => ({ abrirDanfe: jest.fn(), baixarXml: jest.fn() }));
jest.mock("@/components/nfe55/EventosNfe", () => ({ AcoesDeEventosNfe: () => null }));

import { EmitNfceForm } from "@/components/screens/nfe/EmitNfceForm";
import { nfceApi } from "@/services/nfceApi";

function montar() {
  const qc = new QueryClient();
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(
      <QueryClientProvider client={qc}>
        <EmitNfceForm companyId="c1" />
      </QueryClientProvider>,
    );
  });
  const um = (id: string) =>
    t.root.findAll((n) => n.props.testID === id && typeof n.type !== "string", { deep: false })[0];
  // Digita como o teclado: cada tecla soma ao que o campo mostra agora.
  const digitar = (id: string, teclas: string[]) => {
    for (const k of teclas) {
      const campo = um(id);
      act(() => { campo.props.onChangeText(String(campo.props.value ?? "") + k); });
    }
  };
  const apagar = (id: string) => act(() => { um(id).props.onChangeText(""); });
  const nome = t.root.findAll((n) => n.props.placeholder === "Descrição do produto/serviço" && typeof n.type !== "string", { deep: false })[0];
  act(() => { nome.props.onChangeText("Vestido"); });
  return { um, digitar, apagar };
}

describe("NFC-e manual: preço e quantidade digitados", () => {
  beforeEach(() => (nfceApi.emit as jest.Mock).mockClear());

  it("1, 1, 9, vírgula, 9, 0 vira R$ 119,90 e 119.9 no envio", async () => {
    const f = montar();
    f.digitar("nfce-item-preco", ["1", "1", "9", ",", "9", "0"]);
    expect(f.um("nfce-item-preco").props.value).toBe("119,90");
    expect(f.um("nfce-item-subtotal").props.children).toBe("R$ 119,90");

    await act(async () => { f.um("nfce-emitir").props.onPress(); });
    const corpo = (nfceApi.emit as jest.Mock).mock.calls[0][1];
    expect(corpo.items).toHaveLength(1);
    expect(corpo.items[0].unit_price).toBe(119.9);
    expect(corpo.items[0].quantity).toBe(1);
    expect(corpo.items[0]).not.toHaveProperty("_id");
    expect(corpo.items[0]).not.toHaveProperty("_qtdTexto");
    expect(corpo.items[0]).not.toHaveProperty("_precoTexto");
  });

  it("aceita ponto como decimal e milhar com vírgula", () => {
    const f = montar();
    f.digitar("nfce-item-preco", ["1", "1", "9", ".", "9", "0"]);
    expect(f.um("nfce-item-subtotal").props.children).toBe("R$ 119,90");
    f.apagar("nfce-item-preco");
    f.digitar("nfce-item-preco", "1.234,56".split(""));
    expect(f.um("nfce-item-subtotal").props.children).toBe("R$ 1.234,56");
  });

  it("quantidade decimal digitada tecla a tecla", () => {
    const f = montar();
    f.apagar("nfce-item-qtd");
    f.digitar("nfce-item-qtd", ["1", ",", "5"]);
    expect(f.um("nfce-item-qtd").props.value).toBe("1,5");
    f.digitar("nfce-item-preco", ["1", "0"]);
    expect(f.um("nfce-item-subtotal").props.children).toBe("R$ 15,00");
  });
});
