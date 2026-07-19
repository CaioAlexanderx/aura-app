// ============================================================
// Aura Karatê (dojô) — Solicitações de praticante (H2 / H2b)
// Rota: /karate/(dojo)/solicitacoes (F1; antes /karate/sensei/solicitacoes)
//
// H2b (decisão do Caio, 14/07/2026): o CAMINHO PRINCIPAL de "solicitar
// novo praticante" é o LINK PÚBLICO de atualização cadastral
// (app/karate/roster-update/[token].tsx, token opaco, sem login) — não
// esta tela. Esta tela FICA como espelho pra quem já está logado: o
// formulário e a lista de status são o MESMO componente do link público
// (components/karate/PractitionerRequestForm.tsx); só muda quem injeta
// o backend (aqui karateApi, JWT + federationId).
//
// Regra de negócio: o sensei NUNCA cria praticante direto — só SOLICITA.
// A federação aprova e registra o número FPKT real. Faixa aqui é ALEGADA.
// ============================================================
import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { KarateColors as P, KarateFonts as F } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateApi, PractitionerRequestStatus } from "@/services/karateApi";
import { ApiError } from "@/services/api";
import { NewRequestForm, StatusList, PractitionerRequestBody } from "@/components/karate/PractitionerRequestForm";

function SolicitacoesBody({ federationId }: { federationId: string }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmit = useCallback(
    async (body: PractitionerRequestBody) => {
      try {
        return await karateApi.createPractitionerRequest(federationId, body);
      } catch (e: any) {
        if (e instanceof ApiError) throw new Error(e.message || "Não foi possível enviar a solicitação.");
        throw new Error("Não foi possível enviar a solicitação. Tente de novo.");
      }
    },
    [federationId]
  );
  const handleLookupFpkt = useCallback(
    (number: string) => karateApi.lookupFpktNumber(federationId, number),
    [federationId]
  );
  const handleCreated = useCallback(() => setRefreshKey((k) => k + 1), []);
  const fetchRequests = useCallback(
    (status?: PractitionerRequestStatus) => karateApi.listPractitionerRequests(federationId, status),
    [federationId]
  );
  // Foto da solicitação nova pelo canal AUTENTICADO (JWT + federationId).
  const handleUploadPhoto = useCallback(
    (requestId: string, input: { content: string; content_type?: "image/jpeg" | "image/png" | "image/webp" }) =>
      karateApi.uploadPractitionerRequestPhoto(federationId, requestId, input),
    [federationId]
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Solicitações de praticante novo</Text>
      <Text style={styles.subtitle}>
        O caminho principal agora é o link público de atualização cadastral do dojô — esta tela é um espelho
        pra quem prefere ficar logado. O número FPKT é emitido pela federação; preencha a ficha completa e
        envie para análise.
      </Text>

      <NewRequestForm
        onSubmit={handleSubmit}
        onLookupFpkt={handleLookupFpkt}
        onCreated={handleCreated}
        onUploadPhoto={handleUploadPhoto}
      />
      <View style={{ marginTop: 16 }}>
        <StatusList fetchRequests={fetchRequests} refreshKey={refreshKey} />
      </View>
    </ScrollView>
  );
}

export default function DojoSolicitacoes() {
  const { federationId } = useKarateFederation();

  if (!federationId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
        <ActivityIndicator color={P.primary} size="large" />
      </View>
    );
  }

  return <SolicitacoesBody federationId={federationId} />;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, gap: 16 } as ViewStyle,
  eyebrow: { fontFamily: F.heading, fontSize: 19, color: P.ink, marginTop: 4 } as TextStyle,
  subtitle: { fontSize: 12.5, color: P.ink3, lineHeight: 18, marginBottom: 4 } as TextStyle,
});
