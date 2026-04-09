import { View, StyleSheet } from "react-native";
import { ExportButton } from "@/components/ExportButton";
import { ServerImport } from "@/components/ServerImport";

// Toolbar for Folha screen — export payroll reports
type Props = {
  period?: string; // YYYY-MM
  onImportComplete?: () => void;
};

export function FolhaToolbar({ period }: Props) {
  return (
    <View style={s.toolbar}>
      <ExportButton type="payroll" label="Exportar folha" period={period} />
    </View>
  );
}

const s = StyleSheet.create({
  toolbar: { flexDirection: 'row', gap: 6, marginBottom: 12 },
});

export default FolhaToolbar;
