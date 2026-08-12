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
// DE-PARA DE COLUNAS (12/08/2026 — planilha real do Areikan, 484 alunos):
// a planilha do dojô tem 15 colunas — Nome · Graduação KYU · Academia ·
// Ativo · Data Nascimento · RG · CPF · Pai · Mãe · Telefone · Endereço ·
// CEP · Bairro · Cidade · Email — e o front só conhecia 5 delas. A prévia
// acusava "Colunas ignoradas: graduacao kyu, academia, ativo, rg, pai,
// mae, endereco, cep, bairro, cidade" e "0 com responsável".
//
// A causa era o lookup EXATO: normHeader("Graduação KYU") = "graduacao
// kyu", e o mapa só tinha "graduacao" seco; "Mãe" e "Endereço" nem
// existiam. O BACKEND já aceita as 15 colunas desde o Aura-backend#480
// (F12, mergeado em 10/08) — quem ficou para trás foi este arquivo.
//
// Duas camadas de casamento, nesta ordem:
//   1) HEADER_MAP — lookup exato do cabeçalho normalizado (rápido,
//      previsível, é o que documenta o contrato).
//   2) matchHeaderLoose — 2ª passada por TOKENS, só para o que sobrou.
//      Planilha de dojô varia muito ("Nome da Mãe", "Município", "Tel.
//      do Responsável"), mas heurística que erra em silêncio é pior que
//      coluna ignorada: a regra casa por palavra inteira, exige TODOS os
//      grupos (AND entre grupos, OR dentro de cada um), tem lista de
//      rejeição, e só aceita quando EXATAMENTE UMA regra bate. Empate,
//      zero regras, ou campo já casado por lookup exato → a coluna cai em
//      "ignorada", que é o comportamento seguro e VISÍVEL na prévia.
//
// NADA de normalizar dado aqui. O backend já resolve telefone com máscara
// quebrada, CPF com DV inválido (warning, não bloqueia), número grudado no
// endereço e grafia de faixa ("Azul Escura", "1º Kyu - Marrom", "Preta 1º
// Dan"). O front manda o texto CRU sob a chave certa — duplicar
// normalização só cria divergência entre os dois lados.
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
import { isoToBR, ageFromISO } from "./helpers";

const STEPS = ["Dados", "Prévia", "Importar", "Resultado"];

