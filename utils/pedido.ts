// ============================================================
// AURA. — Pedido separado de venda: quem vê o "Guardar > Pedido" no Caixa
// (A1, p-63a, 17/11/2026)
//
// O Caixa guarda a venda como PEDIDO: as peças ficam reservadas para a
// cliente buscar depois (mockup aprovado pelo Caio em 17/11/2026). Pedido
// não é venda: não baixa estoque nem mexe no caixa até concluir.
//
// A trava é a MESMA da aba Pedidos (utils/pedidoLiberado.ts, aura-app#1320):
// PEDIDO_LIBERADO = false, e com ela desligada só a equipe Aura (is_staff do
// backend) vê, para QA em produção, como as rotas do backend. Nenhum lojista
// vê nada até o Caio ligar a trava com o sinal (A3), a conclusão (A6) e o
// cancelamento (A7) no ar.
//
// Módulo: a mesma chave "vendas.pedidos" (MODULO_PEDIDOS), Essencial, em
// hooks/useVisibleModules.ts: o plano e o override dela valem aqui também.
//
// Permissão do membro (decisão do Caio, 18/11/2026): o GUARDAR vale com pdv
// OU vendas. Quem opera o Caixa (só pdv) guarda o pedido; a aba Pedidos em
// Vendas continua só com vendas (PERM_TO_MODULES não muda). O backend aceita
// o POST /companies/:id/pedidos de qualquer membro da loja (só
// requireCompanyAccess + a trava), então nada muda lá.
//
// Multi-CNPJ: o pedido é de UMA loja. Guardar no consolidado não existe (o
// Caixa já exige uma loja, RequireCompanyScope); a leitura consolidada é da
// aba Pedidos (GET /me/pedidos).
// ============================================================
import { pedidoLiberado, MODULO_PEDIDOS } from "@/utils/pedidoLiberado";
import { computeVisibleModules } from "@/hooks/useVisibleModules";

/** Permissões do membro que dão o "Guardar > Pedido" (basta uma). */
export const PERMISSOES_DO_GUARDAR = ["pdv", "vendas"] as const;

type Contexto = {
  /** Usuário da sessão (o is_staff vem do backend). */
  user: unknown;
  /** Plano da empresa ativa (company.plan). */
  plano: string | null | undefined;
  /** module_overrides da empresa ativa. */
  overrides: Record<string, boolean> | null | undefined;
  /** Resposta de /auth/my-permissions (a mesma do menu). */
  permissoes: any;
  /** Empresa ativa do Caixa (null no consolidado). */
  companyId: string | null | undefined;
  consolidado?: boolean;
  /** Conta de demonstração: o servidor não guarda pedido de mentira. */
  isDemo?: boolean;
  /** Para os testes: a trava ligada. */
  liberado?: boolean;
};

/**
 * Plano + override de vendas.pedidos (como o menu) e, para membro, pdv OU
 * vendas. Dono (ou sem restrição gravada) passa pela permissão.
 */
export function podeGuardarPedido(plano: string | null | undefined, overrides: Record<string, boolean> | null | undefined, permissoes: any): boolean {
  if (!computeVisibleModules(plano, overrides, null).has(MODULO_PEDIDOS)) return false;
  if (!permissoes || permissoes.is_owner || !permissoes.permissions) return true;
  return PERMISSOES_DO_GUARDAR.some((k) => !!permissoes.permissions[k]);
}

/** O "Guardar > Pedido" aparece no Caixa? Desligado = o rodapé de sempre. */
export function pedidoNoCaixa({ user, plano, overrides, permissoes, companyId, consolidado, isDemo, liberado }: Contexto): boolean {
  if (!pedidoLiberado(user, liberado)) return false;
  if (!companyId || consolidado || isDemo) return false;
  return podeGuardarPedido(plano, overrides, permissoes);
}
