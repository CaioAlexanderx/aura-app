// ============================================================
// Layout do Portal Off-App do Dojô — Aura Karatê (Canal B / link fixo)
//
// Rota pública: /karate/[slug]/dojo
// O dojô SEM Aura entra por um LINK FIXO não-expirável enviado pela federação
// (WhatsApp/e-mail): /karate/{slug}/dojo?t=<token>. O token é a credencial —
// guardado APENAS em memória (DojoPortalContext), nunca em localStorage.
//
//   1. /karate/[slug]/dojo         → captura ?t= e valida (ou orienta o sensei)
//   2. /karate/[slug]/dojo/portal  → portal autenticado (consulta + pagar)
// ============================================================
import React, { createContext, useContext, useState, ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { Slot } from "expo-router";
import { KarateColors } from "@/constants/karateTheme";

interface DojoPortalContextValue {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
}

const DojoPortalContext = createContext<DojoPortalContextValue>({
  token: null,
  setToken: () => {},
  clearToken: () => {},
});

export function useDojoPortal() {
  return useContext(DojoPortalContext);
}

export default function DojoPortalLayout() {
  const [token, setTokenState] = useState<string | null>(null);

  return (
    <DojoPortalContext.Provider
      value={{
        token,
        setToken: (t: string) => setTokenState(t),
        clearToken: () => setTokenState(null),
      }}
    >
      <View style={styles.root}>
        <Slot />
      </View>
    </DojoPortalContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KarateColors.bg },
});
