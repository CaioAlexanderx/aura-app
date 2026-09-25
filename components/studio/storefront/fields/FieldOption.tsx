// ============================================================
// components/studio/storefront/fields/FieldOption.tsx
// Campo type="option" — chips de escolha, suporte a price_delta.
//
// 25/09/2026 (Fase 1A): o chip escolhido era azul-marinho cravado com
// texto branco, qualquer que fosse a loja. Agora segue o kit — borda e
// texto na marca legível sobre o wash dela (estilosDaVitrine.ts) — e o
// leitor de tela sabe que é uma escolha única e qual está marcada.
// ============================================================
import { View, Pressable } from "react-native";
import type { CustomizationField } from "../types";
import { usePaletaDaVitrine } from "../TemaDaVitrine";
import { useEstilosDaVitrine } from "../estilosDaVitrine";

import { Texto, Numero } from "../TipografiaVitrine";
import { dinheiro } from "../moeda";
export function FieldOption({
  field, value, onChange,
}: {
  field: CustomizationField;
  value: any;
  onChange: (v: any) => void;
}) {
  const T = usePaletaDaVitrine();
  const E = useEstilosDaVitrine();
  const choices = field.config.choices || [];
  return (
    <View>
      <Texto style={E.rotulo}>
        {field.label} {field.required && <Texto style={{ color: T.red }}>*</Texto>}
      </Texto>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={field.label}
        style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 6 }}
      >
        {choices.map((c: any) => {
          const selected = value === c.value;
          const delta = typeof c.price_delta === "number" ? c.price_delta : 0;
          const precoTxt = delta !== 0 ? (delta > 0 ? "+" : "") + dinheiro(delta) : "";
          return (
            <Pressable
              key={c.value}
              onPress={() => onChange(c.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected }}
              accessibilityLabel={precoTxt ? `${c.label}, ${precoTxt}` : c.label}
              style={[E.chip, selected && E.chipAtivo, { alignItems: "center" }]}
            >
              <Texto style={[E.chipTexto, selected && E.chipTextoAtivo]}>{c.label}</Texto>
              {delta !== 0 && (
                <Numero
                  style={{
                    fontSize: 11, fontWeight: "600",
                    color: selected ? T.primaryTexto : T.ink3,
                    marginTop: 2,
                  }}
                >
                  {precoTxt}
                </Numero>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
