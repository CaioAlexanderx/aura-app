// ============================================================
// Painel do Sensei — Solicitações de praticante (H2 / H2b)
// Aba: /karate/sensei/solicitacoes
//
// H2b (decisão do Caio, 14/07/2026): o CAMINHO PRINCIPAL de "solicitar
// novo praticante" agora é o LINK PÚBLICO de atualização cadastral
// (app/karate/roster-update/[token].tsx, token opaco, sem login) — não
// esta tela. A H2 tinha posto o fluxo aqui, atrás de JWT, por engano:
// exigir que o sensei abra a própria conta Aura pra matricular alguém
// novo condena a feature a não ser usada por quem só tem o link.
//
// Esta tela FICA como espelho, não é removida: útil pra quem já está
// logado e prefere não trocar de aba, ou pra conferir o status das
// solicitações sem precisar do link do dojô à mão. O formulário e a
// lista de status são o MESMO componente do link público —
// components/karate/PractitionerRequestForm.tsx — nada duplicado; só
// muda QUEM injeta o backend: aqui é karateApi (JWT + federationId, via
// requireDojoAccess no aura-backend), lá é karatePublicApi (token opaco).
//
// Consome o backend H1 (aura-backend PR #381, karateDojoPractitionerRequests.js):
//   POST /federation/:id/dojo/practitioner-requests
//   GET  /federation/:id/dojo/practitioner-requests?status=
//   GET  /federation/:id/dojo/practitioner-requests/lookup-fpkt?number=
//
// Regra de negócio fechada com o Caio: o sensei NUNCA cria um praticante
// direto — só SOLICITA. A federação aprova e registra o número FPKT de
// verdade (gerado por ela, fora do sistema). Faixa aqui é ALEGADA — a
// federação confere a graduação à parte, nunca prometemos aqui.
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
      />
      <View style={{ marginTop: 16 }}>
        <StatusList fetchRequests={fetchRequests} refreshKey={refreshKey} />
      </View>
    </ScrollView>
  );
}

export default function SenseiSolicitacoes() {
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
