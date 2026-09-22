// ============================================================
// AURA. — cor da barra de status no app instalado (PWA 2b.1)
//
// Criado: 22/09/2026
//
// O manifesto declara `theme_color: #060816` — o fundo do painel de
// varejo, que é escuro. No Android, com a Aura instalada, essa é a cor da
// barra de status. O Karatê é claro (papel de arroz), então a barra saía
// preta em cima de um app bege: parece bug, e é o primeiro pixel que a
// pessoa vê ao abrir.
//
// Este hook troca a `<meta name="theme-color">` enquanto a tela estiver
// montada e devolve o valor anterior ao desmontar. Dois shells do Karatê o
// usam; qualquer vertical de tema próprio pode usar depois.
//
// LIMITE, e não há conserto por aqui: no iPhone a barra de status do app
// instalado vem de `apple-mobile-web-app-status-bar-style`, lida UMA vez,
// na abertura, e a tag é global do app. Trocar em tempo de execução não
// tem efeito. Isso é do iOS, não nosso.
// ============================================================
import { useEffect } from "react";
import { Platform } from "react-native";

/** O que o public/index.html declara — o valor ao qual voltamos. */
export const COR_PADRAO = "#060816";

function metaDeTema(): HTMLMetaElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector('meta[name="theme-color"]');
}

/**
 * Pinta a barra de status com `cor` enquanto o componente estiver montado.
 * Sem efeito fora do web, e inofensivo quando a meta não existe.
 */
export function useCorDaBarraDeStatus(cor: string): void {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const meta = metaDeTema();
    if (!meta) return;
    const anterior = meta.getAttribute("content") || COR_PADRAO;
    meta.setAttribute("content", cor);
    return () => { meta.setAttribute("content", anterior); };
  }, [cor]);
}
