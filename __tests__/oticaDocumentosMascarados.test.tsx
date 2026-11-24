// ============================================================
// Ótica · CPF e RG mascarados na lista de clientes (24/11/2026)
//
// Aura-backend#1099: a LISTA (GET /companies/:id/customers, /me/customers)
// devolve cpf_cnpj e rg mascarados ("***.***.247-25") com docs_masked: true;
// o inteiro só sai no GET /companies/:id/customers/:cid.
//
//   - lista mascarada → o formulário de edição busca o GET /:cid na loja do
//     próprio cliente e preenche o inteiro, sem contar como "mexido";
//   - enquanto não chega, CPF/RG só leitura (a máscara nunca é editável);
//   - GET falhou → só leitura com a máscara, o campo não vai no PATCH; só
//     "Digitar de novo" + um valor novo manda;
//   - valor com `*` nunca vai no corpo do POST/PATCH;
//   - lista sem máscara (backend antigo) → nenhuma chamada a mais;
//   - receita impressa: busca o inteiro; se falhar, sai a máscara.
// ============================================================
jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true] }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), info: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/endereco/SecaoEndereco", () => ({ SecaoEndereco: () => null }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "loja-ativa" } }) }));
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ companiesApi: {}, ApiError: class ApiError extends Error {}, request: (...a: any[]) => mockRequest(...a) }));
jest.mock("@/services/meAggregates", () => ({ meAggregatesApi: {} }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn(), useMutation: jest.fn(), useQueryClient: jest.fn() }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { formatarDocumento, precisaDosDocumentosInteiros, temMascara, faltasDoClienteParaOtica } from "@/utils/clienteDadosCompletos";
import { corpoDaEdicaoDoCliente, corpoDoNovoCliente, corpoDosDadosCompletos, mapApiCustomer } from "@/hooks/useCustomers";
import { buscarDocumentosInteiros, lojaDoCliente } from "@/hooks/useDocumentosDoCliente";
import { clienteParaAFicha, htmlDaFichaDaReceita } from "@/services/oticaPrint";
import { AddCustomerForm } from "@/components/screens/clientes/AddCustomerForm";
import type { Customer } from "@/components/screens/clientes/types";

const CPF_INTEIRO = "52998224725";
const CPF_MASCARA = "***.***.247-25";
const RG_INTEIRO = "32.118.404-7";
const RG_MASCARA = "***4-7";

/** O cliente como a lista nova devolve: documentos mascarados, de outra loja do dono. */
const DA_LISTA: Customer = {
  id: "c1", name: "Marina Prado", email: "", phone: "(12) 99812-4410", instagram: "", birthday: "14/03/1968",
  lastPurchase: "---", totalSpent: 0, visits: 0, firstVisit: "01/01/2026", notes: "", rating: null, creditBalance: 0,
  cpf: CPF_MASCARA, rg: RG_MASCARA, gender: "", occupation: "", docsMasked: true, company_id: "loja-b",
};
/** Backend antigo: documento inteiro na lista, sem docs_masked. */
const ANTIGO: Customer = { ...DA_LISTA, cpf: CPF_INTEIRO, rg: RG_INTEIRO, docsMasked: false };

function textoDe(n: any): string {
  if (typeof n === "string") return n;
  return (n?.children || []).map(textoDe).join("");
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const campo = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && !!n.props.onChangeText, { deep: false })[0];
const tocar = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && !!n.props.onPress, { deep: false })[0];
const porPlaceholder = (t: renderer.ReactTestRenderer, p: string) => t.root.findAll((n) => n.props && n.props.placeholder === p && n.props.onChangeText, { deep: false })[0];
const botao = (t: renderer.ReactTestRenderer, rotulo: string) => t.root.findAll((n) => !!n.props?.onPress && textoDe(n) === rotulo)[0];
const respostaDaFicha = (extra: any = {}) => ({ customer: { id: "c1", cpf_cnpj: CPF_INTEIRO, rg: RG_INTEIRO, docs_masked: false, ...extra }, customer_fields: ["rg", "gender"] });

