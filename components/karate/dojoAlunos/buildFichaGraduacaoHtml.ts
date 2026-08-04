// ============================================================
// buildFichaGraduacaoHtml — Ficha de Graduação do aluno (F10)
//
// Espelha o padrão de components/karate/certificado/buildCertificateHtml.ts
// e components/karate/dojoTurmas/buildDojoQrPosterHtml.ts: HTML standalone
// (não depende de React Native), botão flutuante "Imprimir" via
// window.print(), @media print escondendo os controles de tela. Aberto
// via Blob URL + window.open (nunca document.write direto — armadilha
// conhecida de readyState; ver FichaGraduacaoSection.tsx).
//
// É A CARTEIRA DE GRADUAÇÃO física (papel Areikan Karatê-Dô / Shotokan
// Tradicional) que acompanha o aluno do 10º ao 1º kyu — "nada mais é do
// que um histórico ou trajetória, similar ao que já temos na federação"
// (decisão do Caio). Por isso o vocabulário de campos (kyu/belt_label/
// examiner/graduated_at) espelha karate_belt_history (trajetória da
// federação) sempre que os dois lados descrevem a mesma coisa.
//
// 10 LINHAS FIXAS (10º ao 1º kyu, escala FPKT Shotokan — mesma fonte
// única de components/karate/praticante-detalhe/helpers.ts BELT_KYUS e
// dojoAlunos/helpers.ts COMMON_BELTS; o dojô não pode graduar até faixa
// preta, CHECK no banco). Linha SEM resultado ainda = célula em branco
// (regra da casa "dado faltante ≠ pendência" — é uma carteira que se
// preenche ao longo dos anos, não um erro). "Assinatura do Examinador"
// fica SEMPRE como linha em branco pra assinatura física a caneta —
// mesmo em linhas já com resultado lançado no sistema, o nome do
// examinador (quando existe) aparece só como legenda pequena de apoio,
// nunca substitui a assinatura.
//
// Quesitos (〇 › △ › □): o backend grava o valor NOMEADO
// ('circulo'|'triangulo'|'quadrado' — ver services/karateDojoBeltExamApi.ts).
// Desenhar o símbolo é trabalho do front — glifos Unicode nativos
// (sem imagem/SVG), testados em impressão.
//
// Sem QR e sem logo: a ficha real (papel) não tem nenhum dos dois — só
// cabeçalho textual + foto 3x4 do aluno (via <img>, mesma origem do
// storage do app — não é URL de terceiro que possa falhar no meio da
// impressão, ver regra da casa em buildCarteirinhaHtml.ts).
//
// "Estilo" (ex.: Shotokan Tradicional) não existe como coluna no
// backend (confirmado antes de montar este arquivo — companies não tem
// campo style/estilo) — vem fixo via DOJO_STYLE, mesmo racional de
// DOJO_KUN em buildCarteirinhaHtml.ts (produto é Shotokan-only hoje).
// "Sensei" e "Matrícula" idem quando o dado não existir: linha em
// branco pronta pra preencher a caneta (nunca "—" nem erro).
// ============================================================

export type FichaQuesito = "circulo" | "triangulo" | "quadrado";

export interface FichaGraduacaoRow {
  kyu: number;
  beltLabel: string;
  kihon: FichaQuesito | null;
  kata: FichaQuesito | null;
  kumite: FichaQuesito | null;
  /** null = kyu ainda não cursado (linha em branco). */
  result: "approved" | "failed" | null;
  examinerName: string | null;
  /** 'DD/MM/AAAA' já formatado — nunca ISO cru aqui. */
  dateBR: string | null;
}

export interface FichaGraduacaoData {
  dojoName: string;
  style: string;
  senseiName: string | null;
  studentName: string;
  photoUrl: string | null;
  birthDateBR: string | null;
  rg: string | null;
  cpf: string | null;
  motherName: string | null;
  fatherName: string | null;
  cep: string | null;
  address: string | null;
  neighborhood: string | null;
  phone: string | null;
  matricula: string | null;
  rows: FichaGraduacaoRow[];
}

