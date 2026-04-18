import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { hexToName } from "@/utils/colorNames";

type Props = {
  availableSizes: string[];
  availableColors: string[];
  selectedSize: string;
  selectedColor: string;
  onChangeSize: (v: string) => void;
  onChangeColor: (v: string) => void;
};

export function LabelVariantSelector({ availableSizes, availableColors, selectedSize, selectedColor, onChangeSize, onChangeColor }: Props) {
  if (availableSizes.length === 0 && availableColors.length === 0) return null;

  return (
    <View style={s.container}>
      {availableSizes.length > 0 && (
        <View style={s.row}>
          <Text style={s.label}>Tamanho:</Text>
          <View style={s.chips}>
            {availableSizes.map(function(sz) {
              var active = selectedSize === sz;
              return (
                <Pressable key={sz} onPress={function() { onChangeSize(active ? "" : sz); }} style={[s.chip, active && s.chipActive]}>
                  <Text style={[s.chipText, active && s.chipTextActive]}>{sz}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {availableColors.length > 0 && (
        <View style={s.row}>
          <Text style={s.label}>Cor:</Text>
          <View style={s.chips}>
            {availableColors.map(function(hex) {
              var active = selectedColor === hex;
              return (
                <Pressable key={hex} onPress={function() { onChangeColor(active ? "" : hex); }} style={[s.chip, active && s.chipActive]}>
                  <View style={s.colorRow}>
                    <View style={[s.swatch, { backgroundColor: hex }]} />
                    <Text style={[s.chipText, active && s.chipTextActive]}>{hexToName(hex)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  container: { gap: 6, paddingHorizontal: 10, paddingBottom: 8, paddingLeft: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  label: { fontSize: 10, color: Colors.ink3, fontWeight: "600", width: 55 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  chipText: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "600" },
  colorRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
});

export default LabelVariantSelector;
