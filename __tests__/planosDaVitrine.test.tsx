// ============================================================
// A vitrine de planos depois da Fase 8b (14/09/2026).
//
// Duas decisões comerciais viraram código aqui, e as duas quebram em
// silêncio se ninguém segurar:
//
// 1. a página mostra DOIS planos. Expansão saiu da vitrine — mas não do
//    produto: quem já assinou continua no plano e precisa seguir usando
//    o app. Um `PLANS` podado no lugar de um filtro de exibição seria o
//    jeito de perder isso sem ninguém notar;
// 2. o WhatsApp oficial deixou de ser adicional pago e entrou no plano
//    Negócio, com 100 promocionais por mês e pacote extra de 100 por
//    R$ 49. Se a página continuar dizendo "WhatsApp Business com
//    templates", o cliente compra esperando outra coisa.
//
// react-test-renderer direto (não RTL): sob react-native-web tudo vira
// div e a identidade vem do testID.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));

var mockPlanoAtual = "essencial";
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = {
        company: { id: "loja-1", name: "Loja Exemplo", plan: mockPlanoAtual },
        token: "t",
        isDemo: false,
      };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));

// A página consulta o billing só para o banner do topo; aqui o banner não
// interessa e a rede, muito menos.
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: null }) }));
jest.mock("@/services/api", () => ({ billingApi: { status: jest.fn() } }));

import PlanosScreen from "@/app/(tabs)/planos";

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function temTestId(tree: any, id: string): boolean {
  return tree.root.findAllByProps({ testID: id }).length > 0;
}

/** Todo o texto renderizado da árvore, numa string só. */
function textoDe(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join(" ");
  const filhos = node.children || (node.props && node.props.children);
  return filhos ? textoDe(filhos) : "";
}

async function montar() {
  let tree: any;
  await act(async () => { tree = renderer.create(<PlanosScreen />); });
  await flush();
  return tree;
}

describe("planos na vitrine", () => {
  beforeEach(() => { mockPlanoAtual = "essencial"; });

  it("mostra Essencial e Negócio, e não mostra Expansão", async () => {
    const tree = await montar();
    expect(temTestId(tree, "plano-card-essencial")).toBe(true);
    expect(temTestId(tree, "plano-card-negocio")).toBe(true);
    expect(temTestId(tree, "plano-card-expansao")).toBe(false);
  });

  it("quem já está no Expansão continua entrando na tela sem card órfão", async () => {
    mockPlanoAtual = "expansao";
    const tree = await montar();
    expect(temTestId(tree, "plano-card-expansao")).toBe(false);
    expect(temTestId(tree, "plano-card-negocio")).toBe(true);
  });

  it("o Negócio anuncia a cobrança inclusa e a cota de 100 promocionais", async () => {
    const tree = await montar();
    const txt = textoDe(tree.root.findAllByProps({ testID: "plano-card-negocio" })[0]);
    expect(txt).toContain("Cobranças automáticas pelo WhatsApp oficial da sua loja: inclusas");
    expect(txt).toContain("100 mensagens promocionais por mês inclusas");
    expect(txt).toContain("R$ 49");
    // A promessa antiga saiu: era vaga e virou outra coisa.
    expect(txt).not.toContain("WhatsApp Business com templates");
  });

  it("a reativação aparece no Negócio, que é onde o gate a libera", async () => {
    const tree = await montar();
    const negocio = textoDe(tree.root.findAllByProps({ testID: "plano-card-negocio" })[0]);
    expect(negocio).toContain("Reativação automática de clientes inativos");
    const essencial = textoDe(tree.root.findAllByProps({ testID: "plano-card-essencial" })[0]);
    expect(essencial).not.toContain("Reativação");
  });

  it("o Essencial diz a verdade: cobrança por WhatsApp é manual (wa.me)", async () => {
    const tree = await montar();
    const txt = textoDe(tree.root.findAllByProps({ testID: "plano-card-essencial" })[0]);
    expect(txt).toContain("Cobrança pelo WhatsApp: manual (wa.me)");
    expect(txt).not.toContain("WhatsApp oficial");
  });

  it("o preço e o desconto anual continuam de pé", async () => {
    const tree = await montar();
    const txt = textoDe(tree.root.findAllByProps({ testID: "plano-card-negocio" })[0]);
    expect(txt).toContain("169,00");
    const essencial = textoDe(tree.root.findAllByProps({ testID: "plano-card-essencial" })[0]);
    expect(essencial).toContain("89,00");
  });
});
