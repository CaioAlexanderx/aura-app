// ============================================================
// TurmaFormModal — criar/editar turma (F4)
//
// Nome + dias da semana (chips toggle 0-6) + horário início/fim (HH:MM
// mascarado) + modalidade (texto livre) + ativo (só na edição, mesmo
// padrão do PlanoFormModal).
// ============================================================
import React, { useEffect, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { FormField } from "@/components/karate/FormField";
import { karateDojoClassesApi, DojoClass } from "@/services/karateDojoClassesApi";
import { WEEKDAY_LONG, WEEKDAY_SHORT, isValidTimeOrEmpty, maskTimeHHMM, mapClassesError } from "./helpers";

interface Props {
  visible: boolean;
  federationId: string;
  turma: DojoClass | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TurmaFormModal({ visible, federationId, turma, onClose, onSaved }: Props) {
  const isEdit = !!turma;
  const [name, setName] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [modality, setModality] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [weekdaysErr, setWeekdaysErr] = useState<string | null>(null);
  const [timeErr, setTimeErr] = useState<string | null>(null);
  const [generalErr, setGeneralErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setNameErr(null); setWeekdaysErr(null); setTimeErr(null); setGeneralErr(null);
    if (turma) {
      setName(turma.name);
      setWeekdays(turma.weekdays ?? []);
      setStartTime(turma.start_time ?? "");
      setEndTime(turma.end_time ?? "");
      setModality(turma.modality ?? "");
      setActive(turma.active);
    } else {
      setName("");
      setWeekdays([]);
      setStartTime("");
      setEndTime("");
      setModality("");
      setActive(true);
    }
  }, [visible, turma]);

  const toggleDay = (d: number) => {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  };

  const validate = (): boolean => {
    let ok = true;
    if (!name.trim()) { setNameErr("Informe o nome da turma."); ok = false; } else setNameErr(null);
    if (weekdays.length === 0) { setWeekdaysErr("Escolha ao menos um dia da semana."); ok = false; } else setWeekdaysErr(null);
    if (!isValidTimeOrEmpty(startTime) || !isValidTimeOrEmpty(endTime)) {
      setTimeErr("Horário inválido — use HH:MM.");
      ok = false;
    } else setTimeErr(null);
    return ok;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setGeneralErr(null);
    try {
      const payload = {
        name: name.trim(),
        weekdays,
        start_time: startTime || null,
        end_time: endTime || null,
        modality: modality.trim() || null,
      };
      if (isEdit && turma) {
        await karateDojoClassesApi.updateClass(federationId, turma.id, { ...payload, active });
      } else {
        await karateDojoClassesApi.createClass(federationId, payload);
      }
      onSaved();
    } catch (e: any) {
      setGeneralErr(mapClassesError(e).message);
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
            <Text style={s.title}>{isEdit ? "Editar turma" : "Nova turma"}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="x" size={18} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, gap: 12 }}>
            <FormField label="Nome da turma" required value={name} onChangeText={setName} placeholder="Infantil, Adulto, Competição…" error={nameErr ?? undefined} />

            <View>
              <Text style={s.lbl}>Dias da semana</Text>
              <View style={s.chips}>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                  const on = weekdays.includes(d);
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[s.dayChip, on && s.dayChipOn]}
                      onPress={() => toggleDay(d)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={WEEKDAY_LONG[d]}
                    >
                      <Text style={[s.dayChipTxt, on && s.dayChipTxtOn]}>{WEEKDAY_SHORT[d]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!!weekdaysErr && <Text style={s.err}>{weekdaysErr}</Text>}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <FormField
                label="Início (opcional)"
                value={startTime}
                onChangeText={(v) => setStartTime(maskTimeHHMM(v))}
                placeholder="18:00"
                keyboardType="number-pad"
                style={{ flex: 1 }}
              />
              <FormField
                label="Fim (opcional)"
                value={endTime}
                onChangeText={(v) => setEndTime(maskTimeHHMM(v))}
                placeholder="19:00"
                keyboardType="number-pad"
                style={{ flex: 1 }}
              />
            </View>
            {!!timeErr && <Text style={s.err}>{timeErr}</Text>}

            <FormField label="Modalidade (opcional)" value={modality} onChangeText={setModality} placeholder="Kumite, Kata, Baby karatê…" />

            {isEdit && (
              <View>
                <Text style={s.lbl}>Situação</Text>
                <View style={s.chips}>
                  <TouchableOpacity
                    style={[s.stateChip, active && s.stateChipOn]}
                    onPress={() => setActive(true)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[s.stateChipTxt, active && s.stateChipTxtOn]}>Ativa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.stateChip, !active && s.stateChipOn]}
                    onPress={() => setActive(false)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: !active }}
                  >
                    <Text style={[s.stateChipTxt, !active && s.stateChipTxtOn]}>Inativa</Text>
                  </TouchableOpacity>
                </View>
                {!active && <Text style={s.hint}>Turmas inativas somem da lista de matrícula de novos alunos e da tela de chamada, mas o histórico continua.</Text>}
              </View>
            )}

            {!!generalErr && <Text style={s.err}>{generalErr}</Text>}

            <View style={s.actions}>
              <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={onClose} style={{ flex: 1 }} />
              <KarateButton label="Salvar turma" variant="sumi" size="sm" onPress={save} loading={saving} style={{ flex: 2 }} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { width: "100%", maxWidth: 460, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.xl, overflow: "hidden", borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  title: { fontSize: 15.5, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  lbl: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginBottom: 6 } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  dayChip: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  dayChipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  dayChipTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,
  dayChipTxtOn: { color: KarateColors.primary } as TextStyle,
  stateChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  stateChipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  stateChipTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  stateChipTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 6, lineHeight: 15 } as TextStyle,
  err: { fontSize: 12.5, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  actions: { flexDirection: "row", gap: 8, marginTop: 4 } as ViewStyle,
});
