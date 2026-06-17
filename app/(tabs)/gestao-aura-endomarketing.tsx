import { ScrollView, StyleSheet, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { EndomarketingAdmin } from "@/components/admin/EndomarketingAdmin";

export default function GestaoAuraEndomarketingScreen() {
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
          <View style={[s.titleIcon, { backgroundColor: "#8b5cf6" + "22", borderColor: "#8b5cf6" + "44" }]}>
            <Icon name="sparkles" size={18} color="#8b5cf6" />
          </View>
          <View>
            <Text style={s.title}>Endomarketing</Text>
            <Text style={s.subtitle}>Banners de notificação no app</Text>
          </View>
        </View>
      </View>
      <EndomarketingAdmin />
    </ScrollView>
  );
}

var s = StyleSheet.create({
  cnt:       { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 1100, alignSelf: "center", width: "100%" },
  header:    { marginBottom: 24 },
  backBtn:   { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 },
  backText:  { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  titleRow:  { flexDirection: "row", alignItems: "center", gap: 14 },
  titleIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  title:     { fontSize: 20, fontWeight: "800", color: Colors.ink },
  subtitle:  { fontSize: 13, color: Colors.ink3, marginTop: 2 },
});
