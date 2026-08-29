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
// ESCOLHA DA ABA (13/08/2026 — mesma planilha do Areikan): o arquivo real
// tem TRÊS abas — "Planilha1" (listas auxiliares de validação de dados:
// ATIVO/INATIVO, Graduacao, ACADEMIAS), "CADASTRO" (os 484 alunos, 15
// colunas) e "aniversarios campeonato" (visão derivada, 9 colunas). Como
// o importador lia sempre `SheetNames[0]`, o sensei recebeu "Não achei a
// coluna Nome" com a planilha CERTA na mão. Planilha de verdade quase
// sempre tem aba de apoio (lista de validação, dashboard, tabela
// dinâmica) — ler a primeira só funciona por sorte.
//
// A regra agora: pontuar CADA aba pelo nº de colunas que a primeira linha
// reconhece (scoreSheetHeader reusa o próprio rowsToImport, para não
// existir um segundo de-para divergindo do oficial), exigindo coluna de
// NOME — aba sem "Nome" não é candidata, vale 0. Maior pontuação vence;
// empate ou pontuação zero → primeira aba (comportamento antigo) e o erro
// aparece, agora dizendo QUAL aba foi lida e quais outras existem. Com
// mais de uma aba o usuário escolhe na mão, com nº de linhas e de colunas
// reconhecidas de cada uma à vista — porque "aniversarios campeonato"
// também tem "Nome" e "Graduação KYU" e é plausível, só não é a certa.
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
// ENVIO EM PARTES + O QUE DIZER QUANDO FALHA (13/08/2026, depois do import
// real dos 484): o envio saía em lotes de 500 linhas numa requisição de
// 60 s. Medição de produção: MAIS DE 60 s para 100 linhas (cada aluno
// custa ~10 idas ao banco — o gargalo é round-trip, não volume), ou seja,
// 500 nunca coube. O dono do dojô quebrou a planilha em 5 arquivos de
// ~100 linhas na mão: os 5 mostraram erro de tempo esgotado, 4 gravaram
// assim mesmo, 1 não gravou nada — e só dava para saber qual foi qual
// consultando o banco.
//
// Pior que a lentidão foi a MENSAGEM. Ela afirmava, fixa: "os lotes
// anteriores já entraram" — inclusive na tentativa em que NADA entrou.
// Afirmar sucesso parcial sem saber é pior do que não dizer nada: leva o
// operador a não reenviar, achando que parte do trabalho está salva.
//
// O que mudou:
//   • parte de DOJO_IMPORT_MAX_ROWS = 40 linhas (~25 s medidos, ~2,4× de
//     folga nos 60 s de timeout) — 484 linhas viram 13 partes, e o
//     progresso passa a andar de verdade;
//   • o progresso conta ALUNOS CONFIRMADOS, não número de requisição;
//   • mensagemImportInterrompido() usa o número REAL de partes que
//     responderam. Zero partes → diz que não há confirmação de nada;
//     N partes → diz quantos alunos entraram e de qual linha o envio
//     recomeça. A parte que estava A CAMINHO quando o tempo acabou é
//     sempre declarada como incerta, porque é exatamente isso que ela é;
//   • "Continuar de onde parou" reenvia a partir da primeira linha NÃO
//     confirmada, em vez de recomeçar do zero.
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
  karateDojoStudentsApi, DojoImportRow, DojoImportResult, DojoImportWarning,
  DOJO_IMPORT_MAX_ROWS,
} from "@/services/karateDojoStudentsApi";
import { isoToBR, ageFromISO } from "./helpers";

const STEPS = ["Dados", "Prévia", "Importar", "Resultado"];

// ── Cabeçalhos aceitos (normalizados: minúsculo, sem acento/pontuação) ──

/**
 * Combining diacritical marks (U+0300–U+036F) — os acentos que o NFD
 * separa da letra ("Graduação" → "Graduac" + acento + "ao"). Construído
 * por CODE POINT de propósito: escrito como literal, este range é
 * invisível no editor e já foi fonte de corrupção de encoding neste repo
 * (ver fix-unicode-all.js na raiz). Regex global só é usada em .replace(),
 * que não depende de lastIndex — reusar a mesma instância é seguro.
 */
