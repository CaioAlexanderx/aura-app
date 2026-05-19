import { useState, useEffect, ReactNode } from "react";
import { View, Platform, ScrollView } from "react-native";
import { Slot } from "expo-router";
import { ToastContainer } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FoodSidebar } from "@/components/food/FoodSidebar";
import { FoodMBar } from "@/components/food/FoodMBar";
import { FoodColors, FoodGradients } from "@/constants/food-tokens";

// ============================================================
// FoodShell — Container do shell Aura Food.
// Espelha DentalShell mas sem MigrationBanner / Shortcuts / Onboarding
// (fase 0 = só esqueleto; esses extras entram em fases posteriores).
//
// Três modos de renderizacao:
//   1. Desktop web (>768px): sidebar lateral + content area
//      com max-width 1320 e padding 24.
//   2. Mobile web (<=768px): layout column com FoodMBar fixa
//      no rodape e content area que ocupa toda a viewport menos
//      a barra. Padding 16 sem max-width.
//   3. Native: View + ScrollView + FoodMBar.
// ============================================================

function useScreenWidth() {
  const [w, setW] = useState(
    Platform.OS === "web" && typeof window !== "undefined" ? window.innerWidth : 1024
  );
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

export function FoodShell({ children }: { children?: ReactNode }) {
  const screenW = useScreenWidth();
  const isNarrow = screenW <= 768;
  const [collapsed, setCollapsed] = useState(false);

  // MOBILE WEB
  if (Platform.OS === "web" && isNarrow) {
    return (
      <ErrorBoundary>
        <div style={{
          display: "flex", flexDirection: "column",
          height: "100vh", width: "100%",
          background: FoodGradients.shellBg,
          position: "relative", overflow: "hidden",
        } as any}>
          <ToastContainer />
          <div style={{
            flex: 1, overflow: "auto",
            position: "relative",
            minHeight: 0, minWidth: 0,
            padding: 16,
          } as any}>
            {children ?? <Slot />}
          </div>
          <FoodMBar />
        </div>
      </ErrorBoundary>
    );
  }

  // DESKTOP WEB
  if (Platform.OS === "web") {
    return (
      <ErrorBoundary>
        <div style={{
          display: "flex", flexDirection: "row",
          height: "100vh", width: "100%",
          background: FoodColors.bg, position: "relative",
        } as any}>
          <FoodSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
          <div style={{
            flex: 1, minHeight: "100%",
            background: FoodGradients.shellBg,
            overflow: "auto", position: "relative", minWidth: 0,
          } as any}>
            <ToastContainer />
            <div style={{ padding: 24, maxWidth: 1320, margin: "0 auto" } as any}>
              {children ?? <Slot />}
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // NATIVE
  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: FoodColors.bg }}>
        <View style={{ flex: 1 }}>
          <ToastContainer />
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {children ?? <Slot />}
          </ScrollView>
        </View>
        <FoodMBar />
      </View>
    </ErrorBoundary>
  );
}

export default FoodShell;
