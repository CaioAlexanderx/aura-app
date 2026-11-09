// ============================================================
// components/endereco/endereco.ts
//
// Endereço do cliente para entrega (09/11/2026, parte 1). Regras puras,
// sem react-native, para o formulário (EnderecoForm), o cadastro, a ficha,
// o seletor do Caixa e — na parte 2 — a trava da venda com frete.
//
// Contrato do backend (src/routes/customers.js, src/services/customerAddress.js):
//   zip_code, street, number, complement, neighborhood, city, state,
//   address_reference, e has_address no GET. Os canônicos são `number` e
//   `zip_code`; address_number e postal_code ficam de fora.
// ============================================================
import { lerViaCep, type EnderecoDoCep } from "@/components/studio/storefront/enderecoPorCep";

export type Endereco = {
  /** CEP só com dígitos (o formulário mostra 00000-000). */
  zip: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  /** UF, duas letras. */
  state: string;
  /** Ponto de referência ("portão azul, ao lado da padaria"). */
  reference: string;
  /** Código IBGE do município. Só a troca com NF-e usa; o cadastro não grava. */
  ibge?: string;
};

export const ENDERECO_VAZIO: Endereco = {
  zip: "", street: "", number: "", complement: "", neighborhood: "",
  city: "", state: "", reference: "", ibge: "",
};

const t = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** "01310100" → "01310-100" (e o meio do caminho enquanto digita). */
export function formatarCep(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : d.slice(0, 5) + "-" + d.slice(5);
}

/** Lê o endereço de um cliente como o GET /customers devolve. */
export function enderecoDoCliente(c: any): Endereco {
  if (!c) return { ...ENDERECO_VAZIO };
  return {
    zip: t(c.zip_code).replace(/\D/g, ""),
    street: t(c.street),
    number: t(c.number),
    complement: t(c.complement),
    neighborhood: t(c.neighborhood),
    city: t(c.city),
    state: t(c.state).toUpperCase(),
    reference: t(c.address_reference),
    ibge: "",
  };
}

/**
 * Corpo para POST/PATCH /customers. Vazio vai como null (o backend apaga).
 * O IBGE não vai: o cadastro não tem essa coluna.
 */
export function enderecoParaApi(e: Endereco) {
  const n = (v: string) => (t(v) === "" ? null : t(v));
  return {
    zip_code: n(String(e.zip || "").replace(/\D/g, "")),
    street: n(e.street),
    number: n(e.number),
    complement: n(e.complement),
    neighborhood: n(e.neighborhood),
    city: n(e.city),
    state: n(String(e.state || "").toUpperCase()),
    address_reference: n(e.reference),
  };
}

/** Algum campo preenchido (o operador começou um endereço). */
export function enderecoComecado(e: Endereco | null | undefined): boolean {
  if (!e) return false;
  return [e.zip, e.street, e.number, e.complement, e.neighborhood, e.city, e.state, e.reference]
    .some((v) => t(v) !== "");
}

/**
 * O mínimo para levar uma entrega: rua (ou CEP), número e cidade.
 * Mesmo critério do `has_address` do backend.
 */
export function temEnderecoDeEntrega(e: Endereco | null | undefined): boolean {
  if (!e) return false;
  return !!((t(e.street) || t(e.zip)) && t(e.number) && t(e.city));
}

/**
 * O que falta para a entrega (modo "obrigatório"). `nome` entra quando a
 * tela também pede quem recebe ("Quem recebe a entrega?", parte 2).
 */
export function faltandoParaEntrega(e: Endereco, opts?: { nome?: string }): string[] {
  const falta: string[] = [];
  if (opts && "nome" in opts && t(opts.nome) === "") falta.push("nome");
  if (!t(e.street) && !t(e.zip)) falta.push("CEP ou rua");
  if (!t(e.number)) falta.push("número");
  if (!t(e.city)) falta.push("cidade");
  return falta;
}

/**
 * Erro de formato (o mesmo que o backend recusa), ou null. Tudo opcional:
 * vazio passa.
 */
export function erroDoEndereco(e: Endereco): string | null {
  const cep = String(e.zip || "").replace(/\D/g, "");
  if (cep && cep.length !== 8) return "O CEP precisa ter 8 números";
  const uf = t(e.state);
  if (uf && !/^[A-Za-z]{2}$/.test(uf)) return "A UF precisa ter 2 letras (ex.: SP)";
  return null;
}

/** "Av. Paulista, 1000 · Bela Vista" — a linha do seletor do Caixa. */
export function resumoDoEndereco(e: Endereco | null | undefined): string {
  if (!e) return "";
  const rua = [t(e.street), t(e.number)].filter(Boolean).join(", ");
  return [rua, t(e.neighborhood)].filter(Boolean).join(" · ");
}

/** "Apto 52 · São Paulo/SP · CEP 01310-100" — a segunda linha da ficha. */
export function linhaDaCidade(e: Endereco | null | undefined): string {
  if (!e) return "";
  const cidade = [t(e.city), t(e.state)].filter(Boolean).join("/");
  const cep = t(e.zip) ? "CEP " + formatarCep(e.zip) : "";
  return [t(e.complement), cidade, cep].filter(Boolean).join(" · ");
}

export type EnderecoDoCepComIbge = EnderecoDoCep & { ibge: string };

/**
 * ViaCEP com o código IBGE (a troca com NF-e precisa dele). A leitura é a
 * mesma do checkout da vitrine (lerViaCep). `null` = CEP não existe; lança
 * em falha de rede.
 */
export async function buscarCep(
  cepBruto: string,
  buscar: typeof fetch = fetch,
): Promise<EnderecoDoCepComIbge | null> {
  const cep = String(cepBruto || "").replace(/\D/g, "");
  if (cep.length !== 8) return null;
  const r = await buscar(`https://viacep.com.br/ws/${cep}/json/`);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const e = lerViaCep(j, cep);
  if (!e) return null;
  return { ...e, ibge: typeof j?.ibge === "string" ? j.ibge.replace(/\D/g, "").slice(0, 7) : "" };
}