const COMBINING_MARKS = new RegExp(
  "[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]",
  "g"
);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS, "");
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
  "graduação atual": "belt_label",
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
  "endereço completo": "address",
  "cep": "zip_code",
  "bairro": "neighborhood",
  "cidade": "city",
  "municipio": "city",
  // ── responsável (legado — o backend também DERIVA de mãe/pai) ──
  "responsavel": "guardian_name",
  "nome do responsável": "guardian_name",
  "responsável nome": "guardian_name",
  "tel responsável": "guardian_phone",
  "tel do responsável": "guardian_phone",
  "telefone responsável": "guardian_phone",
  "telefone do responsável": "guardian_phone",
  "celular responsável": "guardian_phone",
  "celular do responsável": "guardian_phone",
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
    groups: [["nascimento", "nasc", "nascto", "aniversario"]],
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

// ── Qual das abas do arquivo é a dos alunos? ────────────────────────────

/** Uma aba do workbook, do ponto de vista da escolha (sem SheetJS no meio). */
export interface SheetCandidate {
  name: string;
  /** Primeira linha da aba — é ela que decide (é o cabeçalho, se houver). */
  firstRow: any[];
  /** Linhas de dados (sem o cabeçalho) — só informativo, para a tela. */
  rowCount: number;
}

export interface SheetPick {
  /** Índice escolhido. Sem candidata plausível → 0 (comportamento antigo). */
  index: number;
  /** Pontuação da escolhida (0 = nenhuma aba parece ter cabeçalho de alunos). */
  score: number;
  /** Duas ou mais abas empataram na melhor pontuação → deixe o usuário decidir. */
  ambiguous: boolean;
  /** Pontuação de cada aba, na ordem do workbook (para exibir na tela). */
  scores: number[];
}

/**
 * Quantas colunas de aluno o cabeçalho desta aba reconhece.
 *
 * Reusa o PRÓPRIO rowsToImport (com a matriz de uma linha só) de propósito:
 * um segundo de-para aqui inevitavelmente divergiria do oficial — que é o
 * validado em produção (app#679) e não deve ser tocado.
 *
 * Aba sem coluna de NOME vale 0, mesmo reconhecendo outras colunas: a
 * "Planilha1" do Areikan é uma lista de validação de dados cujo cabeçalho é
 * "ATIVO / INATIVO ; Graduação ; ACADEMIAS" — casa "situação" e "faixa" e,
 * sem esta regra, competiria com a aba dos 484 alunos.
 */
export function scoreSheetHeader(firstRow: any[]): number {
  const parsed = rowsToImport([firstRow ?? []]);
  return parsed.hasNameCol ? parsed.mappedFields.length : 0;
}

/**
 * Escolhe a aba com MAIS colunas reconhecidas. Empate ou pontuação zero →
 * primeira aba (o comportamento antigo) e o erro aparece normalmente — na
 * dúvida a gente não chuta, mostra o seletor e deixa o sensei decidir.
 */
export function pickSheet(sheets: SheetCandidate[]): SheetPick {
  const scores = sheets.map((s) => scoreSheetHeader(s.firstRow));
  const best = scores.reduce((a, b) => (b > a ? b : a), 0);
  if (best === 0) return { index: 0, score: 0, ambiguous: false, scores };
  const tied = scores.reduce<number[]>((acc, s, i) => (s === best ? [...acc, i] : acc), []);
  return { index: tied[0], score: best, ambiguous: tied.length > 1, scores };
}

const CABECALHO_HINT = "A primeira linha precisa ser o cabeçalho (Nome, Nascimento, CPF…).";

/**
 * Erro de "sem coluna Nome" que diz o que fazer. Com uma aba só (ou CSV) é
 * a mensagem de sempre; com várias, nomeia a aba LIDA e lista as outras —
 * o sensei entende sem precisar abrir o Excel para conferir.
 */
