// ============================================================
// CampaignWizard · Passo 1 — Escopo
//
// Dojôs / Praticantes / Ambos, cada opção com a contagem REAL de elegíveis
// (vinda do preview scope='both' buscado uma única vez na abertura do
// wizard — ver countForScope em ./types). Números pequenos são o
// ESPERADO aqui (só faixa-preta ATIVA sem cobrança na temporada, só dojô
// ATIVO sem cobrança na temporada) — não é bug; por isso cada card mostra
// o número com destaque, pra o gestor perceber se algo estiver muito fora
// do normal (ex.: milhares de praticantes = sinal de bug real).
// ============================================================
import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import type { AnnuityCampaignPreviewResponse, AnnuityCampaignScope } from "@/services/karateApi";
import { amountSum, countForScope, fmtMoney } from "./types";

type Props = {
  year: string;
  scope: AnnuityCampaignScope | null;
  onChangeScope: (s: AnnuityCampaignScope) => void;
  preview: AnnuityCampaignPreviewResponse | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
};

const OPTIONS: { key: AnnuityCampaignScope; label: string; icon: string; sub: string }[] = [
  { key: "dojos", label: "Dojôs", icon: "building", sub: "Anuidade de dojô afiliado" },
  { key: "practitioners", label: "Praticantes", icon: "user", sub: "Faixa-preta ativa" },
  { key: "both", label: "Ambos", icon: "layers", sub: "Dojôs + praticantes" },
];

export function Step1Scope({ year, scope, onChangeScope, preview, loading, error, onRetry }: Props) {
  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.intro}>
        Quem entra na campanha de anuidades da temporada {year}? Só quem ainda não tem
        nenhuma cobrança lançada este ano — ausência de cobrança nunca é inadimplência,
        é só quem falta convidar a pagar.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Icon name="warning" size={16} color={P.danger} />
          <Text style={styles.errorText}>Não foi possível calcular os elegíveis da temporada.</Text>
          <Pressable onPress={onRetry} style={styles.retryBtn}>
            <Text style={styles.retryLabel}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.grid}>
          {OPTIONS.map((opt) => {
            const count = countForScope(preview, opt.key);
            const total = !preview
              ? 0
              : opt.key === "dojos"
              ? amountSum(preview.dojos)
              : opt.key === "practitioners"
              ? amountSum(preview.practitioners)
              : amountSum(preview.dojos) + amountSum(preview.practitioners);
            const active = scope === opt.key;
            const disabled = !loading && count === 0;
            return (
              <Pressable
                key={opt.key}
                onPress={() => !disabled && onChangeScope(opt.key)}
                style={[styles.card, active && styles.cardActive, disabled && styles.cardDisabled]}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}
                accessibilityLabel={`Escopo ${opt.label}, ${count} elegíveis`}
              >
                <View style={styles.cardHead}>
                  <View style={[styles.cardIco, active && { backgroundColor: P.redWash }]}>
                    <Icon name={opt.icon} size={15} color={active ? P.red : C.ink3} />
                  </View>
                  {active && <Icon name="check" size={14} color={P.red} />}
                </View>
                <Text style={styles.cardLabel}>{opt.label}</Text>
                <Text style={styles.cardSub}>{opt.sub}</Text>
                <View style={styles.cardCountRow}>
                  {loading ? (
                    <ActivityIndicator size="small" color={C.ink3} />
                  ) : (
                    <>
                      <Text style={[styles.cardCount, disabled && { color: C.ink4 }]}>{count}</Text>
                      <Text style={styles.cardCountLabel}>{count === 1 ? "elegível" : "elegíveis"}</Text>
                    </>
                  )}
                </View>
                {!loading && count > 0 && <Text style={styles.cardAmount}>{fmtMoney(total)} previsto</Text>}
                {!loading && count === 0 && <Text style={styles.cardEmpty}>Nenhum elegível agora</Text>}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.ink2 } as TextStyle,

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 } as ViewStyle,
  card: { flexGrow: 1, flexBasis: 170, backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: 16, gap: 4 } as ViewStyle,
  cardActive: { borderColor: P.redLine, backgroundColor: P.redWash } as ViewStyle,
  cardDisabled: { opacity: 0.5 } as ViewStyle,
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } as ViewStyle,
  cardIco: { width: 30, height: 30, borderRadius: R.md, backgroundColor: P.glass2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  cardLabel: { fontFamily: F.heading, fontSize: 17, color: C.ink, marginTop: 6 } as TextStyle,
  cardSub: { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,
  cardCountRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 10 } as ViewStyle,
  cardCount: { fontFamily: F.heading, fontSize: 28, color: C.ink } as TextStyle,
  cardCountLabel: { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,
  cardAmount: { fontFamily: F.mono, fontSize: 11.5, color: C.ink2, marginTop: 2 } as TextStyle,
  cardEmpty: { fontFamily: F.body, fontSize: 11, color: C.ink4, marginTop: 2, fontStyle: "italic" } as TextStyle,

  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: P.dangerWash, borderWidth: 1, borderColor: P.redLine, borderRadius: R.md, padding: 14, flexWrap: "wrap" } as ViewStyle,
  errorText: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.ink2, minWidth: 160 } as TextStyle,
  retryBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: R.sm, backgroundColor: P.ink } as ViewStyle,
  retryLabel: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: "#fdf8f2" } as TextStyle,
});
