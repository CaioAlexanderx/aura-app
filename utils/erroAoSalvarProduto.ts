// ============================================================
// AURA. — Mensagem do erro ao salvar (editar) produto
//
// 14/11/2026: a edição mostrava sempre "Erro ao atualizar produto", mesmo
// quando o servidor explicava o motivo — ex.: código de barras que já está
// em outro produto da loja (409 BARCODE_DUPLICADO, backend). Erro 4xx
// traz a explicação para a lojista; 5xx e rede seguem com o texto padrão.
// ============================================================

export function mensagemDoErroAoSalvar(err: any, padrao: string): string {
  const status = Number(err?.status);
  const msg = typeof err?.message === "string" ? err.message.trim() : "";
  if (msg && status >= 400 && status < 500) return msg;
  return padrao;
}
