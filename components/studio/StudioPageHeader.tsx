// ============================================================
// StudioPageHeader — header canonico de telas do Aura Studio.
//
// Fase 0 UX overhaul (25/05/2026).
// Padroniza o "eyebrow magenta + título navy" que aparece em quase
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
//
// 05/10/2026 (QA mobile): abaixo de 768 px o cabeçalho empilha. Título em
// UMA linha (fonte menor, corta com reticências), subtítulo em uma linha
// truncada, e as ações vão para uma linha própria embaixo — nunca dividem
// a linha com o título (na Produção o título quebrava letra a letra ao
// lado de "Modo vitrine" e "Atualizar").
//   - `mobileActions` troca o `rightSlot` no celular. Passe `null` quando a
//     ação do cabeçalho já é a do botão flutuante da tela (uma ação
//     principal por tela); passe outro nó para ações só do celular.
//   - Sem `mobileActions`, o `rightSlot` desce para a linha de ações.
// ============================================================
import { ReactNode, useMemo } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { usePathname } from "expo-router";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { eyebrowForRoute } from "@/components/studio/StudioShell/nav";

export function StudioPageHeader({
  eyebrow,
  title,
  subtitle,
  rightSlot,
  mobileActions,
  marginBottom = 18,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  /** Só no celular: substitui o rightSlot. `null` = nenhuma ação no cabeçalho. */
  mobileActions?: ReactNode;
  marginBottom?: number;
}) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  // Auto-derive eyebrow from current route when not explicitly provided.
  // usePathname() is safe here — StudioPageHeader is always rendered
  // inside an expo-router screen so the router context is available.
  const pathname = usePathname();
  const resolvedEyebrow = eyebrow !== undefined ? eyebrow : eyebrowForRoute(pathname);

  const { width } = useWindowDimensions();
  if (width < 768) {
    const acoes = mobileActions !== undefined ? mobileActions : rightSlot;
    return (
      <View style={{ marginBottom: Math.min(marginBottom, 14) }} testID="studio-page-header-mobile">
        {resolvedEyebrow && <Text style={s.eyebrow} numberOfLines={1}>{resolvedEyebrow}</Text>}
        <Text style={[s.title, s.titleMobile]} numberOfLines={1} testID="studio-page-title">{title}</Text>
        {subtitle && <Text style={[s.subtitle, s.subtitleMobile]} numberOfLines={1}>{subtitle}</Text>}
        {acoes ? <View style={s.mobileActions} testID="studio-page-actions">{acoes}</View> : null}
      </View>
    );
  }

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
    // AA fix (QA LJ-48, 28/09/2026): t.accent puro (#EC4899) em texto de
    // 11px dava 2,91:1 sobre o bg do Studio. t.accentInk é a MESMA família
    // de magenta, só mais escura (#BE185D light) — já usada como texto em
    // outras telas (loja-digital.tsx) por causa do mesmo AA fix.
    color: t.accentInk,
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
  titleMobile: {
    fontSize: 20,
    marginTop: 2,
  },
  subtitleMobile: {
    fontSize: 12.5,
    marginTop: 2,
  },
  mobileActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  });
}

export default StudioPageHeader;
