// ============================================================
// AURA. — Cadastro completo do cliente (ótica)
//
// 23/11/2026. Com a ótica ligada (pdv_settings.otica_enabled) o cadastro do
// cliente ganha o bloco "Dados completos": CPF, nascimento com ano, RG, sexo
// e profissão. Aqui moram as regras puras; a tela é
// components/screens/clientes/DadosCompletosDoCliente.tsx.
//
// Tudo é OPCIONAL. O que foi preenchido precisa estar certo (CPF com dígito
// verificador), mas nada aqui trava venda de balcão nem a abertura da OS.
//
// O que o servidor aceita hoje (conferido em Aura-backend, 23/11/2026):
//   - cpf_cnpj  → POST e PATCH de /customers; o GET devolve.
//   - birth_date → idem.
//   - rg, gender, occupation → AINDA NÃO. Os campos só aparecem quando o GET
//     de clientes avisar `customer_fields` com eles (contrato em
//     docs/otica-cadastro-completo-backend.md). Sem o aviso, a tela não
//     mostra e o app não manda — nada se perde em silêncio e não há 400.
//
// Privacidade: CPF e nascimento ficam no cadastro e na ficha aberta. Nunca
// na lista de clientes, em mensagem de WhatsApp ou no link de acompanhamento.
// ============================================================
import { isValidCpf } from "@/utils/mask";
import { maskCpfCnpj } from "@/utils/masks";
import { cnpjValido } from "@/utils/fornecedoresUtil";

export type Sexo = "F" | "M" | "outro";

/** Valores do CHECK de customers.gender (migration 050). */
export const SEXOS: { key: Sexo; label: string }[] = [
  { key: "F", label: "Feminino" },
  { key: "M", label: "Masculino" },
  { key: "outro", label: "Outro" },
];

export function rotuloDoSexo(s: string | null | undefined): string {
  return SEXOS.find((x) => x.key === s)?.label || "";
}

/** Campos que dependem do servidor avisar que os aceita. */
export const CAMPOS_EXTRAS = ["rg", "gender", "occupation"] as const;
export type CampoExtra = typeof CAMPOS_EXTRAS[number];

/** Lê `customer_fields` da resposta do GET de clientes. Qualquer outra coisa = nenhum. */
export function camposExtrasAceitos(resposta: any): CampoExtra[] {
  const lista = resposta?.customer_fields;
  if (!Array.isArray(lista)) return [];
  return CAMPOS_EXTRAS.filter((c) => lista.includes(c));
}

const soDigitos = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");

/** CPF (ou o CNPJ que já estava no cadastro) com a máscara certa. */
export function formatarDocumento(v: string | null | undefined): string {
  return maskCpfCnpj(soDigitos(v));
}

/**
 * Erro do documento digitado, ou null. Vazio é válido (o campo é opcional).
 * O campo é de CPF; um CNPJ que já estava gravado continua aceito, para
 * editar o cadastro de uma empresa não virar erro.
 */
export function erroDoCpf(v: string | null | undefined): string | null {
  const d = soDigitos(v);
  if (!d) return null;
  if (d.length < 11) return "CPF incompleto: são 11 números.";
  if (d.length === 11) return isValidCpf(d) ? null : "CPF não confere. Veja se algum número foi trocado.";
  if (d.length === 14) return cnpjValido(d) ? null : "CNPJ não confere. Veja se algum número foi trocado.";
  return "Confira o documento: CPF tem 11 números.";
}

/** Só dígitos para a API; vazio vira null (apaga o documento). */
export function cpfParaApi(v: string | null | undefined): string | null {
  return soDigitos(v) || null;
}

// ─── Nascimento ──────────────────────────────────────────────
//
// O cadastro aceita aniversário sem ano ("DD/MM"). Sem ano, o que vai para o
// banco é um ano de enfeite: 2000 quando digitado no formulário
// (parseBirthday, hooks/useCustomers.ts) e 1904 nas importações de planilha.
// 1904 nunca é um ano de verdade num cadastro de hoje; 2000 pode ser. Por
// isso, com a ótica ligada, o formulário grava o "sem ano" como 1904
// (nascimentoParaGravar) — fora da ótica nada muda, segue 2000.

export const ANO_SEM_ANO_DA_IMPORTACAO = 1904;

