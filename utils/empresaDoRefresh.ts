// ─── Empresa que vai no corpo do /auth/refresh ────────────────────────────────
// 09/11/2026 (defeito: depois de 1 h a empresa escolhida no seletor voltava
// sozinha para a principal ou para o consolidado).
//
// O backend assinava o access token novo sempre com o contexto padrão. Agora
// o app conta em que empresa a pessoa está (`company_id`: o id, ou "all" no
// consolidado) e o backend CONFERE o acesso antes de assinar; sem acesso, cai
// no padrão. Backend antigo ignora o campo.
//
// De onde vem: primeiro do próprio access token (mesmo vencido, o payload diz
// em que empresa a sessão estava; o switchCompany grava token e estado
// juntos). Na abertura a frio o estado ainda não tem a empresa (o /me não
// voltou), então o token é a fonte mais segura. Sem token legível, o estado.
// ─────────────────────────────────────────────────────────────────────────────

export type EmpresaDoRefresh = string | "all" | null;

export function lerPayloadDoToken(token: string | null | undefined): Record<string, any> | null {
  if (!token || typeof token !== "string") return null;
  try {
    const parte = token.split(".")[1];
    if (!parte || typeof atob !== "function") return null;
    const json = atob(parte.replace(/-/g, "+").replace(/_/g, "/"));
    const v = JSON.parse(json);
    return v && typeof v === "object" ? v : null;
  } catch { return null; }
}

export function empresaParaORefresh(
  estado: { consolidatedView?: boolean; company?: { id?: string } | null } | null | undefined,
  token: string | null | undefined,
): EmpresaDoRefresh {
  const p = lerPayloadDoToken(token);
  if (p) {
    if (p.consolidated_view === true) return "all";
    if (typeof p.company === "string" && p.company) return p.company;
  }
  if (estado?.consolidatedView) return "all";
  const id = estado?.company?.id;
  return typeof id === "string" && id ? id : null;
}

/**
 * O servidor assinou outro contexto que não o pedido? (a pessoa perdeu o
 * acesso à empresa). Só vale quando o backend manda `current_company_id`.
 */
export function contextoMudou(pedida: EmpresaDoRefresh, resposta: any): boolean {
  if (!pedida || !resposta || typeof resposta !== "object" || !("current_company_id" in resposta)) return false;
  if (pedida === "all") return resposta.consolidated_view !== true;
  return resposta.consolidated_view === true || resposta.current_company_id !== pedida;
}
