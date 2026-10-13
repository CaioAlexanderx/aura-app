// ============================================================================
// AURA. — Etiquetas: pré-visualização em escala real (13/10/2026)
//
// Mostra a primeira página do trabalho antes de gastar etiqueta: o MESMO HTML
// da impressão (buildLabelPreviewHtml) num iframe, com a largura em mm
// convertida em px pelo DPI do CSS (96 px por polegada) e réguas em mm.
// Só web — a impressão de etiqueta é web.
//
// WebPortal: a aba vive dentro do shell, e o z-index: 0 que o RNW dá a cada
// View prenderia o overlay embaixo do topbar.
// ============================================================================
import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { CSS_PX_PER_MM, LABEL_PREVIEW_RULER_MM } from "@/components/screens/estoque/labels/buildLabelHtml";

type Props = {
  html: string;
  /** Página mostrada, em mm (sem as réguas). */
  widthMm: number;
  heightMm: number;
  /** Etiquetas mostradas e total do trabalho. */
  labels: number;
  totalLabels: number;
  continuous: boolean;
  onPrint: () => void;
  onClose: () => void;
};

function mm(n: number): string { return String(Math.round(n * 100) / 100).replace(".", ","); }

export function LabelPreviewModal({ html, widthMm, heightMm, labels, totalLabels, continuous, onPrint, onClose }: Props) {
  if (Platform.OS !== "web" || typeof document === "undefined") return null;

  // mm -> px do CSS. +6mm de folga à direita/embaixo para a régua respirar.
  var framePxW = Math.ceil((widthMm + LABEL_PREVIEW_RULER_MM + 6) * CSS_PX_PER_MM);
  var framePxH = Math.ceil((heightMm + LABEL_PREVIEW_RULER_MM + 6) * CSS_PX_PER_MM);

  return (
    <WebPortal active>
      <div
        style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50000,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          padding: 16, boxSizing: "border-box", overflowY: "auto",
          background: "rgba(2,6,23,0.62)",
        } as any}
        onClick={function(e: any) { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ width: "100%", maxWidth: Math.max(480, framePxW + 34), margin: "auto" } as any}>
          <View style={s.card} testID="etiquetas-previa">
            <View style={s.header}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.title}>Pré-visualização em tamanho real</Text>
                <Text style={s.sub}>
                  Página de {mm(widthMm)} × {mm(heightMm)} mm{continuous ? " (modo contínuo: o trabalho inteiro numa página)" : ""} · {labels} de {totalLabels} etiqueta{totalLabels > 1 ? "s" : ""}
                </Text>
              </View>
              <Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Fechar pré-visualização">
                <Icon name="x" size={16} color={Colors.ink3} />
              </Pressable>
            </View>

            <div style={{ overflow: "auto", maxHeight: "60vh", borderRadius: 8, background: "#eef2f7", border: "1px solid rgba(0,0,0,0.08)" } as any}>
              {React.createElement("iframe", {
                title: "Pré-visualização das etiquetas",
                srcDoc: html,
                "data-testid": "etiquetas-previa-frame",
                style: { width: framePxW, height: framePxH, border: "none", display: "block" },
              })}
            </div>

            <Text style={s.hint}>
              A régua está em milímetros do CSS (96 px por polegada), a mesma medida que vai para a impressora. Com o zoom do navegador em 100%, encoste uma etiqueta na tela para conferir; se o monitor mostrar maior ou menor, a proporção continua a mesma. O contorno violeta é a página; o tracejado, cada etiqueta.
            </Text>

            <View style={s.actions}>
              <Pressable onPress={onClose} style={s.btnGhost} testID="etiquetas-previa-fechar">
                <Text style={s.btnGhostTxt}>Fechar</Text>
              </Pressable>
              <Pressable onPress={onPrint} style={s.btn} testID="etiquetas-previa-imprimir">
                <Icon name="file_text" size={14} color="#fff" />
                <Text style={s.btnTxt}>Imprimir</Text>
              </Pressable>
            </View>
          </View>
        </div>
      </div>
    </WebPortal>
  );
}

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border2, gap: 12 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 11.5, color: Colors.ink3, marginTop: 2 },
  close: { padding: 6, borderRadius: 8 },
  hint: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" },
  btnGhost: { backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  btnGhostTxt: { fontSize: 12.5, color: Colors.ink2, fontWeight: "600" },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  btnTxt: { fontSize: 12.5, color: "#fff", fontWeight: "700" },
});

export default LabelPreviewModal;
