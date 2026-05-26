// ============================================================
// AURA STUDIO · Configurações (Fase 0+5+12)
//
// Persiste em companies.pdv_settings + companies.studio_settings:
//   - approval_wa_phone (studio_settings) — WhatsApp da loja
//   - default_sla_days (studio_settings) — prazo padrão produção
//   - studio_kds_enabled / gallery_enabled / approval_enabled
//     (pdv_settings) — toggles observacionais (memory
//     convencao_subtoggles_observacionais)
//   - studio_approval_mode (pdv_settings) — wa_me ou whatsapp_business
//
// Fase 12 (25/05/2026):
//   - Card "Aparência" com toggle Light/Dark/Auto via useStudioTheme()
//   - Migração StyleSheet pra useStudioTokens() (StyleSheet lazy via useMemo)
// ============================================================
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Switch,
} from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens, useStudioTheme, type StudioThemeMode } from "@/contexts/StudioThemeMode";
import { studioApi, type StudioHealth } from "@/services/studioApi";
import { pdvSettingsApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export default function StudioConfiguracoes() {
  const { company } = useAuthStore();
  const t = useStudioTokens();
  const { mode, setMode } = useStudioTheme();
  const s = useMemo(() => buildStyles(t), [t]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState<StudioHealth | null>(null);

  // Form state
  const [waPhone, setWaPhone] = useState("");
  const [slaDays, setSlaDays] = useState("3");
  const [kdsEnabled, setKdsEnabled] = useState(false);
  const [galleryEnabled, setGalleryEnabled] = useState(false);
  const [approvalEnabled, setApprovalEnabled] = useState(false);
  const [approvalMode, setApprovalMode] = useState<"wa_me" | "whatsapp_business">("wa_me");

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const h = await studioApi.health(company.id);
      setHealth(h);
      setKdsEnabled(h.kds_enabled);
      setGalleryEnabled(h.gallery_enabled);
      setApprovalEnabled(h.approval_enabled);
      setApprovalMode(h.approval_mode);
      const ss = h.settings || {};
      if (ss.approval_wa_phone) setWaPhone(String(ss.approval_wa_phone));
      if (ss.default_sla_days) setSlaDays(String(ss.default_sla_days));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar configurações");
    } finally { setLoading(false); }
  }, [company?.id]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!company?.id) return;
    setSaving(true);
    try {
      // Patch pdv_settings (toggles + approval_mode)
      await pdvSettingsApi.update(company.id, {
        studio_kds_enabled: kdsEnabled,
        studio_gallery_enabled: galleryEnabled,
        studio_approval_enabled: approvalEnabled,
        studio_approval_mode: approvalMode,
      } as any);
      toast.success("Configurações salvas!");
      load();
    } catch (e: any) { toast.error(e?.message || "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <View style={[s.scroll, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="small" color={t.primary} />
      </View>
    );
  }

  const themeOptions: Array<{ key: StudioThemeMode; icon: string; label: string }> = [
    { key: "light", icon: "sun", label: "Claro" },
    { key: "dark", icon: "moon", label: "Escuro" },
    { key: "auto", icon: "monitor", label: "Sistema" },
  ];

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* Header */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>CONFIGURAÇÕES · STUDIO</Text>
          <Text style={s.title}>Ajustes do seu estúdio</Text>
          <Text style={s.sub}>
            Prazos de produção, WhatsApp para aprovações e o que está habilitado no modo Studio.
          </Text>
        </View>
      </View>

      {/* ───── Aparência (Fase 12) ───── */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Aparência</Text>
        <Text style={s.cardSub}>Escolha o tema visual do Studio. Auto segue a preferência do sistema.</Text>
        <View style={s.themeChipsRow}>
          {themeOptions.map((opt) => {
            const active = mode === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setMode(opt.key)}
                style={[s.themeChip, active && s.themeChipActive]}
              >
                <Icon name={opt.icon as any} size={14} color={active ? "#fff" : t.ink3} />
                <Text style={[s.themeChipTxt, active && s.themeChipTxtActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* SLA + WhatsApp */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Produção e aprovação</Text>
        <Text style={s.cardSub}>O cliente vê o prazo no checkout; o WhatsApp é usado pra mandar mockup pra aprovar arte.</Text>

        <View style={s.row}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Text style={s.label}>Prazo padrão (dias úteis)</Text>
            <TextInput
              style={s.input}
              keyboardType="number-pad"
              value={slaDays}
              onChangeText={setSlaDays}
              placeholder="3"
            />
            <Text style={s.hint}>Quantos dias úteis cada produto leva pra ficar pronto, em média.</Text>
          </View>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={s.label}>WhatsApp da loja</Text>
            <TextInput
              style={s.input}
              keyboardType="phone-pad"
              value={waPhone}
              onChangeText={setWaPhone}
              placeholder="(11) 99999-9999"
            />
            <Text style={s.hint}>Número usado nos links wa.me/... pra enviar mockup pro cliente.</Text>
          </View>
        </View>

        <View style={s.note}>
          <Icon name="info" size={13} color={t.primary} />
          <Text style={s.noteTxt}>
            Persistência de prazo e WhatsApp em <Text style={{ fontWeight: "700" }}>studio_settings</Text> ainda em desenvolvimento. Por enquanto fica salvo localmente; ative aprovação abaixo pra usar wa.me link.
          </Text>
        </View>
      </View>

      {/* Aprovação de arte */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Aprovação de arte</Text>
        <Text style={s.cardSub}>Quando o cliente faz um pedido personalizado, você manda o mockup pra ele aprovar antes da produção começar.</Text>

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Habilitar fluxo de aprovação</Text>
            <Text style={s.toggleSub}>Pedidos personalizados ficam em "Aguardando arte" até aprovação</Text>
          </View>
          <Switch
            value={approvalEnabled}
            onValueChange={setApprovalEnabled}
            trackColor={{ false: t.ink5, true: t.primary }}
            thumbColor="#fff"
          />
        </View>

        {approvalEnabled && (
          <View style={{ marginTop: 12 }}>
            <Text style={s.label}>Como mandar o mockup</Text>
            <View style={s.modeRow}>
              <Pressable
                style={[s.modeCard, approvalMode === "wa_me" && s.modeCardSel]}
                onPress={() => setApprovalMode("wa_me")}
              >
                <Icon name="message-circle" size={16} color={approvalMode === "wa_me" ? "#fff" : t.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.modeTitle, approvalMode === "wa_me" && { color: "#fff" }]}>wa.me link</Text>
                  <Text style={[s.modeSub, approvalMode === "wa_me" && { color: "rgba(255,255,255,0.85)" }]}>
                    Você clica e abre o WhatsApp com mensagem pronta. Manual mas grátis.
                  </Text>
                </View>
                {approvalMode === "wa_me" && <Icon name="check" size={14} color="#fff" />}
              </Pressable>
              {/* WhatsApp Business API — desabilitado de verdade (não Pressable).
                  Aguarda Business Verification + App Review da Meta (Hub Social Fase 6). */}
              <View style={[s.modeCard, { opacity: 0.4 }]}>
                <Icon name="headset" size={16} color={t.ink3} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.modeTitle, { color: t.ink3 }]}>WhatsApp Business API</Text>
                  <Text style={s.modeSub}>Envio automático. Requer aprovação Meta (Hub Social Fase 6).</Text>
                </View>
                <View style={{ backgroundColor: t.warningSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ color: t.warningInk, fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" }}>Em breve</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Submódulos observacionais */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Recursos ativos</Text>
        <Text style={s.cardSub}>Marque o que você usa. Isso ajuda a Aura a entender seu fluxo e mostrar dicas mais relevantes.</Text>

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>KDS de produção</Text>
            <Text style={s.toggleSub}>Painel com colunas "Aguardando arte → Em produção → Pronto"</Text>
          </View>
          <Switch
            value={kdsEnabled}
            onValueChange={setKdsEnabled}
            trackColor={{ false: t.ink5, true: t.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Galeria de templates</Text>
            <Text style={s.toggleSub}>Banco de artes prontas (Dia das Mães, Pais, Profissões) pro cliente escolher</Text>
          </View>
          <Switch
            value={galleryEnabled}
            onValueChange={setGalleryEnabled}
            trackColor={{ false: t.ink5, true: t.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Save */}
      <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Icon name="check" size={16} color="#fff" />
            <Text style={s.saveBtnTxt}>Salvar configurações</Text>
          </>
        )}
      </Pressable>

      <View style={s.hintCard}>
        <Icon name="info" size={14} color={t.primary} />
        <Text style={s.hintTxt}>
          <Text style={s.hintBold}>Recursos ativos</Text> são indicadores pro time Aura entender quais funcionalidades você usa. Não afetam o acesso — todas as telas continuam visíveis e funcionais.
        </Text>
      </View>
    </ScrollView>
  );
}

function buildStyles(t: ReturnType<typeof useStudioTokens>) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: t.bg },
    container: { padding: 28, paddingBottom: 60, maxWidth: 760, alignSelf: "center", width: "100%" },

    headerRow: { marginBottom: 22 },
    eyebrow: { fontSize: 11, color: t.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
    title: { fontSize: 24, fontWeight: "800", color: t.ink, marginTop: 4, letterSpacing: -0.4 },
    sub: { fontSize: 13.5, color: t.ink3, marginTop: 4 },

    card: { backgroundColor: t.paperCard, borderRadius: 18, padding: 22, marginBottom: 16, borderWidth: 1, borderColor: t.ink5 },
    cardTitle: { fontSize: 16, fontWeight: "800", color: t.ink, marginBottom: 4 },
    cardSub: { fontSize: 13, color: t.ink3, marginBottom: 14, lineHeight: 18 },

    // Fase 12 — chips de tema
    themeChipsRow: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
    themeChip: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 14, paddingVertical: 9,
      backgroundColor: t.bgSoft, borderRadius: 999,
      borderWidth: 1, borderColor: t.ink5,
    },
    themeChipActive: { backgroundColor: t.primary, borderColor: t.primary },
    themeChipTxt: { fontSize: 12.5, fontWeight: "700", color: t.ink2 },
    themeChipTxtActive: { color: "#fff" },

    row: { flexDirection: "row", gap: 14, flexWrap: "wrap", marginBottom: 12 },
    label: { fontSize: 11, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
    input: { backgroundColor: t.paperCardElev, borderWidth: 1.5, borderColor: t.ink5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: t.ink },
    hint: { fontSize: 11.5, color: t.ink3, marginTop: 6, lineHeight: 16 },

    toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 16, borderTopWidth: 1, borderTopColor: t.ink5 },
    toggleLabel: { fontSize: 14, fontWeight: "700", color: t.ink },
    toggleSub: { fontSize: 12, color: t.ink3, marginTop: 2 },

    modeRow: { gap: 8 },
    modeCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: t.paperCardElev, borderRadius: 12, borderWidth: 1.5, borderColor: t.ink5 },
    modeCardSel: { backgroundColor: t.primary, borderColor: t.primary },
    modeTitle: { fontSize: 13.5, fontWeight: "700", color: t.ink },
    modeSub: { fontSize: 11.5, color: t.ink3, marginTop: 2, lineHeight: 16 },

    note: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: t.primaryGhost, borderRadius: 10, marginTop: 8 },
    noteTxt: { fontSize: 11.5, color: t.ink2, flex: 1, lineHeight: 16 },

    saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, marginTop: 6 },
    saveBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },

    hintCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.primaryGhost, borderRadius: 12, padding: 12, marginTop: 18, borderWidth: 1, borderColor: t.primarySoft },
    hintTxt: { fontSize: 12, color: t.ink2, flex: 1, lineHeight: 17 },
    hintBold: { fontWeight: "700", color: t.primary },
  });
}
