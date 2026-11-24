// ============================================================
// AURA. — Ótica: editor de receita (grade + prescritor + datas)
//
// Usado em dois lugares com o MESMO estado: dentro da abertura da OS
// (/otica/nova, quando o cliente chega com receita nova) e na tela de
// Receitas (/otica/receitas, cadastro avulso). Formulário aberto, sem
// wizard: quem digita está com o papel do médico na mão e quer ver tudo
// de uma vez (memória do projeto: wizard de cadastro foi reprovado, app#859).
//
// Prescritor com TIPO: médico (CRM) ou optometrista de nível superior.
// O STJ (AR 7.106, 05/2026) reconheceu o optometrista com diploma superior
// como prescritor de lente corretiva; o tipo fica registrado porque o
// livro de receitas da vigilância pede quem prescreveu. NÃO existe aqui
// nenhum campo de comissão ou repasse ao prescritor — vedado pelos arts.
// 68/69 do Código de Ética Médica.
// ============================================================
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { RxGrid } from "@/components/otica/RxGrid";
import { maskBrDate } from "@/components/inputs/DateInput";
import {
  type EyeRx, type PrescriberType, type Prescription, type PrescriptionBody, PRESCRIBER_LABEL, EMPTY_EYE,
  addMonthsIso, parseBrDate, fmtIsoDate, columnsToEyes, eyesToColumns,
} from "@/services/oticaApi";

export type RxDraft = {
  od: EyeRx;
  oe: EyeRx;
  prescriber_type: PrescriberType;
  prescriber_name: string;
  prescriber_registry: string;
  issued_at: string;    // DD/MM/AAAA (como o vendedor digita)
  valid_until: string;  // DD/MM/AAAA
  notes: string;
};

export function emptyRxDraft(validityMonths = 12): RxDraft {
  const today = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return {
    od: { ...EMPTY_EYE }, oe: { ...EMPTY_EYE },
    prescriber_type: "medico", prescriber_name: "", prescriber_registry: "",
    issued_at: fmtIsoDate(iso), valid_until: fmtIsoDate(addMonthsIso(iso, validityMonths)),
    notes: "",
  };
}

/** Receita salva → rascunho do editor (23/11/2026, "Editar receita"). */
export function rxDraftFromPrescription(p: Prescription): RxDraft {
  const eyes = columnsToEyes(p);
  return {
    od: eyes.od, oe: eyes.oe,
    prescriber_type: p.prescriber_type || "medico",
    prescriber_name: p.prescriber_name || "",
    prescriber_registry: p.prescriber_registry || "",
    issued_at: fmtIsoDate(p.issued_at), valid_until: fmtIsoDate(p.valid_until),
    notes: p.notes || "",
  };
}

/** Rascunho VALIDADO → campos da receita no formato da API (sem o cliente). */
export function rxDraftToBody(d: RxDraft): Omit<PrescriptionBody, "customer_id"> {
  return {
    ...eyesToColumns(d.od, d.oe),
    prescriber_type: d.prescriber_type,
    prescriber_name: d.prescriber_name.trim() || null,
    prescriber_registry: d.prescriber_registry.trim() || null,
    issued_at: parseBrDate(d.issued_at)!,
    valid_until: parseBrDate(d.valid_until)!,
    notes: d.notes.trim() || null,
  };
}

/** Erro humano da receita, ou null se dá pra salvar. */
export function validateRxDraft(d: RxDraft): string | null {
  const hasAny = [d.od.sph, d.od.cyl, d.oe.sph, d.oe.cyl].some((v) => v != null && !Number.isNaN(v));
  if (!hasAny) return "Preencha ao menos o esférico ou o cilíndrico de um dos olhos";
  for (const eye of [d.od, d.oe]) {
    if (eye.cyl != null && eye.cyl !== 0 && eye.axis == null) return "Cilíndrico sem eixo: informe o eixo (0–180)";
    if (Object.values(eye).some((v) => typeof v === "number" && Number.isNaN(v))) return "Há um grau inválido na grade";
  }
  if (!parseBrDate(d.issued_at)) return "Data de emissão inválida — use DD/MM/AAAA";
  if (!parseBrDate(d.valid_until)) return "Validade inválida — use DD/MM/AAAA";
  if (parseBrDate(d.valid_until)! < parseBrDate(d.issued_at)!) return "A validade não pode ser anterior à emissão";
  return null;
}

