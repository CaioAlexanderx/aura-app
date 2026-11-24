// ============================================================
// AURA. — CPF e RG inteiros para a ficha aberta e o formulário de edição
//
// 24/11/2026 (Aura-backend#1099). A LISTA de clientes passou a devolver CPF
// e RG mascarados ("***.***.247-25", com docs_masked: true). O valor inteiro
// só sai no GET /companies/:id/customers/:cid — é ele que a ficha aberta, o
// formulário de edição e a receita impressa usam.
//
//   - Cadastro sem máscara (backend antigo, ou cliente sem documento):
//     nenhuma chamada; devolve o que já veio, estado "inteiros".
//   - Com máscara: "carregando" até o GET responder; depois "inteiros" com o
//     valor de verdade. Se o GET falhar (ou voltar ainda mascarado), "falhou"
//     e o documento fica com a máscara — quem usa mostra só leitura e não
//     manda o campo sem a pessoa redigitar.
//
// Multi-CNPJ: o GET é owner-scoped como o PATCH, mas usa a loja ONDE O
// CLIENTE ESTÁ (company_id do cadastro), a mesma que o PATCH usa
// (targetCid em hooks/useCustomers.ts). Sem ela, a loja ativa ou a principal.
//
// Sem react-query de propósito: o formulário é montado em telas e testes sem
// QueryClientProvider, e o documento inteiro não deve ficar num cache que
// outras telas leem (as listas ["customers", ...] são varridas pela busca de
// cliente repetido).
// ============================================================
import { useEffect, useState } from "react";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { precisaDosDocumentosInteiros, temMascara } from "@/utils/clienteDadosCompletos";
import type { Customer } from "@/components/screens/clientes/types";

export type EstadoDosDocumentos = "inteiros" | "carregando" | "falhou";
export type DocumentosDoCliente = { estado: EstadoDosDocumentos; cpf: string; rg: string };

type ClienteComDocs = Pick<Customer, "id"> & Partial<Pick<Customer, "cpf" | "rg" | "docsMasked" | "company_id">>;

/**
 * GET /companies/:cid/customers/:id → CPF (só dígitos) e RG inteiros.
 * Rejeita se a resposta não trouxer o cliente ou vier ainda mascarada:
 * máscara nunca passa por documento inteiro.
 */
export async function buscarDocumentosInteiros(companyId: string, customerId: string): Promise<{ cpf: string; rg: string }> {
  const r = await request<any>(
    "/companies/" + encodeURIComponent(companyId) + "/customers/" + encodeURIComponent(customerId),
    { retry: 1 },
  );
  const c = r?.customer;
  if (!c || c.docs_masked === true || temMascara(c.cpf_cnpj) || temMascara(c.rg)) {
    throw new Error("Documento completo indisponível");
  }
  return { cpf: String(c.cpf_cnpj || "").replace(/\D/g, ""), rg: c.rg || "" };
}

/** Loja para o GET: a do cadastro (multi-CNPJ); sem ela, a ativa ou a principal. */
export function lojaDoCliente(
  cliente: { company_id?: string | null } | null | undefined,
  auth: { company?: { id?: string } | null; availableCompanies?: any[] | null },
): string | null {
  if (cliente?.company_id) return cliente.company_id;
  if (auth.company?.id) return auth.company.id;
  const lojas = auth.availableCompanies || [];
  return (lojas.find((x: any) => x?.is_primary) || lojas[0])?.id || null;
}

/**
 * Cadastro com o CPF e o RG inteiros. Fora da ótica, ou quando nada está
 * mascarado, passe o cliente mesmo assim: sem máscara não há chamada.
 * `null` = nada a buscar (formulário de cliente novo, ficha fechada).
 */
export function useDocumentosDoCliente(cliente: ClienteComDocs | null | undefined): DocumentosDoCliente {
  const auth = useAuthStore() as any;
  const precisa = precisaDosDocumentosInteiros(cliente);
  const cid = precisa ? lojaDoCliente(cliente, auth || {}) : null;
  const id = cliente?.id || null;
  const [res, setRes] = useState<{ chave: string; estado: EstadoDosDocumentos; cpf: string; rg: string } | null>(null);
  const chave = precisa && id ? `${cid}/${id}` : "";

  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    if (!cid || !id) {
      setRes({ chave, estado: "falhou", cpf: "", rg: "" });
      return;
    }
    buscarDocumentosInteiros(cid, id).then(
      (d) => { if (vivo) setRes({ chave, estado: "inteiros", ...d }); },
      () => { if (vivo) setRes({ chave, estado: "falhou", cpf: "", rg: "" }); },
    );
    return () => { vivo = false; };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

  const cpfDaLista = cliente?.cpf || "";
  const rgDaLista = cliente?.rg || "";
  if (!chave) return { estado: "inteiros", cpf: cpfDaLista, rg: rgDaLista };
  if (!res || res.chave !== chave) return { estado: "carregando", cpf: cpfDaLista, rg: rgDaLista };
  if (res.estado === "inteiros") return { estado: "inteiros", cpf: res.cpf, rg: res.rg };
  return { estado: "falhou", cpf: cpfDaLista, rg: rgDaLista };
}
