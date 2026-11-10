// ============================================================
// AURA. — "Em caso de dúvidas, acione seu contador ou o suporte Aura"
// (mockup nfse-cadastro-servico.html, telas 4 e 5). WhatsApp do suporte.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { LINK_WHATSAPP_SUPORTE, TEXTO_AJUDA_FISCAL, WHATSAPP_SUPORTE_ROTULO } from "@/utils/nfseAutomatica";
import { abrirLink } from "./nfseAcoes";

export function AjudaFiscal({ style }: { style?: any }) {
  return (
    <View style={[s.box, style]} testID="ajuda-fiscal">
      <Icon name="message" size={13} color={Colors.ink3} />
      <Text style={s.txt}>
        {TEXTO_AJUDA_FISCAL} ·{" "}
        <Text
          style={s.link}
          accessibilityRole="link"
          onPress={() => abrirLink(LINK_WHATSAPP_SUPORTE)}
          testID="ajuda-fiscal-whatsapp"
        >
          WhatsApp {WHATSAPP_SUPORTE_ROTULO}
        </Text>
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "flex-start", gap: 8, width: "100%", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  txt: { flex: 1, fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  link: { color: Colors.violet3, fontWeight: "700", textDecorationLine: "underline" },
});

export default AjudaFiscal;
