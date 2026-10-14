import { request } from "./api";

// ============================================================
// Check-in de entrada (cartão t1-12, parte 2; backend: frente C)
//
//   GET /companies/:companyId/checkin
//     → { habilitado, respondido, pulou, versao, respostas }
//   PUT /companies/:companyId/checkin
//     body { comeco?, onde_anota?, produtos_faixa?, pulou? }
//     (parcial por chave; strings de até 40 caracteres)
//
// Contrato fixo com o backend: não renomear campos. A tela só aparece com
// `habilitado === true`; erro de rede ou 404 (backend ainda sem a rota)
// significa "não mostrar" — o check-in nunca bloqueia a entrada no app.
// ============================================================

export type CheckinRespostas = {
  comeco?: string | null;
  onde_anota?: string | null;
  produtos_faixa?: string | null;
};

export type CheckinEstado = {
  habilitado: boolean;
  respondido: boolean;
  pulou: boolean;
  versao: number | null;
  respostas: CheckinRespostas;
};

export type CheckinPutBody = {
  comeco?: string;
  onde_anota?: string;
  produtos_faixa?: string;
  pulou?: boolean;
};

export var checkinApi = {
  get: function(companyId: string) {
    // retry 0: um GET que falha vira "não mostrar", sem segurar o Painel.
    return request<unknown>("/companies/" + companyId + "/checkin", { retry: 0, timeout: 6000 });
  },
  put: function(companyId: string, body: CheckinPutBody) {
    return request<unknown>("/companies/" + companyId + "/checkin", { method: "PUT", body: body, retry: 1 });
  },
};

/** Chave do react-query: por empresa. */
export function checkinQueryKey(companyId: string | null | undefined) {
  return ["checkin", companyId || null];
}
