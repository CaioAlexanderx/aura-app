// ============================================================
// AURA. — components/screens/studio-loja-digital/TabStudioRevisoes.tsx
// Tab Loja Digital Studio — Política de revisões/edições da arte
//
// 25/05/2026 (Loja Digital Studio): tela de settings dedicada para
// configurar quantas revisões grátis o cliente tem, preço de revisão
// extra e texto da política exibido no checkout.
//
// Persiste em studio_settings JSONB via studioApi.saveSettings:
//   - max_revisions_included: number (0 = ilimitado)
//   - extra_revision_price:   number (R$)
//   - revision_policy_text:   string
//
// Memory: projeto_aura_studio_followup_25mai2026, plano_aura_studio_vertical_24mai2026
// ============================================================
import { useMemo, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { studioApi } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export function TabStudioRevisoes() {
  const t = useStudioTokens();
  const styles = useMemo(() => buildStyles(t), [t]);
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [maxRevisions, setMaxRevisions] = useState("3");
  const [extraPrice, setExtraPrice] = useState("0");
  const [policyText, setPolicyText] = useState("");

  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (!company?.id) return;
    let cancelled = false;
    setLoading(true);
    studioApi
      .getSettings(company.id)
      .then(({ settings }) => {
        if (cancelled) return;
        setMaxRevisions(String(settings.max_revisions_included ?? 3));
        setExtraPrice(formatPriceInput(settings.extra_revision_price ?? 0));
        setPolicyText(settings.revision_policy_text ?? "");
      })
      .catch(() => {
        // silencioso — usuario ve defaults
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company?.id]);

  function formatPriceInput(value: number): string {
    if (!value || isNaN(value)) return "0";
    return String(value).replace(".", ",");
  }

  async function save() {
    if (!company?.id) return;

    const parsedMax = parseInt(maxRevisions, 10);
    const parsedPrice = parseFloat(extraPrice.replace(",", ".")) || 0;

    if (isNaN(parsedMax) || parsedMax < 0) {
      toast.error("Quantidade de revisões inválida");
      return;
    }
    if (parsedPrice < 0) {
      toast.error("Preço de revisão extra não pode ser negativo");
      return;
    }

    setSaving(true);
    try {
      await studioApi.saveSettings(company.id, {
        max_revisions_included: parsedMax,
        extra_revision_price: parsedPrice,
        revision_policy_text: policyText.trim(),
      });
      toast.success("✓ Política de revisões salva");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar política");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading state ───────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={t.primary} />
        <Text style={styles.loadingText}>Carregando política...</Text>
      </View>
    );
  }

  // ── Preview text ────────────────────────────────────────────
  const parsedMaxPreview = parseInt(maxRevisions, 10) || 0;
  const parsedPricePreview = parseFloat(extraPrice.replace(",", ".")) || 0;
  const previewFallback = buildDefaultPolicyText(
    parsedMaxPreview,
    parsedPricePreview,
  );
  const effectivePreview = policyText.trim() || previewFallback;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Icon name="refresh-cw" size={22} color={t.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Política de revisões</Text>
          <Text style={styles.headerSub}>
            Defina quantas revisões da arte estão inclusas no preço e quanto cobrar por revisões adicionais. Este texto aparece pro cliente no checkout do Canal Digital.
          </Text>
        </View>
      </View>

      {/* ── Card 1: Quantas revisões grátis ──────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardBadge, { backgroundColor: t.primaryGhost }]}>
            <Icon name="check-circle" size={16} color={t.primary} />
          </View>
          <Text style={styles.cardTitle}>Quantas revisões grátis incluídas no preço?</Text>
        </View>
        <Text style={styles.cardSub}>
          Número de revisões/alterações que o cliente pode pedir sem custo adicional.
        </Text>

        <View
          style={[
            styles.inputWrap,
            focusedField === "max" && styles.inputWrapFocused,
          ]}
        >
          <TextInput
            value={maxRevisions}
            onChangeText={(t) => setMaxRevisions(t.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="3"
            placeholderTextColor={t.ink4}
            style={styles.input}
            onFocus={() => setFocusedField("max")}
            onBlur={() => setFocusedField(null)}
            maxLength={3}
          />
          <Text style={styles.inputSuffix}>revisões</Text>
        </View>

        <View style={styles.hintRow}>
          <Icon name="info" size={12} color={t.ink3} />
          <Text style={styles.hintText}>
            Digite <Text style={styles.hintBold}>0</Text> pra liberar revisões ilimitadas (sem cobrança extra).
          </Text>
        </View>
      </View>

      {/* ── Card 2: Preço por revisão extra ──────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardBadge, { backgroundColor: t.accentGhost }]}>
            <Icon name="dollar-sign" size={16} color={t.accent} />
          </View>
          <Text style={styles.cardTitle}>Preço por revisão extra</Text>
        </View>
        <Text style={styles.cardSub}>
          Valor cobrado a partir da revisão {parsedMaxPreview + 1}ª (após estourar o limite incluso).
        </Text>

        <View
          style={[
            styles.inputWrap,
            focusedField === "price" && styles.inputWrapFocused,
          ]}
        >
          <Text style={styles.inputPrefix}>R$</Text>
          <TextInput
            value={extraPrice}
            onChangeText={(t) => setExtraPrice(t.replace(/[^0-9.,]/g, ""))}
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor={t.ink4}
            style={styles.input}
            onFocus={() => setFocusedField("price")}
            onBlur={() => setFocusedField(null)}
            maxLength={10}
          />
        </View>

        {parsedMaxPreview === 0 && (
          <View style={styles.warnRow}>
            <Icon name="info" size={12} color={t.warm} />
            <Text style={styles.warnText}>
              Como você definiu revisões ilimitadas, este preço não será cobrado.
            </Text>
          </View>
        )}
      </View>

      {/* ── Card 3: Texto da política ────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardBadge, { backgroundColor: t.primaryGhost }]}>
            <Icon name="file-text" size={16} color={t.primary} />
          </View>
          <Text style={styles.cardTitle}>Texto da política exibido ao cliente</Text>
        </View>
        <Text style={styles.cardSub}>
          Escreva o texto que aparecerá no checkout. Deixe em branco pra usar um texto automático baseado nos valores acima.
        </Text>

        <View
          style={[
            styles.textareaWrap,
            focusedField === "policy" && styles.inputWrapFocused,
          ]}
        >
          <TextInput
            value={policyText}
            onChangeText={setPolicyText}
            placeholder={`Ex: Você tem direito a ${parsedMaxPreview || 3} revisões grátis da arte. Cada revisão adicional custa R$ ${
              parsedPricePreview ? parsedPricePreview.toFixed(2).replace(".", ",") : "15,00"
            }. Use as revisões com calma — peça todas as alterações de uma vez :)`}
            placeholderTextColor={t.ink4}
            style={styles.textarea}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            onFocus={() => setFocusedField("policy")}
            onBlur={() => setFocusedField(null)}
            maxLength={500}
          />
        </View>

        <View style={styles.counterRow}>
          <Text style={styles.counterText}>
            {policyText.length} / 500 caracteres
          </Text>
        </View>
      </View>

      {/* ── Preview pro cliente ──────────────────────────────── */}
      <View style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <Icon name="eye" size={14} color={t.accent} />
          <Text style={styles.previewLabel}>Como o cliente vai ver no checkout</Text>
        </View>
        <View style={styles.previewBody}>
          <View style={styles.previewIconWrap}>
            <Icon name="refresh-cw" size={14} color={t.accent} />
          </View>
          <Text style={styles.previewText}>{effectivePreview}</Text>
        </View>
      </View>

      {/* ── CTA Salvar ───────────────────────────────────────── */}
      <Pressable
        onPress={save}
        disabled={saving}
        style={({ pressed }) => [
          styles.saveBtn,
          pressed && !saving && styles.saveBtnPressed,
          saving && styles.saveBtnDisabled,
        ]}
      >
        {saving ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.saveBtnText}>Salvando...</Text>
          </>
        ) : (
          <>
            <Icon name="save" size={16} color="#fff" />
            <Text style={styles.saveBtnText}>Salvar política</Text>
          </>
        )}
      </Pressable>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Helper: texto padrao quando o lojista nao escreve nada ──
function buildDefaultPolicyText(maxRevisions: number, extraPrice: number): string {
  if (maxRevisions === 0) {
    return "Você tem direito a revisões ilimitadas da arte. Pode pedir quantas alterações precisar — sem custo extra :)";
  }
  const priceFmt = extraPrice
    ? `R$ ${extraPrice.toFixed(2).replace(".", ",")}`
    : "valor a combinar";
  return `Você tem direito a ${maxRevisions} ${
    maxRevisions === 1 ? "revisão grátis" : "revisões grátis"
  } da arte. A partir da ${maxRevisions + 1}ª revisão, cobramos ${priceFmt} por alteração. Dica: peça todas as mudanças de uma vez pra economizar!`;
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────
const buildStyles = (t: StudioPalette) => StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: t.bg,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // ── Loading ─────────────────────────────────────────────
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
    backgroundColor: t.bg,
  },
  loadingText: {
    fontSize: 13,
    color: t.ink3,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    backgroundColor: t.paperCard,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.primaryBorder,
    marginBottom: 16,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: t.accentGhost,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: t.ink,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 13,
    lineHeight: 19,
    color: t.ink2,
  },

  // ── Cards ───────────────────────────────────────────────
  card: {
    backgroundColor: t.paperCard,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.primaryBorder,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  cardBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: t.ink,
  },
  cardSub: {
    fontSize: 12,
    lineHeight: 17,
    color: t.ink3,
    marginBottom: 12,
  },

  // ── Inputs ──────────────────────────────────────────────
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.paperCardElev,
    borderWidth: 1.5,
    borderColor: t.primaryBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  inputWrapFocused: {
    borderColor: t.primary,
    backgroundColor: t.primaryGhost,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: t.ink,
    paddingVertical: 0,
    fontWeight: "600",
  },
  inputPrefix: {
    fontSize: 14,
    fontWeight: "700",
    color: t.ink3,
    marginRight: 6,
  },
  inputSuffix: {
    fontSize: 13,
    color: t.ink3,
    marginLeft: 8,
  },

  // ── Textarea ────────────────────────────────────────────
  textareaWrap: {
    backgroundColor: t.paperCardElev,
    borderWidth: 1.5,
    borderColor: t.primaryBorder,
    borderRadius: 10,
    padding: 12,
    minHeight: 120,
  },
  textarea: {
    fontSize: 14,
    lineHeight: 20,
    color: t.ink,
    minHeight: 96,
  },
  counterRow: {
    marginTop: 6,
    alignItems: "flex-end",
  },
  counterText: {
    fontSize: 11,
    color: t.ink4,
  },

  // ── Hints ───────────────────────────────────────────────
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 11,
    color: t.ink3,
    lineHeight: 16,
  },
  hintBold: {
    fontWeight: "700",
    color: t.primary,
  },
  warnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: t.warmSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  warnText: {
    flex: 1,
    fontSize: 11,
    color: t.ink2,
    lineHeight: 16,
  },

  // ── Preview ─────────────────────────────────────────────
  previewCard: {
    backgroundColor: t.accentGhost,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.accentSoft,
    padding: 14,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: t.accent,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  previewBody: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: t.paperCardElev,
    padding: 12,
    borderRadius: 10,
    alignItems: "flex-start",
  },
  previewIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: t.accentGhost,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: t.ink2,
  },

  // ── Save CTA ────────────────────────────────────────────
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: t.accent,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: t.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});

export default TabStudioRevisoes;