type Props = {
  value: RxDraft;
  onChange: (next: RxDraft) => void;
  validityMonths?: number;
  testID?: string;
};

export function RxEditor({ value, onChange, validityMonths = 12, testID = "rx" }: Props) {
  const set = (patch: Partial<RxDraft>) => onChange({ ...value, ...patch });

  return (
    <View style={{ gap: 12 }}>
      <RxGrid
        od={value.od}
        oe={value.oe}
        onChange={(eye, patch) => set({ [eye]: { ...value[eye], ...patch } } as Partial<RxDraft>)}
        testID={testID + "-grid"}
      />
      <Text style={st.hint}>
        Graus em passos de 0,25 · eixo de 0 a 180 · DNP e altura em mm. Sem DNP e altura por olho, o laboratório assume metade da DP e o centro do aro — e uma refação vira briga sem prova.
      </Text>

      <View style={st.row3}>
        <View style={st.col}>
          <Text style={st.lbl}>Prescritor</Text>
          <View style={st.chips}>
            {(Object.keys(PRESCRIBER_LABEL) as PrescriberType[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => set({ prescriber_type: t })}
                style={[st.chip, value.prescriber_type === t && st.chipOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: value.prescriber_type === t }}
                testID={`${testID}-prescritor-${t}`}
              >
                <Text style={[st.chipText, value.prescriber_type === t && st.chipTextOn]}>{PRESCRIBER_LABEL[t]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={st.col}>
          <Text style={st.lbl}>Nome do prescritor</Text>
          <TextInput style={st.input} value={value.prescriber_name} onChangeText={(v) => set({ prescriber_name: v })} placeholder="Dra. Ana Lima" placeholderTextColor={Colors.ink3} testID={testID + "-nome"} />
        </View>
        <View style={st.col}>
          <Text style={st.lbl}>{value.prescriber_type === "medico" ? "CRM" : "Registro"}</Text>
          <TextInput style={st.input} value={value.prescriber_registry} onChangeText={(v) => set({ prescriber_registry: v })} placeholder={value.prescriber_type === "medico" ? "12345/SP" : "nº do conselho"} placeholderTextColor={Colors.ink3} testID={testID + "-registro"} />
        </View>
      </View>

      <View style={st.row3}>
        <View style={st.col}>
          <Text style={st.lbl}>Emitida em</Text>
          <TextInput
            style={st.input}
            value={value.issued_at}
            onChangeText={(v) => set({ issued_at: maskBrDate(v) })}
            onBlur={() => {
              // Validade acompanha a emissão pelo padrão da loja, mas só se o
              // vendedor ainda não tiver mexido nela.
              const iso = parseBrDate(value.issued_at);
              if (iso && !value.valid_until) set({ valid_until: fmtIsoDate(addMonthsIso(iso, validityMonths)) });
            }}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={Colors.ink3}
            keyboardType="numeric"
            maxLength={10}
            testID={testID + "-emissao"}
          />
        </View>
        <View style={st.col}>
          <Text style={st.lbl}>Válida até</Text>
          <TextInput style={st.input} value={value.valid_until} onChangeText={(v) => set({ valid_until: maskBrDate(v) })} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="numeric" maxLength={10} testID={testID + "-validade"} />
        </View>
        <View style={st.col}>
          <Text style={st.lbl}>Observações</Text>
          <TextInput style={st.input} value={value.notes} onChangeText={(v) => set({ notes: v })} placeholder="ex.: prisma, uso ocupacional" placeholderTextColor={Colors.ink3} testID={testID + "-obs"} />
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  hint: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  row3: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  // flexBasis no lugar de minWidth sozinho: a 375 px cada campo ocupa a linha
  // inteira em vez de espremer dois lado a lado.
  col: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0 },
  lbl: { fontSize: 11, fontWeight: "600", color: Colors.ink2, marginBottom: 6 },
  input: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },
});