function montar(props: any) {
  const onSave = jest.fn();
  const onEditou = jest.fn();
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(
      <AddCustomerForm onSave={onSave} onCancel={jest.fn()} onEditou={onEditou} dadosCompletos camposExtras={["rg", "gender"]} {...props} />,
    );
  });
  return { t, onSave, onEditou };
}
/** Deixa as promessas do GET resolverem dentro do act. */
const esperar = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => mockRequest.mockReset());

describe("Documento mascarado: regras puras", () => {
  it("reconhece a máscara da lista e só pede o GET quando há o que buscar", () => {
    expect(temMascara(CPF_MASCARA)).toBe(true);
    expect(temMascara(CPF_INTEIRO)).toBe(false);
    expect(precisaDosDocumentosInteiros(DA_LISTA)).toBe(true);
    expect(precisaDosDocumentosInteiros({ cpf: "", rg: RG_MASCARA })).toBe(true);
    expect(precisaDosDocumentosInteiros(ANTIGO)).toBe(false);
    // docs_masked sem documento nenhum: vazio continua vazio, sem chamada.
    expect(precisaDosDocumentosInteiros({ docsMasked: true, cpf: "", rg: "" })).toBe(false);
    expect(precisaDosDocumentosInteiros(null)).toBe(false);
  });

  it("a lista mascarada vira cpf com a máscara, nunca os dígitos do fim", () => {
    const c = mapApiCustomer({ id: "c1", name: "Marina", cpf_cnpj: CPF_MASCARA, rg: RG_MASCARA, docs_masked: true, company_id: "loja-b" });
    expect(c.cpf).toBe(CPF_MASCARA);
    expect(c.cpf).not.toBe("24725");
    expect(c.rg).toBe(RG_MASCARA);
    expect(c.docsMasked).toBe(true);
    // Backend antigo: igual a antes.
    const a = mapApiCustomer({ id: "c1", name: "Marina", cpf_cnpj: "529.982.247-25", rg: RG_INTEIRO });
    expect(a.cpf).toBe(CPF_INTEIRO);
    expect(a.docsMasked).toBe(false);
  });

  it("a máscara aparece como veio; o CPF mascarado ainda conta como preenchido", () => {
    expect(formatarDocumento(CPF_MASCARA)).toBe(CPF_MASCARA);
    expect(formatarDocumento(CPF_INTEIRO)).toBe("529.982.247-25");
    expect(faltasDoClienteParaOtica({ cpf: CPF_MASCARA, birthday: "14/03/1968", phone: "12998124410" })).toEqual([]);
  });

  it("valor com * nunca vai no corpo do PATCH nem do POST", () => {
    expect(corpoDosDadosCompletos({ dadosCompletos: { cpf: CPF_MASCARA, rg: RG_MASCARA } })).toEqual({});
    const edicao = corpoDaEdicaoDoCliente({ ...DA_LISTA, dadosCompletos: { cpf: CPF_MASCARA, rg: RG_MASCARA, gender: "F" } });
    expect(edicao).not.toHaveProperty("cpf_cnpj");
    expect(edicao).not.toHaveProperty("rg");
    expect((edicao as any).gender).toBe("F");
    const novo = corpoDoNovoCliente({ ...DA_LISTA, dadosCompletos: { cpf: "***.***.***-**" } }) as any;
    expect(novo).not.toHaveProperty("cpf_cnpj");
    // Sem máscara, segue como antes.
    expect(corpoDosDadosCompletos({ dadosCompletos: { cpf: "529.982.247-25" } })).toEqual({ cpf_cnpj: CPF_INTEIRO });
  });
});

