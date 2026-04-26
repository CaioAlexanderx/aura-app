import { useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";

// ============================================================
// useDentalShortcuts — atalhos de teclado tipo Gmail (g + tecla)
// pro shell Aura Odonto. So funciona em web.
//
// Padrao:
//   - Pressionar `g` ativa o modo "sequencia" por ate 1500ms
//   - Proxima tecla decide o destino:
//       h -> hoje
//       a -> agenda
//       p -> pacientes
//       c -> atendimento (clinica)
//       t -> tratamentos
//       f -> faturamento
//       m -> materiais
//       s -> clinica (settings)
//   - `?` (shift+/) abre modal de ajuda
//   - `Escape` fecha modal
//
// NAO captura quando o foco esta em input/textarea/contentEditable.
// Protege digitacao em forms (anamnese, prontuario, dados de paciente).
//
// Retorna { helpOpen, openHelp, closeHelp } pro shell controlar o
// modal de ajuda (DentalShortcutsHelp).
// ============================================================

type DestKey = "h" | "a" | "p" | "c" | "t" | "f" | "m" | "s";

const DESTINATIONS: Record<DestKey, string> = {
  h: "/dental/(clinic)/hoje",
  a: "/dental/(clinic)/agenda",
  p: "/dental/(clinic)/pacientes",
  c: "/dental/(clinic)/atendimento",
  t: "/dental/(clinic)/tratamentos",
  f: "/dental/(clinic)/faturamento",
  m: "/dental/(clinic)/materiais",
  s: "/dental/(clinic)/clinica",
};

// Lista pra renderizar no modal de ajuda.
export const DENTAL_SHORTCUTS_HELP: ReadonlyArray<{ keys: string; label: string }> = [
  { keys: "g h", label: "Hoje" },
  { keys: "g a", label: "Agenda" },
  { keys: "g p", label: "Pacientes" },
  { keys: "g c", label: "Atendimento" },
  { keys: "g t", label: "Tratamentos" },
  { keys: "g f", label: "Faturamento" },
  { keys: "g m", label: "Materiais" },
  { keys: "g s", label: "Configurações da clínica" },
  { keys: "?",   label: "Mostrar atalhos" },
  { keys: "Esc", label: "Fechar modal" },
];

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((t as any).isContentEditable) return true;
  return false;
}

export interface DentalShortcutsState {
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
}

export function useDentalShortcuts(): DentalShortcutsState {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  // Estado da sequencia "g + tecla". gMode=true significa que o
  // usuario pressionou `g` recentemente e a proxima tecla e o destino.
  const gMode = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelGMode = useCallback(() => {
    gMode.current = false;
    if (gTimer.current) {
      clearTimeout(gTimer.current);
      gTimer.current = null;
    }
  }, []);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    function handleKey(e: KeyboardEvent) {
      // Ignora se usuario esta digitando.
      if (isTypingTarget(e)) return;
      // Ignora combinacoes com modifiers (ex: Ctrl+G nao deve ativar gMode).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key;

      // Help modal.
      if (key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        cancelGMode();
        return;
      }
      if (key === "Escape" && helpOpen) {
        e.preventDefault();
        setHelpOpen(false);
        cancelGMode();
        return;
      }

      // Sequencia g + tecla.
      if (gMode.current) {
        const lower = key.toLowerCase() as DestKey;
        const dest = DESTINATIONS[lower];
        cancelGMode();
        if (dest) {
          e.preventDefault();
          router.push(dest as any);
        }
        return;
      }

      if (key === "g" || key === "G") {
        e.preventDefault();
        gMode.current = true;
        // Janela de 1.5s pra completar a sequencia.
        gTimer.current = setTimeout(() => cancelGMode(), 1500);
        return;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      cancelGMode();
    };
  }, [router, helpOpen, cancelGMode]);

  return { helpOpen, openHelp, closeHelp };
}
