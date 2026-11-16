// ============================================================
// AURA. — Personalizados: tema do Negócio para as telas do Studio (p-128)
//
// O StudioThemeProvider da raiz (app/_layout.tsx) entrega a paleta do shell
// /studio, escura por padrão. As telas de app/(tabs)/personalizados reusam
// componentes do Studio que leem useStudioTokens() e useStudioSemantic().
// Envolvidas por este componente, elas recebem as cores do Negócio e o tema
// (claro ou escuro) do app, sem trocar uma linha nos componentes.
//
// Uso: <TemaDoNegocio> ...tela... </TemaDoNegocio>
// ============================================================
import React, { useMemo, type ReactNode } from "react";
import { useColors, useThemeStore } from "@/constants/colors";
import { StudioThemeOverride } from "@/contexts/StudioThemeMode";
import { getStudioSemantic } from "@/constants/studio-semantic";
import { tokensDoNegocio } from "@/constants/personalizados-tokens";

export function TemaDoNegocio({ children }: { children: ReactNode }) {
  const cores = useColors();
  const isDark = useThemeStore((s) => s.isDark);
  const tokens = useMemo(() => tokensDoNegocio(cores, isDark), [cores, isDark]);
  const semantic = useMemo(() => getStudioSemantic(isDark), [isDark]);
  return (
    <StudioThemeOverride tokens={tokens} semantic={semantic} isDark={isDark}>
      {children}
    </StudioThemeOverride>
  );
}
