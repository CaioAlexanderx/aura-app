// ============================================================
// components/studio/storefront/fields/FieldText.tsx
// Campo type="text" — entrada de texto com contador de chars.
// ============================================================
import { View, Text, TextInput } from "react-native";
import type { CustomizationField } from "../types";
import { T, sectionLabel } from "../types";

export function FieldText({
  field, value, onChange,
}: {
  field: CustomizationField;
  value: any;
  onChange: (v: any) => void;
}) {
  const maxChars = field.config.max_chars || 30;
  return (
    <View>
      <Text style={sectionLabel}>
        {field.label} {field.required && <Text style={{ color: T.red }}>*</Text>}
      </Text>
      <TextInput
        value={String(value || "")}
        onChangeText={(t) => onChange(t.slice(0, maxChars))}
        placeholder={field.config.fonts?.[0] ? "Texto..." : "Digite aqui"}
        placeholderTextColor={T.ink4}
        maxLength={maxChars}
        style={{
          backgroundColor: T.card, color: T.ink, padding: 12,
          borderRadius: 8, fontSize: 14,
          borderWidth: 1, borderColor: T.border,
        }}
      />
      <Text style={{ fontSize: 10, color: T.ink3, marginTop: 4 }}>
        {String(value || "").length}/{maxChars}
      </Text>
    </View>
  );
}
