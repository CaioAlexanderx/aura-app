// ============================================================
// AURA. — Para onde vai o link do assento de temporada (p-105, 11/11/2026)
//
// Antes, o botão do assento mandava ao checkout com o plano da conta marcado
// (a conta da Expansão chegava com o plano mais caro) e o muro de assinatura
// (app/_layout) levava quem não estava em dia para o Caixa ou para o
// checkout sem dizer por quê. Agora:
//
//   assinante em dia     → /black-friday#assento: cai no cartão do assento,
//                          nunca no checkout (a página rola até a seção);
//   sem assinatura       → frase do assento + "Ver os planos", que abre o
//   (teste vencido)        checkout com o Negócio marcado (nunca a Expansão);
//   valor combinado      → "Fale com a equipe", no WhatsApp de ajuda;
//   em atraso            → "Regularize a mensalidade para contratar", com o
//                          link da cobrança em aberto;
//   Studio, Odonto, Food → como estão até a unificação com o Negócio.
//
// Login: o AuthGuard guarda caminho + query do link aberto sem sessão
// (utils/destinoDepoisDoLogin), mas não o "#". Por isso a página aceita
// também ?secao=assento, que sobrevive ao login.
// ============================================================

export const SECAO_ASSENTO = "assento";
/** O link do assento para quem está em dia (dentro do app). */
export const ROTA_DO_ASSENTO = "/black-friday#" + SECAO_ASSENTO;
/** O mesmo destino na forma que sobrevive ao login (links de fora do app). */
export const ROTA_DO_ASSENTO_COM_LOGIN = "/black-friday?secao=" + SECAO_ASSENTO;
/** "Ver os planos" do cartão do assento: o Negócio marcado. */
export const ROTA_PLANOS_DO_ASSENTO = "/(tabs)/checkout?plan=negocio";

export const TEXTO_ASSENTO_SEM_ASSINATURA = "Para contratar o assento, a loja precisa de uma assinatura ativa.";
export const TEXTO_ASSENTO_EM_ATRASO = "Regularize a mensalidade para contratar.";
export const MENSAGEM_WHATSAPP_ASSENTO = "Oi, Aura! Tenho valor combinado e quero contratar o assento de temporada para a minha loja.";

/** "#assento", "assento", ["assento"] → "assento"; o resto (lixo do router incluso) → null. */
export function secaoDoLink(v: unknown): string | null {
  var bruto = Array.isArray(v) ? v[0] : v;
  if (typeof bruto !== "string") return null;
  var s = bruto.trim().replace(/^#/, "").toLowerCase();
  if (!s || s === "undefined" || s === "null") return null;
  return /^[a-z0-9-]+$/.test(s) ? s : null;
}

/** A seção pedida pela URL: o "#" vence; senão, ?secao=. */
export function secaoPedida(o: { hash?: unknown; secao?: unknown }): string | null {
  return secaoDoLink(o.hash) || secaoDoLink(o.secao);
}

/** Lê "#..." e "?secao=" da barra de endereço (web). Fora da web, nada. */
export function secaoDaBarraDeEndereco(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  try {
    var secao: string | null = null;
    try { secao = new URLSearchParams(window.location.search || "").get("secao"); } catch { secao = null; }
    return secaoPedida({ hash: window.location.hash, secao: secao });
  } catch {
    return null;
  }
}

/** A tela pedida é o cartão do assento na página Black Friday? */
export function pedeOAssento(segments: readonly string[], secao: string | null): boolean {
  return segments[0] === "(tabs)" && segments[1] === "black-friday" && secao === SECAO_ASSENTO;
}

/**
 * Muro de assinatura (app/_layout): para onde vai quem não está em dia e
 * abriu o link do assento. Só o shell Negócio; as outras verticais seguem o
 * muro de sempre.
 *   em atraso → checkout com a frase da mensalidade e o link da cobrança;
 *   sem assinatura → checkout com o Negócio marcado e a frase do assento.
 */
export function destinoDoAssentoSemAssinatura(o: { emAtraso: boolean }): string {
  return o.emAtraso ? "/(tabs)/checkout?de=assento" : "/(tabs)/checkout?plan=negocio&de=assento";
}
