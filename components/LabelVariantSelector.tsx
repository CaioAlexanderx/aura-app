import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { hexToName } from "@/utils/colorNames";

var SIZES = ["PP", "P", "M", "G", "GG", "XG", "U", "34", "36", "38", "40", "42", "44", "46", "48"];

var COMMON_COLORS = [
  "#000000", "#FFFFFF", "#FF0000", "#0000FF", "#00FF00", "#FFFF00",
  "#FFA500", "#FFC0CB", "#800080", "#A52A2A", "#800000", "#808080",
  "#000080", "#C0C0C0", "#FFD700", "#F5F5DC", "#964B00", "#FF69B4",
  "#556B2F", "#40E0D0",
];

type Props = {
  currentSize?: string;
  currentColor?: string;
  overrideSize: string;
  overrideColor: string;
  onChangeSize: (v: string) => void;
  onChangeColor: (v: string) => void;
};

export function LabelVariantSelector({ currentSize, currentColor, overrideSize, overrideColor, onChangeSize, onChangeColor }: Props) {
  var activeSize = overrideSize || currentSize || "";
  var activeColor = overrideColor || currentColor || "";

  return (
    <View style={s.container}>
      <View style={s.row}>
        <Text style={s.label}>Tamanho:</Text>
        <View style={s.chips}>
          <Pressable onPress={function() { onChangeSize(""); }} style={[s.chip, !overrideSize && s.chipActive]}>
            <Text style={[s.chipText, !overrideSize && s.chipTextActive]}>{currentSize || "—"}</Text>
          </Pressable>
          {SIZES.filter(function(sz) { return sz !== currentSize; }).slice(0, 8).map(function(sz) {
            return (
              <Pressable key={sz} onPress={function() { onChangeSize(sz); }} style={[s.chip, overrideSize === sz && s.chipActive]}>
                <Text style={[s.chipText, overrideSize === sz && s.chipTextActive]}>{sz}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={s.row}>
        <Text style={s.label}>Cor:</Text>
        <View style={s.chips}>
          <Pressable onPress={function() { onChangeColor(""); }} style={[s.chip, !overrideColor && s.chipActive]}>
            {currentColor ? (
              <View style={s.colorRow}>
                <View style={[s.swatch, { backgroundColor: currentColor }]} />
                <Text style={[s.chipText, !overrideColor && s.chipTextActive]}>{hexToName(currentColor)}</Text>
              </View>
            ) : (
              <Text style={[s.chipText, !overrideColor && s.chipTextActive]}>{"\u2014"}</Text>
            )}
          </Pressable>
          {COMMON_COLORS.filter(function(c) { return c !== (currentColor || "").toUpperCase(); }).slice(0, 8).map(function(c) {
            return (
              <Pressable key={c} onPress={function() { onChangeColor(c); }} style={[s.chip, overrideColor === c && s.chipActive]}>
                <View style={s.colorRow}>
                  <View style={[s.swatch, { backgroundColor: c }]} />
                  <Text style={[s.chipText, overrideColor === c && s.chipTextActive]}>{hexToName(c)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
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
