// ============================================================
// AURA. — Crédito Livre · modal "cupom de retorno" (Fase 3)
//
// Clone do BirthdayCouponModal: mesmo layout, mesmos dois CTAs, mesmo
// comportamento de telefone inválido. Reaproveitar mantém o app coerente
// — o lojista já conhece esse fluxo do card de aniversariantes.
//
// Diferenças em relação ao de aniversário:
//   - source do cupom é 'credit_lead' (backend), código VOLTA-<NOME>-<YY>
//   - validade padrão 15 dias, não 7: aqui não há data marcada criando
//     urgência, a janela de decisão do cliente é mais longa
//   - registra em credit_lead_contacts, e por isso o lead migra pro
//     segmento "Já contatados" assim que o envio acontece
//
// Sobre a mensagem: ela vem PRÉ-PREENCHIDA e EDITÁVEL, como aprovado no
// mockup. Não é envio automático — nada sai sem o lojista ler e poder
// reescrever. É a diferença pro botão de WhatsApp da lista, que é ação
// rápida sem contexto e por isso abre a conversa vazia.
//
// Web: usa WebPortal pelo mesmo motivo do BirthdayCouponModal — montado
// dentro de conteúdo scrollável, o position:fixed se resolveria contra um
// ancestral com transform e o modal colaria no topo da página.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, Platform, ScrollView,
  Modal as RNModal,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";
import { creditLeadsApi } from "@/services/creditLeadsApi";
import type { CreditLead } from "@/services/creditLeadsApi";
import {
  buildWaMeUrl, normalizeBrPhone, formatDiscountDescription, formatExpiresAt,
} from "@/services/messaging";

// Placeholder trocado pelo código real DEPOIS de criar o cupom — mesmo
// truque do BirthdayCouponModal, já que o código é gerado no backend.
const CODE_PLACEHOLDER = "{{cupom_sera_gerado}}";

type Props = {
  visible: boolean;
  onClose: () => void;
  lead: CreditLead | null;
};

