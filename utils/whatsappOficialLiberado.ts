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
// 26/11/2026 — a Meta aprovou o App Review em 25/11. Antes de ligar para
// as lojas, a EQUIPE AURA (is_staff que o backend devolve no usuário, mesmo
// desenho de utils/pedidoLiberado.ts e utils/condicionalLiberada.ts) já vê
// tudo: o Caio conecta o número da própria Aura pela tela do WhatsApp.
// Para o lojista nada muda.
//
// O que NÃO passa por aqui: o WhatsApp manual pelo wa.me (cobrança manual,
// parabéns manual, Chamar sumidos, cupom, suporte) segue igual.
//
// 27/11/2026 — VIRADA: constante em true; a tela nova vale para todas as lojas.
// ============================================================

import { ehEquipeAura } from "@/utils/equipeAura";

export const WHATSAPP_OFICIAL_LIBERADO = true;

/**
 * A trava para quem não tem o status da conexão à mão (menu, Planos,
 * Ótica, Reativação): ligada OU equipe Aura.
 * `liberado` existe para os testes ligarem a trava.
 */
export function whatsappOficialLiberadoPara(
  user: unknown,
  liberado: boolean = WHATSAPP_OFICIAL_LIBERADO,
  sandbox: boolean = false,
): boolean {
  if (liberado === true) return true;
  if (sandbox === true) return true;
  return ehEquipeAura(user);
}

/**
 * 26/11/2026 — a empresa de teste (is_sandbox, a conta de QA da Nina) vê a
 * tela, só para ler; conectar o número segue pelo fluxo de sempre. Vale
 * para a empresa ATUAL da sessão: no consolidado (company null) a flag não
 * conta.
 */
export function empresaSandbox(company: unknown, consolidado: boolean = false): boolean {
  if (consolidado === true) return false;
  return !!company && (company as any).is_sandbox === true;
}

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
 * Mostra o WhatsApp oficial? Trava ligada, equipe Aura OU loja já conectada.
 * `user` é o do useAuthStore; `liberado` existe para os testes ligarem a trava.
 */
export function whatsappOficialVisivel(
  status: WaStatusConexao | null | undefined,
  user: unknown,
  liberado: boolean = WHATSAPP_OFICIAL_LIBERADO,
  sandbox: boolean = false,
): boolean {
  if (whatsappOficialLiberadoPara(user, liberado, sandbox)) return true;
  return lojaJaConectada(status);
}

/** Chave `mod` da tela WhatsApp no NAV (app/(tabs)/_layout.tsx). */
export const MODULO_WHATSAPP_OFICIAL = "whatsapp";
