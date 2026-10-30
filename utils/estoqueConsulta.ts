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
