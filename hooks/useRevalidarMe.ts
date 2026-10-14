// ============================================================
// AURA. — useRevalidarMe: a loja vê o que a Gestão Aura mudou sem recarregar
//
// Criado: 14/10/2026 (card t2-16)
//
// Armadilha 1 do CLAUDE.md: plano, frente (vertical_active) e módulos vêm do
// JWT na abertura e só eram revalidados no mount de alguns layouts. Quem
// ficava com a aba aberta enquanto a equipe ligava o Studio via a frente
// aparecer só ao recarregar (Maria Thais, 03/10: ligado às 13h35, "liberado"
// às 14h05; Talita, 13/10: resolvido com "atualize a página").
//
// Montado UMA vez, no AuthGuard do layout raiz (app/_layout.tsx), para valer
// em todos os shells (Negócio, Studio, Food, Odonto, Karatê).
//
//   · periódico: a cada REVALIDAR_INTERVALO_MS, só com a aba/app visível;
//   · ao voltar o foco: visibilitychange / focus (web) e AppState "active"
//     (nativo) — quem volta depois de um tempo vê o dado novo na hora;
//   · teto de frequência: no máximo uma chamada a cada REVALIDAR_MIN_MS,
//     somando todos os gatilhos (sem rajada ao alternar abas);
//   · sem piscar: refreshMe() não grava nada no estado quando a resposta é
//     igual à que a tela já tem (stores/auth.ts), então nada re-renderiza;
//   · erro de rede é silencioso: refreshMe nunca desloga por conta própria.
//
// A decisão de "quando" mora em criarRevalidador, que é função pura de
// relógio e callbacks — testável sem React.
// ============================================================
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useAuthStore } from "@/stores/auth";

/** Intervalo entre revalidações com a aba aberta e visível. */
export const REVALIDAR_INTERVALO_MS = 120_000;
/** Espaço mínimo entre duas chamadas, venha de onde vier o gatilho. */
export const REVALIDAR_MIN_MS = 60_000;

export type Revalidador = {
  /** Pede uma revalidação. Devolve true quando de fato disparou. */
  tentar: () => boolean;
};

export function criarRevalidador(opts: {
  revalidar: () => Promise<unknown> | unknown;
  /** Sem sessão (ou trocando de empresa) não há o que revalidar. */
  ativo?: () => boolean;
  agora?: () => number;
  minimoMs?: number;
}): Revalidador {
  const agora = opts.agora || Date.now;
  const minimo = opts.minimoMs ?? REVALIDAR_MIN_MS;
  // O layout acabou de montar e já revalidou: conta como a última.
  let ultimo = agora();
  let emVoo = false;

  return {
    tentar() {
      if (opts.ativo && !opts.ativo()) return false;
      if (emVoo) return false;
      const t = agora();
      if (t - ultimo < minimo) return false;
      ultimo = t;
      emVoo = true;
      let p: Promise<unknown>;
      try {
        p = Promise.resolve(opts.revalidar());
      } catch {
        p = Promise.resolve();
      }
      p.catch(() => {}).then(() => { emVoo = false; });
      return true;
    },
  };
}

export function useRevalidarMe(): void {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return undefined;

    const revalidador = criarRevalidador({
      revalidar: () => useAuthStore.getState().refreshMe(),
      ativo: () => {
        const st = useAuthStore.getState();
        return !!st.token && !st.switching;
      },
    });

    const web = Platform.OS === "web" && typeof document !== "undefined";
    const visivel = () => !web || document.visibilityState !== "hidden";
    const aoVoltar = () => { if (visivel()) revalidador.tentar(); };

    const timer = setInterval(() => { if (visivel()) revalidador.tentar(); }, REVALIDAR_INTERVALO_MS);

    let limpar: () => void;
    if (web) {
      document.addEventListener("visibilitychange", aoVoltar);
      window.addEventListener("focus", aoVoltar);
      limpar = () => {
        document.removeEventListener("visibilitychange", aoVoltar);
        window.removeEventListener("focus", aoVoltar);
      };
    } else {
      const sub = AppState.addEventListener("change", (estado) => {
        if (estado === "active") revalidador.tentar();
      });
      limpar = () => { try { sub.remove(); } catch {} };
    }

    return () => {
      clearInterval(timer);
      limpar();
    };
  }, [token]);
}
