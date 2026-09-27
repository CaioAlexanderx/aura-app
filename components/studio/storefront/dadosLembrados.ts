// ============================================================
// components/studio/storefront/dadosLembrados.ts
//
// "Que bom te ver de novo, Helena" (Fase 2, Tela 2 do mockup).
//
// A cliente que volta digitava tudo de novo. A loja Negócio guarda os
// dados da última compra no navegador por 90 dias (checkout.js,
// `aura_customer_{slug}`), e aqui é a MESMA chave e o mesmo prazo: é o
// mesmo navegador e a mesma loja, e duas chaves para a mesma pessoa
// seriam dois lugares para esquecer de apagar.
//
// "Não sou eu" apaga a chave — no celular emprestado, a próxima pessoa
// não vê o nome nem o WhatsApp de quem comprou antes.
//
// A saudação é neutra de propósito (decisão do PO, 25/09): "Bem-vinda"
// supõe o gênero.
//
// O storage entra por parâmetro: é regra, tem teste, e nativo/modo
// privado que recusa storage só perde o atalho.
// ============================================================

/** 90 dias: endereço e telefone podem ter mudado depois disso. */
export const VALIDADE_DOS_DADOS_MS = 90 * 24 * 60 * 60 * 1000;

export function chaveDosDados(slug: string): string {
  return "aura_customer_" + String(slug || "").trim().toLowerCase();
}

export type DadosLembrados = {
  ts: number;
  name: string;
  phone: string;
  email: string;
  customer_cpf_cnpj: string;
  request_nfce: boolean;
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
};

type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null | undefined;

const texto = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/**
 * Os dados da última compra nesta loja, ou null (sem nada guardado,
 * vencido, corrompido ou sem nome — sem nome não há a quem saudar).
 */
export function lerDadosLembrados(slug: string, storage: Armazem, agora: number = Date.now()): DadosLembrados | null {
  try {
    const raw = storage?.getItem(chaveDosDados(slug));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object") return null;
    const ts = Number(d.ts);
    if (Number.isFinite(ts) && agora - ts > VALIDADE_DOS_DADOS_MS) {
      storage?.removeItem(chaveDosDados(slug));
      return null;
    }
    const nome = texto(d.name).trim();
    if (!nome) return null;
    return {
      ts: Number.isFinite(ts) ? ts : agora,
      ...camposDaPessoa(d),
      name: nome,
      request_nfce: d.request_nfce === true,
    };
  } catch {
    return null;
  }
}

/** Os campos de pessoa e endereço, do jeito que ficam guardados (os mesmos nomes da loja Negócio). */
type CamposDaPessoa = Omit<DadosLembrados, "ts" | "request_nfce">;

function camposDaPessoa(d: any): CamposDaPessoa {
  return {
    name: texto(d?.name),
    phone: texto(d?.phone),
    email: texto(d?.email),
    customer_cpf_cnpj: texto(d?.customer_cpf_cnpj),
    address_zip: texto(d?.address_zip),
    address_street: texto(d?.address_street),
    address_number: texto(d?.address_number),
    address_complement: texto(d?.address_complement),
    address_neighborhood: texto(d?.address_neighborhood),
    address_city: texto(d?.address_city),
    address_state: texto(d?.address_state),
  };
}

/** Grava depois do pedido criado (nunca antes: dado de pedido que falhou não é "da última compra"). */
export function guardarDadosLembrados(
  slug: string,
  dados: Omit<DadosLembrados, "ts">,
  storage: Armazem,
  agora: number = Date.now(),
): void {
  try {
    storage?.setItem(chaveDosDados(slug), JSON.stringify({ ts: agora, ...dados }));
  } catch {
    /* sem storage: só perde o atalho */
  }
}

/** "Não sou eu". */
export function esquecerDadosLembrados(slug: string, storage: Armazem): void {
  try { storage?.removeItem(chaveDosDados(slug)); } catch { /* idem */ }
}

// ── O rascunho do checkout, na aba (QA 27/09) ────────────────
//
// F5 e o avançar do navegador no checkout voltavam à etapa 1 com nome,
// WhatsApp e CPF apagados. Enquanto o pedido não é enviado, o que a
// cliente digitou (os mesmos campos dos dados lembrados, mais a entrega
// escolhida) e a etapa ficam no sessionStorage, por loja: morrem com a
// aba e saem quando o pedido é criado. Os dados lembrados continuam
// sendo só da última compra — gravados depois do pedido, nunca antes.

export type EtapaDoRascunho = 1 | 2 | 3;

export type RascunhoDoCheckout = {
  etapa: EtapaDoRascunho;
  dados: CamposDaPessoa & {
    quer_documento: boolean;
    entrega: "pickup" | "delivery" | "courier" | null;
    courier_name: string;
    courier_plate: string;
    courier_depois: boolean;
    notes: string;
  };
};

export function chaveDoRascunho(slug: string): string {
  return "aura_checkout_" + String(slug || "").trim().toLowerCase();
}

/** O rascunho desta loja nesta aba, ou null (nada, corrompido ou vazio). */
export function lerRascunhoDoCheckout(slug: string, storage: Armazem): RascunhoDoCheckout | null {
  try {
    const raw = storage?.getItem(chaveDoRascunho(slug));
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (!r || typeof r !== "object" || !r.dados || typeof r.dados !== "object") return null;
    const etapa = Number(r.etapa);
    const e = r.dados.entrega;
    return {
      etapa: etapa === 2 || etapa === 3 ? etapa : 1,
      dados: {
        ...camposDaPessoa(r.dados),
        quer_documento: r.dados.quer_documento === true,
        entrega: e === "pickup" || e === "delivery" || e === "courier" ? e : null,
        courier_name: texto(r.dados.courier_name),
        courier_plate: texto(r.dados.courier_plate),
        courier_depois: r.dados.courier_depois === true,
        notes: texto(r.dados.notes),
      },
    };
  } catch {
    return null;
  }
}

export function guardarRascunhoDoCheckout(slug: string, rascunho: RascunhoDoCheckout, storage: Armazem): void {
  try { storage?.setItem(chaveDoRascunho(slug), JSON.stringify(rascunho)); } catch { /* sem storage: só perde o F5 */ }
}

/** O pedido foi criado: o rascunho sai. */
export function esquecerRascunhoDoCheckout(slug: string, storage: Armazem): void {
  try { storage?.removeItem(chaveDoRascunho(slug)); } catch { /* idem */ }
}

/** "Helena Martins" → "Helena". */
export function primeiroNome(nome: string | null | undefined): string {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}

/** A saudação da cliente que volta. Neutra: nunca "Bem-vinda". */
export function saudacao(nome: string | null | undefined): string {
  const n = primeiroNome(nome);
  return n ? `Que bom te ver de novo, ${n}` : "Que bom te ver de novo";
}

/** O localStorage do navegador, ou null fora dele. */
export function storageLocal(): Armazem {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

/** O sessionStorage do navegador (a aba), ou null fora dele. */
export function storageDaAba(): Armazem {
  try { return typeof window !== "undefined" ? window.sessionStorage : null; } catch { return null; }
}
