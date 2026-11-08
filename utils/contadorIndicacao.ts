// ============================================================
// Contadores do banner de indicação (08/11/2026, card b-mk-30)
//
// O banner "Indique um lojista" do sininho volta a cada 14 dias. Para o
// Marketing saber se ele funciona, o app avisa o backend quando o banner
// aparece na gaveta (vista) e quando tocam em "Gerar meu código" (clique).
// O backend grava em audit_log, uma linha por usuário por banner; aqui só
// evitamos repetir a chamada na mesma sessão.
//
// Nunca atrapalha a tela: sem empresa, banner que não é de indicação ou
// falha de rede, não faz nada.
// ============================================================

import { notificationsApi, type AppBanner } from "@/services/notificationsApi";

export type EventoIndicacao = "vista" | "clique";

const jaAvisados = new Set<string>();

export function ehBannerDaCampanhaDeIndicacao(b: Pick<AppBanner, "campanha"> | null | undefined): boolean {
  return !!b && b.campanha === "indicacao";
}

/** Avisa o backend uma vez por sessão por banner e evento. true = chamou. */
export function registrarEventoDoBanner(
  companyId: string | null | undefined,
  banner: Pick<AppBanner, "id" | "campanha"> | null | undefined,
  evento: EventoIndicacao,
): boolean {
  if (!companyId || !banner || !banner.id || !ehBannerDaCampanhaDeIndicacao(banner)) return false;
  const chave = `${companyId}:${banner.id}:${evento}`;
  if (jaAvisados.has(chave)) return false;
  jaAvisados.add(chave);
  Promise.resolve()
    .then(() => notificationsApi.registrarIndicacao(companyId, banner.id, evento))
    .catch(() => {
      // Deixa tentar de novo numa próxima abertura da gaveta.
      jaAvisados.delete(chave);
    });
  return true;
}

/** Só para teste. */
export function _limparContadorIndicacao(): void {
  jaAvisados.clear();
}
