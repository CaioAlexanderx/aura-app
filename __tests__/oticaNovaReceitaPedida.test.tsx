// ============================================================
// Ótica · Nova OS aberta por "Abrir OS com esta receita" (rx_id)
// Revisão do PR #1361, 23/11/2026.
//
//   1. O rx_id vale UMA vez. Chega pela receita A, troca para "Digitar nova",
//      grava a B, a OS falha, tenta de novo: a OS tem de abrir com a B. Antes,
//      a lista recarregava ao gravar a B, o rx_id voltava a ganhar e a OS
//      abria com a A, deixando a B solta no livro.
//   2. A lista traz só as 10 últimas: receita pedida mais antiga é buscada
//      pelo id e escolhida — nunca troca em silêncio pela mais recente.
//   3. Receita pedida que não existe: a tela avisa.
//   4. Telefone repetido no cadastro: completa o cadastro que já existe com o
//      que foi digitado, sem trocar o que já estava lá.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
const mockToastError = jest.fn();
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), info: jest.fn(), warning: jest.fn(), error: (...a: any[]) => mockToastError(...a) },
}));
const mockReplace = jest.fn();
let mockParams: any = { customer_id: "cli-1", rx_id: "rx-A" };
jest.mock("expo-router", () => ({
  router: { replace: (...a: any[]) => mockReplace(...a), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "otica-1" }, user: { id: "user-1" } }) }));
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ customers: [{ id: "cli-1", name: "Maria Souza", phone: "11999990000" }] }),
}));
jest.mock("@/hooks/useProducts", () => ({
  useProducts: () => ({ products: [{ id: "arm-1", name: "Armação Ray-Ban", price: 300, code: "RB1" }] }),
}));
jest.mock("@/hooks/useChaveDaVenda", () => ({ useChaveDaVenda: () => ({ atual: () => "chave", concluida: jest.fn(), aposErro: jest.fn() }) }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: ({ children }: any) => children }));
jest.mock("@/components/endereco/SecaoEndereco", () => ({ SecaoEndereco: () => null }));

function isoDaqui(dias: number) {
  const d = new Date(); d.setDate(d.getDate() + dias);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function receita(id: string, emitidaHa: number, sph: number): any {
  return {
    id, customer_id: "cli-1",
    od_sph: sph, od_cyl: null, od_axis: null, od_add: null, od_prism: null, od_base: null,
    oe_sph: sph, oe_cyl: null, oe_axis: null, oe_add: null, oe_prism: null, oe_base: null,
    od_pd: null, oe_pd: null, od_height: null, oe_height: null,
    prescriber_type: "medico", prescriber_name: "Dr. Lima", prescriber_registry: "CRM 1",
    issued_at: isoDaqui(-emitidaHa), valid_until: isoDaqui(365 - emitidaHa),
  };
}
const RX_A = receita("rx-A", 200, -1);       // a pedida (mais antiga)
const RX_RECENTE = receita("rx-R", 5, -3);   // a mais recente válida
const RX_B = receita("rx-B", 0, -2.5);       // a que a tela grava

let mockLista: any[] = [];
let mockPedida: any = undefined;             // resposta do GET por id
let mockPedidaCarregando = false;
const mockInvalidate = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
  useQuery: (cfg: any) => {
    const k = cfg.queryKey?.[0];
    if (k === "otica-prescriptions") return { data: { prescriptions: mockLista } };
    if (k === "otica-prescription") return cfg.enabled ? { data: mockPedida, isLoading: mockPedidaCarregando } : { data: undefined, isLoading: false };
    if (k === "otica-labs") return { data: { labs: [] } };
    return { data: undefined };
  },
}));

const mockCriarReceita = jest.fn((..._a: any[]) => {
  // Gravou: a lista do servidor passa a ter a B (é o que o invalidate recarrega).
  mockLista = [RX_B, ...mockLista];
  return Promise.resolve({ prescription: RX_B });
});
jest.mock("@/services/oticaApi", () => {
  const real = jest.requireActual("@/services/oticaApi");
  return { ...real, oticaApi: { ...real.oticaApi, createPrescription: (...a: any[]) => mockCriarReceita(...a) } };
});
jest.mock("@/services/pdvApi", () => ({ pdvApi: { createSale: jest.fn(), createSaleComSinal: jest.fn() } }));
const mockCriarOs = jest.fn((..._a: any[]) => Promise.resolve({ order: { id: "os-1", os_number: 12 } }));
jest.mock("@/services/serviceOrdersApi", () => ({
  serviceOrdersApi: { create: (...a: any[]) => mockCriarOs(...a) },
}));

