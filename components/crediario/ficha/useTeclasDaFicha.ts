// ============================================================
// useTeclasDaFicha — Esc e setas da ficha em tela cheia (F3, 23/11/2026)
//
// Só no web e só na casca de tela cheia (a janela já fecha no Esc pelo
// Modal). A decisão de cada tecla é pura (utils/crediarioFichaTela.acaoDaTecla):
//  - Esc fecha o painel da direita, e só depois a ficha;
//  - ↑ ↓ trocam de cliente, fora de campo de texto e sem painel aberto;
//  - com outra janela por cima (Editar cliente, Cobrar, Devolução, diálogo)
//    nada acontece: o Modal do react-native-web cuida do próprio Esc.
// ============================================================
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { acaoDaTecla, ehCampoEditavel, type AcaoDaTecla } from "@/utils/crediarioFichaTela";

export type TeclasDaFicha = {
  ativo: boolean;
  painelAberto: boolean;
  onAcao: (acao: Exclude<AcaoDaTecla, null>) => void;
};

/** Há um Modal do react-native-web aberto (role=dialog + aria-modal)? */
function temDialogoAberto(): boolean {
  try {
    return !!document.querySelector('[role="dialog"][aria-modal="true"]');
  } catch {
    return false;
  }
}

export function useTeclasDaFicha({ ativo, painelAberto, onAcao }: TeclasDaFicha) {
  // Sempre a versão mais nova, sem refazer o listener a cada render.
  const atual = useRef({ painelAberto, onAcao });
  atual.current = { painelAberto, onAcao };

  useEffect(() => {
    if (!ativo || Platform.OS !== "web" || typeof document === "undefined") return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const acao = acaoDaTecla({
        key: e.key,
        alvoEditavel: ehCampoEditavel(document.activeElement as any),
        dialogoAberto: temDialogoAberto(),
        painelAberto: atual.current.painelAberto,
        comModificador: e.ctrlKey || e.metaKey || e.altKey,
        repetida: e.repeat,
      });
      if (!acao) return;
      e.preventDefault();
      atual.current.onAcao(acao);
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [ativo]);
}
