// ============================================================
// ImportAlunosModal — importação de alunos do dojô (F2)
//
// Wizard multi-passo (DNA TrocaModal/importação FPKT, com o Stepper da
// casa): Dados → Prévia → Importar → Resultado.
//
// PARSE (nenhuma dependência nova):
//   • ARQUIVO .xlsx/.xls/.csv → SheetJS ("xlsx"), que JÁ está no bundle
//     (a importação FPKT da federação usa import("xlsx") dinâmico) —
//     lida com Excel e CSV; web only (igual à tela da federação).
//   • COLAR CSV → parser manual pequeno (aspas + delimitador ; , TAB
//     detectado no cabeçalho) — funciona também no nativo.
//
// Mapeamento de colunas FIXO, documentado na própria tela (1ª linha =
// cabeçalho): Nome (obrigatória) · Nascimento · CPF · Telefone · Email
// · Faixa · Responsável · Tel. Responsável.
//
// Envio em LOTES de 500 (limite do backend); o import do backend é
// TOLERANTE (linha com dado inválido entra sem o campo + warning; CPF
// duplicado é pulado; menor sem responsável entra com aviso). O nº da
// linha nos warnings é ajustado pelo offset do lote antes de exibir.
// ============================================================
import React, { useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Platform,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { Stepper } from "@/components/karate/Stepper";
import {
  karateDojoStudentsApi, DojoImportRow, DojoImportResult, DOJO_IMPORT_MAX_ROWS,
} from "@/services/karateDojoStudentsApi";
import { isoToBR } from "./helpers";

const STEPS = ["Dados", "Prévia", "Importar", "Resultado"];

// ── Cabeçalhos aceitos (normalizados: minúsculo, sem acento/pontuação) ──
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function normHeader(v: any): string {
  return stripAccents(String(v ?? ""))
    .toLowerCase()
    .replace(/[._\-\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADER_MAP: Record<string, keyof DojoImportRow> = {
  "nome": "full_name",
  "nome completo": "full_name",
  "aluno": "full_name",
  "nome do aluno": "full_name",
  "nascimento": "birth_date",
  "data de nascimento": "birth_date",
  "data nascimento": "birth_date",
  "nasc": "birth_date",
  "cpf": "cpf",
  "telefone": "phone",
  "celular": "phone",
  "fone": "phone",
  "tel": "phone",
  "whatsapp": "phone",
  "email": "email",
  "e mail": "email",
  "faixa": "belt_label",
  "graduacao": "belt_label",
  "responsavel": "guardian_name",
  "nome do responsavel": "guardian_name",
  "responsavel nome": "guardian_name",
  "tel responsavel": "guardian_phone",
  "tel do responsavel": "guardian_phone",
  "telefone responsavel": "guardian_phone",
  "telefone do responsavel": "guardian_phone",
  "celular responsavel": "guardian_phone",
  "celular do responsavel": "guardian_phone",
};

// DD/MM/AAAA → ISO; ISO passa direto; outro formato vai cru (o backend
// tolerante importa a linha sem a data e devolve warning INVALID_BIRTH_DATE).
function toISOFlexible(v: any): string {
  const s = String(v ?? "").trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return s;
}

// CSV manual: detecta o delimitador (; , TAB) na linha do cabeçalho e
// respeita aspas duplas ("" = aspas literal). Suficiente pro caso de uso;
// planilha de verdade entra pelo caminho SheetJS.
export function parseCsv(text: string): string[][] {
  const nl = text.indexOf("\n");
  const firstLine = nl === -1 ? text : text.slice(0, nl);
  let delim = ",";
  let best = 0;
  for (const d of [";", ",", "\t"]) {
    const n = firstLine.split(d).length - 1;
    if (n > best) {
      best = n;
      delim = d;
    }
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === delim) {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((x) => String(x).trim() !== "")) rows.push(row);
      row = [];
    } else {
      cur += c;
    }
  }
  row.push(cur);
  if (row.some((x) => String(x).trim() !== "")) rows.push(row);
  return rows;
}

interface ParsedSheet {
  rows: DojoImportRow[];
  unknownHeaders: string[];
  hasNameCol: boolean;
}

export function rowsToImport(matrix: any[][]): ParsedSheet {
  if (!matrix.length) return { rows: [], unknownHeaders: [], hasNameCol: false };
  const headers = matrix[0].map(normHeader);
  const map: (keyof DojoImportRow | null)[] = headers.map((h) => HEADER_MAP[h] ?? null);
  const unknownHeaders = headers.filter((h, i) => !!h && !map[i]);
  const hasNameCol = map.indexOf("full_name") !== -1;
  const out: DojoImportRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    const obj: any = {};
    for (let c = 0; c < map.length; c++) {
      const field = map[c];
      if (!field) continue;
      const v = r[c];
      if (v == null || String(v).trim() === "") continue;
      obj[field] = field === "birth_date" ? toISOFlexible(v) : String(v).trim();
    }
    if (Object.keys(obj).length === 0) continue; // linha vazia
    if (!obj.full_name) obj.full_name = ""; // backend pula com warning MISSING_NAME
    out.push(obj as DojoImportRow);
  }
  return { rows: out, unknownHeaders, hasNameCol };
}

interface Props {
  visible: boolean;
  federationId: string;
  onClose: () => void;
  /** Chamado no Concluir (a lista recarrega). */
  onDone: () => void;
}

export function ImportAlunosModal({ visible, federationId, onClose, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<DojoImportRow[]>([]);
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<DojoImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setStep(0);
    setPasteText("");
    setFileName(null);
    setRows([]);
    setUnknownHeaders([]);
    setProgress({ done: 0, total: 0 });
    setResult(null);
    setErr(null);
  };

  const finishParse = (matrix: any[][], name: string | null) => {
    const parsed = rowsToImport(matrix);
    if (!parsed.hasNameCol) {
      setErr('Não achei a coluna "Nome". A primeira linha precisa ser o cabeçalho (Nome, Nascimento, CPF…).');
      return;
    }
    if (!parsed.rows.length) {
      setErr("Nenhuma linha de dados encontrada abaixo do cabeçalho.");
      return;
    }
    setRows(parsed.rows);
    setUnknownHeaders(parsed.unknownHeaders);
    setFileName(name);
    setErr(null);
    setStep(1);
  };

  const handlePickFile = () => {
    if (Platform.OS !== "web") return;
    setErr(null);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx,.xls";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setParsing(true);
      try {
        let matrix: any[][];
        if (/\.csv$/i.test(file.name)) {
          matrix = parseCsv(await file.text());
        } else {
          const buf = await file.arrayBuffer();
          const xlsx = await import("xlsx"); // já no bundle (importação FPKT)
          const wb = xlsx.read(buf, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          matrix = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as any[][];
        }
        finishParse(matrix, file.name);
      } catch {
        setErr("Não consegui ler o arquivo. Confirme que é .xlsx ou .csv — ou salve como CSV e tente de novo.");
      } finally {
        setParsing(false);
      }
    };
    input.click();
  };

  const handlePaste = () => {
    setErr(null);
    finishParse(parseCsv(pasteText), null);
  };

  const runImport = async () => {
    const chunks: DojoImportRow[][] = [];
    for (let i = 0; i < rows.length; i += DOJO_IMPORT_MAX_ROWS) {
      chunks.push(rows.slice(i, i + DOJO_IMPORT_MAX_ROWS));
    }
    setStep(2);
    setErr(null);
    setProgress({ done: 0, total: chunks.length });
    const acc: DojoImportResult = { created: 0, skipped: 0, warnings: [] };
    try {
      for (let i = 0; i < chunks.length; i++) {
        const res = await karateDojoStudentsApi.importStudents(federationId, chunks[i]);
        acc.created += res.created ?? 0;
        acc.skipped += res.skipped ?? 0;
        const offset = i * DOJO_IMPORT_MAX_ROWS;
        for (const w of res.warnings ?? []) acc.warnings.push({ ...w, row: w.row + offset });
        setProgress({ done: i + 1, total: chunks.length });
      }
      setResult(acc);
      setStep(3);
    } catch (e: any) {
      // Cada lote é uma transação: os anteriores JÁ entraram. Reenviar é
      // razoavelmente seguro (CPF duplicado é pulado), mas linha sem CPF
      // pode duplicar — por isso o aviso explícito.
      setErr(
        `${e?.data?.error || e?.message || "Falha ao importar."} Os lotes anteriores já entraram — linhas com CPF não duplicam ao reenviar; linhas sem CPF podem duplicar.`
      );
      setStep(1);
    }
  };

  const semNome = rows.filter((r) => !r.full_name || !String(r.full_name).trim()).length;
  const comNasc = rows.filter((r) => r.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(String(r.birth_date))).length;
  const comResp = rows.filter((r) => r.guardian_name).length;
  const batches = Math.ceil(rows.length / DOJO_IMPORT_MAX_ROWS);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.headTitle}>Importar alunos</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" style={styles.closeBtn}>
              <Icon name="close" size={18} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.body}>
            <Stepper steps={STEPS} currentStep={step} />

            {!!err && (
              <View style={styles.errBox}>
                <Icon name="warning" size={15} color={KarateColors.danger} />
                <Text style={styles.errTxt}>{err}</Text>
              </View>
            )}

            {step === 0 && (
              <View style={{ gap: 12 }}>
                <View style={styles.docBox}>
                  <Text style={styles.docTitle}>Colunas esperadas (1ª linha = cabeçalho)</Text>
                  <Text style={styles.docMono}>Nome* · Nascimento (DD/MM/AAAA) · CPF · Telefone · Email · Faixa · Responsável · Tel. Responsável</Text>
                  <Text style={styles.docHint}>
                    Só "Nome" é obrigatória — as outras podem faltar (dado ausente é neutro). Menor de 18 sem responsável entra mesmo assim, com aviso para você completar depois.
                  </Text>
                </View>

                {Platform.OS === "web" && (
                  <TouchableOpacity style={styles.drop} onPress={handlePickFile} accessibilityRole="button" accessibilityLabel="Escolher arquivo CSV ou XLSX" activeOpacity={0.85}>
                    {parsing ? (
                      <ActivityIndicator size="small" color={KarateColors.primary} />
                    ) : (
                      <Icon name="cloud-upload-outline" size={28} color={KarateColors.ink2} />
                    )}
                    <Text style={styles.dropTxt}>{parsing ? "Lendo o arquivo…" : "Escolher arquivo .xlsx ou .csv"}</Text>
                    <Text style={styles.dropHint}>No Excel/Google Planilhas dá para exportar como CSV, se preferir.</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.orTxt}>
                  {Platform.OS === "web"
                    ? "ou cole os dados direto (colunas separadas por ; , ou TAB)"
                    : "Cole os dados (colunas separadas por ; , ou TAB)"}
                </Text>
                <TextInput
                  style={styles.paste}
                  value={pasteText}
                  onChangeText={setPasteText}
                  placeholder={"Nome;Nascimento;Faixa;Responsável\nJoão da Silva;12/03/2014;Amarela;Maria da Silva"}
                  placeholderTextColor={KarateColors.ink4}
                  multiline
                  numberOfLines={6}
                />
                <KarateButton label="Ler dados colados" variant="sumi" size="md" onPress={handlePaste} disabled={!pasteText.trim()} />
              </View>
            )}

            {step === 1 && (
              <View style={{ gap: 12 }}>
                <View style={styles.docBox}>
                  {!!fileName && (
                    <Text style={styles.fileRow}>
                      <Icon name="document-text-outline" size={13} color={KarateColors.ink3} /> {fileName}
                    </Text>
                  )}
                  <Text style={styles.docTitle}>
                    {rows.length} linha{rows.length === 1 ? "" : "s"} · {comNasc} com nascimento · {comResp} com responsável
                    {semNome > 0 ? ` · ${semNome} sem nome (serão puladas)` : ""}
                  </Text>
                  {unknownHeaders.length > 0 && (
                    <Text style={styles.docHint}>Colunas ignoradas: {unknownHeaders.join(", ")}</Text>
                  )}
                  {batches > 1 && (
                    <Text style={styles.docHint}>Acima de {DOJO_IMPORT_MAX_ROWS} linhas o envio sai em {batches} lotes, automaticamente.</Text>
                  )}
                </View>

                <View style={styles.prevBox}>
                  {rows.slice(0, 8).map((r, i) => (
                    <View key={i} style={styles.prevRow}>
                      <Text style={styles.prevName} numberOfLines={1}>{r.full_name || "(sem nome — será pulada)"}</Text>
                      <Text style={styles.prevMeta} numberOfLines={1}>
                        {[
                          r.birth_date ? isoToBR(String(r.birth_date)) || String(r.birth_date) : null,
                          r.belt_label ?? null,
                          r.guardian_name ? `Resp.: ${r.guardian_name}` : null,
                        ].filter(Boolean).join(" · ") || "só o nome"}
                      </Text>
                    </View>
                  ))}
                  {rows.length > 8 && <Text style={styles.prevMeta}>… e mais {rows.length - 8} linha(s)</Text>}
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <KarateButton label="Voltar" variant="ghost" size="md" onPress={() => setStep(0)} style={{ flex: 1 }} />
                  <KarateButton label={`Importar ${rows.length} linha${rows.length === 1 ? "" : "s"}`} variant="sumi" size="md" onPress={runImport} style={{ flex: 2 }} />
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={KarateColors.primary} />
                <Text style={styles.centerTxt}>Importando…</Text>
                <Text style={styles.prevMeta}>Lote {progress.done} de {progress.total}</Text>
              </View>
            )}

            {step === 3 && result && (
              <View style={{ gap: 12 }}>
                <View style={styles.centerBox}>
                  <Icon name="checkmark-circle" size={44} color={KarateColors.ok} />
                  <Text style={styles.centerTxt}>Importação concluída</Text>
                </View>
                <View style={styles.resRow}>
                  <View style={styles.resStat}>
                    <Text style={[styles.resNum, { color: KarateColors.ok }]}>{result.created}</Text>
                    <Text style={styles.prevMeta}>importados</Text>
                  </View>
                  <View style={styles.resStat}>
                    <Text style={styles.resNum}>{result.skipped}</Text>
                    <Text style={styles.prevMeta}>pulados</Text>
                  </View>
                  <View style={styles.resStat}>
                    <Text style={[styles.resNum, result.warnings.length > 0 && { color: KarateColors.warn }]}>{result.warnings.length}</Text>
                    <Text style={styles.prevMeta}>avisos</Text>
                  </View>
                </View>
                {result.warnings.length > 0 && (
                  <ScrollView style={styles.warnBox}>
                    {result.warnings.map((w, i) => (
                      <Text key={i} style={styles.warnTxt}>Linha {w.row}: {w.message}</Text>
                    ))}
                  </ScrollView>
                )}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <KarateButton label="Importar outra" variant="ghost" size="md" onPress={reset} style={{ flex: 1 }} />
                  <KarateButton label="Concluir" variant="sumi" size="md" onPress={() => { onDone(); onClose(); reset(); }} style={{ flex: 2 }} />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 16 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 640, maxHeight: "92%", backgroundColor: "#fdf8f2", borderRadius: 16, overflow: "hidden" } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  headTitle: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  closeBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" } as ViewStyle,
  body: { padding: 16, gap: 14 } as ViewStyle,
  errBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.dangerSoft, borderRadius: KarateRadius.sm, padding: 10 } as ViewStyle,
  errTxt: { flex: 1, fontSize: 12.5, color: KarateColors.danger, fontWeight: "600", lineHeight: 17 } as TextStyle,
  docBox: { gap: 5, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, padding: 12 } as ViewStyle,
  docTitle: { fontSize: 12.5, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  docMono: { fontSize: 12, color: KarateColors.ink2, fontFamily: "monospace", lineHeight: 18 } as TextStyle,
  docHint: { fontSize: 11.5, color: KarateColors.ink3, lineHeight: 16 } as TextStyle,
  fileRow: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  drop: { borderWidth: 2, borderStyle: "dashed", borderColor: KarateColors.border2, borderRadius: KarateRadius.lg, paddingVertical: 26, alignItems: "center", gap: 8 } as ViewStyle,
  dropTxt: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  dropHint: { fontSize: 11.5, color: KarateColors.ink3 } as TextStyle,
  orTxt: { fontSize: 12, color: KarateColors.ink3, textAlign: "center" } as TextStyle,
  paste: { minHeight: 120, textAlignVertical: "top", backgroundColor: "#fff", borderWidth: 1.5, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, padding: 12, fontSize: 12.5, color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
  prevBox: { gap: 8, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.glass2 } as ViewStyle,
  prevRow: { gap: 1 } as ViewStyle,
  prevName: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  prevMeta: { fontSize: 11.5, color: KarateColors.ink3 } as TextStyle,
  centerBox: { alignItems: "center", gap: 8, paddingVertical: 22 } as ViewStyle,
  centerTxt: { fontSize: 15, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  resRow: { flexDirection: "row", gap: 10 } as ViewStyle,
  resStat: { flex: 1, alignItems: "center", gap: 2, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, paddingVertical: 12, backgroundColor: KarateColors.surface } as ViewStyle,
  resNum: { fontSize: 22, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
  warnBox: { maxHeight: 200, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 10, backgroundColor: KarateColors.surface } as ViewStyle,
  warnTxt: { fontSize: 12, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
});
