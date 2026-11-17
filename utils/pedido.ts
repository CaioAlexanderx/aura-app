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
// hooks/useVisibleModules.ts. No Caixa ela vem pela permissão pdv.
//
// Multi-CNPJ: o pedido é de UMA loja. Guardar no consolidado não existe (o
// Caixa já exige uma loja, RequireCompanyScope); a leitura consolidada é da
// aba Pedidos (GET /me/pedidos).
// ============================================================
import { pedidoLiberado, MODULO_PEDIDOS } from "@/utils/pedidoLiberado";

type Contexto = {
  /** Usuário da sessão (o is_staff vem do backend). */
  user: unknown;
  /** Conjunto de useVisibleModules (plano + override + permissão do membro). */
  modulos: Set<string> | null | undefined;
  /** Empresa ativa do Caixa (null no consolidado). */
  companyId: string | null | undefined;
  consolidado?: boolean;
  /** Conta de demonstração: o servidor não guarda pedido de mentira. */
  isDemo?: boolean;
  /** Para os testes: a trava ligada. */
  liberado?: boolean;
};

/** O "Guardar > Pedido" aparece no Caixa? Desligado = o rodapé de sempre. */
export function pedidoNoCaixa({ user, modulos, companyId, consolidado, isDemo, liberado }: Contexto): boolean {
  if (!pedidoLiberado(user, liberado)) return false;
  if (!companyId || consolidado || isDemo) return false;
  return !!modulos && modulos.has(MODULO_PEDIDOS);
}
