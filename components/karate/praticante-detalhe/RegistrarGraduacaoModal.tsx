import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { karateApi } from "@/services/karateApi";
import { maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import { BELT_OPTIONS, DAN_OPTIONS, BELT_KYUS, buildBeltName } from "./helpers";

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  practitionerId: string;
  onDone: () => void;
}

// Track A (fix 23/06): registrar uma graduação manual (faixa + data) no
// histórico do praticante. A faixa atual é derivada automaticamente
// (view karate_current_belt).
export function RegistrarGraduacaoModal({
  visible, onClose, federationId, practitionerId, onDone,
}: Props) {
  const [beltKey, setBeltKey] = useState<BeltKey | null>(null);
  const [danDeg, setDanDeg] = useState<number | null>(null);
  const [kyuDeg, setKyuDeg] = useState<number | null>(null);
  const [dateBr, setDateBr] = useState("");
  const [cbkt, setCbkt] = useState("");
  const [notes, setNotes] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // reset ao abrir
  useEffect(() => {
    if (visible) { setBeltKey(null); setDanDeg(null); setKyuDeg(null); setDateBr(""); setCbkt(""); setNotes(""); setLegacy(false); setErr(null); setSaving(false); }
  }, [visible]);

  // Reset grau ao trocar faixa
  function handleBeltSelect(k: BeltKey) {
    setBeltKey(k);
    setDanDeg(null);
    setKyuDeg(null);
  }

  const dateComplete = dateBr.length === 10;
  const dateIso = parseBrDate(dateBr); // null se incompleto/ inválido
  const dateBad = dateComplete && dateIso === null;

  async function handleSave() {
    if (!beltKey) { setErr("Selecione a faixa."); return; }
    if (dateBad) { setErr("Data inválida. Use dd/mm/aaaa ou deixe em branco (usa hoje)."); return; }
    setErr(null); setSaving(true);
    try {
      await karateApi.addBeltGraduation(federationId, practitionerId, {
        belt_level: beltKey,
        belt_name: buildBeltName(beltKey, danDeg ?? undefined, kyuDeg ?? undefined),
        belt_schema: legacy ? "legacy" : "fpkt_shotokan",
        graduated_at: dateIso ?? undefined, // sem data → backend usa hoje
        cbkt_number: beltKey === "preta" && cbkt.trim() ? cbkt.trim() : undefined,
        notes: notes.trim() || undefined,
      });
      setSaving(false);
      onDone();
    } catch (e: any) {
      setSaving(false);
      setErr(e?.message || "Não foi possível registrar a graduação.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={gradStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={gradStyles.card}>
          <View style={gradStyles.head}>
            <Text style={gradStyles.title}>Registrar graduação</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={gradStyles.hint}>
              Adiciona uma faixa ao histórico (registro permanente). A faixa atual passa a ser a mais recente.
            </Text>

            <Text style={gradStyles.label}>Faixa</Text>
            <View style={gradStyles.beltGrid}>
              {BELT_OPTIONS.map((opt) => {
                const active = beltKey === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => handleBeltSelect(opt.key)}
                    activeOpacity={0.7}
                    style={[gradStyles.beltChip, { backgroundColor: KarateBelts[opt.key].color }, active && gradStyles.beltChipActive]}
                  >
                    <Text style={[gradStyles.beltChipTxt, { color: KarateBelts[opt.key].textColor }]}>{opt.label}</Text>
                    {active && <Icon name="check" size={14} color={KarateBelts[opt.key].textColor} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Sub-seletor: Dan para Preta / Kyu para as demais */}
            {beltKey === "preta" && (
              <>
                <Text style={gradStyles.label}>Grau Dan</Text>
                <View style={gradStyles.beltGrid}>
                  {DAN_OPTIONS.map((d) => {
                    const active = danDeg === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setDanDeg(active ? null : d)}
                        activeOpacity={0.7}
                        style={[gradStyles.beltChip, { backgroundColor: active ? KarateColors.ink : KarateColors.bg2 }, active && gradStyles.beltChipActive]}
                      >
                        <Text style={[gradStyles.beltChipTxt, { color: active ? "#fdf8f2" : KarateColors.ink2 }]}>{d}°</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            {beltKey && beltKey !== "preta" && (BELT_KYUS[beltKey]?.length ?? 0) > 1 && (
              <>
                <Text style={gradStyles.label}>Kyu</Text>
                <View style={gradStyles.beltGrid}>
                  {(BELT_KYUS[beltKey] ?? []).map((k) => {
                    const active = kyuDeg === k;
                    return (
                      <TouchableOpacity
                        key={k}
                        onPress={() => setKyuDeg(active ? null : k)}
                        activeOpacity={0.7}
                        style={[gradStyles.beltChip, { backgroundColor: active ? KarateColors.ink : KarateColors.bg2 }, active && gradStyles.beltChipActive]}
                      >
                        <Text style={[gradStyles.beltChipTxt, { color: active ? "#fdf8f2" : KarateColors.ink2 }]}>{k}°kyu</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={gradStyles.label}>Data da graduação · dd/mm/aaaa <Text style={gradStyles.labelHint}>(vazio = hoje)</Text></Text>
            <TextInput
              style={[gradStyles.input, dateBad && gradStyles.inputBad]}
              value={dateBr}
              onChangeText={(v) => setDateBr(maskBrDate(v))}
              keyboardType="numeric"
              placeholder="dd/mm/aaaa"
              placeholderTextColor={KarateColors.ink4}
              maxLength={10}
              accessibilityLabel="Data da graduação"
            />
            {dateBad ? <Text style={gradStyles.errInline}>Data inválida</Text> : null}

            {beltKey === "preta" ? (
              <>
                <Text style={gradStyles.label}>Nº CBKT <Text style={gradStyles.labelHint}>(federação nacional · só histórico)</Text></Text>
                <TextInput
                  style={gradStyles.input}
                  value={cbkt}
                  onChangeText={setCbkt}
                  placeholder="Ex.: CBKT-12345"
                  placeholderTextColor={KarateColors.ink4}
                  autoCapitalize="characters"
                  accessibilityLabel="Número CBKT"
                />
              </>
            ) : null}

            <Text style={gradStyles.label}>Observação <Text style={gradStyles.labelHint}>(opcional)</Text></Text>
            <TextInput
              style={[gradStyles.input, { minHeight: 64, textAlignVertical: "top", fontFamily: KarateFonts.body, letterSpacing: 0 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex.: exame na sede, banca X, menção honrosa…"
              placeholderTextColor={KarateColors.ink4}
              multiline
              accessibilityLabel="Observação da graduação"
            />

            <TouchableOpacity style={gradStyles.legacyRow} onPress={() => setLegacy((v) => !v)} activeOpacity={0.7}>
              <View style={[gradStyles.checkbox, legacy && gradStyles.checkboxOn]}>
                {legacy && <Icon name="check" size={13} color="#fff" />}
              </View>
              <Text style={gradStyles.legacyTxt}>Registro histórico (sistema legado)</Text>
            </TouchableOpacity>

            {err ? (
              <View style={gradStyles.errBox}>
                <Icon name="alert_circle" size={15} color={KarateColors.primary} />
                <Text style={gradStyles.errTxt}>{err}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={gradStyles.footer}>
            <TouchableOpacity onPress={onClose} style={gradStyles.btnGhost}>
              <Text style={gradStyles.btnGhostTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={[gradStyles.btnPrimary, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={gradStyles.btnPrimaryTxt}>Registrar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const gradStyles = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card:      { width: "100%", maxWidth: 520, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.xl, overflow: "hidden", borderWidth: 1, borderColor: KarateColors.border2, maxHeight: "92%" } as ViewStyle,
  head:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  title:     { fontFamily: KarateFonts.heading, fontSize: 18, color: KarateColors.ink } as TextStyle,
  hint:      { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  label:     { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: KarateColors.ink2, marginTop: 4 } as TextStyle,
  labelHint: { fontWeight: "500", color: KarateColors.ink4 } as TextStyle,
  beltGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  beltChip:  { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" } as ViewStyle,
  beltChipActive: { borderColor: KarateColors.ink, borderWidth: 2 } as ViewStyle,
  beltChipTxt: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 } as TextStyle,
  input:     { fontFamily: KarateFonts.mono, fontSize: 15, color: KarateColors.ink, backgroundColor: KarateColors.glassHi, borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, paddingHorizontal: 12, paddingVertical: 11, letterSpacing: 0.5 } as TextStyle,
  inputBad:  { borderColor: KarateColors.primary } as ViewStyle,
  errInline: { fontSize: 11, color: KarateColors.primary } as TextStyle,
  legacyRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 4 } as ViewStyle,
  checkbox:  { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: KarateColors.border2, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.glassHi } as ViewStyle,
  checkboxOn:{ backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  legacyTxt: { fontSize: 13, color: KarateColors.ink2, flex: 1 } as TextStyle,
  errBox:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine, borderRadius: 12, padding: 11 } as ViewStyle,
  errTxt:    { fontSize: 12.5, color: KarateColors.primary2, flex: 1 } as TextStyle,
  footer:    { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  btnGhost:  { paddingVertical: 11, paddingHorizontal: 18, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: KarateRadius.md, backgroundColor: KarateColors.ink, minWidth: 130, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
});

