// ============================================================
// components/studio/storefront/fields/FieldColor.tsx
// Campo type="color" — swatches de cor, suporte a price_delta.
// ============================================================
import { View, Text, Pressable } from "react-native";
import type { CustomizationField } from "../types";
import { T, sectionLabel } from "../types";

export function FieldColor({
  field, value, onChange,
}: {
  field: CustomizationField;
  value: any;
  onChange: (v: any) => void;
}) {
  const colors = field.config.colors || ["#FFFFFF", "#000000"];
  const choices = field.config.choices || [];
  return (
    <View>
      <Text style={sectionLabel}>
        {field.label} {field.required && <Text style={{ color: T.red }}>*</Text>}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {colors.map((c) => {
          const choice = choices.find((ch: any) => ch.value === c || ch.label === c);
          const delta = choice?.price_delta;
          const selected = value === c;
          return (
            <View key={c} style={{ alignItems: "center", gap: 2 }}>
              <Pressable
                onPress={() => onChange(c)}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: c,
                  borderWidth: selected ? 3 : 1,
                  borderColor: selected ? T.primary : T.border,
                }}
              />
              {typeof delta === "number" && delta !== 0 && (
                <Text style={{ fontSize: 9, fontWeight: "700", color: selected ? T.accent : T.ink3 }}>
                  {delta > 0 ? "+" : ""}R$ {delta.toFixed(2)}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
