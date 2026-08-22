// ============================================================
// AURA STUDIO · Página pública /orcamento/[token]
//
// Cliente recebe link via wa.me e abre aqui no navegador (sem auth).
//
// 19/08/2026 — redesign "encantar o cliente do nosso cliente":
//   - Marca do LOJISTA no topo: logo + nome + cores da loja
//     (digital_channel_config via GET /orcamento/:token → shop.*).
//     A página deixa de ter cara de "sistema" e passa a ser um
//     documento da loja.
//   - Tipografia Aura (Instrument Serif no nome, DM Sans no corpo).
//   - Personalização de cada item exibida como detalhes legíveis
//     (antes o campo customization era ignorado).
//   - "Falar com a loja" só aparece quando a loja tem WhatsApp — e
//     abre wa.me/55<numero> de verdade (antes abria wa.me vazio).
//   - Rodapé discreto "feito com Aura Studio".
//
// Exibe:
//   - Header com a marca da loja
//   - Lista de itens com preços + detalhes de personalização
//   - Subtotal / desconto / total / sinal
//   - Status: aceite / recusa / expirado
//   - Botões: "Aceitar orçamento" + "Recusar" + WhatsApp
// ============================================================
import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, TextInput, Modal, Linking, Image, Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { studioApi, type PublicQuote } from "@/services/studioApi";
import { Fonts, GOOGLE_FONTS_CSS } from "@/constants/fonts";

import { tipografiaDaLoja, cssDaVitrine } from "@/constants/fonts";
import { PoweredByAura } from "@/components/studio/storefront/ui/PoweredByAura";
// Fallbacks quando a loja não configurou cores na Loja Digital
const FALLBACK_PRIMARY = "#1E3A8A";
const FALLBACK_SECONDARY = "#EC4899";

function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v.trim());
}

// Página pública standalone: injeta as fontes Aura no web
function injectFonts() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (!document.getElementById("aura-fonts")) {
    const lk = document.createElement("link");
    lk.id = "aura-fonts"; lk.rel = "stylesheet"; lk.href = GOOGLE_FONTS_CSS;
    document.head.appendChild(lk);
  }
  if (!document.getElementById("quote-typography")) {
    const st = document.createElement("style");
    st.id = "quote-typography";
    st.textContent =
      `#root div[dir="auto"], #root input, #root textarea { font-family: ${Fonts.body}; }`;
    document.head.appendChild(st);
  }
}

