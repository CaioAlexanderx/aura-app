// ============================================================
// AURA. — Karatê: convite para instalar o app no celular (PWA 2b.1)
//
// Criado: 22/09/2026
//
// A Fase 1 (#925) pôs o convite no Painel e em Configurações das ABAS do
// painel de varejo. Dojô e federação têm shell próprio (DojoShell /
// KarateShell) e não passam por lá: quem só usa o Karatê nunca viu o
// convite — e no iPhone o aviso de solicitação (Web Push) só funciona com
// o app instalado, então o Karatê ficou sem o ganho todo.
//
// A LÓGICA é a mesma de sempre (hooks/useInstalarApp.ts). Aqui muda só a
// roupa: Shoji — papel de arroz, sumi, carimbo vermelho como acento raro,
// Shippori Mincho nos títulos. E o botão primário é SUMI, não vermelho:
// regra da casa no Karatê (ver constants/karateTheme.ts).
//
// Mockup: docs/mockups/pwa-2b1-karate-instalar.html.
//
// NÃO aparece no portal público em subdomínio ({slug}.getaura.com.br): ele
// serve o mesmo site, e instalar de lá criaria um segundo app com o nome
// do painel. Os shells do Karatê não são montados no portal, e a trava por
// subdomínio aqui é o cinto e o suspensório.
// ============================================================
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type TextStyle, type ViewStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { KarateColors, KarateFonts, ShojiPalette } from "@/constants/karateTheme";
import { useInstalarApp } from "@/hooks/useInstalarApp";
import { isMicrositeHost } from "@/utils/microsite";
import { GuiaInstalarKarate } from "@/components/karate/GuiaInstalarKarate";

/** BREAKPOINT_SIDEBAR dos dois shells: >= 768 é "wide" (sidebar). */
const LARGURA_CELULAR = 768;

type Props = {
  /** "dojô" ou "federação": só troca o texto. */
  contexto?: "dojo" | "federacao";
};

export function InstalarKarateCard({ contexto = "dojo" }: Props) {
  const { width } = useWindowDimensions();
  const { instalado, podeInstalar, ehIphone, dispensado, instalar, dispensar } = useInstalarApp();
  const [guiaAberto, setGuiaAberto] = useState(false);
  const [instalando, setInstalando] = useState(false);

  if (Platform.OS !== "web") return null;
  if (isMicrositeHost()) return null;
  if (width >= LARGURA_CELULAR) return null;
  if (instalado || dispensado) return null;
  if (!podeInstalar && !ehIphone) return null;

  async function aoInstalar() {
    if (ehIphone) { setGuiaAberto(true); return; }
    setInstalando(true);
    try {
      const r = await instalar();
      if (r === "aceito") toast.success("Aura Karatê instalado! Procure o ícone na tela inicial.");
      else if (r === "indisponivel") toast.error("O navegador não ofereceu a instalação agora. Tente de novo mais tarde.");
    } finally {
      setInstalando(false);
    }
  }

  function aoFecharGuia() {
    setGuiaAberto(false);
    // Quem viu o guia ou instala (e o card some sozinho, em standalone) ou
    // não quer agora: nos dois casos, parar de insistir por 14 dias.
    dispensar();
  }

  const ondeAvisa = contexto === "dojo" ? "chega solicitação" : "chega pedido de filiação";
  const titulo = ehIphone ? "Instalar o Aura Karatê no iPhone" : "Instalar o Aura Karatê no celular";
  const descricao = ehIphone
    ? `Ícone na tela inicial, tela cheia e aviso quando ${ondeAvisa}, que no iPhone só funciona assim.`
    : `Abre em tela cheia, como app, e avisa quando ${ondeAvisa}. Leva dois toques.`;

  return (
    <View style={s.faixa}>
      <View style={s.card} testID="instalar-karate-card">
        <Pressable onPress={dispensar} style={s.fechar} accessibilityLabel="Agora não" hitSlop={8}>
          <Icon name="x" size={13} color={KarateColors.ink3} />
        </Pressable>

        <View style={s.linha}>
          <View style={s.selo}>
            <Text style={s.seloTxt}>空</Text>
          </View>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={s.titulo}>{titulo}</Text>
            <Text style={s.descricao}>{descricao}</Text>
          </View>
        </View>

        <View style={s.acoes}>
          <Pressable onPress={aoInstalar} style={s.btnPrimario} disabled={instalando} accessibilityRole="button">
            <Text style={s.btnPrimarioTxt}>{ehIphone ? "Ver como instalar" : instalando ? "Abrindo..." : "Instalar"}</Text>
          </Pressable>
          <Pressable onPress={dispensar} style={s.btnGhost} accessibilityRole="button">
            <Text style={s.btnGhostTxt}>Agora não</Text>
          </Pressable>
        </View>
      </View>

      <GuiaInstalarKarate visible={guiaAberto} onClose={aoFecharGuia} />
    </View>
  );
}

const s = StyleSheet.create({
  // Mesma faixa do TrialBanner do DojoShell: o card entra na pilha de
  // avisos, não flutua sobre o conteúdo.
  faixa: { paddingHorizontal: 12, paddingBottom: 8, backgroundColor: KarateColors.bg } as ViewStyle,
  card: {
    position: "relative",
    backgroundColor: ShojiPalette.glassHi,
    borderWidth: 1,
    borderColor: ShojiPalette.line2,
    borderLeftWidth: 3,
    borderLeftColor: KarateColors.primary,
    borderRadius: 4,
    padding: 13,
    gap: 9,
  } as ViewStyle,
  fechar: { position: "absolute", top: 5, right: 7, padding: 5, zIndex: 1 } as ViewStyle,
  linha: { flexDirection: "row", alignItems: "flex-start", gap: 11 } as ViewStyle,
  selo: {
    width: 40, height: 40, borderRadius: 3, alignItems: "center", justifyContent: "center",
    backgroundColor: ShojiPalette.headRed,
  } as ViewStyle,
  seloTxt: { fontFamily: KarateFonts.heading, fontSize: 20, color: ShojiPalette.paperWarm } as TextStyle,
  titulo: { fontFamily: KarateFonts.heading, fontWeight: "600", fontSize: 14.5, color: KarateColors.ink, lineHeight: 19 } as TextStyle,
  descricao: { fontFamily: KarateFonts.body, fontSize: 12, color: KarateColors.ink2, lineHeight: 17, marginTop: 3 } as TextStyle,
  acoes: { flexDirection: "row", gap: 8 } as ViewStyle,
  // Primário em SUMI (tinta), não em vermelho: o vermelhão é acento raro.
  btnPrimario: { backgroundColor: ShojiPalette.ink, borderRadius: 3, paddingVertical: 9, paddingHorizontal: 14 } as ViewStyle,
  btnPrimarioTxt: { fontFamily: KarateFonts.body, color: ShojiPalette.paperWarm, fontSize: 12.5, fontWeight: "700" } as TextStyle,
  btnGhost: { borderWidth: 1, borderColor: ShojiPalette.line2, borderRadius: 3, paddingVertical: 9, paddingHorizontal: 14 } as ViewStyle,
  btnGhostTxt: { fontFamily: KarateFonts.body, color: KarateColors.ink2, fontSize: 12.5, fontWeight: "700" } as TextStyle,
});

export default InstalarKarateCard;
