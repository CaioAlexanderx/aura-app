// ============================================================
// Ótica · editar receita, imprimir a ficha e a foto do papel (23/11/2026)
//
//   - a janela da receita abre preenchida e grava pelo PATCH (não cria outra);
//   - receita nova continua indo pelo POST, com o cliente;
//   - a ficha em A4 leva cliente, CPF com máscara, idade e a grade — e nunca
//     o ano de enfeite de quem não tem ano, nem HTML digitado pelo usuário;
//   - a foto do papel só aparece quando o servidor avisa que guarda o arquivo.
// ============================================================
jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true] }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
const mockToastError = jest.fn();
const mockToastOk = jest.fn();
jest.mock("@/components/Toast", () => ({ toast: { success: (...a: any[]) => mockToastOk(...a), info: jest.fn(), error: (...a: any[]) => mockToastError(...a) } }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: ({ children }: any) => children }));
jest.mock("@/components/otica/CadastroDoClienteOtica", () => ({ CadastroDoClienteOtica: () => null }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "otica-1" } }) }));
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ customers: [{ id: "cli-1", name: "Marina Prado", phone: "(12) 99812-4410" }] }),
}));
const mockInvalidate = jest.fn();
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidate }) }));
const mockPatch = jest.fn((..._a: any[]) => Promise.resolve({ prescription: {} }));
const mockCreate = jest.fn((..._a: any[]) => Promise.resolve({ prescription: {} }));
jest.mock("@/services/oticaApi", () => {
  const real = jest.requireActual("@/services/oticaApi");
  return { ...real, oticaApi: { ...real.oticaApi, patchPrescription: (...a: any[]) => mockPatch(...a), createPrescription: (...a: any[]) => mockCreate(...a) } };
});

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ReceitaSheet } from "@/components/otica/ReceitaSheet";
import { FotoDaReceita, erroDaFoto } from "@/components/otica/FotoDaReceita";
import { rxDraftFromPrescription, rxDraftToBody, validateRxDraft } from "@/components/otica/RxEditor";
import { htmlDaFichaDaReceita } from "@/services/oticaPrint";
import type { Prescription } from "@/services/oticaApi";

const RECEITA: Prescription = {
  id: "rx-1", customer_id: "cli-1", customer_name: "Marina Prado",
  od_sph: -1.75, od_cyl: -0.5, od_axis: 180, od_add: 2, od_prism: null, od_base: null,
  oe_sph: -2, oe_cyl: null, oe_axis: null, oe_add: 2, oe_prism: null, oe_base: null,
  od_pd: 31.5, oe_pd: 32, od_height: 18, oe_height: 18,
  prescriber_type: "medico", prescriber_name: "Dra. Ana Lima", prescriber_registry: "12345/SP",
  issued_at: "2026-11-02", valid_until: "2027-11-02", notes: "uso ocupacional",
};

function textoDe(n: any): string {
  if (typeof n === "string") return n;
  return (n?.children || []).map(textoDe).join("");
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const acao = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && (!!n.props.onPress || !!n.props.onChangeText), { deep: false })[0];

beforeEach(() => { mockPatch.mockClear(); mockCreate.mockClear(); mockToastError.mockClear(); mockToastOk.mockClear(); mockInvalidate.mockClear(); });

describe("Rascunho da receita", () => {
  it("vai e volta sem perder grau, prescritor, datas nem observação", () => {
    const d = rxDraftFromPrescription(RECEITA);
    expect(d.issued_at).toBe("02/11/2026");
    expect(d.valid_until).toBe("02/11/2027");
    expect(validateRxDraft(d)).toBeNull();
    expect(rxDraftToBody(d)).toEqual({
      od_sph: -1.75, od_cyl: -0.5, od_axis: 180, od_add: 2, od_prism: null, od_base: null,
      oe_sph: -2, oe_cyl: null, oe_axis: null, oe_add: 2, oe_prism: null, oe_base: null,
      od_pd: 31.5, oe_pd: 32, od_height: 18, oe_height: 18,
      prescriber_type: "medico", prescriber_name: "Dra. Ana Lima", prescriber_registry: "12345/SP",
      issued_at: "2026-11-02", valid_until: "2027-11-02", notes: "uso ocupacional",
    });
  });
  it("o corpo não tem nada de comissão nem de repasse ao prescritor", () => {
    const chaves = Object.keys(rxDraftToBody(rxDraftFromPrescription(RECEITA))).join(" ");
    expect(chaves).not.toMatch(/comiss|commission|repasse|payout/i);
  });
});

