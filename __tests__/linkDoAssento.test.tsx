// ============================================================
// p-105 (11/11/2026) — para onde vai o link do assento de temporada
//
// Regras puras (utils/linkDoAssento) e a âncora da página Black Friday
// (hooks/useRolarAteASecao): /black-friday#assento, ou ?secao=assento, que
// sobrevive ao login, rola até o cartão do assento.
// O muro (app/_layout) está em linkDoAssentoMuro.test.tsx; o cartão em
// components/AssentoTemporadaCard.test.tsx; o checkout em checkoutNovo.test.tsx.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import {
  SECAO_ASSENTO, ROTA_DO_ASSENTO, ROTA_DO_ASSENTO_COM_LOGIN, ROTA_PLANOS_DO_ASSENTO,
  secaoDoLink, secaoPedida, secaoDaBarraDeEndereco, pedeOAssento, destinoDoAssentoSemAssinatura,
} from "@/utils/linkDoAssento";
import { useRolarAteASecao, TENTATIVAS_DE_ROLAR, INTERVALO_DE_ROLAR_MS } from "@/hooks/useRolarAteASecao";
import { destinoSeguro } from "@/utils/destinoDepoisDoLogin";

describe("rotas do assento", () => {
  it("assinante em dia vai à página Black Friday, na âncora do assento, nunca ao checkout", () => {
    expect(SECAO_ASSENTO).toBe("assento");
    expect(ROTA_DO_ASSENTO).toBe("/black-friday#assento");
    expect(ROTA_DO_ASSENTO).not.toContain("checkout");
  });
  it("'Ver os planos' abre o checkout no Negócio, nunca na Expansão", () => {
    expect(ROTA_PLANOS_DO_ASSENTO).toBe("/(tabs)/checkout?plan=negocio");
    expect(ROTA_PLANOS_DO_ASSENTO).not.toContain("expansao");
  });
  it("o destino do login guarda ?secao=assento, mas não o '#' (por isso a página aceita os dois)", () => {
    expect(destinoSeguro(ROTA_DO_ASSENTO_COM_LOGIN)).toBe("/black-friday?secao=assento");
    expect(destinoSeguro(ROTA_DO_ASSENTO)).toBe("/black-friday");
  });
});

describe("secaoDoLink e secaoPedida", () => {
  it("aceita '#assento', 'assento', maiúsculas e array", () => {
    expect(secaoDoLink("#assento")).toBe("assento");
    expect(secaoDoLink(" ASSENTO ")).toBe("assento");
    expect(secaoDoLink(["assento", "x"])).toBe("assento");
  });
  it("descarta vazio, lixo do router e caracteres fora de [a-z0-9-]", () => {
    expect(secaoDoLink(undefined)).toBeNull();
    expect(secaoDoLink("")).toBeNull();
    expect(secaoDoLink("#")).toBeNull();
    expect(secaoDoLink("undefined")).toBeNull();
    expect(secaoDoLink("<script>")).toBeNull();
    expect(secaoDoLink(42)).toBeNull();
  });
  it("o '#' vence o ?secao=", () => {
    expect(secaoPedida({ hash: "#assento", secao: "outra" })).toBe("assento");
    expect(secaoPedida({ hash: "", secao: "assento" })).toBe("assento");
    expect(secaoPedida({})).toBeNull();
  });
  it("lê a barra de endereço (web)", () => {
    window.history.replaceState({}, "", "/black-friday#assento");
    expect(secaoDaBarraDeEndereco()).toBe("assento");
    window.history.replaceState({}, "", "/black-friday?secao=assento");
    expect(secaoDaBarraDeEndereco()).toBe("assento");
    window.history.replaceState({}, "", "/black-friday");
    expect(secaoDaBarraDeEndereco()).toBeNull();
  });
});

