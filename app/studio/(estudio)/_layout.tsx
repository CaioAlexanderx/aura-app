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
import { View, Text, Platform, Pressable, Linking } from "react-native";
import { StudioShell } from "@/components/studio/StudioShell";
import { EmptyState } from "@/components/EmptyState";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { PLAN_LEVEL } from "@/hooks/useVisibleModules";
import { Fonts, GOOGLE_FONTS_CSS } from "@/constants/fonts";
import { waAura } from "@/constants/suporteAura";
import { PendingTourHost } from "@/components/onboarding/PendingTourHost";

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
    // FIX (achado do QA, 28/09/2026 — rodada 2): a tentativa anterior
    // (PR #992) listava só `div[dir="auto"], input, textarea, button`
    // dentro de `.aura-web-portal`. Não bastou: o CORPO da gaveta do sino
    // (NotificationDrawer.tsx) é escrito com HTML puro no branch web —
    // `<span>` pro título "Notificações", textos de evento etc., não
    // `View`/`Text` do React Native Web. `<span>` nunca bateu no seletor
    // `div[dir="auto"]`, então caía no fallback de sistema do navegador
    // (Times New Roman) — inclusive o próprio `document.body`, que também
    // não tinha `font-family` nenhum declarado (ver public/index.html).
    // Só "Marcar tudo lido" (dentro de um <button>, coberto pela regra
    // velha) saía em DM Sans — bate com o achado.
    //
    // Correção na causa: define a fonte na RAIZ (herda pra baixo em vez de
    // listar tag por tag) em dois lugares — `body` (documento inteiro,
    // cobre qualquer coisa fora de `#root`/`.aura-web-portal`, como texto
    // solto direto no `document.body`) e `.aura-web-portal` (mantido por
    // especificidade, caso algo redefina a fonte do body no meio do
    // caminho). `input`/`textarea`/`button`/`select` continuam explícitos
    // porque esses elementos NÃO herdam font-family do ancestral por
    // padrão no navegador (UA stylesheet força a fonte de sistema/form).
    st.textContent =
      // Bloco 1 — BASE herdada: cobre span/div/p/texto solto que não tem
      // atomic class do RNW (ex.: os <span> do sino em
      // NotificationDrawer.tsx, dentro do portal) via herança normal de
      // CSS, sem listar tag por tag. Cobre também `body` em si (não tinha
      // font-family nenhuma antes — o QA mediu Times New Roman ali).
      `body, #root, .aura-web-portal { font-family: ${Fonts.body}; } `
      // Bloco 2 — OVERRIDE pontual: só estes elementos ganham atomic
      // class do react-native-web com a PRÓPRIA font-family, então
      // precisam de seletor com especificidade maior que essa classe
      // (0,1,0) pra vencer a cascata (a base do bloco 1 sozinha perde).
      + `#root div[dir="auto"], #root input, #root textarea, #root button, #root select, `
      + `.aura-web-portal div[dir="auto"], .aura-web-portal input, .aura-web-portal textarea, .aura-web-portal button, .aura-web-portal select `
      + `{ font-family: ${Fonts.body}; }`;
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
          Aura Studio ainda não ativado
        </Text>
        {/* 05/10/2026: a frente Studio é ligada pela equipe (Gestão Aura ›
            Clientes › Frente). A instrução antiga mandava o cliente a um
            toggle que não existe para ele em Configurações. */}
        <EmptyState
          icon="settings"
          title="Studio não habilitado"
          subtitle="O Aura Studio é ativado pela equipe Aura. Fale com a gente pelo WhatsApp."
        />
        <Pressable
          onPress={() => { Linking.openURL(waAura("Quero ativar o Aura Studio")).catch(() => {}); }}
          accessibilityRole="link"
          testID="studio-bloqueio-whatsapp"
          style={{ alignSelf: "center", marginTop: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, backgroundColor: tk.accent }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Falar no WhatsApp</Text>
        </Pressable>
      </View>
    );
  }

  // Tour dos primeiros passos (spotlight no botão da tela alvo), com a
  // cor do Studio. Fora do StudioShell: o host usa portal no body.
  return (
    <>
      <StudioShell />
      <PendingTourHost
        palette={{
          surface: tk.paperCardElev || "#fff",
          border: tk.ink5 || "rgba(0,0,0,0.1)",
          ink: tk.ink, ink2: tk.ink2, ink3: tk.ink3,
          accent: tk.accent, accentInk: "#fff",
        }}
      />
    </>
  );
}
