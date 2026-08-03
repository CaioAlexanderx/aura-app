// ============================================================
// DojoQrCard — QR único do dojô (F9)
//
// Exibe o QR (via components/QrCode.tsx — qrcode-svg local, SEM
// dependência nova, mesmo componente usado em AlunoQrSection) + botão
// "Imprimir cartaz" — MESMO mecanismo de exportação de
// CarteirinhaPanel.tsx (buildDojoQrPosterHtml → Blob →
// URL.createObjectURL → window.open, fallback document.write se o
// popup for bloqueado). Some sozinho em SCHEMA_PENDING/erro — mesmo
// racional do QrSettingsCard (degrade silencioso).
//
// O QR é ÚNICO por dojô e ESTÁVEL (não gira a cada carregamento) — o
// sensei imprime este cartaz uma vez e fixa na recepção; o sistema
// resolve sozinho qual turma está rolando pelo horário no momento do
// check-in (ver QrCheckinPanel + karateDojoClassService.checkin no
// backend).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ViewStyle, TextStyle, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { karateDojoClassesApi } from "@/services/karateDojoClassesApi";
import { QrCode } from "@/components/QrCode";
import { buildDojoQrPosterHtml } from "./buildDojoQrPosterHtml";
import { toast } from "@/components/Toast";

interface Props {
  federationId: string;
  dojoName?: string | null;
}

export function DojoQrCard({ federationId, dojoName }: Props) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await karateDojoClassesApi.getDojoQr(federationId);
      setToken(res.token ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const printPoster = () => {
    if (Platform.OS !== "web") {
      toast.error("Impressão disponível apenas na versão web");
      return;
    }
    if (!token) return;
    setPrinting(true);
    try {
      const html = buildDojoQrPosterHtml(dojoName || "Dojô", token);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) {
        const w2 = window.open("", "_blank");
        if (w2) { w2.document.write(html); w2.document.close(); }
        else { toast.error("Popup bloqueado — permita popups para app.getaura.com.br"); return; }
      }
    } catch (err) {
      console.error("[DojoQrCard] erro ao gerar cartaz:", err);
      toast.error("Erro ao gerar o cartaz do QR");
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={KarateColors.primary} />
      </View>
    );
  }
  if (failed || !token) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Icon name="qr_code" size={16} color={KarateColors.primary} />
        <Text style={styles.title}>QR único do dojô</Text>
      </View>
      <Text style={styles.sub}>
        Um cartaz só, para o dojô inteiro — o sistema descobre sozinho qual aula está acontecendo pelo horário. Imprima e deixe fixado na recepção.
      </Text>

      <View style={styles.qrWrap}>
        <QrCode value={token} size={160} />
      </View>

      <TouchableOpacity
        style={[styles.printBtn, printing && { opacity: 0.6 }]}
        onPress={printPoster}
        disabled={printing}
        accessibilityRole="button"
        accessibilityLabel="Imprimir cartaz do QR único"
      >
        <Icon name="download" size={15} color={KarateColors.ink2} />
        <Text style={styles.printTxt}>{printing ? "Gerando…" : "Imprimir cartaz"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 8, alignItems: "center" } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" } as ViewStyle,
  title: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sub: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18, alignSelf: "flex-start" } as TextStyle,
  qrWrap: { marginVertical: 6 } as ViewStyle,
  printBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  printTxt: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
});
