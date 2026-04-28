// ============================================================
// /dental/(clinic)/contabilidade
//
// PR32: trazer modulo Contabilidade do shell violet pro shell odonto.
// PR37: pluga DentalComplianceConfigCard.
// PR38: lista obligations odonto (cnae=saude) com botao "Gerar
// relatorio Aura" pra cada - aciona POST /obligations/:code/report.
// ============================================================

import { ScrollView, View, Text, ActivityIndicator } from "react-native";
import ContabilidadeScreen from "@/app/(tabs)/contabilidade";
import { DentalComplianceConfigCard } from "@/components/dental/DentalComplianceConfigCard";
import { ObligationReportTrigger } from "@/components/screens/contabilidade/ObligationReportModal";
import { useObligations } from "@/hooks/useObligations";
import { DentalColors } from "@/constants/dental-tokens";

export default function DentalContabilidadeScreen() {
  const { obligations, isLoading } = useObligations();

  // Filtra so obligations odonto/saude (cnae_category='saude' no backend)
  const saudeObligations = (obligations || []).filter((o: any) => o.cnae_category === "saude");

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 0 }}>
        {/* 1. Cadastro de compliance */}
        <View style={{ padding: 20, paddingBottom: 0 }}>
          <DentalComplianceConfigCard />
        </View>

        {/* 2. Relatorios Aura (obligations odonto) */}
        {saudeObligations.length > 0 && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <View style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1, borderColor: DentalColors.border,
              borderRadius: 14, padding: 18,
            }}>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: DentalColors.ink }}>
                  ✨ Relatorios Aura · Compliance Odonto
                </Text>
                <Text style={{ fontSize: 11, color: DentalColors.ink3, marginTop: 4, lineHeight: 16 }}>
                  Cada obrigacao saude gera um relatorio formatado com tudo que voce precisa pra entregar no portal oficial.
                </Text>
              </View>

              {isLoading ? (
                <ActivityIndicator color={DentalColors.cyan} />
              ) : (
                <View style={{ gap: 10 }}>
                  {saudeObligations.map((o: any) => (
                    <View key={o.code} style={{
                      flexDirection: "row", alignItems: "center", gap: 10,
                      padding: 12, borderRadius: 10,
                      backgroundColor: DentalColors.bg,
                      borderWidth: 1, borderColor: DentalColors.border,
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: DentalColors.ink, fontWeight: "700" }}>
                          {o.name}
                        </Text>
                        {o.description ? (
                          <Text style={{ fontSize: 10, color: DentalColors.ink3, marginTop: 2, lineHeight: 14 }} numberOfLines={2}>
                            {o.description}
                          </Text>
                        ) : null}
                        {o.alert_level === "overdue" && (
                          <Text style={{ fontSize: 10, color: DentalColors.red, fontWeight: "700", marginTop: 4 }}>
                            ⚠ Vencido
                          </Text>
                        )}
                        {(o.alert_level === "critical" || o.alert_level === "warning") && (
                          <Text style={{ fontSize: 10, color: DentalColors.amber, fontWeight: "700", marginTop: 4 }}>
                            ⚠ Vence em {o.days_until_due} dia(s)
                          </Text>
                        )}
                      </View>
                      <ObligationReportTrigger obligationCode={o.code} obligationName={o.name} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* 3. ContabilidadeScreen padrao (DAS, PGDAS, etc) */}
        <ContabilidadeScreen />
      </ScrollView>
    </View>
  );
}
