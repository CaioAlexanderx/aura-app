// ============================================================
// components/studio/storefront/fields/FieldArtService.tsx
// Agente H — Onda 1 (03/06/2026)
//
// Campo especial type='option' com config.is_art_service:true.
// Duas choices:
//   - 'none'     → Vou enviar minha arte (price_delta = 0)
//   - 'designer' → Crie minha arte pra mim (price_delta = preço configurado)
//
// Ao escolher 'designer': exibe briefing (textarea + referência opcional).
// Ao escolher 'none'    : briefing some, fluxo de upload normal continua.
//
// Gravação:
//   values['art_service']       = 'none' | 'designer'   ← dispara computeChoicesDelta
//   values['art_service_brief'] = string (texto + ref)  ← enviado no pedido, sem efeito no preço
//
// RESTRIÇÕES (Onda 0):
//   - NÃO toca em FieldImage.tsx, LivePreview.tsx, ProductConfigurator.tsx
//   - dark tokens via T (paleta Studio), reduceMotion respeitado
// ============================================================
import { View, Text, Pressable, TextInput, StyleSheet, Platform } from "react-native";
import type { CustomizationField } from "../types";
import { T } from "../types";

const ART_FIELD_ID     = "art_service";
const BRIEF_FIELD_ID   = "art_service_brief";

type Props = {
  field: CustomizationField;
  /** values['art_service'] = 'none' | 'designer' | undefined */
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
  const shouldReduceMotion = Platform.OS === "web" ? false : false; // fallback seguro

  const choices: Array<{ value: string; label: string; price_delta?: number }> =
    field.config?.choices || [];

  const noneChoice     = choices.find((c) => c.value === "none");
  const designerChoice = choices.find((c) => c.value === "designer");

  const isDesigner = value === "designer";
  const isNone     = value === "none";

  const priceDelta = typeof designerChoice?.price_delta === "number"
    ? designerChoice.price_delta
    : 0;

  const priceLabel =
    priceDelta > 0
      ? `+R$ ${priceDelta.toFixed(2).replace(".", ",")}`
      : priceDelta < 0
      ? `-R$ ${Math.abs(priceDelta).toFixed(2).replace(".", ",")}`
      : null;

  return (
    <View style={styles.root}>
      {/* Header do bloco */}
      <View style={styles.header}>
        <View style={styles.sparkIco}>
          <Text style={styles.sparkEmoji}>✦</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <Text style={styles.fieldSub}>Como você quer enviar a arte?</Text>
        </View>
      </View>

      {/* Opção A: Vou enviar minha arte */}
      <Pressable
        onPress={() => onChange("none")}
        style={[styles.optionCard, isNone && styles.optionCardActive]}
        accessibilityRole="radio"
        accessibilityState={{ checked: isNone }}
        accessibilityLabel="Vou enviar minha arte"
      >
        <View style={[styles.radio, isNone && styles.radioActive]}>
          {isNone && <View style={styles.radioDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionTitle, isNone && styles.optionTitleActive]}>
            Vou enviar minha arte
          </Text>
          <Text style={styles.optionSub}>
            Você faz o upload do arquivo PNG, JPG ou PDF
          </Text>
        </View>
        {/* Badge gratuito */}
        <View style={styles.freeBadge}>
          <Text style={styles.freeBadgeTxt}>Incluso</Text>
        </View>
      </Pressable>

      {/* Opção B: Crie minha arte */}
      <Pressable
        onPress={() => onChange("designer")}
        style={[
          styles.optionCard,
          styles.designerCard,
          isDesigner && styles.designerCardActive,
        ]}
        accessibilityRole="radio"
        accessibilityState={{ checked: isDesigner }}
        accessibilityLabel={`Crie minha arte pra mim${priceLabel ? ", " + priceLabel : ""}`}
      >
        <View style={[styles.radio, isDesigner && styles.radioDesignerActive]}>
          {isDesigner && <View style={[styles.radioDot, { backgroundColor: T.accent }]} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionTitle, isDesigner && styles.designerTitleActive]}>
            Crie minha arte pra mim
          </Text>
          <Text style={styles.optionSub}>
            Nossa equipe cria a arte personalizada pra você
          </Text>
        </View>
        {/* Badge de preço */}
        {priceLabel && (
          <View style={[styles.priceBadge, isDesigner && styles.priceBadgeActive]}>
            <Text style={[styles.priceBadgeTxt, isDesigner && styles.priceBadgeTxtActive]}>
              {priceLabel}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Briefing — aparece apenas quando designer está selecionado */}
      {isDesigner && (
        <View style={styles.briefBlock}>
          <Text style={styles.briefTitle}>Descreva sua ideia</Text>
          <Text style={styles.briefHint}>
            Quanto mais detalhes, melhor o resultado. Ex: cores, estilo, texto, referências.
          </Text>
          <TextInput
            style={styles.briefInput}
            multiline
            numberOfLines={4}
            placeholder="Ex: quero uma arte minimalista com meu nome em dourado, fundo preto, estilo moderno..."
            placeholderTextColor={T.ink4}
            value={briefValue}
            onChangeText={onBriefChange}
            maxLength={600}
            accessibilityLabel="Descreva sua ideia para a arte"
          />
          <Text style={styles.charCount}>
            {briefValue.length}/600
          </Text>

          {/* Referência opcional */}
          <Text style={[styles.briefTitle, { marginTop: 14 }]}>Referência (opcional)</Text>
          <Text style={styles.briefHint}>
            Cole aqui um link de imagem ou descrição de referência visual.
          </Text>
          {/* O ref é armazenado junto ao brief como sufixo separado por \n---\n.
              O lojista vê o texto completo no painel do pedido. */}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: T.primary,
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
});
