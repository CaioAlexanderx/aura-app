// WhatsAppChargeModal — cobrança manual de anuidade via wa.me (Dojô e CPF).
// Monta uma mensagem editável (nome, competência, valor, vencimento/status +
// PIX copia-e-cola) e abre o WhatsApp do destinatário (telefone editável).
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Pressable,
  ActivityIndicator, StyleSheet, Platform, Linking, ScrollView,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { karateApi, AnnuityStatus } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

function fmtBRL(n: number): string {
  return "R$ " + (Number(n) || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function fmtDateBR(iso?: string | null): string {
  if (!iso) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00") : new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function statusSuffix(status: AnnuityStatus, dueIso?: string | null): string {
  if (status === "paid") return " (paga)";
  if (status === "due" || status === "no_charge") return " (a vencer)";
  // vencida — calcula dias
  if (dueIso) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(dueIso) ? new Date(dueIso + "T12:00:00") : new Date(dueIso);
    if (!isNaN(d.getTime())) {
      const days = Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
      return days > 0 ? ` (vencida há ${days} dia${days > 1 ? "s" : ""})` : " (vencida)";
    }
  }
  return " (vencida)";
}

export interface WhatsAppChargeTarget {
  name: string;
  phone?: string | null;
  amount: number;
  reference_period: string;
  due_date?: string | null;
  status: AnnuityStatus;
}

export function WhatsAppChargeModal({ visible, onClose, federationId, target }: {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  target: WhatsAppChargeTarget | null;
}) {
  const { federationName } = useKarateFederation();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [pix, setPix] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const buildMessage = (payload: string | null): string => {
    if (!target) return "";
    const fed = federationName || "a federação";
    const linhaPix = payload
      ? `\n\nPague via PIX (copia e cola):\n${payload}`
      : "";
    return (
      `Olá, ${target.name}!\n` +
      `Aqui é a ${fed}.\n\n` +
      `Lembrete da sua anuidade:\n` +
      `• Competência: ${target.reference_period}\n` +
      `• Valor: ${fmtBRL(target.amount)}\n` +
      `• Vencimento: ${fmtDateBR(target.due_date)}${statusSuffix(target.status, target.due_date)}` +
      linhaPix +
      `\n\nQualquer dúvida, é só responder por aqui. Obrigado!`
    );
  };

  useEffect(() => {
    if (!visible || !target) return;
    setPhone(target.phone || "");
    setErr(null);
    setPix(null);
    setMessage(buildMessage(null));
    // busca o copia-e-cola e recompõe a mensagem
    let alive = true;
    if (target.amount > 0) {
      setLoading(true);
      karateApi.pixBrcode(federationId, target.amount)
        .then((r) => { if (alive) { setPix(r.payload || null); setMessage(buildMessage(r.payload || null)); } })
        .catch(() => { if (alive) setErr("Não foi possível gerar o PIX; a mensagem segue sem o código."); })
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, target]);

  const phoneDigits = phone.replace(/\D/g, "");
  const canSend = phoneDigits.length >= 10;

  const openWhats = () => {
    const full = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;
    const url = `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
    if (Platform.OS === "web") window.open(url, "_blank");
    else Linking.openURL(url);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.card}>
          <View style={s.head}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="logo-whatsapp" size={18} color="#25D366" />
              <Text style={s.title}>Cobrar via WhatsApp</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Icon name="close" size={20} color={P.ink3} /></TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <View>
              <Text style={s.lbl}>Telefone (WhatsApp)</Text>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="DDD + número"
                placeholderTextColor={P.ink4}
                accessibilityLabel="Telefone do destinatário"
              />
              {!target?.phone ? <Text style={s.hint}>Sem telefone no cadastro — informe para enviar.</Text> : null}
            </View>

            <View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={s.lbl}>Mensagem</Text>
                {loading ? <ActivityIndicator size="small" color={P.primary} /> : null}
              </View>
              <TextInput
                style={[s.input, s.textarea]}
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Mensagem de cobrança"
              />
              {err ? <Text style={s.err}>{err}</Text> : null}
              {pix ? <Text style={s.hint}>PIX copia-e-cola incluído na mensagem.</Text> : null}
            </View>
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity onPress={onClose} style={s.btnGhost}><Text style={s.btnGhostTxt}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity onPress={openWhats} disabled={!canSend} style={[s.btnWa, !canSend && { opacity: 0.5 }]} accessibilityRole="button">
              <Icon name="logo-whatsapp" size={16} color="#fff" />
              <Text style={s.btnWaTxt}>Abrir no WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 },
  card: { width: "100%", maxWidth: 520, backgroundColor: P.surface, borderRadius: KarateRadius.xl, overflow: "hidden", borderWidth: 1, borderColor: P.border2, maxHeight: "92%" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: P.border, backgroundColor: P.glassHi },
  title: { fontFamily: KarateFonts.heading, fontSize: 17, color: P.ink },
  lbl: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 6, textTransform: "uppercase" },
  hint: { fontSize: 11.5, color: P.ink3, marginTop: 6, lineHeight: 15 },
  err: { fontSize: 12, color: P.danger, marginTop: 6 },
  input: { borderWidth: 1, borderColor: P.border2, borderRadius: KarateRadius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: P.ink, backgroundColor: P.glassHi },
  textarea: { minHeight: 180, fontFamily: KarateFonts.body, lineHeight: 20 },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: P.border, backgroundColor: P.glassHi },
  btnGhost: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: P.border2 },
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: P.ink },
  btnWa: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 20, borderRadius: KarateRadius.md, backgroundColor: "#25D366", minWidth: 180, justifyContent: "center" },
  btnWaTxt: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
});

export default WhatsAppChargeModal;
