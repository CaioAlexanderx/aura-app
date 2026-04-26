import { useState, useEffect, ReactNode } from "react";
import { View, Platform, ScrollView } from "react-native";
import { Slot } from "expo-router";
import { ToastContainer } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DentalSidebar } from "@/components/dental/DentalSidebar";
import { DentalColors, DentalGradients } from "@/constants/dental-tokens";

// ============================================================
// DentalShell — Container completo da experiencia Aura Odonto.
//
// Sidebar dental + area de conteudo com background radial cyan.
// Equivalente a (tabs)/_layout para a vertical odonto. NAO reusa
// o (tabs)/_layout porque queremos isolar 100% do shell PDV/ERP
// — usuario odonto nunca ve Caixa/NF-e/Folha no menu.
//
// Mobile (<= 768px): renderiza o mesmo sidebar collapsed. Uma
// MBar dental dedicada fica para iteracao futura.
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
  const [collapsed, setCollapsed] = useState(isNarrow);
  useEffect(() => { setCollapsed(isNarrow); }, [isNarrow]);

  if (Platform.OS === "web") {
    return (
      <ErrorBoundary>
        <div style={{ display: "flex", flexDirection: "row", height: "100vh", width: "100%", background: DentalColors.bg, position: "relative" } as any}>
          <DentalSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
          <div style={{ flex: 1, minHeight: "100%", background: DentalGradients.shellBg, overflow: "auto", position: "relative", minWidth: 0 } as any}>
            <ToastContainer />
            <div style={{ padding: 24, maxWidth: 1320, margin: "0 auto" } as any}>
              {children ?? <Slot />}
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Native fallback (basico — drawer mobile fica para v2)
  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: DentalColors.bg, flexDirection: "row" }}>
        <DentalSidebar collapsed={true} onToggle={() => {}} />
        <View style={{ flex: 1 }}>
          <ToastContainer />
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {children ?? <Slot />}
          </ScrollView>
        </View>
      </View>
    </ErrorBoundary>
  );
}

export default DentalShell;
