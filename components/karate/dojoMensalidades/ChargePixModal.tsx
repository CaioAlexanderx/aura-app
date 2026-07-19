// ============================================================
// ChargePixModal — cobrar uma mensalidade por Pix (F3a)
//
// POST /charges/:id/pix devolve o copia-e-cola + o link público. A
// tela também busca o cadastro completo do aluno (F2, GET
// /dojo/students/:id) só para achar um TELEFONE pra sugerir no wa.me —
// o envelope de cobranças (GET /charges) não traz telefone. Igual ao
// padrão do crediário: nada é enviado sem o usuário tocar em "Abrir no
// WhatsApp"; telefone e mensagem são editáveis.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Pressable, ScrollView,
  ActivityIndicator, StyleSheet, Platform, Linking, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { karateDojoBillingApi, DojoCharge } from "@/services/karateDojoBillingApi";
import { karateDojoStudentsApi } from "@/services/karateDojoStudentsApi";
import { copyToClipboard } from "@/utils/clipboard";
import { maskPhone } from "@/utils/masks";
import { buildChargeWaMessage, buildWaUrl, mapBillingError } from "./helpers";

interface Props {
  visible: boolean;
  federationId: string;
  dojoName: string;
  charge: DojoCharge | null;
  onClose: () => void;
}