export function CreditoLivreCupomModal({ visible, onClose, lead }: Props) {
  const { company } = useAuthStore();
  const qc = useQueryClient();

  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [validityDays, setValidityDays] = useState("15");
  const [messageText, setMessageText] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);

  // previewExpires precisa existir antes do early return (regra dos hooks).
  const previewExpires = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (parseInt(validityDays, 10) || 15));
    return formatExpiresAt(d.toISOString());
  }, [validityDays]);

  // Reseta e monta o texto quando abre com um lead novo.
  useEffect(() => {
    if (!visible || !lead) return;
    setDiscountType("percent");
    setDiscountValue("10");
    setValidityDays("15");
    setCreating(false);
    setSending(false);

    const first = (lead.name || "").split(" ")[0] || lead.name;
    const empresa = company?.name || "nossa loja";
    const d = new Date();
    d.setDate(d.getDate() + 15);
    setMessageText(
      `Oi, ${first}! 💜\n` +
      `Vi que você quitou tudo certinho aqui na ${empresa} — obrigada pela confiança!\n\n` +
      `Separei um presente: ${formatDiscountDescription("percent", 10)} no cupom *${CODE_PLACEHOLDER}*, ` +
      `válido até ${formatExpiresAt(d.toISOString())}.\n\n` +
      `Seu crediário está liberado de novo, se precisar. 😊`
    );
  }, [visible, lead, company?.name]);

  if (!visible || !lead) return null;

  const phoneOk = !!normalizeBrPhone(lead.phone || "");
  const dvNum = parseFloat(String(discountValue).replace(",", ".")) || 0;
  const vdNum = parseInt(validityDays, 10) || 0;
  const canCreate = dvNum > 0 && vdNum > 0 && !creating && !sending;
  const canSend = canCreate && phoneOk;

  async function performCreate() {
    if (!company?.id || !lead) return null;
    setCreating(true);
    try {
      const res = await creditLeadsApi.createCoupon(company.id, lead.id, {
        discount_type: discountType,
        discount_value: dvNum,
        validity_days: vdNum,
      });
      qc.invalidateQueries({ queryKey: ["coupons", company.id] });
      return res;
    } catch (err: any) {
      // O backend distingue os motivos — vale repassar, senão o lojista
      // não entende por que aquele cliente não aceita cupom.
      const code = err?.data?.code;
      toast.error(
        code === "MARKETING_OPT_OUT" ? "Cliente optou por não receber comunicações"
        : code === "HAS_OPEN_BALANCE" ? "Cliente voltou a ter saldo em aberto"
        : code === "MIGRATION_PENDING" ? "Banco desatualizado — avise o suporte"
        : err?.message || "Erro ao criar cupom"
      );
      return null;
    } finally {
      setCreating(false);
    }
  }

  function refreshLists() {
    if (!company?.id) return;
    // Invalida a lista pro lead migrar pro segmento "Já contatados".
    qc.invalidateQueries({ queryKey: ["credit-leads", company.id] });
  }

  async function handleCreateOnly() {
    const res = await performCreate();
    if (!res?.coupon) return;
    toast.success(`Cupom ${res.coupon.code} criado`);
    refreshLists();
    onClose();
  }

  async function handleCreateAndSend() {
    if (!canSend || !company?.id || !lead) return;
    const res = await performCreate();
    if (!res?.coupon) return;

    setSending(true);
    try {
      const finalMessage = messageText.split(CODE_PLACEHOLDER).join(res.coupon.code);
      const url = buildWaMeUrl(lead.phone || "", finalMessage);

      // Loga ANTES de abrir: no web o window.open pode ser bloqueado, e é
      // pior perder o registro (o lead sumiria da fila "já contatados"
      // sem motivo) do que registrar um envio que o lojista abortou.
      try {
        await creditLeadsApi.logContact(company.id, lead.id, {
          coupon_id: res.coupon.id,
          method: "wa_link",
          message: finalMessage,
        });
      } catch {
        // Cupom já existe; não travar o envio por causa do log.
      }

      if (url && Platform.OS === "web" && typeof window !== "undefined") {
        const w = window.open(url, "_blank");
        if (!w) {
          window.location.href = url;
          toast.error("Pop-up bloqueado — abrindo na mesma aba");
        }
      }
      toast.success(`Cupom ${res.coupon.code} criado e WhatsApp aberto`);
      refreshLists();
      onClose();
    } finally {
      setSending(false);
    }
  }

  const modalCard = (
    <View style={s.modal}>
      <ScrollView contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>Cupom de retorno</Text>
            <Text style={s.title}>{lead.name}</Text>
            <Text style={s.subtitle}>
              Conta zerada há {lead.days_since_activity} dia{lead.days_since_activity !== 1 ? "s" : ""}
              {" · já comprou "}
              {"R$ " + (lead.total_debited || 0).toFixed(2).replace(".", ",")}
              {" no fiado"}
            </Text>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        {lead.owes_elsewhere && (
          <View style={s.warning}>
            <Icon name="alert" size={14} color={Colors.amber} />
            <Text style={s.warningText}>
              Este cliente tem saldo em aberto em outra loja do grupo. Avalie antes de oferecer.
            </Text>
          </View>
        )}

        <View style={s.field}>
          <Text style={s.label}>Tipo de desconto</Text>
          <View style={s.toggleRow}>
            <Pressable
              onPress={() => setDiscountType("percent")}
              style={[s.toggleBtn, discountType === "percent" && s.toggleBtnActive]}
            >
              <Text style={[s.toggleText, discountType === "percent" && s.toggleTextActive]}>
                Porcentagem (%)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDiscountType("fixed")}
              style={[s.toggleBtn, discountType === "fixed" && s.toggleBtnActive]}
            >
              <Text style={[s.toggleText, discountType === "fixed" && s.toggleTextActive]}>
                Valor fixo (R$)
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{discountType === "percent" ? "Desconto (%)" : "Desconto (R$)"}</Text>
            <TextInput
              style={s.input}
              value={discountValue}
              onChangeText={setDiscountValue}
              keyboardType="decimal-pad"
              placeholder={discountType === "percent" ? "10" : "10,00"}
              placeholderTextColor={Colors.ink3}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Validade (dias)</Text>
            <TextInput
              style={s.input}
              value={validityDays}
              onChangeText={(v) => setValidityDays(v.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="15"
              placeholderTextColor={Colors.ink3}
              maxLength={3}
            />
            <Text style={s.helper}>Vence em {previewExpires}</Text>
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Mensagem WhatsApp</Text>
          <TextInput
            style={[s.input, s.messageInput]}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            numberOfLines={7}
            placeholder="Texto da mensagem..."
            placeholderTextColor={Colors.ink3}
          />
          <Text style={s.helper}>
            {lead.phone
              ? phoneOk
                ? `O código entra no lugar de ${CODE_PLACEHOLDER}. Vai abrir o WhatsApp para ${lead.phone}`
                : "⚠ Telefone inválido — confira o DDD"
              : "⚠ Cliente sem telefone — dá pra criar o cupom e entregar na loja"}
          </Text>
        </View>

        <View style={s.actions}>
          <Pressable onPress={onClose} style={s.cancelBtn} disabled={creating || sending}>
            <Text style={s.cancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={handleCreateOnly}
            disabled={!canCreate}
            style={[s.secondaryBtn, !canCreate && { opacity: 0.5 }]}
          >
            <Text style={s.secondaryText}>{creating && !sending ? "Criando..." : "Só criar cupom"}</Text>
          </Pressable>
          <Pressable
            onPress={handleCreateAndSend}
            disabled={!canSend}
            style={[s.primaryBtn, !canSend && { opacity: 0.5 }]}
          >
            <Icon name="whatsapp" size={14} color="#fff" />
            <Text style={s.primaryText}>{sending ? "Enviando..." : "Criar e enviar"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );

  if (Platform.OS === "web" && typeof document !== "undefined") {
    return (
      <WebPortal active>
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50000,
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            padding: 16, boxSizing: "border-box", overflowY: "auto",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            background: "rgba(2,6,23,0.62)",
          } as any}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div style={{ width: "100%", maxWidth: 480, margin: "auto" } as any}>
            {modalCard}
          </div>
        </div>
      </WebPortal>
    );
  }

  return (
    <RNModal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        {modalCard}
      </View>
    </RNModal>
  );
}

