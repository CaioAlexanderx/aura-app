// ============================================================
// AURA. — WhatsApp da pessoa na etapa 3 do cadastro (tq-69, 26/10/2026)
//
// Porta de entrada 4/6. O que mora aqui (puro, testável):
//   · máscara do mockup "(11) 9 1234-5678" e a conferência do celular
//     (11 dígitos, 9 depois do DDD), com as dicas do mockup final;
//   · a mensagem pronta do wa.me com o código AURA-XXXX que o backend
//     devolve no cadastro (whatsapp_handshake.codigo, backend#886). O número
//     da Aura vem da constante central (constants/suporteAura);
//   · o texto do estado no crachá do verso. Nunca "confirmado" na criação:
//     o handshake nasce 'aguardando' e só a equipe (ou o webhook, quando o
//     número entrar na API) confirma. Sem confirmação falsa.
//
// O backend valida de novo (DDD da Anatel, fixo recusado) e responde 400
// com code WHATSAPP_* e field 'whatsapp' quando a obrigatoriedade está
// ligada (WHATSAPP_OBRIGATORIO_NO_CADASTRO).
// ============================================================
import { waAura } from "@/constants/suporteAura";

export const soDigitos = (v: string) => (v || "").replace(/\D/g, "");

/** "11912345678" → "(11) 9 1234-5678", aos pedaços enquanto digita (maskZap do mockup). */
export function mascaraDoZap(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? "(" + d : "";
  const ddd = "(" + d.slice(0, 2) + ") ";
  if (d.length <= 3) return ddd + d.slice(2);
  if (d.length <= 7) return ddd + d[2] + " " + d.slice(3);
  return ddd + d[2] + " " + d.slice(3, 7) + "-" + d.slice(7);
}

export type ConferenciaDoZap = { ok: boolean; tipo: "vazio" | "curto" | "fixo" | "sem9" | "ok" };

export function conferirZap(digitos: string): ConferenciaDoZap {
  const d = soDigitos(digitos);
  if (!d) return { ok: false, tipo: "vazio" };
  if (d.length === 10) return { ok: false, tipo: "fixo" };
  if (d.length < 11) return { ok: false, tipo: "curto" };
  if (d[2] !== "9") return { ok: false, tipo: "sem9" };
  return { ok: true, tipo: "ok" };
}

/** Dicas do mockup final (Porta de entrada v4). */
export const DICAS_DO_ZAP = {
  padrao: "Celular com DDD. O 9 na frente a gente confere.",
  fixo: "Esse parece um fixo. Precisa ser celular com WhatsApp, com o 9 na frente.",
  sem9: "Celular começa com 9 depois do DDD.",
  ok: "Boa. É esse que vai tocar.",
} as const;

export function dicaDoZap(c: ConferenciaDoZap): { kind?: "ok" | "err"; texto: string } {
  if (c.tipo === "fixo") return { kind: "err", texto: DICAS_DO_ZAP.fixo };
  if (c.tipo === "sem9") return { kind: "err", texto: DICAS_DO_ZAP.sem9 };
  if (c.tipo === "ok") return { kind: "ok", texto: DICAS_DO_ZAP.ok };
  return { texto: DICAS_DO_ZAP.padrao };
}

/** Mensagem pronta do card: "Oi, Aura! Meu código é AURA-XXXX". */
export function mensagemDoHandshake(codigo: string | null | undefined): string {
  return codigo ? "Oi, Aura! Meu código é " + codigo : "Oi, Aura! Acabei de criar minha conta.";
}

export function linkDoHandshake(codigo: string | null | undefined): string {
  return waAura(mensagemDoHandshake(codigo));
}

/** O código que o backend devolveu, se tiver o formato AURA-XXXX. */
export function codigoDoCadastro(resposta: unknown): string | null {
  const h = resposta && typeof resposta === "object" ? (resposta as any).whatsapp_handshake : null;
  const c = h && typeof h.codigo === "string" ? h.codigo.trim().toUpperCase() : "";
  return /^AURA-[A-Z0-9]{4}$/.test(c) ? c : null;
}

/**
 * Estado do número no crachá do verso.
 * - "aguardando": abriu o WhatsApp; espera a mensagem chegar;
 * - "a_confirmar": "Sem WhatsApp agora" (ou dojô, que não tem código).
 */
export type EstadoDoZap = "aguardando" | "a_confirmar";
export function textoDoEstado(e: EstadoDoZap): string {
  return e === "aguardando" ? "aguardando sua mensagem" : "a confirmar";
}

// ── Faixa do Painel (tq-115, 26/10/2026) ─────────────────────
// O /auth/me devolve `whatsapp_handshake` ao dono (backend tq-115, no
// formato do register). O Painel lê uma vez ao abrir e mostra a faixa
// discreta enquanto o número não está confirmado. No banco o estado é
// 'aguardando' ou 'confirmado'; o "a confirmar" do verso do cadastro é o
// mesmo 'aguardando' (a pessoa só não abriu o WhatsApp naquela hora).

export type HandshakeDoMe = { codigo: string | null; estado: "aguardando" | "confirmado" };

/** O handshake do /auth/me, ou null (membro, sem handshake, formato estranho). */
export function handshakeDoMe(resposta: unknown): HandshakeDoMe | null {
  const h = resposta && typeof resposta === "object" ? (resposta as any).whatsapp_handshake : null;
  if (!h || typeof h !== "object") return null;
  if (h.estado !== "aguardando" && h.estado !== "confirmado") return null;
  return { codigo: codigoDoCadastro(resposta), estado: h.estado };
}

export const TEXTOS_ZAP_NO_PAINEL = {
  titulo: "Seu WhatsApp ainda não foi confirmado",
  sub: (codigo: string | null) => (codigo
    ? "Mande o código " + codigo + " para a Aura e a gente confirma por lá."
    : "Mande um oi para a Aura e a gente confirma por lá."),
  botao: "Abrir WhatsApp",
};
