// ============================================================
// Aura Karatê (dojô) — Turmas (F4: CRUD, matrícula, chamada, check-in QR)
//
// Header + (quando ligado) painel de check-in por QR no topo + lista de
// turmas (cards). O toggle de QR mora em Configurações — aqui só lemos
// o estado (GET /classes/settings) pra decidir se o painel aparece.
// Falha ao ler settings não bloqueia a tela: painel simplesmente some
// (mesmo racional do card Mensalidades no painel — degrade silencioso).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { KarateColors } from "@/constants/karateTheme";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateDojoClassesApi } from "@/services/karateDojoClassesApi";
import { TurmasList } from "@/components/karate/dojoTurmas/TurmasList";
import { QrCheckinPanel } from "@/components/karate/dojoTurmas/QrCheckinPanel";

export default function DojoTurmas() {
  const { dojoName } = useKarateDojo();
  const { federationId } = useKarateFederation();
  const [qrEnabled, setQrEnabled] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!federationId) return;
    try {
      const cfg = await karateDojoClassesApi.getSettings(federationId);
      setQrEnabled(!!cfg.qr_checkin_enabled);
    } catch {
      setQrEnabled(false);
    }
  }, [federationId]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  if (!federationId) return null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>{dojoName}</Text>
        <Text style={styles.title}>Turmas</Text>
        <Text style={styles.lead}>Organize as turmas do seu dojô, matricule alunos e registre a chamada de cada aula.</Text>
      </View>

      {qrEnabled && <QrCheckinPanel federationId={federationId} />}

      <TurmasList federationId={federationId} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
});