export function sheetMissingNameError(sheetName: string | null, allSheetNames: string[] = []): string {
  const outras = allSheetNames.filter((n) => n !== sheetName);
  if (!sheetName || outras.length === 0) {
    return `Não achei a coluna "Nome". ${CABECALHO_HINT}`;
  }
  return (
    `Li a aba "${sheetName}" e não achei a coluna "Nome". Este arquivo tem outras abas: ` +
    `${outras.join(", ")} — escolha a aba certa logo abaixo. ${CABECALHO_HINT}`
  );
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

// ── Envio em partes: fatiar, contar e (sobretudo) contar a VERDADE ───────

/** Concordância curta — a tela é lida por sensei, não por engenheiro. */
function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? um : muitos;
}

/**
 * Fatia as linhas em partes do tamanho de envio. Exportada porque este
 * fatiamento é a diferença entre "cabe no tempo" e "o operador encara uma
 * tela parada por um minuto sem saber se gravou" — ver a nota de medição
 * em DOJO_IMPORT_MAX_ROWS.
 */
export function fatiarEmPartes<T>(rows: T[], tamanho: number = DOJO_IMPORT_MAX_ROWS): T[][] {
  const passo = Math.max(1, Math.floor(tamanho));
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += passo) out.push(rows.slice(i, i + passo));
  return out;
}

export interface ProgressoImport {
  /** Partes que JÁ responderam com sucesso (somando tentativas anteriores). */
  partesConcluidas: number;
  totalPartes: number;
  /** Linhas cobertas pelas partes concluídas — é daqui que a retomada continua. */
  linhasConfirmadas: number;
  totalLinhas: number;
  /** Alunos que o backend CONFIRMOU ter criado. */
  alunosConfirmados: number;
}

/**
 * Texto do passo "Importar". Antes era "Lote 0 de 1" — com 484 linhas num
 * lote só, o número nunca saía de 0 e a tela parecia travada por um minuto
 * inteiro. O que interessa ao sensei é quantos ALUNOS já entraram.
 */
export function textoProgresso(p: ProgressoImport): string {
  const totalPartes = Math.max(1, Math.floor(p.totalPartes));
  const feitas = Math.max(0, Math.min(Math.floor(p.partesConcluidas), totalPartes));
  const atual = Math.min(feitas + 1, totalPartes);
  const cabeca = `Enviando a parte ${atual} de ${totalPartes}`;
  if (feitas <= 0) {
    return (
      `${cabeca} — ${p.totalLinhas} ${plural(p.totalLinhas, "linha", "linhas")} no total, ` +
      "nenhuma confirmada ainda."
    );
  }
  const corpo =
    p.alunosConfirmados > 0
      ? `${p.alunosConfirmados} ${plural(p.alunosConfirmados, "aluno já entrou", "alunos já entraram")}`
      : "nenhum aluno novo até aqui";
  return `${cabeca} — ${corpo} (${p.linhasConfirmadas} de ${p.totalLinhas} linhas confirmadas).`;
}

export interface ImportInterrompido {
  /** Partes que responderam com SUCESSO antes da falha (todas as tentativas). */
  lotesConcluidos: number;
  /** Alunos que o backend confirmou ter criado nessas partes. */
  alunosConfirmados: number;
  /** Linhas cobertas por essas partes. */
  linhasConfirmadas: number;
  /** Total de linhas desta planilha. */
  totalLinhas: number;
  /** Linhas da parte que estava A CAMINHO quando parou (0 = nenhuma). */
  loteEmAndamento: number;
  /** true quando não veio resposta (tempo esgotado ou conexão caiu). */
  semResposta: boolean;
  /** Mensagem que o servidor devolveu, quando devolveu alguma. */
  detalhe?: string | null;
}