import OticaNovaScreen from "@/app/(tabs)/otica/nova";
import { completarCadastroExistente } from "@/components/otica/CadastroDoClienteOtica";

function montar() {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<OticaNovaScreen />); });
  return t;
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.find((n: any) => n.props?.testID === id && (n.props.onPress || n.props.onChangeText));
const existe = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n: any) => n.props?.testID === id, { deep: false }).length > 0;
/** A receita escolhida é a do atalho aceso (chipOn = borda violeta). */
function escolhida(t: renderer.ReactTestRenderer): string | null {
  for (const id of ["rx-A", "rx-R", "rx-B"]) {
    const n = t.root.findAll((x: any) => x.props?.testID === `otica-rx-${id}` && !!x.props.onPress, { deep: false })[0];
    const estilo = n ? [n.props.style].flat(5).filter(Boolean) : [];
    if (estilo.length > 1) return id;
  }
  return null;
}
function preencherArmacaoELente(t: renderer.ReactTestRenderer) {
  act(() => { porId(t, "otica-busca-armacao").props.onChangeText("ray"); });
  act(() => { porId(t, "otica-armacao-arm-1").props.onPress(); });
  act(() => { porId(t, "otica-lente-marca").props.onChangeText("Essilor"); });
}
async function salvar(t: renderer.ReactTestRenderer) {
  await act(async () => { await porId(t, "otica-salvar").props.onPress(); });
}
const opticalDa = (i: number) => (mockCriarOs.mock.calls[i] as any[])[1].optical;

beforeEach(() => {
  mockParams = { customer_id: "cli-1", rx_id: "rx-A" };
  mockLista = [RX_RECENTE, RX_A];
  mockPedida = undefined;
  mockPedidaCarregando = false;
  mockCriarReceita.mockClear();
  mockCriarOs.mockReset();
  mockCriarOs.mockImplementation(() => Promise.resolve({ order: { id: "os-1", os_number: 12 } }));
  mockToastError.mockClear();
  mockReplace.mockClear();
});

describe("Nova OS aberta com rx_id", () => {
  test("abre com a receita pedida, não com a mais recente", async () => {
    const t = montar();
    expect(escolhida(t)).toBe("rx-A");
    preencherArmacaoELente(t);
    await salvar(t);
    expect(mockCriarReceita).not.toHaveBeenCalled();
    expect(opticalDa(0).prescription_id).toBe("rx-A");
    expect(opticalDa(0).prescription.od.sph).toBe(-1);
    act(() => { t.unmount(); });
  });

  test("troca para nova, grava a B, a OS falha, tenta de novo: a OS abre com a B", async () => {
    const t = montar();
    expect(escolhida(t)).toBe("rx-A");
    act(() => { porId(t, "otica-rx-nova").props.onPress(); });
    act(() => { porId(t, "otica-rx-grid-od-sph").props.onChangeText("-2,50"); });
    act(() => { porId(t, "otica-rx-grid-od-sph").props.onBlur(); });
    preencherArmacaoELente(t);

    mockCriarOs.mockImplementationOnce(() => Promise.reject({ data: { error: "Falha ao abrir a OS" } }));
    await salvar(t);
    expect(mockCriarReceita).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith("Falha ao abrir a OS");
    // A 1ª tentativa já foi com a B.
    expect(opticalDa(0).prescription_id).toBe("rx-B");

    // A lista recarregou com a B (mockLista mudou): o rx_id NÃO volta a ganhar.
    act(() => { t.update(<OticaNovaScreen />); });
    expect(escolhida(t)).toBe("rx-B");

    await salvar(t);
    // Não grava a receita outra vez, e a OS vai com a B — graus da B inclusive.
    expect(mockCriarReceita).toHaveBeenCalledTimes(1);
    expect(mockCriarOs).toHaveBeenCalledTimes(2);
    expect(opticalDa(1).prescription_id).toBe("rx-B");
    expect(opticalDa(1).prescription.od.sph).toBe(-2.5);
    expect(mockReplace).toHaveBeenCalledWith("/otica/os-1");
    act(() => { t.unmount(); });
  });

  test("a escolha da vendedora não é desfeita quando a lista muda de tamanho", () => {
    const t = montar();
    act(() => { porId(t, "otica-rx-rx-R").props.onPress(); });
    expect(escolhida(t)).toBe("rx-R");
    mockLista = [receita("rx-X", 1, -4), ...mockLista]; // outra receita registrada em outra aba
    act(() => { t.update(<OticaNovaScreen />); });
    expect(escolhida(t)).toBe("rx-R");
    act(() => { t.unmount(); });
  });

  test("receita pedida fora das 10 últimas: busca pelo id e escolhe ela", async () => {
    mockLista = [RX_RECENTE];           // a A não veio na lista
    mockPedida = { prescription: RX_A };
    const t = montar();
    expect(escolhida(t)).toBe("rx-A");
    expect(existe(t, "otica-rx-pedida-nao-achada")).toBe(false);
    preencherArmacaoELente(t);
    await salvar(t);
    expect(opticalDa(0).prescription_id).toBe("rx-A");
    act(() => { t.unmount(); });
  });

  test("enquanto a busca pelo id não volta, não escolhe outra no lugar", () => {
    mockLista = [RX_RECENTE];
    mockPedidaCarregando = true;
    const t = montar();
    expect(escolhida(t)).toBeNull();
    mockPedidaCarregando = false;
    mockPedida = { prescription: RX_A };
    act(() => { t.update(<OticaNovaScreen />); });
    expect(escolhida(t)).toBe("rx-A");
    act(() => { t.unmount(); });
  });

  test("receita pedida que não existe: avisa e cai na válida mais recente", () => {
    mockLista = [RX_RECENTE];
    mockPedida = undefined;
    const t = montar();
    expect(existe(t, "otica-rx-pedida-nao-achada")).toBe(true);
    expect(escolhida(t)).toBe("rx-R");
    act(() => { t.unmount(); });
  });

  test("receita de outro cliente não entra na lista deste", () => {
    mockLista = [RX_RECENTE];
    mockPedida = { prescription: { ...RX_A, customer_id: "cli-9" } };
    const t = montar();
    expect(escolhida(t)).toBe("rx-R");
    expect(existe(t, "otica-rx-pedida-nao-achada")).toBe(true);
    act(() => { t.unmount(); });
  });

  test("sem rx_id, segue como sempre: a válida mais recente", () => {
    mockParams = { customer_id: "cli-1" };
    const t = montar();
    expect(escolhida(t)).toBe("rx-R");
    expect(existe(t, "otica-rx-pedida-nao-achada")).toBe(false);
    act(() => { t.unmount(); });
  });
});

