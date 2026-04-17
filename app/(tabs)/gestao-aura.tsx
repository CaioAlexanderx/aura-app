import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { TabBar } from "@/components/TabBar";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import { DashboardAdmin, ClientsAdmin, ReceitaAdmin, EquipeAdmin, SolicitacoesAdmin } from "@/components/admin";

var TABS = ["Painel", "Clientes", "Receita", "Equipe", "Solicitacoes"];

export default function GestaoAuraScreen() {
  var router = useRouter();
  var { isStaff, isDemo } = useAuthStore();

  if (!isStaff && !isDemo) {
    return (
      <View style={s.guard}>
        <Icon name="alert" size={32} color={Colors.red} />
        <Text style={s.guardTitle}>Acesso restrito</Text>
        <Text style={s.guardDesc}>Esta area e exclusiva para a equipe Aura.</Text>
        <Pressable onPress={function() { router.replace("/"); }} style={s.guardBtn}>
          <Text style={s.guardBtnText}>Voltar ao painel</Text>
        </Pressable>
      </View>
    );
  }

  if (isDemo) {
    return (
      <View style={s.guard}>
        <Icon name="bar_chart" size={32} color={Colors.amber} />
        <Text style={s.guardTitle}>Central de Comando</Text>
        <Text style={s.guardDesc}>Este painel e exclusivo para a equipe Aura e nao esta disponivel no modo demonstrativo.</Text>
        <Pressable onPress={function() { router.replace("/"); }} style={s.guardBtn}>
          <Text style={s.guardBtnText}>Voltar ao painel</Text>
        </Pressable>
      </View>
    );
  }

  var [tab, setTab] = useState(0);

  return (
    <ScrollView style={s.scr} contentContainerStyle={s.cnt}>
      <PageHeader title="Central de Comando" />
      <View style={s.adminBadge}>
        <Icon name="star" size={12} color={Colors.amber} />
        <Text style={s.adminText}>Gestao 360 da plataforma Aura</Text>
      </View>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      {tab === 0 && <DashboardAdmin />}
      {tab === 1 && <ClientsAdmin />}
      {tab === 2 && <ReceitaAdmin />}
      {tab === 3 && <EquipeAdmin />}
      {tab === 4 && <SolicitacoesAdmin />}
    </ScrollView>
  );
}

var s = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 1100, alignSelf: "center", width: "100%" },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.amberD, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.amber + "33" },
  adminText: { fontSize: 12, color: Colors.amber, fontWeight: "600" },
  guard: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  guardTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginTop: 16, textAlign: "center" },
  guardDesc: { fontSize: 13, color: Colors.ink3, marginTop: 8, textAlign: "center", lineHeight: 20 },
  guardBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 },
  guardBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
