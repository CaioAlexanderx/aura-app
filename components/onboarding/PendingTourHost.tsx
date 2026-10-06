import { useEffect, useCallback } from "react";
import { usePathname } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SpotlightTour, AURA_SPOTLIGHT_PALETTE, type SpotlightPalette } from "@/components/onboarding/SpotlightTour";
import { usePendingTour, normalizarPath } from "@/stores/pendingTour";

// ============================================================
// Mostra o tour pendente (stores/pendingTour) quando o app chega na tela
// alvo. Montado no layout de cada shell — (tabs) e Studio — fora do
// PageTransition, e com portal no body (memória "overlay fixo dentro de
// shell": z-index do RNW prende overlay fixo).
//
// Fechar ("Entendi", Esc, toque fora) limpa o pendente e invalida
// ["first-steps"]: o cartão do Painel refaz o GET quando o lojista voltar.
// Se o lojista sair da tela alvo sem fechar, o pendente some também.
// ============================================================

export function PendingTourHost({ palette = AURA_SPOTLIGHT_PALETTE }: { palette?: SpotlightPalette }) {
  const pathname = usePathname();
  const pending = usePendingTour((s) => s.pending);
  const markArrived = usePendingTour((s) => s.markArrived);
  const clear = usePendingTour((s) => s.clear);
  const qc = useQueryClient();

  const here = normalizarPath(pathname);
  const naTelaAlvo = !!pending && here === normalizarPath(pending.path);

  useEffect(() => {
    if (!pending) return;
    if (naTelaAlvo) markArrived();
    else if (pending.arrived) clear();
  }, [pending, naTelaAlvo, markArrived, clear]);

  const fechar = useCallback(() => {
    clear();
    qc.invalidateQueries({ queryKey: ["first-steps"] });
  }, [clear, qc]);

  if (!pending || !naTelaAlvo) return null;

  return (
    <SpotlightTour
      steps={[pending.step]}
      open
      onComplete={fechar}
      onSkip={fechar}
      palette={palette}
      labels={{ done: "Entendi" }}
      showCounter={false}
      waitForTargetMs={4000}
      clickThrough
      portal
    />
  );
}

export default PendingTourHost;
