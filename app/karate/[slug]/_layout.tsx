// ============================================================
// Layout das páginas públicas da federação — Aura Karatê (frente 3)
//
// Rotas: /karate/[slug]/ranking · /praticante · /inscricao/[eventId]
//        /p/[publicToken] · /dojo/*
//
// Carrega as fontes Shoji (Shippori Mincho / Zen Kaku / DM Mono) para
// todo o microsite público — fora do KarateShell da federação, que tem
// seu próprio carregamento. Idempotente no web (injeção de <link> única).
//
// Título do navegador (web): "Portal - <SLUG>" (ex.: "Portal - FPKT"),
// derivado do slug da federação. Sobrescreve o "Aura." padrão do app.
// ============================================================
import React, { useEffect } from "react";
import { Slot, useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { useShojiFonts } from "@/components/karate/shoji";

export default function KaratePublicLayout() {
  useShojiFonts();
  const { slug } = useLocalSearchParams<{ slug?: string }>();

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const fed = typeof slug === "string" && slug.trim() ? slug.trim().toUpperCase() : "";
    document.title = fed ? `Portal - ${fed}` : "Portal";
  }, [slug]);

  return <Slot />;
}
