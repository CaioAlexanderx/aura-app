// ============================================================
// StudioPageHeader — header canonico de telas do Aura Studio.
//
// Fase 0 UX overhaul (25/05/2026).
// Padroniza o "eyebrow magenta + titulo navy" que aparece em quase
// todas as telas. Antes cada arquivo duplicava ~30 linhas de styles.
//
// Uso minimal (eyebrow derivado automaticamente da rota):
//   <StudioPageHeader
//     title="Sua loja Studio na internet"
//   />
//
// Uso com eyebrow explícito (retrocompatível):
//   <StudioPageHeader
//     eyebrow="VENDAS · LOJA DIGITAL"
//     title="Sua loja Studio na internet"
//   />
//
// Com subtitle + slot direito:
//   <StudioPageHeader
//     eyebrow="GESTÃO · FINANCEIRO"
//     title="Financeiro do estúdio"
//     subtitle="DRE, fluxo de caixa, comparativos. Vendas Studio entram automaticamente."
//     rightSlot={<MeuBotao />}
//   />
//
// 02/06/2026 (Shell clareza): quando nenhuma prop eyebrow for passada,
// deriva automaticamente via eyebrowForRoute(usePathname()).
// Se eyebrow for passado explicitamente, respeita sem modificação.
// ============================================================
import { ReactNode, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { usePathname } from "expo-router";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { eyebrowForRoute } from "@/components/studio/StudioShell/nav";

export function StudioPageHeader({
  eyebrow,
  title,
  subtitle,
  rightSlot,
  marginBottom = 18,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  marginBottom?: number;
}) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  // Auto-derive eyebrow from current route when not explicitly provided.
  // usePathname() is safe here — StudioPageHeader is always rendered
  // inside an expo-router screen so the router context is available.
  const pathname = usePathname();
  const resolvedEyebrow = eyebrow !== undefined ? eyebrow : eyebrowForRoute(pathname);

  return (
    <View style={[s.row, { marginBottom }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {resolvedEyebrow && <Text style={s.eyebrow}>{resolvedEyebrow}</Text>}
        <Text style={s.title}>{title}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      {rightSlot && <View style={s.rightSlot}>{rightSlot}</View>}
    </View>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: 11,
    color: t.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: t.ink,
    marginTop: 4,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13.5,
    // ink3 garante ≥4.5:1 sobre paperCard (5.1:1 light, 5.7:1 dark)
    color: t.ink3,
    marginTop: 4,
    maxWidth: 720,
  },
  rightSlot: {
    flexShrink: 0,
  },
  });
}

export default StudioPageHeader;
