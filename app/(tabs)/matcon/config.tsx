// ============================================================
// AURA. — Matcon (materiais de construção): configurações (M0)
//
// docs/matcon-faseamento-po-ux.md §4b, regra 1: "uma frase, não um
// formulário". Cada ajuste é uma frase em português com o número/chip
// editável no meio (mockup docs/mockups/matcon-modulo.html#config,
// classes .frase/.edit/.sw). Molde de código: app/(tabs)/otica/config.tsx
// (header, dirty/saving, toast, estilos Colors/Fonts).
//
// 22/09/2026 (revisão de texto): o subtítulo e a nota de rodapé falavam
// com a gente ("sem jargão de ERP", "fator de conversão"), não com o dono
// da loja. Agora só dizem o que ele precisa saber. O programa chama "profissionais
// parceiros" aqui e em todo o Matcon.
//
// Fonte única de defaults: constants/matcon.ts (readMatconSettings). O PUT
// de pdv_settings faz merge parcial (services/authApi.ts) — salvamos só as
// chaves que mudaram.
//
// Chave de módulo: matcon.config (Essencial), já cadastrada em
// hooks/useVisibleModules.ts. Em M0 esta tela não entra no menu lateral —
// o único acesso é o link em Configurações › Caixa (PdvSettingsCard).
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Switch } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { pdvSettingsApi, type PdvSettings } from "@/services/api";
import { readMatconSettings, type MatconSettings } from "@/constants/matcon";
import { MATCON_UNITS } from "@/utils/matconUnits";

// Ordem de exibição: os 8 primeiros de MATCON_UNITS ficam sempre visíveis
// (batem com o default de constants/matcon.ts); o resto ("+ rolo, lata,
// balde") só aparece depois de tocar no chip "+" — mockup linha 332-335.
const UNITS_PRIMARY = MATCON_UNITS.slice(0, 8);
const UNITS_EXTRA = MATCON_UNITS.slice(8);

type Draft = {
  units: string[];
  wastePct: string;
  roundToPackage: boolean;
  // M4 — "Controlo lote e tonalidade nos produtos vendidos em m² e m³"
  // (docs/mockups/matcon-m4-profundidade.html#entrada).
  lotsEnabled: boolean;
  deliveryDays: string;
  quoteValidDays: string;
  quoteWarnDays: string;
  // M3 — Profissionais Parceiros (docs/mockups/matcon-m3-clube-calculadora.html#config).
  clubEnabled: boolean;
  pointsPer100: string;
  pointsToCoupon: string;
  couponValue: string;
};

function draftFromSettings(m: MatconSettings): Draft {
  return {
    units: m.matcon_units,
    wastePct: String(m.matcon_default_waste_pct),
    roundToPackage: m.matcon_round_to_package,
    lotsEnabled: m.matcon_lots_enabled,
    deliveryDays: String(m.matcon_default_delivery_days),
    quoteValidDays: String(m.matcon_quote_valid_days),
    quoteWarnDays: String(m.matcon_quote_warn_days),
    clubEnabled: m.matcon_club_enabled,
    pointsPer100: String(m.matcon_points_per_100),
    pointsToCoupon: String(m.matcon_points_to_coupon),
    couponValue: String(m.matcon_coupon_value),
  };
}

function sameUnits(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((u) => b.includes(u));
}

