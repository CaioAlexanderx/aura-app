// ============================================================
// AURA. — Nova condicional · "De qual loja as peças vão sair?" (C6)
//
// Mockup "nova.loja": só no consolidado (multi-CNPJ), antes do passo 1. A
// condicional é de uma loja só; a cliente vale em todas do grupo.
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { nomeDaLojaDe } from "@/utils/nomeDaLoja";
import { TEXTOS_DA_NOVA as T } from "./textos";

export type LojaDoGrupo = { id: string; name?: string; trade_name?: string; legal_name?: string };

export function EscolhaDaLoja({ lojas, onEscolher }: { lojas: LojaDoGrupo[]; onEscolher: (id: string) => void }) {
  return (
    <View testID="nova-escolha-loja">
      <Text style={s.titulo}>{T.loja.titulo}</Text>
      <Text style={s.sub}>{T.loja.sub}</Text>
      {lojas.map((l) => (
        <Pressable key={l.id} testID={"nova-loja-" + l.id} onPress={() => onEscolher(l.id)} style={s.pick} accessibilityRole="button">
          <View style={s.av}><Icon name="store" size={16} color={Colors.violet3} /></View>
          <Text style={s.nome} numberOfLines={2}>{nomeDaLojaDe(l) || "Loja"}</Text>
          <Icon name="chevron_right" size={16} color={Colors.ink3} />
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  titulo: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 13, color: Colors.ink2, marginTop: 2, marginBottom: 14, lineHeight: 19 },
  pick: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)",
  },
  av: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(124,58,237,0.18)" },
  nome: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "700", color: Colors.ink },
});
