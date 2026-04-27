// ============================================================
// DentalAiSettingsCard — card de configuracoes IA (PR19).
//
// Renderizado em /dental/(clinic)/clinica.
// Mostra:
//   - Estado atual (ativada/desativada, plano, quota)
//   - Toggle ligar/desligar (com modal de consent na 1a vez)
//   - Barra de uso do mes corrente (% e custo USD)
//   - Aviso se sem Expansao ou se odonto nao ativo
//
// Le do backend via useDentalAiSettings (GET /dental/ai/settings).
// ============================================================

import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Modal, ScrollView, Switch } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import { toast } from "@/components/Toast";
import { useDentalAiSettings } from "@/hooks/useDentalAiConsulta";

export function DentalAiSettingsCard() {
  const { data, isLoading, error, toggle, acceptConsent } = useDentalAiSettings();
  const [consentOpen, setConsentOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Plano abaixo de Expansao OU vertical errada — mostra teaser
  if (data && (data.plan !== "expansao" || data.vertical_active !== "odonto")) {
    return (
      <Card>
        <Header />
        <Text style={{ fontSize: 12, color: DentalColors.ink2, lineHeight: 17 }}>
          A IA Aura no Modo Consulta está disponível a partir do plano{" "}
          <Text style={{ color: DentalColors.violet, fontWeight: "700" }}>Expansão</Text> com vertical Odonto ativa.
        </Text>
        <Text style={{ fontSize: 10, color: DentalColors.ink3, marginTop: 6 }}>
          Plano atual: {data.plan} · Vertical: {data.vertical_active || "—"}
        </Text>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <Header />
        <ActivityIndicator color={DentalColors.cyan} />
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <Header />
        <Text style={{ fontSize: 12, color: DentalColors.amber }}>
          Não foi possível carregar as configurações de IA.
        </Text>
      </Card>
    );
  }

  const usagePct = data.quota_total
    ? Math.min(100, Math.round((data.quota_used / data.quota_total) * 100))
    : 0;

  function handleToggle(next: boolean) {
    if (next && !data?.ai_consent_at) {
      // Primeira ativacao -> abre consent modal
      setConsentOpen(true);
      return;
    }
    toggle.mutate(
      { ai_enabled: next },
      {
        onSuccess: () => toast.success(next ? "IA Aura ativada" : "IA Aura desativada"),
        onError: (e: any) => toast.error(e?.data?.error || "Erro ao atualizar"),
      }
    );
  }

  function handleAcceptAndEnable() {
    setAccepting(true);
    toggle.mutate(
      { ai_enabled: true, accept_consent: true },
      {
        onSuccess: () => {
          toast.success("Termo aceito. IA Aura ativada");
          setConsentOpen(false);
          setAccepting(false);
        },
        onError: (e: any) => {
          toast.error(e?.data?.error || "Erro ao ativar");
          setAccepting(false);
        },
      }
    );
  }

  return (
    <>
      <Card>
        <Header />

        <View style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          padding: 12, backgroundColor: DentalColors.bg2, borderRadius: 8,
          borderWidth: 1, borderColor: data.ai_enabled ? "rgba(34,197,94,0.3)" : DentalColors.border,
          marginTop: 8,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: DentalColors.ink, marginBottom: 2 }}>
              {data.ai_enabled ? "Ativada" : "Desativada"}
            </Text>
            <Text style={{ fontSize: 10, color: DentalColors.ink3 }}>
              {data.ai_enabled
                ? "Brief, sugestões, Q&A e resumo automático rodam no Modo Consulta."
                : "Ative para liberar IA no Modo Consulta da clínica."}
            </Text>
          </View>
          <Switch
            value={data.ai_enabled}
            onValueChange={handleToggle}
            disabled={toggle.isPending}
            trackColor={{ false: DentalColors.border, true: DentalColors.cyan }}
            thumbColor="#fff"
          />
        </View>

        {/* Quota / Uso */}
        {data.ai_enabled ? (
          <View style={{ marginTop: 10, padding: 12, backgroundColor: DentalColors.bg2, borderRadius: 8, borderWidth: 1, borderColor: DentalColors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: DentalColors.cyan, letterSpacing: 1 }}>
                USO ESTE MÊS
              </Text>
              <Text style={{ fontSize: 10, color: DentalColors.ink3 }}>
                {data.quota_used} / {data.quota_total ?? "∞"} consultas · ${data.cost_usd_month.toFixed(4)}
              </Text>
            </View>
            <View style={{ height: 6, backgroundColor: DentalColors.surface, borderRadius: 3, overflow: "hidden" }}>
              <View style={{
                height: "100%",
                width: `${usagePct}%`,
                backgroundColor: usagePct >= 90 ? DentalColors.red : usagePct >= 70 ? DentalColors.amber : DentalColors.cyan,
              }} />
            </View>
            {data.quota_remaining != null ? (
              <Text style={{ fontSize: 9, color: DentalColors.ink3, marginTop: 4 }}>
                {data.quota_remaining} chamadas restantes neste mês
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Consent info */}
        {data.ai_consent_at ? (
          <Text style={{ fontSize: 10, color: DentalColors.ink3, marginTop: 10 }}>
            Termo aceito em {new Date(data.ai_consent_at).toLocaleDateString("pt-BR")} · versão {data.ai_consent_version || "—"}
          </Text>
        ) : null}

        {data.ai_consent_outdated ? (
          <View style={{ marginTop: 8, padding: 10, backgroundColor: "rgba(251,191,36,0.06)", borderRadius: 6, borderWidth: 1, borderColor: "rgba(251,191,36,0.30)" }}>
            <Text style={{ fontSize: 11, color: DentalColors.amber, fontWeight: "600", marginBottom: 4 }}>
              ⚠ Termo de uso atualizado
            </Text>
            <Text style={{ fontSize: 10, color: DentalColors.ink2 }}>
              Houve uma nova versão do termo. Reaceite para continuar usando.
            </Text>
            <Pressable
              onPress={() => acceptConsent.mutate()}
              disabled={acceptConsent.isPending}
              style={{
                marginTop: 8, alignSelf: "flex-start",
                backgroundColor: DentalColors.amber,
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
              }}>
              <Text style={{ color: "#000", fontSize: 10, fontWeight: "700" }}>
                {acceptConsent.isPending ? "Aceitando..." : "Reaceitar termo"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={{ fontSize: 9, color: DentalColors.ink3, marginTop: 8 }}>
          Modelo: Anthropic Claude Haiku 4.5 · Quota mensal padrão: 500 consultas
        </Text>
      </Card>

      {/* Modal de consent — primeira ativação */}
      <Modal visible={consentOpen} animationType="fade" transparent onRequestClose={() => setConsentOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 }}>
          <View style={{
            backgroundColor: DentalColors.bg2,
            borderRadius: 16, borderWidth: 1, borderColor: DentalColors.border,
            maxHeight: "85%", padding: 20,
          }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: DentalColors.ink, marginBottom: 6 }}>
              Termo de uso · IA Aura
            </Text>
            <Text style={{ fontSize: 11, color: DentalColors.ink3, marginBottom: 12 }}>
              Versão {data.ai_consent_current_version}. Leia e aceite para ativar.
            </Text>

            <ScrollView style={{
              maxHeight: 320, padding: 12,
              backgroundColor: DentalColors.bg, borderRadius: 8,
              borderWidth: 1, borderColor: DentalColors.border,
            }}>
              <Text style={{ fontSize: 12, color: DentalColors.ink, lineHeight: 18 }}>
                {data.consent_text}
              </Text>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <Pressable onPress={() => setConsentOpen(false)} style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
                borderWidth: 1, borderColor: DentalColors.border,
              }}>
                <Text style={{ color: DentalColors.ink2, fontSize: 12, fontWeight: "600" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleAcceptAndEnable}
                disabled={accepting}
                style={{
                  paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8,
                  backgroundColor: DentalColors.cyan,
                  opacity: accepting ? 0.7 : 1,
                  flexDirection: "row", alignItems: "center", gap: 6,
                }}>
                {accepting ? <ActivityIndicator color="#fff" size="small" /> : null}
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                  Aceitar e ativar IA
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Header() {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={{ fontSize: 9, color: DentalColors.cyan, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 }}>
        ✨ IA Aura
      </Text>
      <Text style={{ fontSize: 16, fontWeight: "700", color: DentalColors.ink }}>
        Assistente clínica no Modo Consulta
      </Text>
      <Text style={{ fontSize: 11, color: DentalColors.ink2, marginTop: 2 }}>
        Brief pré-consulta, sugestões em tempo real, Q&A e resumo automático.
      </Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: DentalColors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: DentalColors.border,
      padding: 18, marginBottom: 18,
    }}>
      {children}
    </View>
  );
}
