// ============================================================================
// AURA. — Nome da loja: UMA regra para o app inteiro (21/11/2026)
//
// Pedido do Caio (21/11): trocar o nome em Configurações tem de valer em
// todas as telas, papéis e mensagens, sem ajuste manual. Antes, cada tela
// lia `company.name`, que o login mandava com a RAZÃO SOCIAL primeiro (em
// conta com CPF ou MEI, o nome da dona) e a troca de loja mandava com o nome
// fantasia — o nome mudava conforme a loja tinha sido aberta.
//
// REGRA (a mesma do backend, src/utils/nomeDaLoja.js): nome da loja = nome
// fantasia (`trade_name`) quando preenchido; senão, a razão social
// (`legal_name`). `name` só entra por último (sessão antiga ou demo, que não
// têm os dois campos). Sai aparado.
//
// EXCEÇÕES: o que a lei pede razão social (NFC-e, NF-e, NFS-e, DANFE) é
// montado no backend com `legal_name`; no app, quem precisa da razão social
// usa `razaoSocialDe`.
//
// A empresa do store é atualizada na hora quando o nome é salvo em
// Configurações (useConfigProfile) e relida do /auth/me ao abrir o app e em
// segundo plano (useRevalidarMe) — nunca do JWT.
// ============================================================================

export type EmpresaComNome = {
  trade_name?: string | null;
  legal_name?: string | null;
  name?: string | null;
} | null | undefined;

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Nome da loja para mostrar ao lojista ou à cliente final ("" sem nome). */
export function nomeDaLojaDe(company: EmpresaComNome): string {
  if (!company) return "";
  return texto(company.trade_name) || texto(company.legal_name) || texto(company.name);
}

/** Razão social, para o que a lei ou o contrato pedem razão social. */
export function razaoSocialDe(company: EmpresaComNome): string {
  if (!company) return "";
  return texto(company.legal_name) || texto(company.trade_name) || texto(company.name);
}
