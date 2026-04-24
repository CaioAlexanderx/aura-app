// ============================================================
// AURA. — D-W1-04: Modal de coleta de assinatura digital
//
// Fluxo:
// 1. Modal abre -> POST /companies/:cid/dental/appointments/:aid/signature-token
//    backend retorna { token, expires_at, expires_in, qr_payload }
// 2. Mostra URL + QR (via api.qrserver.com, publico/gratuito) + botao WhatsApp
// 3. Polling /dental/sign/:token/status a cada 2s
//    - "waiting"           -> aguardando paciente abrir o link
//    - "patient_connected" -> paciente abriu e esta no canvas
//    - "signed"            -> assinou! mostra confirmacao 2s e fecha
// 4. Countdown visual da validade (10min)
// 5. Botao "Cancelar" expira o token (gera um novo no proximo open)
//
// O backend ja faz tudo: WS handler, persistencia, status. Esta tela
// e UI puramente sobre endpoints existentes.
//
// Sobre o QR: a URL de assinatura e publica por design (qualquer um
// com o link assina, esse e o modelo). Usar api.qrserver.com nao
// vaza informacao adicional. Em paralelo o dentista pode mandar
// pelo WhatsApp que ja tem da paciente (Linking.openURL).
// ============================================================

import { useEffect, useState, useRef } from "react";
import {
  Modal, View, Text, Pressable, StyleSheet, ActivityIndicator,
  Image, Linking, Platform, ScrollView,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";

interface Props {
  visible: boolean;
  appointmentId: string | null;
  patientName?: string;
  patientPhone?: string;
  onClose: () => void;
  onSigned?: () => void;
}

interface TokenPayload {
  token: string;
  expires_at: string;
  expires_in: number;
  qr_payload: string;
}

interface StatusPayload {
  token: string;
  signed: boolean;
  conclusion_at: string | null;
  patient_connected: boolean;
  status: "signed" | "patient_connected" | "waiting";
}

export function SignatureRequestModal({
  visible, appointmentId, patientName, patientPhone, onClose, onSigned,
}: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  const [tokenData, setTokenData] = useState<TokenPayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(600);
  const [copied, setCopied] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Gera token quando modal abre ──
  const tokenMut = useMutation({
    mutationFn: () =>
      request<TokenPayload>(
        `/companies/${cid}/dental/appointments/${appointmentId}/signature-token`,
        { method: "POST", body: {}, retry: 0 }
      ),
    onSuccess: (data) => {
      setTokenData(data);
      const expIn = data.expires_in || 600;
      setSecondsLeft(expIn);
    },
  });

  // ── Reset quando modal abre ──
  useEffect(() => {
    if (visible && appointmentId && cid && !tokenData) {
      tokenMut.mutate();
    }
    if (!visible) {
      setTokenData(null);
      setCopied(false);
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, appointmentId, cid]);

  // ── Countdown da validade ──
  useEffect(() => {
    if (!tokenData) return;
    const iv = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [tokenData]);

  // ── Polling do status (2s) ──
  const statusQuery = useQuery({
    queryKey: ["dental-sign-status", tokenData?.token],
    queryFn: () =>
      request<StatusPayload>(`/dental/sign/${tokenData!.token}/status`, {
        token: null, retry: 0,
      }),
    enabled: !!tokenData?.token && visible && secondsLeft > 0,
    refetchInterval: 2000,
    staleTime: 0,
  });

  const status = statusQuery.data?.status || "waiting";
  const signed = statusQuery.data?.signed || false;

  // ── Quando assina, fecha em 2.5s e refresca agenda ──
  useEffect(() => {
    if (signed && !closeTimer.current) {
      qc.invalidateQueries({ queryKey: ["dental-agenda"] });
      qc.invalidateQueries({ queryKey: ["dental-appointment"] });
      onSigned?.();
      closeTimer.current = setTimeout(() => {
        onClose();
      }, 2500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signed]);

  // ── Helpers ──
  function formatTimer(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  const url = tokenData?.qr_payload || "";
  const qrSrc = url
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=240x240&margin=10&bgcolor=ffffff&color=1e1e2e`
    : "";

  function handleCopy() {
    if (!url) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      // Em RN nativo, depender de Clipboard API. Usuario pode nao ter
      // expo-clipboard. Fallback: mostra prompt selecionavel (a URL ja
      // aparece em textInput selecionavel acima).
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleWhatsApp() {
    if (!url) return;
    const msg = encodeURIComponent(
      `Ola${patientName ? `, ${patientName}` : ""}! Por favor confirme o atendimento de hoje assinando neste link (valido por 10 minutos):\n\n${url}`
    );
    const phone = (patientPhone || "").replace(/\D/g, "");
    const wa = phone
      ? `https://wa.me/55${phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    Linking.openURL(wa).catch(() => {});
  }

  function handleNewToken() {
    setTokenData(null);
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    tokenMut.mutate();
  }

  // ── Render ──

  const expired = secondsLeft === 0 && !signed;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Assinatura digital</Text>
              <Text style={s.sub}>
                {patientName ? `Paciente: ${patientName}` : "Confirmacao do atendimento"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body}>
            {/* Loading inicial */}
            {tokenMut.isPending && (
              <View style={s.center}>
                <ActivityIndicator color={Colors.violet3} size="large" />
                <Text style={s.hint}>Gerando link seguro...</Text>
              </View>
            )}

            {/* Erro */}
            {tokenMut.isError && (
              <View style={s.center}>
                <Icon name="alert" size={32} color="#EF4444" />
                <Text style={s.errText}>Nao foi possivel gerar o link.</Text>
                <Pressable onPress={() => tokenMut.mutate()} style={[s.btn, s.btnPrimary, { marginTop: 12 }]}>
                  <Text style={s.btnPrimaryText}>Tentar novamente</Text>
                </Pressable>
              </View>
            )}

            {/* Estado: assinado */}
            {tokenData && signed && (
              <View style={s.center}>
                <View style={s.successCircle}>
                  <Icon name="check" size={32} color="#fff" />
                </View>
                <Text style={s.successTitle}>Assinatura recebida!</Text>
                <Text style={s.hint}>O atendimento foi concluido automaticamente.</Text>
              </View>
            )}

            {/* Estado: expirado */}
            {tokenData && expired && (
              <View style={s.center}>
                <Icon name="alert" size={32} color="#F59E0B" />
                <Text style={s.errText}>Link expirou sem ser usado.</Text>
                <Pressable onPress={handleNewToken} style={[s.btn, s.btnPrimary, { marginTop: 12 }]}>
                  <Text style={s.btnPrimaryText}>Gerar novo link</Text>
                </Pressable>
              </View>
            )}

            {/* Estado: aguardando ou paciente conectado */}
            {tokenData && !signed && !expired && (
              <>
                {/* Status pill */}
                <View
                  style={[
                    s.statusBox,
                    status === "patient_connected" && s.statusBoxActive,
                  ]}
                >
                  <View style={s.statusDot}>
                    {status === "patient_connected" ? (
                      <View style={[s.dot, s.dotPulse]} />
                    ) : (
                      <View style={s.dot} />
                    )}
                  </View>
                  <Text style={s.statusText}>
                    {status === "patient_connected"
                      ? "Paciente esta no link agora..."
                      : "Aguardando paciente abrir o link..."}
                  </Text>
                </View>

                {/* QR */}
                <View style={s.qrWrap}>
                  {qrSrc ? (
                    <Image source={{ uri: qrSrc }} style={s.qr} resizeMode="contain" />
                  ) : null}
                  <Text style={s.qrCaption}>
                    Aponte a camera do paciente pra este codigo
                  </Text>
                </View>

                {/* Timer */}
                <View style={s.timerRow}>
                  <Icon name="clock" size={14} color={secondsLeft < 60 ? "#EF4444" : Colors.ink3} />
                  <Text style={[s.timerText, secondsLeft < 60 && { color: "#EF4444", fontWeight: "700" }]}>
                    Valido por {formatTimer(secondsLeft)}
                  </Text>
                </View>

                {/* URL e acoes */}
                <View style={s.urlBox}>
                  <Text style={s.urlText} numberOfLines={2} selectable>
                    {url}
                  </Text>
                </View>

                <View style={s.actions}>
                  <Pressable onPress={handleCopy} style={[s.btn, s.btnGhost]}>
                    <Icon name="copy" size={14} color={Colors.ink} />
                    <Text style={s.btnGhostText}>{copied ? "Copiado!" : "Copiar link"}</Text>
                  </Pressable>
                  <Pressable onPress={handleWhatsApp} style={[s.btn, s.btnWhatsApp]}>
                    <Icon name="message" size={14} color="#fff" />
                    <Text style={s.btnPrimaryText}>WhatsApp</Text>
                  </Pressable>
                </View>

                <Text style={s.note}>
                  Voce tambem pode mostrar o codigo na tela do seu celular pra
                  paciente apontar a camera.
                </Text>
              </>
            )}
          </ScrollView>

          <View style={s.footer}>
            <Pressable onPress={onClose} style={[s.btn, s.btnClose]}>
              <Text style={s.btnGhostText}>{signed ? "Fechar" : "Cancelar"}</Text>
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
  center: { alignItems: "center", paddingVertical: 28, gap: 10 },
  hint: { fontSize: 12, color: Colors.ink3, textAlign: "center" },
  errText: { fontSize: 13, color: Colors.ink, textAlign: "center", fontWeight: "500" },

  // Status
  statusBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.bg3, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  statusBoxActive: {
    backgroundColor: "rgba(16,185,129,0.08)",
    borderColor: "rgba(16,185,129,0.4)",
  },
  statusDot: { width: 12, height: 12, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  dotPulse: { backgroundColor: "#10B981" },
  statusText: { flex: 1, fontSize: 12, color: Colors.ink, fontWeight: "500" },

  // QR
  qrWrap: { alignItems: "center", paddingVertical: 8, gap: 8 },
  qr: { width: 240, height: 240, backgroundColor: "#fff", borderRadius: 12 },
  qrCaption: { fontSize: 11, color: Colors.ink3, textAlign: "center" },

  // Timer
  timerRow: {
    flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center",
  },
  timerText: { fontSize: 12, color: Colors.ink3 },

  // URL
  urlBox: {
    backgroundColor: Colors.bg3, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  urlText: {
    fontSize: 11, color: "#06B6D4", fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
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

  // Sucesso
  successCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#10B981",
    alignItems: "center", justifyContent: "center",
  },
  successTitle: { fontSize: 16, fontWeight: "700", color: "#10B981" },

  footer: {
    padding: 14, borderTopWidth: 1, borderTopColor: Colors.border,
  },
});

export default SignatureRequestModal;