export function ChargePixModal({ visible, federationId, dojoName, charge, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [pixErr, setPixErr] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!visible || !charge) return;
    let alive = true;
    setLoading(true);
    setPixErr(null);
    setPayload(null);
    setPublicUrl(null);
    setPhone("");
    setCopiedCode(false);
    setCopiedLink(false);

    const isPayerStudent = !charge.guardian;
    const payerName = charge.guardian?.full_name ?? charge.student.full_name;

    Promise.allSettled([
      karateDojoBillingApi.getChargePix(federationId, charge.id),
      karateDojoStudentsApi.getStudent(federationId, charge.student.id),
    ]).then(([pixRes, studentRes]) => {
      if (!alive) return;

      let pixPayload: string | null = null;
      let pixLink: string | null = null;
      if (pixRes.status === "fulfilled") {
        pixPayload = pixRes.value.payload;
        pixLink = pixRes.value.public_url;
        setPayload(pixPayload);
        setPublicUrl(pixLink);
      } else {
        setPixErr(mapBillingError(pixRes.reason).message);
      }

      let suggestedPhone = "";
      if (studentRes.status === "fulfilled") {
        const s = studentRes.value;
        suggestedPhone = s.guardian?.phone || s.phone || "";
      }
      setPhone(suggestedPhone);

      setMessage(
        buildChargeWaMessage({
          dojoName,
          payerName,
          studentName: charge.student.full_name,
          isPayerStudent,
          competence: charge.competence,
          amount: charge.amount,
          dueDate: charge.due_date,
          status: charge.status,
          pixPayload,
          publicUrl: pixLink,
        })
      );
      setLoading(false);
    });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, charge, federationId, dojoName]);

  if (!charge) return null;

  const copyCode = async () => {
    if (!payload) return;
    const ok = await copyToClipboard(payload);
    if (ok) { setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2500); }
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    const ok = await copyToClipboard(publicUrl);
    if (ok) { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2500); }
  };

  const phoneDigits = phone.replace(/\D/g, "");
  const canSend = phoneDigits.length >= 10;

  const openWhats = () => {
    const url = buildWaUrl(phone, message);
    if (!url) return;
    if (Platform.OS === "web") window.open(url, "_blank");
    else Linking.openURL(url);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.card}>
          <View style={s.head}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <Icon name="qr_code" size={17} color={KarateColors.primary} />
              <Text style={s.title} numberOfLines={1}>Cobrar {charge.student.full_name} por Pix</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
            {loading && (
              <View style={s.stateBox}>
                <ActivityIndicator size="large" color={KarateColors.primary} />
              </View>
            )}

            {!loading && pixErr && (
              <View style={s.errBox}>
                <Icon name="alert" size={16} color={KarateColors.danger} />
                <Text style={s.errTxt}>{pixErr}</Text>
              </View>
            )}

            {!loading && payload && (
              <View>
                <Text style={s.lbl}>Pix copia e cola</Text>
                <Text style={s.payload} selectable numberOfLines={3}>{payload}</Text>
                <View style={s.btnRow}>
                  <TouchableOpacity style={s.copyBtn} onPress={copyCode} accessibilityRole="button">
                    <Icon name={copiedCode ? "check" : "copy"} size={14} color={copiedCode ? KarateColors.ok : KarateColors.primary} />
                    <Text style={[s.copyTxt, copiedCode && { color: KarateColors.ok }]}>{copiedCode ? "Copiado" : "Copiar código"}</Text>
                  </TouchableOpacity>
                  {!!publicUrl && (
                    <TouchableOpacity style={s.copyBtn} onPress={copyLink} accessibilityRole="button">
                      <Icon name={copiedLink ? "check" : "external_link"} size={14} color={copiedLink ? KarateColors.ok : KarateColors.primary} />
                      <Text style={[s.copyTxt, copiedLink && { color: KarateColors.ok }]}>{copiedLink ? "Copiado" : "Copiar link"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {!loading && (
              <View>
                <Text style={s.lbl}>Telefone (WhatsApp)</Text>
                <TextInput
                  style={s.input}
                  value={phone}
                  onChangeText={(v) => setPhone(maskPhone(v))}
                  keyboardType="phone-pad"
                  placeholder="DDD + número"
                  placeholderTextColor={KarateColors.ink4}
                  accessibilityLabel="Telefone do destinatário"
                />
                {!phoneDigits && <Text style={s.hint}>Sem telefone no cadastro — informe para enviar.</Text>}
              </View>
            )}

            {!loading && (
              <View>
                <Text style={s.lbl}>Mensagem</Text>
                <TextInput
                  style={[s.input, s.textarea]}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  textAlignVertical="top"
                  accessibilityLabel="Mensagem de cobrança"
                />
              </View>
            )}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity onPress={onClose} style={s.btnGhost} accessibilityRole="button">
              <Text style={s.btnGhostTxt}>Fechar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openWhats}
              disabled={!canSend || loading}
              style={[s.btnWa, (!canSend || loading) && { opacity: 0.5 }]}
              accessibilityRole="button"
            >
              <Icon name="whatsapp" size={16} color="#fff" />
              <Text style={s.btnWaTxt}>Abrir no WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { width: "100%", maxWidth: 520, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.xl, overflow: "hidden", borderWidth: 1, borderColor: KarateColors.border2, maxHeight: "92%" } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  title: { fontFamily: KarateFonts.heading, fontSize: 16, color: KarateColors.ink } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", paddingVertical: 30 } as ViewStyle,
  errBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: KarateColors.dangerSoft, borderRadius: KarateRadius.md, padding: 12 } as ViewStyle,
  errTxt: { flex: 1, fontSize: 12.5, color: KarateColors.danger, lineHeight: 18 } as TextStyle,
  lbl: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: KarateColors.ink2, marginBottom: 6, textTransform: "uppercase" } as TextStyle,
  payload: { fontSize: 12.5, color: KarateColors.ink, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, padding: 10, fontFamily: "monospace" } as TextStyle,
  btnRow: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" } as ViewStyle,
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 12 } as ViewStyle,
  copyTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 6, lineHeight: 15 } as TextStyle,
  input: { borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: KarateColors.ink, backgroundColor: KarateColors.glassHi } as TextStyle,
  textarea: { minHeight: 160, fontFamily: KarateFonts.body, lineHeight: 20 } as TextStyle,
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  btnGhost: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  btnWa: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 20, borderRadius: KarateRadius.md, backgroundColor: "#25D366", minWidth: 180, justifyContent: "center" } as ViewStyle,
  btnWaTxt: { fontSize: 13.5, fontWeight: "700", color: "#fff" } as TextStyle,
});
