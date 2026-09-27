// ============================================================
// QA 27/09 · o voltar do navegador dentro de uma tela
//
// Regras de historicoDaVitrine.ts (a etapa do checkout e as camadas da
// peça no history.state, com o mesmo endereço) e o rascunho do checkout
// na aba (dadosLembrados.ts).
// ============================================================
import React, { useState } from "react";
import { Pressable, Text } from "react-native";
import { render, fireEvent, waitFor, act, configure } from "@testing-library/react-native";

configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);
import {
  etapaDoEstado, estadoComEtapa, etapaAoAbrir, etapaPossivel, camadaDoEstado, estadoComCamada,
  useCamadaNoHistorico, MARCA_DA_ETAPA, MARCA_DA_CAMADA,
} from "@/components/studio/storefront/historicoDaVitrine";
import {
  lerRascunhoDoCheckout, guardarRascunhoDoCheckout, esquecerRascunhoDoCheckout, chaveDoRascunho,
  lerDadosLembrados, guardarDadosLembrados, type RascunhoDoCheckout,
} from "@/components/studio/storefront/dadosLembrados";
import { chaveDaAba } from "@/components/studio/storefront/chaveVitrineV2";

describe("a etapa no history.state", () => {
  test("a marca vai ao lado do id do roteador, sem apagar nada", () => {
    const e = estadoComEtapa({ id: "abc", __outro: 1 }, 2);
    expect(e).toEqual({ id: "abc", __outro: 1, [MARCA_DA_ETAPA]: 2 });
    expect(etapaDoEstado(e)).toBe(2);
    expect(etapaDoEstado({ id: "abc" })).toBeNull();
    expect(etapaDoEstado(null)).toBeNull();
    expect(etapaDoEstado({ [MARCA_DA_ETAPA]: 7 })).toBeNull();
    expect(estadoComEtapa(null, 3)).toEqual({ [MARCA_DA_ETAPA]: 3 });
  });

  test("a camada idem", () => {
    const c = estadoComCamada({ id: "x" }, "zoom-da-foto");
    expect(c).toEqual({ id: "x", [MARCA_DA_CAMADA]: "zoom-da-foto" });
    expect(camadaDoEstado(c)).toBe("zoom-da-foto");
    expect(camadaDoEstado({ id: "x" })).toBeNull();
  });
});

describe("a etapa em que o checkout abre", () => {
  const ok = { faltaNosDados: false, faltaNaEntrega: false };
  test("a entrada do histórico manda (voltar e avançar)", () => {
    expect(etapaAoAbrir({ doHistorico: 3, doRascunho: 1, recarregou: false, ...ok })).toBe(3);
    expect(etapaAoAbrir({ doHistorico: 2, doRascunho: 3, recarregou: true, ...ok })).toBe(2);
  });
  test("sem marca: o F5 volta à etapa do rascunho; entrada nova começa na 1", () => {
    expect(etapaAoAbrir({ doHistorico: null, doRascunho: 3, recarregou: true, ...ok })).toBe(3);
    expect(etapaAoAbrir({ doHistorico: null, doRascunho: 3, recarregou: false, ...ok })).toBe(1);
    expect(etapaAoAbrir({ doHistorico: null, doRascunho: null, recarregou: true, ...ok })).toBe(1);
  });
  test("nunca pula dado que falta", () => {
    expect(etapaAoAbrir({ doHistorico: 3, recarregou: false, faltaNosDados: true, faltaNaEntrega: false })).toBe(1);
    expect(etapaAoAbrir({ doHistorico: 3, recarregou: false, faltaNosDados: false, faltaNaEntrega: true })).toBe(2);
    expect(etapaPossivel(2, false, true)).toBe(2);
    expect(etapaPossivel(1, true, true)).toBe(1);
  });
});

