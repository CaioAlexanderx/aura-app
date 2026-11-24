import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi, ApiError, request } from "@/services/api";
import { meAggregatesApi } from "@/services/meAggregates";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { pluralize } from "@/utils/plural";
import type { Customer } from "@/components/screens/clientes/types";
import { enderecoDoCliente, enderecoParaApi, temEnderecoDeEntrega } from "@/components/endereco/endereco";
import { camposExtrasAceitos, cpfParaApi, temMascara } from "@/utils/clienteDadosCompletos";

// MULTICNPJ Sessao 2 Onda 2.3 (03/05/2026):
// Hook ramifica entre /me/customers (consolidated) e /companies/:id/customers
// (per-company). Backend ja retorna lista UNICA owner-scoped em ambos os
// endpoints -- vendedora membro so de Loja A ainda ve clientes registrados
// em Loja B do mesmo dono.
//
// Mutations (POST/PATCH/DELETE) em modo consolidated:
// resolvem automaticamente a primary do owner (do availableCompanies).
// User nao precisa trocar de empresa pra criar/editar/deletar.
//
// Crediario (mai/2026): backend retorna credit_balance via LEFT JOIN
// com customer_credit_balances. Mapeio pra Customer.creditBalance.
//
// 11/05/2026 -- PLAN-01: Clientes basico no Essencial. Limite por plano
// (1k/5k/ilimitado) controlado em customers.js. 403 do POST/PATCH agora
// significa LIMITE ATINGIDO (com body.limit, body.current), nao bloqueio
// de plano. Toasts contextualizados com upgrade path quando aplicavel.
//
// 15/06/2026 -- fix edicao (aura-app#256):
// Bug A: birthday era mapeado sem ano ("DD/MM") -> parseBirthday corrompida
// o ano para 2000 a cada edicao. Fix: usa birth_date direto com year:numeric
// -> exibe "25/05/1990" -> parseBirthday round-tripa corretamente.
// Bug B: campos opcionais usavam || undefined -> JSON omitia -> nao era
// possivel limpar email/telefone/notas/instagram. Fix: usa null, que o
// backend processa como SET field = NULL.
//
// 01/09/2026 -- duas correcoes vindas do QA:
// (a) ?sort=recent: o backend passou a aceitar sort=recent em
//     GET /companies/:id/customers e GET /me/customers
//     (last_purchase_at DESC NULLS LAST, name ASC). Quem precisa da lista
//     por recencia -- o seletor de cliente do PDV -- pede useCustomers({ sort:
//     "recent" }); sem o parametro nada muda (alfabetico, default do backend).
//     companiesApi.customers/meAggregatesApi.customers nao aceitam query e
//     pertencem a outra frente, por isso a variante ordenada usa `request`
//     direto. O `sort` entra na queryKey: sao listas com ORDENS diferentes,
//     misturar os caches faria a tela de Clientes herdar a ordem do PDV.
// (b) erro de rede: o hook engolia a falha e devolvia [] -- indistinguivel de
//     base vazia (dois QAs independentes cairam nisso). Agora expoe
//     isError/error/refetch. 403 continua saindo por planBlocked e NAO conta
//     como isError, senao a tela mostraria erro de rede num bloqueio de plano.

// Processa deletes em lotes para nao sobrecarregar o servidor
async function deleteBatched(
  ids: string[],
  deleteFn: (id: string) => Promise<any>,
  batchSize = 10,
  onProgress?: (done: number, total: number) => void
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(id => deleteFn(id)));
    succeeded += results.filter(r => r.status === "fulfilled").length;
    failed    += results.filter(r => r.status === "rejected").length;
    onProgress?.(Math.min(i + batchSize, ids.length), ids.length);
  }
  return { succeeded, failed };
}

