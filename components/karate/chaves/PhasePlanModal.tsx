// ============================================================
// AURA KARATÊ — Chaves: EDITOR DO PLANO DE FASES (P1, migration 296)
//
// Traduz o regulamento em dado: o formato muda conforme a chave avança
// ("eliminatórias em Sanbon → 16 em Kihon-Ippon → 8 em Jyu-Ippon → 4 em
// Shobu-Ippon"), a final tem regra própria (tempo efetivo, Shobu-Sanbon
// de 5 min do Adulto), e o desempate é uma CADEIA (hantei → kettei-sen →
// árbitro central). Tudo isso alimenta a chave, a súmula e o portal.
//
// Presets dos regulamentos reais deixam o caminho de 1 clique para o
// caso comum; o editor manual cobre o resto.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, Modal, Pressable, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { toast } from "@/components/Toast";
import {
  karateCompetitionP1Api, PhasePlan, PhaseSpec, MatchFormat, DecisionMethod,
  FORMAT_LABEL, DECISION_LABEL,
} from "@/services/karateCompetitionP1Api";

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  competitionId: string;
  categoryId: string;
  categoryName: string;
  modality: string;
  initialPlan: PhasePlan;
  onSaved: (plan: PhasePlan) => void;
}

const KUMITE_FORMATS: MatchFormat[] = ["sanbon_kumite", "kihon_ippon", "jyu_ippon", "shobu_ippon", "shobu_sanbon"];
const KATA_FORMATS: MatchFormat[] = ["kata_hantei", "kata_notas"];
const TIEBREAKS: DecisionMethod[] = ["hantei", "kettei_sen", "sai_shiai", "central"];

// Presets extraídos dos regulamentos (Dossiê Shiai §4).
const PRESETS: { key: string; label: string; hint: string; plan: PhasePlan }[] = [
  {
    key: "jka_infantil",
    label: "Copa JKA — Infantil",
    hint: "Sanbon → 16 Kihon → 8 Jyu → 4 Shobu",
    plan: {
      phases: [
        { from_participants: null, format: "sanbon_kumite", decision: "hantei" },
        { from_participants: 16, format: "kihon_ippon", decision: "hantei" },
        { from_participants: 8, format: "jyu_ippon", decision: "hantei" },
        { from_participants: 4, format: "shobu_ippon", duration_sec: 90, time_mode: "corrido" },
        { final: true, format: "shobu_ippon", duration_sec: 90, time_mode: "efetivo" },
      ],
      tiebreak: ["hantei", "kettei_sen", "central"],
      prize_places: 4,
      third_place_dispute: false,
    },
  },
  {
    key: "fpkt_12_13",
    label: "FPKT — 12 e 13 anos",
    hint: "Jyu-Ippon nas eliminatórias, Shiai nas semis/final",
    plan: {
      phases: [
        { from_participants: null, format: "jyu_ippon", decision: "hantei" },
        { from_participants: 4, format: "shobu_ippon", duration_sec: 90, time_mode: "corrido" },
        { final: true, format: "shobu_ippon", duration_sec: 90, time_mode: "efetivo" },
      ],
      tiebreak: ["hantei", "kettei_sen", "central"],
      prize_places: 4,
      third_place_dispute: false,
    },
  },
  {
    key: "adulto_final_sanbon",
    label: "Adulto Masc — final Shobu-Sanbon",
    hint: "Eliminatórias Shobu-Ippon, final 5 min",
    plan: {
      phases: [
        { from_participants: null, format: "shobu_ippon", duration_sec: 90, time_mode: "corrido" },
        { final: true, format: "shobu_sanbon", duration_sec: 300, time_mode: "efetivo" },
      ],
      tiebreak: ["hantei", "kettei_sen"],
      prize_places: 4,
      third_place_dispute: false,
    },
  },
  {
    key: "kata_bandeiras",
    label: "Kata — bandeiras até a final",
    hint: "Confronto direto por Hantei (FPKT/JKA)",
    plan: {
      phases: [
        { from_participants: null, format: "kata_hantei", decision: "hantei" },
        { final: true, format: "kata_hantei", decision: "hantei" },
      ],
      tiebreak: ["central"],
      required_kata: "Heians até a faixa do menos graduado",
      prize_places: 3,
      third_place_dispute: false,
    },
  },
];

