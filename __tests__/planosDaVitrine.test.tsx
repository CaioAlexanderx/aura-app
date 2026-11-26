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
        // tq-43: a tela revalida /auth/me no mount.
        refreshMe: () => Promise.resolve(),
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

// 18/11/2026 — trava do WhatsApp oficial (utils/whatsappOficialLiberado):
// desligada, as linhas do WhatsApp oficial saem da vitrine. Os testes do
// item 2 acima ligam a trava; os de baixo seguram a vitrine desligada.
var mockLiberado = false;
jest.mock("@/utils/whatsappOficialLiberado", () => {
  const real = jest.requireActual("@/utils/whatsappOficialLiberado");
  const m: any = {
    ...real,
    whatsappOficialVisivel: (s: any, u: any) => real.whatsappOficialVisivel(s, u, mockLiberado),
    whatsappOficialLiberadoPara: (u: any) => real.whatsappOficialLiberadoPara(u, mockLiberado),
  };
  // defineProperty, e não `get` no literal: o spread do babel lê o getter na hora.
  Object.defineProperty(m, "WHATSAPP_OFICIAL_LIBERADO", { get: () => mockLiberado, enumerable: true });
  return m;
});

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
  beforeEach(() => { mockPlanoAtual = "essencial"; mockLiberado = false; });

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

  it("trava ligada: o Negócio anuncia a cobrança inclusa e a cota de 100 promocionais", async () => {
    mockLiberado = true;
    const tree = await montar();
    const txt = textoDe(tree.root.findAllByProps({ testID: "plano-card-negocio" })[0]);
    expect(txt).toContain("Cobranças automáticas pelo WhatsApp oficial da sua loja: inclusas");
    expect(txt).toContain("100 mensagens promocionais por mês inclusas");
    expect(txt).toContain("R$ 49");
    // A promessa antiga saiu: era vaga e virou outra coisa.
    expect(txt).not.toContain("WhatsApp Business com templates");
  });

  it("trava ligada: a reativação aparece no Negócio, que é onde o gate a libera", async () => {
    mockLiberado = true;
    const tree = await montar();
    const negocio = textoDe(tree.root.findAllByProps({ testID: "plano-card-negocio" })[0]);
    expect(negocio).toContain("Reativação automática de clientes inativos");
    const essencial = textoDe(tree.root.findAllByProps({ testID: "plano-card-essencial" })[0]);
    expect(essencial).not.toContain("Reativação");
  });

  it("trava desligada: nada de WhatsApp oficial no Negócio nem nos adicionais", async () => {
    const tree = await montar();
    const negocio = textoDe(tree.root.findAllByProps({ testID: "plano-card-negocio" })[0]);
    expect(negocio).not.toContain("WhatsApp oficial");
    expect(negocio).not.toContain("Reativação automática");
    expect(negocio).not.toContain("mensagens promocionais");
    const tudo = textoDe(tree.toJSON());
    expect(tudo).not.toContain("Mensagens promocionais extras");
    expect(tudo).toContain("Acesso de funcionário adicional");
    // O resto do Negócio fica.
    expect(negocio).toContain("Crediário (fiado) por cliente");
  });

  it("o Essencial diz a verdade: cobrança por WhatsApp é manual (wa.me)", async () => {
    const tree = await montar();
    const txt = textoDe(tree.root.findAllByProps({ testID: "plano-card-essencial" })[0]);
    expect(txt).toContain("Cobrança pelo WhatsApp: manual (wa.me)");
    expect(txt).not.toContain("WhatsApp oficial");
  });

  // p-106 (11/11/2026): o titular conta como um acesso; o texto diz quantos
  // de funcionário o plano inclui e o adicional tem o nome novo.
  it("acessos: 'Só o seu acesso', 'mais 2 de funcionário' e o acesso de funcionário adicional", async () => {
    const tree = await montar();
    const essencial = textoDe(tree.root.findAllByProps({ testID: "plano-card-essencial" })[0]);
    expect(essencial).toContain("Só o seu acesso");
    expect(essencial).not.toContain("1 acesso de usuário");
    const negocio = textoDe(tree.root.findAllByProps({ testID: "plano-card-negocio" })[0]);
    expect(negocio).toContain("O seu acesso e mais 2 de funcionário");
    expect(negocio).not.toContain("Até 3 usuários");
    const tudo = textoDe(tree.toJSON());
    expect(tudo).toContain("Acesso de funcionário adicional");
    expect(tudo).not.toContain("Usuário adicional");
  });

  it("o preço e o desconto anual continuam de pé", async () => {
    const tree = await montar();
    const txt = textoDe(tree.root.findAllByProps({ testID: "plano-card-negocio" })[0]);
    expect(txt).toContain("169,00");
    const essencial = textoDe(tree.root.findAllByProps({ testID: "plano-card-essencial" })[0]);
    expect(essencial).toContain("89,00");
  });
});