export function mapApiCustomer(c: any): Customer {
  // Bug A fix (15/06/2026): usa birth_date diretamente com ano, em vez de
  // confiar no campo birthday do backend (que vem sem ano: "DD/MM").
  // Append 'T12:00:00' (local noon) evita desvio de timezone: sem ele,
  // new Date("1990-05-25") e interpretado como UTC midnight e em UTC-3
  // vira "24/05" no toLocaleDateString. Com T12:00:00 (sem timezone =
  // local), a data e preservada corretamente em qualquer fuso do Brasil.
  // Resultado: exibe "25/05/1990" -> parseBirthday round-tripa "1990-05-25".
  const birthdayDisplay = c.birth_date
    ? new Date(String(c.birth_date).split('T')[0] + 'T12:00:00')
        .toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : (c.birthday || "");

  return {
    id: c.id || c.customer_id || String(Math.random()),
    name: c.name || c.customer_name || "Cliente",
    email: c.email || "",
    phone: c.phone || "",
    instagram: c.instagram || c.instagram_handle || "",
    birthday: birthdayDisplay,
    lastPurchase: c.last_purchase ? new Date(c.last_purchase).toLocaleDateString("pt-BR") : c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString("pt-BR") : "---",
    totalSpent: parseFloat(c.total_spent ?? c.totalSpent ?? c.ltv) || 0,
    visits: parseInt(c.visit_count ?? c.visits ?? c.total_purchases) || 0,
    firstVisit: c.first_visit ? new Date(c.first_visit).toLocaleDateString("pt-BR") : c.first_purchase_at ? new Date(c.first_purchase_at).toLocaleDateString("pt-BR") : c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "---",
    notes: c.notes || "",
    rating: c.rating != null ? parseInt(c.rating) : null,
    // MULTICNPJ Onda 2.3: loja onde foi cadastrado
    company_id: c.company_id || null,
    company_name: c.company_name || null,
    // Crediario: saldo > 0 = cliente deve. Backend retorna 0 quando nao ha lancamentos.
    creditBalance: parseFloat(c.credit_balance ?? c.creditBalance) || 0,
    // 22/09/2026 (Matcon M3 — docs/CONTRACT_MATCON.md, seção M3): com
    // matcon_club_enabled ligado, o GET de clientes devolve `professional
    // {id, trade, points_balance} | null` por cliente — CustomerRow usa
    // isso pra mostrar "Parceiro · pedreiro · 1.240 pontos" sem
    // segunda chamada. Loja sem o toggle nunca manda esse campo.
    professional: c.professional
      ? {
          id: c.professional.id,
          trade: c.professional.trade,
          points_balance: parseFloat(c.professional.points_balance) || 0,
          referrals_count: c.professional.referrals_count != null ? parseInt(c.professional.referrals_count) : undefined,
        }
      : null,
    // 09/11/2026 — endereço para entrega. has_address vem do backend; se
    // um backend antigo não mandar, calcula com o mesmo critério.
    endereco: enderecoDoCliente(c),
    hasAddress: typeof c.has_address === "boolean" ? c.has_address : temEnderecoDeEntrega(enderecoDoCliente(c)),
    // 23/11/2026 — cadastro completo (ótica). Só leitura; quem grava é
    // `dadosCompletos`, que só o formulário com o bloco aberto preenche.
    // 24/11/2026 (Aura-backend#1099): a lista manda CPF e RG mascarados.
    // Máscara fica como veio (tirar os não-dígitos deixaria "24725", que
    // passaria por um CPF pela metade); o inteiro vem do GET /:cid.
    cpf: temMascara(c.cpf_cnpj) ? String(c.cpf_cnpj).trim() : String(c.cpf_cnpj || "").replace(/\D/g, ""),
    rg: c.rg || "",
    docsMasked: c.docs_masked === true,
    gender: c.gender || "",
    occupation: c.occupation || "",
  };
}

/**
 * 23/11/2026 — campos do bloco "Dados completos" (ótica) no corpo do POST e
 * do PATCH. Sem `dadosCompletos` devolve {} e o corpo é o de sempre. Dentro
 * dele, só vai a chave que o formulário mandou: CPF que não foi mexido não é
 * reenviado (um documento antigo fora do padrão não vira erro ao editar o
 * nome), e RG, sexo e profissão só chegam aqui quando o servidor avisou que
 * os aceita (customer_fields).
 *
 * 24/11/2026: CPF ou RG com `*` é a máscara da lista, não o documento — nunca
 * vai no corpo (gravaria a máscara, ou só o fim do número). Última barreira:
 * o formulário já não deixa a máscara virar valor editado.
 */
