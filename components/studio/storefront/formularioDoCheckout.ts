// ============================================================
// components/studio/storefront/formularioDoCheckout.ts
//
// As regras do checkout em três etapas (Fase 2, Telas 2 a 4 do mockup
// studio-vitrine-02-fechar-a-venda). Sem React, sem tela.
//
// Portado da loja Negócio (Aura-backend src/templates/storefront/parts/
// checkout.js), que foi validada em set/2026: máscara do WhatsApp, CPF
// ou CNPJ com dígito verificador, e-mail sem regex, CEP com máscara. O
// que muda aqui é o BOTÃO: em vez de um toast "Preencha nome e telefone"
// depois do toque, o botão apagado diz o que falta ("Falta seu nome") e
// o toque leva ao campo — a regra de oQueFaltaNoCheckout.ts, agora por
// etapa.
// ============================================================
import { validateCpf, validateCnpj } from "@/lib/validators";
import { normalizePlate } from "./courierPlate";
import type { DeliveryType } from "./types";

export type Etapa = 1 | 2 | 3;
export type FormaDePagamento = "pix" | "card" | "on_delivery";

/** "12242000" → "12242-000". Só formata; quem recusa é quem valida. */
export function maskCep(v: string | null | undefined): string {
  const d = String(v || "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
}

export function digitos(v: string | null | undefined): string {
  return String(v || "").replace(/\D/g, "");
}

/** O WhatsApp só serve com DDD: 10 ou 11 dígitos. */
export function whatsappCompleto(v: string | null | undefined): boolean {
  const n = digitos(v).length;
  return n === 10 || n === 11;
}

/**
 * E-mail opcional, validado sem regex — a mesma regra da Negócio
 * (isValidEmailFront): um @ no meio e um ponto depois dele.
 */
export function emailValido(s: string | null | undefined): boolean {
  const t = String(s || "").trim();
  if (!t) return true;
  if (t.length < 5) return false;
  const at = t.indexOf("@");
  if (at <= 0 || at !== t.lastIndexOf("@") || at === t.length - 1) return false;
  const dot = t.indexOf(".", at + 1);
  if (dot === -1 || dot === t.length - 1 || dot === at + 1) return false;
  return !/\s/.test(t);
}

export type SituacaoDoDocumento = "vazio" | "incompleto" | "invalido" | "cpf" | "cnpj";

/**
 * CPF ou CNPJ, pelo tamanho, com o dígito verificador (mod 11, o mesmo
 * de validateCpfCnpj no backend). "incompleto" é quem ainda está
 * digitando; "invalido" é número completo com dígito errado.
 */
export function situacaoDoDocumento(v: string | null | undefined): SituacaoDoDocumento {
  const d = digitos(v);
  if (!d) return "vazio";
  if (d.length < 11 || (d.length > 11 && d.length < 14)) return "incompleto";
  if (d.length === 11) return validateCpf(d) ? "cpf" : "invalido";
  if (d.length === 14) return validateCnpj(d) ? "cnpj" : "invalido";
  return "invalido";
}

/** Máscara que escolhe sozinha: até 11 dígitos CPF, acima CNPJ. */
export function maskDocumento(v: string | null | undefined): string {
  const d = digitos(v).slice(0, 14);
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** O que falta, e em qual campo o toque do botão deve pousar. */
export type Falta = { texto: string; campo: string };

// ── Etapa 1 · Seus dados ─────────────────────────────────────

export type DadosDaEtapa1 = {
  nome: string;
  whatsapp: string;
  email: string;
  querDocumento: boolean;
  documento: string;
};

export function faltaNosDados(d: DadosDaEtapa1): Falta | null {
  if (!String(d.nome || "").trim()) return { texto: "Falta seu nome", campo: "nome" };
  if (!digitos(d.whatsapp)) return { texto: "Falta seu WhatsApp", campo: "whatsapp" };
  if (!whatsappCompleto(d.whatsapp)) return { texto: "Confira o WhatsApp com DDD", campo: "whatsapp" };
  if (!emailValido(d.email)) return { texto: "Confira o e-mail", campo: "email" };
  if (d.querDocumento) {
    const s = situacaoDoDocumento(d.documento);
    if (s === "vazio") return { texto: "Falta o CPF ou CNPJ", campo: "documento" };
    if (s === "incompleto" || s === "invalido") return { texto: "Confira o CPF ou CNPJ", campo: "documento" };
  }
  return null;
}

/** A frase embaixo do campo de CPF/CNPJ, ou null quando não há o que dizer. */
export function avisoDoDocumento(v: string | null | undefined): { texto: string; ok: boolean } | null {
  const s = situacaoDoDocumento(v);
  if (s === "cpf") return { texto: "CPF válido", ok: true };
  if (s === "cnpj") return { texto: "CNPJ válido", ok: true };
  if (s === "invalido") return { texto: "Esse número não fecha. Confira os dígitos.", ok: false };
  return null;
}

// ── Etapa 2 · Entrega ────────────────────────────────────────

export type ModoDeEntrega = { tipo: DeliveryType; titulo: string };

/**
 * Os modos que a loja oferece, na ordem do mockup. Sem o bloco `delivery`
 * no payload (backend anterior ao S8) caem retirada e entrega, que era o
 * comportamento fixo — loja em versão velha não fica sem opção.
 */
export function modosDeEntrega(delivery: any): ModoDeEntrega[] {
  const d = delivery;
  const out: ModoDeEntrega[] = [];
  if (!d || d.pickup_enabled) out.push({ tipo: "pickup", titulo: "Retirar na loja" });
  if (!d || d.delivery_enabled) out.push({ tipo: "delivery", titulo: "Receber em casa" });
  if (d?.courier_pickup_enabled) out.push({ tipo: "courier", titulo: "Retirada por app" });
  return out;
}

export type DadosDaEtapa2 = {
  tipo: DeliveryType | null;
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  foraDaArea: boolean;
  cotando: boolean;
  buscandoCep: boolean;
  courierNome: string;
  courierPlaca: string;
  informarDepois: boolean;
};

export function faltaNaEntrega(d: DadosDaEtapa2): Falta | null {
  if (!d.tipo) return { texto: "Escolha como receber", campo: "entrega" };
  if (d.tipo === "delivery") {
    if (digitos(d.cep).length !== 8) return { texto: "Falta o CEP da entrega", campo: "cep" };
    if (d.buscandoCep) return { texto: "Buscando o endereço…", campo: "cep" };
    if (d.foraDaArea) return { texto: "Esse CEP está fora da área", campo: "cep" };
    if (!String(d.rua || "").trim()) return { texto: "Falta a rua", campo: "rua" };
    if (!String(d.numero || "").trim()) return { texto: "Falta o número da casa", campo: "numero" };
    if (!String(d.bairro || "").trim()) return { texto: "Falta o bairro", campo: "bairro" };
    if (!String(d.cidade || "").trim()) return { texto: "Falta a cidade", campo: "cidade" };
    if (String(d.uf || "").trim().length !== 2) return { texto: "Falta o estado (UF)", campo: "uf" };
    if (d.cotando) return { texto: "Calculando o frete…", campo: "cep" };
  }
  if (d.tipo === "courier" && !d.informarDepois) {
    if (!String(d.courierNome || "").trim()) return { texto: "Falta quem vai buscar", campo: "courierNome" };
    if (!normalizePlate(d.courierPlaca)) return { texto: "Confira a placa do veículo", campo: "courierPlaca" };
  }
  return null;
}

// ── Etapa 3 · Pagamento ──────────────────────────────────────

/**
 * As formas de pagar desta loja, para este modo de entrega. "Pagar na
 * retirada" é escolha da lojista (decisão do PO) e vira "Pagar na
 * entrega" em casa; some na retirada por app, onde quem aparece na loja é
 * o entregador, não a cliente.
 */
export function formasDePagamento(
  payment: { has_pix?: boolean; has_card?: boolean; pay_on_delivery_enabled?: boolean } | null | undefined,
  tipo: DeliveryType | null,
): Array<{ forma: FormaDePagamento; titulo: string }> {
  const p = payment || {};
  const out: Array<{ forma: FormaDePagamento; titulo: string }> = [];
  if (p.has_pix) out.push({ forma: "pix", titulo: "Pix" });
  if (p.has_card) out.push({ forma: "card", titulo: "Cartão de crédito" });
  if (p.pay_on_delivery_enabled && tipo !== "courier") {
    out.push({ forma: "on_delivery", titulo: tipo === "delivery" ? "Pagar na entrega" : "Pagar na retirada" });
  }
  return out;
}

/** O rótulo do botão da etapa 3: o total, ou o que falta. */
export function botaoDoPagamento(forma: FormaDePagamento | null, total: string): string {
  if (forma === "pix") return `Pagar ${total} no Pix`;
  if (forma === "card") return `Pagar ${total} no cartão`;
  if (forma === "on_delivery") return `Fazer pedido · ${total}`;
  return "Escolha como pagar";
}

/**
 * A frase da política de revisões, acima do botão (JORNADA §4.6, a
 * terceira diferença do Studio). `max_included` 0 é "ilimitado".
 */
export function fraseDasRevisoes(rev: { max_included?: number; extra_price?: number } | null | undefined): string {
  const n = Math.max(0, Math.floor(Number(rev?.max_included) || 0));
  if (n === 0) return "Você aprova o mockup antes de produzir.";
  return `Você aprova o mockup antes de produzir. ${n} ${n === 1 ? "revisão inclusa" : "revisões inclusas"}.`;
}

/** "3 dias úteis" / "1 dia útil". */
export function diasUteis(n: number | null | undefined): string {
  const d = Math.max(0, Math.round(Number(n) || 0));
  return d === 1 ? "1 dia útil" : `${d} dias úteis`;
}
