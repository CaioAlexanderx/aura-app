import { ScrollView, StyleSheet, View, Text, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { SolicitacoesAdmin } from "@/components/admin/SolicitacoesAdmin";

var COR = "#0ea5e9";

export default function GestaoAuraChamadosScreen() {
  var router = useRouter();
  var { isStaff } = useAuthStore();
  var params = useLocalSearchParams<{ chamado?: string }>();
  // ?chamado=<id> é o link do aviso que a equipe recebe por e-mail e no sino:
  // abre a conversa daquele chamado direto.
  var chamado = Array.isArray(params.chamado) ? params.chamado[0] : params.chamado;
  if (!isStaff) return null;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.cnt}>
      <View style={s.header}>
        <Pressable onPress={function() { router.push("/gestao-aura" as any); }} style={s.backBtn}>
          <Icon name="chevron_left" size={16} color={Colors.violet3} />
          <Text style={s.backText}>Central de Comando</Text>
        </Pressable>
        <View style={s.titleRow}>
          <View style={[s.titleIcon, { backgroundColor: COR + "22", borderColor: COR + "44" }]}>
            <Icon name="headset" size={18} color={COR} />
          </View>
          <View>
            <Text style={s.title}>Chamados</Text>
            <Text style={s.subtitle}>Pedidos de ajuda que as lojas abriram no app</Text>
          </View>
        </View>
      </View>
      <SolicitacoesAdmin chamadoInicial={chamado || null} />
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
