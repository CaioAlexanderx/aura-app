// ============================================================
// Matcon M1 — a seção "Matcon" no menu (22/09/2026).
//
// A seção nasce agora, junto com as esteiras (M0 não tinha rota para
// apontar). O que este teste segura:
//   1. a seção existe, com os DOIS itens do M1 e logo depois da "Ótica",
//      que é a semi-vertical irmã;
//   2. cada item é opt-in pelo toggle (`matconToggle: true`) e tem `mod`
//      PRÓPRIO — regra 3 do CLAUDE.md: nunca herdar o `mod` de outra tela;
//   3. Profissionais é M3 e NÃO entra agora (rota que não existe não vira
//      item de menu);
//   4. o filtro do toggle continua no buildRawNav, o único caminho comum
//      da Sidebar (web), da MBar (mobile) e do SidebarEditor;
//   5. MORE_PRIORIDADE não muda: no celular o Matcon cai no menu "Mais",
//      como a Ótica (§4 do faseamento).
//
// O NAV não é exportado do _layout; como em __tests__/modulosOcultos.test.ts
// e __tests__/moduloReativacaoNoMenu.test.ts, lemos o fonte — importá-lo
// puxaria expo-router e react-native-web inteiros para conferir um objeto.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

import fs from "fs";
import path from "path";
import { MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";

const LAYOUT = fs.readFileSync(path.join(__dirname, "..", "app/(tabs)/_layout.tsx"), "utf8");

/** Corpo do NAV, só até o fechamento do array. */
function corpoDoNav(): string {
  const nav = LAYOUT.slice(LAYOUT.indexOf("const NAV: NavSection[] = ["));
  return nav.slice(0, nav.indexOf("\n];"));
}

/** A linha da seção pedida, dentro do NAV. */
function linhaDaSecao(nome: string): string {
  const corpo = corpoDoNav();
  const linha = corpo.split("\n").find((l) => l.trim().startsWith(`{ s: "${nome}"`));
  expect(linha).toBeDefined();
  return linha as string;
}

/** Todos os itens ({ r, l, ic, mod, ...}) de uma linha de seção. */
function itensDaSecao(nome: string): { r: string; l: string; ic: string; mod?: string; matconToggle?: boolean }[] {
  return Array.from(linhaDaSecao(nome).matchAll(/\{ r: "([^"]+)", l: "([^"]+)", ic: "([^"]+)"([^}]*)\}/g)).map((m) => {
    const resto = m[4];
    const mod = /mod: "([^"]+)"/.exec(resto);
    return {
      r: m[1], l: m[2], ic: m[3],
      mod: mod ? mod[1] : undefined,
      matconToggle: /matconToggle: true/.test(resto),
    };
  });
}

describe("a seção Matcon existe no menu", () => {
  test("com os dois itens do M1, na ordem do mockup", () => {
    const itens = itensDaSecao("Matcon");
    expect(itens.map((i) => i.r)).toEqual(["/matcon/orcamentos", "/matcon/entregas"]);
    expect(itens.map((i) => i.l)).toEqual(["Orçamentos", "Entregas"]);
    // Ícones que já existem em components/Icon.tsx — zero ícone novo no M1.
    expect(itens.map((i) => i.ic)).toEqual(["clipboard", "truck"]);
  });

  test("logo depois da Ótica, a semi-vertical irmã", () => {
    const corpo = corpoDoNav();
    const otica = corpo.indexOf('{ s: "Ótica"');
    const matcon = corpo.indexOf('{ s: "Matcon"');
    const equipe = corpo.indexOf('{ s: "Equipe"');
    expect(otica).toBeGreaterThan(-1);
    expect(matcon).toBeGreaterThan(otica);
    expect(matcon).toBeLessThan(equipe);
  });

  test("Profissionais é M3 — não entra agora", () => {
    expect(corpoDoNav()).not.toContain("/matcon/profissionais");
    expect(corpoDoNav()).not.toContain("matcon.profissionais");
  });
});

describe("cada item é opt-in pelo toggle e tem módulo próprio", () => {
  test("matconToggle: true nos dois", () => {
    itensDaSecao("Matcon").forEach((i) => expect(i.matconToggle).toBe(true));
  });

  test("mod próprio por tela, nunca herdado (regra 3)", () => {
    const itens = itensDaSecao("Matcon");
    expect(itens.map((i) => i.mod)).toEqual(["matcon.orcamentos", "matcon.entregas"]);

    // E nenhuma outra tela do NAV usa essas chaves.
    const todosOsMods = Array.from(corpoDoNav().matchAll(/\{ r: "\/[^"]*"[^}]*mod: "([^"]+)"/g)).map((m) => m[1]);
    ["matcon.orcamentos", "matcon.entregas"].forEach((mod) => {
      expect(todosOsMods.filter((m) => m === mod).length).toBe(1);
    });
  });

  test("as duas chaves já estão nos mapas de plano e de permissão", () => {
    expect(MODULE_PLAN_MAP["matcon.orcamentos"]).toBe("negocio");
    expect(MODULE_PLAN_MAP["matcon.entregas"]).toBe("negocio");
    expect(PERM_TO_MODULES["matcon.access"]).toEqual(
      expect.arrayContaining(["matcon.orcamentos", "matcon.entregas"]),
    );
  });
});

describe("o filtro do toggle continua no único caminho comum", () => {
  test("buildRawNav derruba o item sem matcon_enabled", () => {
    const i = LAYOUT.indexOf("function buildRawNav(");
    expect(i).toBeGreaterThan(-1);
    const corpo = LAYOUT.slice(i, LAYOUT.indexOf("\n}", i));
    expect(corpo).toContain("if (item.matconToggle && matconEnabled !== true) return false;");
  });

  test("MORE_PRIORIDADE não muda: no celular o Matcon vai para o 'Mais'", () => {
    expect(LAYOUT).toContain('const MORE_PRIORIDADE = ["/clientes", "/whatsapp", "/clientes/reativacao"];');
  });
});
