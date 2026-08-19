// ============================================================
// AURA STUDIO · Gestão / NF-e / NFC-e
//
// 25/05/2026: substitui o StudioBridge stub. Estratégia "delegação 1:1":
// renderiza o NfeScreen completo do Aura Varejo (lista + emissão NFC-e +
// emissão NFS-e + cancelamento + integração Nuvem Fiscal) com header
// Studio canônico no topo.
//
// 26/05/2026 (fix visual): NfeScreen usa Colors do varejo (dark navy
// por default), e o wrapper Studio usava t.bgSoft/t.paperCardElev
// (claros) → barra clara em cima + card dark embaixo, sem
// continuidade. Migrado wrapper+header pra Colors do varejo
// (bg/bg3/border/ink3) pra herdar o tema do conteúdo.
//
// 19/08/2026 (QA):
//   - item 17: NfeScreen (compartilhado, fora do escopo desta tela) já
//     renderiza seu próprio <PageHeader title="Notas fiscais" .../> — com
//     o eyebrow+title+subtitle do wrapper E o contextBanner abaixo, eram
//     3 blocos de texto antes do conteúdo. O contextBanner só repetia o
//     que o subtitle já dizia ("NFC-e sai automática"), então foi
//     removido — sobra 1 bloco no wrapper. Dedup completo (também tirar o
//     PageHeader interno do NfeScreen) precisa de mudança no arquivo
//     compartilhado app/(tabs)/nfe.tsx — reportado à parte.
//   - item 20: `StudioColors.accent` (estático) trocado por
//     `useStudioTokens().accent`. Colors.bg/bg3/border/ink* continuam
//     ligados ao tema do varejo de propósito — é a mesma fonte de cor que
//     o NfeScreen embutido usa; migrar só o wrapper pra useStudioTokens()
//     reintroduziria a barra clara/card escuro (tema Studio e tema Varejo
//     são stores independentes, podem divergir).
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import NfeScreen from "@/app/(tabs)/nfe";

export default function StudioGestaoNfe() {
  const t = useStudioTokens();
  return (
    <View style={[s.root, { backgroundColor: Colors.bg }]}>
      <View style={s.headerWrap}>
        <Text style={[s.eyebrow, { color: t.accent }]}>GESTÃO · NF-E / NFC-E</Text>
        <Text style={s.title}>Notas fiscais do estúdio</Text>
        <Text style={s.subtitle}>
          NFC-e nas vendas Studio é emitida automaticamente. Acima também você emite NF-e modelo 55 sob demanda.
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <NfeScreen />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 14,
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
