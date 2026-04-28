import { useEffect, useRef } from "react";
import { Redirect } from "expo-router";
import { DentalShell } from "@/components/dental/DentalShell";
import { PortalTransition } from "@/components/dental/PortalTransition";
import { useAuthStore } from "@/stores/auth";
import { usePortalTransition } from "@/stores/portalTransition";

// ============================================================
// Layout da experiencia Aura Odonto autenticada.
//
// Substitui (tabs)/_layout para o usuario com vertical=odonto.
// AuthGuard em app/_layout.tsx redireciona /(tabs) para ca
// quando company.vertical_active === "odonto".
//
// Hard guard: alguem sem vertical=odonto que tente acessar
// /dental/(clinic)/* direto pela URL eh redirecionado pra
// /(tabs). Evita renderizar shell dental + tentar carregar
// dados odonto pra empresa que nao tem a vertical ativa.
//
// Aguardamos isHydrated antes de decidir: sem isso, o primeiro
// render (com company=null vindo do storage async) jogaria todo
// mundo pra /(tabs) antes do auth terminar de carregar.
//
// PortalTransition: anima 3s de entrada uma vez por sessao
// (estado em-memory em usePortalTransition). Reset natural a
// cada hard reload.
// ============================================================

export default function DentalClinicLayout() {
  const { company, isHydrated } = useAuthStore();
  const { shown, markShown, reset: resetPortal } = usePortalTransition();
  const lastCompanyIdRef = useRef<string | null>(null);

  // PR24 #9: reseta a animacao do portal quando a empresa muda (login fresh,
  // troca de empresa). Garante que clientes vendo a sessao pela 1a vez
  // sempre vejam a intro, mesmo se o store em-memory tiver vindo cacheado
  // por algum efeito de hidratacao do RN web.
  useEffect(() => {
    const cid = (company as any)?.id || null;
    if (lastCompanyIdRef.current !== cid) {
      if (lastCompanyIdRef.current !== null) {
        // Empresa trocou de fato (nao primeiro render). Reseta pra
        // mostrar intro de novo.
        resetPortal();
      }
      lastCompanyIdRef.current = cid;
    }
  }, [(company as any)?.id, resetPortal]);

  if (!isHydrated) return null;

  if ((company as any)?.vertical_active !== "odonto") {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <>
      <DentalShell />
      {!shown && <PortalTransition onComplete={markShown} />}
    </>
  );
}
