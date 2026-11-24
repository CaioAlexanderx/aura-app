// ============================================================
// AURA. — Ótica: ficha do cliente e receita em A4
//
// 23/11/2026. A OS de óculos já imprime pelo servidor (printOs →
// /print/os/:id). Faltava imprimir a RECEITA sozinha — o cliente que só
// trouxe o papel do médico e ainda não fechou o par, ou a segunda via que a
// loja guarda na pasta.
//
// É DOCUMENTO em A4, montado aqui e aberto pela janela de impressão do
// navegador (services/printWindow, o mesmo caminho da OS). Não passa pelas
// etiquetas nem pela impressão térmica.
//
// Privacidade: esta folha tem CPF e receita (dado de saúde). Ela só existe
// na janela de impressão de quem está logado na loja — nada daqui vai para
// mensagem de WhatsApp nem para o link de acompanhamento.
//
// Fora, de propósito: recomendação de lente e qualquer campo de comissão do
// prescritor (Decreto 24.492; Código de Ética Médica, arts. 68 e 69).
//
// Mockup: docs/mockups/otica-cadastro-e-receita.html, tela 3.
// ============================================================
import { openPrintWindow, type PrintOutcome } from "@/services/printWindow";
import {
  PRESCRIBER_LABEL, columnsToEyes, fmtAxis, fmtDiopter, fmtIsoDate, fmtMm, todayIso,
  type EyeRx, type OticaSettings, type Prescription,
} from "@/services/oticaApi";
import { formatarDocumento, idadeEmAnos, rotuloDoSexo, situacaoDoNascimento } from "@/utils/clienteDadosCompletos";
import { resumoDoEndereco } from "@/components/endereco/endereco";
import type { Customer } from "@/components/screens/clientes/types";

export type DadosDaFichaDaReceita = {
  /** Nome da loja e documento, como saem no cabeçalho. */
  loja: { nome: string; documento?: string | null };
  /** Responsável técnico e licença (Configurações › Ótica). */
  settings?: Partial<Pick<OticaSettings, "rt_name" | "rt_registry" | "sanitary_license">> | null;
  /** Cadastro do cliente; sem ele, sai só o nome que veio na receita. */
  cliente?: Partial<Customer> | null;
  receita: Prescription;
  /** Data de emissão da folha (YYYY-MM-DD). Padrão: hoje. */
  hoje?: string;
};

/** Texto do usuário nunca entra cru no HTML. */
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function campo(rotulo: string, valor: string | null | undefined): string {
  if (!valor) return "";
  return `<div><span>${esc(rotulo)}</span>${esc(valor)}</div>`;
}

