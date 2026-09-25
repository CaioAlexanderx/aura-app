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
//
// 25/09/2026 (Fase 1A): os cartões seguem o "Depois" da Tela 1 do mockup
// studio-vitrine-01-alicerce.html. O cartão do designer era SEMPRE
// magenta (#EC4899 cravado, a cor do Aura Studio) e o escolhido
// azul-marinho — numa loja amarela, os dois brigavam com a marca. Agora
// escolhido = borda e texto na marca legível sobre o wash dela, e o
// preço escolhido vira o par cheio (marcaFill + sobreMarca). Sem
// destaque especial para o designer: quem destaca é a escolha.
// ============================================================
import { View, Pressable, TextInput, StyleSheet } from "react-native";
import type { CustomizationField } from "../types";
import { useMemo } from "react";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { wash, type VitrineTema } from "../theme";
import { Texto, Numero } from "../TipografiaVitrine";
import { Icon } from "@/components/Icon";
import {
  priceLabel, choiceHint, briefingFor,
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
  const tema = useTemaDaVitrine();
  const styles = useMemo(() => folha(tema), [tema]);

  const choices: Array<{ value: string; label: string; price_delta?: number }> =
    field.config?.choices || [];

  const brief = briefingFor(value);

  return (
    <View style={styles.root}>
      {/* Header do bloco */}
      <View style={styles.header}>
        <View style={styles.sparkIco}>
          <Icon name="sparkles" size={16} color={tema.marcaTexto} />
        </View>
        <View style={{ flex: 1 }}>
          <Texto style={styles.fieldLabel}>{field.label}</Texto>
          <Texto style={styles.fieldSub}>Como você quer resolver a arte?</Texto>
        </View>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel={field.label} style={{ gap: 10 }}>
      {choices.map((c) => {
        const sel = value === c.value;
        const pago = typeof c.price_delta === "number" && c.price_delta > 0;
        const etiqueta = priceLabel(c.price_delta);
        return (
          <Pressable
            key={c.value}
            onPress={() => onChange(c.value)}
            style={[styles.optionCard, sel && styles.optionCardActive]}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            accessibilityLabel={c.label + (etiqueta ? ", " + etiqueta : ", incluso")}
          >
            <View style={[styles.radio, sel && styles.radioActive]}>
              {sel && <View style={styles.radioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Texto style={[styles.optionTitle, sel && styles.optionTitleActive]}>
                {c.label}
              </Texto>
              <Texto style={styles.optionSub}>{choiceHint(c.value)}</Texto>
            </View>
            {pago && etiqueta ? (
              <View style={[styles.priceBadge, sel && styles.priceBadgeActive]}>
                <Numero style={[styles.priceBadgeTxt, sel && styles.priceBadgeTxtActive]}>{etiqueta}</Numero>
              </View>
            ) : (
              <View style={styles.freeBadge}>
                <Texto style={styles.freeBadgeTxt}>Incluso</Texto>
              </View>
            )}
          </Pressable>
        );
      })}
      </View>

      {/* Briefing — nos dois caminhos pagos, com pedidos diferentes.
          No ajuste ele é OPCIONAL: sem texto, a lojista ajusta tamanho e
          cores, que é o padrão do serviço. */}
      {brief && (
        <View style={styles.briefBlock}>
          <Numero style={styles.briefTitle}>{brief.title}</Numero>
          <Texto style={styles.briefHint}>{brief.hint}</Texto>
          <TextInput
            style={styles.briefInput}
            multiline
            numberOfLines={4}
            placeholder={brief.placeholder}
            placeholderTextColor={tema.ink4}
            value={briefValue}
            onChangeText={onBriefChange}
            maxLength={600}
            accessibilityLabel={brief.title}
          />
          <Numero style={styles.charCount}>{briefValue.length}/600</Numero>
        </View>
      )}
    </View>
  );
}

// A folha inteira depende da cor da loja, entao ela vira funcao do tema.
// Memoizada dentro do componente: StyleSheet.create a cada render
// descartaria o cache de estilo do react-native-web.
const folha = (tema: VitrineTema) => StyleSheet.create({
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
    backgroundColor: tema.marcaWash,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: tema.ink,
    letterSpacing: -0.1,
  },
  fieldSub: {
    fontSize: 11.5,
    color: tema.ink3,
    marginTop: 1,
  },

  // Cartões de opção — .new-art-card do mockup
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: tema.border,
    borderRadius: 14,
    padding: 13,
    minHeight: 44,
    backgroundColor: tema.bg2,
  },
  optionCardActive: {
    borderColor: tema.marcaTexto,
    backgroundColor: tema.marcaWash,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: tema.ink,
  },
  optionTitleActive: {
    color: tema.marcaTexto,
  },
  optionSub: {
    fontSize: 12,
    color: tema.ink3,
    marginTop: 2,
  },

  // Radio button
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: tema.ink4,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioActive: {
    borderColor: tema.marcaTexto,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: tema.marcaTexto,
  },

  // Badges
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: wash(tema.green, 0.12),
  },
  freeBadgeTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.green,
  },
  priceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: tema.marcaWash,
    borderWidth: 1,
    borderColor: tema.borderAccent,
  },
  priceBadgeActive: {
    backgroundColor: tema.marcaFill,
    borderColor: tema.marcaFill,
  },
  priceBadgeTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.marcaTexto,
  },
  priceBadgeTxtActive: {
    color: tema.sobreMarca,
  },

  // Briefing
  briefBlock: {
    marginTop: 4,
    padding: 14,
    borderRadius: 12,
    backgroundColor: tema.bg3,
    borderWidth: 1,
    borderColor: tema.border,
    gap: 4,
  },
  briefTitle: {
    fontSize: 10.5,
    fontWeight: "600",
    color: tema.ink2,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  briefHint: {
    fontSize: 12,
    color: tema.ink3,
    marginBottom: 6,
    lineHeight: 17,
  },
  briefInput: {
    backgroundColor: tema.bg2,
    borderWidth: 1.5,
    borderColor: tema.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: tema.ink,
    minHeight: 88,
    textAlignVertical: "top",
    lineHeight: 20,
  },
  charCount: {
    fontSize: 10.5,
    color: tema.ink3,
    textAlign: "right",
    marginTop: 3,
  },
});