// ── Cabeçalhos aceitos (normalizados: minúsculo, sem acento/pontuação) ──
function stripAccents(s: string): string {
  // ̀-ͯ = combining diacritical marks (escapado de propósito:
  // literal cru neste range já foi corrompido em push antes).
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
  // ── nome ──
  "nome": "full_name",
  "nome completo": "full_name",
  "aluno": "full_name",
  "nome do aluno": "full_name",
  "nome aluno": "full_name",
  "praticante": "full_name",
  // ── nascimento ──
  "nascimento": "birth_date",
  "data de nascimento": "birth_date",
  "data nascimento": "birth_date",
  "data nasc": "birth_date",
  "dt nascimento": "birth_date",
  "nasc": "birth_date",
  // ── documentos ──
  "cpf": "cpf",
  "rg": "rg",
  "identidade": "rg",
  "documento": "rg",
  // ── contato ──
  "telefone": "phone",
  "celular": "phone",
  "fone": "phone",
  "tel": "phone",
  "whatsapp": "phone",
  "email": "email",
  "e mail": "email",
  // ── graduação (planilha do Areikan: "Graduação KYU") ──
  "faixa": "belt_label",
  "graduacao": "belt_label",
  "graduacao kyu": "belt_label",
  "graduacao atual": "belt_label",
  "kyu": "belt_label",
  "faixa atual": "belt_label",
  "grau": "belt_label",
  // ── academia (vira TAG do aluno no backend) ──
  "academia": "academia",
  "unidade": "academia",
  "escola": "academia",
  "nucleo": "academia",
  "filial": "academia",
  "polo": "academia",
  "dojo": "academia",
  // ── situação ("Ativo": Sim/Não, Ativo/Inativo…) ──
  "ativo": "status",
  "situacao": "status",
  "status": "status",
  "ativo inativo": "status",
  // ── filiação (identidade — NÃO é o responsável financeiro) ──
  "pai": "father_name",
  "nome do pai": "father_name",
  "filiacao pai": "father_name",
  "mae": "mother_name",
  "nome da mae": "mother_name",
  "filiacao mae": "mother_name",
  // ── endereço ──
  "endereco": "address",
  "logradouro": "address",
  "rua": "address",
  "endereco completo": "address",
  "cep": "zip_code",
  "bairro": "neighborhood",
  "cidade": "city",
  "municipio": "city",
  // ── responsável (legado — o backend também DERIVA de mãe/pai) ──
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

/** Rótulo pt-BR de cada campo — só para dizer na prévia o que foi reconhecido. */
const FIELD_LABEL: Record<keyof DojoImportRow, string> = {
  full_name: "nome",
  birth_date: "nascimento",
  cpf: "CPF",
  rg: "RG",
  phone: "telefone",
  email: "e-mail",
  belt_label: "graduação/faixa",
  academia: "academia (vira tag)",
  status: "situação",
  father_name: "pai",
  mother_name: "mãe",
  address: "endereço",
  zip_code: "CEP",
  neighborhood: "bairro",
  city: "cidade",
  guardian_name: "responsável",
  guardian_phone: "tel. do responsável",
};

// ── 2ª passada: casamento por tokens (só para o que o lookup exato não pegou) ──

const PHONE_TOKENS = ["telefone", "celular", "fone", "tel", "whatsapp", "whats", "zap", "contato"];
const RESP_TOKENS = ["responsavel", "resp"];
const PARENT_TOKENS = ["mae", "pai"];
const DOC_TOKENS = ["cpf", "rg", "email", "e mail"];

interface LooseRule {
  field: keyof DojoImportRow;
  /** TODOS os grupos precisam bater; dentro de um grupo, basta um token. */
  groups: string[][];
  /** Qualquer token daqui presente no cabeçalho DESQUALIFICA a regra. */
  reject?: string[];
}

/**
 * Regras deliberadamente conservadoras: a intenção é cobrir variação de
 * grafia ("Nome da Mãe", "Município", "Tel. do Responsável"), NÃO adivinhar
 * coluna. Se o cabeçalho ativa duas regras (ou nenhuma), a coluna vira
 * "ignorada" — o sensei vê na prévia e renomeia a coluna, em vez de
 * descobrir depois que o telefone da mãe virou o telefone do aluno.
 */
const LOOSE_RULES: LooseRule[] = [
  {
    field: "full_name",
    groups: [["nome", "aluno", "praticante", "atleta"]],
    reject: [
      ...PHONE_TOKENS, ...RESP_TOKENS, ...PARENT_TOKENS, ...DOC_TOKENS,
      "social", "guerra", "fantasia", "academia", "unidade", "escola",
      "nucleo", "filial", "polo", "dojo", "turma", "professor", "sensei",
      "faixa", "graduacao", "nascimento",
    ],
  },
  {
    field: "birth_date",
    groups: [["nascimento", "nasc", "nascto", "aniversario", "aniversario"]],
    reject: [...RESP_TOKENS, ...PARENT_TOKENS],
  },
  { field: "cpf", groups: [["cpf"]], reject: [...RESP_TOKENS, ...PARENT_TOKENS] },
  { field: "rg", groups: [["rg", "identidade"]], reject: [...RESP_TOKENS, ...PARENT_TOKENS] },
  {
    field: "belt_label",
    groups: [["faixa", "graduacao", "kyu", "dan", "grau", "belt"]],
    reject: ["etaria", "idade", "data", "parentesco"],
  },
  {
    field: "academia",
    groups: [["academia", "unidade", "escola", "nucleo", "filial", "polo", "dojo", "sede"]],
    reject: [...RESP_TOKENS],
  },
  {
    field: "status",
    groups: [["ativo", "ativa", "inativo", "inativa", "situacao", "status", "matriculado"]],
    reject: ["data"],
  },
  {
    field: "father_name",
    groups: [["pai"]],
    reject: [...PHONE_TOKENS, ...DOC_TOKENS, "nascimento", "profissao", "endereco"],
  },
  {
    field: "mother_name",
    groups: [["mae"]],
    reject: [...PHONE_TOKENS, ...DOC_TOKENS, "nascimento", "profissao", "endereco"],
  },
  {
    field: "address",
    groups: [["endereco", "logradouro", "rua", "avenida"]],
    reject: [...RESP_TOKENS, ...PARENT_TOKENS],
  },
  { field: "zip_code", groups: [["cep"]] },
  { field: "neighborhood", groups: [["bairro"]] },
  { field: "city", groups: [["cidade", "municipio"]], reject: ["natal", "nascimento"] },
  {
    field: "phone",
    groups: [PHONE_TOKENS],
    reject: [...RESP_TOKENS, ...PARENT_TOKENS, "emergencia", "recado"],
  },
  { field: "email", groups: [["email", "e mail"]], reject: [...RESP_TOKENS, ...PARENT_TOKENS] },
  {
    field: "guardian_name",
    groups: [RESP_TOKENS],
    reject: [...PHONE_TOKENS, ...DOC_TOKENS, "parentesco", "grau"],
  },
  { field: "guardian_phone", groups: [RESP_TOKENS, PHONE_TOKENS], reject: [...DOC_TOKENS] },
];

/** Palavra (ou expressão) INTEIRA dentro do cabeçalho já normalizado. */
function hasToken(header: string, token: string): boolean {
  return ` ${header} `.includes(` ${token} `);
}

/**
 * Casamento tolerante: devolve o campo SÓ quando exatamente uma regra bate.
 * Zero ou duas regras → null (a coluna vai para "ignoradas").
 */
export function matchHeaderLoose(header: string): keyof DojoImportRow | null {
  const h = normHeader(header);
  if (!h) return null;
  const hits = LOOSE_RULES.filter(
    (r) =>
      !(r.reject ?? []).some((t) => hasToken(h, t)) &&
      r.groups.every((g) => g.some((t) => hasToken(h, t)))
  );
  return hits.length === 1 ? hits[0].field : null;
}

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
  /** Cabeçalhos que não casaram — texto ORIGINAL da planilha (não o normalizado). */
  unknownHeaders: string[];
  /** Campos reconhecidos, na ordem em que aparecem na planilha (sem repetir). */
  mappedFields: (keyof DojoImportRow)[];
  hasNameCol: boolean;
}