export function PhasePlanModal({
  visible, onClose, federationId, competitionId, categoryId, categoryName, modality, initialPlan, onSaved,
}: Props) {
  const isKata = modality === "kata" || modality === "team_kata";
  const formats = isKata ? [...KATA_FORMATS, ...KUMITE_FORMATS] : [...KUMITE_FORMATS, ...KATA_FORMATS];

  const [phases, setPhases] = useState<PhaseSpec[]>([]);
  const [tiebreak, setTiebreak] = useState<DecisionMethod[]>([]);
  const [requiredKata, setRequiredKata] = useState("");
  const [prizePlaces, setPrizePlaces] = useState("4");
  const [thirdDispute, setThirdDispute] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPhases(initialPlan.phases ? JSON.parse(JSON.stringify(initialPlan.phases)) : []);
    setTiebreak(initialPlan.tiebreak || []);
    setRequiredKata(initialPlan.required_kata || "");
    setPrizePlaces(initialPlan.prize_places != null ? String(initialPlan.prize_places) : "4");
    setThirdDispute(initialPlan.third_place_dispute === true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const applyPreset = (plan: PhasePlan) => {
    setPhases(JSON.parse(JSON.stringify(plan.phases || [])));
    setTiebreak(plan.tiebreak || []);
    setRequiredKata(plan.required_kata || "");
    setPrizePlaces(plan.prize_places != null ? String(plan.prize_places) : "4");
    setThirdDispute(plan.third_place_dispute === true);
    toast.success("Preset aplicado — revise e salve.");
  };

  const patchPhase = (i: number, patch: Partial<PhaseSpec>) =>
    setPhases((p) => p.map((ph, j) => (j === i ? { ...ph, ...patch } : ph)));

  const addPhase = (final = false) =>
    setPhases((p) => [...p, final
      ? { final: true, format: (isKata ? "kata_hantei" : "shobu_ippon") as MatchFormat }
      : { from_participants: null, format: (isKata ? "kata_hantei" : "kihon_ippon") as MatchFormat, decision: "hantei" }]);

  const save = async () => {
    if (!phases.length) {
      toast.error("Adicione ao menos uma fase (ou limpe o plano para usar o formato padrão).");
      return;
    }
    if (phases.filter((p) => p.final).length > 1) {
      toast.error("Só uma fase pode ser a final.");
      return;
    }
    setSaving(true);
    const plan: PhasePlan = {
      phases,
      tiebreak,
      required_kata: requiredKata.trim() || null,
      prize_places: parseInt(prizePlaces, 10) || 4,
      third_place_dispute: thirdDispute,
    };
    try {
      const res = await karateCompetitionP1Api.savePhasePlan(federationId, competitionId, categoryId, plan);
      toast.success("Plano de fases salvo.");
      onSaved(res.phase_plan || plan);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar o plano.");
    } finally {
      setSaving(false);
    }
  };

  const clearPlan = async () => {
    setSaving(true);
    try {
      await karateCompetitionP1Api.savePhasePlan(federationId, competitionId, categoryId, {});
      toast.success("Plano removido — a categoria volta ao formato padrão.");
      onSaved({});
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível limpar o plano.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.card}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Plano de fases</Text>
              <Text style={s.subtitle} numberOfLines={1}>{categoryName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Icon name="x" size={20} color={C.ink3} /></TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
            {/* Presets */}
            <View style={{ gap: 6 }}>
              <Text style={s.sectionLabel}>Modelos dos regulamentos</Text>
              <View style={s.presetRow}>
                {PRESETS.map((p) => (
                  <TouchableOpacity key={p.key} style={s.preset} onPress={() => applyPreset(p.plan)}>
                    <Text style={s.presetLabel}>{p.label}</Text>
                    <Text style={s.presetHint}>{p.hint}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Fases */}
            <View style={{ gap: 8 }}>
              <Text style={s.sectionLabel}>Fases (avaliadas por nº de participantes da rodada)</Text>
              {phases.length === 0 ? (
                <Text style={s.emptyTxt}>Sem plano — a categoria usa o formato padrão da modalidade.</Text>
              ) : (
                phases.map((ph, i) => (
                  <View key={i} style={[s.phase, ph.final && s.phaseFinal]}>
                    <View style={s.phaseHead}>
                      {ph.final ? (
                        <View style={s.finalChip}><Text style={s.finalChipTxt}>FINAL</Text></View>
                      ) : (
                        <View style={s.fromRow}>
                          <Text style={s.smallLabel}>a partir de</Text>
                          <TextInput
                            style={s.fromInput}
                            value={ph.from_participants != null ? String(ph.from_participants) : ""}
                            onChangeText={(v) => patchPhase(i, { from_participants: v ? parseInt(v.replace(/\D/g, ""), 10) : null })}
                            placeholder="todos" placeholderTextColor={C.ink4} keyboardType="numeric" maxLength={3}
                          />
                          <Text style={s.smallLabel}>participantes</Text>
                        </View>
                      )}
                      <TouchableOpacity onPress={() => setPhases((p) => p.filter((_, j) => j !== i))} hitSlop={8}>
                        <Icon name="x" size={14} color={C.ink3} />
                      </TouchableOpacity>
                    </View>

                    <View style={s.chipRow}>
                      {formats.map((f) => (
                        <TouchableOpacity
                          key={f}
                          style={[s.chip, ph.format === f && s.chipOn]}
                          onPress={() => patchPhase(i, { format: f })}
                        >
                          <Text style={[s.chipTxt, ph.format === f && s.chipTxtOn]}>{FORMAT_LABEL[f]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={s.timeRow}>
                      <Text style={s.smallLabel}>tempo</Text>
                      <TextInput
                        style={s.timeInput}
                        value={ph.duration_sec != null ? String(ph.duration_sec) : ""}
                        onChangeText={(v) => patchPhase(i, { duration_sec: v ? parseInt(v.replace(/\D/g, ""), 10) : null })}
                        placeholder="seg" placeholderTextColor={C.ink4} keyboardType="numeric" maxLength={4}
                      />
                      {(["corrido", "efetivo"] as const).map((tm) => (
                        <TouchableOpacity
                          key={tm}
                          style={[s.chipSm, ph.time_mode === tm && s.chipOn]}
                          onPress={() => patchPhase(i, { time_mode: ph.time_mode === tm ? null : tm })}
                        >
                          <Text style={[s.chipTxt, ph.time_mode === tm && s.chipTxtOn]}>{tm}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))
              )}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <KarateButton label="+ Fase" variant="secondary" size="sm" onPress={() => addPhase(false)} />
                {!phases.some((p) => p.final) && (
                  <KarateButton label="+ Final" variant="secondary" size="sm" onPress={() => addPhase(true)} />
                )}
              </View>
            </View>

            {/* Desempate + premiação */}
            <View style={{ gap: 6 }}>
              <Text style={s.sectionLabel}>Desempate (na ordem)</Text>
              <View style={s.chipRow}>
                {TIEBREAKS.map((t) => {
                  const idx = tiebreak.indexOf(t);
                  const on = idx >= 0;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[s.chip, on && s.chipOn]}
                      onPress={() => setTiebreak((prev) => on ? prev.filter((x) => x !== t) : [...prev, t])}
                    >
                      <Text style={[s.chipTxt, on && s.chipTxtOn]}>
                        {on ? `${idx + 1}. ` : ""}{DECISION_LABEL[t]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={s.sectionLabel}>Kata exigido (impresso na súmula)</Text>
              <TextInput
                style={s.textInput}
                value={requiredKata}
                onChangeText={setRequiredKata}
                placeholder="Ex.: Heians até a faixa do menos graduado"
                placeholderTextColor={C.ink4}
              />
            </View>

            <View style={s.prizeRow}>
              <View>
                <Text style={s.sectionLabel}>Premia até</Text>
                <TextInput
                  style={s.prizeInput}
                  value={prizePlaces}
                  onChangeText={(v) => setPrizePlaces(v.replace(/\D/g, "").slice(0, 1))}
                  keyboardType="numeric" maxLength={1}
                />
              </View>
              <TouchableOpacity
                style={[s.toggle, thirdDispute && s.toggleOn]}
                onPress={() => setThirdDispute((v) => !v)}
                accessibilityRole="switch"
                accessibilityState={{ checked: thirdDispute }}
              >
                <Text style={[s.toggleTxt, thirdDispute && s.toggleTxtOn]}>
                  {thirdDispute ? "Com disputa de 3º" : "Dois 3ºs (sem disputa)"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={s.footer}>
            <KarateButton label="Limpar plano" variant="ghost" size="md" onPress={clearPlan} disabled={saving} />
            <KarateButton label={saving ? "Salvando..." : "Salvar plano"} variant="sumi" size="md" onPress={save} disabled={saving} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { width: "100%", maxWidth: 640, backgroundColor: C.surface, borderRadius: R.xl, overflow: "hidden", borderWidth: 1, borderColor: C.border2, maxHeight: "92%" } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.glassHi } as ViewStyle,
  title: { fontFamily: F.heading, fontSize: 17, color: C.ink } as TextStyle,
  subtitle: { fontSize: 12, color: C.ink3, marginTop: 1 } as TextStyle,
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  emptyTxt: { fontSize: 12.5, color: C.ink3 } as TextStyle,
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  preset: { borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.glassHi, maxWidth: 200 } as ViewStyle,
  presetLabel: { fontSize: 12, fontWeight: "700", color: C.ink } as TextStyle,
  presetHint: { fontSize: 10.5, color: C.ink3, marginTop: 1 } as TextStyle,
  phase: { borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 10, gap: 8, backgroundColor: C.surface } as ViewStyle,
  phaseFinal: { borderColor: C.primaryLine, backgroundColor: C.primarySoft } as ViewStyle,
  phaseHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  finalChip: { borderRadius: 999, backgroundColor: C.primary, paddingHorizontal: 10, paddingVertical: 2 } as ViewStyle,
  finalChipTxt: { fontSize: 10, fontWeight: "800", color: "#fdf8f2", letterSpacing: 0.5 } as TextStyle,
  fromRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 } as ViewStyle,
  smallLabel: { fontSize: 11.5, color: C.ink3 } as TextStyle,
  fromInput: { width: 64, fontSize: 13, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: C.glassHi, textAlign: "center" } as TextStyle,
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 } as ViewStyle,
  chip: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 10, paddingVertical: 4 } as ViewStyle,
  chipSm: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 9, paddingVertical: 3 } as ViewStyle,
  chipOn: { backgroundColor: C.primary, borderColor: C.primary } as ViewStyle,
  chipTxt: { fontSize: 11.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  chipTxtOn: { color: "#fdf8f2", fontWeight: "700" } as TextStyle,
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" } as ViewStyle,
  timeInput: { width: 70, fontSize: 12.5, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: C.glassHi, textAlign: "center" } as TextStyle,
  textInput: { fontSize: 13, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.glassHi } as TextStyle,
  prizeRow: { flexDirection: "row", alignItems: "flex-end", gap: 14, flexWrap: "wrap" } as ViewStyle,
  prizeInput: { width: 56, fontSize: 14, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.glassHi, textAlign: "center", marginTop: 4 } as TextStyle,
  toggle: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 12, paddingVertical: 7 } as ViewStyle,
  toggleOn: { backgroundColor: C.primarySoft, borderColor: C.primaryLine } as ViewStyle,
  toggleTxt: { fontSize: 12, fontWeight: "600", color: C.ink3 } as TextStyle,
  toggleTxtOn: { color: C.primary, fontWeight: "700" } as TextStyle,
  footer: { flexDirection: "row", justifyContent: "space-between", gap: 10, padding: 13, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.glassHi } as ViewStyle,
});
