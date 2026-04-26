import { useState, useEffect, ReactNode } from "react";
import { View, Platform, ScrollView } from "react-native";
import { Slot } from "expo-router";
import { ToastContainer } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DentalSidebar } from "@/components/dental/DentalSidebar";
import { DentalMBar } from "@/components/dental/DentalMBar";
import { DentalColors, DentalGradients } from "@/constants/dental-tokens";

// ============================================================
// DentalShell — Container completo da experiencia Aura Odonto.
//
// Tres modos de renderizacao:
//   1. Desktop web (>768px): sidebar lateral + content area
//      com max-width 1320 e padding 24.
//   2. Mobile web (<=768px): layout column com DentalMBar fixa
//      no rodape e content area que ocupa toda a viewport menos
//      a barra. Padding 16 sem max-width.
//   3. Native: View + ScrollView + DentalMBar (overlay "Mais"
//      do MBar nao funciona em native — limitacao conhecida).
//
// NAO reusa o (tabs)/_layout porque queremos isolar 100% do
// shell PDV/ERP. Usuario odonto nunca ve Caixa/NF-e/Folha
// no menu.
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

export function DentalShell({ children }: { children?: ReactNode }) {
  const screenW = useScreenWidth();
  const isNarrow = screenW <= 768;
  const [collapsed, setCollapsed] = useState(false);

  // ============================================================
  // MOBILE WEB — column layout com MBar dedicada no rodape.
  // ============================================================
  if (Platform.OS === "web" && isNarrow) {
    return (
      <ErrorBoundary>
        <div style={{
          display: "flex", flexDirection: "column",
          height: "100vh", width: "100%",
          background: DentalGradients.shellBg,
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
          <DentalMBar />
        </div>
      </ErrorBoundary>
    );
  }

  // ============================================================
  // DESKTOP WEB — sidebar lateral + content area.
  // ============================================================
  if (Platform.OS === "web") {
    return (
      <ErrorBoundary>
        <div style={{
          display: "flex", flexDirection: "row",
          height: "100vh", width: "100%",
          background: DentalColors.bg, position: "relative",
        } as any}>
          <DentalSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
          <div style={{
            flex: 1, minHeight: "100%",
            background: DentalGradients.shellBg,
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

  // ============================================================
  // NATIVE — layout column com ScrollView + MBar.
  // ============================================================
  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: DentalColors.bg }}>
        <View style={{ flex: 1 }}>
          <ToastContainer />
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {children ?? <Slot />}
          </ScrollView>
        </View>
        <DentalMBar />
      </View>
    </ErrorBoundary>
  );
}

export default DentalShell;
