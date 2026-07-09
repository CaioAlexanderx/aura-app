// ExcluirComHistoricoModal — modal in-app quando o praticante tem histórico vinculado.
// Oferece Desativar (soft) | Excluir definitivamente (cascata) | Cancelar.
import React from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Modal, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";

interface Props {
  visible: boolean;
  counts: Record<string, number> | null;
  busy: "deactivate" | "delete" | null;
  onDesativar: () => void;
  onExcluir: () => void;
  onClose: () => void;
}

export function ExcluirComHistoricoModal({
  visible, counts, busy, onDesativar, onExcluir, onClose,
}: Props) {
  const labels: Record<string, string> = {
    graduations: "graduações", transfers: "transferências",
    cards: "carteirinhas", transactions: "lançamentos financeiros",
  };
  const parts = Object.entries(counts || {})
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${labels[k] || k}`);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={gradStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />
        <View style={gradStyles.card}>
          <View style={gradStyles.head}>
            <Text style={gradStyles.title}>Excluir praticante</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} disabled={!!busy}>
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, gap: 14 }}>
            <Text style={gradStyles.hint}>
              Este praticante possui histórico vinculado{parts.length ? ` (${parts.join(", ")})` : ""}.
              Escolha como proceder.
            </Text>

            {/* Primário: Desativar (soft) */}
            <TouchableOpacity
              onPress={onDesativar}
              disabled={!!busy}
              style={[delStyles.optPrimary, busy && { opacity: 0.6 }]}
              accessibilityRole="button"
            >
              <Icon name="lock" size={16} color="#fdf8f2" />
              <View style={{ flex: 1 }}>
                <Text style={delStyles.optPrimaryTitle}>Desativar praticante</Text>
                <Text style={delStyles.optPrimarySub}>Preserva o histórico. Pode reativar depois.</Text>
              </View>
              {busy === "deactivate" ? <ActivityIndicator color="#fdf8f2" size="small" /> : null}
            </TouchableOpacity>

            {/* Destrutivo: Excluir definitivamente (cascata) */}
            <TouchableOpacity
              onPress={onExcluir}
              disabled={!!busy}
              style={[delStyles.optDanger, busy && { opacity: 0.6 }]}
              accessibilityRole="button"
            >
              <Icon name="trash" size={16} color={KarateColors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={delStyles.optDangerTitle}>Excluir definitivamente</Text>
                <Text style={delStyles.optDangerSub}>Remove o praticante e todo o histórico. Não pode ser desfeito.</Text>
              </View>
              {busy === "delete" ? <ActivityIndicator color={KarateColors.primary} size="small" /> : null}
            </TouchableOpacity>
          </View>

          <View style={gradStyles.footer}>
            <TouchableOpacity onPress={onClose} style={gradStyles.btnGhost} disabled={!!busy}>
              <Text style={gradStyles.btnGhostTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const gradStyles = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card:      { width: "100%", maxWidth: 520, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.xl, overflow: "hidden", borderWidth: 1, borderColor: KarateColors.border2, maxHeight: "92%" } as ViewStyle,
  head:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  title:     { fontFamily: KarateFonts.heading, fontSize: 18, color: KarateColors.ink } as TextStyle,
  hint:      { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  footer:    { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  btnGhost:  { paddingVertical: 11, paddingHorizontal: 18, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
});

const delStyles = StyleSheet.create({
  optPrimary:      { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: KarateColors.ink, borderRadius: KarateRadius.md, padding: 14 } as ViewStyle,
  optPrimaryTitle: { fontSize: 14, fontWeight: "700", color: "#fdf8f2" } as TextStyle,
  optPrimarySub:   { fontSize: 12, color: "rgba(253,248,242,0.75)", marginTop: 2 } as TextStyle,
  optDanger:       { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine, borderRadius: KarateRadius.md, padding: 14 } as ViewStyle,
  optDangerTitle:  { fontSize: 14, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  optDangerSub:    { fontSize: 12, color: KarateColors.primary2, marginTop: 2 } as TextStyle,
});