const RED = "#b8463a";
const INK = "#2b2620";
const INK_2 = "#6a6154";
const INK_3 = "#9b9180";
const LINE = "rgba(43,38,32,0.18)";
const LINE_STRONG = "rgba(43,38,32,0.42)";
const PAPER = "#fdf8f2";

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 〇 › △ › □ — mesma hierarquia do backend (QUESITO_RANK), glifo Unicode nativo. */
function quesitoGlyph(v: FichaQuesito | null): string {
  if (v === "circulo") return "〇";
  if (v === "triangulo") return "△";
  if (v === "quadrado") return "□";
  return "";
}

function resultLabel(r: "approved" | "failed" | null): string {
  if (r === "approved") return "Aprovado";
  if (r === "failed") return "Não aprovado";
  return "";
}

function blankLine(value: string | null | undefined): string {
  // Dado ausente vira uma linha para preencher à caneta — nunca "—"/erro
  // (regra da casa "dado faltante ≠ pendência", aplicada ao papel).
  const v = (value || "").trim();
  return v ? esc(v) : "&nbsp;";
}

function dataRow(label: string, value: string | null | undefined, flex = 1): string {
  return `<div class="dcell" style="flex:${flex}"><span class="dlabel">${esc(label)}</span><span class="dval">${blankLine(value)}</span></div>`;
}

function examRow(row: FichaGraduacaoRow): string {
  return `<tr>
    <td class="kyu">${row.kyu}º<br/><span class="beltname">${esc(row.beltLabel)}</span></td>
    <td class="quesito">${quesitoGlyph(row.kihon)}</td>
    <td class="quesito">${quesitoGlyph(row.kata)}</td>
    <td class="quesito">${quesitoGlyph(row.kumite)}</td>
    <td class="result">${esc(resultLabel(row.result))}</td>
    <td class="sig">${row.examinerName ? `<span class="signame">${esc(row.examinerName)}</span>` : ""}</td>
    <td class="date">${esc(row.dateBR || "")}</td>
  </tr>`;
}

