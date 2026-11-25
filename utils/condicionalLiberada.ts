// ============================================================
// AURA. — Trava da Venda condicional (C4, 25/11/2026)
//
// Nada da condicional aparece para lojista até o Caio ligar a trava, num PR
// próprio, com guardar, decidir e cobrar no ar (C1 a C14). Sem isso a
// lojista veria uma aba que ainda não guarda nada.
//
// Mesmo desenho da trava do Pedido (utils/pedidoLiberado.ts): desligada, só
// a equipe Aura (is_staff que o backend devolve no usuário) vê, para QA em
// produção.
//
// Além da trava, a aba confere o próprio módulo (vendas.condicionais, regra
// 3 do CLAUDE.md) em useVisibleModules: no plano ou na permissão sem a
// chave, a condicional some (sem aba, botão, selo nem cadeado).
// ============================================================
import { ehEquipeAura } from "@/utils/equipeAura";

export const CONDICIONAL_LIBERADA = false;

/** A trava lida por função: os testes ligam pelo segundo argumento. */
export function condicionalLiberada(user: unknown, liberada: boolean = CONDICIONAL_LIBERADA): boolean {
  if (liberada === true) return true;
  return ehEquipeAura(user);
}

/** Chave do módulo da aba Condicionais (em Vendas). */
export const MODULO_CONDICIONAIS = "vendas.condicionais";
