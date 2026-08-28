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
//   • dojoLogoUrl — logo do PRÓPRIO dojô (QA 27/08/2026). null enquanto
//                carrega ou quando o dojô não subiu logo: o shell desenha
//                o monograma (DojoLogo), nunca um quadro vazio.
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
  /**
   * Substitui o /dojo/me em memória com a resposta de um PATCH/upload.
   * As rotas de escrita devolvem o shape COMPLETO do GET, então quem acabou
   * de salvar já tem a verdade — um reload() aqui seria um GET a mais só
   * para descobrir o que o servidor já respondeu, e a sidebar piscaria a
   * logo antiga no intervalo.
   */
  applyDojoMe: (me: DojoMeInfo) => void;
  dojoName: string;
  dojoCode: string | null;
  /** Logo do próprio dojô (null → o shell desenha o monograma). */
  dojoLogoUrl: string | null;
  linked: boolean;
}

const KarateDojoContext = createContext<KarateDojoContextValue>({
  dojoMe: null,
  loading: false,
  error: false,
  reload: () => {},
  applyDojoMe: () => {},
  dojoName: "Dojô",
  dojoCode: null,
  dojoLogoUrl: null,
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

  const applyDojoMe = useCallback((me: DojoMeInfo) => {
    setDojoMe(me);
    setError(false);
  }, []);

  const value: KarateDojoContextValue = {
    dojoMe,
    loading,
    error,
    reload: load,
    applyDojoMe,
    dojoName: dojoMe?.name || company?.name || "Dojô",
    dojoCode: dojoMe?.fpkt_affiliation_id ?? null,
    dojoLogoUrl: dojoMe?.logo_url ?? null,
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
