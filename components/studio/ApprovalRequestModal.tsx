// ============================================================
// AURA STUDIO · Wizard de solicitar aprovação de arte (Fase 5)
//
// 3ª aplicação do <StudioWorkflow> canônico.
// 3 passos: Mockup (upload OU URL) → Mensagem → Abrir WhatsApp.
//
// 25/05 — item #10 da análise UX/UI: upload integrado.
// Lojista clica "Subir do dispositivo", arquivo vai pro R2, URL volta
// já preenchida. Mantém URL externa como fallback.
//
// 03/07/2026 — Visual Engine F2: botão "Gerar do pedido" — o motor
// compose2d gera o render HD 2048px a partir da customization do
// próprio pedido, sobe pro R2, registra em studio_visual_renders
// (content_hash) e vincula render_id ao link de aprovação (migr 209).
// F5: produto com template 3D gera VÍDEO turntable (~4s, webm) em vez
// de imagem — o cliente vê a caneca girando no link de aprovação.
// Fluxos manuais (upload/URL) continuam idênticos como fallback.
// ============================================================
import { useMemo, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Image, Linking, Platform, ActivityIndicator,
} from "react-native";
import { Icon } from "@/components/Icon";
import { StudioWorkflow } from "@/components/studio/StudioWorkflow";
import { type StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { studioApi, type StudioOrder, type StudioApprovalCreated } from "@/services/studioApi";
import { studioVisualApi } from "@/services/studioVisualApi";
import { gerarRenderDoPedido } from "@/components/studio/visualEngine/gerarRenderAprovacao";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { fileToBase64Web, pickFileWeb, uploadStudioMockup } from "@/services/studioUploadApi";

type Props = {
  order: StudioOrder;
  onClose: () => void;
  onSent: () => void;
};

// F5: mockup em vídeo (turntable 3D) — preview de <Image> não se aplica
function isVideoUrl(v: string): boolean {
  const p = v.split("?")[0].toLowerCase();
  return p.endsWith(".webm") || p.endsWith(".mp4");
}

export function ApprovalRequestModal({ order, onClose, onSent }: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const { company } = useAuthStore();
  const [step, setStep] = useState(1);
  const [mockupUrl, setMockupUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  // F2: render gerado pelo motor visual (null = fluxo manual)
  const [renderId, setRenderId] = useState<string | null>(null);
  const [renderHashShort, setRenderHashShort] = useState<string | null>(null);
  const [renderIsVideo, setRenderIsVideo] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone || "");
  const [customMessage, setCustomMessage] = useState("");
  const [created, setCreated] = useState<StudioApprovalCreated | null>(null);

  const canAdvance =
    step === 1 ? /^https?:\/\//.test(mockupUrl.trim()) :
    step === 2 ? customerPhone.replace(/\D/g, "").length >= 10 :
    true;

  // F2: qualquer alteração manual do mockup desfaz o vínculo com o render
  function setMockupUrlManual(v: string) {
    setMockupUrl(v);
    if (renderId) { setRenderId(null); setRenderHashShort(null); setRenderIsVideo(false); }
  }

  async function handleGerarDoPedido() {
    if (!company?.id || generating) return;
    if (Platform.OS !== "web") {
      toast.error("Geração de render disponível na versão web do Studio.");
      return;
    }
    setGenerating(true);
    try {
      const r = await gerarRenderDoPedido(company.id, order.id);
      setMockupUrl(r.url);
      setRenderId(r.renderId);
      setRenderHashShort(r.contentHash.slice(0, 12));
      setRenderIsVideo(!!r.isVideo);
      toast.success(
        r.isVideo
          ? "Vídeo turntable gerado de \"" + r.itemName + "\" — o cliente vê a peça girando!"
          : "Render gerado de \"" + r.itemName + "\" e vinculado ao pedido!"
      );
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar o render");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePickAndUpload() {
    if (!company?.id) return;
    if (Platform.OS !== "web") {
      toast.error("Upload do dispositivo disponível na versão web. Use URL pública por enquanto no app.");
      return;
    }
    const file = await pickFileWeb("image/*,application/pdf");
    if (!file) return;
    setUploading(true);
    try {
      const { base64, content_type } = await fileToBase64Web(file);
      const r = await uploadStudioMockup(company.id, {
        content_base64: base64,
        content_type,
        kind: "approval",
      });
      setMockupUrlManual(r.url);
      toast.success("Mockup enviado!");
    } catch (e: any) {
      toast.error(e?.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  async function generateLink() {
    if (!company?.id) return;
    try {
      const body = {
        mockup_url: mockupUrl.trim(),
        customer_phone: customerPhone.trim() || undefined,
        custom_message: customMessage.trim() || undefined,
      };
      // F2: com render do motor, usa a variante que grava render_id
      const r = renderId
        ? await studioVisualApi.requestApprovalWithRender(company.id, order.id, { ...body, render_id: renderId })
        : await studioApi.requestApproval(company.id, order.id, body);
      setCreated(r as StudioApprovalCreated);
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

  const trimmedUrl = mockupUrl.trim();
  const hasUrl = /^https?:\/\//.test(trimmedUrl);
  const urlIsVideo = hasUrl && isVideoUrl(trimmedUrl);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.closeRow}>
        <Pressable onPress={onClose} style={s.closeBtn}>
          <Icon name="x" size={18} color={t.ink2} />
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
            <Text style={s.q}>Qual mockup vai enviar?</Text>
            <Text style={s.help}>
              Gere direto do pedido com o motor visual (produto 3D vira vídeo girando!),
              suba do seu dispositivo ou cole uma URL pública (PNG, JPG, PDF até 15 MB).
            </Text>

            {/* F2/F5: gerar render/vídeo a partir da customization do pedido */}
            <Pressable
              onPress={handleGerarDoPedido}
              style={[s.generateBtn, generating && { opacity: 0.6 }]}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color={t.primary} />
              ) : (
                <>
                  <Icon name="zap" size={16} color={t.primary} />
                  <Text style={s.generateBtnTxt}>Gerar do pedido (motor visual)</Text>
                </>
              )}
            </Pressable>

            {renderId && (
              <View style={s.renderChip}>
                <Icon name="check-circle" size={14} color={t.mint} />
                <Text style={s.renderChipTxt}>
                  {renderIsVideo ? "Vídeo turntable" : "Render HD"} vinculado ao pedido · hash {renderHashShort}… — fica gravado como prova do que o cliente aprovou
                </Text>
              </View>
            )}

            <Pressable
              onPress={handlePickAndUpload}
              style={[s.uploadBtn, uploading && { opacity: 0.6 }]}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="upload" size={16} color="#fff" />
                  <Text style={s.uploadBtnTxt}>Subir do dispositivo</Text>
                </>
              )}
            </Pressable>

            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerTxt}>ou cole uma URL</Text>
              <View style={s.dividerLine} />
            </View>

            <TextInput
              style={s.input}
              placeholder="https://..."
              value={mockupUrl}
              onChangeText={setMockupUrlManual}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {hasUrl && !urlIsVideo && (
              <View style={s.preview}>
                <Image source={{ uri: trimmedUrl }} style={s.previewImg} />
                <Text style={s.previewCap}>Prévia do que o cliente vai ver</Text>
              </View>
            )}
            {urlIsVideo && (
              <View style={s.videoChip}>
                <Icon name="play-circle" size={16} color={t.primary} />
                <Text style={s.videoChipTxt}>
                  Vídeo turntable pronto — o cliente assiste à peça girando na página de aprovação
                </Text>
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
              <Icon name="check-circle" size={28} color={t.mint} />
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

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  closeRow: { flexDirection: "row", justifyContent: "flex-end", padding: 12 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: t.paperCardElev },

  block: { maxWidth: 540 },
  q: { fontSize: 17, fontWeight: "800", color: t.ink, letterSpacing: -0.3 },
  help: { fontSize: 13, color: t.ink3, marginTop: 4, marginBottom: 16, lineHeight: 19 },
  subHelp: { fontSize: 12, color: t.ink3, marginTop: 8, fontStyle: "italic" },
  label: { fontSize: 11, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  input: { backgroundColor: t.paperCardElev, borderWidth: 1.5, borderColor: t.ink5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: t.ink },

  generateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "transparent",
    borderWidth: 1.5, borderColor: t.primary, borderStyle: "dashed",
    paddingVertical: 12, borderRadius: 12, marginBottom: 10,
  },
  generateBtnTxt: { color: t.primary, fontWeight: "800", fontSize: 13.5 },
  renderChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: t.mintSoft, borderRadius: 10, padding: 10, marginBottom: 10,
  },
  renderChipTxt: { flex: 1, fontSize: 11.5, color: t.ink2, lineHeight: 16 },
  videoChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: t.primaryGhost, borderRadius: 10, padding: 12, marginTop: 12,
  },
  videoChipTxt: { flex: 1, fontSize: 12, color: t.ink2, lineHeight: 17 },

  uploadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: t.primary,
    paddingVertical: 12, borderRadius: 12, marginBottom: 10,
  },
  uploadBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: t.ink5 },
  dividerTxt: { fontSize: 11, color: t.ink3, fontWeight: "600" },

  preview: { marginTop: 14, alignItems: "center" },
  previewImg: { width: 200, height: 200, borderRadius: 14, backgroundColor: t.paperCardElev },
  previewCap: { fontSize: 11, color: t.ink3, marginTop: 6 },

  successCard: { padding: 22, backgroundColor: t.paperCardElev, borderRadius: 16, borderWidth: 1, borderColor: t.mintSoft, alignItems: "center" },
  successTitle: { fontSize: 18, fontWeight: "800", color: t.ink, marginTop: 8 },
  successSub: { fontSize: 13, color: t.ink3, textAlign: "center", marginTop: 4, marginBottom: 16 },
  linkBox: { width: "100%", backgroundColor: t.bgSoft, borderRadius: 10, padding: 12, marginTop: 8 },
  linkLabel: { fontSize: 10, fontWeight: "800", color: t.ink3, letterSpacing: 0.6 },
  linkUrl: { fontSize: 12, color: t.primary, marginTop: 4, fontWeight: "600" },
  linkMsg: { fontSize: 12.5, color: t.ink2, marginTop: 4, lineHeight: 18 },
});

export default ApprovalRequestModal;
