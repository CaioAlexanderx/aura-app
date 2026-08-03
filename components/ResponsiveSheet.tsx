// ============================================================
// ResponsiveSheet — Aura · contêiner responsivo de modais
//
// Task "modais do crediário em telas pequenas" (03/08/2026):
// um conteúdo, dois contêineres —
//  · largura < 500px (celular): BOTTOM SHEET ancorado embaixo,
//    largura total, radius só no topo, alça de arrastar, slide-up.
//  · caso contrário (desktop/notebook): diálogo centralizado via
//    ModalPop, como hoje — mas com ALTURA TRAVADA numericamente
//    (useWindowDimensions), o que resolve tanto o hack de 90vh
//    (maxHeight "90%" morto no web sob pai sem altura) quanto os
//    notebooks 13/14" em 720p (~650px úteis).
//
// O conteúdo interno é responsabilidade do chamador e deve seguir o
// padrão: header fixo → ScrollView (flexShrink:1) → rodapé fixo com CTA.
// KeyboardAvoidingView incluso (iOS); no web o rodapé fixo + altura
// numérica evitam o teclado cobrindo campos.
// ============================================================
import React, { useEffect, useRef } from "react";
import {
  Animated, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, StyleProp, ViewStyle, useWindowDimensions,
} from "react-native";
import { Colors } from "@/constants/colors";
import { ModalPop } from "@/components/anim";
import { Motion } from "@/constants/motion";

/** Abaixo desta largura o modal vira bottom sheet. Mesmo corte da tela
 *  principal do crediário (isNarrow = width < 500). */
export const SHEET_NARROW_BP = 500;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Largura máxima do diálogo em telas largas (padrão 480; ficha usa 700). */
  maxWidth?: number;
  /** Fração da altura da janela que o sheet pode ocupar (padrão 0.92 no
   *  diálogo, 0.94 no bottom sheet). */
  children: React.ReactNode;
  /** Estilo extra aplicado ao cartão do sheet (raro). */
  sheetStyle?: StyleProp<ViewStyle>;
};

export function ResponsiveSheet({ visible, onClose, maxWidth = 480, children, sheetStyle }: Props) {
  const { width, height } = useWindowDimensions();
  const isNarrow = width < SHEET_NARROW_BP;

  // Altura máxima NUMÉRICA — funciona igual em web e nativo, sem depender
  // da cadeia de pais ter altura (causa raiz dos hacks "90vh"/"88vh").
  const maxH = Math.round(height * (isNarrow ? 0.94 : 0.92));

  // Slide-up do bottom sheet (o diálogo usa ModalPop scale+fade).
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible && isNarrow) {
      slide.setValue(0);
      Animated.timing(slide, { toValue: 1, duration: Motion.slow, useNativeDriver: false }).start();
    }
  }, [visible, isNarrow, slide]);
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [56, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[s.backdrop, isNarrow ? s.backdropNarrow : s.backdropWide]}
        onPress={onClose}
        accessibilityLabel="Fechar"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={isNarrow ? s.kavNarrow : [s.kavWide, { maxWidth }]}
          pointerEvents="box-none"
        >
          {isNarrow ? (
            <Animated.View style={{ opacity: slide, transform: [{ translateY }] }}>
              <Pressable
                style={[s.sheet, s.sheetNarrow, { maxHeight: maxH }, sheetStyle]}
                onPress={() => {}}
              >
                <Animated.View style={s.handle} />
                {children}
              </Pressable>
            </Animated.View>
          ) : (
            <ModalPop visible={visible} style={{ width: "100%" }}>
              <Pressable
                style={[s.sheet, s.sheetWide, { maxHeight: maxH }, sheetStyle]}
                onPress={() => {}}
              >
                {children}
              </Pressable>
            </ModalPop>
          )}
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  // Token único de backdrop (spec §2.1).
  backdrop: { flex: 1, backgroundColor: "rgba(3,5,14,0.72)" },
  backdropWide: { justifyContent: "center", alignItems: "center", padding: 16 },
  // Bottom sheet: sem padding lateral — cada px de largura importa em 360px.
  backdropNarrow: { justifyContent: "flex-end", padding: 0 },

  kavWide: { width: "100%" },
  kavNarrow: { width: "100%" },

  sheet: {
    backgroundColor: Colors.bg2,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    width: "100%",
  },
  sheetWide: { borderRadius: 20 },
  sheetNarrow: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomWidth: 0,
  },
  handle: {
    width: 40, height: 4, borderRadius: 99,
    backgroundColor: Colors.border2,
    alignSelf: "center", marginTop: 10, marginBottom: 2,
  },
});

export default ResponsiveSheet;
