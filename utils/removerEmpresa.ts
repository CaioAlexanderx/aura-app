// ============================================================
// Remover empresa (tela /empresas) — INC-2026-10-22-01, tq-103, 22/10/2026
//
// Uma lojista em teste removeu a própria e única empresa e a conta abriu
// vazia no login seguinte. Regras puras da tela, testadas à parte:
//   - o botão só existe para empresa do próprio dono, que não é a principal,
//     e quando o dono tem pelo menos 2 empresas ativas (a lista do GET
//     /me/companies só traz ativas; empresa em que ele é membro não conta)
//   - a confirmação exige digitar o nome da empresa
//   - o erro do servidor (409 LAST_COMPANY, HAS_SALES, CANNOT_REMOVE_PRIMARY)
//     aparece com a mensagem que o servidor mandou
// ============================================================
import type { FullCompany } from "@/services/multicnpj";

type EmpresaDaLista = Pick<FullCompany, "id" | "is_primary" | "role">;

/** Empresas ativas de que o usuário é dono (a lista já vem só com ativas). */
export function empresasDoDono(companies: EmpresaDaLista[]): number {
  return companies.filter((c) => c.role === "owner").length;
}

/** O botão "Remover" aparece para esta empresa? */
export function podeRemoverEmpresa(c: EmpresaDaLista, companies: EmpresaDaLista[]): boolean {
  if (c.role !== "owner") return false;
  if (c.is_primary) return false;
  return empresasDoDono(companies) >= 2;
}

/** Nome que a lojista precisa digitar: o mesmo que aparece no cartão. */
export function nomeParaConfirmar(c: Pick<FullCompany, "name" | "legal_name">): string {
  return (c.name || c.legal_name || "").trim();
}

function normalizar(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/** O texto digitado confere com o nome da empresa (sem diferenciar maiúsculas e espaços extras). */
export function nomeConfere(digitado: string, nome: string): boolean {
  const alvo = normalizar(nome);
  return alvo.length > 0 && normalizar(digitado) === alvo;
}

export const TEXTO_CONFIRMAR_REMOCAO =
  "A empresa sai da sua conta e deixa de aparecer para você e sua equipe. Os dados ficam guardados.";

/** Mensagem do erro ao remover: a do servidor quando houver. */
export function mensagemDoErroAoRemover(err: any): string {
  const data = err?.data;
  if (data && typeof data.message === "string" && data.message.trim()) {
    if (data.error === "HAS_SALES" && data.sales_count) {
      return data.message + " Vendas registradas: " + data.sales_count + ".";
    }
    return data.message;
  }
  return err?.message || "Erro ao remover empresa";
}

/** O servidor recusou porque é a única empresa (409 LAST_COMPANY). */
export function ehUltimaEmpresa(err: any): boolean {
  const data = err?.data;
  return data?.code === "LAST_COMPANY" || data?.error === "LAST_COMPANY" || err?.code === "LAST_COMPANY";
}
