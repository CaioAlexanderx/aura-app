import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";

var PLAN_LABELS: Record<string, string> = {
  essencial: "Essencial",
  negocio:   "Negocio",
  expansao:  "Expansao",
};

export function TrialBanner() {
  const { trialActive, trialEndsAt, isDemo, company } = useAuthStore();
  const router = useRouter();

  if (isDemo || !trialActive || !trialEndsAt) return null;

  const now = new Date();
  const end = new Date(trialEndsAt);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
  const urgent = daysLeft <= 2;

  const planLabel = PLAN_LABELS[company?.plan ?? ""] ?? (company?.plan ?? "teste");

  return (
    <View style={[s.banner, urgent && s.bannerUrgent]}>
      <View style={s.left}>
        <Icon name="star" size={16} color={urgent ? Colors.red : Colors.amber} />
        <View style={s.textWrap}>
          <Text style={[s.title, urgent && { color: Colors.red }]}>
            Teste grátis · {daysLeft} {daysLeft === 1 ? "dia restante" : "dias restantes"}
          </Text>
          <Text style={s.sub}>
            {urgent
              ? "Seu período de teste termina em breve. Assine para não perder acesso."
              : `Você está no período de teste do plano ${planLabel}.`}
          </Text>
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