export default function OrcamentoPublico() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading,   setLoading]   = useState(true);
  const [data,      setData]      = useState<PublicQuote | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [askReject,  setAskReject]  = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [result,     setResult]    = useState<{ ok: true; message: string; action: string } | null>(null);

  useEffect(() => { injectFonts(); }, []);

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

  // ── Marca da loja (cores + logo + contato) ──────────────────
  const primary = isHexColor(data?.shop?.primary_color) ? data!.shop.primary_color!.trim() : FALLBACK_PRIMARY;
  const secondary = isHexColor(data?.shop?.secondary_color) ? data!.shop.secondary_color!.trim() : FALLBACK_SECONDARY;
  const logoUrl = data?.shop?.logo_url || null;
  const waNumber = data?.shop?.whatsapp || null;
  // Fase 05: cor e logo ja chegavam aqui; a tipografia nao. A escolha da
  // lojista valia na Loja Virtual e o orcamento dela saia na fonte do
  // sistema — a peca mais formal que ela manda pro cliente.
  const tipo = tipografiaDaLoja((data?.shop as any)?.font_family);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || !data?.shop) return;
    const id = "aura-orcamento-fonte";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = cssDaVitrine((data.shop as any).font_family);
  }, [data?.shop]);

  function openWhatsApp() {
    if (!waNumber) return;
    const digits = waNumber.replace(/\D/g, "");
    const full = digits.length <= 11 ? "55" + digits : digits;
    Linking.openURL(`https://wa.me/${full}`);
  }

  // Header com a marca da loja — usado em todos os estados
  const BrandHead = data ? (
    <View style={s.brandWrap}>
      <View
        style={[
          s.brandBand,
          Platform.OS === "web"
            ? ({ backgroundImage: `linear-gradient(120deg, ${primary} 0%, ${secondary} 100%)` } as any)
            : { backgroundColor: primary },
        ]}
      />
      <View style={s.brandContent}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={s.brandLogo} />
        ) : (
          <View style={[s.brandLogo, s.brandLogoFallback, { backgroundColor: primary }]}>
            <Text style={[s.brandLogoLetter, { fontFamily: tipo.display }]}>
              {(data.shop.name || "E").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={[s.brandName, { fontFamily: tipo.display }]}>{data.shop.name}</Text>
        <Text style={[s.brandEyebrow, { color: secondary }]}>ORÇAMENTO PERSONALIZADO</Text>
      </View>
    </View>
  ) : null;

  const Footer = (
    <Text style={s.footerNote}>✦ Orçamento criado com Aura Studio</Text>
  );

  // ─── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.bg}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={FALLBACK_PRIMARY} />
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
          {BrandHead}
          <View style={[s.resultCard, { borderColor: "#F97316" }]}>
            <View style={[s.resultIco, { backgroundColor: "#F97316" }]}>
              <Icon name="clock" size={32} color="#fff" />
            </View>
            <Text style={s.resultTitle}>Orçamento expirado</Text>
            <Text style={s.resultMsg}>
              Este orçamento não está mais disponível. Entre em contato com a loja para solicitar um novo.
            </Text>
            {waNumber ? (
              <Pressable
                style={[s.btnAccept, { backgroundColor: "#25D366", marginTop: 16 }]}
                onPress={openWhatsApp}
              >
                <Icon name="whatsapp" size={18} color="#fff" />
                <Text style={s.btnAcceptTxt}>Falar com a loja</Text>
              </Pressable>
            ) : null}
          </View>
          {Footer}
          <PoweredByAura />
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
          {BrandHead}
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
              <View style={[s.depositBox, { backgroundColor: "#F0F9FF" }]}>
                <Icon name="credit-card" size={18} color={primary} />
                <Text style={[s.depositTxt, { color: primary }]}>
                  Sinal de {data.deposit_pct}% ({fmtCurrency(data.deposit_amount)}) necessário para iniciar a produção.
                  A loja vai te informar como pagar.
                </Text>
              </View>
            ) : null}
            {isAccepted && waNumber ? (
              <Pressable
                style={[s.btnAccept, { backgroundColor: "#25D366", marginTop: 12 }]}
                onPress={openWhatsApp}
              >
                <Icon name="whatsapp" size={18} color="#fff" />
                <Text style={s.btnAcceptTxt}>Falar com a loja</Text>
              </Pressable>
            ) : null}
          </View>
          {Footer}
          <PoweredByAura />
        </ScrollView>
      </View>
    );
  }

  // ─── Tela principal: orçamento aberto ────────────────────────
  return (
    <View style={s.bg}>
      <ScrollView contentContainerStyle={s.container}>
        {BrandHead}

        {/* Saudação */}
        <View style={s.customerCard}>
          <Text style={s.customerName}>
            {data.customer_name ? `Olá, ${data.customer_name.split(" ")[0]}! 👋` : "Olá! 👋"}
          </Text>
          <Text style={s.customerSub}>
            Preparamos este orçamento especialmente pra você. Confira os itens e o valor
            total — e nos confirme se deseja prosseguir.
          </Text>
        </View>

        {/* Itens */}
        <View style={s.itemsCard}>
          <Text style={s.itemsLabel}>ITENS DO ORÇAMENTO</Text>
          {data.items.map((it, i) => {
            const custEntries =
              it.customization && typeof it.customization === "object"
                ? Object.entries(it.customization as Record<string, any>)
                    .filter(([, v]) => v != null && String(v).trim() !== "")
                    .slice(0, 4)
                : [];
            return (
              <View key={i} style={[s.itemBlock, i > 0 && s.itemBlockBorder]}>
                <View style={s.itemRow}>
                  <View style={[s.itemQtyBadge, { backgroundColor: primary + "14" }]}>
                    <Text style={[s.itemQtyTxt, { color: primary }]}>{it.quantity}×</Text>
                  </View>
                  <Text style={s.itemName} numberOfLines={3}>{it.description}</Text>
                  <Text style={s.itemPrice}>{fmtCurrency(it.unit_price * it.quantity)}</Text>
                </View>
                {custEntries.length > 0 && (
                  <View style={s.custWrap}>
                    {custEntries.map(([k, v]) => (
                      <View key={k} style={s.custChip}>
                        {isHexColor(String(v)) ? (
                          <View style={[s.custSwatch, { backgroundColor: String(v) }]} />
                        ) : null}
                        <Text style={s.custChipTxt} numberOfLines={1}>
                          {isHexColor(String(v)) ? k : `${k}: ${String(v).slice(0, 40)}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

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
            <Text style={[s.totalFinalVal, { color: primary }]}>{fmtCurrency(data.total)}</Text>
          </View>

          {/* Sinal */}
          {data.deposit_pct && data.deposit_amount ? (
            <View style={s.depositBox}>
              <Icon name="credit-card" size={18} color={primary} />
              <Text style={[s.depositTxt, { color: primary }]}>
                Sinal de {data.deposit_pct}% ({fmtCurrency(data.deposit_amount)}) necessário para iniciar a produção.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Validade */}
        <Text style={s.validityNote}>
          Válido até {new Date(data.expires_at).toLocaleDateString("pt-BR")} · {data.shop.name}
        </Text>

        {/* Botões de ação */}
        <View style={s.actions}>
          <Pressable
            style={[s.btnAccept, { backgroundColor: primary, shadowColor: primary }, submitting && s.btnDisabled]}
            onPress={accept}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Icon name="check" size={20} color="#fff" /><Text style={s.btnAcceptTxt}>Aceitar orçamento</Text></>}
          </Pressable>

          {waNumber ? (
            <Pressable style={s.btnWhats} onPress={openWhatsApp}>
              <Icon name="whatsapp" size={18} color="#25D366" />
              <Text style={s.btnWhatsTxt}>Tirar dúvida no WhatsApp</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[s.btnReject, submitting && s.btnDisabled]}
            onPress={() => setAskReject(true)}
            disabled={submitting}
          >
            <Text style={s.btnRejectTxt}>Recusar</Text>
          </Pressable>
        </View>

        {Footer}
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
  bg: { flex: 1, backgroundColor: "#F6F5F2" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  container: { paddingBottom: 40, maxWidth: 560, alignSelf: "center", width: "100%" },
  containerSuccess: { flexGrow: 1, alignItems: "center", justifyContent: "flex-start", paddingBottom: 40, maxWidth: 520, alignSelf: "center", width: "100%" },

  // ── Marca da loja ─────────────────────────────────────────
  brandWrap: { width: "100%", alignItems: "center", marginBottom: 18 },
  brandBand: {
    width: "100%",
    height: 110,
    backgroundColor: FALLBACK_PRIMARY,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  brandContent: { alignItems: "center", marginTop: -44 },
  brandLogo: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "#fff",
    borderWidth: 4, borderColor: "#fff",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 8px 24px rgba(15,23,42,0.16)" } as any)
      : { elevation: 6 }),
  },
  brandLogoFallback: { alignItems: "center", justifyContent: "center" },
  brandLogoLetter: {
    color: "#fff", fontSize: 36, fontWeight: "800",
    ...(Platform.OS === "web" ? ({ fontFamily: Fonts.heading } as any) : null),
  },
  brandName: {
    fontSize: 26, color: "#0F172A", letterSpacing: -0.4, marginTop: 12,
    textAlign: "center", paddingHorizontal: 18,
    ...(Platform.OS === "web"
      ? ({ fontFamily: Fonts.heading, fontWeight: "400" } as any)
      : { fontWeight: "800" }),
  },
  brandEyebrow: {
    fontSize: 11, fontWeight: "800", letterSpacing: 1.6,
    textTransform: "uppercase", marginTop: 6,
  },

  customerCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 20,
    marginBottom: 14, marginHorizontal: 18,
    borderWidth: 1, borderColor: "#EAE8E3",
  },
  customerName: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  customerSub: { fontSize: 13.5, color: "#475569", marginTop: 6, lineHeight: 20 },

  itemsCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 20,
    marginBottom: 14, marginHorizontal: 18,
    borderWidth: 1, borderColor: "#EAE8E3",
    gap: 12,
  },
  itemsLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  itemBlock: { gap: 8 },
  itemBlockBorder: { borderTopWidth: 1, borderTopColor: "#F4F2EE", paddingTop: 12 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  itemQtyBadge: {
    minWidth: 34, paddingHorizontal: 6, paddingVertical: 4,
    borderRadius: 8, alignItems: "center",
  },
  itemQtyTxt: { fontSize: 12.5, fontWeight: "800" },
  itemName: { fontSize: 14, color: "#1E293B", flex: 1, lineHeight: 20, fontWeight: "600" },
  itemPrice: { fontSize: 14, color: "#0F172A", fontWeight: "800" },
  custWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingLeft: 44 },
  custChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#F6F5F2", borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  custSwatch: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  custChipTxt: { fontSize: 11, color: "#64748B", fontWeight: "600", maxWidth: 220 },

  divider: { height: 1, backgroundColor: "#F4F2EE", marginVertical: 2 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 13, color: "#64748B" },
  totalVal: { fontSize: 13, color: "#0F172A", fontWeight: "600" },
  totalFinalLabel: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  totalFinalVal: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },

  depositBox: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: "#F0F5FF", borderRadius: 12, padding: 12, marginTop: 8,
  },
  depositTxt: { flex: 1, fontSize: 13, lineHeight: 18 },

  validityNote: { fontSize: 11.5, color: "#94A3B8", textAlign: "center", marginBottom: 16 },

  actions: { gap: 10, marginHorizontal: 18 },
  btnAccept: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: FALLBACK_PRIMARY, paddingVertical: 18, borderRadius: 16,
    shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  btnAcceptTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  btnWhats: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#fff", paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: "#C9EDD4",
  },
  btnWhatsTxt: { color: "#128C4B", fontSize: 14, fontWeight: "700" },
  btnReject: {
    alignItems: "center", paddingVertical: 12,
  },
  btnRejectTxt: { color: "#94A3B8", fontSize: 13.5, fontWeight: "700", textDecorationLine: "underline" },
  btnDisabled: { opacity: 0.5 },

  footerNote: {
    fontSize: 11, color: "#B9B4AC", textAlign: "center",
    marginTop: 26, fontWeight: "600", letterSpacing: 0.3,
  },

  // Resultado
  resultCard: {
    padding: 28, backgroundColor: "#fff", borderRadius: 20,
    alignItems: "center", borderWidth: 2, maxWidth: 420,
    width: "100%", gap: 10, marginHorizontal: 18,
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
