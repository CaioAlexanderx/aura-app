// ============================================================
// AURA STUDIO · Wizard de solicitar aprovação de arte (Fase 5)
//
// 3ª aplicação do <StudioWorkflow> canônico.
// 3 passos: Mockup → Mensagem → Abrir WhatsApp.
//
// Fluxo:
//   1. Lojista cola URL do mockup
//   2. Edita mensagem (template default em PT-BR)
//   3. Backend gera token, retorna wa.me link, frontend abre popup
//
// Pós-envio: cliente abre o link, vê /aprovacao/[token], aprova ou
// pede ajuste. KDS avança auto se aprovar.
// ============================================================
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Image, Linking, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { StudioWorkflow } from "@/components/studio/StudioWorkflow";
import { StudioColors } from "@/constants/studio-tokens";
import { studioApi, type StudioOrder, type StudioApprovalCreated } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

type Props = {
  order: StudioOrder;
  onClose: () => void;
  onSent: () => void;
};

export function ApprovalRequestModal({ order, onClose, onSent }: Props) {
  const { company } = useAuthStore();
  const [step, setStep] = useState(1);
  const [mockupUrl, setMockupUrl] = useState("");
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone || "");
  const [customMessage, setCustomMessage] = useState("");
  const [created, setCreated] = useState<StudioApprovalCreated | null>(null);

  const canAdvance =
    step === 1 ? /^https?:\/\//.test(mockupUrl.trim()) :
    step === 2 ? customerPhone.replace(/\D/g, "").length >= 10 :
    true;

  async function generateLink() {
    if (!company?.id) return;
    try {
      const r = await studioApi.requestApproval(company.id, order.id, {
        mockup_url: mockupUrl.trim(),
        customer_phone: customerPhone.trim() || undefined,
        custom_message: customMessage.trim() || undefined,
      });
      setCreated(r);
      setStep(3);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar link");
    }
  }

  function openWhatsApp() {
    if (!created?.wa_me_link) {
      toast.error("Link wa.me não pôde ser gerado — telefone inválido");
      return;
    }
    if (Platform.OS === "web") {
      window.open(created.wa_me_link, "_blank");
    } else {
      Linking.openURL(created.wa_me_link).catch(() => toast.error("Não foi possível abrir o WhatsApp"));
    }
    toast.success("✨ Aprovação solicitada! Aguarde resposta do cliente.");
    onSent();
  }

  return (
    <View style={{ flex: 1, backgroundColor: StudioColors.bg }}>
      <View style={s.closeRow}>
        <Pressable onPress={onClose} style={s.closeBtn}>
          <Icon name="x" size={18} color={StudioColors.ink2} />
        </Pressable>
      </View>

      <StudioWorkflow
        title={`Solicitar aprovação — pedido #${order.id.slice(0, 8).toUpperCase()}`}
        steps={["Mockup", "Mensagem", "Enviar WhatsApp"]}
        current={step}
        onBack={step > 1 ? () => setStep((x) => x - 1) : undefined}
        onNext={step === 1 ? () => setStep(2) : step === 2 ? generateLink : undefined}
        onConcluir={step === 3 ? openWhatsApp : undefined}
        primaryDisabled={!canAdvance}
        primaryCta={
          step === 3 ? "Abrir WhatsApp e enviar" :
          step === 2 ? "Gerar link de aprovação" :
          "Continuar"
        }
        draftKey={`approval-${order.id}`}
        draft={{ mockupUrl, customerPhone, customMessage }}
        onDraftRestored={(d: any) => {
          if (d.mockupUrl) setMockupUrl(d.mockupUrl);
          if (d.customerPhone) setCustomerPhone(d.customerPhone);
          if (d.customMessage) setCustomMessage(d.customMessage);
        }}
      >
        {step === 1 && (
          <View style={s.block}>
            <Text style={s.q}>Cole a URL do mockup que vai enviar</Text>
            <Text style={s.help}>
              URL pública da imagem do mockup com a arte aplicada (PNG/JPG). Upload direto chega numa próxima iteração.
            </Text>
            <TextInput
              style={s.input}
              placeholder="https://..."
              value={mockupUrl}
              onChangeText={setMockupUrl}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {/^https?:\/\//.test(mockupUrl.trim()) && (
              <View style={s.preview}>
                <Image source={{ uri: mockupUrl.trim() }} style={s.previewImg} />
                <Text style={s.previewCap}>Prévia do que o cliente vai ver</Text>
              </View>
            )}
          </View>
        )}

        {step === 2 && (
          <View style={s.block}>
            <Text style={s.q}>Confirme o telefone e (opcional) ajuste a mensagem</Text>
            <Text style={s.help}>
              A loja envia pelo WhatsApp manualmente — assim funciona pra qualquer cliente sem precisar de aprovação da Meta.
            </Text>

            <Text style={s.label}>Telefone do cliente (com DDD)</Text>
            <TextInput
              style={s.input}
              placeholder="(00) 00000-0000"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
            />

            <Text style={[s.label, { marginTop: 14 }]}>Mensagem (opcional)</Text>
            <TextInput
              style={[s.input, { minHeight: 100 }]}
              placeholder="Deixe em branco pra usar o texto padrão"
              value={customMessage}
              onChangeText={setCustomMessage}
              multiline
            />
            <Text style={s.subHelp}>
              Padrão: "Oi [nome]! Sua arte do pedido ficou pronta 🎨 Dá uma olhada e me confirma se posso imprimir: [link]"
            </Text>
          </View>
        )}

        {step === 3 && created && (
          <View style={s.block}>
            <View style={s.successCard}>
              <Icon name="check-circle" size={28} color={StudioColors.mint} />
              <Text style={s.successTitle}>Link gerado!</Text>
              <Text style={s.successSub}>
                Click no botão abaixo pra abrir o WhatsApp com a mensagem já pronta. Você só precisa clicar enviar.
              </Text>
              <View style={s.linkBox}>
                <Text style={s.linkLabel}>LINK DO CLIENTE</Text>
                <Text style={s.linkUrl} numberOfLines={1}>{created.approval_url}</Text>
              </View>
              {created.message_text && (
                <View style={s.linkBox}>
                  <Text style={s.linkLabel}>MENSAGEM</Text>
                  <Text style={s.linkMsg} numberOfLines={6}>{created.message_text}</Text>
                </View>
              )}
              <Text style={[s.subHelp, { marginTop: 12 }]}>
                ⏱ Link válido por 7 dias. Você pode cancelar ou enviar novo a qualquer momento.
              </Text>
            </View>
          </View>
        )}
      </StudioWorkflow>
    </View>
  );
}

