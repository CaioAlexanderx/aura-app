// ============================================================
// DentalDesignStyle — keyframes globais do dash dental rico (PR16).
//
// Web-only. Injeta CSS via dangerouslySetInnerHTML (mesmo padrao
// do AuraDesignStyle do shell negocio). Em native nada renderiza.
//
// Renderizar UMA vez no topo do hoje.tsx (logo apos abrir o JSX).
// Os keyframes ficam disponiveis pra DentalAuraBackdrop +
// DentalHeroCard + DentalQuickActions etc.
// ============================================================

const CSS = `
@keyframes dentalOrbFloat {
  0%   { transform: translate(0,0) scale(1);    }
  33%  { transform: translate(30px,-20px) scale(1.05); }
  66%  { transform: translate(-25px,15px) scale(0.97); }
  100% { transform: translate(0,0) scale(1);    }
}
@keyframes dentalPulse {
  0%, 100% { opacity: 1;   transform: scale(1);    }
  50%      { opacity: 0.45; transform: scale(0.85); }
}
@keyframes dentalHeroShift {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
@keyframes dentalDrawLine {
  from { stroke-dashoffset: 800; }
  to   { stroke-dashoffset: 0;   }
}
@keyframes dentalFadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0);   }
}
@keyframes dentalSpinner {
  from { transform: rotate(0deg);   }
  to   { transform: rotate(360deg); }
}
@keyframes dentalRingExpand {
  from { transform: scale(0.6); opacity: 0.8; }
  to   { transform: scale(1.4); opacity: 0;   }
}
.dental-fade-up { animation: dentalFadeUp 0.5s ease-out both; }
`;

export function DentalDesignStyle() {
  if (typeof window === "undefined") return null;
  return (
    // @ts-expect-error dangerouslySetInnerHTML so existe no web
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
  );
}
