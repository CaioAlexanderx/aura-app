// ============================================================
// Layout do Portal Off-App do Dojô — Aura Karatê (Fase 0 Canal B)
//
// Rota pública: /karate/[slug]/dojo
// Não usa JWT de empresa (o dojô pode não ter Aura). Auth via OTP:
//   1. /karate/[slug]/dojo         → tela de login (email/telefone + código)
//   2. /karate/[slug]/dojo/portal  → portal autenticado (requer token OTP)
//
// Token dojo_portal mantido APENAS em memória (DojoPortalContext).
// Nunca persistido em localStorage (não suportado no ambiente).
// ============================================================
import React, { createContext, useContext, useState, ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { Slot } from "expo-router";
import { KarateColors } from "@/constants/karateTheme";

interface DojoPortalContextValue {
  token: string | null;
  dojoId: string | null;
  federationId: string | null;
  setAuth: (token: string, dojoId: string, federationId: string) => void;
  clearAuth: () => void;
}

const DojoPortalContext = createContext<DojoPortalContextValue>({
  token: null,
  dojoId: null,
  federationId: null,
  setAuth: () => {},
  clearAuth: () => {},
});

export function useDojoPortal() {
  return useContext(DojoPortalContext);
}

export default function DojoPortalLayout() {
  const [token, setToken] = useState<string | null>(null);
  const [dojoId, setDojoId] = useState<string | null>(null);
  const [federationId, setFederationId] = useState<string | null>(null);

  function setAuth(t: string, dId: string, fId: string) {
    setToken(t);
    setDojoId(dId);
    setFederationId(fId);
  }
  function clearAuth() {
    setToken(null);
    setDojoId(null);
    setFederationId(null);
  }

  return (
    <DojoPortalContext.Provider value={{ token, dojoId, federationId, setAuth, clearAuth }}>
      <View style={styles.root}>
        <Slot />
      </View>
    </DojoPortalContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KarateColors.bg },
});
