// ============================================================
// AURA. — Cliente repetido no cadastro rapido (p-168, 17/11/2026)
//
// O QuickCustomerModal procurava a lista no cache pela chave exata
// ['customers', companyId], mas o useCustomers guarda em
// ['customers', companyId | 'me', sort]. A leitura nunca achava nada e o
// aviso "Ja existe um cliente cadastrado" nunca aparecia. Agora o modal le
// todas as listas em cache que comecam com ['customers'] e esta funcao
// procura nelas: primeiro por telefone (mais forte), depois por nome exato.
//
// 17/11/2026 (p-167, "+ Novo cliente" dentro da troca): o nome compara sem
// acento, sem maiuscula e sem espaco sobrando ("Joao" acha "João").
// ============================================================

export type ClienteRepetido = { id: string; name: string; phone: string };

/** Nome para comparar: sem acento, sem maiuscula, espacos simples. */
export function nomeParaComparar(name: string): string {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrai o array de clientes de um valor do cache (formatos da API). */
export function clientesDoCache(cached: any): any[] {
  if (!cached) return [];
  if (Array.isArray(cached)) return cached;
  if (Array.isArray(cached.customers)) return cached.customers;
  if (Array.isArray(cached.rows)) return cached.rows;
  return [];
}

export function acharClienteRepetido(
  listas: any[],
  name: string,
  phone: string,
): ClienteRepetido | null {
  const arr: any[] = [];
  for (const l of listas) arr.push(...clientesDoCache(l));
  if (arr.length === 0) return null;

  const cleanPhone = (phone || "").replace(/\D/g, "");
  const normName = nomeParaComparar(name);

  if (cleanPhone.length >= 10) {
    const byPhone = arr.find((c) => c && (c.phone || "").replace(/\D/g, "") === cleanPhone);
    if (byPhone) return { id: byPhone.id, name: byPhone.name, phone: byPhone.phone || "" };
  }
  if (normName.length >= 2) {
    const byName = arr.find((c) => c && nomeParaComparar(c.name) === normName);
    if (byName) return { id: byName.id, name: byName.name, phone: byName.phone || "" };
  }
  return null;
}
