import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-03: AnamneseWizard — anamnese odontologica em 5 steps.
//
// PR20 (2026-04-27): refinada com perguntas que faltavam:
// - bisfosfonatos / osteoporose (risco osteonecrose mandibular)
// - cirurgia detalhe textarea
// - cardio detalhado (sopro, marcapasso, valvula, febre reumatica)
// - etilismo, drogas recreativas
// - ansiedade dental, DTM
// - higiene bucal (frequencia escovacao + fio)
// - ultima visita dentista
// - historico familiar de doencas relevantes
// - queixa principal e observacoes textarea
//
// Tipo expandido com campos opcionais — payload existente
// continua compativel.
// ============================================================

export type AnamneseData = {
  // Step 0 — historico medico
  doencas: string[];
  cirurgia_recente: boolean;
  cirurgia_detalhe: string;
  ultima_visita_dentista: string; // "< 6m" | "6-12m" | "1-2a" | "> 2a" | "Primeira vez"
  // Step 1 — alergias e medicacoes
  alergias: string[];
  medicacoes: string[];
  bisfosfonatos: boolean;       // PR20 — risco osteonecrose
  gravidez: string;
  // Step 2 — habitos
  tabagismo: boolean;
  etilismo: boolean;             // PR20
  bruxismo: boolean;
  sangramento_gengival: boolean;
  ansiedade_dental: boolean;     // PR20
  higiene_escovacao: string;     // PR20: "1x/dia" | "2x/dia" | "3x+/dia"
  higiene_fio: boolean;          // PR20
  // Step 3 — queixa + historico familiar
  queixa_principal: string;
  historico_familiar: string[];
  observacoes: string;
  // Step 4 — consentimento
  lgpd_consent: boolean;
};

interface Props {
  initialData?: Partial<AnamneseData>;
  onComplete: (data: AnamneseData) => void;
  onCancel?: () => void;
}

const STEPS = ["Histórico médico", "Alergias e medicações", "Hábitos e higiene", "Queixa e família", "Consentimento"];

