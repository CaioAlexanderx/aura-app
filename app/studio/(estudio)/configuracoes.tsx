// ============================================================
// AURA STUDIO · Configurações (Fase 0+5+12)
//
// 30/05/2026 (Camada 1 P1):
//   - Toggle "Exigir sinal pago para iniciar produção" (opt-in, default off)
//   - lê require_deposit_for_production de studioApi.getSettings (ao invés de health)
//   - salva via studioApi.saveSettings no mesmo save() existente
//
// 05/06/2026 (#7 Equipe & acessos):
//   - Card "Equipe & acessos" com MembersSection reutilizado do varejo
//   - Gate negocio+: plano essencial vê upsell, negocio/expansao/personalizado
//     veem o componente completo (mesma lógica de fallback do varejo)
// ============================================================
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Switch,
} from "react-native";
import { router } from "expo-router";
import { Icon } from "@/components/Icon";
import { MembersSection } from "@/components/MembersSection";
import { useStudioTokens, useStudioTheme, type StudioThemeMode } from "@/contexts/StudioThemeMode";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { studioApi, type StudioHealth } from "@/services/studioApi";
import { pdvSettingsApi, type PdvSettings } from "@/services/api";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { CardFeeSection, type CardFeePalette } from "@/components/screens/configuracoes/CardFeeSection";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

// ============================================================
// EQUIPE GATE — upsell para plano Essencial
// Espelha o padrão do varejo (EquipeGate em app/(tabs)/configuracoes.tsx)
// mas com tematização Studio (tokens navy/magenta).
// ============================================================
function EquipeGateStudio({ t }: { t: ReturnType<typeof useStudioTokens> }) {
  const eg = useMemo(() => StyleSheet.create({
    wrap:      { backgroundColor: t.bgSoft, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.ink5, gap: 10 },
    row:       { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 10 },
    label:     { fontSize: 13, color: t.ink3, flex: 1, lineHeight: 18 },
    badge:     { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, alignSelf: "flex-start" as const, backgroundColor: t.paperCardElev, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: t.ink5 },
    badgeText: { fontSize: 11, color: t.ink3, fontWeight: "600" as const },
  }), [t]);

  return (
    <View style={eg.wrap}>
      <View style={eg.row}>
        <Icon name="users" size={16} color={t.ink3} />
        <Text style={eg.label}>Convide sua equipe e defina permissões de acesso por módulo.</Text>
      </View>
      <Pressable onPress={() => router.push("/(tabs)/planos")} style={eg.badge}>
        <Icon name="lock" size={11} color={t.ink3} />
        <Text style={eg.badgeText}>A partir do plano Negócio</Text>
      </Pressable>
    </View>
  );
}

// ============================================================
// TAXA DA MAQUININHA — 18/08/2026
// A taxa vale pro shell Negocio E pro Studio (backend PR #501),
// mas empresas studio são redirecionadas de /configuracoes pelo
// guard do _layout e nunca viam o toggle do PdvSettingsCard.
// Este card renderiza a CardFeeSection compartilhada com tokens
// do Studio e o mesmo ciclo de save do varejo: PUT imediato do
// pdv_settings COMPLETO (o backend substitui o jsonb inteiro,
// então o payload parte sempre do GET com todas as chaves).
// ============================================================
function CardFeeCardStudio({ t, s }: { t: ReturnType<typeof useStudioTokens>; s: ReturnType<typeof buildStyles> }) {
  const { company } = useAuthStore();
  const { settings: serverSettings, isLoading, error, invalidate } = usePdvSettings();
  const [pendingSettings, setPendingSettings] = useState<PdvSettings | null>(null);
  const [feeSaving, setFeeSaving] = useState(false);

  const display = pendingSettings || serverSettings;

  const palette: CardFeePalette = useMemo(() => ({
    label:       t.ink,
    desc:        t.ink3,
    hint:        t.ink3,
    trackOff:    t.ink5,
    trackOn:     t.primary,
    thumbOff:    "#fff",
    thumbOn:     "#fff",
    inputBg:     t.paperCardElev,
    inputBorder: t.ink5,
    inputText:   t.ink,
    boxBorder:   t.ink5,
  }), [t]);

  async function toggle(key: keyof PdvSettings, value: boolean | number) {
    if (!company?.id || feeSaving) return;
    const next: PdvSettings = { ...display, [key]: value } as PdvSettings;
    setPendingSettings(next);
    setFeeSaving(true);
    try {
      await pdvSettingsApi.save(company.id, next);
      invalidate();
      setPendingSettings(null);
    } catch (err: any) {
      setPendingSettings(null);
      toast.error(err?.data?.error || "Erro ao salvar");
    } finally {
      setFeeSaving(false);
    }
  }

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Taxa da maquininha</Text>
      <Text style={s.cardSub}>Vale pras vendas no cartão do Studio inteiro. Salva na hora, sem precisar do botão lá embaixo.</Text>
      {isLoading ? (
        <ActivityIndicator size="small" color={t.primary} />
      ) : error ? (
        // Sem o GET não dá pra montar o payload completo — salvar aqui
        // zeraria as outras chaves do pdv_settings (o PUT substitui tudo).
        <Text style={s.hint}>Não consegui carregar as configurações do caixa. Recarregue a página pra editar a taxa.</Text>
      ) : (
        <CardFeeSection display={display} saving={feeSaving} onToggle={toggle} palette={palette} />
      )}
    </View>
  );
}

