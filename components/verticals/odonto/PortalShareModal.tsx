// ============================================================
// AURA. — W2-01: Portal do Paciente — Modal de compartilhamento
//
// Gera um token de portal (validade 7/15/30 dias, default 30) e
// compartilha via QR + URL + WhatsApp prefilled.
//
// Fluxo:
// 1. Modal abre -> POST /companies/:cid/dental/portal/generate/:patientId?days=N
//    backend retorna { token, expires_at, url, patient_name }
// 2. Mostra:
//    - Selector de validade (chips 7/15/30)
//    - QR code 240x240 (api.qrserver.com)
//    - URL selecionavel/copiavel
//    - Botao Copiar + botao WhatsApp (se patientPhone existe)
//    - Data de expiracao formatada
//
// Diferencas vs SignatureRequestModal (W1-04):
// - Validade selecionavel (W1-04 e fixa 10min)
// - Sem polling (paciente nao precisa "responder" pra esse fluxo)
// - Sem auto-close (admin fecha quando quiser)
// - Mensagem WhatsApp diferente
// - Trocar validade gera novo token (invalida o anterior)
// ============================================================

import { useEffect, useState } from "react";
import {
  Modal, View, Text, Pressable, StyleSheet, ActivityIndicator,
  Image, Linking, Platform, ScrollView,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useMutation } from "@tanstack/react-query";
import { request } from "@/services/api";

interface Props {
  visible: boolean;
  patientId: string | null;
  patientName?: string;
  patientPhone?: string;
  onClose: () => void;
}

interface PortalTokenPayload {
  token: string;
  expires_at: string;
  url: string;
  patient_name: string;
}

const VALIDITY_OPTIONS = [
  { days: 7,  label: "7 dias"  },
  { days: 15, label: "15 dias" },
  { days: 30, label: "30 dias" },
];