const s = StyleSheet.create({
  closeRow: { flexDirection: "row", justifyContent: "flex-end", padding: 12 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },

  block: { maxWidth: 540 },
  q: { fontSize: 17, fontWeight: "800", color: StudioColors.ink, letterSpacing: -0.3 },
  help: { fontSize: 13, color: StudioColors.ink3, marginTop: 4, marginBottom: 16, lineHeight: 19 },
  subHelp: { fontSize: 12, color: StudioColors.ink3, marginTop: 8, fontStyle: "italic" },
  label: { fontSize: 11, color: StudioColors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  input: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: StudioColors.ink5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: StudioColors.ink },

  preview: { marginTop: 14, alignItems: "center" },
  previewImg: { width: 200, height: 200, borderRadius: 14, backgroundColor: "#fff" },
  previewCap: { fontSize: 11, color: StudioColors.ink3, marginTop: 6 },

  successCard: { padding: 22, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: StudioColors.mintSoft, alignItems: "center" },
  successTitle: { fontSize: 18, fontWeight: "800", color: StudioColors.ink, marginTop: 8 },
  successSub: { fontSize: 13, color: StudioColors.ink3, textAlign: "center", marginTop: 4, marginBottom: 16 },
  linkBox: { width: "100%", backgroundColor: StudioColors.bgSoft, borderRadius: 10, padding: 12, marginTop: 8 },
  linkLabel: { fontSize: 10, fontWeight: "800", color: StudioColors.ink3, letterSpacing: 0.6 },
  linkUrl: { fontSize: 12, color: StudioColors.primary, marginTop: 4, fontWeight: "600" },
  linkMsg: { fontSize: 12.5, color: StudioColors.ink2, marginTop: 4, lineHeight: 18 },
});

export default ApprovalRequestModal;
