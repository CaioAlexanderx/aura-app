// ============================================================
// AURA. — "Lembrar a Bianca": prévia do lembrete (C5, 26/11/2026)
//
// Mockup aprovado em 25/11 (tela 1, estado "Lembrete pelo WhatsApp"): a
// janela mostra para quem vai e o texto pronto; "Abrir o WhatsApp" abre o
// wa.me e a lojista envia. Nada é enviado pela Aura (R12): openWhatsApp é
// chamado dentro do clique, sem await antes (senão o navegador bloqueia).
// JanelaEmpilhada, nunca WebPortal (overlay preso no z-index do shell).
// ============================================================
import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { JanelaEmpilhada } from "@/components/JanelaEmpilhada";
import { openWhatsApp } from "@/utils/whatsapp";
import { formatarTelefone } from "@/utils/telefone";
import type { LinhaDaCondicional } from "@/hooks/useCondicionais";
import { TEXTOS_DA_LISTA as T, textoDoLembrete, tituloDoLembrete } from "./regrasDasCondicionais";

export function LembrarCondicional({ linha, onClose }: { linha: LinhaDaCondicional | null; onClose: () => void }) {
  if (!linha) return null;
  const texto = textoDoLembrete(linha);
  const abrir = () => {
    openWhatsApp(linha.customer_phone, texto);
    onClose();
  };
  return (
    <JanelaEmpilhada onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.fundo} onPress={onClose} accessibilityLabel={T.agoraNao} testID="lembrar-fundo" />
        <View style={[s.painel, painelWeb()]} testID="lembrar-condicional" accessibilityViewIsModal>
          <View style={s.cab}>
            <View style={s.cabIcone}><Icon name="whatsapp" size={18} color={Colors.green} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.titulo}>{tituloDoLembrete(linha.customer_name)}</Text>
              <Text style={s.sub}>{T.lembrarSub}</Text>
            </View>
            <Pressable onPress={onClose} style={s.fechar} accessibilityRole="button" accessibilityLabel="Fechar" testID="lembrar-fechar">
              <Icon name="x" size={16} color={Colors.ink3} />
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.corpo}>
            <View style={s.wa}>
              <Text style={s.para}>
                Para <Text style={s.paraNome}>{linha.customer_name || ""}</Text>
                {linha.customer_phone ? " · " + formatarTelefone(linha.customer_phone) : ""}
              </Text>
              <Text style={s.bolha} testID="lembrar-texto">{texto}</Text>
            </View>
          </ScrollView>
          <View style={s.rodape}>
            <Button title={T.agoraNao} variant="ghost" onPress={onClose} style={s.botao} testID="lembrar-agora-nao" />
            <Button title={T.abrirWhatsapp} icon="whatsapp" variant="primary" onPress={abrir} style={s.botao} testID="lembrar-abrir" />
          </View>
        </View>
      </View>
    </JanelaEmpilhada>
  );
}

function painelWeb(): any {
  if (typeof document === "undefined") return { backgroundColor: Colors.bg3 };
  return {
    backgroundColor: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
  };
}

const s = StyleSheet.create({
  overlay: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 16 },
  fundo: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  painel: { width: "100%", maxWidth: 480, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  cab: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cabIcone: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 17, color: Colors.ink, fontWeight: "700" },
  sub: { fontSize: 12.5, color: Colors.ink3, marginTop: 2 },
  fechar: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  corpo: { paddingHorizontal: 18, paddingVertical: 16 },
  wa: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg4, padding: 12, gap: 10 },
  para: { fontSize: 12.5, color: Colors.ink2 },
  paraNome: { fontWeight: "700", color: Colors.ink },
  bolha: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.greenD, borderRadius: 14, borderTopLeftRadius: 4,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, lineHeight: 20, color: Colors.ink,
  },
  rodape: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  botao: { minHeight: 44, flexGrow: 1, flexBasis: 140 },
});

export default LembrarCondicional;
