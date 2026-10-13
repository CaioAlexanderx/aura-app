// ============================================================
// AURA. — Atalho "Assento de temporada" em Configurações (13/10/2026)
//
// O cartão do assento mudou para a página Black Friday. Em Configurações ›
// Plano fica só este atalho — onde o dono já procurava, uma linha que leva
// para onde a função está agora. Some com a página: fora do período, sem o
// módulo ou depois da janela do assento (aí não há o que ver lá).
// ============================================================
import { Pressable, View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { BLACK_FRIDAY_MOD, BLACK_FRIDAY_ROTA, blackFridayAtivo } from "@/constants/blackFriday";
import { assentoTemporadaVisivel } from "@/components/screens/configuracoes/assentoTemporada";

export function AtalhoAssento() {
  const visible = useVisibleModules();
  if (!blackFridayAtivo() || !assentoTemporadaVisivel() || !visible.has(BLACK_FRIDAY_MOD)) return null;
  return (
    <Pressable
      onPress={() => router.push(BLACK_FRIDAY_ROTA as any)}
      style={s.card}
      accessibilityRole="link"
      testID="atalho-assento-black-friday"
    >
      <View style={s.icone}><Icon name="users" size={18} color={Colors.violet3} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.titulo}>Assento de temporada</Text>
        <Text style={s.desc}>Um acesso extra para a equipe de fim de ano. Ver na página Black Friday.</Text>
      </View>
      <Icon name="chevron_right" size={16} color={Colors.ink3} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.violetD, marginTop: 12 },
  icone: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4 },
  titulo: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  desc: { fontSize: 12, color: Colors.ink3, marginTop: 2, lineHeight: 17 },
});
