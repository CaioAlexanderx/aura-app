import { ScrollView, StyleSheet, View, Text, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { OperacoesAdmin } from "@/components/admin/OperacoesAdmin";
import { ferramentaByKey } from "@/components/admin/ferramentas";

export default function GestaoAuraOperacoesScreen() {
  var router = useRouter();
  var { isStaff } = useAuthStore();
  var params = useLocalSearchParams<{ ferramenta?: string }>();
  // ?ferramenta=sla|consultorias|pipeline abre uma das telas do grupo
  // "Ferramentas" do hub; sem o parâmetro, Operações é só a Equipe Aura.
  var ferramenta = ferramentaByKey(Array.isArray(params.ferramenta) ? params.ferramenta[0] : params.ferramenta);
  if (!isStaff) return null;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.cnt}>
      <View style={s.header}>
        <Pressable onPress={function() { router.push("/gestao-aura" as any); }} style={s.backBtn}>
          <Icon name="chevron_left" size={16} color={Colors.violet3} />
          <Text style={s.backText}>{ferramenta ? "Central de Comando › Ferramentas" : "Central de Comando"}</Text>
        </Pressable>
        <View style={s.titleRow}>
          <View style={[s.titleIcon, { backgroundColor: "#f472b6" + "22", borderColor: "#f472b6" + "44" }]}>
            <Icon name="settings" size={18} color="#f472b6" />
          </View>
          <View>
            <Text style={s.title}>{ferramenta ? ferramenta.title : "Operações"}</Text>
            <Text style={s.subtitle}>{ferramenta ? ferramenta.description : "Equipe Aura"}</Text>
          </View>
        </View>
      </View>
      <OperacoesAdmin ferramenta={ferramenta ? ferramenta.key : null} />
    </ScrollView>
  );
}

var s = StyleSheet.create({
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 1100, alignSelf: "center", width: "100%" },
  header: { marginBottom: 24 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  titleIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.ink3, marginTop: 2 },
});
