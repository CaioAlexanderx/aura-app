import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ExportButton } from "@/components/ExportButton";
import { CategorizeButton } from "@/components/CategorizeButton";

// Toolbar for Financeiro screen — combines export + categorize
type Props = {
  uncategorizedDescriptions?: string[];
  onCategorizeApply?: (results: any[]) => void;
  from?: string;
  to?: string;
};

export function FinanceiroToolbar({ uncategorizedDescriptions = [], onCategorizeApply, from, to }: Props) {
  return (
    <View style={s.toolbar}>
      <View style={s.exports}>
        <ExportButton type="dre" label="DRE" from={from} to={to} />
        <ExportButton type="sales" label="Vendas" from={from} to={to} />
      </View>
      {uncategorizedDescriptions.length > 0 && (
        <CategorizeButton descriptions={uncategorizedDescriptions} onApply={onCategorizeApply} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 16 },
  exports: { flexDirection: 'row', gap: 6 },
});

export default FinanceiroToolbar;
