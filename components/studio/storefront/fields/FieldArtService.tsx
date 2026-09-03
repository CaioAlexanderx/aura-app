// ============================================================
// components/studio/storefront/fields/FieldArtService.tsx
// Agente H — Onda 1 (03/06/2026)
//
// Campo especial type='option' com config.is_art_service:true.
//
// S4 (19/08/2026) — TRES caminhos, nao dois. O do meio era o que faltava
// e e o mais frequente: o cliente manda a arte e ela precisa ser ajustada
// para caber no produto e para as cores de impressao. Isso acontece na
// maioria dos pedidos e a lojista absorvia o custo em silencio.
//   - 'none'     → arte pronta (price_delta = 0)
//   - 'adjust'   → cliente envia e a lojista ajusta (price_delta)
//   - 'designer' → a lojista cria do zero (price_delta maior)
//
// As opcoes sao renderizadas A PARTIR DO CONFIG, nao mais fixas no
// componente: assim uma choice nova nao exige mexer aqui de novo, e uma
// loja com o config antigo (so none/designer) segue funcionando.
//
// Briefing aparece nos dois caminhos pagos, com pedidos diferentes —
// "descreva sua ideia" para criacao, "o que ajustar?" para ajuste.
//
// Gravação:
//   values['art_service']       = 'none' | 'designer'   ← dispara computeChoicesDelta
//   values['art_service_brief'] = string (texto + ref)  ← enviado no pedido, sem efeito no preço
//
// RESTRIÇÕES (Onda 0):
//   - NÃO toca em FieldImage.tsx, LivePreview.tsx, ProductConfigurator.tsx
//   - dark tokens via T (paleta Studio), reduceMotion respeitado
// ============================================================
import { View, Pressable, TextInput, StyleSheet, Platform } from "react-native";
import type { CustomizationField } from "../types";
import { useMemo } from "react";
import { usePaletaDaVitrine } from "../TemaDaVitrine";
import type { PaletaDaVitrine } from "../theme";
import { Texto } from "../TipografiaVitrine";
import {
  ART_DESIGNER, priceLabel, choiceHint, briefingFor,
} from "@/components/studio/artService";

const ART_FIELD_ID     = "art_service";
const BRIEF_FIELD_ID   = "art_service_brief";

type Props = {
  field: CustomizationField;
  /** values['art_service'] = 'none' | 'adjust' | 'designer' | undefined */
  value: string | undefined;
  /** Valor do briefing (controlado externamente via setFieldValue) */
  briefValue?: string;
  onChange: (v: string) => void;
  onBriefChange?: (v: string) => void;
};

export function FieldArtService({
  field,
  value,
  briefValue = "",
  onChange,
  onBriefChange,
}: Props) {
  const T = usePaletaDaVitrine();
  const styles = useMemo(() => folha(T), [T]);
  const shouldReduceMotion = Platform.OS === "web" ? false : false; // fallback seguro

  const choices: Array<{ value: string; label: string; price_delta?: number }> =
    field.config?.choices || [];

  const brief = briefingFor(value);

  return (
    <View style={styles.root}>
      {/* Header do bloco */}
      <View style={styles.header}>
        <View style={styles.sparkIco}>
          <Texto style={styles.sparkEmoji}>✦</Texto>
        </View>
        <View style={{ flex: 1 }}>
          <Texto style={styles.fieldLabel}>{field.label}</Texto>
          <Texto style={styles.fieldSub}>Como você quer resolver a arte?</Texto>
        </View>
      </View>

      {choices.map((c) => {
        const sel = value === c.value;
        const pago = typeof c.price_delta === "number" && c.price_delta > 0;
        const etiqueta = priceLabel(c.price_delta);
        const destaque = c.value === ART_DESIGNER;
        return (
          <Pressable
            key={c.value}
            onPress={() => onChange(c.value)}
            style={[
              styles.optionCard,
              destaque && styles.designerCard,
              sel && (destaque ? styles.designerCardActive : styles.optionCardActive),
            ]}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            accessibilityLabel={c.label + (etiqueta ? ", " + etiqueta : ", incluso")}
          >
            <View style={[styles.radio, sel && (destaque ? styles.radioDesignerActive : styles.radioActive)]}>
              {sel && <View style={[styles.radioDot, destaque && { backgroundColor: T.accent }]} />}
            </View>
            <View style={{ flex: 1 }}>
              <Texto
                style={[
                  styles.optionTitle,
                  sel && (destaque ? styles.designerTitleActive : styles.optionTitleActive),
                ]}
              >
                {c.label}
              </Texto>
              <Texto style={styles.optionSub}>{choiceHint(c.value)}</Texto>
            </View>
            {pago && etiqueta ? (
              <View style={[styles.priceBadge, sel && styles.priceBadgeActive]}>
                <Texto style={[styles.priceBadgeTxt, sel && styles.priceBadgeTxtActive]}>{etiqueta}</Texto>
              </View>
            ) : (
              <View style={styles.freeBadge}>
                <Texto style={styles.freeBadgeTxt}>Incluso</Texto>
              </View>
            )}
          </Pressable>
        );
      })}

      {/* Briefing — nos dois caminhos pagos, com pedidos diferentes.
          No ajuste ele é OPCIONAL: sem texto, a lojista ajusta tamanho e
          cores, que é o padrão do serviço. */}
      {brief && (
        <View style={styles.briefBlock}>
          <Texto style={styles.briefTitle}>{brief.title}</Texto>
          <Texto style={styles.briefHint}>{brief.hint}</Texto>
          <TextInput
            style={styles.briefInput}
            multiline
            numberOfLines={4}
            placeholder={brief.placeholder}
            placeholderTextColor={T.ink4}
            value={briefValue}
            onChangeText={onBriefChange}
            maxLength={600}
            accessibilityLabel={brief.title}
          />
          <Texto style={styles.charCount}>{briefValue.length}/600</Texto>
        </View>
      )}
    </View>
  );
}

