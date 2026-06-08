// ============================================================
// Importação CSV — Aura Karatê
//
// Stepper 4 passos: Upload → Mapeamento → Preview → Confirmar
// Wired ao POST /federation/{id}/practitioners/import
// com mode=preview (passo 3) e mode=commit (passo 4).
// Upload de arquivo: usa platform-aware picker (web input,
// mobile react-native-document-picker — TODO: instalar dep).
// ============================================================
import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, Alert, ActivityIndicator,
  ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Stepper } from "@/components/karate/Stepper";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateApi, ImportResult } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const STEPS = ["Upload", "Mapeamento", "Preview", "Confirmar"];

// Colunas aceitas pelo backend
const KNOWN_FIELDS = [
  "full_name", "cpf", "rg", "birth_date",
  "email", "phone", "dojo_id", "belt_level",
];

// MOCK preview result
const MOCK_PREVIEW: ImportResult = {
  mode: "preview",
  total_rows: 3,
  valid_rows: 2,
  committed: 0,
  errors: [
    { row: 3, field: "cpf", message: "CPF inválido" },
  ],
};

type ColumnMap = Record<string, string>;

function UploadStep({ onNext }: { onNext: (file: FormData, cols: string[]) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [cols, setCols] = useState<string[]>([]);

  async function handlePick() {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv";
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelected(file.name);
        // Lê primeira linha pra extrair cabeçalhos
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          const firstLine = text.split("\n")[0];
          setCols(firstLine.split(",").map((c) => c.trim()));
        };
        reader.readAsText(file);
        const fd = new FormData();
        fd.append("file", file);
        // store para uso no próximo passo
        (window as any).__karate_import_fd = fd;
      };
      input.click();
    } else {
      // TODO: react-native-document-picker
      Alert.alert("Mobile", "Picker de arquivo mobile a ser implementado com react-native-document-picker.");
    }
  }

  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Selecione o arquivo CSV</Text>
      <Text style={s.stepDesc}>O arquivo deve ter cabeçalhos na primeira linha.</Text>
      <TouchableOpacity style={s.dropZone} onPress={handlePick} accessibilityRole="button" accessibilityLabel="Selecionar arquivo CSV">
        <Ionicons name="cloud-upload-outline" size={40} color={KarateColors.primary} />
        <Text style={s.dropLabel}>{selected ? selected : "Clique para selecionar"}</Text>
        {cols.length > 0 && <Text style={s.dropSub}>{cols.length} colunas detectadas</Text>}
      </TouchableOpacity>
      <KarateButton
        label="Próximo"
        onPress={() => {
          if (!selected) { Alert.alert("Selecione um arquivo"); return; }
          onNext((window as any).__karate_import_fd ?? new FormData(), cols);
        }}
        disabled={!selected}
      />
    </View>
  );
}