export default function MatconConfigScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const { settings, isLoading, invalidate } = usePdvSettings();
  const enabled = settings.matcon_enabled === true;
  const loaded = useMemo(() => readMatconSettings(settings as Partial<MatconSettings>), [settings]);

  const [draft, setDraft] = useState<Draft>(() => draftFromSettings(loaded));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showExtraUnits, setShowExtraUnits] = useState(() => loaded.matcon_units.some((u) => (UNITS_EXTRA as readonly string[]).includes(u)));

  // Recarrega o rascunho quando o servidor devolve dado novo (mount / save).
  useEffect(() => {
    setDraft(draftFromSettings(loaded));
    setDirty(false);
    if (loaded.matcon_units.some((u) => (UNITS_EXTRA as readonly string[]).includes(u))) setShowExtraUnits(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  function set(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  }

  function toggleUnit(u: string) {
    set({ units: draft.units.includes(u) ? draft.units.filter((x) => x !== u) : [...draft.units, u] });
  }

  async function save() {
    if (!company?.id || saving) return;

    const wastePct = parseInt(draft.wastePct.replace(/\D/g, ""), 10);
    const deliveryDays = parseInt(draft.deliveryDays.replace(/\D/g, ""), 10);
    const quoteValidDays = parseInt(draft.quoteValidDays.replace(/\D/g, ""), 10);
    const quoteWarnDays = parseInt(draft.quoteWarnDays.replace(/\D/g, ""), 10);

    if (!isFinite(wastePct) || wastePct < 0 || wastePct > 50) {
      toast.error("A perda por quebra e recorte tem que ficar entre 0 e 50%");
      return;
    }
    if (!isFinite(deliveryDays) || deliveryDays < 0 || deliveryDays > 60) {
      toast.error("O prazo de entrega tem que ficar entre 0 e 60 dias");
      return;
    }
    if (!isFinite(quoteValidDays) || quoteValidDays < 0 || quoteValidDays > 60) {
      toast.error("A validade do orçamento tem que ficar entre 0 e 60 dias");
      return;
    }
    if (!isFinite(quoteWarnDays) || quoteWarnDays < 0 || quoteWarnDays > 60) {
      toast.error("O aviso de vencimento tem que ficar entre 0 e 60 dias");
      return;
    }
    if (quoteWarnDays > quoteValidDays) {
      toast.error("O aviso ao vendedor não pode vencer depois do orçamento");
      return;
    }

    const pointsPer100 = parseInt(draft.pointsPer100.replace(/\D/g, ""), 10);
    const pointsToCoupon = parseInt(draft.pointsToCoupon.replace(/\D/g, ""), 10);
    const couponValue = parseInt(draft.couponValue.replace(/\D/g, ""), 10);

    if (!isFinite(pointsPer100) || pointsPer100 < 1 || pointsPer100 > 10000) {
      toast.error("Os pontos por R$ 100 têm que ficar entre 1 e 10.000");
      return;
    }
    if (!isFinite(pointsToCoupon) || pointsToCoupon < 1 || pointsToCoupon > 100000) {
      toast.error("Os pontos por cupom têm que ficar entre 1 e 100.000");
      return;
    }
    if (!isFinite(couponValue) || couponValue < 1 || couponValue > 10000) {
      toast.error("O valor do cupom tem que ficar entre R$ 1 e R$ 10.000");
      return;
    }

    // Só manda pro PUT (merge parcial) as chaves que mudaram de fato.
    const patch: Partial<PdvSettings> = {};
    if (!sameUnits(draft.units, loaded.matcon_units)) patch.matcon_units = draft.units;
    if (wastePct !== loaded.matcon_default_waste_pct) patch.matcon_default_waste_pct = wastePct;
    if (draft.roundToPackage !== loaded.matcon_round_to_package) patch.matcon_round_to_package = draft.roundToPackage;
    if (draft.lotsEnabled !== loaded.matcon_lots_enabled) patch.matcon_lots_enabled = draft.lotsEnabled;
    if (deliveryDays !== loaded.matcon_default_delivery_days) patch.matcon_default_delivery_days = deliveryDays;
    if (quoteValidDays !== loaded.matcon_quote_valid_days) patch.matcon_quote_valid_days = quoteValidDays;
    if (quoteWarnDays !== loaded.matcon_quote_warn_days) patch.matcon_quote_warn_days = quoteWarnDays;
    if (draft.clubEnabled !== loaded.matcon_club_enabled) patch.matcon_club_enabled = draft.clubEnabled;
    if (pointsPer100 !== loaded.matcon_points_per_100) patch.matcon_points_per_100 = pointsPer100;
    if (pointsToCoupon !== loaded.matcon_points_to_coupon) patch.matcon_points_to_coupon = pointsToCoupon;
    if (couponValue !== loaded.matcon_coupon_value) patch.matcon_coupon_value = couponValue;

    if (Object.keys(patch).length === 0) { setDirty(false); return; }

    setSaving(true);
    try {
      await pdvSettingsApi.save(company.id, patch);
      qc.invalidateQueries({ queryKey: ["pdv-settings", company.id] });
      invalidate();
      setDirty(false);
      toast.success("Configurações salvas");
    } catch (e: any) {
      toast.error(e?.data?.error || "Não deu para salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <Pressable onPress={() => router.back()} style={st.backBtn}>
        <Icon name="chevron_left" size={16} color={Colors.violet3} />
        <Text style={st.backText}>Voltar</Text>
      </Pressable>
      <Text style={st.pageTitle}>Materiais de construção<Text style={{ color: Colors.violet }}>.</Text></Text>
      <Text style={st.pageSubtitle}>Unidades, perda por quebra, embalagem fechada, entrega, orçamento e profissionais parceiros. Cada ajuste é uma frase: mexa só no número.</Text>

      {!enabled ? (
        <View style={st.gate}>
          <View style={st.gateIcon}><Icon name="lock" size={20} color={Colors.violet3} /></View>
          <Text style={st.gateTitle}>Ligue &quot;Materiais de construção&quot; em Configurações › Caixa</Text>
          <Text style={st.gateDesc}>Essas configurações só valem depois que o módulo estiver ligado para esta loja.</Text>
          <Pressable onPress={() => router.push("/configuracoes" as any)} style={st.gateBtn} testID="matcon-cfg-ir-config">
            <Text style={st.gateBtnText}>Abrir Configurações</Text>
            <Icon name="chevron_right" size={14} color="#fff" />
          </Pressable>
        </View>
      ) : isLoading ? (
        <View style={st.card}><Text style={st.hint}>Carregando…</Text></View>
      ) : (
        <>
          <View style={st.card}>
            {/* ── Unidades ── */}
            <View style={st.frase}>
              <Text style={st.fraseText}>Minha loja vende em</Text>
              <View style={st.chipRow}>
                {UNITS_PRIMARY.map((u) => (
                  <Pressable key={u} onPress={() => toggleUnit(u)} style={[st.chip, draft.units.includes(u) && st.chipOn]} testID={`matcon-cfg-unidade-${u}`}>
                    <Text style={[st.chipText, draft.units.includes(u) && st.chipTextOn]}>{u}</Text>
                  </Pressable>
                ))}
                {!showExtraUnits ? (
                  <Pressable onPress={() => setShowExtraUnits(true)} style={st.chipMore} testID="matcon-cfg-unidades-mais">
                    <Text style={st.chipMoreText}>+ {UNITS_EXTRA.join(", ")}</Text>
                  </Pressable>
                ) : (
                  UNITS_EXTRA.map((u) => (
                    <Pressable key={u} onPress={() => toggleUnit(u)} style={[st.chip, draft.units.includes(u) && st.chipOn]} testID={`matcon-cfg-unidade-${u}`}>
                      <Text style={[st.chipText, draft.units.includes(u) && st.chipTextOn]}>{u}</Text>
                    </Pressable>
                  ))
                )}
              </View>
            </View>

            <View style={st.divider} />

            {/* ── Perda padrão ── */}
            <View style={st.frase}>
              <Text style={st.fraseText}>
                Em piso e revestimento, considero{" "}
                <TextInput
                  style={st.editSmall}
                  value={draft.wastePct}
                  onChangeText={(v) => set({ wastePct: v.replace(/\D/g, "").slice(0, 2) })}
                  keyboardType="number-pad"
                  maxLength={2}
                  testID="matcon-cfg-perda"
                />{" "}
                % de perda por quebra e recorte ao calcular o ambiente.
              </Text>
            </View>

            <View style={st.divider} />

            {/* ── Arredondar para embalagem ── */}
            <View style={st.frase}>
              <Text style={st.fraseText}>
                Quando o cliente pede menos que uma embalagem fechada,{" "}
                <Switch
                  value={draft.roundToPackage}
                  onValueChange={(v) => set({ roundToPackage: v })}
                  trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
                  thumbColor={draft.roundToPackage ? Colors.violet : Colors.ink3}
                  testID="matcon-cfg-arredondar"
                />{" "}
                arredondo para a caixa cheia e mostro a sobra.
              </Text>
            </View>

            <View style={st.divider} />

            {/* ── Lote e tonalidade (M4) ── */}
            <View style={st.frase}>
              <Text style={st.fraseText}>
                Controlo lote e tonalidade nos produtos vendidos em m² e m³{" "}
                <Switch
                  value={draft.lotsEnabled}
                  onValueChange={(v) => set({ lotsEnabled: v })}
                  trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
                  thumbColor={draft.lotsEnabled ? Colors.violet : Colors.ink3}
                  testID="matcon-cfg-lotes"
                />
              </Text>
            </View>

            <View style={st.divider} />

            {/* ── Prazo de entrega ── */}
            <View style={st.frase}>
              <Text style={st.fraseText}>
                Prometo a entrega para{" "}
                <TextInput
                  style={st.editSmall}
                  value={draft.deliveryDays}
                  onChangeText={(v) => set({ deliveryDays: v.replace(/\D/g, "").slice(0, 2) })}
                  keyboardType="number-pad"
                  maxLength={2}
                  testID="matcon-cfg-entrega-dias"
                />{" "}
                dias depois da venda.
              </Text>
            </View>

            <View style={st.divider} />

            {/* ── Validade e aviso do orçamento ── */}
            <View style={st.frase}>
              <Text style={st.fraseText}>
                Meus orçamentos valem{" "}
                <TextInput
                  style={st.editSmall}
                  value={draft.quoteValidDays}
                  onChangeText={(v) => set({ quoteValidDays: v.replace(/\D/g, "").slice(0, 2) })}
                  keyboardType="number-pad"
                  maxLength={2}
                  testID="matcon-cfg-orcamento-validade"
                />{" "}
                dias e avisam o vendedor{" "}
                <TextInput
                  style={st.editSmall}
                  value={draft.quoteWarnDays}
                  onChangeText={(v) => set({ quoteWarnDays: v.replace(/\D/g, "").slice(0, 2) })}
                  keyboardType="number-pad"
                  maxLength={2}
                  testID="matcon-cfg-orcamento-aviso"
                />{" "}
                dias antes de vencer.
              </Text>
            </View>

            <View style={st.divider} />

            {/* ── Profissionais Parceiros (M3) ── */}
            <View style={st.frase}>
              <Text style={st.fraseText}>
                Tenho profissionais parceiros{" "}
                <Switch
                  value={draft.clubEnabled}
                  onValueChange={(v) => set({ clubEnabled: v })}
                  trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
                  thumbColor={draft.clubEnabled ? Colors.violet : Colors.ink3}
                  testID="matcon-cfg-clube"
                />{" "}
                e ele vale também para pintor, eletricista, arquiteto e quem mais eu colocar nele.
              </Text>
            </View>

            {draft.clubEnabled && (
              <>
                <View style={st.divider} />

                <View style={st.frase}>
                  <Text style={st.fraseText}>
                    A cada R$ 100 em compras indicadas, o parceiro ganha{" "}
                    <TextInput
                      style={st.editSmall}
                      value={draft.pointsPer100}
                      onChangeText={(v) => set({ pointsPer100: v.replace(/\D/g, "").slice(0, 5) })}
                      keyboardType="number-pad"
                      maxLength={5}
                      testID="matcon-cfg-pontos-por-100"
                    />{" "}
                    pontos.
                  </Text>
                </View>

                <View style={st.divider} />

                <View style={st.frase}>
                  <Text style={st.fraseText}>
                    <TextInput
                      style={st.editSmall}
                      value={draft.pointsToCoupon}
                      onChangeText={(v) => set({ pointsToCoupon: v.replace(/\D/g, "").slice(0, 6) })}
                      keyboardType="number-pad"
                      maxLength={6}
                      testID="matcon-cfg-pontos-por-cupom"
                    />{" "}
                    pontos viram um cupom de R${" "}
                    <TextInput
                      style={st.editSmall}
                      value={draft.couponValue}
                      onChangeText={(v) => set({ couponValue: v.replace(/\D/g, "").slice(0, 5) })}
                      keyboardType="number-pad"
                      maxLength={5}
                      testID="matcon-cfg-valor-cupom"
                    />{" "}
                    para ele usar na loja.
                  </Text>
                </View>
              </>
            )}
          </View>

          <Text style={st.note}>Mudou de ideia? É só voltar aqui e trocar o número. Vale a partir da próxima venda.</Text>

          <Pressable onPress={save} style={[st.saveBtn, (!dirty || saving) && { opacity: 0.6 }]} disabled={!dirty || saving} testID="matcon-cfg-salvar">
            {saving ? <Text style={st.saveText}>Salvando…</Text> : <Text style={st.saveText}>{dirty ? "Salvar configurações" : "Tudo salvo"}</Text>}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 680, alignSelf: "center", width: "100%" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  pageTitle: { fontFamily: Fonts.heading, fontSize: 34, lineHeight: 37, color: Colors.ink, letterSpacing: -0.5, marginBottom: 6 },
  pageSubtitle: { fontSize: 13, color: Colors.ink3, lineHeight: 19, marginBottom: 18 },

  gate: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 24, borderWidth: 1, borderColor: Colors.border, alignItems: "center", marginTop: 8 },
  gateIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  gateTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  gateDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", marginTop: 6, lineHeight: 17, maxWidth: 340 },
  gateBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, marginTop: 16 },
  gateBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  hint: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },

  frase: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  fraseText: { fontSize: 15, lineHeight: 30, color: Colors.ink2, flexShrink: 1, flexWrap: "wrap" },

  editSmall: {
    fontFamily: Fonts.mono || undefined,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.ink,
    backgroundColor: Colors.bg2,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderBottomWidth: 2,
    borderBottomColor: Colors.violet,
    borderRadius: 8,
    minWidth: 40,
    textAlign: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 13, fontWeight: "600", color: Colors.ink3 },
  chipTextOn: { color: Colors.violet3 },
  chipMore: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2, justifyContent: "center" },
  chipMoreText: { fontSize: 12, fontWeight: "600", color: Colors.ink3 },

  note: { fontSize: 11, color: Colors.ink3, marginTop: 12, lineHeight: 16 },

  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  saveText: { fontSize: 15, color: "#fff", fontWeight: "700" },
});
