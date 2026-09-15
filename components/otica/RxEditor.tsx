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
import {
  type EyeRx, type PrescriberType, PRESCRIBER_LABEL, EMPTY_EYE,
  addMonthsIso, parseBrDate, fmtIsoDate,
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
          <Text style={st.lbl}>Nome</Text>
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
            onChangeText={(v) => set({ issued_at: v })}
            onBlur={() => {
              // Validade acompanha a emissão pelo padrão da loja, mas só se o
              // vendedor ainda não tiver mexido nela.
              const iso = parseBrDate(value.issued_at);
              if (iso && !value.valid_until) set({ valid_until: fmtIsoDate(addMonthsIso(iso, validityMonths)) });
            }}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={Colors.ink3}
            testID={testID + "-emissao"}
          />
        </View>
        <View style={st.col}>
          <Text style={st.lbl}>Válida até</Text>
          <TextInput style={st.input} value={value.valid_until} onChangeText={(v) => set({ valid_until: v })} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} testID={testID + "-validade"} />
        </View>
        <View style={st.col}>
          <Text style={st.lbl}>Observações</Text>
          <TextInput style={st.input} value={value.notes} onChangeText={(v) => set({ notes: v })} placeholder="ex.: prisma, uso ocupacional" placeholderTextColor={Colors.ink3} />
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  hint: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  row3: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  col: { flex: 1, minWidth: 150 },
  lbl: { fontSize: 11, fontWeight: "600", color: Colors.ink2, marginBottom: 6 },
  input: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },
});