export function buildFichaGraduacaoHtml(data: FichaGraduacaoData): string {
  const photo = data.photoUrl
    ? `<img class="photo" src="${esc(data.photoUrl)}" alt="Foto 3x4"/>`
    : `<div class="photo photo-ph">3x4</div>`;

  const addressLine = [data.address, data.neighborhood].filter(Boolean).join(" — ") || null;

  const rowsHtml = data.rows.map(examRow).join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Ficha de graduação — ${esc(data.studentName)}</title>
<style>
@page { size: 210mm 297mm; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color:${INK}; background:#e7e0d2; }
.page { width:210mm; min-height:297mm; margin:0 auto; background:${PAPER}; padding:14mm 12mm; position:relative; }

.printBtn { position:fixed; top:16px; right:16px; padding:10px 18px; border-radius:10px; border:none; background:${INK}; color:${PAPER}; font-size:14px; font-weight:700; cursor:pointer; z-index:10; }
@media print { .printBtn{ display:none; } body{ background:#fff; } .page{ padding:10mm 12mm; } }

.header { display:flex; align-items:flex-start; gap:10mm; border-bottom:1.2mm solid ${RED}; padding-bottom:5mm; margin-bottom:6mm; }
.headtext { flex:1; }
.eyebrow { font-size:9.5pt; letter-spacing:0.5pt; text-transform:uppercase; color:${INK_2}; }
.dojoname { font-size:19pt; font-weight:800; margin-top:1mm; }
.meta { font-size:10pt; color:${INK_2}; margin-top:2mm; line-height:1.6; }
.meta b { color:${INK}; font-weight:700; }
.title { font-size:11pt; font-weight:800; letter-spacing:1pt; text-transform:uppercase; color:${RED}; margin-top:4mm; }

.photo { width:26mm; height:34mm; object-fit:cover; border:0.4mm solid ${INK}; background:#fff; flex-shrink:0; }
.photo-ph { display:flex; align-items:center; justify-content:center; color:${INK_3}; font-size:9pt; border-style:dashed; }

.dados { display:flex; flex-direction:column; gap:0; border:0.35mm solid ${LINE_STRONG}; margin-bottom:7mm; }
.drow { display:flex; border-bottom:0.3mm solid ${LINE}; }
.drow:last-child { border-bottom:none; }
.dcell { padding:2.2mm 3mm; border-right:0.3mm solid ${LINE}; display:flex; flex-direction:column; gap:0.5mm; min-width:0; }
.dcell:last-child { border-right:none; }
.dlabel { font-size:7.5pt; letter-spacing:0.3pt; text-transform:uppercase; color:${INK_2}; font-weight:700; }
.dval { font-size:10.5pt; color:${INK}; word-break:break-word; }

table.exames { width:100%; border-collapse:collapse; margin-bottom:6mm; }
table.exames th { background:${INK}; color:${PAPER}; font-size:8pt; text-transform:uppercase; letter-spacing:0.3pt; padding:2.4mm 1.5mm; text-align:center; }
table.exames td { border:0.3mm solid ${LINE_STRONG}; text-align:center; font-size:9.5pt; padding:2.6mm 1.5mm; height:11mm; vertical-align:middle; }
table.exames td.kyu { text-align:left; padding-left:2.5mm; font-weight:800; width:22mm; }
table.exames td.kyu .beltname { display:block; font-size:8pt; font-weight:400; color:${INK_2}; }
table.exames td.quesito { font-size:15pt; font-weight:700; width:11%; }
table.exames td.result { width:15%; font-size:8.5pt; font-weight:700; }
table.exames td.sig { width:20%; }
table.exames td.sig .signame { font-size:7pt; color:${INK_3}; }
table.exames td.date { width:12%; font-size:8.5pt; }
table.exames th.th-kyu { text-align:left; padding-left:2.5mm; }

.legend { font-size:8pt; color:${INK_2}; margin-bottom:8mm; }
.legend b { color:${INK}; }

.footer { display:flex; gap:16mm; margin-top:14mm; }
.sigblock { flex:1; text-align:center; }
.sigline { border-top:0.35mm solid ${INK}; margin-bottom:1.5mm; padding-top:16mm; }
.sigcap { font-size:8.5pt; color:${INK_2}; text-transform:uppercase; letter-spacing:0.3pt; }
</style>
</head><body>
<button class="printBtn" onclick="window.print()">Imprimir</button>
<div class="page">

  <div class="header">
    ${photo}
    <div class="headtext">
      <div class="eyebrow">Ficha de graduação</div>
      <div class="dojoname">${esc(data.dojoName)}</div>
      <div class="meta">
        <b>Estilo:</b> ${esc(data.style)}<br/>
        <b>Sensei:</b> ${blankLine(data.senseiName)}
      </div>
      <div class="title">${esc(data.studentName)}</div>
    </div>
  </div>

  <div class="dados">
    <div class="drow">
      ${dataRow("Nome", data.studentName, 3)}
      ${dataRow("Nascimento", data.birthDateBR, 1)}
    </div>
    <div class="drow">
      ${dataRow("RG", data.rg, 1)}
      ${dataRow("CPF", data.cpf, 1)}
      ${dataRow("Matrícula", data.matricula, 1)}
    </div>
    <div class="drow">
      ${dataRow("Mãe", data.motherName, 1)}
      ${dataRow("Pai", data.fatherName, 1)}
    </div>
    <div class="drow">
      ${dataRow("CEP", data.cep, 1)}
      ${dataRow("Endereço", addressLine, 2)}
    </div>
    <div class="drow">
      ${dataRow("Telefone", data.phone, 1)}
    </div>
  </div>

  <table class="exames">
    <thead>
      <tr>
        <th class="th-kyu">Kyu</th>
        <th>Kihon</th>
        <th>Kata</th>
        <th>Kumite</th>
        <th>Resultado</th>
        <th>Assinatura do examinador</th>
        <th>Data</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="legend"><b>Legenda dos quesitos:</b> 〇 ótimo &nbsp;·&nbsp; △ regular &nbsp;·&nbsp; □ insuficiente</div>

  <div class="footer">
    <div class="sigblock"><div class="sigline"></div><div class="sigcap">Assinatura do responsável</div></div>
    <div class="sigblock"><div class="sigline"></div><div class="sigcap">Assinatura da associação</div></div>
  </div>

</div>
</body></html>`;
}

export default buildFichaGraduacaoHtml;