export default CreditoLivreCupomModal;

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(2,6,23,0.62)" },
  modal: {
    backgroundColor: Colors.bg3, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: Colors.border2,
    width: "100%", maxWidth: 480, zIndex: 10, maxHeight: "90vh" as any,
    elevation: 50, shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  eyebrow: { fontSize: 10, color: Colors.violet3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  subtitle: { fontSize: 11.5, color: Colors.ink3, marginTop: 3 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  field: { marginBottom: 14 },
  row2: { flexDirection: "row", gap: 10, marginBottom: 14 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.ink },
  messageInput: { minHeight: 118, paddingTop: 12, textAlignVertical: "top" },
  helper: { fontSize: 11, color: Colors.ink3, marginTop: 6 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, backgroundColor: Colors.bg4, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center" },
  toggleBtnActive: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  toggleText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  toggleTextActive: { color: Colors.violet3, fontWeight: "700" },
  warning: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    backgroundColor: Colors.amberD, borderColor: "rgba(251,191,36,0.34)",
    borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 14,
  },
  warningText: { fontSize: 11.5, color: Colors.amber, flex: 1, lineHeight: 16 },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 4 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  secondaryBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.violet + "66", backgroundColor: Colors.violet + "11" },
  secondaryText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  primaryBtn: { backgroundColor: Colors.violet, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, flexDirection: "row", gap: 8, alignItems: "center" },
  primaryText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});
