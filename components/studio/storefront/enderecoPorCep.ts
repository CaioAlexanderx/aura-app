// ============================================================
// components/studio/storefront/enderecoPorCep.ts
//
// O CEP primeiro, e ele faz o resto (Fase 2, Tela 3 do mockup).
//
// No checkout de hoje o CEP vinha por último, o endereço era digitado à
// mão e o frete só aparecia depois de um botão "Calcular frete". Na
// Negócio (checkout.js, fetchCep) o oitavo dígito busca o endereço no
// ViaCEP, preenche rua, bairro, cidade e UF, cota o frete e leva o cursor
// para o número. Aqui é o mesmo serviço (a CSP da casca já libera
// viacep.com.br, services/vitrineStudioShell.js).
// ============================================================

export type EnderecoDoCep = {
  cep: string;
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
};

/** A resposta do ViaCEP, ou null quando ele diz que o CEP não existe. */
export function lerViaCep(j: any, cep: string): EnderecoDoCep | null {
  if (!j || typeof j !== "object" || j.erro === true || j.erro === "true") return null;
  const t = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const cidade = t(j.localidade);
  const uf = t(j.uf).toUpperCase().slice(0, 2);
  if (!cidade || uf.length !== 2) return null;
  return { cep, rua: t(j.logradouro), bairro: t(j.bairro), cidade, uf };
}

/** "Jardim Esplanada · São José dos Campos/SP". */
export function linhaDoBairro(e: Pick<EnderecoDoCep, "bairro" | "cidade" | "uf"> | null | undefined): string {
  if (!e) return "";
  const cidade = [e.cidade, e.uf].filter(Boolean).join("/");
  return [e.bairro, cidade].filter(Boolean).join(" · ");
}

/**
 * Busca o endereço. `null` = CEP não encontrado; lança em falha de rede
 * (a tela diz "não deu para buscar" e deixa digitar à mão).
 */
export async function buscarEnderecoPorCep(
  cepBruto: string,
  buscar: typeof fetch = fetch,
): Promise<EnderecoDoCep | null> {
  const cep = String(cepBruto || "").replace(/\D/g, "");
  if (cep.length !== 8) return null;
  const r = await buscar(`https://viacep.com.br/ws/${cep}/json/`);
  if (!r.ok) return null;
  return lerViaCep(await r.json(), cep);
}
