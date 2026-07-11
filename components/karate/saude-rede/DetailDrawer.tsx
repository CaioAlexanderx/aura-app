// ============================================================
// Saúde da Rede — Drawer de detalhe genérico · Shoji
// Modal de fundo com busca + tabela dos registros por trás do
// indicador + exportação CSV. Papel opaco, sumi como CTA.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput, FlatList,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F,
} from "@/constants/karateTheme";

export interface DrawerCol { key: string; label: string; align?: "right" }
export interface DrawerRow { [key: string]: string | number | null | undefined }

export function DetailDrawer({
  open,
  onClose,
  title,
  sub,
  cols,
  rows,
  onExportCsv,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub: string;
  cols: DrawerCol[];
  rows: DrawerRow[];
  onExportCsv?: () => void;
}) {
  const [q, setQ] = useState("");
  useEffect(() => { if (!open) setQ(""); }, [open]);

  const filtered = q.trim()
    ? rows.filter((r) =>
        cols.some((c) =>
          String(r[c.key] ?? "").toLowerCase().includes(q.toLowerCase())
        )
      )
    : rows;

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={dst.drawerOverlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={dst.drawerSheet}>
          {/* Header */}
          <View style={dst.drawerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={dst.drawerEyebrow}>O que está por trás deste número</Text>
              <Text style={dst.drawerTitle}>{title}</Text>
              <Text style={dst.drawerSub}>{sub}</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar" style={dst.drawerClose}>
              <Icon name="close" size={18} color={C.ink} />
            </TouchableOpacity>
          </View>

          {/* Toolbar */}
          <View style={dst.drawerToolbar}>
            <View style={dst.searchBox}>
              <Icon name="search" size={14} color={C.ink4} style={{ marginRight: 6 }} />
              <TextInput
                style={dst.searchInput as any}
                placeholder="Filtrar registros…"
                placeholderTextColor={C.ink4}
                value={q}
                onChangeText={setQ}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            {onExportCsv && (
              <TouchableOpacity style={dst.btnExport} onPress={onExportCsv}>
                <Icon name="download-outline" size={14} color={P.paperWarm} />
                <Text style={dst.btnExportLabel}>Exportar CSV</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Table */}
          <ScrollView style={{ flex: 1 }} horizontal>
            <View style={{ minWidth: "100%" }}>
              {/* Head */}
              <View style={dst.tblHead}>
                {cols.map((c) => (
                  <Text key={c.key} style={[dst.tblTh, c.align === "right" && { textAlign: "right" }]}>
                    {c.label}
                  </Text>
                ))}
              </View>
              {/* Body */}
              {filtered.length === 0 ? (
                <Text style={dst.drawerEmpty}>Nenhum registro corresponde ao filtro.</Text>
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(_, i) => String(i)}
                  renderItem={({ item, index }) => (
                    <View style={[dst.tblRow, index % 2 === 1 && dst.tblRowAlt]}>
                      {cols.map((c) => (
                        <Text
                          key={c.key}
                          style={[dst.tblTd, c.align === "right" && { textAlign: "right" }]}
                        >
                          {String(item[c.key] ?? "")}
                        </Text>
                      ))}
                    </View>
                  )}
                />
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={dst.drawerFooter}>
            <Text style={dst.drawerCount}>{filtered.length} de {rows.length} registros</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dst = StyleSheet.create({
  drawerOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,38,32,0.32)" } as ViewStyle,
  drawerSheet:   { backgroundColor: P.glassHi, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%", paddingBottom: 24 } as ViewStyle,
  drawerHeader:  { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  drawerEyebrow: { fontFamily: F.body, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: C.ink3, marginBottom: 6 } as TextStyle,
  drawerTitle:   { fontFamily: F.heading, fontSize: 22, fontWeight: "400", color: C.ink } as TextStyle,
  drawerSub:     { fontFamily: F.body, fontSize: 12, color: C.ink3, marginTop: 4 } as TextStyle,
  drawerClose:   { padding: 6, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line, borderRadius: R.md } as ViewStyle,
  drawerToolbar: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  drawerEmpty:   { padding: 32, textAlign: "center", color: C.ink3, fontFamily: F.body, fontSize: 12 } as TextStyle,
  drawerFooter:  { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line } as ViewStyle,
  drawerCount:   { fontFamily: F.mono, fontSize: 11, color: C.ink3, fontVariant: ["tabular-nums"] as any } as TextStyle,

  // Drawer table
  tblHead:  { flexDirection: "row", backgroundColor: P.glass2, paddingVertical: 8, paddingHorizontal: 12 } as ViewStyle,
  tblTh:    { flex: 1, fontFamily: F.body, fontSize: 11, fontWeight: "700", color: C.ink3, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 4 } as TextStyle,
  tblRow:   { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  tblRowAlt: { backgroundColor: P.glass2 } as ViewStyle,
  tblTd:    { flex: 1, fontFamily: F.body, fontSize: 12, color: C.ink, paddingHorizontal: 4, flexWrap: "wrap" } as TextStyle,

  // Search
  searchBox:   { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: P.glass2, borderRadius: R.md, borderWidth: 1, borderColor: C.line2, paddingHorizontal: 10, paddingVertical: 6 } as ViewStyle,
  searchInput: { flex: 1, fontFamily: F.body, fontSize: 13, color: C.ink, outlineStyle: "none" } as any,

  // Export button (sumi/ink — CTA primário Shoji)
  btnExport:      { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 8, paddingHorizontal: 14 } as ViewStyle,
  btnExportLabel: { fontFamily: F.body, fontSize: 12, fontWeight: "500", color: P.paperWarm } as TextStyle,
});
