// ============================================================
// AURA STUDIO · Página pública /orcamento/[token]
//
// Cliente recebe link via wa.me e abre aqui no navegador (sem auth).
// Espelha app/aprovacao/[token].tsx — mesma identidade visual navy/magenta.
//
// Exibe:
//   - Nome da loja + dados do cliente
//   - Lista de itens com preços
//   - Subtotal / desconto / total
//   - Sinal (se deposit_pct configurado)
//   - Status: aceite / recusa / expirado
//   - Botões: "Aceitar orçamento" + "Recusar"
// ============================================================
import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, TextInput, Modal, Linking,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { studioApi, type PublicQuote } from "@/services/studioApi";

export default function OrcamentoPublico() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading,   setLoading]   = useState(true);
  const [data,      setData]      = useState<PublicQuote | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [askReject,  setAskReject]  = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [result,     setResult]    = useState<{ ok: true; message: string; action: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    studioApi.getPublicQuote(String(token))
      .then((d) => setData(d))
      .catch((e: any) => setError(e?.message || "Link inválido ou expirado"))
      .finally(() => setLoading(false));
  }, [token]);

  async function accept() {
    if (!token) return;
    setSubmitting(true);
    try {
      const r = await studioApi.respondPublicQuote(String(token), { action: "accept" });
      setResult(r);
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar resposta");
    } finally { setSubmitting(false); }
  }

  async function reject() {
    if (!token) return;
    setSubmitting(true);
    try {
      const r = await studioApi.respondPublicQuote(String(token), {
        action: "reject",
        note:   rejectNote.trim() || undefined,
      });
      setAskReject(false);
      setResult(r);
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar resposta");
    } finally { setSubmitting(false); }
  }

  const fmtCurrency = (v: number) =>
    "R$ " + (v || 0).toFixed(2).replace(".", ",");

  // ─── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.bg}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#1E3A8A" />
        </View>
      </View>
    );
  }

  // ─── Erro / link inválido ────────────────────────────────────
  if (error || !data) {
    return (
      <View style={s.bg}>
        <View style={s.center}>
          <View style={s.errorCard}>
            <Icon name="alert-circle" size={32} color="#DC2626" />
            <Text style={s.errorTitle}>Link inválido ou expirado</Text>
            <Text style={s.errorSub}>{error || "Peça à loja para enviar um novo orçamento."}</Text>
          </View>
        </View>
      </View>
    );
  }

  // ─── Expirado ────────────────────────────────────────────────
  if (data.status === "expired") {
    return (
      <View style={s.bg}>
        <ScrollView contentContainerStyle={s.containerSuccess}>
          <View style={s.shopHead}>
            <Text style={s.shopName}>{data.shop.name}</Text>
          </View>
          <View style={[s.resultCard, { borderColor: "#F97316" }]}>
            <View style={[s.resultIco, { backgroundColor: "#F97316" }]}>
              <Icon name="clock" size={32} color="#fff" />
            </View>
            <Text style={s.resultTitle}>Orçamento expirado</Text>
            <Text style={s.resultMsg}>
              Este orçamento não está mais disponível. Entre em contato com a loja para solicitar um novo.
            </Text>
            {/* wa.me da loja se tiver telefone do cliente */}
            <Pressable
              style={[s.btnAccept, { backgroundColor: "#F97316", marginTop: 16 }]}
              onPress={() => Linking.openURL(`https://wa.me/`)}
            >
              <Icon name="message-circle" size={18} color="#fff" />
              <Text style={s.btnAcceptTxt}>Falar com a loja</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Já respondido ───────────────────────────────────────────
  if ((data.status !== "sent") || result) {
    const isAccepted = result?.action === "accept" || data.status === "accepted";
    return (
      <View style={s.bg}>
        <ScrollView contentContainerStyle={s.containerSuccess}>
          <View style={s.shopHead}>
            <Text style={s.shopName}>{data.shop.name}</Text>
          </View>
          <View style={[s.resultCard, { borderColor: isAccepted ? "#10B981" : "#94A3B8" }]}>
            <View style={[s.resultIco, { backgroundColor: isAccepted ? "#10B981" : "#64748B" }]}>
              <Icon name={isAccepted ? "check" : "x"} size={32} color="#fff" />
            </View>
            <Text style={s.resultTitle}>
              {isAccepted ? "Orçamento aceito!" : "Orçamento recusado"}
            </Text>
            <Text style={s.resultMsg}>
              {result?.message ||
                (isAccepted
                  ? "A loja foi notificada e vai entrar em contato para confirmar os próximos passos."
                  : "A loja foi informada da sua recusa.")}
            </Text>
            {isAccepted && data.deposit_pct && data.deposit_amount ? (
              <View style={s.depositBox}>
                <Icon name="credit-card" size={18} color="#1E3A8A" />
                <Text style={s.depositTxt}>
                  Sinal de {data.deposit_pct}% ({fmtCurrency(data.deposit_amount)}) necessário para iniciar a produção.
                  A loja vai te informar como pagar.
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Tela principal: orçamento aberto ────────────────────────
  return (
    <View style={s.bg}>
      <ScrollView contentContainerStyle={s.container}>
        {/* Header da loja */}
        <View style={s.shopHead}>
          <Text style={s.shopEyebrow}>ORÇAMENTO</Text>
          <Text style={s.shopName}>{data.shop.name}</Text>
        </View>

        {/* Dados do cliente */}
        {data.customer_name && (
          <View style={s.customerCard}>
            <Text style={s.customerLabel}>OLÁ</Text>
            <Text style={s.customerName}>{data.customer_name.split(" ")[0]}! 👋</Text>
            <Text style={s.customerSub}>
              Segue seu orçamento. Confira os itens e o valor total e nos confirme se deseja prosseguir.
            </Text>
          </View>
        )}

        {/* Itens */}
        <View style={s.itemsCard}>
          <Text style={s.itemsLabel}>ITENS DO ORÇAMENTO</Text>
          {data.items.map((it, i) => (
            <View key={i} style={s.itemRow}>
              <Text style={s.itemName} numberOfLines={2}>
                {it.quantity !== 1 ? `${it.quantity}× ` : ""}{it.description}
              </Text>
              <Text style={s.itemPrice}>
                {fmtCurrency(it.unit_price * it.quantity)}
              </Text>
            </View>
          ))}

          {/* Totais */}
          <View style={s.divider} />
          {data.discount > 0 && (
            <>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Subtotal</Text>
                <Text style={s.totalVal}>{fmtCurrency(data.subtotal)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Desconto</Text>
                <Text style={[s.totalVal, { color: "#10B981" }]}>
                  − {fmtCurrency(data.discount)}
                </Text>
              </View>
            </>
          )}
          <View style={s.totalRow}>
            <Text style={s.totalFinalLabel}>Total</Text>
            <Text style={s.totalFinalVal}>{fmtCurrency(data.total)}</Text>
          </View>

          {/* Sinal */}
          {data.deposit_pct && data.deposit_amount ? (
            <View style={s.depositBox}>
              <Icon name="credit-card" size={18} color="#1E3A8A" />
              <Text style={s.depositTxt}>
                Sinal de {data.deposit_pct}% ({fmtCurrency(data.deposit_amount)}) necessário para iniciar a produção.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Validade */}
        <Text style={s.validityNote}>
          Orçamento válido até{" "}
          {new Date(data.expires_at).toLocaleDateString("pt-BR")} · {data.shop.name}
        </Text>

        {/* Botões de ação */}
        <View style={s.actions}>
          <Pressable
            style={[s.btnAccept, submitting && s.btnDisabled]}
            onPress={accept}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Icon name="check" size={20} color="#fff" /><Text style={s.btnAcceptTxt}>Aceitar orçamento</Text></>}
          </Pressable>

          <Pressable
            style={[s.btnReject, submitting && s.btnDisabled]}
            onPress={() => setAskReject(true)}
            disabled={submitting}
          >
            <Text style={s.btnRejectTxt}>Recusar</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modal de recusa */}
      <Modal
        visible={askReject}
        animationType="fade"
        transparent
        onRequestClose={() => setAskReject(false)}
      >
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Recusar orçamento</Text>
            <Text style={s.modalSub}>Opcional: deixe um comentário para a loja.</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Ex: Encontrei outra opção · Prazo não atende…"
              value={rejectNote}
              onChangeText={setRejectNote}
              multiline
              autoFocus
            />
            <View style={s.modalActions}>
              <Pressable
                style={s.modalCancel}
                onPress={() => setAskReject(false)}
                disabled={submitting}
              >
                <Text style={s.modalCancelTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[s.modalReject, submitting && s.btnDisabled]}
                onPress={reject}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.modalRejectTxt}>Confirmar recusa</Text>}
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

  customerCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0",
  },
  customerLabel: { fontSize: 10, color: "#64748B", fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  customerName: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginTop: 4 },
  customerSub: { fontSize: 13.5, color: "#475569", marginTop: 4, lineHeight: 19 },

  itemsCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0",
    gap: 10,
  },
  itemsLabel: { fontSize: 10, color: "#64748B", fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  itemName: { fontSize: 13.5, color: "#334155", flex: 1 },
  itemPrice: { fontSize: 13.5, color: "#0F172A", fontWeight: "700" },

  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 13, color: "#64748B" },
  totalVal: { fontSize: 13, color: "#0F172A", fontWeight: "600" },
  totalFinalLabel: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  totalFinalVal: { fontSize: 18, fontWeight: "800", color: "#1E3A8A" },

  depositBox: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, marginTop: 8,
  },
  depositTxt: { flex: 1, fontSize: 13, color: "#1E3A8A", lineHeight: 18 },

  validityNote: { fontSize: 11, color: "#94A3B8", textAlign: "center", marginBottom: 16 },

  actions: { gap: 10 },
  btnAccept: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#1E3A8A", paddingVertical: 18, borderRadius: 14,
    shadowColor: "#1E3A8A", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnAcceptTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  btnReject: {
    alignItems: "center", paddingVertical: 14,
  },
  btnRejectTxt: { color: "#DC2626", fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  btnDisabled: { opacity: 0.5 },

  // Resultado
  resultCard: {
    padding: 28, backgroundColor: "#fff", borderRadius: 18,
    alignItems: "center", borderWidth: 2, maxWidth: 420,
    width: "100%", gap: 10,
  },
  resultIco: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  resultTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
  resultMsg: { fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 20 },

  // Erro
  errorCard: { padding: 28, backgroundColor: "#fff", borderRadius: 16, alignItems: "center", maxWidth: 360 },
  errorTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginTop: 10 },
  errorSub: { fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 6, lineHeight: 19 },

  // Modal
  modalBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#fff", borderRadius: 18, padding: 22, maxWidth: 480, alignSelf: "center", width: "100%" },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  modalSub: { fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 14 },
  modalInput: {
    backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#CBD5E1",
    borderRadius: 10, padding: 14, fontSize: 14, color: "#0F172A",
    minHeight: 80, textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16, justifyContent: "flex-end" },
  modalCancel: {
    paddingVertical: 12, paddingHorizontal: 18,
    borderRadius: 10, borderWidth: 1.5, borderColor: "#CBD5E1", backgroundColor: "#fff",
  },
  modalCancelTxt: { color: "#475569", fontWeight: "600", fontSize: 13.5 },
  modalReject: {
    paddingVertical: 12, paddingHorizontal: 22,
    borderRadius: 10, backgroundColor: "#DC2626",
    minWidth: 140, alignItems: "center",
  },
  modalRejectTxt: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
});
