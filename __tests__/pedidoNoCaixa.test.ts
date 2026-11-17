// ============================================================
// Pedido separado de venda (A1): quem vê o "Guardar > Pedido" no Caixa.
// Trava PEDIDO_LIBERADO (utils/pedidoLiberado.ts, a mesma da aba Pedidos,
// aura-app#1320) e o módulo vendas.pedidos
// (hooks/useVisibleModules.ts), regra 3 do CLAUDE.md.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

import { pedidoNoCaixa } from "@/utils/pedido";
import { PEDIDO_LIBERADO, pedidoLiberado, MODULO_PEDIDOS } from "@/utils/pedidoLiberado";
import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";

const LOJA = "empresa-1";
const LOJISTA = { id: "u-1", is_staff: false };
const EQUIPE = { id: "u-2", is_staff: true };

describe("trava PEDIDO_LIBERADO", () => {
  test("nasce desligada: nenhum lojista vê nada", () => {
    expect(PEDIDO_LIBERADO).toBe(false);
    expect(pedidoLiberado(LOJISTA)).toBe(false);
  });

  test("desligada, nem dono do Negócio vê o Pedido no Caixa", () => {
    const modulos = computeVisibleModules("negocio", {}, { is_owner: true });
    expect(pedidoNoCaixa({ user: LOJISTA, modulos, companyId: LOJA })).toBe(false);
    expect(pedidoNoCaixa({ user: null, modulos, companyId: LOJA })).toBe(false);
  });

  test("desligada, a equipe Aura vê (QA em produção, como no backend)", () => {
    const modulos = computeVisibleModules("negocio", {}, { is_owner: true });
    expect(pedidoNoCaixa({ user: EQUIPE, modulos, companyId: LOJA })).toBe(true);
  });
});

describe("módulo próprio vendas.pedidos", () => {
  test("está no mapa de planos (Essencial) e entra pela permissão vendas (aura-app#1320)", () => {
    expect(MODULO_PEDIDOS).toBe("vendas.pedidos");
    expect(MODULE_PLAN_MAP["vendas.pedidos"]).toBe("essencial");
    expect(PERM_TO_MODULES.vendas).toContain("vendas.pedidos");
    expect(PERM_TO_MODULES.pdv).not.toContain("vendas.pedidos");
  });

  test("com a trava ligada: Essencial vê; override false esconde", () => {
    const essencial = computeVisibleModules("essencial", {}, { is_owner: true });
    expect(pedidoNoCaixa({ user: LOJISTA, modulos: essencial, companyId: LOJA, liberado: true })).toBe(true);
    const escondido = computeVisibleModules("negocio", { "vendas.pedidos": false }, { is_owner: true });
    expect(pedidoNoCaixa({ user: LOJISTA, modulos: escondido, companyId: LOJA, liberado: true })).toBe(false);
  });

  test("membro: com vendas vê; só com pdv, não (a regra da aba Pedidos)", () => {
    const caixaEVendas = computeVisibleModules("negocio", {}, { is_owner: false, permissions: { pdv: true, vendas: true } });
    expect(pedidoNoCaixa({ user: LOJISTA, modulos: caixaEVendas, companyId: LOJA, liberado: true })).toBe(true);
    const soCaixa = computeVisibleModules("negocio", {}, { is_owner: false, permissions: { pdv: true } });
    expect(pedidoNoCaixa({ user: LOJISTA, modulos: soCaixa, companyId: LOJA, liberado: true })).toBe(false);
    const nenhum = computeVisibleModules("negocio", {}, { is_owner: false, permissions: { estoque: true } });
    expect(pedidoNoCaixa({ user: LOJISTA, modulos: nenhum, companyId: LOJA, liberado: true })).toBe(false);
  });

  test("consolidado, sem loja e demonstração: nunca", () => {
    const modulos = computeVisibleModules("negocio", {}, { is_owner: true });
    expect(pedidoNoCaixa({ user: LOJISTA, modulos, companyId: LOJA, consolidado: true, liberado: true })).toBe(false);
    expect(pedidoNoCaixa({ user: LOJISTA, modulos, companyId: null, liberado: true })).toBe(false);
    expect(pedidoNoCaixa({ user: LOJISTA, modulos, companyId: LOJA, isDemo: true, liberado: true })).toBe(false);
  });

});
