import { ScrollView, StyleSheet, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { AuraNotasAdmin } from "@/components/admin";

export default function GestaoAuraNotasScreen() {
  var router = useRouter();
  var { isStaff } = useAuthStore();
  if (!isStaff) return null;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.cnt}>
      <View style={s.header}>
        <Pressable onPress={function() { router.push("/gestao-aura" as any); }} style={s.backBtn}>
          <Icon name="chevron_left" size={16} color={Colors.violet3} />
          <Text style={s.backText}>Central de Comando</Text>
        </Pressable>
        <View style={s.titleRow}>
          <View style={[s.titleIcon, { backgroundColor: Colors.violet + "22", borderColor: Colors.violet + "44" }]}>
            <Icon name="file_text" size={18} color={Colors.violet3} />
          </View>
          <View>
            <Text style={s.title}>Aura Notas</Text>
            <Text style={s.subtitle}>Gestao fiscal — engine propria, CSC, certificado A1 e status SEFAZ</Text>
          </View>
        </View>
      </View>
      <AuraNotasAdmin />
    </ScrollView>
  );
}

var s = StyleSheet.create({
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 1180, alignSelf: "center", width: "100%" },
  header: { marginBottom: 24 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  titleIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.ink3, marginTop: 2 },
});
