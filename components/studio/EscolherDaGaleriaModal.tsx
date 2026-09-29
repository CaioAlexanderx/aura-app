// ============================================================
// AURA STUDIO · EscolherDaGaleriaModal (29/09/2026)
//
// A aba Templates do produto saiu da ficha (redesenho da ficha de
// personalização, docs/studio/ficha-de-personalizacao-diagnostico.md,
// decisão 2): o vinculador sobrevive como modal, aberto pelo "Escolher só
// alguns" do cartão "Arte da cliente".
//
// O miolo é o StudioTemplatesPanel de sempre, sem mudança de
// comportamento: vincular/desvincular, categorias, "Global da loja". Aqui
// só a casca no estilo do Studio: cartão centralizado (máx. 720 px,
// raio 18) no desktop; tela cheia abaixo de 720 px. O painel não tem
// rolagem própria, então a casca rola.
// ============================================================
import { useMemo } from "react";
import { Modal, View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { StudioTemplatesPanel } from "@/components/studio/StudioTemplatesPanel";

type Props = {
  visible: boolean;
  onClose: () => void;
  productId: string;
  companyId: string;
  productName: string;
  /** Quantos templates estão vinculados direto ao produto, depois de cada mudança. */
  onChanged?: (count: number) => void;
};

export function EscolherDaGaleriaModal({ visible, onClose, productId, companyId, productName, onChanged }: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  const { width: vw } = useWindowDimensions();
  const cheia = vw < 720;

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.fundo, cheia && s.fundoCheio]}>
        <View style={[s.cartao, cheia && s.cartaoCheio]} testID="escolher-da-galeria">
          <View style={s.cab}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.titulo} accessibilityRole="header">Escolher da galeria</Text>
              <Text style={s.sub} numberOfLines={1}>{productName}</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={s.fechar}
              accessibilityRole="button"
              accessibilityLabel="Fechar a galeria"
              testID="escolher-da-galeria-fechar"
            >
              <Icon name="x" size={20} color={t.ink2} />
            </Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
            <StudioTemplatesPanel
              productId={productId}
              companyId={companyId}
              productName={productName}
              onChanged={onChanged}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function estilos(t: StudioPalette) {
  return StyleSheet.create({
    fundo: {
      flex: 1,
      backgroundColor: "rgba(15,23,42,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    fundoCheio: { padding: 0, alignItems: "stretch", justifyContent: "flex-start" },
    cartao: {
      width: "100%",
      maxWidth: 720,
      maxHeight: "90%" as any,
      borderRadius: 18,
      backgroundColor: t.paperCardElev,
      borderWidth: 1,
      borderColor: t.ink5,
      overflow: "hidden",
    },
    cartaoCheio: { maxWidth: undefined, maxHeight: undefined, flex: 1, borderRadius: 0, borderWidth: 0 },
    cab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.ink5,
    },
    titulo: { fontSize: 16, fontWeight: "800", color: t.ink, letterSpacing: -0.2 },
    sub: { fontSize: 12.5, color: t.ink3, marginTop: 1 },
    fechar: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: t.ink5, backgroundColor: t.paperCard,
    },
  });
}

export default EscolherDaGaleriaModal;
