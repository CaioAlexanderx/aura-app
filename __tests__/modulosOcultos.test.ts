// ============================================================
// Módulos ocultos do menu (21/09/2026).
//
// Pedido do Caio: WhatsApp e Reativação saem da sidebar por enquanto,
// porque as duas não estão operantes. O risco que este teste cobre não
// é "o item desapareceu" — é o jeito COMO ele desapareceu.
//
// Esconder apagando o item do NAV teria funcionado e teria custado o
// registro da decisão de 16/09 (o grupo subiu de posição justamente
// para essas telas pararem de ser invisíveis) mais o teste que segura
// aquela ordem. Então o teste aqui trava o desenho escolhido:
//
//   1. as duas chaves estão em MODULOS_OCULTOS;
//   2. o item CONTINUA declarado no NAV — reativar é uma linha;
//   3. plano e permissão continuam intactos, ou seja o filtro é de
//      apresentação e não de entitlement: quando a chave sair da
//      lista, quem via volta a ver e quem não via continua sem ver;
//   4. o filtro está no buildRawNav, que é o único caminho comum da
//      Sidebar (web), da MBar (mobile) e do baseNav do SidebarEditor.
//      Filtrar em qualquer outro lugar deixaria uma das três portas
//      aberta.
//
// Como em __tests__/moduloReativacaoNoMenu.test.ts, o item 4 lê o
// fonte do _layout: importá-lo puxaria expo-router e react-native-web
// inteiros para conferir uma chamada de função.
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

const OCULTOS = ["whatsapp", "clientes.reativacao"];

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

describe("as duas telas estão na lista de ocultos", () => {
  test("WhatsApp e Reativação estão ocultos", () => {
    OCULTOS.forEach((m) => expect(MODULOS_OCULTOS.has(m)).toBe(true));
  });

  test("a lista não escondeu nada além dessas duas", () => {
    expect(Array.from(MODULOS_OCULTOS).sort()).toEqual([...OCULTOS].sort());
  });

  test("toda chave oculta existe de fato no NAV", () => {
    const doNav = new Set(modsDoNav());
    MODULOS_OCULTOS.forEach((m) => expect(doNav.has(m)).toBe(true));
  });

  test("moduloEstaOculto: só a chave exata esconde", () => {
    expect(moduloEstaOculto("whatsapp")).toBe(true);
    expect(moduloEstaOculto("clientes.reativacao")).toBe(true);
    // Item sem `mod` (ex. /vertical, /gestao-aura) nunca é escondido aqui.
    expect(moduloEstaOculto(undefined)).toBe(false);
    expect(moduloEstaOculto("")).toBe(false);
    // Prefixo não vale: esconder a reativação não esconde /clientes.
    expect(moduloEstaOculto("clientes")).toBe(false);
    expect(moduloEstaOculto("canal")).toBe(false);
  });
});

describe("o esconderijo é de apresentação, não de entitlement", () => {
  test("as chaves continuam declaradas no NAV", () => {
    const doNav = modsDoNav();
    OCULTOS.forEach((m) => expect(doNav).toContain(m));
  });

  test("continuam em MODULE_PLAN_MAP, no plano do canal", () => {
    OCULTOS.forEach((m) => expect(MODULE_PLAN_MAP[m]).toBe("negocio"));
  });

  test("continuam em PERM_TO_MODULES sob a permissão clientes", () => {
    expect(PERM_TO_MODULES["clientes"]).toEqual(
      expect.arrayContaining(OCULTOS),
    );
  });

  test("computeVisibleModules não mudou: o dono no Negócio segue com as duas", () => {
    const v = computeVisibleModules("negocio", null, {
      is_owner: true,
      permissions: null,
    });
    OCULTOS.forEach((m) => expect(v.has(m)).toBe(true));
  });

  test("e o Essencial segue sem elas, como antes", () => {
    const v = computeVisibleModules("essencial", null, undefined);
    OCULTOS.forEach((m) => expect(v.has(m)).toBe(false));
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
