// ============================================================
// AURA STUDIO · Página pública /aprovacao/[token]
//
// Cliente recebe link via wa.me e abre aqui no navegador (sem auth).
// Vê mockup grande + dados do pedido + 2 botões:
//   ✓ Aprovar produção  → status=approved, KDS lojista avança auto
//   ✗ Pedir ajuste      → status=changes_requested, comentário fica no card
//
// Identidade visual mais sóbria que o app interno — é o cliente final
// que vê. Light theme + accent navy/magenta, sem bolinhas orgânicas.
// ============================================================
import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  Image, TextInput, Modal, Platform, Linking,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { studioApi, type PublicApproval } from "@/services/studioApi";

// F5: mockup pode ser um vídeo turntable (.webm/.mp4) gerado pelo motor 3D
function isVideoUrl(v?: string | null): boolean {
  if (!v) return false;
  const p = String(v).split("?")[0].toLowerCase();
  return p.endsWith(".webm") || p.endsWith(".mp4");
}

export default function AprovacaoPublica() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PublicApproval | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [askingChanges, setAskingChanges] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [result, setResult] = useState<{ ok: true; message: string; action: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    studioApi.getPublicApproval(String(token))
      .then((d) => setData(d))
      .catch((e: any) => setError(e?.message || "Link inválido ou expirado"))
      .finally(() => setLoading(false));
  }, [token]);

  async function approve() {
    if (!token) return;
    setSubmitting(true);
    try {
      const r = await studioApi.respondPublicApproval(String(token), { action: "approve" });
      setResult(r);
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar resposta");
    } finally { setSubmitting(false); }
  }

  async function requestChanges() {
    if (!token) return;
    if (!changeNote.trim()) {
      // permite enviar sem comentário, mas avisa
    }
    setSubmitting(true);
    try {
      const r = await studioApi.respondPublicApproval(String(token), {
        action: "request_changes",
        note: changeNote.trim() || undefined,
      });
      setAskingChanges(false);
      setResult(r);
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar resposta");
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <View style={s.bg}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#1E3A8A" />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={s.bg}>
        <View style={s.center}>
          <View style={s.errorCard}>
            <Icon name="alert-circle" size={32} color="#DC2626" />
            <Text style={s.errorTitle}>Link inválido ou expirado</Text>
            <Text style={s.errorSub}>{error || "Peça pra loja te enviar um novo link de aprovação."}</Text>
          </View>
        </View>
      </View>
    );
  }

  // Status final (já respondido)
  if (data.status !== "pending" || result) {
    const isApproved = (result?.action === "approve") || data.status === "approved";
    return (
      <View style={s.bg}>
        <ScrollView contentContainerStyle={s.containerSuccess}>
          <View style={s.shopHead}>
            <Text style={s.shopName}>{data.shop.name}</Text>
          </View>
          <View style={[s.successCard, !isApproved && { borderColor: "#F59E0B" }]}>
            <View style={[s.successIco, !isApproved && { backgroundColor: "#F59E0B" }]}>
              <Icon name={isApproved ? "check" : "edit"} size={36} color="#fff" />
            </View>
            <Text style={s.successTitle}>
              {isApproved ? "Aprovado! 🎉" : "Ajuste solicitado"}
            </Text>
            <Text style={s.successMsg}>
              {result?.message ||
                (isApproved
                  ? "A loja já foi notificada e vai começar a produzir."
                  : "A loja recebeu seu pedido de ajuste e vai te chamar.")}
            </Text>
            {data.mockup_url && (
              isVideoUrl(data.mockup_url) && Platform.OS === "web" ? (
                <>
                  {/* @ts-ignore — video DOM no web (mockup em vídeo turntable, Visual Engine F5) */}
                  <video src={data.mockup_url} controls autoPlay loop muted playsInline style={{ width: 160, maxWidth: 420, borderRadius: 12, marginTop: 18, display: "block" } as any} />
                </>
              ) : isVideoUrl(data.mockup_url) ? (
                <Pressable style={s.videoLink} onPress={() => Linking.openURL(String(data.mockup_url))}>
                  <Icon name="play" size={16} color="#fff" />
                  <Text style={s.videoLinkTxt}>Assistir vídeo</Text>
                </Pressable>
              ) : (
                <Image source={{ uri: data.mockup_url }} style={s.finalMockup} />
              )
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Modal de pedir ajuste
  return (
    <View style={s.bg}>
      <ScrollView contentContainerStyle={s.container}>
        {/* Header da loja */}
        <View style={s.shopHead}>
          <Text style={s.shopEyebrow}>APROVAÇÃO DE ARTE</Text>
          <Text style={s.shopName}>{data.shop.name}</Text>
        </View>

        {/* Pedido */}
        <View style={s.orderCard}>
          <Text style={s.orderEyebrow}>SEU PEDIDO</Text>
          <Text style={s.orderName}>Oi {data.order.customer_name?.split(" ")[0] || "cliente"}! 👋</Text>
          <Text style={s.orderSub}>Sua arte ficou pronta. Dá uma olhada e nos confirma se podemos imprimir.</Text>
          <View style={s.orderItems}>
            {data.order.items.map((it, i) => (
              <View key={i} style={s.orderItem}>
                <Text style={s.orderItemName}>{it.quantity}× {it.product_name}</Text>
                <Text style={s.orderItemPrice}>R$ {(it.unit_price * it.quantity).toFixed(2)}</Text>
              </View>
            ))}
            <View style={s.orderTotal}>
              <Text style={s.orderTotalLabel}>Total</Text>
              <Text style={s.orderTotalValue}>R$ {data.order.total_amount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Mockup grande */}
        <View style={s.mockupCard}>
          <Text style={s.mockupLabel}>SUA ARTE</Text>
          {isVideoUrl(data.mockup_url) && Platform.OS === "web" ? (
            <>
              {/* @ts-ignore — video DOM no web (mockup em vídeo turntable, Visual Engine F5) */}
              <video src={data.mockup_url} controls autoPlay loop muted playsInline style={{ width: "100%", maxWidth: 420, borderRadius: 12, display: "block", marginLeft: "auto", marginRight: "auto", backgroundColor: "#F8FAFC" } as any} />
            </>
          ) : isVideoUrl(data.mockup_url) ? (
            <Pressable style={[s.videoLink, { alignSelf: "center" }]} onPress={() => Linking.openURL(String(data.mockup_url))}>
              <Icon name="play" size={16} color="#fff" />
              <Text style={s.videoLinkTxt}>Assistir vídeo</Text>
            </Pressable>
          ) : (
            <Image source={{ uri: data.mockup_url }} style={s.mockupImg} resizeMode="contain" />
          )}
        </View>

        {/* Botões */}
        <View style={s.actions}>
          <Pressable
            style={[s.btnApprove, submitting && { opacity: 0.5 }]}
            onPress={approve}
            disabled={submitting}
          >
            <Icon name="check" size={20} color="#fff" />
            <Text style={s.btnApproveTxt}>Aprovar produção</Text>
          </Pressable>
          <Pressable
            style={[s.btnChanges, submitting && { opacity: 0.5 }]}
            onPress={() => setAskingChanges(true)}
            disabled={submitting}
          >
            <Icon name="edit" size={18} color="#92400E" />
            <Text style={s.btnChangesTxt}>Pedir ajuste</Text>
          </Pressable>
        </View>

        {/* Revisões anteriores */}
        {data.revisions.length > 1 && (
          <View style={s.revisionsCard}>
            <Text style={s.revisionsEyebrow}>HISTÓRICO</Text>
            {data.revisions.slice().reverse().map((r) => (
              <View key={r.revision_number} style={s.revisionRow}>
                <View style={[s.revisionDot, r.created_by_type === "shop"
                  ? { backgroundColor: "#1E3A8A" }
                  : { backgroundColor: "#F59E0B" }]}>
                  <Text style={s.revisionDotTxt}>v{r.revision_number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.revisionWho}>
                    {r.created_by_type === "shop" ? "Loja enviou" : "Você pediu ajuste"}
                  </Text>
                  {r.note && <Text style={s.revisionNote}>"{r.note}"</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={s.footer}>
          Link expira em {new Date(data.expires_at).toLocaleDateString("pt-BR")} · {data.shop.name}
        </Text>
      </ScrollView>

      {/* Modal pedir ajuste */}
      <Modal
        visible={askingChanges}
        animationType="fade"
        transparent
        onRequestClose={() => setAskingChanges(false)}
      >
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Conta pra loja o que ajustar 🎨</Text>
            <Text style={s.modalSub}>Quanto mais detalhe, mais rápido eles voltam com a versão certa.</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Ex: mudar a cor pra rosa · trocar a fonte por algo mais elegante · aumentar o tamanho do nome…"
              value={changeNote}
              onChangeText={setChangeNote}
              multiline
              autoFocus
            />
            <View style={s.modalActions}>
              <Pressable style={s.modalCancel} onPress={() => setAskingChanges(false)} disabled={submitting}>
                <Text style={s.modalCancelTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[s.modalSend, submitting && { opacity: 0.5 }]}
                onPress={requestChanges}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.modalSendTxt}>Enviar pra loja</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  container: { padding: 18, paddingBottom: 60, maxWidth: 540, alignSelf: "center", width: "100%" },
  containerSuccess: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, maxWidth: 480, alignSelf: "center", width: "100%" },

  shopHead: { alignItems: "center", marginBottom: 20, paddingTop: 24 },
  shopEyebrow: { fontSize: 11, color: "#EC4899", fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  shopName: { fontSize: 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.4, marginTop: 4 },

  orderCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0",
  },
  orderEyebrow: { fontSize: 10, color: "#64748B", fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  orderName: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginTop: 4 },
  orderSub: { fontSize: 13.5, color: "#475569", marginTop: 4, lineHeight: 19 },
  orderItems: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9", gap: 8 },
  orderItem: { flexDirection: "row", justifyContent: "space-between" },
  orderItemName: { fontSize: 13.5, color: "#334155", flex: 1 },
  orderItemPrice: { fontSize: 13.5, color: "#0F172A", fontWeight: "700" },
  orderTotal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  orderTotalLabel: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  orderTotalValue: { fontSize: 16, color: "#0F172A", fontWeight: "800" },

  mockupCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    marginBottom: 18, borderWidth: 1, borderColor: "#E2E8F0",
  },
  mockupLabel: { fontSize: 10, color: "#64748B", fontWeight: "700", letterSpacing: 0.5, marginBottom: 10, textAlign: "center" },
  mockupImg: { width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: "#F8FAFC" },

  // F5: fallback nativo pro mockup em vídeo (abre a URL no player externo)
  videoLink: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#1E3A8A", paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 10, marginTop: 18,
  },
  videoLinkTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },

  actions: { gap: 10, marginBottom: 20 },
  btnApprove: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#10B981", paddingVertical: 18, borderRadius: 14,
    shadowColor: "#10B981", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnApproveTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  btnChanges: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#FEF3C7", paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: "#FCD34D",
  },
  btnChangesTxt: { color: "#92400E", fontSize: 14, fontWeight: "700" },

  revisionsCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    marginTop: 12, borderWidth: 1, borderColor: "#E2E8F0", gap: 10,
  },
  revisionsEyebrow: { fontSize: 10, color: "#64748B", fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  revisionRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  revisionDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  revisionDotTxt: { fontSize: 10, color: "#fff", fontWeight: "800" },
  revisionWho: { fontSize: 12.5, color: "#0F172A", fontWeight: "700" },
  revisionNote: { fontSize: 12, color: "#64748B", marginTop: 2, fontStyle: "italic" },

  footer: { fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 20 },

  errorCard: { padding: 28, backgroundColor: "#fff", borderRadius: 16, alignItems: "center", maxWidth: 360 },
  errorTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginTop: 10 },
  errorSub: { fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 6, lineHeight: 19 },

  // Success
  successCard: {
    padding: 28, backgroundColor: "#fff", borderRadius: 18,
    alignItems: "center", borderWidth: 2, borderColor: "#10B981",
    maxWidth: 420,
  },
  successIco: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#10B981", alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  successTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
  successMsg: { fontSize: 14, color: "#475569", textAlign: "center", marginTop: 6, lineHeight: 20 },
  finalMockup: { width: 160, height: 160, borderRadius: 12, marginTop: 18, backgroundColor: "#F8FAFC" },

  // Modal
  modalBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#fff", borderRadius: 18, padding: 22, maxWidth: 480, alignSelf: "center", width: "100%" },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  modalSub: { fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 14 },
  modalInput: { backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 10, padding: 14, fontSize: 14, color: "#0F172A", minHeight: 100, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16, justifyContent: "flex-end" },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1.5, borderColor: "#CBD5E1", backgroundColor: "#fff" },
  modalCancelTxt: { color: "#475569", fontWeight: "600", fontSize: 13.5 },
  modalSend: { paddingVertical: 12, paddingHorizontal: 22, borderRadius: 10, backgroundColor: "#1E3A8A", minWidth: 140, alignItems: "center" },
  modalSendTxt: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
});
