// ============================================================
// Importação FPKT — Aura Karatê (federação) · Shoji
//
// Fluxo da planilha consolidada FPKT (abas Academias + Alunos):
//   1 Upload  — escolhe o .xlsx e lê as abas (SheetJS, já no app)
//   2 Prévia  — quantos dojôs/alunos, quantos serão pulados (sem Número FPKT)
//   3 Importar— sobe em lotes pro POST .../practitioners/import/batch-fpkt
//   4 Resumo  — criados/atualizados/pulados
//
// Filosofia: a base legada tem buracos legítimos. Dado AUSENTE é neutro
// (não é erro/pendência); só sinalizamos linhas sem o Número FPKT (a chave),
// que não dá pra importar. Upsert "completar o que falta" no backend.
// Faixa NÃO entra no v1 (a aba Alunos não tem data de graduação).
// ============================================================
import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Platform, Alert,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as XLSX from "xlsx";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { Stepper } from "@/components/karate/Stepper";
import { ShojiBackground, PageHead, Card, ShojiButton, Body, Mono } from "@/components/karate/shoji";
import { request } from "@/services/api";
import { useKarateFederation } from "@/contexts/KarateFederation";

const STEPS = ["Upload", "Prévia", "Importar", "Resumo"];
const STUDENT_BATCH = 500;