describe("GET /companies/:cid/customers/:id", () => {
  it("usa a loja do próprio cliente (multi-CNPJ); sem ela, a ativa ou a principal", () => {
    expect(lojaDoCliente({ company_id: "loja-b" }, { company: { id: "loja-ativa" } })).toBe("loja-b");
    expect(lojaDoCliente({ company_id: null }, { company: { id: "loja-ativa" } })).toBe("loja-ativa");
    expect(lojaDoCliente({}, { company: null, availableCompanies: [{ id: "x" }, { id: "p", is_primary: true }] })).toBe("p");
  });

  it("devolve CPF só com dígitos e o RG inteiros", async () => {
    mockRequest.mockResolvedValueOnce(respostaDaFicha({ cpf_cnpj: "529.982.247-25" }));
    await expect(buscarDocumentosInteiros("loja-b", "c1")).resolves.toEqual({ cpf: CPF_INTEIRO, rg: RG_INTEIRO });
    expect(mockRequest).toHaveBeenCalledWith("/companies/loja-b/customers/c1", expect.anything());
  });

  it("resposta ainda mascarada (ou sem cliente) é falha, nunca documento inteiro", async () => {
    mockRequest.mockResolvedValueOnce(respostaDaFicha({ cpf_cnpj: CPF_MASCARA, docs_masked: true }));
    await expect(buscarDocumentosInteiros("loja-b", "c1")).rejects.toThrow();
    mockRequest.mockResolvedValueOnce({});
    await expect(buscarDocumentosInteiros("loja-b", "c1")).rejects.toThrow();
  });
});

