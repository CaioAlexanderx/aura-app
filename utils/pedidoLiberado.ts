// ============================================================
// AURA. — Trava do Pedido separado de venda (p-60 a p-63, 17/11/2026)
//
// Nada do Pedido aparece para lojista até o Caio ligar a trava, num PR
// próprio, com o sinal, a conclusão e o cancelamento no ar (A3, A6 e A7).
// Sem isso a lojista guardaria pedido sem conseguir concluir nem cancelar.
//
// Mesmo desenho da trava do backend (Aura-backend, services/pedidoBalcao.js,
// pedidoLiberado): desligada, só a equipe Aura (is_staff que o backend
// devolve no usuário) usa, para QA em produção. As rotas do backend
// respondem 404 para o lojista enquanto a trava de lá estiver desligada.
//
// Além da trava, cada tela confere o próprio módulo (vendas.pedidos, regra
// 3 do CLAUDE.md) em useVisibleModules: no plano ou na permissão sem a
// chave, o Pedido some.
// ============================================================
import { ehEquipeAura } from "@/utils/equipeAura";

export const PEDIDO_LIBERADO = false;

/** A trava lida por função: os testes ligam pelo segundo argumento. */
export function pedidoLiberado(user: unknown, liberado: boolean = PEDIDO_LIBERADO): boolean {
  if (liberado === true) return true;
  return ehEquipeAura(user);
}

/** Chave do módulo da aba Pedidos (a mesma do backend, services/modules.js). */
export const MODULO_PEDIDOS = "vendas.pedidos";
