// ============================================================
// AURA. — Documento da empresa: CNPJ ou, na conta sem CNPJ, CPF
//
// 20/10/2026 — decisão do Caio: "vamos liberar para os clientes que
// sinalizarem que não tem CNPJ". O cadastro ganha "Não tenho CNPJ" (CPF +
// nome da loja, sem consulta à Receita); o backend grava em companies.cpf
// (migration 400) e devolve `cpf` no perfil e na Gestão Aura.
// Funções puras, usadas no cadastro, em Configurações, no Painel, nas notas
// fiscais e na Gestão Aura.
// ============================================================
import { isValidCpf } from "@/utils/mask";
import { maskCnpj, maskCpf } from "@/utils/masks";

const digitos = (v?: string | null) => String(v == null ? "" : v).replace(/\D/g, "");

/** CPF do cadastro: 11 dígitos com os verificadores certos. */
export function cpfDoCadastroValido(cpf: string): boolean {
  return isValidCpf(digitos(cpf));
}

/**
 * Parte do corpo do POST /auth/register que diz qual é o documento.
 * Com CNPJ: exatamente o de sempre (cnpj + regime da Receita). Sem CNPJ:
 * só o CPF, sem regime (não há Receita para consultar e nada é inventado).
 */
export function documentoDoCadastro(args: {
  semCnpj: boolean;
  cnpj: string;
  cpf: string;
  regimeDetectado: string | null;
}): { cnpj: string; tax_regime: string | undefined } | { cpf: string } {
  if (args.semCnpj) return { cpf: digitos(args.cpf) };
  return { cnpj: digitos(args.cnpj), tax_regime: args.regimeDetectado || undefined };
}

/** 409 do cadastro: o `code` do backend diz o que já existe. */
export function conflitoDoCadastro(code?: string | null): "cnpj" | "cpf" | "email" {
  if (code === "CNPJ_ALREADY_REGISTERED") return "cnpj";
  if (code === "CPF_ALREADY_REGISTERED") return "cpf";
  return "email";
}

/**
 * Documento para mostrar: "CNPJ 11.222.333/0001-81", "CPF 529.982.247-25"
 * ou "" — nunca "CNPJ: null" nem "undefined".
 */
export function textoDoDocumento(doc: { cnpj?: string | null; cpf?: string | null }): string {
  const cnpj = digitos(doc.cnpj);
  if (cnpj) return "CNPJ " + (cnpj.length === 14 ? maskCnpj(cnpj) : cnpj);
  const cpf = digitos(doc.cpf);
  if (cpf) return "CPF " + (cpf.length === 11 ? maskCpf(cpf) : cpf);
  return "";
}

/** Conta que nasceu com CPF e ainda não informou o CNPJ. */
export function contaSemCnpj(doc: { cnpj?: string | null; cpf?: string | null } | null | undefined): boolean {
  return !!doc && !digitos(doc.cnpj) && !!digitos(doc.cpf);
}

/** Mesmo texto do backend (CNPJ_REQUIRED) para as funções que a lei amarra ao CNPJ. */
export const MSG_NOTA_PRECISA_CNPJ =
  "A emissão de nota fiscal precisa de CNPJ. Quando você abrir o seu, informe em Configurações > Empresa.";
