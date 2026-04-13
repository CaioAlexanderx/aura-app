import { View, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { ExportButton } from "@/components/ExportButton";
import { CategorizeButton } from "@/components/CategorizeButton";

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
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 16, zIndex: 999, overflow: 'visible' as any },
  exports: { flexDirection: 'row', gap: 6, zIndex: 999, overflow: 'visible' as any },
});

export default FinanceiroToolbar;
