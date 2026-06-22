// ============================================================
// RecusarModal — Track J (Certificados)
//
// Modal de recusa de pedido (com motivo). Reskin Shoji; mesmo
// comportamento e props da versão inline original.
// ============================================================
import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, TextInput, Modal, StyleSheet,
} from "react-native";
import { KarateColors as C } from "@/constants/karateTheme";
import { cs } from "./shared";

export function RecusarModal({
  visible, subtitle, onClose, onConfirm,
}: { visible: boolean; subtitle: string; onClose: () => void; onConfirm: (reason: string) => void; }) {
  const [motivo, setMotivo] = useState("");
  useEffect(() => { if (!visible) setMotivo(""); }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={cs.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={cs.recusarCard}>
          <Text style={cs.recusarTitle}>Recusar pedido</Text>
          <Text style={cs.recusarSub}>{subtitle}</Text>
          <Text style={cs.fieldLabel}>Motivo</Text>
          <TextInput
            style={[cs.field, { minHeight: 80, textAlignVertical: "top" }]}
            value={motivo}
            onChangeText={setMotivo}
            placeholder="Ex.: Nome divergente do RG — reenviar com a grafia correta."
            placeholderTextColor={C.ink4}
            multiline
          />
          <Text style={cs.recusarHint}>O dojô recebe o motivo por e-mail e pode reenviar o pedido.</Text>
          <View style={cs.recusarFooter}>
            <TouchableOpacity style={cs.btnGhost} onPress={onClose}>
              <Text style={cs.btnGhostText}>Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cs.btnDanger} onPress={() => onConfirm(motivo.trim() || "Pedido recusado.")}>
              <Text style={cs.btnDangerText}>Confirmar recusa</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
