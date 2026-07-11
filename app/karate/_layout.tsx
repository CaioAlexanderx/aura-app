// ============================================================
// Layout raiz de /karate — Aura Karatê
//
// Ponto único que envolve TODAS as rotas sob /karate: federação
// ((federation)/_layout), portais públicos ([slug]/_layout), painel do
// sensei (sensei/_layout), verify/[token] e roster-update/[token]. Não
// define nenhum shell visual próprio (cada sub-rota já tem o seu) — só
// injeta, no web, o favicon + <title> da marca Aura Karatê enquanto o
// usuário navega dentro de /karate, restaurando o favicon/título padrão
// da Aura no cleanup (ao sair de /karate para o resto do app).
//
// Padrão de injeção de favicon espelha app/(tabs)/_layout.tsx (useWebFonts),
// que usa o id fixo "aura-favicon" — reaproveitamos o mesmo elemento em vez
// de criar um segundo <link>, então restauramos href/type no cleanup.
//
// Item 5 (motion pack Shoji): scrollbar padronizada na paleta Shoji (tinta
// suave sobre trilho quase invisível), injetada aqui — mesmo padrão de
// app/(tabs)/_layout.tsx (que injeta ::-webkit-scrollbar com a paleta
// roxa do app) — mas TODAS as regras ficam escopadas sob a classe
// `.karate-shoji-scroll`, que só existe dentro da árvore de /karate (ver
// wrapper no fim do arquivo). Isso evita depender de cleanup: mesmo que o
// <style> fique no <head> indefinidamente (como o padrão já estabelecido
// em (tabs)/_layout.tsx), as regras nunca vazam pro resto do app porque o
// seletor exige o ancestral `.karate-shoji-scroll`.
// ============================================================
import React, { useEffect } from "react";
import { Slot } from "expo-router";
import { Platform } from "react-native";

const DEFAULT_FAVICON_HREF = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Icon.png";
const DEFAULT_FAVICON_TYPE = "image/png";
const KARATE_FAVICON_HREF = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/karate/favicon-karate.svg";
const KARATE_FAVICON_TYPE = "image/svg+xml";
const KARATE_TITLE = "Aura Karatê";

const KARATE_SCROLLBAR_CSS_ID = "karate-shoji-scrollbar-css";
const KARATE_SCROLLBAR_CSS = `
.karate-shoji-scroll, .karate-shoji-scroll * { scrollbar-width: thin; scrollbar-color: rgba(43,38,32,0.24) transparent; }
.karate-shoji-scroll ::-webkit-scrollbar { width: 10px; height: 10px; }
.karate-shoji-scroll ::-webkit-scrollbar-track { background: transparent; }
.karate-shoji-scroll ::-webkit-scrollbar-thumb { background-color: rgba(43,38,32,0.22); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
.karate-shoji-scroll ::-webkit-scrollbar-thumb:hover { background-color: rgba(43,38,32,0.36); background-clip: padding-box; }
.karate-shoji-scroll ::-webkit-scrollbar-corner { background: transparent; }
`;

function useKarateShojiScrollbarCss() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById(KARATE_SCROLLBAR_CSS_ID)) return;
    const st = document.createElement("style");
    st.id = KARATE_SCROLLBAR_CSS_ID;
    st.textContent = KARATE_SCROLLBAR_CSS;
    document.head.appendChild(st);
  }, []);
}

export default function KarateRootLayout() {
  useKarateShojiScrollbarCss();

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const existing = document.getElementById("aura-favicon") as HTMLLinkElement | null;
    // Guarda o estado anterior pra restaurar no cleanup (se o link ainda não
    // existia — ex.: usuário entrou direto numa URL /karate — o "anterior" é
    // o favicon genérico padrão da Aura, igual ao que (tabs)/_layout injeta).
    const prevHref = existing?.href || DEFAULT_FAVICON_HREF;
    const prevType = existing?.type || DEFAULT_FAVICON_TYPE;
    const prevTitle = document.title;

    let fav = existing;
    if (!fav) {
      fav = document.createElement("link");
      fav.id = "aura-favicon";
      fav.rel = "icon";
      document.head.appendChild(fav);
    }
    fav.type = KARATE_FAVICON_TYPE;
    fav.href = KARATE_FAVICON_HREF;
    document.title = KARATE_TITLE;

    return () => {
      const el = document.getElementById("aura-favicon") as HTMLLinkElement | null;
      if (el) {
        el.type = prevType;
        el.href = prevHref;
      }
      document.title = prevTitle;
    };
  }, []);

  // Item 5 (motion pack Shoji): wrapper web-only, só pra escopar a
  // scrollbar Shoji (classe `.karate-shoji-scroll`) — `display: contents`
  // não gera caixa própria, então não muda layout/estrutura de navegação
  // nenhuma (as rotas seguem exatamente como Slot renderiza hoje).
  if (Platform.OS === "web") {
    return (
      <div className="karate-shoji-scroll" style={{ display: "contents" } as any}>
        <Slot />
      </div>
    );
  }
  return <Slot />;
}