describe("Telefone repetido: completar o cadastro que já existe", () => {
  const base: any = {
    id: "c1", name: "Maria Souza", email: "", phone: "(11) 99999-0000", instagram: "", birthday: "",
    lastPurchase: "---", totalSpent: 0, visits: 3, firstVisit: "01/01/2026", notes: "", rating: null, creditBalance: 0,
    cpf: "", rg: "", gender: "", occupation: "", company_id: "loja-b",
  };
  const digitado: any = {
    ...base, id: "novo", name: "Maria S.", email: "maria@email.com", birthday: "14/03/1968", visits: 0,
    dadosCompletos: { cpf: "52998224725" },
  };

  test("guarda o CPF e o nascimento digitados no cadastro existente", () => {
    const { cliente, novidades } = completarCadastroExistente(base, digitado);
    expect(novidades).toEqual(["CPF", "data de nascimento", "e-mail"]);
    expect(cliente.id).toBe("c1");
    expect(cliente.name).toBe("Maria Souza");       // o nome antigo fica
    expect(cliente.company_id).toBe("loja-b");      // grava na loja do cadastro
    expect(cliente.birthday).toBe("14/03/1968");
    expect(cliente.dadosCompletos).toEqual({ cpf: "52998224725" });
  });

  test("nunca troca o que o cadastro já tinha", () => {
    const cheio = { ...base, cpf: "11144477735", birthday: "01/01/1970", email: "antigo@email.com" };
    const { cliente, novidades } = completarCadastroExistente(cheio, digitado);
    expect(novidades).toEqual([]);
    expect(cliente.birthday).toBe("01/01/1970");
    expect(cliente.email).toBe("antigo@email.com");
    expect(cliente.dadosCompletos).toEqual({});
  });

  test("nascimento sem ano no cadastro ganha o ano digitado; sem ano não troca ano de verdade", () => {
    expect(completarCadastroExistente({ ...base, birthday: "14/03/1904" }, digitado).cliente.birthday).toBe("14/03/1968");
    const semAno = { ...digitado, birthday: "14/03/1904", dadosCompletos: {} , email: "" };
    expect(completarCadastroExistente({ ...base, birthday: "01/01/1970" }, semAno).novidades).toEqual([]);
    expect(completarCadastroExistente(base, semAno).novidades).toEqual(["aniversário"]);
  });
});