function linhaDoOlho(rotulo: string, e: EyeRx): string {
  const cels = [fmtDiopter(e.sph), fmtDiopter(e.cyl), fmtAxis(e.axis), fmtDiopter(e.add), fmtMm(e.pd), fmtMm(e.height)];
  return `<tr><td>${esc(rotulo)}</td>${cels.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;
}

function nascimentoDaFicha(birthday: string | null | undefined, hoje: Date): string {
  if (!birthday) return "";
  const sit = situacaoDoNascimento(birthday, hoje);
  if (sit === "ok") {
    const idade = idadeEmAnos(birthday, hoje);
    return `${birthday} · ${idade} ${idade === 1 ? "ano" : "anos"}`;
  }
  // Sem ano de verdade: só dia e mês. Ano de enfeite não vai para o papel.
  if (sit === "sem_ano") return String(birthday).slice(0, 5);
  return "";
}

/** HTML completo da folha. Função pura: é o que os testes conferem. */
export function htmlDaFichaDaReceita(d: DadosDaFichaDaReceita): string {
  const rx = d.receita;
  const eyes = columnsToEyes(rx);
  const iso = d.hoje || todayIso();
  const [ay, am, ad] = iso.split("-").map(Number);
  const hoje = new Date(ay, (am || 1) - 1, ad || 1, 12);
  const c = d.cliente || {};
  const nome = c.name || rx.customer_name || "Cliente";
  const st = d.settings || {};
  const rt = [st.rt_name ? `Óptico responsável: ${st.rt_name}` : "", st.rt_registry ? `registro ${st.rt_registry}` : "", st.sanitary_license ? `licença sanitária ${st.sanitary_license}` : ""].filter(Boolean).join(" · ");
  const prescritor = [PRESCRIBER_LABEL[rx.prescriber_type] || "", rx.prescriber_registry || ""].filter(Boolean).join(" · ");
  const datas = [fmtIsoDate(rx.issued_at), fmtIsoDate(rx.valid_until)].filter(Boolean).join(" · ");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Receita · ${esc(nome)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif; font-size: 12px; color: #111; background: #fff; line-height: 1.45; }
  .folha { max-width: 720px; margin: 0 auto; padding: 24px; }
  header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
  header b { font-size: 16px; }
  header small { display: block; color: #444; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 400; font-size: 24px; margin: 0 0 10px; }
  h2 { font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #555; margin: 16px 0 6px; }
  .kv { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 16px; }
  .kv div { overflow-wrap: anywhere; }
  .kv span { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; color: #666; }
  table { width: 100%; border-collapse: collapse; font-family: ui-monospace, "DM Mono", Menlo, Consolas, monospace; }
  th { font-family: system-ui, Arial, sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; color: #555; border-bottom: 1px solid #111; padding: 4px; text-align: center; }
  td { border-bottom: 1px solid #ccc; padding: 8px 4px; text-align: center; font-size: 13px; }
  td:first-child, th:first-child { text-align: left; font-family: system-ui, Arial, sans-serif; font-weight: 700; }
  .ass { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
  .ass div { border-top: 1px solid #111; padding-top: 4px; font-size: 10px; color: #444; text-align: center; }
  footer { margin-top: 18px; font-size: 9px; color: #666; }
  @media (max-width: 520px) { .kv { grid-template-columns: 1fr 1fr; } td { font-size: 11px; padding: 6px 2px; } }
  @media print { .folha { padding: 0; max-width: none; } }
</style></head>
<body><div class="folha">
  <header>
    <div><b>${esc(d.loja.nome)}</b>${d.loja.documento ? `<small>${esc(d.loja.documento)}</small>` : ""}${rt ? `<small>${esc(rt)}</small>` : ""}</div>
    <div style="text-align:right"><small>Emitido em ${esc(fmtIsoDate(iso))}</small></div>
  </header>
  <h1>Ficha do cliente e receita</h1>
  <h2>Cliente</h2>
  <div class="kv">
    ${campo("Nome", nome)}
    ${campo("CPF", formatarDocumento(c.cpf))}
    ${campo("Nascimento", nascimentoDaFicha(c.birthday, hoje))}
    ${campo("Telefone", c.phone || rx.customer_phone || "")}
    ${campo("RG", c.rg)}
    ${campo("Sexo", rotuloDoSexo(c.gender))}
    ${campo("Profissão", c.occupation)}
    ${campo("Endereço", c.endereco ? resumoDoEndereco(c.endereco) : "")}
  </div>
  <h2>Receita</h2>
  <table>
    <tr><th>Olho</th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th><th>Adição</th><th>DNP</th><th>Altura</th></tr>
    ${linhaDoOlho("OD · direito", eyes.od)}
    ${linhaDoOlho("OE · esquerdo", eyes.oe)}
  </table>
  <h2>Prescritor</h2>
  <div class="kv">
    ${campo("Nome", rx.prescriber_name || "Não informado")}
    ${campo("Registro", prescritor)}
    ${campo("Emitida · válida até", datas)}
  </div>
  ${rx.notes ? `<h2>Observações</h2><div>${esc(rx.notes)}</div>` : ""}
  <div class="ass"><div>Cliente</div><div>Ótica</div></div>
  <footer>Receita é dado de saúde do cliente. Documento emitido pela loja para conferência; não substitui a receita do prescritor.</footer>
</div>
<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 250); });</script>
</body></html>`;
}

/**
 * Abre a janela de impressão com a ficha. Chamar DIRETO no onPress (o
 * window.open precisa do gesto do clique — ver services/printWindow).
 */
export function printReceita(d: DadosDaFichaDaReceita): Promise<PrintOutcome> {
  return openPrintWindow(async () => ({ ok: true as const, html: htmlDaFichaDaReceita(d) }), "width=900,height=1000,scrollbars=yes");
}
