// ============================================================
// Vitrine Studio · Onda 1B — as telas vêm da URL (teste de TELA)
//
// Monta a vitrine como o layout de `app/[slug]` monta — a casca com o
// estado da loja e a rota filha dizendo qual tela é —, com um `navegar`
// falso no lugar do roteador. Confere as duas mãos:
//   - URL → tela: /p/<id> abre a peça (e o título da aba), peça que saiu
//     da loja volta para a home com o aviso, link da Aurinha abre a peça
//     com a faixa;
//   - ação → URL: abrir uma peça empilha /p/<id>, voltar volta.
// ============================================================
import React from "react";
import { render, screen, fireEvent, waitFor, configure, act } from "@testing-library/react-native";

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
// O roteador de verdade não sobe no jest (expo-modules-core); a vitrine
// só usa dele o que o layout passa adiante, e aqui o layout é o teste.
jest.mock("expo-router", () => ({
  Slot: () => null,
  router: { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
// O preview 3D/2D da peça não é o assunto aqui.
jest.mock("@/components/studio/storefront/LivePreview", () => ({
  LivePreview: () => null,
  defaultConfiguratorSize: () => 320,
}));

import { CascaDaVitrine } from "@/components/studio/storefront/PaginaDaVitrine";
import { ProvedorDaRota, TelaNaRota } from "@/components/studio/storefront/VitrineNaRota";
import type { TelaDaVitrine } from "@/components/studio/storefront/rotasDaVitrine";

const CANECA = "8f21c4a9-1b2c-4d3e-8f90-a1b2c3d4e5f6";
const CHAVEIRO = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const peca = (id: string, name: string) => ({
  id, name, description: "Porcelana 300ml.", price: "49.90",
  image_url: null, gallery_urls: [], category: null, category_id: null,
  customization_config: { fields: [] }, templates: [],
});

const LOJA = {
  site: { name: "Sheid Mania", primary_color: "#7B2D42", accent_color: "#EC4899", logo_url: null },
  products: [peca(CANECA, "Caneca Alça Coração"), peca(CHAVEIRO, "Chaveiro Acrílico")],
  categories: [],
  sla: { sla_base_days: 5, queue_qty: 0, total_estimate_days: 5 },
  payment: { has_pix: true, has_card: false, pay_on_delivery_enabled: false },
  revisions: {},
  total_products: 2,
};

const fetchOriginal = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve(LOJA),
  })) as any;
  try { window.sessionStorage.clear(); } catch {}
});
afterEach(() => { global.fetch = fetchOriginal; });

const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);

function montar(tela: TelaDaVitrine, consulta?: Record<string, unknown>) {
  const navegar = jest.fn();
  // A entrada na loja por link de peça arruma o histórico do navegador
  // (troca pela home + empilha a peça). Aqui a loja já "passou pela aba",
  // para o teste olhar só a tela.
  try { window.sessionStorage.setItem("aura-vitrine-na-aba-sheid-mania", "1"); } catch {}
  render(
    <ProvedorDaRota navegar={navegar}>
      <CascaDaVitrine slug="sheid-mania" navegar={navegar}>
        <TelaNaRota tela={tela} consulta={consulta} />
      </CascaDaVitrine>
    </ProvedorDaRota>,
  );
  return navegar;
}

test("/p/<id> abre a peça direto, com o título da aba", async () => {
  montar({ tipo: "produto", id: CANECA });
  expect(await screen.findByLabelText("Compartilhar")).toBeTruthy();
  expect(naTela("Caneca Alça Coração")).toBe(true);
  expect(document.title).toBe("Caneca Alça Coração · Sheid Mania");
});

test("peça que saiu da loja: home com o aviso discreto, sem erro", async () => {
  const navegar = montar({ tipo: "produto", id: "11111111-2222-4333-8444-555555555555" });
  await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "home" }, "voltar"));
  expect(naTela("Essa peça não está mais na loja")).toBe(true);
});

test("da home, abrir a peça empilha /p/<id>; voltar para a loja volta", async () => {
  const navegar = montar({ tipo: "home" });
  const cartao = await screen.findByText("Chaveiro Acrílico");
  expect(document.title).toBe("Sheid Mania");
  fireEvent.press(cartao);
  expect(navegar).toHaveBeenCalledWith({ tipo: "produto", id: CHAVEIRO }, "empilhar");
});

test("o botão voltar da peça volta para a home pelo histórico", async () => {
  const navegar = montar({ tipo: "produto", id: CANECA });
  fireEvent.press(await screen.findByLabelText("Voltar para a loja"));
  expect(navegar).toHaveBeenCalledWith({ tipo: "home" }, "voltar");
});