export default function StudioConfiguracoes() {
  const { company } = useAuthStore();
  const t = useStudioTokens();
  const { mode, setMode } = useStudioTheme();
  const s = useMemo(() => buildStyles(t), [t]);
  const qc = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setHealth] = useState<StudioHealth | null>(null);

  // Form state
  const [waPhone, setWaPhone] = useState("");
  const [slaDays, setSlaDays] = useState("3");
  const [approvalEnabled, setApprovalEnabled] = useState(false);
  const [approvalMode, setApprovalMode] = useState<"wa_me" | "whatsapp_business">("wa_me");
  // P1: gate de produção por sinal (opt-in, default false)
  const [requireDeposit, setRequireDeposit] = useState(false);

  // ============================================================
  // Gate equipe: negocio+ libera MembersSection.
  // Lógica idêntica ao fallback do varejo (sem fetch billing aqui
  // — Studio config é uma tela leve; o próprio MembersSection já
  // busca /members/billing internamente quando montado).
  // ============================================================
  const plan = company?.plan || "essencial";
  const hasTeamCapacity = plan !== "essencial";

  const load = useCallback(async () => {
    // QA fix (achado #18): sem company.id o loading ficava true pra sempre
    // (return antecipado sem setLoading(false)) — spinner infinito.
    if (!company?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const h = await studioApi.health(company.id);
      setHealth(h);
      setApprovalEnabled(!!h.approval_enabled);
      setApprovalMode(h.approval_mode || "wa_me");
      const ss: any = h.settings || {};
      if (ss.approval_wa_phone) setWaPhone(String(ss.approval_wa_phone));
      if (ss.default_sla_days)  setSlaDays(String(ss.default_sla_days));
      // P1: carrega o toggle de gate de produção
      if (ss.require_deposit_for_production !== undefined) {
        setRequireDeposit(Boolean(ss.require_deposit_for_production));
      }
    } catch (e: any) {
      console.warn("[studio/configuracoes] health falhou:", e?.message);
      toast.error(e?.message || "Não consegui carregar — usando padrões");
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!company?.id) { toast.error("Empresa não identificada"); return; }
    setSaving(true);
    const slaDaysNum = parseInt(slaDays, 10);
    const phoneTrimmed = waPhone.trim();

    console.log("[StudioConfig] save start", { cid: company.id, approvalEnabled, approvalMode, slaDaysNum, phoneTrimmed, requireDeposit });

    try {
      // 18/08/2026: o PUT /pdv-settings SUBSTITUI o jsonb inteiro — chave
      // ausente do payload volta pro default no backend. Antes, GET falho
      // caía num objeto mínimo hardcoded e o save zerava o resto (inclusive
      // card_fee_* agora que a taxa é editável aqui). Sem o GET, pula o PUT
      // em vez de salvar por cima.
      let currentPdv: PdvSettings | null = null;
      try {
        const cur = await pdvSettingsApi.get(company.id);
        currentPdv = cur.settings;
      } catch (getErr: any) {
        console.warn("[StudioConfig] pdvSettingsApi.get falhou, pulando save do pdv_settings:", getErr?.message);
      }

      let pdvSaved = false;
      if (currentPdv) {
        const mergedPdv: PdvSettings = { ...currentPdv, studio_approval_enabled: approvalEnabled, studio_approval_mode: approvalMode };
        await pdvSettingsApi.save(company.id, mergedPdv);
        pdvSaved = true;
        // Mantém o card da taxa da maquininha em sincronia (cache infinito).
        qc.invalidateQueries({ queryKey: ["pdv-settings", company.id] });
      }

      const studioPatch: Record<string, any> = {};
      if (!isNaN(slaDaysNum) && slaDaysNum > 0) studioPatch.default_sla_days = slaDaysNum;
      if (phoneTrimmed) studioPatch.approval_wa_phone = phoneTrimmed;
      // P1: sempre salva o toggle (pode ser true ou false)
      studioPatch.require_deposit_for_production = requireDeposit;

      // QA fix (achado #19): o catch abaixo fazia `return` direto, pulando
      // o load() final — a tela ficava com valores que não estavam
      // salvos no servidor. Agora só marca a falha parcial e segue pro
      // load() no fim, que é chamado SEMPRE (inclusive nos caminhos de
      // erro parcial), pra tela nunca mostrar algo que não foi persistido.
      let studioPatchSaved = true;
      if (Object.keys(studioPatch).length > 0) {
        try {
          await studioApi.saveSettings(company.id, studioPatch);
        } catch (ssErr: any) {
          console.warn("[StudioConfig] saveSettings falhou:", ssErr?.message);
          const detail = ssErr?.data?.error || ssErr?.message || "erro desconhecido";
          toast.error("Toggles salvos, mas SLA/WhatsApp falharam: " + detail);
          studioPatchSaved = false;
        }
      }

      if (pdvSaved && studioPatchSaved) {
        toast.success("Configurações salvas!");
      } else if (pdvSaved && !studioPatchSaved) {
        // toast específico já disparado acima
      } else {
        toast.error("Prazo/WhatsApp salvos, mas a aprovação de arte não foi — recarregue e tente de novo.");
      }
      load();
    } catch (e: any) {
      console.error("[StudioConfig] save error", { status: e?.status, code: e?.code, data: e?.data, message: e?.message });
      const status = e?.status ? `[${e.status}] ` : "";
      const detail = e?.data?.error || e?.message || "Erro ao salvar";
      toast.error(status + detail);
    } finally {
      setSaving(false);
    }
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
    { key: "auto", icon: "refresh", label: "Sistema" },
  ];

  return (
    <StudioScreen variant="reading">
      {/* Header */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>CONFIGURAÇÕES · STUDIO</Text>
          <Text style={s.title}>Ajustes do seu estúdio</Text>
          <Text style={s.sub}>Prazos de produção, WhatsApp para aprovações e o que está habilitado no modo Studio.</Text>
        </View>
      </View>

      {/* Aparência */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Aparência</Text>
        <Text style={s.cardSub}>Escolha o tema visual do Studio. Auto segue a preferência do sistema.</Text>
        <View style={s.themeChipsRow}>
          {themeOptions.map((opt) => {
            const active = mode === opt.key;
            return (
              <Pressable key={opt.key} onPress={() => setMode(opt.key)} style={[s.themeChip, active && s.themeChipActive]}>
                <Icon name={opt.icon as any} size={14} color={active ? "#fff" : t.ink3} />
                <Text style={[s.themeChipTxt, active && s.themeChipTxtActive]}>{opt.label}</Text>
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
            <TextInput style={s.input} keyboardType="number-pad" value={slaDays} onChangeText={setSlaDays} placeholder="3" />
            <Text style={s.hint}>Quantos dias úteis cada produto leva pra ficar pronto, em média.</Text>
          </View>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={s.label}>WhatsApp da loja</Text>
            <TextInput style={s.input} keyboardType="phone-pad" value={waPhone} onChangeText={setWaPhone} placeholder="(11) 99999-9999" />
            <Text style={s.hint}>Número usado nos links wa.me/... pra enviar mockup pro cliente.</Text>
          </View>
        </View>

        {/* P1: Toggle gate de produção por sinal */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Exigir sinal pago para iniciar produção</Text>
            <Text style={s.toggleSub}>
              Quando ativo, o pedido não avança para "Em produção" sem sinal confirmado. O lojista pode forçar manualmente caso a caso.
            </Text>
          </View>
          <Switch
            value={requireDeposit}
            onValueChange={setRequireDeposit}
            trackColor={{ false: t.ink5, true: t.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* QA fix (achado #3): /studio/configuracoes/precificacao não era
          linkada de lugar nenhum (Motor de Precificação inteiro invisível
          pro lojista) e /studio/configuracoes/marketplace só era alcançável
          de dentro de uma tela de pedidos. Adiciona os dois acessos aqui. */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Vendas</Text>
        <Text style={s.cardSub}>Regras de preço automático e anúncios em marketplaces.</Text>

        <Pressable style={s.linkRow} onPress={() => router.push("/studio/configuracoes/precificacao" as any)}>
          <View style={[s.linkIconWrap, { backgroundColor: t.primaryGhost }]}>
            <Icon name="dollar-sign" size={16} color={t.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.linkTitle}>Motor de Precificação</Text>
            <Text style={s.linkSub}>Custo de arte, mão de obra, margem e faixas de tiragem por produto.</Text>
          </View>
          <Icon name="chevron-right" size={16} color={t.ink4} />
        </Pressable>

        <Pressable style={s.linkRow} onPress={() => router.push("/studio/configuracoes/marketplace" as any)}>
          <View style={[s.linkIconWrap, { backgroundColor: t.accentGhost }]}>
            <Icon name="external-link" size={16} color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.linkTitle}>Anúncios em Marketplaces</Text>
            <Text style={s.linkSub}>Prazo de produção e preview do anúncio Studio-aware pra ML/Shopee.</Text>
          </View>
          <Icon name="chevron-right" size={16} color={t.ink4} />
        </Pressable>
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
          <Switch value={approvalEnabled} onValueChange={setApprovalEnabled} trackColor={{ false: t.ink5, true: t.primary }} thumbColor="#fff" />
        </View>

        {approvalEnabled && (
          <View style={{ marginTop: 12 }}>
            <Text style={s.label}>Como mandar o mockup</Text>
            <View style={s.modeRow}>
              <Pressable style={[s.modeCard, approvalMode === "wa_me" && s.modeCardSel]} onPress={() => setApprovalMode("wa_me")}>
                <Icon name="message-circle" size={16} color={approvalMode === "wa_me" ? "#fff" : t.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.modeTitle, approvalMode === "wa_me" && { color: "#fff" }]}>wa.me link</Text>
                  <Text style={[s.modeSub, approvalMode === "wa_me" && { color: "rgba(255,255,255,0.85)" }]}>Abre o WhatsApp do cliente com mensagem pronta. Sem mensalidade de API.</Text>
                </View>
                {approvalMode === "wa_me" && <Icon name="check" size={14} color="#fff" />}
              </Pressable>
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

      {/* Taxa da maquininha — save imediato, fora do botão Salvar */}
      <CardFeeCardStudio t={t} s={s} />

      {/* Equipe & acessos */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Equipe & acessos</Text>
        <Text style={s.cardSub}>
          Convide colaboradores, defina permissões por módulo e gerencie quem acessa o Studio.
        </Text>
        {hasTeamCapacity
          ? <MembersSection />
          : <EquipeGateStudio t={t} />
        }
      </View>

      {/* Save */}
      <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator size="small" color="#fff" /> : (
          <><Icon name="check" size={16} color="#fff" /><Text style={s.saveBtnTxt}>Salvar configurações</Text></>
        )}
      </Pressable>
    </StudioScreen>
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
    themeChipsRow: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
    themeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: t.bgSoft, borderRadius: 999, borderWidth: 1, borderColor: t.ink5 },
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
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: t.ink5,
    },
    linkIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    linkTitle: { fontSize: 13.5, fontWeight: "700", color: t.ink },
    linkSub: { fontSize: 11.5, color: t.ink3, marginTop: 2, lineHeight: 15 },
    modeRow: { gap: 8 },
    modeCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: t.paperCardElev, borderRadius: 12, borderWidth: 1.5, borderColor: t.ink5 },
    modeCardSel: { backgroundColor: t.primary, borderColor: t.primary },
    modeTitle: { fontSize: 13.5, fontWeight: "700", color: t.ink },
    modeSub: { fontSize: 11.5, color: t.ink3, marginTop: 2, lineHeight: 16 },
    saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, marginTop: 6 },
    saveBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  });
}
