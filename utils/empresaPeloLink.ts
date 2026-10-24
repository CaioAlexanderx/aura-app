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
// ============================================================

/** O valor de ?empresa= é um id de empresa aceitável? "all" (consolidado) não entra. */
export function lerEmpresaDoLink(valor: unknown): string | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (typeof v !== "string") return null;
  const id = v.trim();
  if (!id || id.toLowerCase() === "all") return null;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return id;
}

/** Precisa trocar? No consolidado sempre; numa empresa, só se for outra. */
export function precisaTrocarEmpresa(
  id: string,
  atual: { companyId?: string | null; consolidatedView?: boolean },
): boolean {
  if (atual.consolidatedView) return true;
  return String(atual.companyId ?? "") !== id;
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
