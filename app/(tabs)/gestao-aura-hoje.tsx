import { ScrollView, StyleSheet, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PainelHoje } from "@/components/admin/painel/PainelHoje";

// Tela de staff, como as outras da Gestão Aura: sem chave `mod` (o item do
// menu é `staff: true`), o gate é o isStaff.
export default function GestaoAuraHojeScreen() {
  var router = useRouter();
  var { isStaff } = useAuthStore();
  if (!isStaff) return null;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.cnt}>
      <Pressable onPress={function() { router.push("/gestao-aura" as any); }} style={s.backBtn}>
        <Icon name="chevron_left" size={16} color={Colors.violet3} />
        <Text style={s.backText}>Central de Comando</Text>
      </Pressable>
      <View>
        <PainelHoje />
      </View>
    </ScrollView>
  );
}

var s = StyleSheet.create({
  cnt: { padding: IS_WIDE ? 32 : 16, paddingBottom: 48, maxWidth: 1240, alignSelf: "center", width: "100%" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14, alignSelf: "flex-start" },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});
