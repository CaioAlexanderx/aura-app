// ============================================================
// AURA. — Link abre a empresa certa em conta multi-CNPJ (tq-92, 24/10/2026)
//
// Medido em 21/10: a empresa ativa vem do JWT; login e refresh com 2 ou mais
// empresas caem no consolidado, e nenhuma tela lia ?empresa=. O link do
// e-mail de uma filial abria o consolidado (ou a última empresa usada).
//
// Agora os links levam ?empresa=<company_id>. Antes de mostrar a tela, o
// app troca para essa empresa pelo switch que já existe (POST
// /auth/switch-company, que valida o acesso no servidor) e tira o parâmetro
// da URL. Sem acesso, fica na empresa atual com um aviso discreto.
//
// Junto com o tq-91: link sem sessão → login → volta para o caminho guardado
// (com a query, inclusive ?empresa=) → aqui troca a empresa.
//
// Funções puras aqui; o efeito mora em hooks/useEmpresaPeloLink.
//
// 26/10/2026 (relatório de várias lojas): o e-mail do dono com mais de uma
// loja leva ?empresa=todas nos blocos do grupo ("Ver as vendas do grupo").
// "todas" (e "all") viram CONSOLIDADO e o app troca para o consolidado pelo
// mesmo switch (switchCompany("all")), só para quem tem mais de uma empresa;
// com uma empresa só, o parâmetro é ignorado (ver o hook).
// ============================================================

/** Valor de ?empresa= que pede o consolidado (o mesmo id do switchCompany). */
export const CONSOLIDADO = "all";

/**
 * O valor de ?empresa= é aceitável? Um id de empresa, ou "todas"/"all"
 * (consolidado), que volta como CONSOLIDADO.
 */
export function lerEmpresaDoLink(valor: unknown): string | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (typeof v !== "string") return null;
  const id = v.trim();
  if (!id) return null;
  const minusculo = id.toLowerCase();
  if (minusculo === "todas" || minusculo === "all") return CONSOLIDADO;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return id;
}

/**
 * Precisa trocar?
 *   consolidado pedido: só se ainda não está no consolidado;
 *   uma empresa: no consolidado sempre; numa empresa, só se for outra.
 */
export function precisaTrocarEmpresa(
  id: string,
  atual: { companyId?: string | null; consolidatedView?: boolean },
): boolean {
  if (id === CONSOLIDADO) return !atual.consolidatedView;
  if (atual.consolidatedView) return true;
  return String(atual.companyId ?? "") !== id;
}

/** O consolidado só existe para quem tem mais de uma empresa. */
export function podeAbrirConsolidado(companyCount: number | null | undefined): boolean {
  return (Number(companyCount) || 0) > 1;
}

/** A mesma URL sem o ?empresa= (mantém o resto da query e o #). Null se não havia. */
export function urlSemEmpresa(href: string): string | null {
  try {
    const u = new URL(href);
    if (!u.searchParams.has("empresa")) return null;
    u.searchParams.delete("empresa");
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

/** Aviso discreto quando a troca não deu certo. */
export function avisoSemAcesso(status?: number): string {
  if (status === 403 || status === 404) {
    return "Esse link é de uma empresa que não está no seu acesso. Você continua na empresa atual.";
  }
  return "Não deu para abrir a empresa desse link agora. Você continua na empresa atual.";
}