export function corpoDosDadosCompletos(c: Partial<Customer>): Record<string, string | null> {
  const d = c.dadosCompletos;
  if (!d) return {};
  const corpo: Record<string, string | null> = {};
  if (d.cpf !== undefined && !temMascara(d.cpf)) corpo.cpf_cnpj = cpfParaApi(d.cpf);
  if (d.rg !== undefined && !temMascara(d.rg)) corpo.rg = d.rg.trim() || null;
  if (d.gender !== undefined) corpo.gender = d.gender || null;
  if (d.occupation !== undefined) corpo.occupation = d.occupation.trim() || null;
  return corpo;
}

/** Corpo do POST de cliente a partir do formulário (AddCustomerForm). */
export function corpoDoNovoCliente(c: Customer) {
  const extras = corpoDosDadosCompletos(c);
  // No POST, vazio não vai: não há o que apagar num cadastro novo.
  for (const k of Object.keys(extras)) if (extras[k] == null) delete extras[k];
  return {
    name: c.name,
    email: c.email || undefined,
    phone: c.phone || undefined,
    instagram_handle: c.instagram || undefined,
    birth_date: parseBirthday(c.birthday),
    notes: c.notes || undefined,
    // 09/11/2026: endereço opcional; vazio vai null e o backend ignora.
    ...(c.endereco ? enderecoParaApi(c.endereco) : {}),
    ...extras,
  };
}

/**
 * Corpo do PATCH de cliente a partir do formulário (AddCustomerForm).
 *
 * Bug B fix (15/06/2026): null em vez de undefined para que o backend
 * processe como SET field = NULL, permitindo limpar campos opcionais.
 * undefined e omitido pelo JSON.stringify; null e enviado e o backend
 * atualiza para NULL (fieldMap cobre email/phone/notes/instagram_handle).
 * 09/11/2026: o formulário sempre manda o endereço inteiro (vazio apaga).
 * Sem `endereco`, os campos nem vão e nada muda.
 */
export function corpoDaEdicaoDoCliente(c: Partial<Customer>) {
  return {
    name: c.name,
    email: c.email || null,
    phone: c.phone || null,
    instagram_handle: c.instagram || null,
    birth_date: c.birthday ? parseBirthday(c.birthday) : null,
    notes: c.notes || null,
    ...(c.endereco ? enderecoParaApi(c.endereco) : {}),
    ...corpoDosDadosCompletos(c),
  };
}

