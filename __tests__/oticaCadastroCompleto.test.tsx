// ============================================================
// Ótica · cadastro completo do cliente (23/11/2026)
//
//   - regras puras: CPF (dígito verificador), nascimento sem ano, idade, o
//     que falta no cadastro, o que o servidor avisa aceitar;
//   - corpo do POST/PATCH: sem o bloco, o corpo é o de sempre; com ele, só
//     vai o que foi mexido;
//   - AddCustomerForm SEM a ótica: os mesmos campos e o mesmo objeto salvo
//     de antes (nenhuma loja fora da ótica muda);
//   - AddCustomerForm COM a ótica: bloco "Dados completos", CPF errado não
//     salva, aniversário sem ano avisa e não trava, RG/sexo/profissão só
//     com o aviso do servidor.
// ============================================================
jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true] }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
const mockToastError = jest.fn();
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), info: jest.fn(), error: (...a: any[]) => mockToastError(...a) } }));
jest.mock("@/components/endereco/SecaoEndereco", () => ({ SecaoEndereco: () => null }));
// hooks/useCustomers só entra pelas funções puras do corpo do POST/PATCH.
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({}) }));
jest.mock("@/services/api", () => ({ companiesApi: {}, ApiError: class ApiError extends Error {}, request: jest.fn() }));
jest.mock("@/services/meAggregates", () => ({ meAggregatesApi: {} }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn(), useMutation: jest.fn(), useQueryClient: jest.fn() }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import {
  avisoDoNascimento, camposExtrasAceitos, cpfParaApi, erroDoCpf, faltasDoClienteParaOtica,
  formatarDocumento, idadeEmAnos, situacaoDoNascimento,
} from "@/utils/clienteDadosCompletos";
import { corpoDaEdicaoDoCliente, corpoDoNovoCliente, corpoDosDadosCompletos } from "@/hooks/useCustomers";
import { AddCustomerForm } from "@/components/screens/clientes/AddCustomerForm";
import type { Customer } from "@/components/screens/clientes/types";

const HOJE = new Date(2026, 10, 23, 12); // 23/11/2026
const CPF_OK = "529.982.247-25";

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const comTexto = (t: renderer.ReactTestRenderer, s: string) => texto(t.toJSON()).includes(s);
const porPlaceholder = (t: renderer.ReactTestRenderer, p: string) => t.root.findAll((n) => n.props && n.props.placeholder === p && n.props.onChangeText, { deep: false })[0];
/** Texto de uma instância já montada (os filhos são instâncias ou strings). */
function textoDe(n: any): string {
  if (typeof n === "string") return n;
  return (n?.children || []).map(textoDe).join("");
}
const botao = (t: renderer.ReactTestRenderer, rotulo: string) => t.root.findAll((n) => !!n.props?.onPress && textoDe(n) === rotulo)[0];

const CLIENTE: Customer = {
  id: "c1", name: "Marina Prado", email: "", phone: "(12) 99812-4410", instagram: "", birthday: "14/03/1968",
  lastPurchase: "---", totalSpent: 0, visits: 0, firstVisit: "01/01/2026", notes: "", rating: null, creditBalance: 0,
  cpf: "52998224725", rg: "", gender: "", occupation: "",
};

beforeEach(() => mockToastError.mockClear());

describe("CPF do cliente", () => {
  it("vazio é válido: o campo é opcional", () => {
    expect(erroDoCpf("")).toBeNull();
    expect(erroDoCpf(null)).toBeNull();
    expect(cpfParaApi("")).toBeNull();
  });
  it("confere o dígito verificador", () => {
    expect(erroDoCpf(CPF_OK)).toBeNull();
    expect(erroDoCpf("52998224725")).toBeNull();
    expect(erroDoCpf("529.982.247-26")).toMatch(/não confere/);
    expect(erroDoCpf("111.111.111-11")).toMatch(/não confere/);
  });
  it("incompleto avisa quantos números são", () => {
    expect(erroDoCpf("529.982")).toMatch(/11 números/);
  });
  it("CNPJ que já estava no cadastro continua aceito", () => {
    expect(erroDoCpf("11.222.333/0001-81")).toBeNull();
    expect(erroDoCpf("11.222.333/0001-82")).toMatch(/CNPJ não confere/);
  });
  it("vai para a API só com números e volta com máscara", () => {
    expect(cpfParaApi(CPF_OK)).toBe("52998224725");
    expect(formatarDocumento("52998224725")).toBe(CPF_OK);
    expect(formatarDocumento("")).toBe("");
  });
});

describe("Nascimento e idade", () => {
  it("separa vazio, digitando, sem ano, futuro e completo", () => {
    expect(situacaoDoNascimento("", HOJE)).toBe("vazio");
    expect(situacaoDoNascimento("14/0", HOJE)).toBe("incompleto");
    expect(situacaoDoNascimento("14/03", HOJE)).toBe("sem_ano");
    expect(situacaoDoNascimento("14/03/1904", HOJE)).toBe("sem_ano");
    expect(situacaoDoNascimento("31/02/1990", HOJE)).toBe("invalido");
    expect(situacaoDoNascimento("14/03/2030", HOJE)).toBe("futuro");
    expect(situacaoDoNascimento("14/03/1968", HOJE)).toBe("ok");
  });
  it("avisa com clareza quando vem sem ano, e não avisa quando está completo", () => {
    expect(avisoDoNascimento("14/03", HOJE)).toMatch(/Sem o ano não dá para saber a idade/);
    expect(avisoDoNascimento("14/03/1904", HOJE)).toMatch(/Sem o ano/);
    expect(avisoDoNascimento("14/03/2030", HOJE)).toMatch(/futuro/);
    expect(avisoDoNascimento("14/03/1968", HOJE)).toBeNull();
    expect(avisoDoNascimento("", HOJE)).toBeNull();
  });
  it("idade em anos completos; sem ano não tem idade", () => {
    expect(idadeEmAnos("14/03/1968", HOJE)).toBe(58);
    expect(idadeEmAnos("24/11/1968", HOJE)).toBe(57); // faz aniversário amanhã
    expect(idadeEmAnos("23/11/1968", HOJE)).toBe(58); // faz hoje
    expect(idadeEmAnos("14/03", HOJE)).toBeNull();
    expect(idadeEmAnos("14/03/1904", HOJE)).toBeNull();
  });
  it("lista o que falta sem inventar obrigatoriedade", () => {
    expect(faltasDoClienteParaOtica({ cpf: "", birthday: "", phone: "" }, HOJE)).toEqual(["CPF", "data de nascimento", "telefone"]);
    expect(faltasDoClienteParaOtica({ cpf: "52998224725", birthday: "14/03", phone: "12998124410" }, HOJE)).toEqual(["ano de nascimento"]);
    expect(faltasDoClienteParaOtica({ cpf: "52998224725", birthday: "14/03/1968", phone: "12998124410" }, HOJE)).toEqual([]);
    expect(faltasDoClienteParaOtica(null, HOJE)).toEqual([]);
  });
});

describe("O que o servidor aceita", () => {
  it("sem customer_fields, nenhum campo extra", () => {
    expect(camposExtrasAceitos({ customers: [] })).toEqual([]);
    expect(camposExtrasAceitos(undefined)).toEqual([]);
    expect(camposExtrasAceitos({ customer_fields: "rg" })).toEqual([]);
  });
  it("só os campos conhecidos que vieram no aviso", () => {
    expect(camposExtrasAceitos({ customer_fields: ["rg", "occupation", "qualquer"] })).toEqual(["rg", "occupation"]);
  });
});

describe("Corpo do POST e do PATCH", () => {
  it("sem o bloco, o corpo da edição é exatamente o de sempre", () => {
    const corpo = corpoDaEdicaoDoCliente({ ...CLIENTE, dadosCompletos: undefined });
    expect(Object.keys(corpo).sort()).toEqual(["birth_date", "email", "instagram_handle", "name", "notes", "phone"]);
    expect(corpo).not.toHaveProperty("cpf_cnpj");
  });
  it("o que veio do servidor (cpf, rg…) nunca é reenviado sozinho", () => {
    expect(corpoDosDadosCompletos(CLIENTE)).toEqual({});
  });
  it("com o bloco, só vai o que foi mexido; vazio apaga na edição", () => {
    expect(corpoDosDadosCompletos({ dadosCompletos: {} })).toEqual({});
    expect(corpoDosDadosCompletos({ dadosCompletos: { cpf: CPF_OK } })).toEqual({ cpf_cnpj: "52998224725" });
    expect(corpoDosDadosCompletos({ dadosCompletos: { cpf: "", rg: " 32.118 ", gender: "F", occupation: "" } }))
      .toEqual({ cpf_cnpj: null, rg: "32.118", gender: "F", occupation: null });
  });
  it("no cadastro novo, o corpo sem o bloco é o de sempre e vazio não vai", () => {
    const base = corpoDoNovoCliente({ ...CLIENTE, dadosCompletos: undefined });
    expect(Object.keys(base).sort()).toEqual(["birth_date", "email", "instagram_handle", "name", "notes", "phone"]);
    expect(base.birth_date).toBe("1968-03-14");
    const novo = corpoDoNovoCliente({ ...CLIENTE, dadosCompletos: { cpf: CPF_OK, rg: "" } }) as any;
    expect(novo.cpf_cnpj).toBe("52998224725");
    expect(novo).not.toHaveProperty("rg");
  });
});

describe("AddCustomerForm sem a ótica ligada: idêntico ao de sempre", () => {
  function montar(props: any = {}) {
    const onSave = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<AddCustomerForm onSave={onSave} onCancel={jest.fn()} {...props} />); });
    return { t, onSave };
  }

  it("não mostra CPF, bloco, aviso nem idade, e o rótulo do aniversário não muda", () => {
    const { t } = montar();
    expect(porId(t, "cliente-dados-completos")).toHaveLength(0);
    expect(porId(t, "cliente-cpf")).toHaveLength(0);
    expect(porId(t, "cliente-nascimento-aviso")).toHaveLength(0);
    expect(porId(t, "cliente-idade")).toHaveLength(0);
    expect(comTexto(t, "Aniversário (DD/MM ou DD/MM/AAAA)")).toBe(true);
    expect(comTexto(t, "Data de nascimento")).toBe(false);
    expect(comTexto(t, "Dados completos")).toBe(false);
  });

  it("aniversário sem ano não gera aviso fora da ótica", () => {
    const { t } = montar();
    act(() => { porPlaceholder(t, "15/06/1990").props.onChangeText("14/03"); });
    expect(porId(t, "cliente-nascimento-aviso")).toHaveLength(0);
  });

  it("salva o mesmo objeto de antes, sem dadosCompletos", () => {
    const { t, onSave } = montar({ initialData: CLIENTE });
    act(() => { botao(t, "Salvar alterações").props.onPress(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    const salvo = onSave.mock.calls[0][0];
    expect(salvo).not.toHaveProperty("dadosCompletos");
    expect(Object.keys(salvo).sort()).toEqual([
      "birthday", "creditBalance", "email", "endereco", "firstVisit", "id", "instagram",
      "lastPurchase", "name", "notes", "phone", "rating", "totalSpent", "visits",
    ]);
    // …e o PATCH que sai disso não leva documento.
    expect(corpoDaEdicaoDoCliente(salvo)).not.toHaveProperty("cpf_cnpj");
  });

  it("os mesmos campos de texto, na mesma ordem, com e sem dadosCompletos={false}", () => {
    const campos = (t: renderer.ReactTestRenderer) => t.root.findAll((n) => !!n.props?.onChangeText && typeof n.type !== "string", { deep: false }).map((n) => n.props.placeholder);
    const esperado = ["Ex: Maria da Silva", "(12) 99999-0000", "email@email.com", "@usuario", "15/06/1990", "Preferências, alergias..."];
    expect(campos(montar().t)).toEqual(esperado);
    expect(campos(montar({ dadosCompletos: false }).t)).toEqual(esperado);
  });
});

describe("AddCustomerForm com a ótica ligada", () => {
  function montar(props: any = {}) {
    const onSave = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<AddCustomerForm onSave={onSave} onCancel={jest.fn()} dadosCompletos {...props} />); });
    return { t, onSave };
  }
  const campo = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && !!n.props.onChangeText, { deep: false })[0];

  it("mostra o bloco com CPF; RG, sexo e profissão ficam fora sem o aviso do servidor", () => {
    const { t } = montar();
    expect(porId(t, "cliente-dados-completos").length).toBeGreaterThan(0);
    expect(campo(t, "cliente-cpf")).toBeTruthy();
    expect(porId(t, "cliente-rg")).toHaveLength(0);
    expect(porId(t, "cliente-sexo-F")).toHaveLength(0);
    expect(porId(t, "cliente-profissao")).toHaveLength(0);
    expect(comTexto(t, "Data de nascimento (DD/MM/AAAA)")).toBe(true);
  });

  it("com o aviso do servidor, RG, sexo e profissão aparecem e são gravados", () => {
    const { t, onSave } = montar({ initialData: CLIENTE, camposExtras: ["rg", "gender", "occupation"] });
    act(() => { campo(t, "cliente-rg").props.onChangeText("32.118.404-7"); });
    act(() => { t.root.findAll((n) => n.props?.testID === "cliente-sexo-F" && !!n.props.onPress, { deep: false })[0].props.onPress(); });
    act(() => { botao(t, "Salvar alterações").props.onPress(); });
    // CPF não foi mexido: não é reenviado.
    expect(onSave.mock.calls[0][0].dadosCompletos).toEqual({ rg: "32.118.404-7", gender: "F" });
  });

  it("CPF com dígito errado mostra o erro e não salva", () => {
    const { t, onSave } = montar();
    act(() => { porPlaceholder(t, "Ex: Maria da Silva").props.onChangeText("Marina"); });
    act(() => { campo(t, "cliente-cpf").props.onChangeText("529.982.247-26"); });
    expect(textoDe(porId(t, "cliente-cpf-erro")[0])).toMatch(/não confere/);
    act(() => { botao(t, "Salvar cliente").props.onPress(); });
    expect(onSave).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/não confere/));
  });

  it("CPF certo salva só com o que foi mexido; cliente sem CPF salva normalmente", () => {
    const a = montar();
    act(() => { porPlaceholder(a.t, "Ex: Maria da Silva").props.onChangeText("Marina"); });
    act(() => { campo(a.t, "cliente-cpf").props.onChangeText(CPF_OK); });
    expect(porId(a.t, "cliente-cpf-ok").length).toBeGreaterThan(0);
    act(() => { botao(a.t, "Salvar cliente").props.onPress(); });
    expect(a.onSave.mock.calls[0][0].dadosCompletos).toEqual({ cpf: "52998224725" });

    const b = montar();
    act(() => { porPlaceholder(b.t, "Ex: Maria da Silva").props.onChangeText("João"); });
    act(() => { botao(b.t, "Salvar cliente").props.onPress(); });
    expect(b.onSave).toHaveBeenCalledTimes(1);
    expect(b.onSave.mock.calls[0][0].dadosCompletos).toEqual({});
  });

  it("documento antigo fora do padrão não trava a edição do nome", () => {
    const { t, onSave } = montar({ initialData: { ...CLIENTE, cpf: "12345678900" } });
    act(() => { porPlaceholder(t, "Ex: Maria da Silva").props.onChangeText("Marina A. Prado"); });
    act(() => { botao(t, "Salvar alterações").props.onPress(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].dadosCompletos).toEqual({});
  });

  it("aniversário sem ano avisa em âmbar e deixa salvar", () => {
    const { t, onSave } = montar();
    act(() => { porPlaceholder(t, "Ex: Maria da Silva").props.onChangeText("Marina"); });
    act(() => { campo(t, "cliente-nascimento").props.onChangeText("14/03"); });
    expect(textoDe(porId(t, "cliente-nascimento-aviso")[0])).toMatch(/Sem o ano não dá para saber a idade/);
    expect(porId(t, "cliente-idade")).toHaveLength(0);
    act(() => { botao(t, "Salvar cliente").props.onPress(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    // Sem ano grava 1904 (o "sem ano" das importações), não 2000: senão o
    // cadastro voltaria com "26 anos" e sem aviso.
    expect(onSave.mock.calls[0][0].birthday).toBe("14/03/1904");
    expect(corpoDoNovoCliente(onSave.mock.calls[0][0]).birth_date).toBe("1904-03-14");
  });

  it("fora da ótica, aniversário sem ano segue indo como sempre foi (2000)", () => {
    const onSave = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<AddCustomerForm onSave={onSave} onCancel={jest.fn()} />); });
    act(() => { porPlaceholder(t, "Ex: Maria da Silva").props.onChangeText("Marina"); });
    act(() => { porPlaceholder(t, "15/06/1990").props.onChangeText("14/03"); });
    act(() => { botao(t, "Salvar cliente").props.onPress(); });
    expect(onSave.mock.calls[0][0].birthday).toBe("14/03");
    expect(corpoDoNovoCliente(onSave.mock.calls[0][0]).birth_date).toBe("2000-03-14");
  });

  it("com o ano, mostra a idade e some o aviso", () => {
    const { t } = montar({ initialData: CLIENTE });
    expect(porId(t, "cliente-nascimento-aviso")).toHaveLength(0);
    expect(porId(t, "cliente-idade").length).toBeGreaterThan(0);
  });

  it("cadastro importado com o ano 1904 recebe o mesmo aviso, sem mostrar 1904 no campo", () => {
    const onEditou = jest.fn();
    const { t, onSave } = montar({ initialData: { ...CLIENTE, birthday: "14/03/1904" }, onEditou });
    expect(porId(t, "cliente-nascimento-aviso").length).toBeGreaterThan(0);
    expect(campo(t, "cliente-nascimento").props.value).toBe("14/03");
    // Abrir não conta como "mexeu", e salvar sem mexer não muda a data.
    expect(onEditou).not.toHaveBeenCalled();
    act(() => { botao(t, "Salvar alterações").props.onPress(); });
    expect(onSave.mock.calls[0][0].birthday).toBe("14/03/1904");
  });
});
