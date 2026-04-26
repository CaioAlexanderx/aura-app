import { useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import { create } from "zustand";

// ============================================================
// useDentalOnboarding — controla se o wizard de boas-vindas
// dental ja foi concluido por este device.
//
// Persistencia: localStorage (web). Em native, considera
// completed por padrao (UX mobile do wizard fica pra futuro,
// SpotlightTour depende de DOM API).
//
// Reset: util pra debug/preview ou um futuro botao em
// DentalSettings ("Reproduzir tour").
// ============================================================

const LS_KEY = "aura_dental_onboarding_completed_v1";

type OnboardingState = {
  completed: boolean;
  hydrated: boolean;
  hydrate: () => void;
  markCompleted: () => void;
  reset: () => void;
};

export const useDentalOnboarding = create<OnboardingState>((set) => ({
  completed: false,
  hydrated: false,

  hydrate: () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      // Native: nao mostra wizard por enquanto. Futuro: implementar
      // versao mobile com Modal+layout-measure em vez de DOM.
      set({ completed: true, hydrated: true });
      return;
    }
    try {
      const v = window.localStorage.getItem(LS_KEY);
      set({ completed: v === "1", hydrated: true });
    } catch {
      // localStorage indisponivel — nao mostra (evitar loop)
      set({ completed: true, hydrated: true });
    }
  },

  markCompleted: () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try { window.localStorage.setItem(LS_KEY, "1"); } catch {}
    }
    set({ completed: true });
  },

  reset: () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try { window.localStorage.removeItem(LS_KEY); } catch {}
    }
    set({ completed: false });
  },
}));

// Hook que faz hydrate uma vez e retorna se deve mostrar.
export function useShouldShowDentalOnboarding(): { shouldShow: boolean; markCompleted: () => void } {
  const { completed, hydrated, hydrate, markCompleted } = useDentalOnboarding();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  return {
    shouldShow: hydrated && !completed,
    markCompleted,
  };
}
