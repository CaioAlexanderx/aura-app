// ============================================================
// KarateDojoContext — Aura Karatê (F1: shell completo do dojô)
//
// Carrega UMA vez o /dojo/me real (services/karateDojoInfoApi) e expõe
// pro shell e pras telas do grupo (dojo):
//   • dojoMe   — dados cadastrais (código FPKT, contagem, contato…)
//   • dojoName — nome REAL do dojô, com fallback company.name (JWT).
//                O fallback estático SENSEI_DOJO {name:"Dojô"} morreu
//                na F1 — o shell não exibe mais placeholder fixo.
//   • dojoCode — fpkt_affiliation_id (ou null enquanto carrega/faltar)
//
// Sempre montado DENTRO de KarateFederationProvider (o federationId da
// rota vem de lá). Erro de rede não bloqueia o shell: dojoName cai no
// company.name e a tela de Configurações oferece o retry.
// ============================================================
import React, {
  createContext, useContext, useCallback, useEffect, useState, ReactNode,
} from "react";
import { useAuthStore } from "@/stores/auth";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateDojoInfoApi, DojoMeInfo } from "@/services/karateDojoInfoApi";

export interface KarateDojoContextValue {
  dojoMe: DojoMeInfo | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
  dojoName: string;
  dojoCode: string | null;
}

const KarateDojoContext = createContext<KarateDojoContextValue>({
  dojoMe: null,
  loading: false,
  error: false,
  reload: () => {},
  dojoName: "Dojô",
  dojoCode: null,
});

export function KarateDojoProvider({ children }: { children: ReactNode }) {
  const { federationId } = useKarateFederation();
  const company = useAuthStore((s) => s.company) as any;

  const [dojoMe, setDojoMe] = useState<DojoMeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!federationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const me = await karateDojoInfoApi.getDojoMe(federationId);
      setDojoMe(me);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const value: KarateDojoContextValue = {
    dojoMe,
    loading,
    error,
    reload: load,
    dojoName: dojoMe?.name || company?.name || "Dojô",
    dojoCode: dojoMe?.fpkt_affiliation_id ?? null,
  };

  return (
    <KarateDojoContext.Provider value={value}>
      {children}
    </KarateDojoContext.Provider>
  );
}

export function useKarateDojo(): KarateDojoContextValue {
  return useContext(KarateDojoContext);
}
