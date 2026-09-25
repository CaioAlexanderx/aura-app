// ============================================================
// components/studio/storefront/fields/FieldColor.tsx
// Campo type="color" — swatches de cor, suporte a price_delta.
// ============================================================
import { View, Pressable } from "react-native";
import type { CustomizationField } from "../types";
import { useEstilosDaVitrine } from "../estilosDaVitrine";
import { usePaletaDaVitrine } from "../TemaDaVitrine";

import { Texto, Numero } from "../TipografiaVitrine";
import { dinheiro } from "../moeda";
export function FieldColor({
  field, value, onChange,
}: {
  field: CustomizationField;
  value: any;
  onChange: (v: any) => void;
}) {
  const T = usePaletaDaVitrine();
  const E = useEstilosDaVitrine();
  const colors = field.config.colors || ["#FFFFFF", "#000000"];
  const choices = field.config.choices || [];
  return (
    <View>
      <Texto style={E.rotulo}>
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
                // Sem nome, o leitor de tela anunciava oito "botão" iguais e
                // ninguém sabia qual estava marcado.
                accessibilityRole="radio"
                accessibilityLabel={`${field.label} ${c}`}
                accessibilityState={{ checked: selected, selected }}
                hitSlop={4}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: c,
                  borderWidth: selected ? 3 : 1,
                  // O anel do escolhido e a marca como TEXTO (legivel no
                  // papel): o preenchimento cru some numa loja clara.
                  borderColor: selected ? T.primaryTexto : T.border,
                }}
              />
              {typeof delta === "number" && delta !== 0 && (
                <Numero style={{ fontSize: 10, fontWeight: "600", color: selected ? T.primaryTexto : T.ink3 }}>
                  {delta > 0 ? "+" : ""}{dinheiro(delta)}
                </Numero>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
