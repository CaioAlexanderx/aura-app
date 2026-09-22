// ============================================================
// AURA. — NovaVersaoBanner: "Nova versão da Aura · Atualizar"
//
// Criado: 22/09/2026 (PWA Fase 2)
//
// Barra fixa embaixo, montada uma vez em GlobalOverlays. Aparece quando
// services/novaVersao.ts descobre que o servidor tem um deploy mais novo
// do que a página em execução, e fica até o toque. Nunca recarrega
// sozinha. No celular fica acima da MBar; no computador, no canto
// inferior direito.
//
// Mockup: docs/mockups/pwa-fase2-offline-versao-iphone.html, tela B.
// ============================================================
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { create } from "zustand";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { iniciarVigilancia } from "@/services/novaVersao";

type EstadoNovaVersao = { disponivel: boolean; marcar: () => void; limpar: () => void };
export const useNovaVersao = create<EstadoNovaVersao>((set) => ({
  disponivel: false,
  marcar: () => set({ disponivel: true }),
  limpar: () => set({ disponivel: false }),
}));

/** Mesmo corte de `isNarrow` em app/(tabs)/_layout.tsx. */
const LARGURA_CELULAR = 768;
/** Altura aproximada da MBar (barra de abas do celular) para a barra não a cobrir. */
const ALTURA_MBAR = 64;

export function NovaVersaoBanner() {
  const { width } = useWindowDimensions();
  const disponivel = useNovaVersao((s) => s.disponivel);
  const marcar = useNovaVersao((s) => s.marcar);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    return iniciarVigilancia({ aoDetectar: marcar });
  }, [marcar]);

  if (Platform.OS !== "web" || !disponivel) return null;

  const celular = width <= LARGURA_CELULAR;

  function atualizar() {
    try { window.location.reload(); } catch { /* sem window nao ha o que recarregar */ }
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        s.ancora,
        celular ? { left: 12, right: 12, bottom: ALTURA_MBAR + 8 } : { right: 20, bottom: 16, maxWidth: 420 },
      ]}
    >
      <View style={s.barra} accessibilityRole="alert" testID="nova-versao-banner">
        <View style={s.icone}>
          <Icon name="refresh" size={16} color={Colors.violet3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Nova versão da Aura</Text>
          <Text style={s.detalhe}>Toque para atualizar. Leva um segundo.</Text>
        </View>
        <Pressable onPress={atualizar} style={s.btn} accessibilityRole="button">
          <Text style={s.btnTexto}>Atualizar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ancora: { position: "absolute", zIndex: 60, ...(Platform.OS === "web" ? ({ position: "fixed" } as any) : {}) },
  barra: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border2,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    ...(Platform.OS === "web" ? ({ boxShadow: "0 16px 40px rgba(0,0,0,0.45)" } as any) : {}),
  },
  icone: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  titulo: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  detalhe: { fontSize: 11.5, color: Colors.ink3, marginTop: 1 },
  btn: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 13 },
  btnTexto: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
});

export default NovaVersaoBanner;
