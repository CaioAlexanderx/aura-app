import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { karateApi, BeltHistoryEntry } from "@/services/karateApi";
import { formatIsoToBr, maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import { BELT_OPTIONS, DAN_OPTIONS, BELT_KYUS, buildBeltName, isUnknownBeltDate } from "./helpers";

interface Props {
  entry: BeltHistoryEntry | null;
  onClose: () => void;
  federationId: string;
  practitionerId: string;
  onDone: () => void;
}

// Edita uma graduação existente do histórico (faixa + data). A faixa atual é
// recalculada pelo backend (view) após salvar → a tela fai refetch.
export function EditarGraduacaoModal({
  entry, onClose, federationId, practitionerId, onDone,
}: Props) {
  const visible = !!entry;
  const [beltKey, setBeltKey] = useState<BeltKey | null>(null);
  const [danDeg, setDanDeg] = useState<number | null>(null);
  const [kyuDeg, setKyuDeg] = useState<number | null>(null);
  const [dateBr, setDateBr] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    // pré-seleciona a faixa se o belt_level casar com uma chave canônica
    const match = (Object.keys(KarateBelts) as BeltKey[]).find((k) => k === entry.belt_level);
    setBeltKey(match ?? null);
    // pré-seleciona Dan se o belt_name carregar o grau (ex.: "Preta 2°")
    const danMatch = entry.belt_name?.match(/(\d+)°/);
    setDanDeg(match === "preta" && danMatch ? parseInt(danMatch[1], 10) : null);
    // pré-seleciona kyu se o belt_name carregar (ex.: "Marrom 2°kyu")
    const kyuMatch = entry.belt_name?.match(/(\d+)°kyu/i);
    setKyuDeg(kyuMatch ? parseInt(kyuMatch[1], 10) : null);
    const known = !isUnknownBeltDate(entry.graduated_at);
    setDateBr(known ? (formatIsoToBr(entry.graduated_at) || "") : "");
    setErr(null); setSaving(false);
  }, [entry]);

  function handleBeltSelect(k: BeltKey) {
    setBeltKey(k);
    setDanDeg(null);
    setKyuDeg(null);
  }

  const dateComplete = dateBr.length === 10;
  const dateIso = parseBrDate(dateBr);
  const dateBad = dateComplete && dateIso === null;

  async function handleSave() {
    if (!entry) return;
    if (dateBad) { setErr("Data inválida. Use dd/mm/aaaa ou deixe em branco."); return; }
    setErr(null); setSaving(true);
    try {
      const resolvedKey = beltKey ?? (entry.belt_level as BeltKey);
      await karateApi.updateGraduation(federationId, practitionerId, entry.id, {
        belt_level: resolvedKey,
        belt_name: beltKey
          ? buildBeltName(beltKey, danDeg ?? undefined, kyuDeg ?? undefined)
          : entry.belt_name,
        ...(dateIso ? { graduated_at: dateIso } : {}),
      });
      setSaving(false);
      onDone();
    } catch (e: any) {
      setSaving(false);
      setErr(e?.message || "Não foi possível salvar a graduação.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={gradStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={gradStyles.card}>
          <View style={gradStyles.head}>
            <Text style={gradStyles.title}>Editar graduação</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={gradStyles.hint}>
              Ajuste a faixa ou a data deste registro. A faixa atual é recalculada automaticamente.
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

            <Text style={gradStyles.label}>Data da graduação · dd/mm/aaaa <Text style={gradStyles.labelHint}>(vazio = mantém)</Text></Text>
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
              {saving ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={gradStyles.btnPrimaryTxt}>Salvar</Text>}
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
  errBox:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine, borderRadius: 12, padding: 11 } as ViewStyle,
  errTxt:    { fontSize: 12.5, color: KarateColors.primary2, flex: 1 } as TextStyle,
  footer:    { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  btnGhost:  { paddingVertical: 11, paddingHorizontal: 18, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: KarateRadius.md, backgroundColor: KarateColors.ink, minWidth: 130, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
});

