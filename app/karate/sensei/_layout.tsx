// ============================================================
// /karate/sensei — COMPAT (F1 Aura Dojô, 18/07/2026)
//
// O shell "light" do sensei (tabs somente leitura) foi PROMOVIDO ao
// shell COMPLETO do dojô: grupo app/karate/(dojo) (sidebar no desktop +
// bottom tabs no mobile, identidade Shoji "Aura Karatê"). Estas rotas
// ficam só como redirects finos pra não quebrar links/bookmarks antigos
// — o redirect por papel em (federation)/_layout.tsx já aponta direto
// pro grupo (dojo).
//
// O export SENSEI_DOJO (fallback estático {name:"Dojô", code:"—"})
// morreu na F1: o /dojo/me real (contexts/KarateDojo) alimenta nome,
// código FPKT e contagem no shell novo. Nenhum arquivo fora de
// /karate/sensei importava esse símbolo (conferido por busca no repo).
// ============================================================
import React from "react";
import { Slot } from "expo-router";

export default function SenseiCompatLayout() {
  return <Slot />;
}