const DOENCAS = [
  "Diabetes", "Hipertensão", "Cardiopatia", "Sopro/Válvula", "Marcapasso",
  "Febre reumática", "AVC prévio", "Hepatite", "HIV", "Distúrbio coagulação",
  "Osteoporose", "Câncer (cabeça/pescoço)", "Quimio/Radio recente", "Epilepsia",
  "Asma", "Anemia", "Distúrbio psiquiátrico", "DTM/Disfunção articular", "Nenhuma",
];
const ALERGIAS = ["Nenhuma", "Penicilina", "Dipirona", "Látex", "Anestésico (lidocaína)", "AAS", "Iodo", "Níquel", "Outra"];
const MEDICACOES = [
  "Nenhuma", "Anticoagulante (Marevan/Xarelto/Eliquis)", "Anti-hipertensivo",
  "Insulina", "Antidepressivo", "Corticoide", "Anticoncepcional",
  "Imunossupressor", "Quimioterápico", "Outra",
];
const GRAVIDEZ_OPTS = ["Não", "1º trimestre", "2º trimestre", "3º trimestre", "Amamentando", "N/A"];
const ULTIMA_VISITA_OPTS = ["< 6 meses", "6-12 meses", "1-2 anos", "> 2 anos", "Primeira vez"];
const ESCOVACAO_OPTS = ["1x/dia", "2x/dia", "3x+/dia"];
const HIST_FAMILIAR = ["Diabetes", "Cardiopatia", "Câncer", "Doença periodontal", "Bruxismo", "Nenhum"];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, selected && s.chipSelected]}>
      <Text style={[s.chipText, selected && s.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function BoolOption({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={[s.boolRow, value && s.boolRowActive]}>
      <View style={[s.boolDot, value && s.boolDotActive]} />
      <Text style={[s.boolLabel, value && s.boolLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function AnamneseWizard({ initialData, onComplete, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<AnamneseData>({
    doencas: [], alergias: [], medicacoes: [],
    cirurgia_recente: false, cirurgia_detalhe: "",
    ultima_visita_dentista: "",
    bisfosfonatos: false,
    gravidez: "Não",
    tabagismo: false, etilismo: false,
    bruxismo: false, sangramento_gengival: false,
    ansiedade_dental: false,
    higiene_escovacao: "", higiene_fio: false,
    queixa_principal: "",
    historico_familiar: [],
    observacoes: "",
    lgpd_consent: false,
    ...initialData,
  });

  const toggleArray = (field: "doencas" | "alergias" | "medicacoes" | "historico_familiar", val: string) => {
    const NONE_VALUES = ["Nenhuma", "Nenhum", "N/A"];
    setData(prev => {
      const arr = prev[field];
      if (NONE_VALUES.includes(val)) return { ...prev, [field]: [val] };
      const filtered = arr.filter(v => !NONE_VALUES.includes(v));
      return { ...prev, [field]: filtered.includes(val) ? filtered.filter(v => v !== val) : [...filtered, val] };
    });
  };

  const totalSteps = STEPS.length;
  const isLast = step === totalSteps - 1;

  return (
    <View style={s.container}>
      {/* Step indicator */}
      <View style={s.stepRow}>
        {STEPS.map((label, i) => (
          <Pressable key={i} onPress={() => i <= step && setStep(i)} style={s.stepItem}>
            <View style={[s.stepDot, i === step && s.stepDotActive, i < step && s.stepDotDone]} />
            {i === step && <Text style={s.stepLabel}>{label}</Text>}
          </Pressable>
        ))}
        <Text style={s.stepCount}>{step + 1}/{totalSteps}</Text>
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {/* Step 0 — Historico medico */}
        {step === 0 && (
          <View style={s.section}>
            <Text style={s.question}>Possui alguma condição sistêmica? (selecione todas)</Text>
            <View style={s.chipGrid}>
              {DOENCAS.map(d => (
                <Chip key={d} label={d} selected={data.doencas.includes(d)} onPress={() => toggleArray("doencas", d)} />
              ))}
            </View>
            <Text style={s.question}>Última visita ao dentista</Text>
            <View style={s.chipGrid}>
              {ULTIMA_VISITA_OPTS.map(v => (
                <Chip key={v} label={v} selected={data.ultima_visita_dentista === v}
                  onPress={() => setData(p => ({ ...p, ultima_visita_dentista: v }))} />
              ))}
            </View>
            <Text style={s.question}>Cirurgia/internação recente?</Text>
            <BoolOption
              label="Sim, nos últimos 6 meses"
              value={data.cirurgia_recente}
              onToggle={() => setData(p => ({ ...p, cirurgia_recente: !p.cirurgia_recente }))}
            />
            {data.cirurgia_recente && (
              <View>
                <Text style={[s.question, { fontSize: 12, marginTop: 4 }]}>Detalhe (procedimento, data)</Text>
                <TextInput
                  value={data.cirurgia_detalhe}
                  onChangeText={(v) => setData(p => ({ ...p, cirurgia_detalhe: v }))}
                  placeholder="Ex: Apendicectomia em jan/2026"
                  placeholderTextColor={Colors.ink3 || "#888"}
                  multiline
                  style={s.input}
                />
              </View>
            )}
          </View>
        )}

        {/* Step 1 — Alergias e medicacoes */}
        {step === 1 && (
          <View style={s.section}>
            <Text style={s.question}>Alergia a medicamento/material?</Text>
            <View style={s.chipGrid}>
              {ALERGIAS.map(a => (
                <Chip key={a} label={a} selected={data.alergias.includes(a)} onPress={() => toggleArray("alergias", a)} />
              ))}
            </View>
            <Text style={s.question}>Faz uso de medicação contínua?</Text>
            <View style={s.chipGrid}>
              {MEDICACOES.map(m => (
                <Chip key={m} label={m} selected={data.medicacoes.includes(m)} onPress={() => toggleArray("medicacoes", m)} />
              ))}
            </View>
            <Text style={s.hint}>
              ⚠️ Alendronato/Pamidronato (bisfosfonatos) tem risco de osteonecrose mandibular pós-cirurgia.
            </Text>
            <BoolOption
              label="Faz/fez uso de bisfosfonato (Alendronato, Pamidronato, etc.)"
              value={data.bisfosfonatos}
              onToggle={() => setData(p => ({ ...p, bisfosfonatos: !p.bisfosfonatos }))}
            />
            <Text style={s.question}>Gravidez/amamentação</Text>
            <View style={s.chipGrid}>
              {GRAVIDEZ_OPTS.map(g => (
                <Chip key={g} label={g} selected={data.gravidez === g} onPress={() => setData(p => ({ ...p, gravidez: g }))} />
              ))}
            </View>
          </View>
        )}

        {/* Step 2 — Habitos e higiene */}
        {step === 2 && (
          <View style={s.section}>
            <Text style={s.question}>Hábitos e sintomas</Text>
            <BoolOption label="Tabagismo (fuma ou fumou)" value={data.tabagismo}
              onToggle={() => setData(p => ({ ...p, tabagismo: !p.tabagismo }))} />
            <BoolOption label="Etilismo (consome álcool com frequência)" value={data.etilismo}
              onToggle={() => setData(p => ({ ...p, etilismo: !p.etilismo }))} />
            <BoolOption label="Bruxismo (range/aperta os dentes)" value={data.bruxismo}
              onToggle={() => setData(p => ({ ...p, bruxismo: !p.bruxismo }))} />
            <BoolOption label="Sangramento gengival ao escovar" value={data.sangramento_gengival}
              onToggle={() => setData(p => ({ ...p, sangramento_gengival: !p.sangramento_gengival }))} />
            <BoolOption label="Ansiedade ou medo de dentista" value={data.ansiedade_dental}
              onToggle={() => setData(p => ({ ...p, ansiedade_dental: !p.ansiedade_dental }))} />

            <Text style={[s.question, { marginTop: 6 }]}>Frequência de escovação</Text>
            <View style={s.chipGrid}>
              {ESCOVACAO_OPTS.map(o => (
                <Chip key={o} label={o} selected={data.higiene_escovacao === o}
                  onPress={() => setData(p => ({ ...p, higiene_escovacao: o }))} />
              ))}
            </View>
            <BoolOption label="Usa fio dental diariamente" value={data.higiene_fio}
              onToggle={() => setData(p => ({ ...p, higiene_fio: !p.higiene_fio }))} />
          </View>
        )}

        {/* Step 3 — Queixa + historico familiar + observacoes */}
        {step === 3 && (
          <View style={s.section}>
            <Text style={s.question}>Queixa principal (motivo da visita)</Text>
            <TextInput
              value={data.queixa_principal}
              onChangeText={(v) => setData(p => ({ ...p, queixa_principal: v }))}
              placeholder="Ex: dor no dente 36 ao mastigar"
              placeholderTextColor={Colors.ink3 || "#888"}
              multiline
              style={s.input}
            />

            <Text style={s.question}>Histórico familiar de</Text>
            <View style={s.chipGrid}>
              {HIST_FAMILIAR.map(h => (
                <Chip key={h} label={h} selected={data.historico_familiar.includes(h)}
                  onPress={() => toggleArray("historico_familiar", h)} />
              ))}
            </View>

            <Text style={s.question}>Observações livres</Text>
            <TextInput
              value={data.observacoes}
              onChangeText={(v) => setData(p => ({ ...p, observacoes: v }))}
              placeholder="Qualquer informação adicional relevante…"
              placeholderTextColor={Colors.ink3 || "#888"}
              multiline
              style={[s.input, { minHeight: 80 }]}
            />
          </View>
        )}

        {/* Step 4 — Consentimento LGPD */}
        {step === 4 && (
          <View style={s.section}>
            <Text style={s.question}>Consentimento para tratamento de dados</Text>
            <View style={s.consentBox}>
              <Text style={s.consentText}>
                Autorizo a coleta e armazenamento dos meus dados de saúde conforme a Lei Geral de Proteção de Dados (LGPD, Art. 11). Os dados serão utilizados exclusivamente para fins de tratamento odontológico e não serão compartilhados com terceiros sem autorização.
              </Text>
            </View>
            <BoolOption
              label="Li e concordo com o termo acima"
              value={data.lgpd_consent}
              onToggle={() => setData(p => ({ ...p, lgpd_consent: !p.lgpd_consent }))}
            />
          </View>
        )}
      </ScrollView>

      <View style={s.navRow}>
        {step > 0 ? (
          <Pressable onPress={() => setStep(step - 1)} style={s.btnBack}>
            <Text style={s.btnBackText}>Voltar</Text>
          </Pressable>
        ) : onCancel ? (
          <Pressable onPress={onCancel} style={s.btnBack}>
            <Text style={s.btnBackText}>Cancelar</Text>
          </Pressable>
        ) : <View />}

        {!isLast ? (
          <Pressable onPress={() => setStep(step + 1)} style={s.btnNext}>
            <Text style={s.btnNextText}>Próximo</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => data.lgpd_consent && onComplete(data)}
            style={[s.btnNext, !data.lgpd_consent && { opacity: 0.4 }]}
            disabled={!data.lgpd_consent}
          >
            <Text style={s.btnNextText}>Salvar anamnese</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.bg4 || "#333" },
  stepDotActive: { width: 24, borderRadius: 4, backgroundColor: "#06B6D4" },
  stepDotDone: { backgroundColor: "#10B981" },
  stepLabel: { fontSize: 10, color: "#06B6D4", fontWeight: "600" },
  stepCount: { fontSize: 10, color: Colors.ink3 || "#888", marginLeft: "auto" },
  content: { flex: 1 },
  section: { gap: 14, paddingBottom: 20 },
  question: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  hint: { fontSize: 11, color: Colors.ink3 || "#888", lineHeight: 16, marginTop: -6 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 0.5, borderColor: Colors.border || "#333",
    backgroundColor: "transparent",
  },
  chipSelected: { backgroundColor: "rgba(6,182,212,0.12)", borderColor: "#06B6D4" },
  chipText: { fontSize: 12, color: Colors.ink2 || "#aaa" },
  chipTextSelected: { color: "#06B6D4", fontWeight: "600" },
  boolRow: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
    borderRadius: 10, borderWidth: 0.5, borderColor: Colors.border || "#333",
    marginTop: 6,
  },
  boolRowActive: { backgroundColor: "rgba(6,182,212,0.08)", borderColor: "#06B6D4" },
  boolDot: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
    borderColor: Colors.ink3 || "#666",
  },
  boolDotActive: { backgroundColor: "#06B6D4", borderColor: "#06B6D4" },
  boolLabel: { fontSize: 13, color: Colors.ink2 || "#aaa", flex: 1 },
  boolLabelActive: { color: "#06B6D4", fontWeight: "500" },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: Colors.border || "#333", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    color: Colors.ink || "#fff", fontSize: 13,
    minHeight: 40,
    textAlignVertical: "top",
  },
  consentBox: {
    padding: 14, borderRadius: 10, backgroundColor: "rgba(6,182,212,0.06)",
    borderWidth: 0.5, borderColor: "rgba(6,182,212,0.2)",
  },
  consentText: { fontSize: 12, color: Colors.ink2 || "#aaa", lineHeight: 18 },
  navRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8 },
  btnBack: {
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10,
    borderWidth: 0.5, borderColor: Colors.border || "#333",
  },
  btnBackText: { fontSize: 13, color: Colors.ink3 || "#888", fontWeight: "500" },
  btnNext: {
    paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10,
    backgroundColor: "#06B6D4",
  },
  btnNextText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default AnamneseWizard;