export function rowsToImport(matrix: any[][]): ParsedSheet {
  if (!matrix.length) return { rows: [], unknownHeaders: [], mappedFields: [], hasNameCol: false };
  const original = matrix[0].map((v) => String(v ?? "").trim());
  const headers = matrix[0].map(normHeader);

  // 1ª passada: lookup exato (contrato documentado na tela).
  const map: (keyof DojoImportRow | null)[] = headers.map((h) => (h ? HEADER_MAP[h] ?? null : null));

  // 2ª passada: tolerante, só no que sobrou — e NUNCA sobrescrevendo um
  // campo que o lookup exato (ou uma coluna anterior) já reivindicou.
  const claimed = new Set<keyof DojoImportRow>(map.filter(Boolean) as (keyof DojoImportRow)[]);
  for (let i = 0; i < headers.length; i++) {
    if (map[i] || !headers[i]) continue;
    const guess = matchHeaderLoose(headers[i]);
    if (guess && !claimed.has(guess)) {
      map[i] = guess;
      claimed.add(guess);
    }
  }

  const unknownHeaders = original.filter((h, i) => !!headers[i] && !map[i]);
  const mappedFields: (keyof DojoImportRow)[] = [];
  for (const f of map) if (f && !mappedFields.includes(f)) mappedFields.push(f);
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
      // birth_date é o ÚNICO campo com conversão (DD/MM/AAAA → ISO), porque
      // é formato, não normalização de dado. Todo o resto vai CRU.
      obj[field] = field === "birth_date" ? toISOFlexible(v) : String(v).trim();
    }
    if (Object.keys(obj).length === 0) continue; // linha vazia
    if (!obj.full_name) obj.full_name = ""; // backend pula com warning MISSING_NAME
    out.push(obj as DojoImportRow);
  }
  return { rows: out, unknownHeaders, mappedFields, hasNameCol };
}