test("link da Aurinha: a home entra limpa, a peça por cima, com a faixa", async () => {
  jest.useFakeTimers();
  try {
    try { window.sessionStorage.clear(); } catch {}
    const navegar = jest.fn();
    render(
      <ProvedorDaRota navegar={navegar}>
        <CascaDaVitrine slug="sheid-mania" navegar={navegar}>
          <TelaNaRota
            tela={{ tipo: "home" }}
            consulta={{ slug: "sheid-mania", produto: CANECA, variante: "M-vinho", origem: "aurinha", conversa: "3f0e7a52-9c1d-4b8e-a6f2-0d5c7e9b1a24" }}
          />
        </CascaDaVitrine>
      </ProvedorDaRota>,
    );
    act(() => { jest.runAllTimers(); });
    expect(navegar.mock.calls).toEqual([
      [{ tipo: "home" }, "trocar"],
      [{ tipo: "produto", id: CANECA }, "empilhar"],
    ]);
    // A atribuição ficou na aba para ir no pedido.
    expect(JSON.parse(window.sessionStorage.getItem("aura-vitrine-origem-sheid-mania") || "{}"))
      .toEqual({ origem: "aurinha", hub_conversation_id: "3f0e7a52-9c1d-4b8e-a6f2-0d5c7e9b1a24" });
    // Deixa a carga da loja terminar dentro do teste.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  } finally {
    jest.useRealTimers();
  }
});

test("link da Aurinha com produto inválido fica na home, sem navegar", async () => {
  jest.useFakeTimers();
  try {
    try { window.sessionStorage.clear(); } catch {}
    const navegar = jest.fn();
    render(
      <ProvedorDaRota navegar={navegar}>
        <CascaDaVitrine slug="sheid-mania" navegar={navegar}>
          <TelaNaRota tela={{ tipo: "home" }} consulta={{ produto: "caneca", origem: "aurinha" }} />
        </CascaDaVitrine>
      </ProvedorDaRota>,
    );
    act(() => { jest.runAllTimers(); });
    expect(navegar).not.toHaveBeenCalled();
    // Deixa a carga da loja terminar dentro do teste.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  } finally {
    jest.useRealTimers();
  }
});

test("link de peça aberto de fora: a home entra embaixo no histórico", async () => {
  jest.useFakeTimers();
  try {
    try { window.sessionStorage.clear(); } catch {}
    const navegar = jest.fn();
    render(
      <ProvedorDaRota navegar={navegar}>
        <CascaDaVitrine slug="sheid-mania" navegar={navegar}>
          <TelaNaRota tela={{ tipo: "produto", id: CANECA }} />
        </CascaDaVitrine>
      </ProvedorDaRota>,
    );
    act(() => { jest.runAllTimers(); });
    expect(navegar.mock.calls).toEqual([
      [{ tipo: "home" }, "trocar"],
      [{ tipo: "produto", id: CANECA }, "empilhar"],
    ]);
    // Deixa a carga da loja terminar dentro do teste.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  } finally {
    jest.useRealTimers();
  }
});

test("a peça da Aurinha abre com a faixa 'Separamos esta peça para você', que fecha", async () => {
  jest.useFakeTimers();
  try {
    try { window.sessionStorage.clear(); } catch {}
    const navegar = jest.fn();
    const arvore = (tela: TelaDaVitrine, consulta?: Record<string, unknown>) => (
      <ProvedorDaRota navegar={navegar}>
        <CascaDaVitrine slug="sheid-mania" navegar={navegar}>
          <TelaNaRota key={tela.tipo} tela={tela} consulta={consulta} />
        </CascaDaVitrine>
      </ProvedorDaRota>
    );
    const r = render(arvore({ tipo: "home" }, { produto: CANECA, origem: "aurinha" }));
    act(() => { jest.runAllTimers(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    // O roteador falso não troca a tela: o teste faz o papel dele.
    r.rerender(arvore({ tipo: "produto", id: CANECA }));
    await act(async () => { await Promise.resolve(); });
    expect(naTela("Separamos esta peça para você")).toBe(true);
    fireEvent.press(screen.getByLabelText("Fechar aviso"));
    expect(naTela("Separamos esta peça para você")).toBe(false);
    expect(naTela("Caneca Alça Coração")).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});

test("peça aberta sem vir da Aurinha não tem faixa", async () => {
  montar({ tipo: "produto", id: CANECA });
  expect(await screen.findByLabelText("Compartilhar")).toBeTruthy();
  expect(naTela("Separamos esta peça para você")).toBe(false);
});