function parseBirthday(val: string): string | undefined {
  if (!val) return undefined;
  const parts = val.split("/");
  if (parts.length === 2) return `2000-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  return undefined;
}

// Plano -> mensagem de upgrade contextual para 403 com body.limit.
// Como tirar o gate principal, 403 hoje so dispara quando atinge
// o limite do plano (customers.js).
function limitUpgradeMessage(plan: string, body: any): string {
  const limit = body?.limit;
  const current = body?.current;
  if (!limit) return body?.error || "Limite de clientes atingido.";
  switch ((plan || "").toLowerCase()) {
    case "essencial":
      return `Voce atingiu ${current ?? limit} de ${limit} clientes do Essencial. Faca upgrade pro Negocio (5.000 clientes) ou Expansao (ilimitado).`;
    case "negocio":
      return `Voce atingiu ${current ?? limit} de ${limit} clientes do Negocio. Faca upgrade pro Expansao (ilimitado).`;
    default:
      return body?.error || `Limite de ${limit} clientes atingido.`;
  }
}

/** `sort: "recent"` = mais recentes primeiro (last_purchase_at DESC NULLS LAST,
 *  name ASC). Omitido = alfabetico, o default inalterado do backend. */
export type UseCustomersOptions = { sort?: "recent" };

export function useCustomers(options?: UseCustomersOptions) {
  const sort = options?.sort;
  const { company, token, isDemo, consolidatedView, availableCompanies } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;
  const plan = company?.plan || "essencial";
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // MULTICNPJ Onda 2.3: em modo consolidated, mutations precisam de uma
  // empresa concreta. Resolve a primary do owner automaticamente.
  const mutationCompanyId = useMemo(function () {
    if (!consolidatedView) return companyId || null;
    const primary = (availableCompanies || []).find(function (c: any) { return c.is_primary; });
    return primary?.id || (availableCompanies?.[0]?.id ?? null);
  }, [consolidatedView, companyId, availableCompanies]);

  const { data: apiData, isLoading, error: fetchError, isError: queryIsError, refetch } = useQuery({
    queryKey: ["customers", consolidatedView ? "me" : companyId, sort || "name"],
    queryFn: function () {
      const qs = sort ? "?sort=" + encodeURIComponent(sort) : "";
      if (consolidatedView) {
        return qs
          ? request<any>("/me/customers" + qs, { retry: 1 })
          : meAggregatesApi.customers();
      }
      return qs
        ? request<any>("/companies/" + companyId + "/customers" + qs, { retry: 1 })
        : companiesApi.customers(companyId!);
    },
    enabled: (consolidatedView || !!companyId) && !!token && !isDemo,
    retry: 1,
    staleTime: 30000,
  });

  // Apos PLAN-01, 403 no GET nao deveria mais ocorrer (gate removido em
  // private.js). Mantenho a flag por seguranca caso volte algum gate
  // futuro (ex: trial expirado bloqueando tudo).
  const planBlocked = (fetchError as any)?.status === 403;
  // 403 tem tela propria (planBlocked) -- fora dele, falha e falha de verdade.
  const isError = !!queryIsError && !planBlocked;

  const customers: Customer[] = useMemo(function () {
    if (isDemo || planBlocked) return [];
    const arr = (apiData as any)?.customers || (apiData as any)?.rows || apiData;
    if (!(arr instanceof Array)) return [];
    return arr.map(mapApiCustomer);
  }, [apiData, isDemo, planBlocked]);

  // Companies count vem do response em consolidated (pra FE decidir mostrar badge)
  const companyCount = (apiData as any)?.company_count || (availableCompanies?.length || 1);
  // 23/11/2026: RG, sexo e profissão só entram no formulário quando o
  // servidor avisa que os aceita (docs/otica-cadastro-completo-backend.md).
  const camposExtras = useMemo(function () { return camposExtrasAceitos(apiData); }, [apiData]);
  // Limite do plano (vem do response do BE)
  const planLimit = (apiData as any)?.plan_limit || null;

  // Helper de invalidacao -- invalida ambos os keys pra cobrir os dois modos
  function invalidateCustomers() {
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  const addMutation = useMutation({
    mutationFn: function (body: any) {
      if (!mutationCompanyId) {
        return Promise.reject(new Error("Empresa não identificada"));
      }
      return companiesApi.createCustomer(mutationCompanyId, body);
    },
    onSuccess: function () {
      invalidateCustomers();
      toast.success("Cliente cadastrado!");
    },
    onError: function (err: any) {
      // PLAN-01: 403 do POST agora indica LIMITE ATINGIDO (gate principal removido).
      // Backend retorna { error, limit, current } pra montar mensagem contextual.
      // Fix: err.data (nao err.body, que nao existe em ApiError).
      if (err instanceof ApiError && err.status === 403) {
        toast.error(limitUpgradeMessage(plan, err.data));
      } else {
        toast.error(err?.message || "Erro ao salvar cliente");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: function (params: { id: string; body: any; sourceCompanyId?: string | null }) {
      // Em consolidated, usa o company_id do proprio cliente (sourceCompanyId)
      // se disponivel -- mais correto que primary, pq o BE espera owner-scope.
      // Backend customers.js owner-scoped permite editar de qualquer loja
      // do mesmo dono, mas usar o original e mais explicito.
      const targetCid = params.sourceCompanyId || mutationCompanyId;
      if (!targetCid) return Promise.reject(new Error("Empresa não identificada"));
      return companiesApi.updateCustomer(targetCid, params.id, params.body);
    },
    onSuccess: function () {
      invalidateCustomers();
      toast.success("Cliente atualizado!");
    },
    onError: function (err: any) {
      toast.error(err?.message || "Erro ao atualizar cliente");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: function (params: { custId: string; sourceCompanyId?: string | null }) {
      const targetCid = params.sourceCompanyId || mutationCompanyId;
      if (!targetCid) return Promise.reject(new Error("Empresa não identificada"));
      return companiesApi.deleteCustomer(targetCid, params.custId);
    },
    onSuccess: function () {
      invalidateCustomers();
      toast.success("Cliente excluído");
    },
    onError: function (err: any) {
      toast.error(err?.message || "Erro ao excluir cliente");
    },
  });

  function addCustomer(c: Customer) {
    if (!mutationCompanyId) { toast.error("Empresa não identificada"); return; }
    if (isDemo) return;
    addMutation.mutate(corpoDoNovoCliente(c));
  }

  // 23/11/2026 (Ótica, "Cadastrar cliente" sem sair da OS): o mesmo POST, com
  // os mesmos avisos, devolvendo o cliente criado — a tela precisa do id para
  // já deixar o cliente escolhido.
  function addCustomerAsync(c: Customer): Promise<Customer> {
    if (isDemo) return Promise.reject(new Error("Modo demonstração"));
    return addMutation.mutateAsync(corpoDoNovoCliente(c)).then(function (r: any) {
      return mapApiCustomer(r?.customer || r);
    });
  }

  function updateCustomer(id: string, c: Partial<Customer>) {
    if (!mutationCompanyId || isDemo) return;
    // Resolve a empresa de origem do cliente (se vem da lista) pra mandar
    // pro endpoint correto. Customer.company_id e preenchido pelo backend.
    const existing = customers.find(function (x) { return x.id === id; });
    const sourceCompanyId = existing?.company_id || null;
    updateMutation.mutate({ id, sourceCompanyId, body: corpoDaEdicaoDoCliente(c) });
  }

  // 23/11/2026 (ficha do crediário, "Editar cliente"): o mesmo PATCH, com o
  // mesmo corpo e os mesmos avisos, mas devolvendo a promessa — a ficha
  // precisa saber que gravou para fechar a janela e recarregar o cabeçalho.
  // `sourceCompanyId` explícito ganha da lista (a ficha sabe a loja dela).
  function updateCustomerAsync(id: string, c: Partial<Customer>, sourceCompanyId?: string | null) {
    if (isDemo) return Promise.reject(new Error("Modo demonstração"));
    const existing = customers.find(function (x) { return x.id === id; });
    return updateMutation.mutateAsync({
      id,
      sourceCompanyId: sourceCompanyId || existing?.company_id || null,
      body: corpoDaEdicaoDoCliente(c),
    });
  }

  function deleteCustomer(id: string) {
    if (!mutationCompanyId || isDemo) return;
    const existing = customers.find(function (x) { return x.id === id; });
    const sourceCompanyId = existing?.company_id || null;
    deleteMutation.mutate({ custId: id, sourceCompanyId });
  }

  // Bulk delete em lotes de 10 -- nao sobrecarrega o servidor
  async function bulkDeleteCustomers(ids: string[]) {
    if (!mutationCompanyId || isDemo || ids.length === 0) return;
    setBulkDeleting(true);
    if (ids.length > 20) toast.info(`Excluindo ${pluralize(ids.length, "cliente")}…`);
    try {
      // Pra cada id, resolve sourceCompanyId do customer.
      // Como o helper deleteBatched recebe so um deleteFn(id), encapsulamos.
      const customerById = new Map(customers.map(function (c) { return [c.id, c]; }));
      const { succeeded, failed } = await deleteBatched(
        ids,
        function (id) {
          const c = customerById.get(id);
          const targetCid = c?.company_id || mutationCompanyId;
          return companiesApi.deleteCustomer(targetCid!, id);
        },
        10
      );
      invalidateCustomers();
      if (failed === 0) {
        // 01/09/2026: concordancia via pluralize (o "excluido(s)" manual
        // ainda por cima vinha sem acento).
        toast.success(`${pluralize(succeeded, "cliente")} ${succeeded === 1 ? "excluído" : "excluídos"}`);
      } else {
        toast.warning?.(`${succeeded} ${succeeded === 1 ? "excluído" : "excluídos"}, ${failed} com erro`);
        if (!toast.warning) toast.error(`${pluralize(failed, "cliente")} com erro ao excluir`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir clientes selecionados");
    } finally {
      setBulkDeleting(false);
    }
  }

  return {
    customers,
    isLoading: isLoading && !isDemo,
    isDemo,
    planBlocked,
    // 01/09/2026: sem isto a tela nao distinguia "falhou" de "base vazia".
    isError,
    error: fetchError,
    refetch,
    bulkDeleting,
    addCustomer,
    addCustomerAsync,
    camposExtras,
    updateCustomer,
    updateCustomerAsync,
    deleteCustomer,
    bulkDeleteCustomers,
    // MULTICNPJ Onda 2.3: info pra UI condicionar badge da loja
    consolidatedView,
    companyCount,
    // PLAN-01: limite do plano (pra UI mostrar progress "X/Y clientes")
    planLimit,
    plan,
    // Helper pra UI invalidar saldo apos receber pagamento
    invalidateCustomers,
  };
}