describe("Janela da receita", () => {
  function montar(props: any) {
    let t!: renderer.ReactTestRenderer;
    const onClose = jest.fn();
    act(() => { t = renderer.create(<ReceitaSheet visible onClose={onClose} validityMonths={12} {...props} />); });
    return { t, onClose };
  }

  it("fechada, não monta nada", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<ReceitaSheet visible={false} onClose={jest.fn()} validityMonths={12} />); });
    expect(t.toJSON()).toBeNull();
  });

  it("editar: abre preenchida, avisa sobre as OS já abertas e grava pelo PATCH", async () => {
    const { t, onClose } = montar({ editing: RECEITA });
    expect(textoDe(porId(t, "otica-rx-sheet-titulo")[0])).toMatch(/^Editar receita/);
    expect(porId(t, "otica-rx-aviso-edicao").length).toBeGreaterThan(0);
    // O cliente da receita não muda na edição.
    expect(porId(t, "otica-rx-trocar-cliente")).toHaveLength(0);
    expect(acao(t, "otica-rx-form-nome").props.value).toBe("Dra. Ana Lima");
    expect(acao(t, "otica-rx-form-emissao").props.value).toBe("02/11/2026");

    act(() => { acao(t, "otica-rx-form-nome").props.onChangeText("Dra. Ana C. Lima"); });
    act(() => { acao(t, "otica-rx-form-validade").props.onChangeText("02052027"); }); // a máscara põe as barras
    await act(async () => { await acao(t, "otica-rx-salvar").props.onPress(); });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPatch).toHaveBeenCalledTimes(1);
    const [cid, rxId, body] = mockPatch.mock.calls[0];
    expect(cid).toBe("otica-1");
    expect(rxId).toBe("rx-1");
    expect(body.prescriber_name).toBe("Dra. Ana C. Lima");
    expect(body.valid_until).toBe("2027-05-02");
    expect(body.od_sph).toBe(-1.75);
    expect(body).not.toHaveProperty("customer_id");
    expect(mockToastOk).toHaveBeenCalledWith("Receita atualizada");
    expect(onClose).toHaveBeenCalled();
  });

  it("editar com validade antes da emissão não grava", async () => {
    const { t, onClose } = montar({ editing: RECEITA });
    act(() => { acao(t, "otica-rx-form-validade").props.onChangeText("01/01/2026"); });
    await act(async () => { await acao(t, "otica-rx-salvar").props.onPress(); });
    expect(mockPatch).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/validade não pode ser anterior/));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("erro do servidor deixa a janela aberta com o que foi digitado", async () => {
    mockPatch.mockImplementationOnce(() => Promise.reject({ data: { error: "Receita nao encontrada" } }));
    const { t, onClose } = montar({ editing: RECEITA });
    await act(async () => { await acao(t, "otica-rx-salvar").props.onPress(); });
    expect(mockToastError).toHaveBeenCalledWith("Receita nao encontrada");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("nova: sem cliente não salva; com cliente vai pelo POST", async () => {
    const { t } = montar({});
    expect(textoDe(porId(t, "otica-rx-sheet-titulo")[0])).toMatch(/^Nova receita/);
    expect(porId(t, "otica-rx-aviso-edicao")).toHaveLength(0);
    expect(porId(t, "otica-rx-cadastrar-cliente").length).toBeGreaterThan(0);
    await act(async () => { await acao(t, "otica-rx-salvar").props.onPress(); });
    expect(mockToastError).toHaveBeenCalledWith("Escolha o cliente da receita");

    act(() => { acao(t, "otica-rx-busca-cliente").props.onChangeText("(12) 99812"); }); // acha pelo telefone com máscara
    act(() => { acao(t, "otica-rx-cliente-cli-1").props.onPress(); });
    act(() => { acao(t, "otica-rx-form-grid-od-sph").props.onChangeText("-1,8"); });
    act(() => { acao(t, "otica-rx-form-grid-od-sph").props.onBlur(); });
    await act(async () => { await acao(t, "otica-rx-salvar").props.onPress(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][1]).toMatchObject({ customer_id: "cli-1", od_sph: -1.75, prescriber_type: "medico" });
    expect(mockPatch).not.toHaveBeenCalled();
  });
});

describe("Ficha da receita em A4", () => {
  const base = {
    loja: { nome: "Ótica Bela Vista", documento: "CNPJ 12.345.678/0001-90" },
    settings: { rt_name: "João Martins", rt_registry: "4471", sanitary_license: "2026/0312" },
    receita: RECEITA,
    hoje: "2026-11-23",
  };

  it("leva loja, cliente, CPF com máscara, idade, grade e prescritor", () => {
    const html = htmlDaFichaDaReceita({ ...base, cliente: { name: "Marina Prado", cpf: "52998224725", birthday: "14/03/1968", phone: "(12) 99812-4410" } });
    expect(html).toContain("Ótica Bela Vista");
    expect(html).toContain("Óptico responsável: João Martins · registro 4471 · licença sanitária 2026/0312");
    expect(html).toContain("529.982.247-25");
    expect(html).toContain("14/03/1968 · 58 anos");
    expect(html).toContain("−1,75");
    expect(html).toContain("180°");
    expect(html).toContain("Dra. Ana Lima");
    expect(html).toContain("Médico (CRM) · 12345/SP");
    expect(html).toContain("02/11/2026 · 02/11/2027");
    expect(html).toContain("@page { size: A4");
  });

  it("sem cadastro, sai com o nome da receita e sem campos vazios", () => {
    const html = htmlDaFichaDaReceita({ ...base, cliente: null });
    expect(html).toContain("Marina Prado");
    expect(html).not.toContain("<span>CPF</span>");
    expect(html).not.toContain("<span>Nascimento</span>");
  });

  it("aniversário sem ano sai só com dia e mês: o ano de enfeite não vai para o papel", () => {
    const html = htmlDaFichaDaReceita({ ...base, cliente: { name: "Marina Prado", birthday: "14/03/1904" } });
    expect(html).toContain("<span>Nascimento</span>14/03</div>");
    expect(html).not.toContain("1904");
  });

  it("texto digitado nunca vira HTML", () => {
    const html = htmlDaFichaDaReceita({ ...base, cliente: { name: "<script>alert(1)</script>" }, receita: { ...RECEITA, notes: "<img src=x onerror=alert(1)>" } });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("não recomenda lente nem fala de comissão", () => {
    const html = htmlDaFichaDaReceita({ ...base, cliente: null });
    expect(html).not.toMatch(/recomend|comiss|repasse/i);
  });
});

describe("Foto do papel da receita", () => {
  function montar(disponivel: boolean, receita: Prescription = RECEITA, podeEditar = true) {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<FotoDaReceita companyId="otica-1" receita={receita} disponivel={disponivel} podeEditar={podeEditar} onChanged={jest.fn()} />); });
    return t;
  }
  it("sem o aviso do servidor, não desenha nada", () => {
    expect(montar(false).toJSON()).toBeNull();
    expect(montar(false, { ...RECEITA, photo_url: "https://x/y.jpg" }).toJSON()).toBeNull();
  });
  it("com o aviso, oferece anexar; com foto, ver, trocar e remover", () => {
    const sem = montar(true);
    expect(porId(sem, "otica-rx-foto-anexar-rx-1").length).toBeGreaterThan(0);
    expect(porId(sem, "otica-rx-foto-ver-rx-1")).toHaveLength(0);
    const com = montar(true, { ...RECEITA, photo_url: "https://x/y.jpg" });
    expect(porId(com, "otica-rx-foto-ver-rx-1").length).toBeGreaterThan(0);
    expect(porId(com, "otica-rx-foto-remover-rx-1").length).toBeGreaterThan(0);
  });
  it("loja com a ótica desligada só vê a foto que existe", () => {
    expect(montar(true, RECEITA, false).toJSON()).toBeNull();
    const com = montar(true, { ...RECEITA, photo_url: "https://x/y.jpg" }, false);
    expect(porId(com, "otica-rx-foto-ver-rx-1").length).toBeGreaterThan(0);
    expect(porId(com, "otica-rx-foto-anexar-rx-1")).toHaveLength(0);
  });
  it("recusa arquivo que não é foto ou passa de 5 MB", () => {
    expect(erroDaFoto({ size: 1000, type: "application/pdf" })).toMatch(/JPEG, PNG ou WebP/);
    expect(erroDaFoto({ size: 6 * 1024 * 1024, type: "image/jpeg" })).toMatch(/5 MB/);
    expect(erroDaFoto({ size: 1000, type: "image/png" })).toBeNull();
  });
});
