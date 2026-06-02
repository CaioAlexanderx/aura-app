// ============================================================
// AURA STUDIO · PDV — editor de campo de personalização (Fase 6)
// Data-driven (customization_config.fields). TODOS os campos são
// OPCIONAIS — nada bloqueia o "adicionar ao carrinho" (diretriz UX:
// organizar a venda, não travar). Sem asterisco de obrigatório.
// ============================================================
import { View, Text, Pressable, TextInput, ScrollView, Platform } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import type { CustomizationField } from "@/services/studioApi";
import { Ic } from "./icons";

type Tpl = { id: string; name: string; image_url: string; thumb_url: string | null };

export function FieldEditor({
  t, field, value, templates, onChange,
}: {
  t: StudioPalette; field: CustomizationField; value: any; templates: Tpl[]; onChange: (v: any) => void;
}) {
  const label = (
    <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
      {field.label}
      <Text style={{ color: t.ink3, fontWeight: "500", textTransform: "none" }}>  · opcional</Text>
    </Text>
  );

  if (field.type === "text") {
    const max = field.config.max_chars || 40;
    return (
      <View style={{ gap: 0 }}>
        {label}
        <TextInput
          value={String(value || "")}
          onChangeText={(txt) => onChange(txt.slice(0, max))}
          placeholder="Digite o texto da arte…"
          placeholderTextColor={t.ink3}
          maxLength={max}
          style={{ backgroundColor: t.paperCardElev, color: t.ink, padding: 12, borderRadius: 10, fontSize: 14, borderWidth: 1, borderColor: t.ink5, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }}
        />
        <Text style={{ fontSize: 10, color: t.ink3, marginTop: 4, textAlign: "right" }}>{String(value || "").length}/{max}</Text>
      </View>
    );
  }

  if (field.type === "color") {
    const colors = field.config.colors || ["#FFFFFF", "#000000"];
    return (
      <View>{label}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {colors.map((c) => {
            const active = value === c;
            return (
              <Pressable key={c} onPress={() => onChange(active ? null : c)}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: active ? 3 : 1, borderColor: active ? t.accent : t.ink5, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }} />
            );
          })}
        </View>
      </View>
    );
  }

  if (field.type === "option") {
    const choices = field.config.choices || [];
    return (
      <View>{label}
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {choices.map((c) => {
            const active = value === c.value;
            return (
              <Pressable key={c.value} onPress={() => onChange(active ? null : c.value)}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? t.accentSoft : t.bgSoft, borderWidth: 1, borderColor: active ? t.accentInk : t.ink5, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? t.accentInk : t.ink2 }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (field.type === "template") {
    return (
      <View>{label}
        {templates.length === 0 ? (
          <Text style={{ fontSize: 12, color: t.ink3, fontStyle: "italic" }}>Nenhum template vinculado a esse produto.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {templates.map((tpl) => {
              const active = value === tpl.image_url;
              return (
                <Pressable key={tpl.id} onPress={() => onChange(active ? null : tpl.image_url)}
                  style={{ width: 78, height: 78, borderRadius: 10, borderWidth: active ? 3 : 1, borderColor: active ? t.accent : t.ink5, overflow: "hidden", backgroundColor: t.bgSoft, alignItems: "center", justifyContent: "center" }}>
                  {Platform.OS === "web" ? (
                    // @ts-ignore img nativo no web
                    <img src={tpl.thumb_url || tpl.image_url} alt={tpl.name} style={{ width: "100%", height: "100%", objectFit: "cover" } as any} />
                  ) : (
                    <Text style={{ fontSize: 10, color: t.ink3, padding: 6 }}>{tpl.name}</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  if (field.type === "image") {
    return (
      <View>{label}
        <TextInput
          value={String(value || "")}
          onChangeText={onChange}
          placeholder="Link da imagem (ou receber por WhatsApp depois)"
          placeholderTextColor={t.ink3}
          style={{ backgroundColor: t.paperCardElev, color: t.ink, padding: 12, borderRadius: 10, fontSize: 13, borderWidth: 1, borderColor: t.ink5, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }}
        />
      </View>
    );
  }

  return null;
}
