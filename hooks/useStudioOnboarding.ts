// ============================================================
// AURA STUDIO · useStudioOnboarding (Fase 5A)
//
// Decide se o walkthrough do Studio deve aparecer pro usuário.
//
// Persistência: studio_settings.onboarding.walkthrough_seen
// (companies.studio_settings via studioApi.getSettings /
// saveSettings — JSONB, default {}).
//
// Skip automático: se a empresa já tem >=1 produto cadastrado,
// considera "veterana" — markSeen + retorna shouldShow=false.
// Evita poluir UX de quem já está usando o Studio antes da F5
// existir.
//
// API:
//   const { shouldShow, isLoading, markSeen } = useStudioOnboarding();
//
// Memory: plano_aura_studio_vertical_24mai2026,
//          arquitetura_module_overrides (settings JSONB merge).
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { studioApi } from "@/services/studioApi";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

export type UseStudioOnboardingReturn = {
  shouldShow: boolean;
  isLoading: boolean;
  markSeen: () => Promise<void>;
};

export function useStudioOnboarding(): UseStudioOnboardingReturn {
  const { company } = useAuthStore();
  const cid = company?.id;

  const [shouldShow, setShouldShow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOnboarding, setCurrentOnboarding] = useState<Record<string, any>>({});

  // ─── markSeen: grava flag em studio_settings.onboarding ──
  const markSeen = useCallback(async () => {
    if (!cid) return;
    try {
      const merged = {
        ...(currentOnboarding || {}),
        walkthrough_seen: true,
      };
      await studioApi.saveSettings(cid, { onboarding: merged });
      setCurrentOnboarding(merged);
      setShouldShow(false);
    } catch {
      // Falhou? não trava — só deixa de mostrar nesta sessão.
      setShouldShow(false);
    }
  }, [cid, currentOnboarding]);

  // ─── load: getSettings + checagem de produtos ──
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cid) {
        setIsLoading(false);
        setShouldShow(false);
        return;
      }

      setIsLoading(true);
      try {
        const res = await studioApi.getSettings(cid);
        const onb = (res?.settings?.onboarding as Record<string, any>) || {};
        if (cancelled) return;
        setCurrentOnboarding(onb);

        if (onb.walkthrough_seen) {
          setShouldShow(false);
          setIsLoading(false);
          return;
        }

        // Skip automático pra contas veteranas (>=1 produto)
        try {
          const prodRes: any = await companiesApi.products(cid);
          const arr = prodRes?.products || prodRes?.rows || prodRes;
          const count = Array.isArray(arr) ? arr.length : 0;
          if (cancelled) return;

          if (count > 0) {
            // marca como visto silenciosamente, evita aparecer depois
            const merged = { ...onb, walkthrough_seen: true };
            try { await studioApi.saveSettings(cid, { onboarding: merged }); } catch {}
            if (cancelled) return;
            setCurrentOnboarding(merged);
            setShouldShow(false);
            setIsLoading(false);
            return;
          }
        } catch {
          // falha ao contar produtos não bloqueia o tour
        }

        if (!cancelled) {
          setShouldShow(true);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          // sem settings? mantém escondido pra não atropelar UX
          setShouldShow(false);
          setIsLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [cid]);

  return { shouldShow, isLoading, markSeen };
}

export default useStudioOnboarding;
