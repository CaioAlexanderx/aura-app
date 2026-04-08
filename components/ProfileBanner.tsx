import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";

function calcCompletion(user: any, company: any): { pct: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [!!user?.name, "Nome"],
    [!!user?.email, "E-mail"],
    [!!company?.name && company.name !== "Minha Empresa", "Nome da empresa"],
    [!!company?.cnpj, "CNPJ"],
    [!!company?.phone || !!user?.phone, "Telefone"],
    [!!company?.business_type || !!company?.cnae, "Tipo de negocio"],
  ];
  const done = checks.filter(([ok]) => ok).length;
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  return { pct: Math.round((done / checks.length) * 100), missing };
}

export function ProfileBanner() {
  const { user, company, isDemo } = useAuthStore();
  const router = useRouter();

  if (isDemo) return null;

  const { pct, missing } = calcCompletion(user, company);
  if (pct >= 100) return null;

  const barColor = pct >= 70 ? Colors.green : pct >= 40 ? Colors.amber : Colors.red;

  return (
    <Pressable onPress={() => router.push("/configuracoes" as any)} style={s.card}>
      <View style={s.top}>
        <View style={s.iconWrap}>
          <Icon name="user_plus" size={18} color={Colors.violet3} />
        </View>
        <View style={s.info}>
          <Text style={s.title}>Complete seu cadastro</Text>
          <Text style={s.sub}>
            {missing.length <= 3
              ? `Falta: ${missing.join(", ")}`
              : `${missing.length} informacoes pendentes`}
          </Text>
        </View>
        <Text style={s.pct}>{pct}%</Text>
      </View>
      <View style={s.barBg}>
        <View style={[s.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <View style={s.ctaRow}>
        <Text style={s.ctaText}>Completar nas Configuracoes</Text>
        <Icon name="chevron_right" size={14} color={Colors.violet3} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.violetD,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border2,
    marginBottom: 20,
    gap: 12,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.violet + "22",
    alignItems: "center", justifyContent: "center",
  },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  pct: { fontSize: 24, fontWeight: "800", color: Colors.violet3 },
  barBg: {
    height: 8, borderRadius: 4,
    backgroundColor: Colors.bg4,
    overflow: "hidden",
  },
  barFill: {
    height: 8, borderRadius: 4,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  ctaText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});

export default ProfileBanner;
