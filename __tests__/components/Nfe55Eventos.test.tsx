// ============================================================
// Cancelar e corrigir texto da NF-e 55 (CP5, 14/11/2026).
//   - regra do prazo: "até amanhã, 15:51 (faltam 23 h)"; vencido some o
//     Cancelar e aparece o texto da devolução
//   - diálogo de cancelar: motivo 15–255, "Manter a nota", erro humano
//   - diálogo da carta: aviso do que não muda, texto 15–1000, envia
// Diálogos do app (sem window.confirm). Mocks de sempre; testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children }: any) => children }));
const mockCancelar = jest.fn();
const mockCarta = jest.fn();
jest.mock("@/services/nfe55Api", () => ({
  nfe55Api: { cancelar: (...a: any[]) => mockCancelar(...a), cartaCorrecao: (...a: any[]) => mockCarta(...a) },
}));

import { AcoesDeEventosNfe } from "@/components/nfe55/EventosNfe";
import { prazoDoCancelamento, justificativaValida, textoDaCartaValido, TEXTO_PRAZO_VENCIDO } from "@/utils/nfe55";

// 14/11/2026 15:51 em São Paulo (18:51 UTC)
const AUTORIZADA = "2026-11-14T18:51:00Z";
const UMA_HORA_DEPOIS = Date.parse("2026-11-14T19:51:00Z");
const NOTA = { id: "em-15", numero: 15, authorized_at: AUTORIZADA, status: "autorizada" };

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const flush = () => new Promise((r) => setTimeout(r, 0));
function montar(p: any = {}) {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<AcoesDeEventosNfe companyId="loja-a" nota={NOTA} agora={UMA_HORA_DEPOIS} {...p} />); });
  return t;
}

beforeEach(() => jest.clearAllMocks());

describe("regra do prazo de cancelamento (24 h)", () => {
  it("dentro do prazo: 'até amanhã, 15:51' e quanto falta", () => {
    const p = prazoDoCancelamento(AUTORIZADA, UMA_HORA_DEPOIS);
    expect(p).toMatchObject({ vencido: false, ateTexto: "até amanhã, 15:51", faltaTexto: "faltam 23 h" });
    expect(prazoDoCancelamento(AUTORIZADA, Date.parse("2026-11-15T18:20:00Z"))).toMatchObject({ ateTexto: "até hoje, 15:51", faltaTexto: "faltam 31 min" });
  });
  it("depois de 24 h: vencido; cancelavel_ate do backend vence o cálculo local", () => {
    expect(prazoDoCancelamento(AUTORIZADA, Date.parse("2026-11-15T18:52:00Z")).vencido).toBe(true);
    const p = prazoDoCancelamento(AUTORIZADA, UMA_HORA_DEPOIS, 24, "2026-11-16T18:51:00Z");
    expect(p.ateTexto).toBe("até 16/11, 15:51");
  });
  it("sem data de autorização: sem prazo", () => {
    expect(prazoDoCancelamento(null)).toMatchObject({ ate: null, vencido: false, ateTexto: "" });
  });
  it("tamanhos: justificativa 15–255, carta 15–1000", () => {
    expect(justificativaValida("curta")).toBe(false);
    expect(justificativaValida("Cliente desistiu da compra")).toBe(true);
    expect(justificativaValida("x".repeat(256))).toBe(false);
    expect(textoDaCartaValido("x".repeat(1000))).toBe(true);
    expect(textoDaCartaValido("x".repeat(1001))).toBe(false);
  });
});

describe("ações da NF-e autorizada", () => {
  it("prazo à vista, 'Corrigir texto' e 'Cancelar'", () => {
    const t = montar();
    expect(texto(porId(t, "nfe-prazo")[0].props.children)).toBe("Pode cancelar até amanhã, 15:51 (faltam 23 h)");
    expect(porId(t, "nfe-corrigir")).toHaveLength(1);
    expect(porId(t, "nfe-cancelar")).toHaveLength(1);
  });

  it("depois do prazo: 'Cancelar' some e aparece o texto da devolução; 'Corrigir texto' segue", () => {
    const t = montar({ agora: Date.parse("2026-11-16T12:00:00Z") });
    expect(porId(t, "nfe-cancelar")).toHaveLength(0);
    expect(porId(t, "nfe-prazo-vencido")).toHaveLength(1);
    expect(texto(t.toJSON())).toContain(TEXTO_PRAZO_VENCIDO);
    expect(porId(t, "nfe-corrigir")).toHaveLength(1);
  });

  it("nota cancelada: nada", () => {
    const t = montar({ nota: { ...NOTA, status: "cancelada" } });
    expect(t.toJSON()).toBeNull();
  });
});