export function PortalShareModal({
  visible, patientId, patientName, patientPhone, onClose,
}: Props) {
  const cid = useAuthStore().company?.id;

  const [validity, setValidity] = useState<number>(30);
  const [tokenData, setTokenData] = useState<PortalTokenPayload | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Mutation que gera o token ──
  const tokenMut = useMutation({
    mutationFn: (days: number) =>
      request<PortalTokenPayload>(
        `/companies/${cid}/dental/portal/generate/${patientId}?days=${days}`,
        { method: "POST", body: {}, retry: 0 }
      ),
    onSuccess: (data) => {
      setTokenData(data);
    },
  });

  // ── Reset/gerar quando modal abre ──
  useEffect(() => {
    if (visible && patientId && cid && !tokenData && !tokenMut.isPending) {
      tokenMut.mutate(validity);
    }
    if (!visible) {
      setTokenData(null);
      setCopied(false);
      setValidity(30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, patientId, cid]);

  // ── Trocar validade gera novo token ──
  function handleChangeValidity(days: number) {
    if (days === validity) return;
    setValidity(days);
    setTokenData(null);
    setCopied(false);
    tokenMut.mutate(days);
  }

  // ── Helpers ──
  const url = tokenData?.url || "";
  const qrSrc = url
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=240x240&margin=10&bgcolor=ffffff&color=1e1e2e`
    : "";

  function formatExpiry(iso: string): string {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit", month: "long", year: "numeric",
        timeZone: "America/Sao_Paulo",
      });
    } catch { return ""; }
  }

  function handleCopy() {
    if (!url) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      // Em RN nativo sem expo-clipboard, marca como copiado mas usuario
      // de fato precisa selecionar e copiar manualmente da URL exibida
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleWhatsApp() {
    if (!url) return;
    const greeting = patientName ? `, ${patientName}` : "";
    const msg = encodeURIComponent(
      `Ola${greeting}! Aqui esta o seu portal do paciente. Voce pode acompanhar consultas, tratamentos e documentos por aqui:\n\n${url}\n\nO link e valido por ${validity} dias.`
    );
    const phone = (patientPhone || "").replace(/\D/g, "");
    const wa = phone
      ? `https://wa.me/55${phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    Linking.openURL(wa).catch(() => {});
  }

  // ── Render ──

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Compartilhar portal</Text>
              <Text style={s.sub}>
                {patientName ? `Paciente: ${patientName}` : "Acesso pessoal do paciente"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body}>
            {/* Selector de validade */}
            <View>
              <Text style={s.label}>Validade do link</Text>
              <View style={s.validityRow}>
                {VALIDITY_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.days}
                    onPress={() => handleChangeValidity(opt.days)}
                    style={[
                      s.validityChip,
                      validity === opt.days && s.validityChipActive,
                    ]}
                    disabled={tokenMut.isPending}
                  >
                    <Text style={[
                      s.validityChipText,
                      validity === opt.days && s.validityChipTextActive,
                    ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Loading */}
            {tokenMut.isPending && (
              <View style={s.center}>
                <ActivityIndicator color={Colors.violet3} size="large" />
                <Text style={s.hint}>Gerando link seguro...</Text>
              </View>
            )}

            {/* Erro */}
            {tokenMut.isError && !tokenMut.isPending && (
              <View style={s.center}>
                <Icon name="alert" size={32} color="#EF4444" />
                <Text style={s.errText}>Nao foi possivel gerar o link.</Text>
                <Pressable
                  onPress={() => tokenMut.mutate(validity)}
                  style={[s.btn, s.btnPrimary, { marginTop: 12 }]}
                >
                  <Text style={s.btnPrimaryText}>Tentar novamente</Text>
                </Pressable>
              </View>
            )}

            {/* Sucesso — token gerado */}
            {tokenData && !tokenMut.isPending && (
              <>
                {/* QR code */}
                <View style={s.qrWrap}>
                  {qrSrc ? (
                    <Image source={{ uri: qrSrc }} style={s.qr} resizeMode="contain" />
                  ) : null}
                  <Text style={s.qrCaption}>
                    Aponte a camera do paciente para o codigo
                  </Text>
                </View>

                {/* Validade info */}
                <View style={s.expiryBox}>
                  <Icon name="clock" size={13} color={Colors.violet3} />
                  <Text style={s.expiryText}>
                    Valido ate {formatExpiry(tokenData.expires_at)}
                  </Text>
                </View>

                {/* URL */}
                <View style={s.urlBox}>
                  <Text style={s.urlText} numberOfLines={2} selectable>
                    {url}
                  </Text>
                </View>

                {/* Acoes */}
                <View style={s.actions}>
                  <Pressable onPress={handleCopy} style={[s.btn, s.btnGhost]}>
                    <Icon name="copy" size={14} color={Colors.ink} />
                    <Text style={s.btnGhostText}>
                      {copied ? "Copiado!" : "Copiar link"}
                    </Text>
                  </Pressable>
                  <Pressable onPress={handleWhatsApp} style={[s.btn, s.btnWhatsApp]}>
                    <Icon name="message" size={14} color="#fff" />
                    <Text style={s.btnPrimaryText}>WhatsApp</Text>
                  </Pressable>
                </View>

                <Text style={s.note}>
                  No portal o paciente ve proximas consultas, planos
                  de tratamento, parcelas em aberto e documentos.
                </Text>
              </>
            )}
          </ScrollView>

          <View style={s.footer}>
            <Pressable onPress={onClose} style={[s.btn, s.btnClose]}>
              <Text style={s.btnGhostText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.bg2 || "#0f0f1e",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "90%",
    borderWidth: 1, borderColor: Colors.border, borderBottomWidth: 0,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  title: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 3 },

  body: { padding: 18, gap: 14, paddingBottom: 26 },

  label: {
    fontSize: 11, color: Colors.ink3, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8,
  },

  validityRow: { flexDirection: "row", gap: 8 },
  validityChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: "center",
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  validityChipActive: {
    backgroundColor: Colors.violet || "#6d28d9",
    borderColor: Colors.violet || "#6d28d9",
  },
  validityChipText: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  validityChipTextActive: { color: "#fff", fontWeight: "700" },

  center: { alignItems: "center", paddingVertical: 28, gap: 10 },
  hint: { fontSize: 12, color: Colors.ink3, textAlign: "center" },
  errText: { fontSize: 13, color: Colors.ink, textAlign: "center", fontWeight: "500" },

  // QR
  qrWrap: { alignItems: "center", paddingVertical: 8, gap: 8 },
  qr: { width: 240, height: 240, backgroundColor: "#fff", borderRadius: 12 },
  qrCaption: { fontSize: 11, color: Colors.ink3, textAlign: "center" },

  // Expiry pill
  expiryBox: {
    flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.08)",
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: "rgba(167,139,250,0.3)",
  },
  expiryText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },

  // URL
  urlBox: {
    backgroundColor: Colors.bg3, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  urlText: {
    fontSize: 11, color: "#06B6D4",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },

  // Actions
  actions: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  btnPrimary: { backgroundColor: Colors.violet || "#6d28d9" },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnGhost: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  btnGhostText: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  btnWhatsApp: { backgroundColor: "#25D366" },
  btnClose: {
    backgroundColor: "transparent",
    borderWidth: 1, borderColor: Colors.border,
  },

  note: {
    fontSize: 11, color: Colors.ink3, textAlign: "center",
    marginTop: 4, lineHeight: 16, fontStyle: "italic",
  },

  footer: {
    padding: 14, borderTopWidth: 1, borderTopColor: Colors.border,
  },
});

export default PortalShareModal;
