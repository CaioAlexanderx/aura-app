// ============================================================
// AURA. — Karatê: como pôr o Aura Karatê na tela inicial do iPhone
//
// Criado: 22/09/2026 (PWA 2b.1)
//
// Mesmo conteúdo de components/GuiaInstalarIphone.tsx (o iPhone não tem
// convite de instalação: Compartilhar › Adicionar à Tela de Início ›
// Adicionar), com a roupa Shoji em vez da violeta do painel.
//
// Componente separado, e não uma prop de tema no guia do painel, porque a
// diferença não é só cor: é tipografia (Shippori Mincho), raio de canto
// (4px em vez de 12), botão primário em sumi e passos numerados em DM Mono
// no lugar de ícones. Um só componente com dois temas ficaria mais difícil
// de ler que dois componentes honestos.
//
// Mockup: docs/mockups/pwa-2b1-karate-instalar.html, tela B.
// ============================================================
import { ScrollView, StyleSheet, Text, View, Pressable, type TextStyle, type ViewStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { KarateColors, KarateFonts, ShojiPalette } from "@/constants/karateTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const PASSOS = [
  { n: "1", titulo: "Toque em Compartilhar", detalhe: "O quadrado com a seta para cima, na barra de baixo do Safari." },
  { n: "2", titulo: "Adicionar à Tela de Início", detalhe: "Role a lista de opções até achar. Fica depois de “Adicionar aos Favoritos”." },
  { n: "3", titulo: "Toque em Adicionar", detalhe: "Pronto. O Aura Karatê aparece como app na tela inicial. Da próxima vez, abra por lá." },
];

export function GuiaInstalarKarate({ visible, onClose }: Props) {
  return (
    <ResponsiveSheet visible={visible} onClose={onClose} maxWidth={440} sheetStyle={s.sheet}>
      <View style={s.header}>
        <Text style={s.titulo}>Instalar no iPhone</Text>
        <Text style={s.sub}>O iPhone não mostra um botão de instalar. São três toques no Safari:</Text>
      </View>

      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.lista}>
        {PASSOS.map((p) => (
          <View key={p.n} style={s.passo} accessibilityLabel={`Passo ${p.n}: ${p.titulo}`}>
            <View style={s.passoN}>
              <Text style={s.passoNTxt}>{p.n}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.passoTitulo}>{p.titulo}</Text>
              <Text style={s.passoDetalhe}>{p.detalhe}</Text>
            </View>
          </View>
        ))}
        <View style={s.notaBox}>
          <Icon name="info" size={13} color={KarateColors.ink3} />
          <Text style={s.nota}>
            Depois de instalar, entre com seu login uma vez. O app instalado tem memória separada do Safari.
          </Text>
        </View>
      </ScrollView>

      <View style={s.rodape}>
        <Pressable onPress={onClose} style={s.cta} accessibilityRole="button">
          <Text style={s.ctaTxt}>Entendi</Text>
        </Pressable>
      </View>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  // Papel, e a borda de carimbo no topo — a folha do Karatê não é a do painel.
  sheet: {
    backgroundColor: ShojiPalette.paperWarm,
    borderColor: ShojiPalette.line2,
    borderTopWidth: 2,
    borderTopColor: KarateColors.primary,
  } as ViewStyle,
  header: { paddingHorizontal: 17, paddingTop: 13, paddingBottom: 5, gap: 4 } as ViewStyle,
  titulo: { fontFamily: KarateFonts.heading, fontWeight: "600", fontSize: 16.5, color: KarateColors.ink } as TextStyle,
  sub: { fontFamily: KarateFonts.body, fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  lista: { paddingHorizontal: 17, paddingVertical: 9, gap: 9 } as ViewStyle,
  passo: {
    flexDirection: "row", alignItems: "center", gap: 11,
    backgroundColor: ShojiPalette.glassHi,
    borderWidth: 1, borderColor: ShojiPalette.line,
    borderRadius: 4, padding: 10,
  } as ViewStyle,
  passoN: {
    width: 34, height: 34, borderRadius: 3, alignItems: "center", justifyContent: "center",
    backgroundColor: ShojiPalette.paper2, borderWidth: 1, borderColor: ShojiPalette.line2,
  } as ViewStyle,
  passoNTxt: { fontFamily: KarateFonts.mono, fontSize: 13, color: ShojiPalette.red2, fontWeight: "500" } as TextStyle,
  passoTitulo: { fontFamily: KarateFonts.body, fontSize: 13, fontWeight: "700", color: KarateColors.ink, lineHeight: 17 } as TextStyle,
  passoDetalhe: { fontFamily: KarateFonts.body, fontSize: 11.5, color: KarateColors.ink3, marginTop: 2, lineHeight: 16 } as TextStyle,
  notaBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingHorizontal: 2, marginTop: 3 } as ViewStyle,
  nota: { flex: 1, fontFamily: KarateFonts.body, fontSize: 11.5, color: KarateColors.ink3, lineHeight: 16 } as TextStyle,
  rodape: { padding: 17, paddingTop: 7, borderTopWidth: 1, borderTopColor: ShojiPalette.line } as ViewStyle,
  cta: { backgroundColor: ShojiPalette.ink, borderRadius: 3, paddingVertical: 11, alignItems: "center" } as ViewStyle,
  ctaTxt: { fontFamily: KarateFonts.body, color: ShojiPalette.paperWarm, fontSize: 14, fontWeight: "700" } as TextStyle,
});

export default GuiaInstalarKarate;
