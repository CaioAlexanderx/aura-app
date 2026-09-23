// ============================================================
// AURA. — Caixa: o que o lojista lê quando a API falha (QA 23/09/2026).
//
// O backend responde 404 com "Rota nao encontrada" quando a rota ainda não
// existe (ex.: POST /matcon/quotes antes do M1 do backend) — e o Caixa
// mostrava isso cru num toast. Aqui a regra é uma só: mensagem de sistema
// (rota, rede, servidor, inglês) vira o texto neutro de quem chamou; a
// mensagem que o backend escreveu para o lojista ("Cupom expirado",
// "Valor mínimo: R$ 50,00") passa como veio.
// ============================================================

const TEXTO_DE_SISTEMA = /rota n[aã]o encontrada|not found|failed to fetch|network|internal server|timeout|unexpected token|json|undefined|null/i;

/** 404 = a rota não existe (ou o recurso sumiu) — nada que o lojista resolva. */
export function ehRotaAusente(err: any): boolean {
  return Number(err?.status) === 404;
}

/** Texto do erro para o toast do Caixa: o do backend quando é frase para o
 *  lojista; senão, `padrao`. */
export function textoDoErro(err: any, padrao: string): string {
  if (!err || ehRotaAusente(err) || err.isNetworkError) return padrao;
  const bruto = String(err?.data?.error || err?.message || "").trim();
  if (!bruto || TEXTO_DE_SISTEMA.test(bruto)) return padrao;
  return bruto;
}
