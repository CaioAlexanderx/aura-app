// ============================================================
// AURA STUDIO · StudioScreen — scaffold canônico de tela (Fase 1a)
//
// Container único, mobile-first, com variante de largura por arquétipo.
// Mata o "onde está o conteúdo muda" — todas as telas alinham à ESQUERDA
// (nada de coluna estreita centralizada) com a mesma disciplina.
//
// Variantes (DD-5):
//   reading ~1100  — tabela de leitura / formulário / texto
//   grid    ~1440  — grades visuais (galeria, cards)
//   board   cheio  — KDS / PDV / boards que querem largura útil total
//
// Theme-aware: bg vem de useStudioTokens(). Pull-to-refresh opcional.
// Telas board normalmente gerenciam o próprio scroll → use scroll={false}.
//
// StudioPullToRefresh foi movido pra cá (era exportado do StudioShell).
// A cópia do shell sai na Fase 2 (decomposição); por ora ambas coexistem.
// ============================================================
import React, { ReactNode } from "react";
import {
  View, ScrollView, RefreshControl, useWindowDimensions,
} from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";

export type StudioScreenVariant = "reading" | "grid" | "board";

const MAX_WIDTH: Record<StudioScreenVariant, number | undefined> = {
  reading: 1100,
  grid: 1440,
  board: undefined, // largura útil cheia
};

// ─── Pull-to-refresh (movido do StudioShell) ────────────────
export function StudioPullToRefresh({
  refreshing, onRefresh, children, contentContainerStyle,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  children: ReactNode;
  contentContainerStyle?: any;
}) {
  const tk = useStudioTokens();
  return (
    <ScrollView
      contentContainerStyle={contentContainerStyle}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={tk.primary}
          colors={[tk.primary, tk.accent]}
          progressBackgroundColor={tk.paperCardElev}
        />
      }
    >
      {children}
    </ScrollView>
  );
}

type StudioScreenProps = {
  children: ReactNode;
  variant?: StudioScreenVariant;
  /** Renderiza dentro de um ScrollView. board normalmente quer false. */
  scroll?: boolean;
  /** Pull-to-refresh (só com scroll). */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Padding interno (mobile-first). Default true. */
  padded?: boolean;
  /** Alinhamento da coluna. Default "left" (mata coluna centralizada). */
  align?: "left" | "center";
  /** Estilo extra no content wrapper. */
  contentStyle?: any;
  /** Estilo extra no container externo. */
  style?: any;
};

export function StudioScreen({
  children,
  variant = "grid",
  scroll = true,
  refreshing,
  onRefresh,
  padded = true,
  align = "left",
  contentStyle,
  style,
}: StudioScreenProps) {
  const tk = useStudioTokens();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const maxWidth = MAX_WIDTH[variant];
  const pad = padded ? (isMobile ? 16 : 28) : 0;

  // Coluna alinhada à esquerda por padrão. board (sem maxWidth) ocupa tudo.
  const inner = {
    width: "100%" as const,
    ...(maxWidth ? { maxWidth } : {}),
    alignSelf: align === "center" ? ("center" as const) : ("flex-start" as const),
    padding: pad,
    paddingBottom: padded ? pad + 32 : 0,
  };

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: tk.bg }, style]}>
        <View style={[inner, { flex: 1 }, contentStyle]}>{children}</View>
      </View>
    );
  }

  const content = <View style={[inner, contentStyle]}>{children}</View>;

  if (onRefresh) {
    return (
      <View style={[{ flex: 1, backgroundColor: tk.bg }, style]}>
        <StudioPullToRefresh
          refreshing={!!refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {content}
        </StudioPullToRefresh>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: tk.bg }, style]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{content}</ScrollView>
    </View>
  );
}

export default StudioScreen;
