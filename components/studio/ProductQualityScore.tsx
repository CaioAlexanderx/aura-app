import React from "react";
import { Pressable, StyleSheet, Text, View, Platform } from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";

/**
 * ProductQualityScore
 * ----------------------------------------------------------------------------
 * Fase 9A Studio — componente de "completude" do produto (inspiração LinkedIn).
 *
 * Algoritmo `calculateProductScore` exportado pra ser reusado em outras
 * telas (Hub, lista de produtos, etc) sem montar o componente visual.
 *
 * 26/05/2026: trocado useTheme (path inexistente) por useStudioTokens canonico.
 * 26/05/2026: nova variant `badgeOnly` (bolinha 24x24 com a letra) pra uso em
 *   listas/cards onde o `compact` estica demais e quebra o layout.
 */

export type Product = {
  id?: string;
  name?: string;
  description?: string | null;
  price?: number;
  image_url?: string | null;
  is_personalizable?: boolean;
  customization_config?: {
    print_area?: { width_cm?: number; height_cm?: number } | null;
    fields?: any[];
  } | null;
  template_count?: number;
  extra_images_count?: number;
};

export type ScoreHint = {
  label: string;
  points: number;
  done: boolean;
};

export type ScoreResult = {
  score: number;
  letter: "A" | "B" | "C" | "D" | "F";
  hints: ScoreHint[];
};

// ---------------------------------------------------------------------------
// Algoritmo puro
// ---------------------------------------------------------------------------

