// ============================================================
// Módulos ocultos do menu: o mecanismo (21/09/2026) e o estado atual.
//
// Em 21/09 o Caio tirou WhatsApp e Reativação da sidebar "por enquanto".
// Em 13/10 decidiu religá-las, e em 14/10 o card t3-06 removeu as duas
// chaves de MODULOS_OCULTOS. O mecanismo FICA (lista vazia + filtro em
// buildRawNav): é o jeito de esconder a próxima tela sem apagar o item do
// NAV nem o teste que segura a ordem do grupo.
//
// O que este teste segura:
//
//   1. a lista está vazia: as duas telas voltaram ao menu;
//   2. os itens continuam declarados no NAV e com plano e permissão por
//      baixo (o filtro é de apresentação, não de entitlement);
//   3. o filtro continua no buildRawNav, o único caminho comum da Sidebar
//      (web), da MBar (mobile) e do baseNav do SidebarEditor;
//   4. plano: o WhatsApp (canal da Meta) segue no Negócio e some no
//      Essencial, sem botão desabilitado; a Reativação vale para o Essencial
//      porque o toque de um clique usa o wa.me (decisão de 13/10).
//
// Como em __tests__/moduloReativacaoNoMenu.test.ts, o item 3 lê o fonte do
// _layout: importá-lo puxaria expo-router e react-native-web inteiros.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

import fs from "fs";
import path from "path";
import { MODULOS_OCULTOS, moduloEstaOculto } from "@/constants/modulosOcultos";
import {
  computeVisibleModules,
  MODULE_PLAN_MAP,
  PERM_TO_MODULES,
} from "@/hooks/useVisibleModules";

const LAYOUT = fs.readFileSync(
  path.join(__dirname, "..", "app/(tabs)/_layout.tsx"),
  "utf8",
);

// As duas telas que ficaram ocultas de 21/09 a 14/10/2026.
const RELIGADAS = ["whatsapp", "clientes.reativacao"];

// Todas as chaves `mod` declaradas no NAV, na ordem do fonte.
function modsDoNav(): string[] {
  const nav = LAYOUT.slice(LAYOUT.indexOf("const NAV: NavSection[] = ["));
  const corpo = nav.slice(0, nav.indexOf("\n];"));
  return Array.from(corpo.matchAll(/\{ r: "\/[^"]*"[^}]*mod: "([^"]+)"/g)).map(
    (m) => m[1],
  );
}

// Corpo do filtro de itens dentro de buildRawNav.
function corpoDoBuildRawNav(): string {
  const i = LAYOUT.indexOf("function buildRawNav(");
  expect(i).toBeGreaterThan(-1);
  return LAYOUT.slice(i, LAYOUT.indexOf("\n}", i));
}

describe("WhatsApp e Reativação voltaram ao menu (t3-06)", () => {
  test("a lista de ocultos está vazia", () => {
    expect(Array.from(MODULOS_OCULTOS)).toEqual([]);
  });

  test("as duas chaves religadas não estão na lista", () => {
    RELIGADAS.forEach((m) => expect(MODULOS_OCULTOS.has(m)).toBe(false));
    RELIGADAS.forEach((m) => expect(moduloEstaOculto(m)).toBe(false));
  });

  test("toda chave que vier a ser oculta precisa existir no NAV", () => {
    const doNav = new Set(modsDoNav());
    MODULOS_OCULTOS.forEach((m) => expect(doNav.has(m)).toBe(true));
  });

  test("moduloEstaOculto: sem `mod` ou vazio nunca esconde", () => {
    expect(moduloEstaOculto(undefined)).toBe(false);
    expect(moduloEstaOculto("")).toBe(false);
    expect(moduloEstaOculto("clientes")).toBe(false);
  });
});

describe("plano e permissão por baixo do menu", () => {
  test("as chaves continuam declaradas no NAV", () => {
    const doNav = modsDoNav();
    RELIGADAS.forEach((m) => expect(doNav).toContain(m));
  });

  test("WhatsApp segue no Negócio; Reativação vale para o Essencial (wa.me)", () => {
    expect(MODULE_PLAN_MAP["whatsapp"]).toBe("negocio");
    expect(MODULE_PLAN_MAP["clientes.reativacao"]).toBe("essencial");
  });

  test("continuam em PERM_TO_MODULES sob a permissão clientes", () => {
    expect(PERM_TO_MODULES["clientes"]).toEqual(
      expect.arrayContaining(RELIGADAS),
    );
  });

  test("o dono no Negócio vê as duas", () => {
    const v = computeVisibleModules("negocio", null, {
      is_owner: true,
      permissions: null,
    });
    RELIGADAS.forEach((m) => expect(v.has(m)).toBe(true));
  });

  test("o Essencial vê a Reativação e NÃO vê o WhatsApp da Meta", () => {
    const v = computeVisibleModules("essencial", null, undefined);
    expect(v.has("clientes.reativacao")).toBe(true);
    expect(v.has("whatsapp")).toBe(false);
    expect(v.has("clientes")).toBe(true);
  });
});

describe("o filtro está no único caminho comum do menu", () => {
  test("buildRawNav chama moduloEstaOculto", () => {
    expect(corpoDoBuildRawNav()).toContain("moduloEstaOculto(item.mod)");
  });

  test("moduloEstaOculto é importado de constants/modulosOcultos", () => {
    expect(LAYOUT).toMatch(
      /import \{ moduloEstaOculto \} from "@\/constants\/modulosOcultos";/,
    );
  });

  test("o filtro vem antes do teste de visibleMods, não depois", () => {
    const corpo = corpoDoBuildRawNav();
    expect(corpo.indexOf("moduloEstaOculto(item.mod)")).toBeLessThan(
      corpo.indexOf("visibleMods.has(item.mod)"),
    );
  });

  test("Sidebar e MBar continuam consumindo buildRawNav (nenhuma porta própria)", () => {
    const chamadas = LAYOUT.match(/buildRawNav\(visibleMods, isStaff/g) || [];
    expect(chamadas.length).toBe(2);
  });
});
