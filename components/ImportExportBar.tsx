import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

type Props = {
  onExport: () => void;
  onImport: () => void;
  exportLabel?: string;
  importLabel?: string;
  itemCount?: number;
};

export function ImportExportBar({ onExport, onImport, exportLabel, importLabel, itemCount }: Props) {
  const isWeb = Platform.OS === "web";
  return (
    <View style={s.bar}>
      <Pressable onPress={onExport} style={[s.btn, s.exportBtn]}>
        <Icon name="trending_up" size={14} color={Colors.green} />
        <Text style={s.exportText}>{exportLabel || "Exportar CSV"}{itemCount != null ? ` (${itemCount})` : ""}</Text>
      </Pressable>
      <Pressable onPress={onImport} style={[s.btn, s.importBtn]}>
        <Icon name="trending_down" size={14} color={Colors.violet3} />
        <Text style={s.importText}>{importLabel || "Importar CSV"}</Text>
      </Pressable>
      {!isWeb && <Text style={s.hint}>Disponivel na versao web</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  exportBtn: { backgroundColor: Colors.greenD, borderColor: Colors.green + "33" },
  exportText: { fontSize: 12, color: Colors.green, fontWeight: "600" },
  importBtn: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  importText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  hint: { fontSize: 10, color: Colors.ink3, alignSelf: "center", fontStyle: "italic" },
});

export default ImportExportBar;
