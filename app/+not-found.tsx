// ============================================================
// app/+not-found.tsx
//
// QA do painel Studio (26/09/2026, achado 5): uma rota inexistente
// (ex.: /studio/orcamentos) caía na tela padrão do Expo Router, em
// inglês ("Unmatched Route / Page could not be found / Go back /
// Sitemap") — sem identidade nenhuma do app.
//
// StudioThemeProvider envolve o app inteiro (app/_layout.tsx), então
// useStudioTokens() funciona aqui mesmo fora de /studio/*; só a cor de
// destaque e o destino do botão mudam conforme a rota que a pessoa
// tentou abrir.
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";

// Violeta padrão do app (CLAUDE.md) — fora do Studio, o painel não é
// navy/magenta; é o roxo de sempre.
const VIOLETA_PADRAO = "#7C3AED";

export default function NotFoundScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useStudioTokens();
  const s = buildStyles(t);
  const emStudio = !!pathname && pathname.startsWith("/studio");
  const destaque = emStudio ? t.primary : VIOLETA_PADRAO;
  const destino = emStudio ? "/studio" : "/";

  return (
    <View style={s.wrap}>
      <View style={[s.iconBubble, { backgroundColor: t.bgSoft }]}>
        <Icon name="search" size={28} color={destaque} />
      </View>
      <Text style={s.title}>Não encontramos essa página</Text>
      <Text style={s.desc}>Confira o endereço ou volte para o início.</Text>
      <Pressable
        onPress={() => router.replace(destino as any)}
        style={[s.btn, { backgroundColor: destaque }]}
        accessibilityRole="button"
        accessibilityLabel="Ir para o início"
      >
        <Text style={s.btnTxt}>Ir para o início</Text>
      </Pressable>
    </View>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    wrap: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      gap: 6,
    },
    iconBubble: {
      width: 64, height: 64, borderRadius: 20,
      alignItems: "center", justifyContent: "center",
      marginBottom: 10,
    },
    title: {
      fontSize: 18, fontWeight: "800",
      color: t.ink, textAlign: "center", letterSpacing: -0.2,
    },
    desc: {
      fontSize: 13.5, color: t.ink3, textAlign: "center", maxWidth: 340,
      marginTop: 2,
    },
    btn: {
      marginTop: 20,
      paddingVertical: 12, paddingHorizontal: 22,
      borderRadius: 999,
    },
    btnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  });
}