export function calculateProductScore(p: Product): ScoreResult {
  const extraImages = Number(p?.extra_images_count ?? 0);
  const hasMainImage = Boolean(p?.image_url);
  const hasTwoPhotos = hasMainImage && extraImages >= 1;

  const cfg = p?.customization_config ?? null;
  const fields = Array.isArray(cfg?.fields) ? cfg!.fields : [];
  const hasCustomFields = fields.length > 0;

  const printArea = cfg?.print_area ?? null;
  const widthCm = Number(printArea?.width_cm ?? 0);
  const heightCm = Number(printArea?.height_cm ?? 0);
  const hasPrintArea = widthCm > 0 && heightCm > 0;

  const templateCount = Number(p?.template_count ?? 0);
  const hasTemplate = templateCount >= 1;

  const description = String(p?.description ?? "").trim();
  const hasLongDescription = description.length > 30;

  const hints: ScoreHint[] = [
    { label: "Adicionar pelo menos 2 fotos", points: 20, done: hasTwoPhotos },
    {
      label: "Configurar campos de personalização",
      points: 30,
      done: hasCustomFields,
    },
    {
      label: "Definir área de impressão (largura × altura)",
      points: 20,
      done: hasPrintArea,
    },
    {
      label: "Vincular pelo menos 1 template",
      points: 15,
      done: hasTemplate,
    },
    {
      label: "Descrição com mais de 30 caracteres",
      points: 15,
      done: hasLongDescription,
    },
  ];

  const score = hints.reduce((sum, h) => (h.done ? sum + h.points : sum), 0);

  let letter: ScoreResult["letter"];
  if (score >= 90) letter = "A";
  else if (score >= 75) letter = "B";
  else if (score >= 60) letter = "C";
  else if (score >= 40) letter = "D";
  else letter = "F";

  return { score, letter, hints };
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

type Props = {
  product: Product;
  compact?: boolean;
  badgeOnly?: boolean;
  onHintClick?: (hint: string) => void;
};

const isWeb = Platform.OS === "web";

export default function ProductQualityScore({
  product,
  compact = false,
  badgeOnly = false,
  onHintClick,
}: Props) {
  const theme = useStudioTokens();
  const result = React.useMemo(() => calculateProductScore(product), [product]);

  const letterColor = pickLetterColor(result.letter, theme);
  const letterSize = isWeb ? 32 : 28;

  // ---- Modo badgeOnly: só bolinha 24x24 com a letra ----
  // Usado em listas/cards onde o `compact` (200+ px) estica e quebra layout.
  if (badgeOnly) {
    return (
      <View style={[badgeStyles.bubble, { backgroundColor: letterColor.bg }]}>
        <Text style={[badgeStyles.bubbleTxt, { color: letterColor.fg }]}>
          {result.letter}
        </Text>
      </View>
    );
  }

  // ---- Modo compact: só letter + barra inline ----
  if (compact) {
    return (
      <View style={[styles.compactWrap, { borderColor: theme.ink5 }]}>
        <View
          style={[
            styles.circleCompact,
            { backgroundColor: letterColor.bg, borderColor: letterColor.bg },
          ]}
        >
          <Text
            style={[
              styles.letter,
              { color: letterColor.fg, fontSize: 20, lineHeight: 22 },
            ]}
          >
            {result.letter}
          </Text>
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.scoreRowCompact}>
            <Text style={[styles.scoreLabel, { color: theme.ink3 }]}>
              Qualidade do produto
            </Text>
            <Text style={[styles.scoreValue, { color: theme.ink }]}>
              {result.score}/100
            </Text>
          </View>
          <ProgressBar score={result.score} theme={theme} />
        </View>
      </View>
    );
  }

  // ---- Modo completo ----
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.paperCard,
          borderColor: theme.ink5,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.circle,
            { backgroundColor: letterColor.bg },
          ]}
        >
          <Text
            style={[
              styles.letter,
              { color: letterColor.fg, fontSize: letterSize, lineHeight: letterSize + 2 },
            ]}
          >
            {result.letter}
          </Text>
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[styles.title, { color: theme.ink }]}>
            Qualidade do produto
          </Text>
          <Text style={[styles.subtitle, { color: theme.ink3 }]}>
            {result.score}/100 — {describeLetter(result.letter)}
          </Text>
          <ProgressBar score={result.score} theme={theme} />
        </View>
      </View>

      <View style={styles.hintsList}>
        {result.hints.map((hint) => (
          <HintChip
            key={hint.label}
            hint={hint}
            theme={theme}
            onPress={onHintClick ? () => onHintClick(hint.label) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function ProgressBar({ score, theme }: { score: number; theme: any }) {
  const pct = Math.max(0, Math.min(100, score));
  // Gradient brand (navy → magenta) — RN não suporta linear-gradient nativo
  // direto em View; no web usamos backgroundImage; no nativo, cor sólida
  // accent (magenta) com bom contraste.
  const fillStyle: any = isWeb
    ? {
        backgroundImage: `linear-gradient(90deg, ${theme.primary ?? "#1E3A8A"} 0%, ${theme.accent ?? "#EC4899"} 100%)`,
      }
    : {
        backgroundColor: theme.accent ?? "#EC4899",
      };

  return (
    <View
      style={[
        styles.progressTrack,
        { backgroundColor: theme.ink5 },
      ]}
    >
      <View
        style={[
          styles.progressFill,
          { width: `${pct}%` as any },
          fillStyle,
        ]}
      />
    </View>
  );
}

function HintChip({
  hint,
  theme,
  onPress,
}: {
  hint: ScoreHint;
  theme: any;
  onPress?: () => void;
}) {
  const tint = hint.done
    ? { bg: theme.successSoft ?? "#D1FAE5", fg: theme.success ?? "#10B981" }
    : { bg: theme.ink5, fg: theme.ink3 };

  const icon = hint.done ? "✓" : "•";

  const inner = (
    <View
      style={[
        styles.chip,
        { backgroundColor: tint.bg, borderColor: tint.bg },
      ]}
    >
      <Text style={[styles.chipIcon, { color: tint.fg }]}>{icon}</Text>
      <Text
        style={[
          styles.chipLabel,
          {
            color: hint.done ? theme.ink3 : theme.ink,
            textDecorationLine: hint.done ? "line-through" : "none",
          },
        ]}
      >
        {hint.label}
      </Text>
      <Text style={[styles.chipPoints, { color: tint.fg }]}>+{hint.points}</Text>
    </View>
  );

  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {inner}
    </Pressable>
  );
}

// Re-export nomeado pra match do consumer `import { ProductQualityScore }`
export { ProductQualityScore };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickLetterColor(
  letter: ScoreResult["letter"],
  theme: any
): { bg: string; fg: string } {
  switch (letter) {
    case "A":
      return { bg: theme.success ?? "#10B981", fg: "#FFFFFF" };
    case "B":
      return { bg: theme.primary ?? "#1E3A8A", fg: "#FFFFFF" };
    case "C":
      return { bg: theme.warning ?? "#F59E0B", fg: "#FFFFFF" };
    case "D":
    case "F":
    default:
      return { bg: theme.danger ?? "#EF4444", fg: "#FFFFFF" };
  }
}

function describeLetter(letter: ScoreResult["letter"]): string {
  switch (letter) {
    case "A":
      return "Excelente, pronto pra vender";
    case "B":
      return "Bom, faltam poucos ajustes";
    case "C":
      return "Razoável, melhore os pontos abaixo";
    case "D":
      return "Incompleto, precisa de mais informações";
    case "F":
    default:
      return "Cadastro muito incompleto";
  }
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  circleCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    fontWeight: "900",
    textAlign: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  hintsList: {
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipIcon: {
    fontSize: 14,
    fontWeight: "900",
    width: 14,
    textAlign: "center",
  },
  chipLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  chipPoints: {
    fontSize: 12,
    fontWeight: "700",
  },
  compactWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  scoreRowCompact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: "700",
  },
});

const badgeStyles = StyleSheet.create({
  bubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  bubbleTxt: {
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 14,
  },
});
