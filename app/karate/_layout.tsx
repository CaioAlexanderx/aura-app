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
// ============================================================
import React, { useEffect } from "react";
import { Slot } from "expo-router";
import { Platform } from "react-native";

const DEFAULT_FAVICON_HREF = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Icon.png";
const DEFAULT_FAVICON_TYPE = "image/png";
const KARATE_FAVICON_HREF = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/karate/favicon-karate.svg";
const KARATE_FAVICON_TYPE = "image/svg+xml";
const KARATE_TITLE = "Aura Karatê";

export default function KarateRootLayout() {
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

  return <Slot />;
}
