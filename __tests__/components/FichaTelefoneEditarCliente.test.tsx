// ============================================================
// Ficha do crediário · F2 (23/11/2026): telefone no cabeçalho e
// "Editar cliente" sem sair do crediário.
//
//   - com telefone, tela larga: número formatado, toque copia ("Telefone
//     copiado"), "Abrir WhatsApp" abre a conversa vazia, "Editar cliente";
//   - celular: o toque no número abre Copiar número / Abrir conversa / Ligar;
//   - sem telefone: "Sem telefone · adicionar" abre a edição no telefone;
//   - a janela de edição usa o cadastro inteiro da lista de clientes e grava
//     pela loja da ficha, recarregando a ficha e a carteira.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

let mockLargura = 1280;
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  return { ...rn, useWindowDimensions: () => ({ width: mockLargura, height: 800, scale: 1, fontScale: 1 }) };
});
const mockCopy = jest.fn();
jest.mock("@/utils/clipboard", () => ({ copyText: (...a: any[]) => mockCopy(...a) }));
const mockWa = jest.fn(() => true);
const mockTel = jest.fn(() => true);
jest.mock("@/utils/whatsapp", () => {
  const real = jest.requireActual("@/utils/whatsapp");
  return { ...real, openWhatsApp: (...a: any[]) => (mockWa as any)(...a), openTel: (...a: any[]) => (mockTel as any)(...a) };
});
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: ({ children }: any) => children }));
let mockForm: any = null;
jest.mock("@/components/screens/clientes/AddCustomerForm", () => ({
  AddCustomerForm: (p: any) => { mockForm = p; return null; },
}));
const mockUpdate = jest.fn();
let mockLista: any = { customers: [], isLoading: false, isError: false };
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ ...mockLista, refetch: jest.fn(), updateCustomerAsync: (...a: any[]) => mockUpdate(...a) }),
}));
const mockInvalidate = jest.fn();
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidate }) }));

import { TelefoneDaFicha } from "@/components/crediario/ficha/TelefoneDaFicha";
import { EditarClienteDaFicha } from "@/components/crediario/ficha/EditarClienteDaFicha";

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (t: renderer.ReactTestRenderer, testID: string) => t.root.findAllByProps({ testID }, { deep: false });

function montarTel(props: any) {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<TelefoneDaFicha {...props} />); });
  return t;
}

beforeEach(() => { jest.clearAllMocks(); mockLargura = 1280; mockForm = null; mockLista = { customers: [], isLoading: false, isError: false }; });

describe("TelefoneDaFicha", () => {
  test("tela larga: número formatado, toque copia, Abrir WhatsApp e Editar cliente", () => {
    const onEditar = jest.fn();
    const t = montarTel({ phone: "12991234567", onEditar });
    const txt = texto(t.toJSON());
    expect(txt).toContain("(12) 99123-4567");
    expect(txt).toContain("copiar");
    expect(txt).toContain("Abrir WhatsApp");
    expect(txt).toContain("✎ Editar cliente");

    act(() => { porId(t, "ficha-telefone")[0].props.onPress(); });
    expect(mockCopy).toHaveBeenCalledWith("(12) 99123-4567", "Telefone copiado");

    act(() => { porId(t, "ficha-abrir-whatsapp")[0].props.onPress(); });
    expect(mockWa).toHaveBeenCalledWith("12991234567");

    act(() => { porId(t, "ficha-editar-cliente")[0].props.onPress(); });
    expect(onEditar).toHaveBeenCalledWith(false);
    t.unmount();
  });

  test("celular: o toque no número abre Copiar, Abrir conversa e Ligar", () => {
    mockLargura = 375;
    const t = montarTel({ phone: "(12) 99123-4567", onEditar: jest.fn() });
    expect(porId(t, "ficha-telefone-opcoes")).toHaveLength(0);
    expect(porId(t, "ficha-abrir-whatsapp")).toHaveLength(0);
    act(() => { porId(t, "ficha-telefone")[0].props.onPress(); });
    const txt = texto(t.toJSON());
    expect(txt).toContain("Copiar número");
    expect(txt).toContain("Abrir conversa no WhatsApp");
    expect(txt).toContain("Ligar");
    act(() => { porId(t, "ficha-ligar")[0].props.onPress(); });
    expect(mockTel).toHaveBeenCalledWith("(12) 99123-4567");
    expect(porId(t, "ficha-telefone-opcoes")).toHaveLength(0);
    t.unmount();
  });

  test("sem telefone: 'Sem telefone · adicionar' abre a edição no telefone", () => {
    const onEditar = jest.fn();
    const t = montarTel({ phone: "", onEditar });
    const txt = texto(t.toJSON());
    expect(txt).toContain("Sem telefone ·");
    expect(txt).toContain("adicionar");
    expect(txt).not.toContain("Abrir WhatsApp");
    act(() => { porId(t, "ficha-sem-telefone")[0].props.onPress(); });
    expect(onEditar).toHaveBeenCalledWith(true);
    t.unmount();
  });
});

describe("EditarClienteDaFicha", () => {
  const MARIA = { id: "cli-1", name: "Maria Aparecida", phone: "", email: "m@x.com", company_id: "loja-b", notes: "gosta de azul" };

  function montarJanela(extra: any = {}) {
    const props = { visible: true, companyId: "loja-a", customerId: "cli-1", focoNoTelefone: true, onClose: jest.fn(), onSaved: jest.fn(), ...extra };
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<EditarClienteDaFicha {...props} />); });
    return { t, props };
  }

  test("abre o formulário com o cadastro inteiro e o foco no telefone", () => {
    mockLista = { customers: [MARIA], isLoading: false, isError: false };
    const { t } = montarJanela();
    expect(mockForm.initialData).toBe(MARIA);
    expect(mockForm.focoNoTelefone).toBe(true);
    t.unmount();
  });

  test("salvar grava pela loja da ficha, recarrega a ficha e a carteira e fecha", async () => {
    mockLista = { customers: [MARIA], isLoading: false, isError: false };
    mockUpdate.mockResolvedValue({});
    const { t, props } = montarJanela();
    const editada = { ...MARIA, phone: "(12) 99123-4567" };
    await act(async () => { await mockForm.onSave(editada); });
    expect(mockUpdate).toHaveBeenCalledWith("cli-1", editada, "loja-a");
    const chaves = mockInvalidate.mock.calls.map(c => JSON.stringify(c[0].queryKey));
    expect(chaves).toEqual(expect.arrayContaining([
      JSON.stringify(["credit-customer", "loja-a", "cli-1"]),
      JSON.stringify(["credit-balances", "loja-a"]),
    ]));
    expect(props.onSaved).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
    t.unmount();
  });

  test("falhou ao gravar: a janela fica aberta", async () => {
    mockLista = { customers: [MARIA], isLoading: false, isError: false };
    mockUpdate.mockRejectedValue(new Error("x"));
    const { t, props } = montarJanela();
    await act(async () => { await mockForm.onSave(MARIA); });
    expect(props.onClose).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
    t.unmount();
  });

  test("cliente fora da lista: explica em vez de abrir um formulário pela metade", () => {
    mockLista = { customers: [], isLoading: false, isError: false };
    const { t } = montarJanela();
    expect(mockForm).toBeNull();
    expect(porId(t, "ficha-editar-cliente-sem-cadastro")).toHaveLength(1);
    expect(texto(t.toJSON())).toContain("Não achamos o cadastro desta cliente.");
    t.unmount();
  });

  test("fechada: nem carrega a lista", () => {
    const { t } = montarJanela({ visible: false });
    expect(t.toJSON()).toBeNull();
    t.unmount();
  });
});
