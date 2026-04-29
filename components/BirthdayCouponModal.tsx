import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { birthdayApi, type BirthdayCustomer, type BirthdaySettings } from "@/services/api";
import {
  sendBirthdayMessage,
  renderTemplate,
  buildWaMeUrl,
  formatDiscountDescription,
  formatExpiresAt,
  resolveChannel,
  normalizeBrPhone,
} from "@/services/messaging";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Props = {
  visible: boolean;
  onClose: () => void;
  customer: BirthdayCustomer | null;
  /** Disparado depois de criar (com ou sem envio) — usado pra invalidar cache */
  onSuccess?: (info: { coupon_id: string; sent: boolean }) => void;
};

/**
 * BirthdayCouponModal — fluxo unificado "criar cupom + enviar mensagem"
 * para o card de aniversariantes do dia.
 *
 * UX:
 *   1. Carrega settings da empresa (defaults + template) — cacheado.
 *   2. Form pré-preenchido com defaults; usuário pode ajustar.
 *   3. Preview da mensagem com variáveis substituídas.
 *   4. Dois botões: "Criar cupom" (só persiste) e
 *      "Criar e enviar via WhatsApp" (cria + abre wa.me + log).
 *
 * Idempotência: botão fica desabilitado durante mutation; sucesso fecha o modal.
 */
