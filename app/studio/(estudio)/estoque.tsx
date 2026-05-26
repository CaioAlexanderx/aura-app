// ============================================================
// AURA STUDIO · Estoque (delegação 1:1 ao varejo)
//
// 26/05/2026 (URGENTE): cliente Studio sem acesso a cadastro de
// produto/imagem/quantidade porque /studio/produtos é só configurador
// de personalização e /(tabs)/estoque é bloqueado pelo redirect do
// _layout (vertical=studio → /studio/(estudio)).
//
// Estratégia "delegação 1:1" (mesmo padrão de gestao/financeiro.tsx):
// renderiza EstoqueScreen completo do varejo com header contextual
// Studio. Cliente entra em "Estoque" no shell Studio e usa a tela
// real de cadastro de produtos (foto, qty, categoria, preço, etc).
//
// Fluxo recomendado: cadastra produto aqui → vai em "Produtos" pra
// marcar como personalizável e configurar campos de customização.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { StudioColors } from "@/constants/studio-tokens";
import EstoqueScreen from "@/app/(tabs)/estoque";

export default function StudioEstoque() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={s.headerWrap}>
        <Text style={s.eyebrow}>ESTÚDIO · ESTOQUE</Text>
        <Text style={s.title}>Cadastro de produtos</Text>
        <Text style={s.subtitle}>
          Cadastre produtos, fotos, preços e quantidades aqui. Depois vá em Estúdio · Produtos pra marcar quais aceitam personalização.
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <EstoqueScreen />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bg3,
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    color: StudioColors.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.ink3,
    lineHeight: 18,
    maxWidth: 720,
    marginBottom: 4,
  },
});