// ── Prévia: replicar a regra do BACKEND, não inventar outra ──────────────

function txt(v: any): string {
  return String(v ?? "").trim();
}

/**
 * Responsável que a linha vai TER depois do import — mesma regra do
 * backend (Aura-backend#480/F12): `guardian_name` explícito vence; se o
 * aluno for MENOR de 18 e não houver responsável explícito, o backend
 * deriva de `mother_name`, ou de `father_name` quando a mãe está vazia.
 * Sem `birth_date` o backend trata como ADULTO (dado faltante é neutro —
 * não vira menor sem responsável).
 *
 * Sem isto a prévia mostrava "0 com responsável" para a planilha do
 * Areikan (que tem Mãe/Pai, não "Responsável") e contradizia o resultado
 * real do import.
 */
export function responsavelDerivado(r: DojoImportRow): string | null {
  const direto = txt(r.guardian_name);
  if (direto) return direto;
  const idade = ageFromISO(txt(r.birth_date) || null);
  if (idade == null || idade >= 18) return null;
  return txt(r.mother_name) || txt(r.father_name) || null;
}

const INATIVO_VALUES = new Set([
  "nao", "n", "0", "false", "inativo", "inativa", "inativos", "inativas",
  "desativado", "desativada", "desligado", "desligada", "cancelado",
  "cancelada", "trancado", "trancada", "off",
]);

/**
 * SÓ para contar na prévia — o valor da coluna "Ativo" segue indo CRU para
 * o backend, que é quem decide. Valor que não reconhecemos não é contado
 * como inativo (na dúvida, não assustar o sensei com número errado).
 */
export function pareceInativo(v: any): boolean {
  const s = normHeader(v);
  return !!s && INATIVO_VALUES.has(s);
}

export interface PreviaResumo {
  total: number;
  semNome: number;
  comNasc: number;
  /** Responsável explícito OU derivado de mãe/pai (regra do backend). */
  comResp: number;
  menores: number;
  /** Menores sem responsável explícito E sem mãe/pai — entram com aviso. */
  menoresSemResp: number;
  inativos: number;
  /** Tags de academia distintas que o import vai criar/reutilizar. */
  academias: string[];
}