describe("diálogo de cancelar", () => {
  it("abre dentro do app, exige 15 letras, cancela e avisa quem lista", async () => {
    const onMudou = jest.fn();
    const t = montar({ onMudou });
    act(() => { porId(t, "nfe-cancelar")[0].props.onPress(); });
    expect(porId(t, "nfe-cancelar-dialogo")).toHaveLength(1);
    const s = texto(t.toJSON());
    expect(s).toContain("Cancelar a NF-e nº 15?");
    expect(s).toContain("A Sefaz aceita até amanhã, 15:51.");
    expect(s).toContain("Pelo menos 15 letras. Regra da Sefaz.");
    expect(porId(t, "nfe-cancelar-confirmar")[0].props.disabled).toBe(true);
    act(() => { porId(t, "nfe-cancelar-motivo")[0].props.onChangeText("Cliente desistiu da compra antes da entrega"); });
    expect(porId(t, "nfe-cancelar-confirmar")[0].props.disabled).toBe(false);
    mockCancelar.mockResolvedValue({ nfe: { id: "em-15", status: "cancelada" }, evento: { cStat: "135" }, cancelavel_ate: null });
    await act(async () => { porId(t, "nfe-cancelar-confirmar")[0].props.onPress(); await flush(); });
    expect(mockCancelar).toHaveBeenCalledWith("loja-a", "em-15", "Cliente desistiu da compra antes da entrega");
    expect(onMudou).toHaveBeenCalled();
    expect(porId(t, "nfe-cancelar-dialogo")).toHaveLength(0);
  });

  it("recusa da SEFAZ ou prazo: mostra o texto do backend e mantém o diálogo; 'Manter a nota' fecha", async () => {
    const t = montar();
    act(() => { porId(t, "nfe-cancelar")[0].props.onPress(); });
    act(() => { porId(t, "nfe-cancelar-motivo")[0].props.onChangeText("Cliente desistiu da compra antes da entrega"); });
    mockCancelar.mockRejectedValue({ status: 422, data: { code: "NFE_PRAZO_CANCELAMENTO_VENCIDO", error: "Passou o prazo de 24 h para cancelar esta NF-e. Para desfazer, emita uma NF-e de devolução — fale com seu contador." } });
    await act(async () => { porId(t, "nfe-cancelar-confirmar")[0].props.onPress(); await flush(); });
    expect(texto(porId(t, "nfe-cancelar-erro")[0].props.children)).toMatch(/emita uma NF-e de devolução/);
    act(() => { porId(t, "nfe-cancelar-manter")[0].props.onPress(); });
    expect(porId(t, "nfe-cancelar-dialogo")).toHaveLength(0);
  });
});

describe("diálogo da carta de correção", () => {
  it("mostra o que a carta não muda, exige 15 letras e envia", async () => {
    const onMudou = jest.fn();
    const t = montar({ onMudou });
    act(() => { porId(t, "nfe-corrigir")[0].props.onPress(); });
    expect(porId(t, "nfe-carta-dialogo")).toHaveLength(1);
    expect(texto(porId(t, "nfe-carta-aviso")[0].props.children)).toContain("Não muda valor, quantidade, imposto, data nem quem compra");
    expect(texto(t.toJSON())).toContain("Cada nova correção substitui a anterior");
    expect(porId(t, "nfe-carta-enviar")[0].props.disabled).toBe(true);
    act(() => { porId(t, "nfe-carta-texto")[0].props.onChangeText("Onde se lê Sala 3, leia-se Sala 13"); });
    mockCarta.mockResolvedValue({ carta: { seq: 2, texto: "x", protocolo: "p", registrada_em: null }, cartas: [] });
    await act(async () => { porId(t, "nfe-carta-enviar")[0].props.onPress(); await flush(); });
    expect(mockCarta).toHaveBeenCalledWith("loja-a", "em-15", "Onde se lê Sala 3, leia-se Sala 13");
    expect(onMudou).toHaveBeenCalled();
    expect(porId(t, "nfe-carta-dialogo")).toHaveLength(0);
  });

  it("erro da SEFAZ fica no diálogo, em texto humano", async () => {
    const t = montar();
    act(() => { porId(t, "nfe-corrigir")[0].props.onPress(); });
    act(() => { porId(t, "nfe-carta-texto")[0].props.onChangeText("Onde se lê Sala 3, leia-se Sala 13"); });
    mockCarta.mockRejectedValue({ status: 409, data: { code: "CARTA_JA_REGISTRADA", error: "A SEFAZ já tem uma carta de correção com o número 2 para esta nota." } });
    await act(async () => { porId(t, "nfe-carta-enviar")[0].props.onPress(); await flush(); });
    expect(texto(porId(t, "nfe-carta-erro")[0].props.children)).toMatch(/já tem uma carta de correção/);
    expect(porId(t, "nfe-carta-dialogo")).toHaveLength(1);
  });
});
