// ============================================================
// AURA. — Estoque só consulta (permissão estoque_consulta)
//
// 30/10/2026: funcionário que vê produtos e quantidades, sem preços, custos
// nem valores, e não grava nada. É a MESMA tela e o MESMO módulo "estoque":
// variação da tela, não tela nova, por isso não tem mod próprio.
//
// A regra é a do backend (src/middleware/estoqueSoConsulta.js), que corta os
// dados e a escrita de verdade; aqui só decide o que aparece. Dono, papel
// admin e permissions null nunca são restringidos. Com estoque e
// estoque_consulta ligados, vale o mais restritivo: consulta. No consolidado
// multi-CNPJ, /auth/my-permissions devolve a interseção das lojas, então a
// regra é a mesma.
//
// Sem React nem store: o jest carrega este arquivo direto.
// ============================================================
import type { OrdemEstoque } from "@/utils/productSort";

export function estaEmConsulta(permData: any): boolean {
  if (!permData || permData.is_owner) return false;
  if (permData.role === "owner" || permData.role === "admin") return false;
  return !!permData.permissions && permData.permissions.estoque_consulta === true;
}

// 03/11/2026 — CUSTO OCULTO. Funcionário com Caixa e Estoque, mas sem
// Financeiro, Painel e o resto da retaguarda, não vê custo, margem nem valor
// do estoque (continua vendo preço e gravando produto). Mesma regra do
// backend (podeVerCusto em src/middleware/estoqueSoConsulta.js, que corta o
// dado de verdade):
//   - dono, admin e permissions null: vê;
//   - estoque_consulta: nunca vê;
//   - permissions.custos (boolean), marcado pelo dono na equipe, decide;
//   - sem a chave: vê quem tem financeiro, relatorios, configuracoes ou
//     painel — painel AUSENTE conta como ligado (useVisibleModules).
export const CHAVES_QUE_VEEM_CUSTO = ["financeiro", "relatorios", "configuracoes", "painel"] as const;

export function podeVerCusto(permData: any): boolean {
  if (!permData || permData.is_owner) return true;
  if (permData.role === "owner" || permData.role === "admin") return true;
  const p = permData.permissions;
  if (!p) return true;
  if (p.estoque_consulta === true) return false;
  if (typeof p.custos === "boolean") return p.custos;
  if (p.painel === undefined) return true;
  return CHAVES_QUE_VEEM_CUSTO.some((k) => p[k] === true);
}

// O que o seletor "Ver custos" da equipe mostra quando o dono ainda não
// marcou nada: o mesmo que a regra decidiria pelas outras chaves.
export function custosPorPadrao(perms: Record<string, boolean> | null | undefined): boolean {
  return podeVerCusto({ is_owner: false, role: "member", permissions: { ...(perms || {}), custos: undefined } });
}

// As duas chaves se excluem no seletor de permissões: ligar uma desliga a outra.
export function alternarPermissao(perms: Record<string, boolean>, chave: string): Record<string, boolean> {
  const next = { ...perms, [chave]: !perms[chave] };
  if (next[chave] && chave === "estoque_consulta") next.estoque = false;
  if (next[chave] && chave === "estoque") next.estoque_consulta = false;
  return next;
}

const ehOrdemDePreco = (o: OrdemEstoque) => o === "price_desc" || o === "price_asc";

export function ordensSemPreco(ordens: readonly OrdemEstoque[]): readonly OrdemEstoque[] {
  return ordens.filter((o) => !ehOrdemDePreco(o));
}

// A escolha lembrada no navegador pode ser por preço (a pessoa já teve outro
// acesso, ou o aparelho é da loja): nesse caso cai no padrão da tela.
export function ordemSemPreco(ordem: OrdemEstoque, padrao: OrdemEstoque): OrdemEstoque {
  return ehOrdemDePreco(ordem) ? padrao : ordem;
}
