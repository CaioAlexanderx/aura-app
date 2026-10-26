// ============================================================
// AURA. — Faixa do teste na tela de Planos (tq-43, 26/10/2026)
//
// A tela de Planos escrevia "Período de teste - N dias restantes" com o
// trial_days_left do billing-status. Antes da primeira venda isso mostrava o
// teto de 15 dias, que o Caio decidiu nunca exibir (ver utils/trialAviso.ts).
//
// Agora o texto é o MESMO do banner do teste (TrialBanner): avisoDoTrial com o
// bloco company.trial. Antes da venda: "Teste grátis de 7 dias" + "Os 7 dias
// começam na sua primeira venda no Caixa."; depois: "Teste grátis · N dias
// restantes". O billing-status só decide SE a faixa aparece e entra como
// legadoDias (backend sem o bloco trial).
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { avisoDoTrial, lerTrial, rotuloDoPlano } from "@/utils/trialAviso";
import { temCaixaVivo } from "@/utils/muroDeAssinatura";

export function FaixaDoTrial({ diasRestantes }: { diasRestantes: number }) {
  const company = useAuthStore((st) => st.company);
  const aviso = avisoDoTrial(lerTrial((company as any)?.trial), {
    plano: rotuloDoPlano(company?.plan),
    legadoDias: diasRestantes,
    caixaVivo: temCaixaVivo(company),
  });

  return (
    <View testID="planos-faixa-trial" style={[s.faixa, aviso.urgente && s.faixaUrgente]}>
      <Text testID="planos-faixa-trial-titulo" style={[s.titulo, aviso.urgente && { color: Colors.red }]}>
        {aviso.titulo}
      </Text>
      <Text testID="planos-faixa-trial-corpo" style={s.corpo}>{aviso.corpo}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  faixa: { backgroundColor: Colors.amberD, borderRadius: 12, padding: 12, marginBottom: 16, alignItems: "center", borderWidth: 1, borderColor: Colors.amber + "44" },
  faixaUrgente: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  titulo: { fontSize: 13, color: Colors.amber, fontWeight: "600", textAlign: "center" },
  corpo: { fontSize: 11, color: Colors.ink3, marginTop: 2, textAlign: "center" },
});