/**
 * O que dizer quando o envio para no meio.
 *
 * A versão antiga afirmava, SEMPRE, "os lotes anteriores já entraram" —
 * frase fixa, escrita sem olhar para o estado real. Na tentativa dos 484
 * ela apareceu com ZERO linhas gravadas (o lote único estourou e nem
 * chegou a commitar). Afirmar sucesso parcial sem saber é pior que não
 * dizer nada: o operador lê "já entraram", não reenvia, e o trabalho fica
 * pela metade sem ninguém perceber.
 *
 * Três blocos, nesta ordem, e cada um só afirma o que é sabido:
 *   1) o que aconteceu;
 *   2) o que está CONFIRMADO (resposta do servidor recebida) — ou a
 *      admissão de que não há confirmação de nada;
 *   3) a parte que estava a caminho, declarada como incerta, e o que
 *      fazer agora (com a ressalva de duplicidade para linha sem CPF).
 */
export function mensagemImportInterrompido(i: ImportInterrompido): string {
  const total = Math.max(0, Math.floor(i.totalLinhas));
  const ok = Math.max(0, Math.min(Math.floor(i.linhasConfirmadas), total));
  const emVoo = Math.max(0, Math.min(Math.floor(i.loteEmAndamento), total - ok));
  const faltam = total - ok;
  const depois = faltam - emVoo;
  const criados = Math.max(0, Math.floor(i.alunosConfirmados));
  const partes: string[] = [];

  partes.push(
    i.semResposta
      ? "O envio parou sem resposta do servidor."
      : txt(i.detalhe) || "O envio parou por uma falha do servidor."
  );

  if (i.lotesConcluidos <= 0 || ok <= 0) {
    partes.push(
      "Nenhum aluno foi confirmado até aqui — não temos como afirmar que alguma coisa tenha sido salva."
    );
  } else if (criados > 0) {
    partes.push(
      `${criados} ${plural(criados, "aluno já entrou", "alunos já entraram")} — ` +
        `${ok} de ${total} ${plural(total, "linha confirmada", "linhas confirmadas")}.`
    );
  } else {
    partes.push(
      `${ok} de ${total} linhas foram enviadas e confirmadas, mas nenhuma virou aluno novo ` +
        "(quem já estava cadastrado é pulado)."
    );
  }

  if (emVoo > 0) {
    const trecho =
      emVoo === 1
        ? `A linha ${ok + 1} estava`
        : `As linhas ${ok + 1} a ${ok + emVoo} estavam`;
    partes.push(
      `${trecho} a caminho quando o envio parou — essa parte pode ter sido gravada sem a gente ` +
        "receber a confirmação." +
        (depois <= 0 && ok > 0 ? " Era a última parte." : "")
    );
  }

  if (faltam <= 0) {
    partes.push(
      "Não sobrou linha nenhuma para reenviar — confira a lista de alunos antes de importar de novo."
    );
  } else if (ok > 0) {
    partes.push(
      `Faltam ${faltam} ${plural(faltam, "linha", "linhas")}: toque em "Continuar de onde parou" ` +
        `e o envio recomeça na linha ${ok + 1}, sem repetir o que já entrou.`
    );
  } else {
    partes.push(
      `Pode enviar as ${total} ${plural(total, "linha", "linhas")} de novo desde o começo.`
    );
  }

  if (faltam > 0) {
    partes.push(
      "Quem tem CPF na planilha não entra duas vezes; quem está sem CPF pode duplicar — " +
        "vale conferir esses na lista de alunos depois."
    );
  }

  return partes.join(" ");
}

interface Props {
  visible: boolean;
  federationId: string;
  onClose: () => void;
  /** Chamado no Concluir (a lista recarrega). */
  onDone: () => void;
}

/** Aba já lida do arquivo — a matriz fica em memória para trocar sem reler. */
interface LoadedSheet {
  name: string;
  matrix: any[][];
  rowCount: number;
  score: number;
}

/**
 * O que o SERVIDOR já confirmou nesta planilha, somando as tentativas.
 * `linhas` é o ponto exato de retomada: primeira linha ainda não
 * confirmada = linhas + 1. Nada entra aqui sem resposta do backend.
 */
interface Confirmado {
  partes: number;
  linhas: number;
  created: number;
  skipped: number;
  warnings: DojoImportWarning[];
}

const NADA_CONFIRMADO: Confirmado = { partes: 0, linhas: 0, created: 0, skipped: 0, warnings: [] };