describe("Formulário de edição com a lista mascarada", () => {
  it("busca o GET na loja do cliente e preenche CPF e RG inteiros, sem contar como mexido", async () => {
    let responder!: (v: any) => void;
    mockRequest.mockReturnValueOnce(new Promise((r) => { responder = r; }));
    const { t, onSave, onEditou } = montar({ initialData: DA_LISTA });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0][0]).toBe("/companies/loja-b/customers/c1");
    // Enquanto não chega: só leitura, nada de máscara num campo editável.
    expect(campo(t, "cliente-cpf")).toBeUndefined();
    expect(campo(t, "cliente-rg")).toBeUndefined();
    expect(porId(t, "cliente-cpf-travado").length).toBeGreaterThan(0);
    expect(porId(t, "cliente-cpf-carregando").length).toBeGreaterThan(0);
    expect(porId(t, "cliente-rg-travado").length).toBeGreaterThan(0);

    await act(async () => { responder(respostaDaFicha()); });
    expect(campo(t, "cliente-cpf").props.value).toBe("529.982.247-25");
    expect(campo(t, "cliente-rg").props.value).toBe(RG_INTEIRO);
    expect(porId(t, "cliente-cpf-travado")).toHaveLength(0);
    expect(onEditou).not.toHaveBeenCalled();

    // Salvar sem mexer não reenvia documento.
    act(() => { botao(t, "Salvar alterações").props.onPress(); });
    expect(onSave.mock.calls[0][0].dadosCompletos).toEqual({});
  });

  it("com o inteiro em mãos, trocar o CPF manda o novo valor", async () => {
    mockRequest.mockResolvedValueOnce(respostaDaFicha());
    const { t, onSave } = montar({ initialData: DA_LISTA });
    await esperar();
    act(() => { campo(t, "cliente-cpf").props.onChangeText("111.444.777-35"); });
    act(() => { botao(t, "Salvar alterações").props.onPress(); });
    expect(onSave.mock.calls[0][0].dadosCompletos).toEqual({ cpf: "11144477735" });
    expect((corpoDaEdicaoDoCliente(onSave.mock.calls[0][0]) as any).cpf_cnpj).toBe("11144477735");
  });

  it("salvar antes de o GET responder não manda CPF nem RG", () => {
    mockRequest.mockReturnValueOnce(new Promise(() => {}));
    const { t, onSave } = montar({ initialData: DA_LISTA });
    act(() => { porPlaceholder(t, "Ex: Maria da Silva").props.onChangeText("Marina A. Prado"); });
    act(() => { botao(t, "Salvar alterações").props.onPress(); });
    const corpo = corpoDaEdicaoDoCliente(onSave.mock.calls[0][0]);
    expect(corpo).not.toHaveProperty("cpf_cnpj");
    expect(corpo).not.toHaveProperty("rg");
  });

  it("GET falhou: a máscara fica só leitura e o PATCH não leva o campo", async () => {
    mockRequest.mockRejectedValueOnce(new Error("rede"));
    const { t, onSave } = montar({ initialData: DA_LISTA });
    await esperar();
    expect(campo(t, "cliente-cpf")).toBeUndefined();
    expect(porId(t, "cliente-cpf-falhou").length).toBeGreaterThan(0);
    expect(textoDe(porId(t, "cliente-cpf-travado")[0])).toContain(CPF_MASCARA);
    expect(porId(t, "cliente-rg-falhou").length).toBeGreaterThan(0);

    act(() => { porPlaceholder(t, "Ex: Maria da Silva").props.onChangeText("Marina A. Prado"); });
    act(() => { botao(t, "Salvar alterações").props.onPress(); });
    const salvo = onSave.mock.calls[0][0];
    expect(salvo.dadosCompletos).toEqual({});
    const corpo = corpoDaEdicaoDoCliente(salvo);
    expect(corpo).not.toHaveProperty("cpf_cnpj");
    expect(corpo).not.toHaveProperty("rg");
    expect(corpo.name).toBe("Marina A. Prado");
  });

  it("GET falhou: só redigitando o documento ele vai; redigitar e deixar vazio não apaga", async () => {
    mockRequest.mockRejectedValueOnce(new Error("rede"));
    const { t, onSave } = montar({ initialData: DA_LISTA });
    await esperar();
    act(() => { tocar(t, "cliente-cpf-redigitar").props.onPress(); });
    act(() => { tocar(t, "cliente-rg-redigitar").props.onPress(); });
    expect(campo(t, "cliente-cpf").props.value).toBe("");
    // CPF redigitado vai; RG aberto e deixado vazio não apaga o que está guardado.
    act(() => { campo(t, "cliente-cpf").props.onChangeText("111.444.777-35"); });
    act(() => { botao(t, "Salvar alterações").props.onPress(); });
    const corpo = corpoDaEdicaoDoCliente(onSave.mock.calls[0][0]) as any;
    expect(corpo.cpf_cnpj).toBe("11144477735");
    expect(corpo).not.toHaveProperty("rg");
  });

  it("lista sem máscara (backend antigo): nenhuma chamada a mais, campo editável na hora", () => {
    const { t, onSave } = montar({ initialData: ANTIGO });
    expect(mockRequest).not.toHaveBeenCalled();
    expect(campo(t, "cliente-cpf").props.value).toBe("529.982.247-25");
    expect(campo(t, "cliente-rg").props.value).toBe(RG_INTEIRO);
    act(() => { botao(t, "Salvar alterações").props.onPress(); });
    expect(onSave.mock.calls[0][0].dadosCompletos).toEqual({});
  });

  it("cliente novo e formulário sem a ótica não chamam o GET", () => {
    montar({ initialData: undefined });
    montar({ initialData: DA_LISTA, dadosCompletos: false });
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("Receita impressa", () => {
  const base = {
    loja: { nome: "Ótica Visão" },
    receita: { id: "rx1", customer_id: "c1", customer_name: "Marina Prado", rx_type: "oculos", issued_at: "2026-11-20" } as any,
    hoje: "2026-11-24",
  };

  it("com a lista mascarada, busca o inteiro para o papel", async () => {
    const buscar = jest.fn().mockResolvedValue({ cpf: CPF_INTEIRO, rg: RG_INTEIRO });
    const c = await clienteParaAFicha(DA_LISTA, buscar);
    expect(buscar).toHaveBeenCalledTimes(1);
    const html = htmlDaFichaDaReceita({ ...base, cliente: c });
    expect(html).toContain("529.982.247-25");
    expect(html).toContain(RG_INTEIRO);
    expect(html).not.toContain("***");
  });

  it("sem máscara, não chama; se a busca falhar, sai a máscara (nunca o número cortado)", async () => {
    const buscar = jest.fn().mockRejectedValue(new Error("rede"));
    expect(await clienteParaAFicha(ANTIGO, buscar)).toBe(ANTIGO);
    expect(buscar).not.toHaveBeenCalled();
    const c = await clienteParaAFicha(DA_LISTA, buscar);
    const html = htmlDaFichaDaReceita({ ...base, cliente: c });
    expect(html).toContain(CPF_MASCARA);
    expect(html).not.toContain("247.25");
  });
});
