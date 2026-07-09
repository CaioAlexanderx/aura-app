import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { karateApi, TransferRecord } from "@/services/karateApi";
import { formatIsoToBr, maskBrDate, parseBrDate } from "@/components/inputs/DateInput";

interface Props {
  transfer: TransferRecord | null;
  onClose: () => void;
  federationId: string;
  practitionerId: string;
  onDone: () => void;
}

// Edita uma transferência registrada (motivo + data).
export function EditarTransferenciaModal({
  transfer, onClose, federationId, practitionerId, onDone,
}: Props) {
  const visible = !!transfer;
  const [reason, setReason] = useState("");
  const [dateBr, setDateBr] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!transfer) return;
    setReason(transfer.reason || "");
    setDateBr(transfer.transferred_at ? (formatIsoToBr(transfer.transferred_at) || "") : "");
    setErr(null); setSaving(false);
  }, [transfer]);

  const dateComplete = dateBr.length === 10;
  const dateIso = parseBrDate(dateBr);
  const dateBad = dateComplete && dateIso === null;

  async function handleSave() {
    if (!transfer) return;
    if (dateBad) { setErr("Data inválida. Use dd/mm/aaaa ou deixe em branco."); return; }
    setErr(null); setSaving(true);
    try {
      await karateApi.updateTransfer(federationId, practitionerId, transfer.id, {
        reason: reason.trim() || undefined,
        transferred_at: dateIso || undefined,
      });
      setSaving(false);
      onDone();
    } catch (e: any) {
      setSaving(false);
      setErr(e?.message || "Não foi possível salvar a transferência.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={gradStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={gradStyles.card}>
          <View style={gradStyles.head}>
            <Text style={gradStyles.title}>Editar transferência</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={gradStyles.label}>Data da transferência · dd/mm/aaaa <Text style={gradStyles.labelHint}>(vazio = mantém)</Text></Text>
            <TextInput
              style={[gradStyles.input, dateBad && gradStyles.inputBad]}
              value={dateBr}
              onChangeText={(v) => setDateBr(maskBrDate(v))}
              keyboardType="numeric"
              placeholder="dd/mm/aaaa"
              placeholderTextColor={KarateColors.ink4}
              maxLength={10}
              accessibilityLabel="Data da transferência"
            />
            {dateBad ? <Text style={gradStyles.errInline}>Data inválida</Text> : null}

            <Text style={gradStyles.label}>Motivo</Text>
            <TextInput
              style={[gradStyles.input, { fontFamily: undefined, letterSpacing: undefined, minHeight: 64, textAlignVertical: "top" }]}
              value={reason}
              onChangeText={setReason}
              placeholder="Motivo da transferência (opcional)"
              placeholderTextColor={KarateColors.ink4}
              multiline
              accessibilityLabel="Motivo da transferência"
            />

            {err ? (
              <View style={gradStyles.errBox}>
                <Icon name="alert_circle" size={15} color={KarateColors.primary} />
                <Text style={gradStyles.errTxt}>{err}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={gradStyles.footer}>
            <TouchableOpacity onPress={onClose} style={gradStyles.btnGhost}>
              <Text style={gradStyles.btnGhostTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={[gradStyles.btnPrimary, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={gradStyles.btnPrimaryTxt}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const gradStyles = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card:      { width: "100%", maxWidth: 520, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.xl, overflow: "hidden", borderWidth: 1, borderColor: KarateColors.border2, maxHeight: "92%" } as ViewStyle,
  head:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  title:     { fontFamily: KarateFonts.heading, fontSize: 18, color: KarateColors.ink } as TextStyle,
  label:     { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: KarateColors.ink2, marginTop: 4 } as TextStyle,
  labelHint: { fontWeight: "500", color: KarateColors.ink4 } as TextStyle,
  input:     { fontFamily: KarateFonts.mono, fontSize: 15, color: KarateColors.ink, backgroundColor: KarateColors.glassHi, borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, paddingHorizontal: 12, paddingVertical: 11, letterSpacing: 0.5 } as TextStyle,
  inputBad:  { borderColor: KarateColors.primary } as ViewStyle,
  errInline: { fontSize: 11, color: KarateColors.primary } as TextStyle,
  errBox:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine, borderRadius: 12, padding: 11 } as ViewStyle,
  errTxt:    { fontSize: 12.5, color: KarateColors.primary2, flex: 1 } as TextStyle,
  footer:    { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  btnGhost:  { paddingVertical: 11, paddingHorizontal: 18, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: KarateRadius.md, backgroundColor: KarateColors.ink, minWidth: 130, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
});