describe("pedeOAssento e o destino de quem não está em dia", () => {
  it("só a página Black Friday com a seção do assento", () => {
    expect(pedeOAssento(["(tabs)", "black-friday"], "assento")).toBe(true);
    expect(pedeOAssento(["(tabs)", "black-friday"], null)).toBe(false);
    expect(pedeOAssento(["(tabs)", "black-friday"], "vale-troca")).toBe(false);
    expect(pedeOAssento(["(tabs)", "estoque"], "assento")).toBe(false);
  });
  it("sem assinatura: checkout com o Negócio e o motivo; em atraso: checkout com o motivo, sem trocar o plano", () => {
    expect(destinoDoAssentoSemAssinatura({ emAtraso: false })).toBe("/(tabs)/checkout?plan=negocio&de=assento");
    expect(destinoDoAssentoSemAssinatura({ emAtraso: true })).toBe("/(tabs)/checkout?de=assento");
  });
});

// ── A âncora: depois que a página monta, rola até #assento ─────────────

function Sonda({ ativo }: { ativo: boolean }) {
  useRolarAteASecao(ativo);
  return null;
}

describe("useRolarAteASecao", () => {
  let rolar: jest.Mock;
  beforeEach(() => {
    jest.useFakeTimers();
    rolar = jest.fn();
    document.body.innerHTML = "";
  });
  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = "";
    window.history.replaceState({}, "", "/");
  });
  function poeSecao(id: string) {
    const el = document.createElement("div");
    el.id = id;
    (el as any).scrollIntoView = rolar;
    document.body.appendChild(el);
  }

  it("#assento: rola até a seção do assento, uma vez", () => {
    window.history.replaceState({}, "", "/black-friday#assento");
    poeSecao("assento");
    let r: renderer.ReactTestRenderer;
    act(() => { r = renderer.create(<Sonda ativo />); });
    act(() => { jest.advanceTimersByTime(INTERVALO_DE_ROLAR_MS * 5); });
    expect(rolar).toHaveBeenCalledTimes(1);
    expect(rolar.mock.calls[0][0]).toEqual(expect.objectContaining({ block: "start" }));
    r!.unmount();
  });

  it("?secao=assento (depois do login) também rola", () => {
    window.history.replaceState({}, "", "/black-friday?secao=assento");
    poeSecao("assento");
    let r: renderer.ReactTestRenderer;
    act(() => { r = renderer.create(<Sonda ativo />); });
    expect(rolar).toHaveBeenCalledTimes(1);
    r!.unmount();
  });

  it("a seção aparece depois (dados chegando): espera e rola quando ela existe", () => {
    window.history.replaceState({}, "", "/black-friday#assento");
    let r: renderer.ReactTestRenderer;
    act(() => { r = renderer.create(<Sonda ativo />); });
    act(() => { jest.advanceTimersByTime(INTERVALO_DE_ROLAR_MS * 3); });
    expect(rolar).not.toHaveBeenCalled();
    poeSecao("assento");
    act(() => { jest.advanceTimersByTime(INTERVALO_DE_ROLAR_MS); });
    expect(rolar).toHaveBeenCalledTimes(1);
    r!.unmount();
  });

  it("antes de a página estar pronta não faz nada", () => {
    window.history.replaceState({}, "", "/black-friday#assento");
    poeSecao("assento");
    let r: renderer.ReactTestRenderer;
    act(() => { r = renderer.create(<Sonda ativo={false} />); });
    act(() => { jest.advanceTimersByTime(INTERVALO_DE_ROLAR_MS * TENTATIVAS_DE_ROLAR); });
    expect(rolar).not.toHaveBeenCalled();
    r!.unmount();
  });

  it("sem âncora no link: não rola e desiste sozinho", () => {
    window.history.replaceState({}, "", "/black-friday");
    poeSecao("assento");
    let r: renderer.ReactTestRenderer;
    act(() => { r = renderer.create(<Sonda ativo />); });
    act(() => { jest.advanceTimersByTime(INTERVALO_DE_ROLAR_MS * (TENTATIVAS_DE_ROLAR + 5)); });
    expect(rolar).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    r!.unmount();
  });
});
