import { View, Text, Pressable, StyleSheet, Platform, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { linkDeAjuda, mensagemDeAjuda, type TipoAjuda } from "@/utils/certificadoA1";

// ============================================================
// Cartão "Quero ajuda da Aura" (14/10/2026) — mockup aprovado em
// docs/mockups/certificado-a1-cliente.html.
// A conversa abre no WhatsApp da Aura com uma mensagem pronta que leva só
// empresa e CNPJ. Nunca arquivo nem senha: o cartão avisa o cliente disso.
// ============================================================

type Empresa = { nome: string; cnpj?: string | null };

export function abrirAjudaNoWhatsApp(empresa: Empresa, tipo: TipoAjuda) {
  const url = linkDeAjuda(empresa, tipo);
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  Linking.openURL(url).catch(() => {});
}

export function BotaoAjudaWhatsApp({
  empresa, tipo, rotulo, testID,
}: { empresa: Empresa; tipo: TipoAjuda; rotulo?: string; testID?: string }) {
  const texto = rotulo || (tipo === "renovar" ? "Quero ajuda para renovar" : "Chamar a Aura no WhatsApp");
  return (
    <Pressable
      onPress={() => abrirAjudaNoWhatsApp(empresa, tipo)}
      accessibilityRole="link"
      accessibilityLabel={texto}
      style={a.waBtn}
      testID={testID || "cert-a1-ajuda-whatsapp"}
    >
      <Icon name="whatsapp" size={18} color={Colors.green} />
      <Text style={a.waBtnText}>{texto}</Text>
    </Pressable>
  );
}

export function CertificadoAjuda({
  empresa, tipo, titulo,
}: { empresa: Empresa; tipo: TipoAjuda; titulo?: string }) {
  return (
    <View style={a.card} testID="cert-a1-ajuda">
      <View style={a.head}>
        <Icon name="whatsapp" size={20} color={Colors.green} />
        <Text style={a.title}>{titulo || "Quero ajuda da Aura"}</Text>
      </View>
      <Text style={a.sub}>
        Prefere não mexer com isso? A equipe da Aura cuida do cadastro com você, sem pressa e sem termos difíceis.
      </Text>
      <View style={a.msg}>
        <Text style={a.msgLabel}>MENSAGEM QUE VAI PRONTA NO WHATSAPP</Text>
        <Text style={a.msgText}>{mensagemDeAjuda(empresa, tipo)}</Text>
      </View>
      <BotaoAjudaWhatsApp empresa={empresa} tipo={tipo} rotulo="Chamar a Aura no WhatsApp" />
      <View style={a.note}>
        <Icon name="lock" size={14} color={Colors.violet3} />
        <Text style={a.noteText}>Não envie o arquivo nem a senha pela conversa. A equipe te orienta por lá.</Text>
      </View>
    </View>
  );
}

const a = StyleSheet.create({
  card: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 13, color: Colors.ink3, marginTop: 4, marginBottom: 14, lineHeight: 19 },
  msg: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 14 },
  msgLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.7, color: Colors.ink3, marginBottom: 4 },
  msgText: { fontSize: 12, color: Colors.ink3, lineHeight: 18 },
  waBtn: {
    minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: Colors.green + "8C",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16,
  },
  waBtnText: { fontSize: 14, fontWeight: "700", color: Colors.green },
  note: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  noteText: { flex: 1, fontSize: 12, color: Colors.ink3, lineHeight: 17 },
});
