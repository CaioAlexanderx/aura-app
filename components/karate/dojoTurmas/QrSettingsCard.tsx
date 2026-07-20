// ============================================================
// QrSettingsCard — toggle "Check-in por QR" (F4)
//
// Liga/desliga o check-in por QR do dojô (GET/PUT /dojo/classes/settings).
// Card cirúrgico em Configurações — mesmo padrão do toggle da Régua
// (Switch + explicação), degrade silencioso em SCHEMA_PENDING/erro (o
// card simplesmente não renderiza).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Switch, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { karateDojoClassesApi } from "@/services/karateDojoClassesApi";

interface Props {
  federationId: string;
}

export function QrSettingsCard({ federationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await karateDojoClassesApi.getSettings(federationId);
      setEnabled(!!cfg.qr_checkin_enabled);
      setAvailable(true);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (v: boolean) => {
    setEnabled(v);
    setSaving(true);
    setErr(null);
    try {
      await karateDojoClassesApi.updateSettings(federationId, { qr_checkin_enabled: v });
    } catch {
      setEnabled(!v);
      setErr("Não foi possível salvar agora. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !available) return null;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Icon name="qr_code" size={16} color={KarateColors.primary} />
          <Text style={styles.title}>Check-in por QR</Text>
        </View>
        {saving ? (
          <ActivityIndicator size="small" color={KarateColors.primary} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={toggle}
            trackColor={{ false: KarateColors.border2, true: KarateColors.primarySoft }}
            thumbColor={enabled ? KarateColors.primary : "#fff"}
            accessibilityLabel="Check-in por QR"
          />
        )}
      </View>
      <Text style={styles.sub}>
        Quando ativado, cada aluno ganha um QR próprio (na ficha dele) que pode ser lido na tela de Turmas para marcar presença sem precisar da chamada manual.
      </Text>
      {!!err && <Text style={styles.err}>{err}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 8 } as ViewStyle,
  row: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  title: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sub: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  err: { fontSize: 12, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
});
