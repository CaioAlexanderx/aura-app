// ============================================================
// useCountUp — Aura Karatê
//
// Hook reutilizável que anima um número de 0 até o valor final via
// requestAnimationFrame (ease-out cúbico), retornando o valor CORRENTE
// para o caller formatar/renderizar. Mesmo padrão de tween já usado em
// components/studio/AnimatedKpiCounter.tsx (sem Animated.Value pra número
// puro — só pra estilo/opacity/transform). Web-safe por natureza (rAF).
//
// Uso: para moeda/percentual, anime o NÚMERO cru e reformate no caller
// (ex.: fmtBRL(useCountUp(1234.5))) — nunca anime a string já formatada.
// Se o valor final não for finito (NaN/Infinity/undefined), retorna o
// valor final imediatamente (sem animar).
// ============================================================
import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 700): number {
  const isValid = Number.isFinite(target);
  const [display, setDisplay] = useState(isValid ? target : 0);
  const prevTarget = useRef(isValid ? target : 0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isValid) {
      setDisplay(target);
      prevTarget.current = 0;
      return;
    }

    const from = prevTarget.current;
    const to = target;
    prevTarget.current = to;

    if (from === to) {
      setDisplay(to);
      return;
    }

    const start = Date.now();
    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cúbico
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
      }
    }
    tick();

    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, isValid]);

  return isValid ? display : target;
}

export default useCountUp;
