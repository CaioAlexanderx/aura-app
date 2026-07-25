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
//   • linked   — conexão do dojô à federação (Aura-backend#422, polish
//                QA 25/07). FAIL-OPEN: true por padrão (loading/erro/
//                backend antigo sem o campo nunca esconde nav nem
//                bloqueia tela por conta disso).
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
  linked: boolean;
}

const KarateDojoContext = createContext<KarateDojoContextValue>({
  dojoMe: null,
  loading: false,
  error: false,
  reload: () => {},
  dojoName: "Dojô",
  dojoCode: null,
  linked: true,
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
    // Fail-open: enquanto carrega ou se o campo não vier, assume conectado
    // (nunca esconde nav/gate por causa de loading ou de um backend antigo).
    linked: dojoMe?.linked ?? true,
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
