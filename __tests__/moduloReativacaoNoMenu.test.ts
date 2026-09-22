// ============================================================
// Grupo "Clientes e WhatsApp" — chaves de módulo e posição no menu (16/09/2026).
//
// O caso que originou isto: uma conta de trial cancelou sem nunca ter aberto o
// WhatsApp nem a Reativação. Não era falta de plano — era falta de menu. O
// grupo Clientes era o penúltimo, depois de Ótica e Equipe, e /clientes/reativacao
// não tinha item nenhum apontando para ela desde a Fase 7: a tela existia e a
// única porta era digitar a URL.
//
// Este teste segura quatro coisas:
//   1. as chaves existem nos DOIS mapas (regra 3 do CLAUDE.md) e ninguém herda
//      o mod de outra tela — em especial, "clientes.reativacao" NÃO é "clientes";
//   2. o plano mínimo é o do canal (Negócio), não o de /clientes (Essencial):
//      disparo de marketing não pode cair no Essencial por tabela;
//   3. só a permissão `clientes` libera a reativação para um membro;
//   4. a ordem dos grupos no NAV e a prioridade do menu "Mais" — o motivo de
//      toda a mudança. Ordem é comportamento aqui, não estética: o grupo abaixo
//      da dobra é um grupo que não existe.
//
// Os itens 1–3 leem a função de verdade; o item 4 lê o fonte do _layout, como
// __tests__/excecaoDeFonte.test.ts faz — importar o _layout puxaria expo-router,
// react-native-web e o mundo inteiro para medir uma lista de strings.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

import fs from "fs";
import path from "path";
import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";

const LAYOUT = fs.readFileSync(
  path.join(__dirname, "..", "app/(tabs)/_layout.tsx"),
  "utf8",
);

// Rótulos dos grupos na ordem em que aparecem no NAV.
function ordemDosGrupos(): string[] {
  const nav = LAYOUT.slice(LAYOUT.indexOf("const NAV: NavSection[] = ["));
  const corpo = nav.slice(0, nav.indexOf("\n];"));
  return Array.from(corpo.matchAll(/^\s*\{ s: "([^"]+)"/gm)).map((m) => m[1]);
}

// Itens (r + mod) de um grupo, na ordem declarada.
function itensDoGrupo(nomeDoGrupo: string): { r: string; mod: string | null }[] {
  const linha = LAYOUT.split("\n").find((l) => l.includes(`{ s: "${nomeDoGrupo}"`));
  if (!linha) throw new Error(`grupo "${nomeDoGrupo}" não existe no NAV`);
  return Array.from(linha.matchAll(/\{ r: "([^"]+)"(?:[^}]*mod: "([^"]+)")?[^}]*\}/g))
    .map((m) => ({ r: m[1], mod: m[2] || null }));
}

describe("Reativação: chaves próprias nos dois mapas", () => {
  test("clientes.reativacao existe em MODULE_PLAN_MAP, no plano Negócio", () => {
    expect(MODULE_PLAN_MAP["clientes.reativacao"]).toBe("negocio");
  });

  test("não herda o plano de /clientes (Essencial) nem inventa um novo", () => {
    expect(MODULE_PLAN_MAP["clientes"]).toBe("essencial");
    expect(MODULE_PLAN_MAP["clientes.reativacao"]).not.toBe(MODULE_PLAN_MAP["clientes"]);
    // Mesmo teto do canal por onde a mensagem sai.
    expect(MODULE_PLAN_MAP["clientes.reativacao"]).toBe(MODULE_PLAN_MAP["whatsapp"]);
  });

  test("whatsapp continua com chave própria no Negócio", () => {
    expect(MODULE_PLAN_MAP["whatsapp"]).toBe("negocio");
  });

  test("os quatro itens do grupo estão em MODULE_PLAN_MAP", () => {
    ["clientes", "whatsapp", "clientes.reativacao", "canal"].forEach((m) => {
      expect(MODULE_PLAN_MAP[m]).toBeDefined();
    });
  });
});

