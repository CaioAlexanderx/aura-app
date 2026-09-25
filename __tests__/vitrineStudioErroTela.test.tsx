// ============================================================
// A tela de erro da vitrine, desenhada (Fase 1A · 25/09/2026)
//
// Teste de TELA: monta PaginaDaVitrine com o fetch falhando e confere o
// que a cliente vê — o título com a voz da loja, nunca a mensagem crua
// da API — e que "Tentar de novo" refaz a carga de verdade.
// ============================================================
import React from "react";
import { render, screen, fireEvent, waitFor, configure } from "@testing-library/react-native";

// O jest.config mapeia react-native -> react-native-web, e a detecção
// automática de host components da Testing Library quebra ali ("children
// .indexOf is not a function" — ver lojaSempreAberta.test.tsx). Declarar
// os nomes pula a detecção: sob react-native-web, Text e View viram
// <div>, TextInput vira <input>.
configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);

jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return { __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path") };
});

import { PaginaDaVitrine } from "@/components/studio/storefront/PaginaDaVitrine";

function resposta(status: number, corpo: any) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  });
}

// O título é um cabeçalho (accessibilityRole="header" vira <h1> no
// react-native-web), então ele é conferido no texto da árvore; os demais
// textos são host Text comuns e passam pelo getByText.
const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);

const fetchOriginal = global.fetch;
afterEach(() => { global.fetch = fetchOriginal; });

test("404: 'Não achamos essa loja', sem a mensagem crua da API", async () => {
  global.fetch = jest.fn(() => resposta(404, { error: "Loja nao encontrada" })) as any;
  render(<PaginaDaVitrine slug="nao-existe" />);
  expect(await screen.findByText("Ir para a Aura")).toBeTruthy();
  expect(naTela("Não achamos essa loja")).toBe(true);
  expect(naTela("Loja nao encontrada")).toBe(false);
  expect(screen.queryByText("Tentar de novo")).toBeNull();
});

test("falha de rede: 'A loja não carregou' e o Tentar de novo refaz a carga", async () => {
  const fetchMock = jest.fn()
    .mockImplementationOnce(() => Promise.reject(new TypeError("Failed to fetch")))
    .mockImplementationOnce(() => resposta(503, { error: "indisponivel" }));
  global.fetch = fetchMock as any;
  render(<PaginaDaVitrine slug="aura-qa" />);

  expect(await screen.findByText("Tentar de novo")).toBeTruthy();
  expect(naTela("A loja não carregou")).toBe(true);
  expect(naTela("Failed to fetch")).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  fireEvent.press(screen.getByText("Tentar de novo"));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  // A segunda tentativa também falhou (503): a tela volta, pronta para outra.
  expect(await screen.findByText("Tentar de novo")).toBeTruthy();
  expect(naTela("A loja não carregou")).toBe(true);
  expect(naTela("indisponivel")).toBe(false);
});
