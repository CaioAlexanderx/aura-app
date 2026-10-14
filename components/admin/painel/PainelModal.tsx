// ============================================================
// Gestão Aura › Hoje — casca dos modais (ficha, catálogo, conversa, registrar
// contato, +7 dias). Modal do RN (na web já sai em portal no body, fora do
// shell), clique fora e Esc fecham.
//
// Mora em arquivo próprio, sem gráficos, para o Registrar contato poder ser
// aberto de fora do painel (Gestão Aura › Clientes) sem puxar react-native-svg.
// PainelModais.tsx reexporta.
// ============================================================
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Paleta } from "./paleta";

export function PainelModal(props: {
  visible: boolean;
  id: string;                 // vira o testID da casca e do botão de fechar
  titulo: string;
  subtitulo?: string;
  antesDoTitulo?: React.ReactNode;
  rodape?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={m.scrim} testID={props.id}>
        <Pressable style={StyleSheet.absoluteFill} onPress={props.onClose} accessibilityLabel="Fechar" />
        <View style={m.modal} accessibilityRole={"dialog" as any}>
          <View style={m.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={m.tituloRow}>
                {props.antesDoTitulo}
                <Text style={m.titulo}>{props.titulo}</Text>
              </View>
              {props.subtitulo ? <Text style={m.subtitulo}>{props.subtitulo}</Text> : null}
            </View>
            <Pressable testID={props.id + "-fechar"} onPress={props.onClose} style={m.fechar} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="x" size={16} color={Paleta.accentTexto} />
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={m.body}>{props.children}</ScrollView>
          {props.rodape ? <View style={m.foot}>{props.rodape}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

var m = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(17,15,28,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 760, maxHeight: "92%", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, overflow: "hidden" },
  head: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tituloRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  titulo: { fontSize: 18, fontWeight: "800", color: Colors.ink, flexShrink: 1 },
  subtitulo: { fontSize: 13, color: Colors.ink3, marginTop: 4 },
  fechar: { width: 30, height: 30, borderRadius: 8, backgroundColor: Paleta.accentSuave, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20, paddingVertical: 16, gap: 16 },
  foot: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
});
