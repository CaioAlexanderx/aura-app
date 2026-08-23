// ============================================================
// components/studio/storefront/fields/FieldOption.tsx
// Campo type="option" — chips de escolha, suporte a price_delta.
// ============================================================
import { View, Pressable } from "react-native";
import type { CustomizationField } from "../types";
import { T, sectionLabel, chip, chipActive, chipTxt, chipTxtActive } from "../types";

import { Texto } from "../TipografiaVitrine";
export function FieldOption({
  field, value, onChange,
}: {
  field: CustomizationField;
  value: any;
  onChange: (v: any) => void;
}) {
  const choices = field.config.choices || [];
  return (
    <View>
      <Texto style={sectionLabel}>
        {field.label} {field.required && <Texto style={{ color: T.red }}>*</Texto>}
      </Texto>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {choices.map((c: any) => {
          const selected = value === c.value;
          const delta = typeof c.price_delta === "number" ? c.price_delta : 0;
          return (
            <Pressable
              key={c.value}
              onPress={() => onChange(c.value)}
              style={[chip, selected && chipActive, { alignItems: "center" }]}
            >
              <Texto style={[chipTxt, selected && chipTxtActive]}>{c.label}</Texto>
              {delta !== 0 && (
                <Texto
                  style={{
                    fontSize: 9.5, fontWeight: "700",
                    color: selected ? "rgba(255,255,255,0.8)" : T.accent,
                    marginTop: 2,
                  }}
                >
                  {delta > 0 ? "+" : ""}R$ {delta.toFixed(2)}
                </Texto>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
