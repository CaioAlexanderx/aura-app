import { useEffect, useRef } from "react";
import { billingApi } from "@/services/api";

// 17/10/2026 (t2-04) — avisa o backend que a tela de checkout abriu.
//
// O degrau "viu checkout" do painel da Gestão Aura (Trials por degrau) estava
// em 0: o backend só registrava `checkout.viewed` para conta com trial já
// vencido. Esta chamada cobre quem abre o checkout ainda dentro do trial.
//
// Uma vez por abertura da tela e por empresa: re-render, troca de plano/ciclo,
// refetch do status e o StrictMode do dev não repetem. O `company` costuma
// hidratar depois do mount (/auth/me), então o efeito espera o id existir.
// Passe `null` para não registrar (demo, staff). Fire-and-forget: falha de
// rede ou backend antigo (404) nunca aparece para o cliente. O backend ainda
// limita a uma linha por empresa a cada 24h.
export function useCheckoutViewed(companyId: string | null | undefined) {
  var enviado = useRef<string | null>(null);
  useEffect(function () {
    if (!companyId || enviado.current === companyId) return;
    enviado.current = companyId;
    Promise.resolve()
      .then(function () { return billingApi.checkoutViewed(companyId); })
      .catch(function () { /* instrumentação: nunca incomoda quem está assinando */ });
  }, [companyId]);
}
