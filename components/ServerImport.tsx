import { Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useServerImport, type ServerImportEntity, type ServerImportResult } from "@/hooks/useServerImport";

type Props = {
  entity: ServerImportEntity;
  onComplete?: (result: ServerImportResult) => void;
};

const LABELS: Record<ServerImportEntity, string> = {
  products: "Escolher planilha (Excel ou CSV)",
  customers: "Importar clientes (planilha)",
  transactions: "Importar lançamentos (planilha)",
};

// A lógica de leitura (csv/tsv/txt e agora xlsx/xls) e o POST pro
// backend vivem em useServerImport — reaproveitado também pelo botão
// "Importar planilha" da barra de ações do Estoque (não só no estado
// vazio), ver app/(tabs)/estoque.tsx.
export function ServerImport({ entity, onComplete }: Props) {
  const { loading, handleImport } = useServerImport(entity, onComplete);

  return (
    <Pressable onPress={handleImport} disabled={loading} style={[s.btn, loading && { opacity: 0.6 }]}>
      {loading ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Icon name="file_text" size={14} color={Colors.violet3} />}
      <Text style={s.text}>{loading ? "Importando..." : LABELS[entity] || "Importar"}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  text: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});

export default ServerImport;
