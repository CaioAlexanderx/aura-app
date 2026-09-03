// ============================================================
// components/studio/storefront/fields/FieldColor.tsx
// Campo type="color" — swatches de cor, suporte a price_delta.
// ============================================================
import { View, Pressable } from "react-native";
import type { CustomizationField } from "../types";
import { sectionLabel } from "../types";
import { usePaletaDaVitrine } from "../TemaDaVitrine";

import { Texto } from "../TipografiaVitrine";
export function FieldColor({
  field, value, onChange,
}: {
  field: CustomizationField;
  value: any;
  onChange: (v: any) => void;
}) {
  const T = usePaletaDaVitrine();
  const colors = field.config.colors || ["#FFFFFF", "#000000"];
  const choices = field.config.choices || [];
  return (
    <View>
      <Texto style={sectionLabel}>
        {field.label} {field.required && <Texto style={{ color: T.red }}>*</Texto>}
      </Texto>
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
                <Texto style={{ fontSize: 9, fontWeight: "700", color: selected ? T.accent : T.ink3 }}>
                  {delta > 0 ? "+" : ""}R$ {delta.toFixed(2)}
                </Texto>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
