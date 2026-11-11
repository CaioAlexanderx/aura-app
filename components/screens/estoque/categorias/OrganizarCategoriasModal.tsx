// ============================================================================
// AURA. — Estoque · Organizar categorias (modal, 10/11/2026)
//
// Botão "Organizar categorias" do Estoque. Antes ele fazia
// router.push("/catalogo/organizar"): uma página fora do shell, com outro
// desenho, e o "Voltar" levava ao Painel (utils/voltarDoCatalogo.ts explica
// por quê). Agora é este painel, no mesmo shell de Transferências e Últimos
// reajustes, montado via WebPortal pelo Estoque. Fechar não navega: o
// Estoque continua montado embaixo, com filtro e rolagem como estavam.
//
// O conteúdo (árvore, criar, renomear, mover, excluir com destino, banner)
// é o mesmo da rota: components/screens/catalogo/OrganizarCategorias.tsx.
// ============================================================================
import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { OrganizarCategorias } from "@/components/screens/catalogo/OrganizarCategorias";

var IS_WEB = Platform.OS === "web";

type Props = {
  onFechar: () => void;
  /** Estado vazio: leva ao assistente de migração (/catalogo/migracao). */
  onAbrirMigracao: () => void;
};

export function OrganizarCategoriasModal({ onFechar, onAbrirMigracao }: Props) {
  var panelWeb = IS_WEB ? {
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE ? "0 24px 60px -10px rgba(0,0,0,0.7)" : "0 24px 60px -10px rgba(124,58,237,0.22)",
  } : null;

  return (
    <View style={s.overlay} testID="organizar-categorias-modal">
      <Pressable style={s.backdrop} onPress={onFechar} accessibilityLabel="Fechar" testID="organizar-categorias-fundo" />
      <View style={[s.panel, panelWeb ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]} accessibilityViewIsModal accessibilityLabel="Organizar categorias">
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIco}><Icon name="layers" size={16} color={Colors.violet3} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.headerTitle}>Organizar categorias</Text>
              <Text style={s.headerSub}>Crie, renomeie, mova e exclua categorias.</Text>
            </View>
          </View>
          <Pressable onPress={onFechar} style={s.closeBtn} testID="organizar-categorias-x" accessibilityRole="button" accessibilityLabel="Fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>
        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
          <OrganizarCategorias onAbrirMigracao={onAbrirMigracao} />
        </ScrollView>
        <View style={s.footer}>
          <Pressable style={s.btnPri} onPress={onFechar} testID="organizar-categorias-fechar" accessibilityRole="button">
            <Text style={s.btnPriTxt}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Mesmo shell de TransferenciasModal / UltimosReajustesModal.
var s = StyleSheet.create({
  overlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
  },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  panel: { width: "100%", maxWidth: 620, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  headerIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center",
  },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: 18, paddingBottom: 12 },
  footer: {
    paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)",
    backgroundColor: "rgba(0,0,0,0.18)", flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10,
  },
  btnPri: { backgroundColor: Colors.violet, minHeight: 44, paddingHorizontal: 18, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
});

export default OrganizarCategoriasModal;
