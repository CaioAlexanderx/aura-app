// ============================================================
// AURA. — Trava do WhatsApp oficial (Cloud API da Meta), 18/11/2026
//
// O App Review da Meta (Embedded Signup) ainda não saiu: nenhuma loja
// consegue conectar o número oficial. Mesmo assim o app mostrava ao
// assinante tela, plano, régua e cartões prometendo "WhatsApp automático /
// oficial" que não funcionam — e a pergunta chega todo dia. Decisão do
// Caio: tudo isso some atrás desta trava até a Meta aprovar.
//
// Mesmo desenho de utils/pedidoLiberado.ts: uma constante e uma função que
// os testes ligam pelo argumento.
//
// EXCEÇÃO: loja (ou dojô) que JÁ TEM o número conectado continua vendo tudo
// como hoje — hoje é só o dojô Kondei. "Conectada" vem do GET
// /companies/:id/whatsapp/status (services/waApi.ts, WaStatus) que a tela
// já carrega: connected, ou token_expired (o número está cadastrado e só
// precisa reconectar — esconder o aviso deixaria a loja sem saber). Onde a
// tela não tem o status à mão (menu, planos, Painel, Ótica), desligada
// esconde: o Kondei usa as telas do dojô, que têm o status.
//
// O que NÃO passa por aqui: o WhatsApp manual pelo wa.me (cobrança manual,
// parabéns manual, Chamar sumidos, cupom, suporte) segue igual.
//
// COMO LIGAR: trocar a constante para true e publicar o app.
// ============================================================

export const WHATSAPP_OFICIAL_LIBERADO = false;

/** Recorte do WaStatus que interessa aqui (aceita null: status não veio). */
export interface WaStatusConexao {
  connected?: boolean | null;
  token_expired?: boolean | null;
}

/** A loja já passou pelo Embedded Signup e tem o número oficial ligado. */
export function lojaJaConectada(status: WaStatusConexao | null | undefined): boolean {
  if (!status) return false;
  return status.connected === true || status.token_expired === true;
}

/**
 * Mostra o WhatsApp oficial? Trava ligada OU loja já conectada.
 * `liberado` existe para os testes ligarem a trava.
 */
export function whatsappOficialVisivel(
  status: WaStatusConexao | null | undefined,
  liberado: boolean = WHATSAPP_OFICIAL_LIBERADO,
): boolean {
  if (liberado === true) return true;
  return lojaJaConectada(status);
}

/** Chave `mod` da tela WhatsApp no NAV (app/(tabs)/_layout.tsx). */
export const MODULO_WHATSAPP_OFICIAL = "whatsapp";
