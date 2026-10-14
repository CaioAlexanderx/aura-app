import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { avisoDoTrial, diasLegado, lerTrial } from "@/utils/trialAviso";

var PLAN_LABELS: Record<string, string> = {
  essencial: "Essencial",
  negocio:   "Negócio",
  expansao:  "Expansão",
};

export function TrialBanner() {
  const { trialActive, trialEndsAt, isDemo, isStaff, company } = useAuthStore();
  const router = useRouter();

  // Staff da Aura nao ve avisos de cobranca/trial — conta interna
  // nao precisa de assinatura e os banners poluem o painel.
  if (isStaff) return null;

  if (isDemo || !trialActive || !trialEndsAt) return null;

  const planLabel = PLAN_LABELS[company?.plan ?? ""] ?? (company?.plan ?? "teste");

  // 14/10/2026 (card t2-05): o texto vem do bloco company.trial do backend
  // (modo, primeira venda, dias restantes). Sem o bloco, conta a partir de
  // trial_ends_at como sempre. Ver utils/trialAviso.ts.
  const aviso = avisoDoTrial(lerTrial((company as any)?.trial), {
    plano: planLabel,
    legadoDias: diasLegado(trialEndsAt),
  });
  const urgent = aviso.urgente;

  return (
    <View style={[s.banner, urgent && s.bannerUrgent]}>
      <View style={s.left}>
        <Icon name="star" size={16} color={urgent ? Colors.red : Colors.amber} />
        <View style={s.textWrap}>
          <Text testID="trial-banner-titulo" style={[s.title, urgent && { color: Colors.red }]}>
            {aviso.titulo}
          </Text>
          <Text testID="trial-banner-corpo" style={s.sub}>{aviso.corpo}</Text>
        </View>
      </View>
      <Pressable onPress={() => router.push("/planos" as any)} style={s.btn}>
        <Text style={s.btnText}>Assinar agora</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.amber + "33", flexWrap: "wrap", gap: 10,
  },
  bannerUrgent: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 200 },
  textWrap: { flex: 1 },
  title: { fontSize: 13, fontWeight: "700", color: Colors.amber },
  sub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  btn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  btnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