export function resumoPrevia(rows: DojoImportRow[]): PreviaResumo {
  const academias = new Set<string>();
  let semNome = 0, comNasc = 0, comResp = 0, menores = 0, menoresSemResp = 0, inativos = 0;
  for (const r of rows) {
    if (!txt(r.full_name)) semNome++;
    const iso = txt(r.birth_date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) comNasc++;
    const idade = ageFromISO(iso || null);
    const resp = responsavelDerivado(r);
    if (resp) comResp++;
    if (idade != null && idade < 18) {
      menores++;
      if (!resp) menoresSemResp++;
    }
    if (pareceInativo(r.status)) inativos++;
    const ac = txt(r.academia);
    if (ac) academias.add(ac);
  }
  return {
    total: rows.length,
    semNome, comNasc, comResp, menores, menoresSemResp, inativos,
    academias: Array.from(academias),
  };
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
  const [mappedFields, setMappedFields] = useState<(keyof DojoImportRow)[]>([]);
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
    setMappedFields([]);
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
    setMappedFields(parsed.mappedFields);
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

  const resumo = React.useMemo(() => resumoPrevia(rows), [rows]);
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
                  <Text style={styles.docTitle}>Colunas reconhecidas (1ª linha = cabeçalho)</Text>
                  <Text style={styles.docMono}>
                    Nome* · Graduação/Faixa · Academia · Ativo · Data Nascimento (DD/MM/AAAA) · RG · CPF · Pai · Mãe · Telefone · Endereço · CEP · Bairro · Cidade · Email · Responsável · Tel. Responsável
                  </Text>
                  <Text style={styles.docHint}>
                    Só "Nome" é obrigatória — as outras podem faltar (dado ausente é neutro). A ordem não importa e variações de escrita são aceitas ("Nome da Mãe", "Município", "Graduação KYU"). O que não for reconhecido aparece na prévia como coluna ignorada.
                  </Text>
                  <Text style={styles.docHint}>
                    "Academia" vira uma tag do aluno · "Ativo" = Não/Inativo entra como aluno inativo · menor de 18 sem "Responsável" usa a Mãe (ou o Pai, se não houver mãe); sem nenhum dos dois ele entra assim mesmo, com aviso para você completar depois.
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
                  placeholder={"Nome;Graduação KYU;Academia;Ativo;Data Nascimento;Mãe\nJoão da Silva;Amarela;Areikan Centro;Sim;12/03/2014;Maria da Silva"}
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
                    {resumo.total} linha{resumo.total === 1 ? "" : "s"} · {resumo.comNasc} com nascimento · {resumo.comResp} com responsável
                    {resumo.semNome > 0 ? ` · ${resumo.semNome} sem nome (serão puladas)` : ""}
                  </Text>
                  {mappedFields.length > 0 && (
                    <Text style={styles.docHint}>
                      Campos reconhecidos: {mappedFields.map((f) => FIELD_LABEL[f]).join(" · ")}
                    </Text>
                  )}
                  {unknownHeaders.length > 0 && (
                    <Text style={styles.docHint}>
                      Colunas ignoradas (nada delas será importado): {unknownHeaders.join(", ")}
                    </Text>
                  )}
                  {resumo.menores > 0 && (
                    <Text style={styles.docHint}>
                      {resumo.menores} menor{resumo.menores === 1 ? "" : "es"} de 18 —{" "}
                      {resumo.menoresSemResp === 0
                        ? "todos com responsável (explícito ou derivado de mãe/pai)."
                        : `${resumo.menoresSemResp} sem nenhum responsável: entram assim mesmo, com aviso para completar depois.`}
                    </Text>
                  )}
                  {resumo.inativos > 0 && (
                    <Text style={styles.docHint}>
                      {resumo.inativos} entra{resumo.inativos === 1 ? "" : "m"} como INATIVO{resumo.inativos === 1 ? "" : "S"} (coluna "Ativo") — não aparecem na lista de alunos ativos.
                    </Text>
                  )}
                  {resumo.academias.length > 0 && (
                    <Text style={styles.docHint}>
                      {resumo.academias.length} academia{resumo.academias.length === 1 ? "" : "s"} vira{resumo.academias.length === 1 ? "" : "m"} tag: {resumo.academias.slice(0, 6).join(", ")}
                      {resumo.academias.length > 6 ? `… (+${resumo.academias.length - 6})` : ""}
                    </Text>
                  )}
                  {batches > 1 && (
                    <Text style={styles.docHint}>Acima de {DOJO_IMPORT_MAX_ROWS} linhas o envio sai em {batches} lotes, automaticamente.</Text>
                  )}
                </View>

                <View style={styles.prevBox}>
                  {rows.slice(0, 8).map((r, i) => (
                    <View key={i} style={styles.prevRow}>
                      <Text style={styles.prevName} numberOfLines={1}>
                        {r.full_name || "(sem nome — será pulada)"}
                        {pareceInativo(r.status) ? "  ·  inativo" : ""}
                      </Text>
                      <Text style={styles.prevMeta} numberOfLines={1}>
                        {[
                          r.birth_date ? isoToBR(String(r.birth_date)) || String(r.birth_date) : null,
                          r.belt_label ?? null,
                          r.academia ? `Academia: ${r.academia}` : null,
                          responsavelDerivado(r) ? `Resp.: ${responsavelDerivado(r)}` : null,
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
