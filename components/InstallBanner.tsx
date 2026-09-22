// ============================================================
// AURA. — InstallBanner: convite para instalar a Aura no celular
//
// Criado: 22/09/2026 (PWA Fase 1)
//
// Entra na pilha de avisos do topo do Painel, ao lado de TrialBanner,
// ProfileBanner e VerifyEmailBanner. É um card inline: não flutua, não
// cobre conteúdo (regra 6 do CLAUDE.md, no espírito).
//
// Aparece SÓ quando faz sentido, e some sozinho no resto:
//   · web, em tela de celular (mesmo corte do _layout: largura ≤ 768);
//   · a Aura ainda não está instalada neste aparelho;
//   · o lojista não pediu "Agora não" nos últimos 14 dias;
//   · e há o que oferecer: o convite nativo (Android/Chrome) ou o guia
//     (iPhone). Em computador sem convite, nada.
//
// Mockup: docs/mockups/pwa-instalar-app.html, telas A e B.
// ============================================================
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useInstalarApp } from "@/hooks/useInstalarApp";
import { GuiaInstalarIphone } from "@/components/GuiaInstalarIphone";

/** Mesmo corte de `isNarrow` em app/(tabs)/_layout.tsx (Sidebar × MBar). */
export const LARGURA_CELULAR = 768;

export function InstallBanner() {
  const { width } = useWindowDimensions();
  const { instalado, podeInstalar, ehIphone, dispensado, instalar, dispensar } = useInstalarApp();
  const [guiaAberto, setGuiaAberto] = useState(false);
  const [instalando, setInstalando] = useState(false);

  if (Platform.OS !== "web") return null;
  if (width > LARGURA_CELULAR) return null;
  if (instalado || dispensado) return null;
  if (!podeInstalar && !ehIphone) return null;

  async function aoInstalar() {
    if (ehIphone) { setGuiaAberto(true); return; }
    setInstalando(true);
    try {
      const r = await instalar();
      if (r === "aceito") toast.success("Aura instalada! Procure o ícone na tela inicial.");
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

  const titulo = ehIphone ? "Instalar a Aura no iPhone" : "Instalar a Aura no celular";
  const descricao = ehIphone
    ? "Ícone na tela inicial, tela cheia e aviso de pedido novo, que no iPhone só funciona assim."
    : "Abre em tela cheia, como app, e avisa quando entra pedido. Leva dois toques.";
  const rotuloBotao = ehIphone ? "Ver como instalar" : instalando ? "Abrindo..." : "Instalar";

  return (
    <View style={s.card} testID="install-banner">
      <Pressable onPress={dispensar} style={s.fechar} accessibilityLabel="Agora não" hitSlop={8}>
        <Icon name="x" size={14} color={Colors.ink3} />
      </Pressable>

      <View style={s.linha}>
        <View style={s.icone}>
          <Icon name="download" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1, paddingRight: 18 }}>
          <Text style={s.titulo}>{titulo}</Text>
          <Text style={s.descricao}>{descricao}</Text>
        </View>
      </View>

      <View style={s.acoes}>
        <Pressable onPress={aoInstalar} style={s.btnPrimario} disabled={instalando} accessibilityRole="button">
          <Text style={s.btnPrimarioTexto}>{rotuloBotao}</Text>
        </Pressable>
        <Pressable onPress={dispensar} style={s.btnGhost} accessibilityRole="button">
          <Text style={s.btnGhostTexto}>Agora não</Text>
        </Pressable>
      </View>

      <GuiaInstalarIphone visible={guiaAberto} onClose={aoFecharGuia} />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    position: "relative",
    backgroundColor: Colors.violetD,
    borderWidth: 1, borderColor: Colors.border2,
    borderRadius: 16, padding: 14, marginBottom: 16, gap: 10,
  },
  fechar: { position: "absolute", top: 8, right: 8, padding: 6, zIndex: 1 },
  linha: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icone: {
    width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.violet,
  },
  titulo: { fontSize: 14, fontWeight: "700", color: Colors.ink, lineHeight: 18 },
  descricao: { fontSize: 12, color: Colors.ink2, lineHeight: 17, marginTop: 3 },
  acoes: { flexDirection: "row", gap: 8 },
  btnPrimario: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  btnPrimarioTexto: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnGhost: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  btnGhostTexto: { color: Colors.ink2, fontSize: 13, fontWeight: "600" },
});

export default InstallBanner;
