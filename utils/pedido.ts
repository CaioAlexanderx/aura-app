// ============================================================
// AURA. — Pedido separado de venda: trava e regra de quem vê (A1, p-63a)
//
// O Caixa guarda a venda como PEDIDO: as peças ficam reservadas para a
// cliente buscar depois (mockup aprovado pelo Caio em 17/11/2026). Pedido
// não é venda: não baixa estoque nem mexe no caixa até concluir.
//
// Trava geral PEDIDO_LIBERADO = false: nada do Pedido aparece na tela de
// ninguém. O recurso só liga com o sinal (A3), a conclusão (A6a/A6b) e o
// cancelamento (A7) no ar e conferidos pela Célia; sem eles a lojista
// guardaria um pedido que não consegue concluir nem cancelar. Ligar é trocar
// para true num PR próprio, com o OK do Caio, junto da variável de mesmo
// nome no backend (Aura-backend, services/pedidoBalcao.js).
//
// Módulo próprio "vendas.pedidos" (regra 3 do CLAUDE.md), Essencial pela
// pendência 1 do mockup: em hooks/useVisibleModules.ts (MODULE_PLAN_MAP e
// PERM_TO_MODULES) e em services/modules.js do backend (Aura-backend#1073).
//
// Multi-CNPJ: o pedido é de UMA loja. Guardar no consolidado não existe (o
// Caixa já exige uma loja, RequireCompanyScope); a leitura consolidada é da
// aba Pedidos (A5a, GET /me/pedidos).
//
// Função pura, sem hook: o Caixa (hooks/usePdvState.ts) e os testes leem a
// MESMA conta.
// ============================================================

export const PEDIDO_LIBERADO = false;

/** A trava geral, lida por função (os testes ligam pelo parâmetro). */
export function pedidoLiberado(liberado: boolean = PEDIDO_LIBERADO): boolean {
  return liberado === true;
}

/** O módulo próprio do Pedido. Nunca herdar o de outra tela. */
export const MODULO_PEDIDO = "vendas.pedidos";

type Contexto = {
  /** Conjunto de useVisibleModules (plano + override + permissão do membro). */
  modulos: Set<string> | null | undefined;
  /** Empresa ativa do Caixa (null no consolidado). */
  companyId: string | null | undefined;
  consolidado?: boolean;
  /** Conta de demonstração: o servidor não guarda pedido de mentira. */
  isDemo?: boolean;
  liberado?: boolean;
};

/** O "Guardar > Pedido" aparece no Caixa? Desligado = o rodapé de sempre. */
export function pedidoNoCaixa({ modulos, companyId, consolidado, isDemo, liberado = PEDIDO_LIBERADO }: Contexto): boolean {
  if (!pedidoLiberado(liberado)) return false;
  if (!companyId || consolidado || isDemo) return false;
  return !!modulos && modulos.has(MODULO_PEDIDO);
}
