// ============================================================
// AURA. — C1: tela Organizar catálogo (F0)
//
// Rota: /catalogo/organizar
//
// 10/11/2026: o Estoque não abre mais esta rota. O botão "Organizar
// categorias" abre o modal OrganizarCategoriasModal, dentro do Estoque. A
// rota fica para os links antigos e para a Vitrine do Canal Digital, com o
// mesmo conteúdo (components/screens/catalogo/OrganizarCategorias.tsx) e o
// "Voltar" com destino certo (utils/voltarDoCatalogo.ts): antes era
// router.back(), que caía no Painel.
// ============================================================
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/constants/colors";
import { OrganizarCategorias } from "@/components/screens/catalogo/OrganizarCategorias";
import { useVoltarDoCatalogo } from "@/hooks/useVoltarDoCatalogo";

export default function OrganizarCatalogoScreen() {
  const C = useColors();
  const router = useRouter();
  const voltar = useVoltarDoCatalogo();
  const s = estilos(C);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={s.wrap}>
      <Pressable
        onPress={voltar}
        style={s.voltar}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        testID="organizar-voltar"
      >
        <Text style={{ color: C.ink3, fontSize: 13 }}>← Voltar</Text>
      </Pressable>

      <Text style={s.titulo}>Organizar catálogo</Text>

      <View style={s.card}>
        <OrganizarCategorias onAbrirMigracao={() => router.push("/catalogo/migracao")} />
      </View>
    </ScrollView>
  );
}

function estilos(C: any) {
  return StyleSheet.create({
    wrap:   { padding: 20, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
    voltar: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
    titulo: { fontSize: 22, fontWeight: "800", color: C.ink, marginTop: 4, marginBottom: 12 },
    card:   { backgroundColor: C.bg3, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  });
}