export function ImportAlunosModal({ visible, federationId, onClose, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<LoadedSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [rows, setRows] = useState<DojoImportRow[]>([]);
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);
  const [mappedFields, setMappedFields] = useState<(keyof DojoImportRow)[]>([]);
  const [parsing, setParsing] = useState(false);
  const [confirmado, setConfirmado] = useState<Confirmado>(NADA_CONFIRMADO);
  const [result, setResult] = useState<DojoImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setStep(0);
    setPasteText("");
    setFileName(null);
    setSheets([]);
    setSheetIndex(0);
    setRows([]);
    setUnknownHeaders([]);
    setMappedFields([]);
    setConfirmado(NADA_CONFIRMADO);
    setResult(null);
    setErr(null);
  };

  /**
   * `sheetList`/`idx` só existem para a MENSAGEM de erro citar a aba lida e
   * as outras do arquivo. CSV e texto colado passam lista vazia — nada muda
   * nesses caminhos.
   */
  const finishParse = (
    matrix: any[][],
    name: string | null,
    sheetList: LoadedSheet[] = [],
    idx = 0
  ) => {
    const parsed = rowsToImport(matrix);
    const sheetName = sheetList[idx]?.name ?? null;
    const allNames = sheetList.map((s) => s.name);
    if (!parsed.hasNameCol) {
      setErr(sheetMissingNameError(sheetName, allNames));
      setStep(0);
      return;
    }
    if (!parsed.rows.length) {
      setErr(
        sheetName
          ? `A aba "${sheetName}" tem o cabeçalho, mas nenhuma linha de dados abaixo dele.`
          : "Nenhuma linha de dados encontrada abaixo do cabeçalho."
      );
      setStep(0);
      return;
    }
    setRows(parsed.rows);
    setUnknownHeaders(parsed.unknownHeaders);
    setMappedFields(parsed.mappedFields);
    setFileName(name);
    // Lista NOVA (ou outra aba) → o ponto de retomada da anterior não vale
    // mais: "continuar da linha 201" com outro arquivo pularia 200 alunos.
    setConfirmado(NADA_CONFIRMADO);
    setResult(null);
    setErr(null);
    setStep(1);
  };

  /** Troca de aba na mão: a matriz já está em memória, não relê o arquivo. */
  const selectSheet = (i: number) => {
    const s = sheets[i];
    if (!s) return;
    setSheetIndex(i);
    setErr(null);
    finishParse(s.matrix, fileName, sheets, i);
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
        if (/\.csv$/i.test(file.name)) {
          // CSV é arquivo de aba única — nada de seletor aqui.
          setSheets([]);
          setSheetIndex(0);
          finishParse(parseCsv(await file.text()), file.name);
        } else {
          const buf = await file.arrayBuffer();
          const xlsx = await import("xlsx"); // já no bundle (importação FPKT)
          const wb = xlsx.read(buf, { type: "array" });
          // Lê TODAS as abas: o custo é o de já ter o arquivo em memória, e
          // com elas em mão a troca de aba é instantânea e o seletor mostra
          // quantas linhas cada uma tem.
          const loaded: LoadedSheet[] = wb.SheetNames.map((sn) => {
            const matrix = xlsx.utils.sheet_to_json(wb.Sheets[sn], {
              header: 1, defval: null, raw: false,
            }) as any[][];
            return {
              name: sn,
              matrix,
              rowCount: Math.max(0, matrix.length - 1),
              score: scoreSheetHeader(matrix[0] ?? []),
            };
          });
          const pick = pickSheet(
            loaded.map((s) => ({ name: s.name, firstRow: s.matrix[0] ?? [], rowCount: s.rowCount }))
          );
          setSheets(loaded);
          setSheetIndex(pick.index);
          setFileName(file.name);
          finishParse(loaded[pick.index]?.matrix ?? [], file.name, loaded, pick.index);
        }
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
    setSheets([]);
    setSheetIndex(0);
    finishParse(parseCsv(pasteText), null);
  };

  /**
   * Envia da linha `deIndex` (0-based) em diante, em partes de
   * DOJO_IMPORT_MAX_ROWS. `deIndex > 0` é a retomada: só as linhas ainda
   * NÃO confirmadas voltam para o servidor.
   *
   * O acumulado corre numa variável local (`atual`) porque setState não é
   * síncrono e o laço precisa do valor exato para dois usos onde errar é
   * caro: o offset do nº da linha nos warnings e o ponto de retomada.
   */
  const runImport = async (deIndex = 0) => {
    const inicio = Math.min(Math.max(0, deIndex), rows.length);
    const chunks = fatiarEmPartes(rows.slice(inicio), DOJO_IMPORT_MAX_ROWS);
    if (!chunks.length) return;
    setStep(2);
    setErr(null);

    let atual: Confirmado = { ...confirmado, linhas: inicio, warnings: [...confirmado.warnings] };
    setConfirmado(atual);

    for (let i = 0; i < chunks.length; i++) {
      const parte = chunks[i];
      try {
        const res = await karateDojoStudentsApi.importStudents(federationId, parte);
        const offset = atual.linhas; // nº da linha nos warnings é relativo à parte
        atual = {
          partes: atual.partes + 1,
          linhas: atual.linhas + parte.length,
          created: atual.created + (res.created ?? 0),
          skipped: atual.skipped + (res.skipped ?? 0),
          warnings: [
            ...atual.warnings,
            ...(res.warnings ?? []).map((w) => ({ ...w, row: w.row + offset })),
          ],
        };
        setConfirmado(atual);
      } catch (e: any) {
        // Cada parte é uma transação do backend. As que responderam JÁ
        // entraram — e são exatamente essas que a mensagem pode afirmar.
        // O destino desta aqui (`parte`) é DESCONHECIDO: sem resposta, o
        // servidor pode ter concluído depois que desistimos de esperar.
        setConfirmado(atual);
        setErr(
          mensagemImportInterrompido({
            lotesConcluidos: atual.partes,
            alunosConfirmados: atual.created,
            linhasConfirmadas: atual.linhas,
            totalLinhas: rows.length,
            loteEmAndamento: parte.length,
            semResposta: e?.code === "timeout" || e?.isNetworkError === true,
            detalhe: e?.data?.error || e?.message || null,
          })
        );
        setStep(1);
        return;
      }
    }

    setResult({ created: atual.created, skipped: atual.skipped, warnings: atual.warnings });
    setStep(3);
  };

  const resumo = React.useMemo(() => resumoPrevia(rows), [rows]);
  const totalPartes = Math.max(1, Math.ceil(rows.length / DOJO_IMPORT_MAX_ROWS));
  const restantes = Math.max(0, rows.length - confirmado.linhas);
  const retomando = confirmado.linhas > 0 && restantes > 0;
  const abaAtual = sheets[sheetIndex]?.name ?? null;

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
                {sheets.length > 1 && (
                  <View style={styles.sheetBox}>
                    <Text style={styles.docTitle}>
                      Abas de {fileName || "arquivo"} — lendo "{abaAtual}"
                    </Text>
                    <Text style={styles.docHint}>
                      Escolhi a aba com mais colunas reconhecidas. Planilha costuma ter aba de apoio (listas, aniversários, resumo) — se a dos alunos for outra, toque nela.
                    </Text>
                    <View style={styles.sheetRow}>
                      {sheets.map((s, i) => (
                        <TouchableOpacity
                          key={`${s.name}-${i}`}
                          onPress={() => selectSheet(i)}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityState={{ selected: i === sheetIndex }}
                          accessibilityLabel={`Aba ${s.name}, ${s.rowCount} linhas`}
                          style={[styles.sheetChip, i === sheetIndex && styles.sheetChipOn]}
                        >
                          <Text style={[styles.sheetChipTxt, i === sheetIndex && styles.sheetChipTxtOn]} numberOfLines={1}>
                            {s.name}
                          </Text>
                          <Text style={[styles.sheetChipMeta, i === sheetIndex && styles.sheetChipMetaOn]} numberOfLines={1}>
                            {s.rowCount} linha{s.rowCount === 1 ? "" : "s"} ·{" "}
                            {s.score > 0
                              ? `${s.score} coluna${s.score === 1 ? "" : "s"} reconhecida${s.score === 1 ? "" : "s"}`
                              : "sem coluna de nome"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

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
                  <Text style={styles.docHint}>
                    Arquivo .xlsx com várias abas: leio a que tiver mais colunas reconhecidas e você pode trocar antes da prévia.
                  </Text>
                  <Text style={styles.docHint}>
                    Lista grande vai em partes de {DOJO_IMPORT_MAX_ROWS} linhas, uma de cada vez — dá para acompanhar quantos alunos já entraram e, se alguma parte falhar, continuar de onde parou.
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
                      {sheets.length > 1 ? ` · aba "${abaAtual}"` : ""}
                    </Text>
                  )}
                  <Text style={styles.docTitle}>
                    {resumo.total} linha{resumo.total === 1 ? "" : "s"} · {resumo.comNasc} com nascimento · {resumo.comResp} com responsável
                    {resumo.semNome > 0 ? ` · ${resumo.semNome} sem nome (serão puladas)` : ""}
                  </Text>
                  {sheets.length > 1 && (
                    <Text style={styles.docHint}>
                      Este arquivo tem {sheets.length} abas — se "{abaAtual}" não for a dos alunos, volte e escolha outra.
                    </Text>
                  )}
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
                  {totalPartes > 1 && !retomando && (
                    <Text style={styles.docHint}>
                      O envio sai em {totalPartes} partes de até {DOJO_IMPORT_MAX_ROWS} linhas, uma de cada vez — cada parte que chega já fica gravada.
                    </Text>
                  )}
                  {retomando && (
                    <Text style={styles.docHint}>
                      {confirmado.created > 0
                        ? `${confirmado.created} aluno${confirmado.created === 1 ? "" : "s"} desta lista já ${confirmado.created === 1 ? "entrou" : "entraram"} (${confirmado.linhas} de ${rows.length} linhas confirmadas).`
                        : `${confirmado.linhas} de ${rows.length} linhas já foram confirmadas.`}{" "}
                      Continuar envia só da linha {confirmado.linhas + 1} em diante — o que já entrou não é reenviado.
                    </Text>
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
                  <KarateButton
                    label={sheets.length > 1 ? "Voltar / trocar aba" : "Voltar"}
                    variant="ghost"
                    size="md"
                    onPress={() => setStep(0)}
                    style={{ flex: 1 }}
                  />
                  <KarateButton
                    label={
                      retomando
                        ? `Continuar de onde parou — ${restantes} linha${restantes === 1 ? "" : "s"}`
                        : `Importar ${rows.length} linha${rows.length === 1 ? "" : "s"}`
                    }
                    variant="sumi"
                    size="md"
                    onPress={() => runImport(retomando ? confirmado.linhas : 0)}
                    style={{ flex: 2 }}
                  />
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={KarateColors.primary} />
                <Text style={styles.centerTxt}>Importando…</Text>
                <Text style={styles.prevMeta}>
                  {textoProgresso({
                    partesConcluidas: confirmado.partes,
                    totalPartes,
                    linhasConfirmadas: confirmado.linhas,
                    totalLinhas: rows.length,
                    alunosConfirmados: confirmado.created,
                  })}
                </Text>
                <Text style={styles.prevMeta}>
                  Cada parte fica gravada assim que chega — se algo falhar, dá para continuar de onde parou.
                </Text>
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
  sheetBox: { gap: 8, borderWidth: 1, borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, padding: 12 } as ViewStyle,
  sheetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  sheetChip: { minWidth: 150, gap: 2, borderWidth: 1.5, borderColor: KarateColors.border, backgroundColor: KarateColors.glass2, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 10 } as ViewStyle,
  sheetChipOn: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primary } as ViewStyle,
  sheetChipTxt: { fontSize: 12.5, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sheetChipTxtOn: { color: "#fff" } as TextStyle,
  sheetChipMeta: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  sheetChipMetaOn: { color: "#f3e8ff" } as TextStyle,
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
