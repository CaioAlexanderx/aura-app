// ============================================================
// StudioEmpty — empty state canonico do Aura Studio.
//
// Fase 0 UX overhaul (25/05/2026).
// Padroniza empty states pelo app. Aceita até 2 CTAs (primário + secundário)
// — alinhado com a "celebração com 2 botões balanceados" da home Studio.
//
// Uso:
//   <StudioEmpty
//     icon="shopping-bag"
//     title="Catálogo vazio"
//     desc="Cadastre seu primeiro produto pra começar."
//     primaryCta={{ label: "Cadastrar produto", onPress: () => ... }}
//     secondaryCta={{ label: "Ver galeria", onPress: () => ... }}
//   />
//
// Variants visuais:
//   tone="default"     — neutro (cinza)
//   tone="celebration" — celebratório (mint soft + emoji)
//   tone="warning"     — alerta (warning soft)
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";

type CTA = { label: string; onPress: () => void };
type Tone = "default" | "celebration" | "warning";

const TONES: Record<Tone, { bg: string; iconBg: string; iconColor: string; border: string }> = {
  default: {
    bg: StudioColors.paperCard,
    iconBg: StudioColors.bgSoft,
    iconColor: StudioColors.ink3,
    border: StudioColors.ink5,
  },
  celebration: {
    bg: StudioColors.successSoft,
    iconBg: "#fff",
    iconColor: StudioColors.success,
    border: StudioColors.success,
  },
  warning: {
    bg: StudioColors.warningSoft,
    iconBg: "#fff",
    iconColor: StudioColors.warning,
    border: StudioColors.warning,
  },
};

export function StudioEmpty({
  icon = "info",
  emoji,
  title,
  desc,
  primaryCta,
  secondaryCta,
  tone = "default",
  compact = false,
}: {
  icon?: string;
  emoji?: string;
  title: string;
  desc?: string;
  primaryCta?: CTA;
  secondaryCta?: CTA;
  tone?: Tone;
  compact?: boolean;
}) {
  const t = TONES[tone];

  return (
    <View style={[
      s.wrap,
      { backgroundColor: t.bg, borderColor: t.border },
      compact && s.wrapCompact,
    ]}>
      {emoji ? (
        <Text style={s.emoji}>{emoji}</Text>
      ) : (
        <View style={[s.iconBubble, { backgroundColor: t.iconBg }]}>
          <Icon name={icon as any} size={26} color={t.iconColor} />
        </View>
      )}
      <Text style={s.title}>{title}</Text>
      {desc && <Text style={s.desc}>{desc}</Text>}
      {(primaryCta || secondaryCta) && (
        <View style={s.ctas}>
          {primaryCta && (
            <Pressable onPress={primaryCta.onPress} style={s.btnPri}>
              <Text style={s.btnPriTxt}>{primaryCta.label}</Text>
            </Pressable>
          )}
          {secondaryCta && (
            <Pressable onPress={secondaryCta.onPress} style={s.btnSec}>
              <Text style={s.btnSecTxt}>{secondaryCta.label}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  wrapCompact: {
    paddingVertical: 24,
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emoji: {
    fontSize: 38,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: StudioColors.ink,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  desc: {
    fontSize: 13,
    color: StudioColors.ink3,
    textAlign: "center",
    maxWidth: 380,
    lineHeight: 18,
    marginTop: -2,
  },
  ctas: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  btnPri: {
    backgroundColor: StudioColors.primary,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  btnPriTxt: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  btnSec: {
    backgroundColor: "#fff",
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: StudioColors.ink5,
  },
  btnSecTxt: {
    color: StudioColors.ink2,
    fontSize: 13,
    fontWeight: "700",
  },
});

export default StudioEmpty;