describe("o rascunho do checkout na aba", () => {
  const rascunho: RascunhoDoCheckout = {
    etapa: 2,
    dados: {
      name: "Helena Martins", phone: "(12) 99183-4410", email: "", customer_cpf_cnpj: "529.982.247-25",
      address_zip: "", address_street: "", address_number: "", address_complement: "",
      address_neighborhood: "", address_city: "", address_state: "",
      quer_documento: true, entrega: "pickup", courier_name: "", courier_plate: "", courier_depois: false, notes: "",
    },
  };
  beforeEach(() => { window.sessionStorage.clear(); window.localStorage.clear(); });

  test("guarda, lê e esquece por loja", () => {
    guardarRascunhoDoCheckout("Aura-QA", rascunho, window.sessionStorage);
    expect(window.sessionStorage.getItem(chaveDoRascunho("aura-qa"))).not.toBeNull();
    expect(lerRascunhoDoCheckout("aura-qa", window.sessionStorage)).toEqual(rascunho);
    expect(lerRascunhoDoCheckout("outra-loja", window.sessionStorage)).toBeNull();
    esquecerRascunhoDoCheckout("aura-qa", window.sessionStorage);
    expect(lerRascunhoDoCheckout("aura-qa", window.sessionStorage)).toBeNull();
  });

  test("lixo não quebra: etapa e entrega desconhecidas viram as seguras", () => {
    window.sessionStorage.setItem(chaveDoRascunho("x"), "{nao e json");
    expect(lerRascunhoDoCheckout("x", window.sessionStorage)).toBeNull();
    window.sessionStorage.setItem(chaveDoRascunho("x"), JSON.stringify({ etapa: 9, dados: { name: 5, entrega: "drone" } }));
    expect(lerRascunhoDoCheckout("x", window.sessionStorage)).toMatchObject({ etapa: 1, dados: { name: "5", entrega: null } });
    expect(lerRascunhoDoCheckout("x", null)).toBeNull();
  });

  test("não mexe nos dados lembrados nem na chave do ?v2= da aba", () => {
    window.sessionStorage.setItem(chaveDaAba("aura-qa"), "1");
    guardarDadosLembrados("aura-qa", { ...rascunho.dados, request_nfce: true }, window.localStorage, 1000);
    guardarRascunhoDoCheckout("aura-qa", rascunho, window.sessionStorage);
    esquecerRascunhoDoCheckout("aura-qa", window.sessionStorage);
    expect(window.sessionStorage.getItem(chaveDaAba("aura-qa"))).toBe("1");
    expect(lerDadosLembrados("aura-qa", window.localStorage, 2000)).toMatchObject({ name: "Helena Martins", request_nfce: true });
  });
});

describe("a camada da peça no histórico", () => {
  function Peca({ aoFechar }: { aoFechar?: () => void }) {
    const [aberta, setAberta] = useState(false);
    useCamadaNoHistorico("zoom-da-foto", aberta, () => { setAberta(false); aoFechar?.(); });
    return (
      <>
        <Pressable accessibilityRole="button" accessibilityLabel="Ampliar a foto" onPress={() => setAberta(true)} />
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => setAberta(false)} />
        <Text>{aberta ? "aberta" : "fechada"}</Text>
      </>
    );
  }
  beforeEach(() => { window.history.replaceState({ id: "entrada-da-peca" }, ""); });

  test("abrir empilha uma entrada com o mesmo endereço; o voltar só fecha a camada", async () => {
    const t = render(<Peca />);
    const endereco = window.location.href;
    const antes = window.history.length;
    fireEvent.press(t.getByLabelText("Ampliar a foto"));
    expect(t.getByText("aberta")).toBeTruthy();
    expect(window.history.length).toBe(antes + 1);
    expect(window.location.href).toBe(endereco);
    expect(window.history.state).toMatchObject({ id: "entrada-da-peca", [MARCA_DA_CAMADA]: "zoom-da-foto" });
    await act(async () => { window.history.back(); });
    await waitFor(() => expect(t.getByText("fechada")).toBeTruthy());
    expect(window.history.state).toEqual({ id: "entrada-da-peca" });
  });

  test("fechar pelo botão tira a entrada da camada", async () => {
    const t = render(<Peca />);
    fireEvent.press(t.getByLabelText("Ampliar a foto"));
    fireEvent.press(t.getByLabelText("Fechar"));
    await waitFor(() => expect(window.history.state).toEqual({ id: "entrada-da-peca" }));
    expect(t.getByText("fechada")).toBeTruthy();
  });
});