describe("Reativação: permissão do membro", () => {
  test("só a permissão `clientes` libera clientes.reativacao", () => {
    expect(PERM_TO_MODULES["clientes"]).toContain("clientes.reativacao");
    Object.keys(PERM_TO_MODULES)
      .filter((k) => k !== "clientes")
      .forEach((k) => expect(PERM_TO_MODULES[k]).not.toContain("clientes.reativacao"));
  });

  test("whatsapp entrou na mesma permissão (antes não estava em nenhuma)", () => {
    expect(PERM_TO_MODULES["clientes"]).toContain("whatsapp");
    Object.keys(PERM_TO_MODULES)
      .filter((k) => k !== "clientes")
      .forEach((k) => expect(PERM_TO_MODULES[k]).not.toContain("whatsapp"));
  });

  test("membro sem `clientes` não vê a reativação, mesmo com pdv/vendas/agentes", () => {
    const v = computeVisibleModules("negocio", null, {
      is_owner: false,
      permissions: { pdv: true, vendas: true, agentes: true },
    });
    expect(v.has("clientes.reativacao")).toBe(false);
    expect(v.has("whatsapp")).toBe(false);
    expect(v.has("pdv")).toBe(true);
  });

  test("membro com `clientes` vê as quatro telas do grupo no Negócio", () => {
    const v = computeVisibleModules("negocio", null, {
      is_owner: false,
      permissions: { clientes: true },
    });
    ["clientes", "whatsapp", "clientes.reativacao", "canal"].forEach((m) =>
      expect(v.has(m)).toBe(true),
    );
  });

  test("dono vê tudo no Negócio", () => {
    const v = computeVisibleModules("negocio", null, { is_owner: true, permissions: null });
    expect(v.has("clientes.reativacao")).toBe(true);
    expect(v.has("whatsapp")).toBe(true);
  });
});

describe("Reativação: visibilidade por plano", () => {
  test("Essencial vê Clientes mas não a Reativação nem o WhatsApp", () => {
    const v = computeVisibleModules("essencial", null, undefined);
    expect(v.has("clientes")).toBe(true);
    expect(v.has("clientes.reativacao")).toBe(false);
    expect(v.has("whatsapp")).toBe(false);
  });

  test("Negócio e Expansão veem o grupo inteiro", () => {
    for (const plano of ["negocio", "expansao"]) {
      const v = computeVisibleModules(plano, null, undefined);
      ["clientes", "whatsapp", "clientes.reativacao", "canal"].forEach((m) =>
        expect(v.has(m)).toBe(true),
      );
    }
  });

  test("override true vende a reativação como add-on no Essencial", () => {
    const v = computeVisibleModules("essencial", { "clientes.reativacao": true }, undefined);
    expect(v.has("clientes.reativacao")).toBe(true);
    expect(v.has("whatsapp")).toBe(false);
  });

  test("override false esconde só a reativação", () => {
    const v = computeVisibleModules("negocio", { "clientes.reativacao": false }, undefined);
    expect(v.has("clientes.reativacao")).toBe(false);
    expect(v.has("whatsapp")).toBe(true);
    expect(v.has("clientes")).toBe(true);
  });

  test("permissão não vence o plano: `clientes` no Essencial não libera a reativação", () => {
    const v = computeVisibleModules("essencial", null, {
      is_owner: false,
      permissions: { clientes: true },
    });
    expect(v.has("clientes")).toBe(true);
    expect(v.has("clientes.reativacao")).toBe(false);
  });
});

describe("NAV: o grupo sobe e leva as telas certas", () => {
  test("ordem dos grupos", () => {
    expect(ordemDosGrupos()).toEqual([
      "Principal",
      "Contábil",
      "Vendas",
      "Clientes e WhatsApp",
      "Ótica",
      // 22/09/2026 — semi-vertical Matcon entra logo depois da Ótica (M1).
      "Matcon",
      "Equipe",
      "Crescimento",
      "Admin",
    ]);
  });

  test("Clientes e WhatsApp vem antes de Ótica e de Equipe", () => {
    const ordem = ordemDosGrupos();
    expect(ordem.indexOf("Clientes e WhatsApp")).toBeLessThan(ordem.indexOf("Ótica"));
    expect(ordem.indexOf("Clientes e WhatsApp")).toBeLessThan(ordem.indexOf("Equipe"));
  });

  test("os quatro itens, na ordem da jornada, cada um com mod próprio", () => {
    expect(itensDoGrupo("Clientes e WhatsApp")).toEqual([
      { r: "/clientes", mod: "clientes" },
      { r: "/whatsapp", mod: "whatsapp" },
      { r: "/clientes/reativacao", mod: "clientes.reativacao" },
      { r: "/canal", mod: "canal" },
    ]);
  });

  test("nenhum mod do NAV está fora de MODULE_PLAN_MAP", () => {
    const mods = Array.from(LAYOUT.matchAll(/\{ r: "\/[^"]*"[^}]*mod: "([^"]+)"/g)).map((m) => m[1]);
    expect(mods.length).toBeGreaterThan(10);
    mods.forEach((m) => expect(MODULE_PLAN_MAP[m]).toBeDefined());
  });

  test("menu Mais (mobile): Clientes, WhatsApp e Reativação hasteados nessa ordem", () => {
    const m = LAYOUT.match(/const MORE_PRIORIDADE = \[([^\]]+)\]/);
    expect(m).not.toBeNull();
    const rotas = Array.from((m as RegExpMatchArray)[1].matchAll(/"([^"]+)"/g)).map((x) => x[1]);
    expect(rotas).toEqual(["/clientes", "/whatsapp", "/clientes/reativacao"]);
  });
});