// A folha inteira depende da cor da loja, entao ela vira funcao do tema.
// Memoizada dentro do componente: StyleSheet.create a cada render
// descartaria o cache de estilo do react-native-web.
const folha = (T: PaletaDaVitrine) => StyleSheet.create({
  root: {
    gap: 8,
    marginTop: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  sparkIco: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(236,72,153,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  sparkEmoji: {
    fontSize: 16,
    color: T.accent,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: T.ink,
    letterSpacing: -0.1,
  },
  fieldSub: {
    fontSize: 11,
    color: T.ink3,
    marginTop: 1,
  },

  // Cards de opção
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#fff",
  },
  optionCardActive: {
    borderColor: T.primary,
    backgroundColor: "rgba(30,58,138,0.04)",
  },
  designerCard: {
    // leve destaque visual pra estimular a escolha premium
    borderStyle: "dashed",
  },
  designerCardActive: {
    borderColor: T.accent,
    borderStyle: "solid",
    backgroundColor: "rgba(236,72,153,0.04)",
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: T.ink2,
  },
  optionTitleActive: {
    color: T.primaryTexto,
  },
  designerTitleActive: {
    color: T.accent,
  },
  optionSub: {
    fontSize: 11.5,
    color: T.ink3,
    marginTop: 2,
  },

  // Radio button
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioActive: {
    borderColor: T.primary,
  },
  radioDesignerActive: {
    borderColor: T.accent,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: T.primary,
  },

  // Badges
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.12)",
  },
  freeBadgeTxt: {
    fontSize: 10.5,
    fontWeight: "700",
    color: T.green,
  },
  priceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(236,72,153,0.10)",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.25)",
  },
  priceBadgeActive: {
    backgroundColor: T.accent,
    borderColor: T.accent,
  },
  priceBadgeTxt: {
    fontSize: 11,
    fontWeight: "800",
    color: T.accent,
    letterSpacing: 0.2,
  },
  priceBadgeTxtActive: {
    color: "#fff",
  },

  // Briefing
  briefBlock: {
    marginTop: 4,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(236,72,153,0.04)",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.15)",
    gap: 4,
  },
  briefTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: T.ink,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  briefHint: {
    fontSize: 11.5,
    color: T.ink3,
    marginBottom: 6,
    lineHeight: 17,
  },
  briefInput: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "rgba(236,72,153,0.25)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: T.ink,
    minHeight: 88,
    textAlignVertical: "top",
    lineHeight: 20,
  },
  charCount: {
    fontSize: 10.5,
    color: T.ink4,
    textAlign: "right",
    marginTop: 3,
  },
})