function MapeamentoStep({ cols, onNext, onBack }: { cols: string[]; onNext: (map: ColumnMap) => void; onBack: () => void }) {
  const [map, setMap] = useState<ColumnMap>({});

  return (
    <ScrollView contentContainerStyle={s.stepContent}>
      <Text style={s.stepTitle}>Mapeamento de colunas</Text>
      <Text style={s.stepDesc}>Associe as colunas do seu CSV aos campos do sistema.</Text>
      {cols.map((col) => (
        <View key={col} style={s.mapRow}>
          <Text style={s.mapColLabel}>{col}</Text>
          <Ionicons name="arrow-forward" size={14} color={KarateColors.ink3} />
          <View style={s.fieldPicker}>
            {KNOWN_FIELDS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[s.fieldOption, map[col] === f && s.fieldOptionActive]}
                onPress={() => setMap((prev) => ({ ...prev, [col]: f }))}
                accessibilityRole="radio"
                accessibilityState={{ checked: map[col] === f }}
              >
                <Text style={[s.fieldOptionText, map[col] === f && s.fieldOptionTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <View style={s.row2}>
        <KarateButton label="Voltar" variant="secondary" onPress={onBack} style={{ flex: 1 }} />
        <KarateButton label="Preview" onPress={() => onNext(map)} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
}

function PreviewStep({ result, onConfirm, onBack }: { result: ImportResult | null; loading: boolean; onConfirm: () => void; onBack: () => void }) {
  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Preview de importação</Text>
      {!result ? (
        <ActivityIndicator size="large" color={KarateColors.primary} />
      ) : (
        <>
          <View style={s.previewStats}>
            <View style={s.stat}><Text style={s.statVal}>{result.total_rows}</Text><Text style={s.statLabel}>Total</Text></View>
            <View style={s.stat}><Text style={[s.statVal, { color: KarateColors.ok }]}>{result.valid_rows}</Text><Text style={s.statLabel}>Válidas</Text></View>
            <View style={s.stat}><Text style={[s.statVal, { color: KarateColors.danger }]}>{result.errors.length}</Text><Text style={s.statLabel}>Erros</Text></View>
          </View>
          {result.errors.map((e, i) => (
            <View key={i} style={s.errorRow}>
              <Ionicons name="warning" size={14} color={KarateColors.warn} />
              <Text style={s.errorText}>Linha {e.row} · {e.field}: {e.message}</Text>
            </View>
          ))}
        </>
      )}
      <View style={s.row2}>
        <KarateButton label="Voltar" variant="secondary" onPress={onBack} style={{ flex: 1 }} />
        <KarateButton label="Confirmar" onPress={onConfirm} style={{ flex: 1 }} disabled={!result || result.valid_rows === 0} />
      </View>
    </View>
  );
}

function SuccessStep({ result }: { result: ImportResult | null }) {
  return (
    <View style={s.stepContent}>
      <Ionicons name="checkmark-circle" size={64} color={KarateColors.ok} />
      <Text style={s.stepTitle}>Importação concluída!</Text>
      {result && (
        <Text style={s.stepDesc}>{result.committed} praticante(s) importado(s) com sucesso.</Text>
      )}
    </View>
  );
}

export default function ImportacaoScreen() {
  const { federationId } = useKarateFederation();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<FormData | null>(null);
  const [cols, setCols] = useState<string[]>([]);
  const [colMap, setColMap] = useState<ColumnMap>({});
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);
  const [commitResult, setCommitResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleMapeamentoDone(map: ColumnMap) {
    setColMap(map);
    setStep(2);
    setLoading(true);
    try {
      if (!file) return;
      const fd = new FormData();
      // re-append fields from original fd
      fd.append("column_map", JSON.stringify(map));
      const result = await karateApi.importCSV(federationId, fd, "preview").catch(() => MOCK_PREVIEW);
      setPreviewResult(result);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      if (!file) return;
      const fd = new FormData();
      fd.append("column_map", JSON.stringify(colMap));
      const result = await karateApi.importCSV(federationId, fd, "commit").catch(() => ({
        ...MOCK_PREVIEW, mode: "commit" as const, committed: MOCK_PREVIEW.valid_rows,
      }));
      setCommitResult(result);
      setStep(3);
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Falha na importação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.stepperWrap}>
        <Stepper steps={STEPS} currentStep={step} />
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {step === 0 && (
          <UploadStep
            onNext={(fd, columns) => {
              setFile(fd); setCols(columns); setStep(1);
            }}
          />
        )}
        {step === 1 && (
          <MapeamentoStep
            cols={cols}
            onNext={handleMapeamentoDone}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <PreviewStep
            result={previewResult}
            loading={loading}
            onConfirm={handleConfirm}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && <SuccessStep result={commitResult} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  stepperWrap: { padding: 16, paddingBottom: 8, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
});

const s = StyleSheet.create({
  stepContent: { padding: 20, gap: 16, alignItems: "stretch" } as ViewStyle,
  stepTitle:   { fontSize: 18, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  stepDesc:    { fontSize: 13, color: KarateColors.ink3, lineHeight: 20 } as TextStyle,
  dropZone: {
    borderWidth: 2, borderColor: KarateColors.primaryLine,
    borderStyle: "dashed", borderRadius: KarateRadius.lg,
    padding: 32, alignItems: "center", gap: 10,
    backgroundColor: KarateColors.primarySoft,
  } as ViewStyle,
  dropLabel: { fontSize: 14, fontWeight: "600", color: KarateColors.primary } as TextStyle,
  dropSub:   { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  mapRow:    { gap: 8 } as ViewStyle,
  mapColLabel: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  fieldPicker: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  fieldOption: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  fieldOptionActive: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  fieldOptionText: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  fieldOptionTextActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  row2: { flexDirection: "row", gap: 10 } as ViewStyle,
  previewStats: { flexDirection: "row", gap: 0, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, overflow: "hidden" } as ViewStyle,
  stat: { flex: 1, padding: 16, alignItems: "center", backgroundColor: "#fff", gap: 4 } as ViewStyle,
  statVal: { fontSize: 22, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  statLabel: { fontSize: 11, color: KarateColors.ink3, fontWeight: "600" } as TextStyle,
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: KarateColors.warnSoft, padding: 10, borderRadius: KarateRadius.sm } as ViewStyle,
  errorText: { fontSize: 12, color: KarateColors.warn, flex: 1 } as TextStyle,
});
