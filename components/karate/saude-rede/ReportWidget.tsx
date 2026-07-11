// ============================================================
// Saúde da Rede — Relatório periódico · Shoji
// Resume o painel e envia por e-mail ao admin. CTA sumi.
// ============================================================
import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F,
} from "@/constants/karateTheme";
import { karateNetworkHealthApi } from "@/services/karateNetworkHealthApi";
import { st } from "./shared";

export function ReportWidget({ federationId }: { federationId: string }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const send = useCallback(async () => {
    setSending(true);
    setResult(null);
    try {
      const r = await karateNetworkHealthApi.sendReport(federationId);
      setResult(r.sent ? `Relatório enviado para ${r.to}` : "Falha ao enviar.");
    } catch (e: any) {
      setResult("Erro: " + (e?.message || "desconhecido"));
    } finally {
      setSending(false);
    }
  }, [federationId]);

  return (
    <View style={st.card}>
      <View style={st.shRow}>
        <View style={{ flex: 1 }}>
          <Text style={st.shTitle}>Relatório periódico</Text>
          <View style={st.filete} />
          <Text style={st.shSub}>Resume os números da Saúde da Rede e envia por e-mail para o administrador da federação</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[rst.btnSend, sending && { opacity: 0.6 }]}
        onPress={send}
        disabled={sending}
        accessibilityLabel="Enviar relatório agora"
      >
        <Icon name="mail-outline" size={15} color={P.paperWarm} />
        <Text style={rst.btnSendLabel}>{sending ? "Enviando…" : "Enviar agora"}</Text>
      </TouchableOpacity>
      {result && <Text style={rst.reportResult}>{result}</Text>}
    </View>
  );
}

const rst = StyleSheet.create({
  btnSend:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 18, alignSelf: "flex-start" } as ViewStyle,
  btnSendLabel: { fontFamily: F.body, fontSize: 13, fontWeight: "500", color: P.paperWarm } as TextStyle,
  reportResult: { fontFamily: F.body, fontSize: 12, color: C.ink3, marginTop: 4 } as TextStyle,
});
