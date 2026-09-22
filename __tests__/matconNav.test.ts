// ============================================================
// Matcon M1/M3/M4 — a seção "Matcon" no menu (22/09/2026).
//
// A seção nasceu no M1, junto com as esteiras; o M3 acrescenta
// "Profissionais" (ranking do Clube do Profissional) e o M4 acrescenta
// "Compras" (esteira Sugestão → Pedido enviado → Recebido) — a única tela
// nova de M4, já que lote e devolução de sobra entram em telas que já
// existem (docs/CONTRACT_MATCON.md §M4). O que este teste segura:
//   1. a seção existe, com os QUATRO itens (M1 + M3 + M4) e logo depois da
//      "Ótica", que é a semi-vertical irmã;
//   2. cada item é opt-in pelo toggle (`matconToggle: true`) e tem `mod`
//      PRÓPRIO — regra 3 do CLAUDE.md: nunca herdar o `mod` de outra tela;
//   3. o filtro do toggle continua no buildRawNav, o único caminho comum
//      da Sidebar (web), da MBar (mobile) e do SidebarEditor — o item de
//      Profissionais e o de Compras somem com matcon_enabled desligado,
//      mesmo caminho dos outros dois (o gate fino do clube fica dentro da
//      própria tela, o de Compras também);
//   4. MORE_PRIORIDADE não muda: no celular o Matcon cai no menu "Mais",
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
  test("com os quatro itens (M1 + M3 + M4), na ordem do mockup", () => {
    const itens = itensDaSecao("Matcon");
    expect(itens.map((i) => i.r)).toEqual(["/matcon/orcamentos", "/matcon/entregas", "/matcon/profissionais", "/matcon/compras"]);
    expect(itens.map((i) => i.l)).toEqual(["Orçamentos", "Entregas", "Profissionais", "Compras"]);
    // Ícones que já existem em components/Icon.tsx — zero ícone novo.
    expect(itens.map((i) => i.ic)).toEqual(["clipboard", "truck", "building", "package"]);
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

  test("Profissionais entra logo depois de Entregas", () => {
    const itens = itensDaSecao("Matcon").map((i) => i.r);
    expect(itens.indexOf("/matcon/profissionais")).toBe(itens.indexOf("/matcon/entregas") + 1);
  });

  test("Compras entra logo depois de Profissionais", () => {
    const itens = itensDaSecao("Matcon").map((i) => i.r);
    expect(itens.indexOf("/matcon/compras")).toBe(itens.indexOf("/matcon/profissionais") + 1);
  });
});

describe("cada item é opt-in pelo toggle e tem módulo próprio", () => {
  test("matconToggle: true nos quatro", () => {
    itensDaSecao("Matcon").forEach((i) => expect(i.matconToggle).toBe(true));
  });

  test("mod próprio por tela, nunca herdado (regra 3)", () => {
    const itens = itensDaSecao("Matcon");
    expect(itens.map((i) => i.mod)).toEqual(["matcon.orcamentos", "matcon.entregas", "matcon.profissionais", "matcon.compras"]);

    // E nenhuma outra tela do NAV usa essas chaves.
    const todosOsMods = Array.from(corpoDoNav().matchAll(/\{ r: "\/[^"]*"[^}]*mod: "([^"]+)"/g)).map((m) => m[1]);
    ["matcon.orcamentos", "matcon.entregas", "matcon.profissionais", "matcon.compras"].forEach((mod) => {
      expect(todosOsMods.filter((m) => m === mod).length).toBe(1);
    });
  });

  test("as quatro chaves já estão nos mapas de plano e de permissão", () => {
    expect(MODULE_PLAN_MAP["matcon.orcamentos"]).toBe("negocio");
    expect(MODULE_PLAN_MAP["matcon.entregas"]).toBe("negocio");
    expect(MODULE_PLAN_MAP["matcon.profissionais"]).toBe("negocio");
    expect(MODULE_PLAN_MAP["matcon.compras"]).toBe("negocio");
    expect(PERM_TO_MODULES["matcon.access"]).toEqual(
      expect.arrayContaining(["matcon.orcamentos", "matcon.entregas", "matcon.profissionais", "matcon.compras"]),
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
