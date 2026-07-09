import { create } from "zustand";

// ============================================================
// KarateIntro store — dispara a entrada Shoji (portas abrindo)
// a cada AÇÃO de login com senha numa conta de karatê.
//
// Em-memory (sem persistência): reset natural a cada hard reload,
// então a intro NÃO reaparece em refresh/navegação — só quando o
// login seta `pending`. O overlay é montado no root layout (acima
// de qualquer shell), evitando a corrida com o guard de auth que
// desmontava a transição quando ela vivia na tela de login.
// ============================================================

type KarateIntroState = {
  pending: boolean;
  trigger: () => void;   // login karatê chama isto
  consume: () => void;   // overlay chama ao terminar a animação
};

export const useKarateIntro = create<KarateIntroState>((set) => ({
  pending: false,
  trigger: () => set({ pending: true }),
  consume: () => set({ pending: false }),
}));
