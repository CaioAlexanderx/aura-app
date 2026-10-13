// ============================================================
// Cliente no Caixa — Essencial vincula cliente à venda
//
// INC-2026-10-13-01 (13/10/2026): o botão "Cliente" (F3) do Caixa saía
// desabilitado no Essencial ("Disponível no plano Negócio"), embora Clientes
// seja Essencial desde 11/05/2026. Decisão do Caio: Clientes fica disponível
// no Essencial.
//
// O que este arquivo segura:
//  1. Essencial sem override → habilitado (o caso da Talita);
//  2. Negócio/Expansão → habilitado; plano ausente cai em Essencial;
//  3. override `clientes: false` da empresa desabilita em qualquer plano, e
//     `true` habilita;
//  4. o Caixa decide pela MESMA fonte do menu (MODULE_PLAN_MAP): se o plano
//     mínimo de `clientes` mudar lá, muda aqui;
//  5. usePdvState usa o helper e não voltou ao default `isNegocioPlus`.
// ============================================================
import fs from "fs";
import path from "path";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({}) }));

import { clientesNoCaixaHabilitado } from "@/utils/clientesNoCaixa";
import { MODULE_PLAN_MAP, PLAN_LEVEL } from "@/hooks/useVisibleModules";

describe("clientesNoCaixaHabilitado", () => {
  it("Essencial sem override: habilitado (INC-2026-10-13-01)", () => {
    expect(clientesNoCaixaHabilitado("essencial", {})).toBe(true);
    expect(clientesNoCaixaHabilitado("essencial", undefined)).toBe(true);
    expect(clientesNoCaixaHabilitado("essencial", null)).toBe(true);
  });

  it("Negócio, Expansão e plano ausente: habilitado", () => {
    expect(clientesNoCaixaHabilitado("negocio", {})).toBe(true);
    expect(clientesNoCaixaHabilitado("expansao", {})).toBe(true);
    expect(clientesNoCaixaHabilitado(undefined, {})).toBe(true);
    expect(clientesNoCaixaHabilitado(null, {})).toBe(true);
  });

  it("override da empresa manda: false desabilita, true habilita", () => {
    expect(clientesNoCaixaHabilitado("essencial", { clientes: false })).toBe(false);
    expect(clientesNoCaixaHabilitado("negocio", { clientes: false })).toBe(false);
    expect(clientesNoCaixaHabilitado("essencial", { clientes: true })).toBe(true);
  });

  it("override de outro módulo não mexe em Clientes", () => {
    expect(clientesNoCaixaHabilitado("essencial", { pdv: false, financeiro: false })).toBe(true);
  });

  it("segue o MODULE_PLAN_MAP: Clientes é Essencial no mapa do menu", () => {
    expect(MODULE_PLAN_MAP.clientes).toBe("essencial");
    // o helper concorda com o mapa para todos os níveis de plano conhecidos
    for (const plano of Object.keys(PLAN_LEVEL)) {
      const esperado = (PLAN_LEVEL[plano] ?? 0) >= (PLAN_LEVEL[MODULE_PLAN_MAP.clientes] ?? 0);
      expect(clientesNoCaixaHabilitado(plano, {})).toBe(esperado);
    }
  });
});

describe("usePdvState", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "hooks", "usePdvState.ts"), "utf8");

  it("decide `clientesEnabled` pelo helper do mapa de módulos", () => {
    expect(src).toContain('import { clientesNoCaixaHabilitado } from "@/utils/clientesNoCaixa";');
    expect(src).toMatch(/const clientesEnabled = clientesNoCaixaHabilitado\(/);
  });

  it("não voltou ao default por plano Negócio+", () => {
    expect(src).not.toMatch(/isModuleEnabled\(\s*["']clientes["']/);
    const linha = src.split("\n").find((l) => l.includes("const clientesEnabled"));
    expect(linha).toBeDefined();
    expect(linha).not.toContain("isNegocioPlus");
  });
});
