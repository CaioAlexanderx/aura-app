import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-03: AnamneseWizard — 4-step structured dental anamnesis
// Steps: Historico Medico → Alergias → Habitos → Consentimento
// ============================================================

export type AnamneseData = {
  doencas: string[];
  alergias: string[];
  medicacoes: string[];
  gravidez: string;
  tabagismo: boolean;
  bruxismo: boolean;
  sangramento_gengival: boolean;
  cirurgia_recente: boolean;
  cirurgia_detalhe: string;
  observacoes: string;
  lgpd_consent: boolean;
};

interface Props {
  initialData?: Partial<AnamneseData>;
  onComplete: (data: AnamneseData) => void;
  onCancel?: () => void;
}

const STEPS = ["Historico medico", "Alergias e medicacoes", "Habitos", "Consentimento"];

const DOENCAS = ["Diabetes", "Hipertensao", "Cardiopatia", "Hepatite", "HIV", "Epilepsia", "Asma", "Anemia", "Nenhuma"];
const ALERGIAS = ["Nenhuma", "Penicilina", "Dipirona", "Latex", "Anestesico", "AAS", "Iodo", "Outra"];
const MEDICACOES = ["Nenhuma", "Anticoagulante", "Anti-hipertensivo", "Insulina", "Antidepressivo", "Corticoide", "Anticoncepcional", "Outra"];
const GRAVIDEZ_OPTS = ["Nao", "Gravida", "Amamentando", "N/A"];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, selected && s.chipSelected]}
    >
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
    gravidez: "Nao", tabagismo: false, bruxismo: false,
    sangramento_gengival: false, cirurgia_recente: false,
    cirurgia_detalhe: "", observacoes: "", lgpd_consent: false,
    ...initialData,
  });

  const toggleArray = (field: "doencas" | "alergias" | "medicacoes", val: string) => {
    setData(prev => {
      const arr = prev[field];
      if (val === "Nenhuma" || val === "N/A") return { ...prev, [field]: [val] };
      const filtered = arr.filter(v => v !== "Nenhuma" && v !== "N/A");
      return { ...prev, [field]: filtered.includes(val) ? filtered.filter(v => v !== val) : [...filtered, val] };
    });
  };

  const canAdvance = step < 3 || data.lgpd_consent;

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
        <Text style={s.stepCount}>{step + 1}/{STEPS.length}</Text>
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {/* Step 0: Historico medico */}
        {step === 0 && (
          <View style={s.section}>
            <Text style={s.question}>Possui alguma doenca sistemica?</Text>
            <View style={s.chipGrid}>
              {DOENCAS.map(d => (
                <Chip key={d} label={d} selected={data.doencas.includes(d)} onPress={() => toggleArray("doencas", d)} />
              ))}
            </View>
            <Text style={s.question}>Fez alguma cirurgia recentemente?</Text>
            <BoolOption label="Sim, fiz cirurgia nos ultimos 6 meses" value={data.cirurgia_recente} onToggle={() => setData(p => ({ ...p, cirurgia_recente: !p.cirurgia_recente }))} />
          </View>
        )}

        {/* Step 1: Alergias */}
        {step === 1 && (
          <View style={s.section}>
            <Text style={s.question}>Alergia a algum medicamento?</Text>
            <View style={s.chipGrid}>
              {ALERGIAS.map(a => (
                <Chip key={a} label={a} selected={data.alergias.includes(a)} onPress={() => toggleArray("alergias", a)} />
              ))}
            </View>
            <Text style={s.question}>Faz uso de medicacao continua?</Text>
            <View style={s.chipGrid}>
              {MEDICACOES.map(m => (
                <Chip key={m} label={m} selected={data.medicacoes.includes(m)} onPress={() => toggleArray("medicacoes", m)} />
              ))}
            </View>
            <Text style={s.question}>Esta gravida ou amamentando?</Text>
            <View style={s.chipGrid}>
              {GRAVIDEZ_OPTS.map(g => (
                <Chip key={g} label={g} selected={data.gravidez === g} onPress={() => setData(p => ({ ...p, gravidez: g }))} />
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Habitos */}
        {step === 2 && (
          <View style={s.section}>
            <Text style={s.question}>Habitos e sintomas</Text>
            <BoolOption label="Tabagismo (fuma ou fumou)" value={data.tabagismo} onToggle={() => setData(p => ({ ...p, tabagismo: !p.tabagismo }))} />
            <BoolOption label="Bruxismo (range ou aperta os dentes)" value={data.bruxismo} onToggle={() => setData(p => ({ ...p, bruxismo: !p.bruxismo }))} />
            <BoolOption label="Sangramento gengival ao escovar" value={data.sangramento_gengival} onToggle={() => setData(p => ({ ...p, sangramento_gengival: !p.sangramento_gengival }))} />
          </View>
        )}

        {/* Step 3: Consentimento LGPD */}
        {step === 3 && (
          <View style={s.section}>
            <Text style={s.question}>Consentimento para tratamento de dados</Text>
            <View style={s.consentBox}>
              <Text style={s.consentText}>
                Autorizo a coleta e armazenamento dos meus dados de saude conforme a Lei Geral de Protecao de Dados (LGPD, Art. 11). Os dados serao utilizados exclusivamente para fins de tratamento odontologico e nao serao compartilhados com terceiros sem autorizacao.
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

      {/* Navigation */}
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

        {step < 3 ? (
          <Pressable onPress={() => setStep(step + 1)} style={s.btnNext}>
            <Text style={s.btnNextText}>Proximo</Text>
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
