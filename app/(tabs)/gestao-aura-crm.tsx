import { ScrollView, StyleSheet, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { ProspecaoAdmin } from "@/components/admin";

export default function GestaoAuraCrmScreen() {
  var router = useRouter();
  var { isStaff } = useAuthStore();

  if (!isStaff) {
    return (
      <View style={s.guard}>
        <Icon name="alert" size={32} color={Colors.red} />
        <Text style={s.guardTitle}>Acesso restrito</Text>
        <Pressable onPress={function() { router.replace("/gestao-aura" as any); }} style={s.guardBtn}>
          <Text style={s.guardBtnText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={s.scr} contentContainerStyle={s.cnt}>
      {/* Header com voltar */}
      <View style={s.header}>
        <Pressable onPress={function() { router.push("/gestao-aura" as any); }} style={s.backBtn}>
          <Icon name="chevron_left" size={16} color={Colors.violet3} />
          <Text style={s.backText}>Central de Comando</Text>
        </Pressable>
        <View style={s.titleRow}>
          <View style={s.titleIcon}>
            <Icon name="target" size={18} color={Colors.violet3} />
          </View>
          <View>
            <Text style={s.title}>Prospecção</Text>
            <Text style={s.subtitle}>CRM comercial — leads e pipeline</Text>
          </View>
        </View>
      </View>

      <ProspecaoAdmin />
    </ScrollView>
  );
}

var s = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 1100, alignSelf: "center", width: "100%" },
  header: { marginBottom: 24 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  titleIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.ink3, marginTop: 2 },
  guard: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  guardTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginTop: 16 },
  guardBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 },
  guardBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
