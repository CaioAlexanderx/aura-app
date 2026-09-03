// ============================================================
// components/studio/storefront/fields/FieldText.tsx
// Campo type="text" — entrada de texto com contador de chars.
// ============================================================
import { View, TextInput, Pressable } from "react-native";
import type { CustomizationField } from "../types";
import { sectionLabel } from "../types";
import { usePaletaDaVitrine } from "../TemaDaVitrine";

import { Texto } from "../TipografiaVitrine";
export function FieldText({
  field, value, onChange, corValue, onCorChange,
}: {
  field: CustomizationField;
  value: any;
  onChange: (v: any) => void;
  /**
   * Cor da arte escolhida pelo cliente.
   *
   * A lojista configura uma paleta no campo e ate agora ela NUNCA era
   * vista: o preview usava sempre a primeira cor da lista. Numa polo
   * azul-marinho isso dava quase-preto sobre escuro — a arte sumia na
   * peca e o cliente nao tinha como corrigir.
   */
  corValue?: string;
  onCorChange?: (v: string) => void;
}) {
  const T = usePaletaDaVitrine();
  const maxChars = field.config.max_chars || 30;
  const paleta = (field.config.colors || []).filter(
    (c: any) => typeof c === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(c.trim()),
  );
  // Uma cor so nao e escolha: nao vale ocupar espaco com um chip unico.
  const podeEscolher = paleta.length > 1 && !!onCorChange;
  const corAtual = corValue || paleta[0];
  return (
    <View>
      <Texto style={sectionLabel}>
        {field.label} {field.required && <Texto style={{ color: T.red }}>*</Texto>}
      </Texto>
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
      <Texto style={{ fontSize: 10, color: T.ink3, marginTop: 4 }}>
        {String(value || "").length}/{maxChars}
      </Texto>

      {podeEscolher ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          <Texto style={{ fontSize: 10.5, color: T.ink3, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" }}>
            Cor da arte
          </Texto>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {paleta.map((c: string) => {
              const sel = c.toLowerCase() === String(corAtual || "").toLowerCase();
              return (
                <Pressable
                  key={c}
                  onPress={() => onCorChange!(c)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={`Cor da arte ${c}`}
                  style={{
                    width: 30, height: 30, borderRadius: 15,
                    backgroundColor: c,
                    borderWidth: sel ? 3 : 1,
                    // A borda marca a selecao sem depender da cor do chip:
                    // um chip branco selecionado precisa aparecer tanto
                    // quanto um preto.
                    borderColor: sel ? T.ink : T.border,
                  }}
                />
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}
