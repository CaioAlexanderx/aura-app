// ============================================================
// Layout das páginas públicas da federação — Aura Karatê (frente 3)
//
// Rotas: /karate/[slug]/ranking · /praticante · /inscricao/[eventId]
//        /p/[publicToken] · /dojo/*
//
// Carrega as fontes Shoji (Shippori Mincho / Zen Kaku / DM Mono) para
// todo o microsite público — fora do KarateShell da federação, que tem
// seu próprio carregamento. Idempotente no web (injeção de <link> única).
// ============================================================
import React from "react";
import { Slot } from "expo-router";
import { useShojiFonts } from "@/components/karate/shoji";

export default function KaratePublicLayout() {
  useShojiFonts();
  return <Slot />;
}
