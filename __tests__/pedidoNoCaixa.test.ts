// ============================================================
// Pedido separado de venda (A1): quem vê o "Guardar > Pedido" no Caixa.
// Trava PEDIDO_LIBERADO (utils/pedidoLiberado.ts, a mesma da aba Pedidos,
// aura-app#1320) e o módulo vendas.pedidos
// (hooks/useVisibleModules.ts), regra 3 do CLAUDE.md.
// 18/11/2026: o Guardar vale com a permissão pdv OU vendas; a aba Pedidos
// segue só com vendas.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

import { pedidoNoCaixa, podeGuardarPedido, PERMISSOES_DO_GUARDAR } from "@/utils/pedido";
import { PEDIDO_LIBERADO, pedidoLiberado, MODULO_PEDIDOS } from "@/utils/pedidoLiberado";
import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";

const LOJA = "empresa-1";
const LOJISTA = { id: "u-1", is_staff: false };
const EQUIPE = { id: "u-2", is_staff: true };

const DONO = { is_owner: true };

describe("trava PEDIDO_LIBERADO", () => {
  test("nasce desligada: nenhum lojista vê nada", () => {
    expect(PEDIDO_LIBERADO).toBe(false);
    expect(pedidoLiberado(LOJISTA)).toBe(false);
  });

  test("desligada, nem dono do Negócio vê o Pedido no Caixa", () => {
    const ctx = { plano: "negocio", overrides: {}, permissoes: DONO, companyId: LOJA };
    expect(pedidoNoCaixa({ ...ctx, user: LOJISTA })).toBe(false);
    expect(pedidoNoCaixa({ ...ctx, user: null })).toBe(false);
  });

  test("desligada, a equipe Aura vê (QA em produção, como no backend)", () => {
    expect(pedidoNoCaixa({ user: EQUIPE, plano: "negocio", overrides: {}, permissoes: DONO, companyId: LOJA })).toBe(true);
  });

  test("desligada, membro só com pdv também não vê (a trava vem antes)", () => {
    const soCaixa = { is_owner: false, permissions: { pdv: true } };
    expect(pedidoNoCaixa({ user: LOJISTA, plano: "negocio", overrides: {}, permissoes: soCaixa, companyId: LOJA })).toBe(false);
  });
});

describe("módulo próprio vendas.pedidos", () => {
  test("está no mapa de planos (Essencial); a aba entra só pela permissão vendas (aura-app#1320)", () => {
    expect(MODULO_PEDIDOS).toBe("vendas.pedidos");
    expect(MODULE_PLAN_MAP["vendas.pedidos"]).toBe("essencial");
    expect(PERM_TO_MODULES.vendas).toContain("vendas.pedidos");
    expect(PERM_TO_MODULES.pdv).not.toContain("vendas.pedidos");
  });

  test("com a trava ligada: Essencial vê; override false esconde", () => {
    expect(pedidoNoCaixa({ user: LOJISTA, plano: "essencial", overrides: {}, permissoes: DONO, companyId: LOJA, liberado: true })).toBe(true);
    expect(pedidoNoCaixa({ user: LOJISTA, plano: "negocio", overrides: { "vendas.pedidos": false }, permissoes: DONO, companyId: LOJA, liberado: true })).toBe(false);
  });

  test("consolidado, sem loja e demonstração: nunca", () => {
    const ctx = { user: LOJISTA, plano: "negocio", overrides: {}, permissoes: DONO, liberado: true };
    expect(pedidoNoCaixa({ ...ctx, companyId: LOJA, consolidado: true })).toBe(false);
    expect(pedidoNoCaixa({ ...ctx, companyId: null })).toBe(false);
    expect(pedidoNoCaixa({ ...ctx, companyId: LOJA, isDemo: true })).toBe(false);
  });
});

describe("Guardar com pdv OU vendas (decisão do Caio, 18/11/2026)", () => {
  const guardar = (permissions: Record<string, boolean>, overrides: Record<string, boolean> = {}) =>
    pedidoNoCaixa({ user: LOJISTA, plano: "negocio", overrides, permissoes: { is_owner: false, permissions }, companyId: LOJA, liberado: true });
  const aba = (permissions: Record<string, boolean>) =>
    computeVisibleModules("negocio", {}, { is_owner: false, permissions }).has(MODULO_PEDIDOS);

  test("as duas permissões do Guardar", () => {
    expect([...PERMISSOES_DO_GUARDAR].sort()).toEqual(["pdv", "vendas"]);
  });

  test("membro só com pdv: guarda no Caixa, mas não vê a aba Pedidos", () => {
    expect(guardar({ pdv: true })).toBe(true);
    expect(aba({ pdv: true })).toBe(false);
  });

  test("membro só com vendas: guarda e vê a aba", () => {
    expect(guardar({ vendas: true })).toBe(true);
    expect(aba({ vendas: true })).toBe(true);
  });

  test("membro com pdv e vendas: guarda e vê a aba", () => {
    expect(guardar({ pdv: true, vendas: true })).toBe(true);
    expect(aba({ pdv: true, vendas: true })).toBe(true);
  });

  test("membro sem nenhum dos dois: nem Guardar nem aba", () => {
    expect(guardar({ estoque: true, financeiro: true })).toBe(false);
    expect(guardar({ pdv: false, vendas: false })).toBe(false);
    expect(aba({ estoque: true })).toBe(false);
  });

  test("override false em vendas.pedidos esconde o Guardar até de quem tem pdv", () => {
    expect(guardar({ pdv: true }, { "vendas.pedidos": false })).toBe(false);
  });

  test("dono e conta sem restrição gravada: guardam", () => {
    expect(podeGuardarPedido("essencial", {}, DONO)).toBe(true);
    expect(podeGuardarPedido("essencial", {}, null)).toBe(true);
    expect(podeGuardarPedido("essencial", {}, { is_owner: false })).toBe(true);
  });
});
