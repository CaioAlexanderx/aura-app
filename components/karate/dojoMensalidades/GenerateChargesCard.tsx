// ============================================================
// GenerateChargesCard — botão "Gerar cobranças do mês" (F3a)
//
// POST /generate é IDEMPOTENTE no backend — regerar não duplica. O
// resultado {created, skipped} é mostrado inline e a copy deixa isso
// explícito, porque o dojô vai tocar nesse botão mais de uma vez por
// mês (aluno novo assinou no meio do mês, etc).
// ============================================================
import React, { useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateDojoBillingApi } from "@/services/karateDojoBillingApi";
import { mapBillingError } from "./helpers";

interface Props {
  federationId: string;
  competence: string;
  onGenerated: () => void;
  compact?: boolean;
}

export function GenerateChargesCard({ federationId, competence, onGenerated, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleGenerate = async () => {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await karateDojoBillingApi.generateCharges(federationId, competence);
      setResult(res);
      onGenerated();
    } catch (e: any) {
      setErr(mapBillingError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={compact ? styles.compact : styles.card}>
      <View style={{ flex: 1, minWidth: 200 }}>
        <Text style={styles.title}>Gerar cobranças do mês</Text>
        <Text style={styles.sub}>
          Cria as cobranças das assinaturas ativas para este mês. Pode tocar de novo quando quiser —
          regerar não duplica cobrança já existente.
        </Text>
        {busy && (
          <View style={styles.inline}>
            <ActivityIndicator size="small" color={KarateColors.primary} />
          </View>
        )}
        {!!result && (
          <View style={styles.resultBox}>
            <Icon name="check_circle" size={14} color={KarateColors.ok} />
            <Text style={styles.resultTxt}>
              {result.created} nova{result.created === 1 ? "" : "s"} · {result.skipped} já existia{result.skipped === 1 ? "" : "m"}
            </Text>
          </View>
        )}
        {!!err && <Text style={styles.err}>{err}</Text>}
      </View>
      <KarateButton
        label="Gerar cobranças"
        variant="sumi"
        size="sm"
        onPress={handleGenerate}
        loading={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap",
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 14,
  } as ViewStyle,
  compact: {
    flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap",
  } as ViewStyle,
  title: { fontSize: 13.5, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sub: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 2, lineHeight: 16, maxWidth: 420 } as TextStyle,
  inline: { marginTop: 6, alignItems: "flex-start" } as ViewStyle,
  resultBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 } as ViewStyle,
  resultTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.ok } as TextStyle,
  err: { fontSize: 12, color: KarateColors.danger, fontWeight: "600", marginTop: 6 } as TextStyle,
});
