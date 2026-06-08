// ============================================================
// CobrancaPreviewModal — preview editável de mensagem WA
// Entrega 3 (08/06/2026): permite revisar e editar a mensagem
// antes de abrir o WhatsApp. Reutilizável em crediario.tsx e
// cliente/[id].tsx.
// ============================================================
import { useState } from "react";
import {
  Modal, View, Text, Pressable, TextInput, StyleSheet,
  Platform, Linking, ScrollView,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

export type CobrancaPreviewProps = {
  visible: boolean;
  recipientName: string;
  phone: string;
  /** Rótulo do valor exibido no card (ex.: "R$ 150,00"). Omitir = sem card de valor. */
  valorLabel?: string;
  /** Descrição abaixo do valor (ex.: "Parcela 2/3 · vence 10/06"). */
  valorDesc?: string;
  /** Mensagem inicial preenchida na área de edição. */
  initialMessage: string;
  onClose: () => void;
};

export function CobrancaPreviewModal({
  visible,
  recipientName,
  phone,
  valorLabel,
  valorDesc,
  initialMessage,
  onClose,
}: CobrancaPreviewProps) {
  const [message, setMessage] = useState(initialMessage);

  // Reseta mensagem quando o modal abre com nova proposta
  // (useEffect alternativo: não importar useEffect, manter simples —
  //  o pai é responsável por passar initialMessage atualizado a cada abertura).

  const initial = (recipientName.trim()[0] || "?").toUpperCase();

  function handleSend() {
    const clean = phone.replace(/\D/g, "");
    const num = clean.startsWith("55") ? clean : `55${clean}`;
    Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(message)}`);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={cs.backdrop} onPress={onClose}>
        <Pressable style={cs.sheet} onPress={() => {}}>
          {/* Header: X */}
          <View style={cs.headerRow}>
            <Text style={cs.headerTitle}>Prévia da cobrança</Text>
            <Pressable onPress={onClose} style={cs.xBtn}>
              <Icon name="x" size={15} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Destinatário */}
            <View style={cs.recipientRow}>
              <View style={cs.avatar}>
                <Text style={cs.avatarTxt}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={cs.recipientName} numberOfLines={1}>{recipientName}</Text>
                <Text style={cs.recipientSub}>
                  <Text style={cs.waLabel}>WhatsApp</Text>
                  {" · "}{phone}
                </Text>
              </View>
            </View>

            {/* Card de valor (opcional) */}
            {!!valorLabel && (
              <View style={cs.valorCard}>
                <Text style={cs.valorLabel}>{valorLabel}</Text>
                {!!valorDesc && <Text style={cs.valorDesc}>{valorDesc}</Text>}
              </View>
            )}

            {/* Área de mensagem editável */}
            <Text style={cs.msgLabel}>MENSAGEM</Text>
            <TextInput
              style={cs.msgInput}
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
              placeholder="Digite a mensagem..."
              placeholderTextColor={Colors.ink3}
            />

            {/* Nota de envio manual */}
            <Text style={cs.note}>
              Envio segue manual pelo WhatsApp. Nada é enviado sem você tocar em Enviar.
            </Text>

            {/* Botões */}
            <View style={cs.btnRow}>
              <Pressable style={cs.cancelBtn} onPress={onClose}>
                <Text style={cs.cancelTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={cs.sendBtn} onPress={handleSend}>
                <Icon name="message_circle" size={15} color="#fff" />
                <Text style={cs.sendTxt}>Enviar pelo WhatsApp</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const cs = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...(Platform.OS === "web" ? { boxShadow: "0 8px 32px rgba(0,0,0,0.28)" } as any : {}),
    maxHeight: "90%" as any,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.ink,
  },
  xBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.bg4,
    alignItems: "center",
    justifyContent: "center",
  },

  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.violet3,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.ink,
  },
  recipientSub: {
    fontSize: 11,
    color: Colors.ink3,
    marginTop: 2,
  },
  waLabel: {
    color: "#25d366",
    fontWeight: "700",
  },

  valorCard: {
    backgroundColor: Colors.violetD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border2,
    marginBottom: 14,
    alignItems: "center",
  },
  valorLabel: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.violet3,
    letterSpacing: -0.5,
  },
  valorDesc: {
    fontSize: 12,
    color: Colors.ink3,
    marginTop: 4,
  },

  msgLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.ink3,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  msgInput: {
    backgroundColor: Colors.bg4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 13,
    color: Colors.ink,
    minHeight: 120,
    lineHeight: 20,
  },

  note: {
    fontSize: 11,
    color: Colors.ink3,
    marginTop: 10,
    lineHeight: 16,
  },

  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  cancelTxt: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.ink3,
  },
  sendBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#25d366",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  sendTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
