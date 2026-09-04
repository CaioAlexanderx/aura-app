// ============================================================
// components/studio/storefront/enderecoDaApi.ts
//
// O endereço da API para a VITRINE — um domínio NOSSO.
//
// ── O QUE ACONTECEU (02/09/2026) ───────────────────────────────────────
// O domínio público do Railway (`*.up.railway.app`) — o nome que o
// PROVEDOR dá à nossa aplicação — passou a devolver 503 enquanto a
// aplicação continuava viva e respondendo por `loja.getaura.com.br`.
// Todas as lojas abriam e nada que dependesse da API funcionava.
//
// O backend aprendeu a lição naquele dia (src/config/enderecoDaApi.js).
// O app não: `EXPO_PUBLIC_API_URL` existe, mas o valor de reserva em
// mais de quarenta arquivos continua sendo o nome do provedor. Enquanto
// a variável estiver certa no build, ninguém vê; no dia em que faltar, a
// loja fica muda de novo.
//
// ── POR QUE SÓ A VITRINE ───────────────────────────────────────────────
// Trocar os quarenta é uma limpeza à parte, e arriscada de fazer junto
// com outra coisa. A vitrine é a superfície que VENDE e a única servida
// sob uma CSP (loja.getaura.com.br), onde um endereço fora da lista não
// é lentidão: é a loja em branco. Ela vai primeiro.
//
// A ordem é deliberada: a variável de ambiente ainda vence, para um
// ambiente de teste poder apontar para outro lugar. O que mudou é a
// RESERVA — de nome do provedor para nome nosso.
// ============================================================

/** O domínio da nossa API. Um nome que sobrevive a troca de provedor. */
export const API_DA_AURA = "https://api.getaura.com.br/api/v1";

/**
 * O endereço que a vitrine usa para falar com a API.
 *
 * Fica em módulo, e não repetido em cada arquivo, porque três cópias da
 * mesma constante são três lugares para esquecer de mudar — foi assim
 * que o nome do provedor chegou a quarenta arquivos.
 */
export function enderecoDaApi(): string {
  const doAmbiente =
    typeof process !== "undefined" ? (process.env as any)?.EXPO_PUBLIC_API_URL : null;
  return (typeof doAmbiente === "string" && doAmbiente.trim()) || API_DA_AURA;
}