export type SituacaoDoNascimento =
  | "vazio"       // nada digitado
  | "incompleto"  // ainda digitando
  | "sem_ano"     // DD/MM, ou o ano de enfeite 1904
  | "invalido"    // data que não existe ou antes de 1900 (o campo de data já avisa)
  | "futuro"      // data de verdade, mas depois de hoje
  | "ok";

function partes(birthday: string): { d: number; m: number; a: number | null } | null {
  const m = String(birthday || "").trim().match(/^(\d{2})\/(\d{2})(?:\/(\d{4}))?$/);
  if (!m) return null;
  return { d: +m[1], m: +m[2], a: m[3] ? +m[3] : null };
}

export function situacaoDoNascimento(birthday: string | null | undefined, hoje: Date = new Date()): SituacaoDoNascimento {
  const s = String(birthday || "").trim();
  if (!s) return "vazio";
  const p = partes(s);
  if (!p) return "incompleto";
  if (p.m < 1 || p.m > 12 || p.d < 1 || p.d > 31) return "invalido";
  if (p.a == null || p.a === ANO_SEM_ANO_DA_IMPORTACAO) return "sem_ano";
  const dt = new Date(p.a, p.m - 1, p.d);
  if (dt.getFullYear() !== p.a || dt.getMonth() !== p.m - 1 || dt.getDate() !== p.d) return "invalido";
  if (p.a < 1900) return "invalido";
  if (dt.getTime() > hoje.getTime()) return "futuro";
  return "ok";
}

/** Como o nascimento aparece no campo da ótica: o ano de enfeite 1904 some ("14/03"). */
export function nascimentoParaOCampo(birthday: string | null | undefined): string {
  const s = String(birthday || "").trim();
  const p = partes(s);
  return p && p.a === ANO_SEM_ANO_DA_IMPORTACAO ? s.slice(0, 5) : String(birthday || "");
}

/**
 * Como a ótica grava o nascimento: sem ano leva 1904 — o mesmo "sem ano" das
 * importações (e bissexto, então 29/02 cabe). Nunca 2000: voltaria do servidor
 * como se a pessoa tivesse nascido em 2000, com idade e sem aviso.
 */
export function nascimentoParaGravar(birthday: string | null | undefined): string {
  const s = String(birthday || "").trim();
  return situacaoDoNascimento(s) === "sem_ano" ? `${s.slice(0, 5)}/${ANO_SEM_ANO_DA_IMPORTACAO}` : s;
}

/** Idade em anos completos, ou null quando o nascimento não tem ano de verdade. */
export function idadeEmAnos(birthday: string | null | undefined, hoje: Date = new Date()): number | null {
  if (situacaoDoNascimento(birthday, hoje) !== "ok") return null;
  const p = partes(String(birthday).trim())!;
  let idade = hoje.getFullYear() - p.a!;
  const fezAniversario = hoje.getMonth() + 1 > p.m || (hoje.getMonth() + 1 === p.m && hoje.getDate() >= p.d);
  if (!fezAniversario) idade -= 1;
  return idade;
}

/** Aviso âmbar do campo de nascimento na ótica. Nunca trava o salvar. */
export function avisoDoNascimento(birthday: string | null | undefined, hoje: Date = new Date()): string | null {
  const sit = situacaoDoNascimento(birthday, hoje);
  if (sit === "sem_ano") return "Sem o ano não dá para saber a idade. Peça o ano de nascimento para a ficha mostrar a idade.";
  if (sit === "futuro") return "A data de nascimento está no futuro. Confira o ano.";
  return null;
}

/**
 * O que falta no cadastro para a ficha da ótica ficar completa. É um
 * lembrete: a OS abre e a venda sai sem nada disto.
 */
export function faltasDoClienteParaOtica(
  c: { cpf?: string | null; birthday?: string | null; phone?: string | null } | null | undefined,
  hoje: Date = new Date(),
): string[] {
  if (!c) return [];
  const faltas: string[] = [];
  if (!soDigitos(c.cpf)) faltas.push("CPF");
  const sit = situacaoDoNascimento(c.birthday, hoje);
  if (sit === "vazio") faltas.push("data de nascimento");
  else if (sit !== "ok") faltas.push("ano de nascimento");
  if (!soDigitos(c.phone)) faltas.push("telefone");
  return faltas;
}
