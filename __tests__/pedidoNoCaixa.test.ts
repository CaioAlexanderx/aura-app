// ============================================================
// Pedido separado de venda (A1): quem vê o "Guardar > Pedido" no Caixa.
// Trava PEDIDO_LIBERADO (utils/pedido.ts) e módulo próprio vendas.pedidos
// (hooks/useVisibleModules.ts), regra 3 do CLAUDE.md.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

import { PEDIDO_LIBERADO, pedidoLiberado, pedidoNoCaixa, MODULO_PEDIDO } from "@/utils/pedido";
import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";

const LOJA = "empresa-1";

describe("trava PEDIDO_LIBERADO", () => {
  test("nasce desligada: nenhum lojista vê nada", () => {
    expect(PEDIDO_LIBERADO).toBe(false);
    expect(pedidoLiberado()).toBe(false);
  });

  test("desligada, nem dono do Negócio vê o Pedido no Caixa", () => {
    const modulos = computeVisibleModules("negocio", {}, { is_owner: true });
    expect(pedidoNoCaixa({ modulos, companyId: LOJA })).toBe(false);
  });
});

describe("módulo próprio vendas.pedidos", () => {
  test("está no mapa de planos (Essencial) e em permissão própria", () => {
    expect(MODULO_PEDIDO).toBe("vendas.pedidos");
    expect(MODULE_PLAN_MAP["vendas.pedidos"]).toBe("essencial");
    expect(PERM_TO_MODULES["vendas.pedidos"]).toEqual(["vendas.pedidos"]);
    expect(PERM_TO_MODULES.pdv).toContain("vendas.pedidos");
  });

  test("com a trava ligada: Essencial vê; override false esconde", () => {
    const essencial = computeVisibleModules("essencial", {}, { is_owner: true });
    expect(pedidoNoCaixa({ modulos: essencial, companyId: LOJA, liberado: true })).toBe(true);
    const escondido = computeVisibleModules("negocio", { "vendas.pedidos": false }, { is_owner: true });
    expect(pedidoNoCaixa({ modulos: escondido, companyId: LOJA, liberado: true })).toBe(false);
  });

  test("membro: com pdv vê; sem pdv nem vendas.pedidos não vê", () => {
    const comPdv = computeVisibleModules("negocio", {}, { is_owner: false, permissions: { pdv: true } });
    expect(pedidoNoCaixa({ modulos: comPdv, companyId: LOJA, liberado: true })).toBe(true);
    const soVendas = computeVisibleModules("negocio", {}, { is_owner: false, permissions: { vendas: true } });
    expect(pedidoNoCaixa({ modulos: soVendas, companyId: LOJA, liberado: true })).toBe(false);
    const soPedido = computeVisibleModules("negocio", {}, { is_owner: false, permissions: { "vendas.pedidos": true } });
    expect(pedidoNoCaixa({ modulos: soPedido, companyId: LOJA, liberado: true })).toBe(true);
  });

  test("consolidado, sem loja e demonstração: nunca", () => {
    const modulos = computeVisibleModules("negocio", {}, { is_owner: true });
    expect(pedidoNoCaixa({ modulos, companyId: LOJA, consolidado: true, liberado: true })).toBe(false);
    expect(pedidoNoCaixa({ modulos, companyId: null, liberado: true })).toBe(false);
    expect(pedidoNoCaixa({ modulos, companyId: LOJA, isDemo: true, liberado: true })).toBe(false);
  });

  test("a chave nova não muda o que os outros módulos mostram", () => {
    const antes = new Set(["pdv", "os", "cupons"]);
    const membro = computeVisibleModules("negocio", {}, { is_owner: false, permissions: { pdv: true } });
    antes.forEach((m) => expect(membro.has(m)).toBe(true));
    expect([...membro].sort()).toEqual(["cupons", "os", "painel", "pdv", "vendas.pedidos"]);
  });
});