export function BirthdayCouponModal({ visible, onClose, customer, onSuccess }: Props) {
  const { company } = useAuthStore();
  const qc = useQueryClient();

  // Settings (defaults + template) — cache 5min
  const settingsQuery = useQuery({
    queryKey: ["birthday-settings", company?.id],
    queryFn: () => birthdayApi.getSettings(company!.id),
    enabled: visible && !!company?.id,
    staleTime: 5 * 60 * 1000,
  });

  const settings: BirthdaySettings | undefined = settingsQuery.data;

  // Form state — atualizado quando settings chegarem
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState<string>("10");
  const [validityDays, setValidityDays] = useState<string>("7");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customCode, setCustomCode] = useState<string>("");        // se vazio, backend gera
  const [minOrderValue, setMinOrderValue] = useState<string>("0");
  const [messageText, setMessageText] = useState<string>("");      // editável
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);

  // Reseta state quando abre com customer novo / settings carregam
  useEffect(() => {
    if (!visible || !settings || !customer) return;
    setDiscountType(settings.defaults.discount_type);
    setDiscountValue(String(settings.defaults.discount_value));
    setValidityDays(String(settings.defaults.validity_days));
    setMinOrderValue(String(settings.defaults.min_order_value || 0));
    setCustomCode("");
    setAdvancedOpen(false);
    setCreating(false);
    setSending(false);

    // Texto inicial = template renderizado com placeholder de cupom
    const previewExpires = previewExpiresAt(parseInt(String(settings.defaults.validity_days)) || 7);
    const initialText = renderTemplate(settings.template, {
      nome: customer.name.split(" ")[0] || customer.name,
      empresa: company?.name || "nossa equipe",
      cupom: "{{cupom_será_gerado}}",
      validade: previewExpires,
      descricao_desconto: formatDiscountDescription(
        settings.defaults.discount_type,
        Number(settings.defaults.discount_value) || 10
      ),
    });
    setMessageText(initialText);
  }, [visible, settings, customer, company?.name]);

  if (!visible || !customer) return null;

  const phoneValid = !!normalizeBrPhone(customer.phone);
  const optedOut = customer.marketing_opt_out === true;
  const dvNum = parseFloat(discountValue.replace(",", ".")) || 0;
  const vdNum = parseInt(validityDays) || 0;
  const canCreate = dvNum > 0 && vdNum > 0 && !creating && !sending;
  const canSend = canCreate && phoneValid && !optedOut;

  // ── Helpers internos ─────────────────────────────────────
  function previewExpiresAt(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return formatExpiresAt(d.toISOString());
  }

  async function performCreate(): Promise<{ coupon: any } | null> {
    if (!company?.id || !customer) return null;
    setCreating(true);
    try {
      const body: any = {
        customer_id: customer.id,
        discount_type: discountType,
        discount_value: dvNum,
        validity_days: vdNum,
        min_order_value: parseFloat(minOrderValue.replace(",", ".")) || 0,
      };
      if (customCode.trim().length >= 3) body.code = customCode.trim();

      const res = await birthdayApi.createCoupon(company.id, body);
      qc.invalidateQueries({ queryKey: ["coupons", company.id] });
      qc.invalidateQueries({ queryKey: ["birthdays", company.id] });
      return res;
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar cupom");
      return null;
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateOnly() {
    const res = await performCreate();
    if (!res?.coupon) return;
    toast.success(`Cupom ${res.coupon.code} criado`);
    onSuccess?.({ coupon_id: res.coupon.id, sent: false });
    onClose();
  }

  async function handleCreateAndSend() {
    if (!canSend) {
      toast.error(optedOut ? "Cliente optou por não receber comunicações" : "Telefone inválido");
      return;
    }
    const res = await performCreate();
    if (!res?.coupon) return;

    setSending(true);
    try {
      // Substitui o placeholder do código pelo real ANTES de mandar
      const finalMessage = messageText.replace(/\{\{cupom_será_gerado\}\}/g, res.coupon.code);

      const channel = resolveChannel(company?.module_overrides);
      const result = await sendBirthdayMessage({
        companyId: company!.id,
        customer: { id: customer.id, name: customer.name, phone: customer.phone },
        coupon: {
          id: res.coupon.id,
          code: res.coupon.code,
          discount_type: res.coupon.discount_type,
          discount_value: res.coupon.discount_value,
          expires_at: res.coupon.expires_at,
        },
        message: finalMessage,
        channel,
      });

      if (result.ok) {
        toast.success(`Mensagem aberta para ${customer.name.split(" ")[0]}`);
        qc.invalidateQueries({ queryKey: ["birthday-sent", company!.id] });
        onSuccess?.({ coupon_id: res.coupon.id, sent: true });
        onClose();
      } else {
        toast.error(
          result.reason === "no_phone" ? "Cliente sem telefone cadastrado" :
          result.reason === "invalid_phone" ? "Telefone inválido — verifique DDD" :
          result.reason === "popup_blocked" ? "Pop-up bloqueado pelo navegador" :
          "Erro ao abrir WhatsApp"
        );
        // Cupom já criado: deixa modal aberto pro user copiar/colar manualmente
      }
    } finally {
      setSending(false);
    }
  }

  // Preview ao vivo da URL (apenas debug — não mostra na UI)
  const previewUrl = useMemo(
    () => buildWaMeUrl(customer.phone, messageText.replace(/\{\{cupom_será_gerado\}\}/g, "ANIV-XXX-XX")),
    [customer.phone, messageText]
  );

  const overlay = (
    <View style={s.overlay}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.modal}>
        <ScrollView contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>Cupom de aniversário</Text>
              <Text style={s.title}>{customer.name}</Text>
              {customer.is_today
                ? <Text style={s.subtitle}>🎂 Faz aniversário hoje</Text>
                : <Text style={s.subtitle}>Aniversário em {customer.days_until} {customer.days_until === 1 ? "dia" : "dias"}</Text>}
            </View>
            <Pressable onPress={onClose} style={s.closeBtn}><Icon name="x" size={16} color={Colors.ink3} /></Pressable>
          </View>

          {/* Tipo de desconto */}
          <View style={s.field}>
            <Text style={s.label}>Tipo de desconto</Text>
            <View style={s.toggleRow}>
              <Pressable
                onPress={() => setDiscountType("percent")}
                style={[s.toggleBtn, discountType === "percent" && s.toggleBtnActive]}
              >
                <Text style={[s.toggleText, discountType === "percent" && s.toggleTextActive]}>Porcentagem (%)</Text>
              </Pressable>
              <Pressable
                onPress={() => setDiscountType("fixed")}
                style={[s.toggleBtn, discountType === "fixed" && s.toggleBtnActive]}
              >
                <Text style={[s.toggleText, discountType === "fixed" && s.toggleTextActive]}>Valor fixo (R$)</Text>
              </Pressable>
            </View>
          </View>

          {/* Valor + validade */}
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
                onChangeText={(v) => setValidityDays(v.replace(/\D/g, ""))}
                keyboardType="number-pad"
                placeholder="7"
                placeholderTextColor={Colors.ink3}
                maxLength={3}
              />
            </View>
          </View>

          {/* Avançado */}
          <Pressable onPress={() => setAdvancedOpen(v => !v)} style={s.advancedToggle}>
            <Icon name={advancedOpen ? "chevron-down" : "chevron-right"} size={14} color={Colors.ink3} />
            <Text style={s.advancedText}>{advancedOpen ? "Ocultar avançado" : "Mostrar avançado"}</Text>
          </Pressable>

          {advancedOpen && (
            <>
              <View style={s.field}>
                <Text style={s.label}>Código (opcional — gerado automático se vazio)</Text>
                <TextInput
                  style={s.input}
                  value={customCode}
                  onChangeText={(v) => setCustomCode(v.toUpperCase().replace(/\s/g, ""))}
                  placeholder={`ANIV-${(customer.name.split(" ")[0] || "").toUpperCase().slice(0, 8)}-26`}
                  placeholderTextColor={Colors.ink3}
                  autoCapitalize="characters"
                  maxLength={30}
                />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Pedido mínimo (R$ — opcional)</Text>
                <TextInput
                  style={s.input}
                  value={minOrderValue}
                  onChangeText={setMinOrderValue}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor={Colors.ink3}
                />
              </View>
            </>
          )}

          {/* Preview / edição da mensagem */}
          <View style={s.field}>
            <Text style={s.label}>Mensagem WhatsApp</Text>
            <TextInput
              style={[s.input, s.messageInput]}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              numberOfLines={6}
              placeholder="Texto da mensagem..."
              placeholderTextColor={Colors.ink3}
            />
            <Text style={s.helper}>
              {customer.phone
                ? phoneValid
                  ? `Vai abrir WhatsApp para ${customer.phone}`
                  : "⚠ Telefone inválido — confira DDD"
                : "⚠ Cliente sem telefone — só dá pra criar o cupom"}
            </Text>
          </View>

          {optedOut && (
            <View style={s.warning}>
              <Icon name="alert-triangle" size={14} color="#f59e0b" />
              <Text style={s.warningText}>Cliente optou por não receber comunicações de marketing.</Text>
            </View>
          )}

          {/* Ações */}
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
              <Icon name="send" size={14} color="#fff" />
              <Text style={s.primaryText}>{sending ? "Enviando..." : "Criar e enviar"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );

  // Web: overlay com blur backdrop (mesmo padrão do QuickCustomerModal)
  if (Platform.OS === "web" && typeof document !== "undefined") {
    return (
      <div
        style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          background: "rgba(0,0,0,0.5)",
        } as any}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ width: "100%", maxWidth: 480, padding: "0 16px", maxHeight: "90vh" } as any}>
          {overlay}
        </div>
      </div>
    );
  }

  return overlay;
}

export default BirthdayCouponModal;

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  modal: {
    backgroundColor: Colors.bg3, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: Colors.border2,
    width: "100%", maxWidth: 480, zIndex: 10, maxHeight: "90vh" as any,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  eyebrow: { fontSize: 10, color: Colors.violet, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  field: { marginBottom: 14 },
  row2: { flexDirection: "row", gap: 10, marginBottom: 14 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.ink },
  messageInput: { minHeight: 110, paddingTop: 12, textAlignVertical: "top" },
  helper: { fontSize: 11, color: Colors.ink3, marginTop: 6 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, backgroundColor: Colors.bg4, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center" },
  toggleBtnActive: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  toggleText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  toggleTextActive: { color: Colors.violet, fontWeight: "700" },
  advancedToggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, marginBottom: 6 },
  advancedText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  warning: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.4)", borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 14 },
  warningText: { fontSize: 12, color: "#f59e0b", flex: 1 },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 4 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  secondaryBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.violet + "66", backgroundColor: Colors.violet + "11" },
  secondaryText: { fontSize: 13, color: Colors.violet, fontWeight: "600" },
  primaryBtn: { backgroundColor: Colors.violet, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, flexDirection: "row", gap: 8, alignItems: "center" },
  primaryText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});
