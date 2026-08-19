// ============================================================
// Layout autenticado do Aura Studio.
// Espelha padrão do app/food/(salao)/_layout.tsx.
//
// Gates (ordem):
//   1. isHydrated — espera auth carregar do storage
//   2. Plano — Studio é vertical Negócio+Expansão, com precedência de
//      module_overrides['studio'] (regra da casa: override antes de plan===).
//      Gate restaurado 10/06/2026 (Onda 1 — 1.2, decisão Caio). Espelha o
//      requirePlan('negocio','expansao') do backend (private.js).
//   3. pdv_settings.studio_enabled === true OU is_staff — toggle ligado
//
// Combate armadilha_plano_stale_jwt: refreshMe() no mount revalida
// plan/module_overrides antes de decidir o gate de plano (StudioShell não
// chamava refreshMe; o layout passa a chamar).
// ============================================================
import { useEffect } from "react";
import { View, Text, Platform } from "react-native";
import { StudioShell } from "@/components/studio/StudioShell";
import { EmptyState } from "@/components/EmptyState";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { PLAN_LEVEL } from "@/hooks/useVisibleModules";
import { Fonts, GOOGLE_FONTS_CSS } from "@/constants/fonts";

// ── Tipografia Aura no Studio (19/08/2026) ──────────────────
// O link do Google Fonts só era injetado no layout do Negócio
// ((tabs)/_layout) — quem entrava direto em /studio ficava no
// system-ui e até o wordmark caía no fallback Georgia. Injeta o
// mesmo link (id compartilhado, sem duplicar) + DM Sans como fonte
// base de todo texto do Studio. Textos com fontFamily explícita
// (Instrument Serif do wordmark, monospace) têm estilo inline e
// não são afetados pela regra CSS.
function injectStudioFonts() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (!document.getElementById("aura-fonts")) {
    const lk = document.createElement("link");
    lk.id = "aura-fonts"; lk.rel = "stylesheet"; lk.href = GOOGLE_FONTS_CSS;
    document.head.appendChild(lk);
  }
  if (!document.getElementById("studio-typography")) {
    const st = document.createElement("style");
    st.id = "studio-typography";
    st.textContent =
      `#root div[dir="auto"], #root input, #root textarea, #root button { font-family: ${Fonts.body}; }`;
    document.head.appendChild(st);
  }
}

export default function StudioLayout() {
  const { company, isHydrated, user } = useAuthStore();
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const tk = useStudioTokens();
  const { settings, isLoading: pdvLoading } = usePdvSettings();

  // Revalida plan/module_overrides no mount (JWT pode estar stale).
  useEffect(() => {
    if (typeof refreshMe === "function") refreshMe();
  }, [refreshMe]);

  // Fontes Aura (Instrument Serif + DM Sans) no Studio.
  useEffect(() => {
    injectStudioFonts();
  }, []);

  if (!isHydrated) return null;

  // Gate de plano: Negócio+Expansão, com precedência de module_overrides['studio'].
  const plan = company?.plan || "essencial";
  const overrides = ((company as any)?.module_overrides ?? {}) as Record<string, boolean>;
  const studioOverride = overrides["studio"];
  const planAllowsStudio =
    studioOverride === true
      ? true
      : studioOverride === false
      ? false
      : (PLAN_LEVEL[plan] ?? 0) >= (PLAN_LEVEL["negocio"] ?? 1);

  if (!planAllowsStudio && !user?.is_staff) {
    return (
      <View style={{ flex: 1, backgroundColor: tk.bg, padding: 24 }}>
        <Text style={{
          fontSize: 11, color: tk.accent, fontWeight: "800",
          letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4,
        }}>
          AURA STUDIO
        </Text>
        <Text style={{ fontSize: 22, color: tk.ink, fontWeight: "800", marginBottom: 24 }}>
          Disponível nos planos Negócio e Expansão
        </Text>
        <EmptyState
          icon="lock"
          title="Studio não incluído no seu plano"
          subtitle="O Aura Studio (loja de personalizados, produção e loja digital) está disponível a partir do plano Negócio. Fale com a gente pra liberar no seu plano."
        />
      </View>
    );
  }

  // Toggle ligado? (defensivo — settings ainda carregando libera, igual food)
  const studioOff =
    !pdvLoading &&
    settings &&
    (settings as any).studio_enabled === false;

  if (studioOff && !user?.is_staff) {
    return (
      <View style={{ flex: 1, backgroundColor: tk.bg, padding: 24 }}>
        <Text style={{
          fontSize: 11, color: tk.accent, fontWeight: "800",
          letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4,
        }}>
          AURA STUDIO
        </Text>
        <Text style={{ fontSize: 22, color: tk.ink, fontWeight: "800", marginBottom: 24 }}>
          Modo Studio desativado
        </Text>
        <EmptyState
          icon="settings"
          title="Studio não habilitado"
          subtitle="Pra começar a vender personalizados (canecas, camisetas, brindes) ative o modo Studio em Configurações > PDV > Políticas do Caixa."
        />
      </View>
    );
  }

  return <StudioShell />;
}