// ── Normalização (a base legada tem buracos; ausente vira null) ──
const clean = (v: any): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const up = s.toUpperCase();
  if (up === "XX" || up === "NONE" || s === "-") return null;
  return s;
};
const digits = (v: any): string | null => {
  const s = clean(v);
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  return d || null;
};
const toISO = (v: any): string | null => {
  const s = clean(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
};
const composeAddr = (...parts: any[]): string | null => {
  const xs = parts.map(clean).filter(Boolean);
  return xs.length ? xs.join(", ") : null;
};
const newBatchId = () => `fpkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Dojo = { cod: string | null; name: string | null; status: string; address: string | null; phone: string | null };
type Student = {
  registration_number: string | null; name: string | null; birth_date: string | null;
  cpf: string | null; rg: string | null; street: string | null; number: string | null;
  neighborhood: string | null; city: string | null; state: string | null;
  zip_code: string | null; phone: string | null; academia_name: string | null;
};
type Parsed = { dojos: Dojo[]; students: Student[]; fileName: string };
type Summary = {
  dojos: { created: number; updated: number };
  students: { created: number; updated: number; skipped: number };
};

// Lê uma aba pulando a 1ª linha (banner); a 2ª linha são os cabeçalhos reais.
function sheetRows(wb: XLSX.WorkBook, name: string): any[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { range: 1, defval: null, raw: false });
}

function parseWorkbook(wb: XLSX.WorkBook, fileName: string): Parsed {
  const aca = sheetRows(wb, "Academias");
  const alu = sheetRows(wb, "Alunos");

  const dojos: Dojo[] = aca.map((r) => ({
    cod: clean(r["Cód."]),
    name: clean(r["Academia"]),
    status: /ativ/i.test(String(r["Status"] ?? "")) ? "active" : "inactive",
    address: composeAddr(r["Endereço"], r["Bairro"], r["Cidade"], r["Estado"]),
    phone: clean(r["Telefone"]),
  })).filter((d) => d.name);

  const students: Student[] = alu.map((r) => ({
    registration_number: clean(r["Número FPKT"]),
    name: clean(r["Nome"]),
    birth_date: toISO(r["Nascimento"]),
    cpf: digits(r["CPF"]),
    rg: clean(r["RG"]),
    street: clean(r["Logradouro"]),
    number: clean(r["Número"]),
    neighborhood: clean(r["Bairro"]),
    city: clean(r["Cidade"]),
    state: clean(r["Estado"]),
    zip_code: digits(r["CEP"]),
    phone: clean(r["Telefone"]),
    academia_name: clean(r["Academia"]),
  })).filter((s) => s.name || s.registration_number);

  return { dojos, students, fileName };
}

export default function ImportacaoScreen() {
  const { federationId } = useKarateFederation();
  const [step, setStep] = useState(0);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePick() {
    setError(null);
    if (Platform.OS !== "web") {
      Alert.alert("Use no computador", "A importação de planilha funciona no Aura pelo navegador (desktop). Abra esta tela no computador para enviar o arquivo.");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setParsing(true);
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const p = parseWorkbook(wb, file.name);
        if (!p.dojos.length && !p.students.length) {
          setError("Não encontrei as abas 'Academias' e 'Alunos' na planilha.");
          setParsing(false);
          return;
        }
        setParsed(p);
        setStep(1);
      } catch (err: any) {
        setError("Não consegui ler o arquivo. Confirme que é a planilha .xlsx da FPKT.");
      } finally {
        setParsing(false);
      }
    };
    input.click();
  }

  const skipCount = parsed ? parsed.students.filter((s) => !s.registration_number).length : 0;
  const importableStudents = parsed ? parsed.students.filter((s) => s.registration_number) : [];

  async function runImport() {
    if (!parsed) return;
    setStep(2);
    setError(null);
    const batchId = newBatchId();
    const chunks: Student[][] = [];
    for (let i = 0; i < importableStudents.length; i += STUDENT_BATCH) {
      chunks.push(importableStudents.slice(i, i + STUDENT_BATCH));
    }
    if (chunks.length === 0) chunks.push([]); // ao menos 1 req (sobe os dojôs)

    const acc: Summary = { dojos: { created: 0, updated: 0 }, students: { created: 0, updated: 0, skipped: 0 } };
    setProgress({ done: 0, total: chunks.length });

    try {
      for (let i = 0; i < chunks.length; i++) {
        const res: any = await request(`/federation/${federationId}/practitioners/import/batch-fpkt`, {
          method: "POST",
          body: {
            import_batch_id: batchId,
            dojos: i === 0 ? parsed.dojos : [], // dojôs só no 1º lote
            students: chunks[i],
          },
        });
        acc.dojos.created += res?.dojos?.created ?? 0;
        acc.dojos.updated += res?.dojos?.updated ?? 0;
        acc.students.created += res?.students?.created ?? 0;
        acc.students.updated += res?.students?.updated ?? 0;
        acc.students.skipped += res?.students?.skipped ?? 0;
        setProgress({ done: i + 1, total: chunks.length });
      }
      setSummary(acc);
      setStep(3);
    } catch (err: any) {
      setError(err?.message ?? "Falha ao importar. Os lotes já enviados foram salvos; reenviar é seguro (idempotente).");
    }
  }

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHead
          eyebrow="Planilha consolidada FPKT"
          title="Importar dados"
          sub="Suba a planilha (.xlsx) com as abas Academias e Alunos. Os dados que faltam ficam como estão — você completa quando for prioridade."
        />
        <View style={{ marginVertical: 18 }}>
          <Stepper steps={STEPS} currentStep={step} />
        </View>

        {error ? (
          <Card style={styles.errCard}>
            <Ionicons name="warning" size={16} color={P.red} />
            <Body style={{ flex: 1, color: P.red }}>{error}</Body>
          </Card>
        ) : null}

        {/* 1 — UPLOAD */}
        {step === 0 && (
          <Card>
            <TouchableOpacity style={styles.drop} onPress={handlePick} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Selecionar planilha xlsx">
              {parsing ? <ActivityIndicator size="large" color={P.red} /> : <Ionicons name="cloud-upload-outline" size={40} color={C.ink2} />}
              <Text style={styles.dropLabel}>{parsing ? "Lendo a planilha…" : "Clique para escolher o arquivo .xlsx"}</Text>
              <Body muted style={{ fontSize: 12 }}>Abas esperadas: Academias e Alunos</Body>
            </TouchableOpacity>
          </Card>
        )}

        {/* 2 — PRÉVIA */}
        {step === 1 && parsed && (
          <View style={{ gap: 14 }}>
            <Card>
              <Text style={styles.fileRow}><Ionicons name="document-text-outline" size={14} color={C.ink3} /> <Mono style={{ fontSize: 12 }}>{parsed.fileName}</Mono></Text>
              <View style={styles.statRow}>
                <Stat n={parsed.dojos.length} label="academias" />
                <Stat n={importableStudents.length} label="alunos" />
                {skipCount > 0 ? <Stat n={skipCount} label="sem Nº FPKT" tone="muted" /> : null}
              </View>
            </Card>
            <Card style={{ gap: 6 }}>
              <Body style={{ fontWeight: "700" as any }}>Como vai funcionar</Body>
              <Body muted style={{ fontSize: 12.5 }}>• Academias entram primeiro; alunos são vinculados ao dojô pelo nome.</Body>
              <Body muted style={{ fontSize: 12.5 }}>• Registros que já existem são <Text style={{ fontWeight: "700" as any }}>complementados</Text> — nunca sobrescritos.</Body>
              <Body muted style={{ fontSize: 12.5 }}>• Reenviar a mesma planilha é seguro (não duplica).</Body>
              {skipCount > 0 ? <Body muted style={{ fontSize: 12.5 }}>• {skipCount} aluno(s) sem Número FPKT ficam de fora (sem chave para vincular).</Body> : null}
              <Body muted style={{ fontSize: 12.5 }}>• A faixa atual não entra nesta importação (fica para um passo dedicado).</Body>
            </Card>
            <View style={styles.row2}>
              <ShojiButton label="Trocar arquivo" variant="ghost" onPress={() => { setParsed(null); setStep(0); }} style={{ flex: 1 }} />
              <ShojiButton label={`Importar ${importableStudents.length} aluno(s)`} variant="sumi" onPress={runImport} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {/* 3 — IMPORTANDO */}
        {step === 2 && (
          <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
            <ActivityIndicator size="large" color={P.red} />
            <Body style={{ fontWeight: "700" as any }}>Importando…</Body>
            <Body muted>Lote {progress.done} de {progress.total}</Body>
          </Card>
        )}

        {/* 4 — RESUMO */}
        {step === 3 && summary && (
          <View style={{ gap: 14 }}>
            <Card style={{ alignItems: "center", gap: 8, paddingVertical: 24 }}>
              <Ionicons name="checkmark-circle" size={56} color={C.ok} />
              <Text style={styles.doneTitle}>Importação concluída</Text>
            </Card>
            <Card style={{ gap: 10 }}>
              <SumRow label="Academias" created={summary.dojos.created} updated={summary.dojos.updated} />
              <SumRow label="Alunos" created={summary.students.created} updated={summary.students.updated} skipped={summary.students.skipped} />
            </Card>
            <ShojiButton label="Importar outra planilha" variant="ghost" onPress={() => { setParsed(null); setSummary(null); setProgress({ done: 0, total: 0 }); setStep(0); }} />
          </View>
        )}
      </ScrollView>
    </ShojiBackground>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "muted" }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statN, tone === "muted" && { color: C.ink3 }]}>{n}</Text>
      <Body muted style={{ fontSize: 11 }}>{label}</Body>
    </View>
  );
}
function SumRow({ label, created, updated, skipped }: { label: string; created: number; updated: number; skipped?: number }) {
  return (
    <View style={styles.sumRow}>
      <Body style={{ fontWeight: "700" as any, width: 96 }}>{label}</Body>
      <Body muted style={{ flex: 1 }}>
        <Text style={{ color: C.ok, fontWeight: "700" as any }}>{created}</Text> novos · <Text style={{ fontWeight: "700" as any }}>{updated}</Text> complementados{typeof skipped === "number" && skipped > 0 ? <> · {skipped} pulados</> : null}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 40, paddingBottom: 72, maxWidth: 820, width: "100%", alignSelf: "center" } as ViewStyle,
  errCard: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, borderColor: P.red } as ViewStyle,
  drop: { borderWidth: 2, borderStyle: "dashed", borderColor: C.line, borderRadius: R.lg, paddingVertical: 40, alignItems: "center", gap: 10 } as ViewStyle,
  dropLabel: { fontFamily: F.body, fontSize: 14, fontWeight: "700", color: C.ink } as TextStyle,
  fileRow: { fontFamily: F.body, fontSize: 12, color: C.ink3, marginBottom: 12 } as TextStyle,
  statRow: { flexDirection: "row", gap: 12 } as ViewStyle,
  stat: { flex: 1, alignItems: "center", paddingVertical: 12, backgroundColor: P.glass, borderRadius: R.md, borderWidth: 1, borderColor: C.line } as ViewStyle,
  statN: { fontFamily: F.heading, fontSize: 26, color: P.red, lineHeight: 30 } as TextStyle,
  row2: { flexDirection: "row", gap: 10 } as ViewStyle,
  doneTitle: { fontFamily: F.heading, fontSize: 20, color: C.ink } as TextStyle,
  sumRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
});
