// ============================================================
// components/studio/storefront/fields/FieldTemplate.tsx
// Campo type="template" — galeria horizontal de templates.
// ============================================================
import { View, Pressable, ScrollView, Platform } from "react-native";
import type { CustomizationField, StudioStoreProduct } from "../types";
import { sectionLabel } from "../types";
import { usePaletaDaVitrine } from "../TemaDaVitrine";

import { Texto } from "../TipografiaVitrine";
export function FieldTemplate({
  field, value, templates, onChange,
}: {
  field: CustomizationField;
  value: any;
  templates: StudioStoreProduct["templates"];
  onChange: (v: any) => void;
}) {
  const T = usePaletaDaVitrine();
  return (
    <View>
      <Texto style={sectionLabel}>
        {field.label} {field.required && <Texto style={{ color: T.red }}>*</Texto>}
      </Texto>
      {templates.length === 0 ? (
        <Texto style={{ fontSize: 12, color: T.ink3, fontStyle: "italic" }}>
          Loja não cadastrou templates ainda.
        </Texto>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {templates.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onChange(t.image_url)}
              style={{
                width: 80, height: 80, borderRadius: 8,
                borderWidth: value === t.image_url ? 3 : 1,
                borderColor: value === t.image_url ? T.primary : T.border,
                overflow: "hidden",
                backgroundColor: T.bg,
              }}
            >
              {Platform.OS === "web" ? (
                // @ts-ignore - native img on web
                <img
                  src={t.thumb_url || t.image_url}
                  alt={t.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" } as any}
                />
              ) : (
                <Texto style={{ fontSize: 10, color: T.ink3, padding: 6 }}>{t.name}</Texto>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
