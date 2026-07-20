// ============================================================
// AlunoQrSection — QR de check-in do aluno (F4)
//
// Seção pequena na ficha do aluno (AlunoFichaModal): busca o token via
// GET /students/:sid/qr e renderiza com o MESMO componente de QR que a
// carteirinha/Pix já usam (PixQRCode — SVG via react-native-qrcode-svg,
// com fallback textual copiável quando a lib não estiver disponível).
// Nenhuma dependência nova. Carregado sob demanda (só quando a ficha
// abre), silencioso em SCHEMA_PENDING/erro — a seção simplesmente some.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { PixQRCode } from "@/components/karate/PixQRCode";
import { karateDojoClassesApi } from "@/services/karateDojoClassesApi";

interface Props {
  federationId: string;
  studentId: string;
}

export function AlunoQrSection({ federationId, studentId }: Props) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await karateDojoClassesApi.getStudentQr(federationId, studentId);
      setToken(res.token ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [federationId, studentId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.box}>
        <ActivityIndicator size="small" color={KarateColors.primary} />
      </View>
    );
  }
  if (failed || !token) return null;

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Icon name="qr_code" size={14} color={KarateColors.primary} />
        <Text style={styles.title}>QR de check-in</Text>
      </View>
      <Text style={styles.sub}>Mostre esse QR na tela de Turmas pra marcar presença sem precisar da chamada manual.</Text>
      <PixQRCode payload={token} size={140} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.surface, marginTop: 4, alignItems: "center" } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" } as ViewStyle,
  title: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  sub: { fontSize: 11.5, color: KarateColors.ink3, lineHeight: 15, alignSelf: "flex-start" } as TextStyle,
});
