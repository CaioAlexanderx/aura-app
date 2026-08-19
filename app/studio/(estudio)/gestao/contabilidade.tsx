// ============================================================
// AURA STUDIO · Gestão / Contabilidade
//
// 25/05/2026: substitui o StudioBridge stub. Estratégia "delegação 1:1":
// renderiza o ContabilidadeScreen completo do Aura Varejo (FiscalHero +
// DasPreviewCard + Timeline obrigações + Guias + Histórico) com uma
// barra contextual Studio no topo.
//
// 26/05/2026 (fix visual): ContabilidadeScreen usa Colors do varejo
// (dark navy por default), e o wrapper Studio usava t.bgSoft/
// t.paperCardElev (claros) → barra clara em cima + card dark embaixo,
// sem continuidade. Migrado wrapper+header pra Colors do varejo
// (bg/bg3/border/ink3) pra herdar o tema do conteúdo.
//
// 19/08/2026 (QA item 20): `StudioColors.accent` (estático) trocado por
// `useStudioTokens().accent`. Colors.bg/bg3/border/ink* continuam ligados
// ao tema do varejo de propósito — mesma fonte de cor que o
// ContabilidadeScreen embutido usa; ver mesmo racional em gestao/nfe.tsx.
//
// 19/08/2026 (QA item 17): ContabilidadeScreen renderizava seu próprio
// <Text>Contabilidade</Text> logo abaixo do título "Contabilidade do
// estúdio" deste wrapper — 2 blocos de texto redundantes. A tela agora
// aceita `embedded` (default false, varejo não muda); passamos `embedded`
// aqui pra suprimir esse título interno. Também removido o contextBanner
// ("Vendas personalizadas aparecem nos relatórios...") que só repetia o
// que o subtitle já diz — mesmo racional do banner removido em
// gestao/financeiro.tsx e gestao/nfe.tsx.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import ContabilidadeScreen from "@/app/(tabs)/contabilidade";

export default function StudioGestaoContabilidade() {
  const t = useStudioTokens();
  return (
    <View style={s.wrapper}>
      <View style={s.header}>
        <Text style={[s.eyebrow, { color: t.accent }]}>GESTÃO · CONTABILIDADE</Text>
        <Text style={s.title}>Contabilidade do estúdio</Text>
        <Text style={s.subtitle}>
          Obrigações fiscais, DRE e relatórios mensais. Operações Studio entram automaticamente nos números.
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <ContabilidadeScreen embedded />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bg3,
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.ink3,
    lineHeight: 18,
    maxWidth: 720,
    marginBottom: 4,
  },
});
