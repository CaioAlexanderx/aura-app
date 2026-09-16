// ============================================================
// AURA. — Crediário: cliente com dívida em outra loja do grupo
// 16/09/2026 (Davi Calçados / Mary Lucy)
//
// O cadastro é do dono, mas a dívida é da loja que vendeu. O Davi abriu a
// ficha na Matriz, tentou receber e só viu "Confira os dados e tente de
// novo" -- sem nenhuma pista do que conferir. Aqui mora:
//   - a tradução do erro de recebimento em algo que o lojista resolve;
//   - quais lojas do grupo têm saldo da mesma cliente (faixa da ficha);
//   - o link que reabre a ficha depois de trocar de loja.
//
// Funções puras em utils/ de propósito: a ficha importa Icon/Toast, que
// não carregam no Jest.
// Backend: Aura-backend#717 (group_open + code CUSTOMER_NOT_FOUND).
// ============================================================

export type GroupOpenItem = {
  company_id: string;
  company_name: string;
  balance: number;
};

type ErroApi = {
  status?: number;
  isNetworkError?: boolean;
  message?: string;
  data?: { code?: string; error?: string } | null;
} | null | undefined;

export const MSG_RECEBIMENTO_GENERICA =
  "Não foi possível registrar o recebimento. Tente de novo em instantes.";

/**
 * Mensagem do toast quando o recebimento falha. Nunca devolve o texto cru
 * do backend (sem acento, jargão de API); cada caso diz o que fazer.
 */
export function mensagemErroRecebimento(err: ErroApi): string {
  const code = err?.data?.code;
  if (code === "CUSTOMER_NOT_FOUND") {
    return "Esta cliente não está no cadastro desta loja nem das outras lojas do seu grupo. Feche a ficha e abra de novo pela lista.";
  }
  if (code === "CREDIARIO_DISABLED") {
    return "O crediário está desligado nesta loja. Ative em Configurações → PDV → Políticas do Caixa.";
  }
  if (err?.isNetworkError || err?.status === 0) {
    return "Sem conexão com o servidor. Antes de tentar de novo, confira no Histórico se o recebimento já entrou.";
  }
  if (err?.status === 400) {
    return "Confira o valor e a data do recebimento e tente de novo.";
  }
  // 5xx: o ApiError já vem com o texto amigável do servidor ("a falha foi nossa").
  if ((err?.status ?? 0) >= 500 && err?.message) return err.message;
  return MSG_RECEBIMENTO_GENERICA;
}

/** Lojas do grupo (fora a atual) onde a mesma cliente ainda deve algo. */
export function lojasComSaldo(
  groupOpen: GroupOpenItem[] | null | undefined,
  currentCompanyId: string | null | undefined,
): GroupOpenItem[] {
  if (!Array.isArray(groupOpen)) return [];
  return groupOpen.filter(
    (g) => !!g && g.company_id !== currentCompanyId && Number(g.balance) > 0.009,
  );
}

/** Nome curto da loja para o botão: tira o prefixo comum com a loja atual. */
export function nomeCurtoDaLoja(nome: string, nomeAtual?: string | null): string {
  const n = String(nome || "").trim();
  const a = String(nomeAtual || "").trim();
  if (!n || !a) return n;
  const pn = n.split(/\s+/);
  const pa = a.split(/\s+/);
  let i = 0;
  while (i < pn.length - 1 && i < pa.length && pn[i].toLowerCase() === pa[i].toLowerCase()) i++;
  return pn.slice(i).join(" ");
}

/** Rota que reabre a ficha da cliente depois da troca de loja. */
export function rotaFichaNaLoja(customerId: string): string {
  return `/crediario?cliente=${encodeURIComponent(customerId)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê o ?cliente= da rota; só aceita UUID (nada de abrir ficha com lixo). */
export function clienteDaRota(param: string | string[] | null | undefined): string | null {
  const v = Array.isArray(param) ? param[0] : param;
  if (!v) return null;
  const s = String(v).trim();
  return UUID_RE.test(s) ? s : null;
}
