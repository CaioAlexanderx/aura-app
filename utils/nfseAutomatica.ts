// ============================================================
// AURA. — NFS-e automática: regras puras do app (10/11/2026)
//
// Mockup aprovado: docs/mockups/nfse-cadastro-servico.html, telas 3 a 5.
// Decisões do dono:
//   1. A NFS-e sai sozinha (backend). Com nota emitida o app só mostra
//      "Imprimir 2ª via"; "Emitir NFS-e" só aparece em falha ou pendência.
//   2. Venda com serviço numa loja com a emissão automática ligada EXIGE o
//      CPF ou CNPJ de quem contratou, com dígito verificador. Venda só de
//      produto: o "CPF na nota (opcional)" de sempre.
//   3. Venda mista: NFC-e só dos produtos e NFS-e dos serviços.
//   4. Serviço sem código: a venda fecha e a NFS-e fica "com problema", com
//      atalho para o cadastro do serviço.
//
// "Serviço" aqui = item que sai na NFS-e: utils/notaDoItem.vaiNaNfse (o "Sai
// em" do cadastro; sem escolha, unit 'srv') — a mesma regra do backend.
// ============================================================

import { onlyDigits, validateCpf, validateCnpj, maskCpf, maskCnpj } from "@/lib/validators";
import { vaiNaNfse, type ItemComNota } from "@/utils/notaDoItem";
import type {
  AcaoDaOrigemNfse, EstadoDaOrigemNfse, NotaDaOrigemNfse, SituacaoNfse,
} from "@/services/nfseAutomaticaApi";

export const WHATSAPP_SUPORTE = "5511956305269";
export const WHATSAPP_SUPORTE_ROTULO = "(11) 95630-5269";
export const LINK_WHATSAPP_SUPORTE = "https://wa.me/" + WHATSAPP_SUPORTE;
export const TEXTO_AJUDA_FISCAL = "Em caso de dúvidas, acione seu contador ou o suporte Aura";

// ── composição da venda ──────────────────────────────────────

/** O item vai na NFS-e (o nome ficou: os chamadores leem "é serviço da nota"). */
export function ehServico(item: ItemComNota): boolean {
  return vaiNaNfse(item);
}

export function composicaoDaVenda(items: Array<NonNullable<ItemComNota>> | null | undefined) {
  const lista = items || [];
  const temServico = lista.some(ehServico);
  const temProduto = lista.some((i) => !ehServico(i));
  return { temServico, temProduto, mista: temServico && temProduto };
}

/** O Caixa só exige o tomador com serviço no carrinho E a emissão ligada. */
export function exigeTomador(p: { temServico: boolean; nfseAtiva: boolean }): boolean {
  return !!p.temServico && !!p.nfseAtiva;
}

/** Aviso do carrinho sobre as notas que a venda gera (null = sem aviso). */
export function avisoDasNotas(p: { temServico: boolean; temProduto: boolean; nfseAtiva: boolean; nfceAutomatica: boolean }): string | null {
  if (!p.nfseAtiva || !p.temServico) return null;
  if (p.temProduto) {
    return p.nfceAutomatica
      ? "Esta venda sai em duas notas: o cupom fiscal (NFC-e) dos produtos e a nota de serviço (NFS-e) do serviço. As duas saem sozinhas ao finalizar."
      : "Esta venda sai em duas notas: o cupom fiscal (NFC-e) dos produtos e a nota de serviço (NFS-e) do serviço. A nota de serviço sai sozinha ao finalizar.";
  }
  return "Ao finalizar, a nota de serviço (NFS-e) sai sozinha.";
}

// ── documento de quem contratou ──────────────────────────────

export type EstadoDoDoc = "vazio" | "incompleto" | "cpf" | "cnpj" | "invalido";

/** CPF até 11 números; do 12º em diante, CNPJ. */
export function mascararDoc(v: string | null | undefined): string {
  const d = onlyDigits(v).slice(0, 14);
  return d.length > 11 ? maskCnpj(d) : maskCpf(d);
}

export function estadoDoDoc(v: string | null | undefined): EstadoDoDoc {
  const d = onlyDigits(v);
  if (!d.length) return "vazio";
  if (d.length < 11) return "incompleto";
  if (d.length === 11) return validateCpf(d) ? "cpf" : "invalido";
  if (d.length < 14) return "incompleto";
  return validateCnpj(d) ? "cnpj" : "invalido";
}

export function docValido(v: string | null | undefined): boolean {
  const e = estadoDoDoc(v);
  return e === "cpf" || e === "cnpj";
}

/** Frase sob o campo (textos do mockup, tela 3). */
export function mensagemDoDoc(v: string | null | undefined, opts: { temProduto: boolean }): { tom: "neutro" | "ok" | "erro"; texto: string } {
  const e = estadoDoDoc(v);
  const d = onlyDigits(v);
  if (e === "cpf") return { tom: "ok", texto: "CPF confere. Vai na nota de serviço" + (opts.temProduto ? " e no cupom fiscal." : ".") };
  if (e === "cnpj") return { tom: "ok", texto: "CNPJ confere. A nota sai no nome da empresa." };
  if (e === "invalido") {
    return { tom: "erro", texto: "Esse " + (d.length === 11 ? "CPF" : "CNPJ") + " não confere — algum número pode ter trocado de lugar. Confira com o cliente." };
  }
  if (e === "incompleto") {
    const falta = d.length < 11 ? 11 - d.length : 14 - d.length;
    const qtd = falta === 1 ? "Falta 1 número" : "Faltam " + falta + " números";
    return { tom: "neutro", texto: qtd + (d.length < 11 ? " para o CPF." : " para o CNPJ.") };
  }
  return { tom: "neutro", texto: "CPF tem 11 números; CNPJ, 14. Pode digitar só os números." };
}

/** Rótulo do aviso do rodapé quando falta o documento (null = não falta). */
export function pendenciaDoDoc(v: string | null | undefined): string | null {
  const e = estadoDoDoc(v);
  if (e === "cpf" || e === "cnpj") return null;
  return e === "invalido" ? "Confira o CPF ou CNPJ do cliente" : "Falta o CPF ou CNPJ do cliente";
}

/** Rótulo da linha "CPF na nota" da tela final. */
export function rotuloDoDoc(doc: string): string {
  return onlyDigits(doc).length === 14 ? "CNPJ na nota" : "CPF na nota";
}

// ── situação da origem ───────────────────────────────────────

const FINAIS: EstadoDaOrigemNfse[] = ["emitida", "erro", "pendente_dados", "cancelada"];

/** Estados em que o polling para. 'nenhuma' e 'emitindo' seguem. */
export function ehEstadoFinal(estado: EstadoDaOrigemNfse | null | undefined): boolean {
  return !!estado && FINAIS.indexOf(estado) >= 0;
}

/** Intervalo do polling leve: 1,5 s, 2 s, 3 s, 5 s, 8 s e daí 12 s. */
const INTERVALOS = [1500, 2000, 3000, 5000, 8000];
export function intervaloDoPolling(tentativa: number): number {
  return tentativa < INTERVALOS.length ? INTERVALOS[tentativa] : 12000;
}
/** ~2 minutos de polling; depois a tela oferece "Atualizar". */
export const MAX_TENTATIVAS_POLLING = 14;

/** Motivos que um CPF/CNPJ (e o nome) resolvem. */
export function faltaTomador(s: SituacaoNfse | null | undefined): boolean {
  if (!s || s.estado !== "pendente_dados") return false;
  return s.notas.some((n) => n.estado === "pendente_dados"
    && (n.motivo_codigo === "SEM_TOMADOR" || n.motivo_codigo === "TOMADOR_INVALIDO" || n.motivo_codigo === "SEM_NOME" || !n.motivo_codigo));
}

export function faltaSoONome(s: SituacaoNfse | null | undefined): boolean {
  if (!s || s.estado !== "pendente_dados") return false;
  const pend = s.notas.filter((n) => n.estado === "pendente_dados");
  return pend.length > 0 && pend.every((n) => n.motivo_codigo === "SEM_NOME");
}

export function semCodigo(s: SituacaoNfse | null | undefined): boolean {
  return !!s && (s.acao === "cadastrar_codigo" || s.notas.some((n) => n.motivo_codigo === "SEM_CODIGO"));
}

/** A primeira frase de problema das notas (o backend já escreve para a lojista). */
export function motivoDaSituacao(s: SituacaoNfse | null | undefined): string | null {
  if (!s) return null;
  const n = s.notas.find((x) => x.estado !== "emitida" && !!x.motivo);
  return n ? n.motivo : null;
}

export function notasEmitidas(s: SituacaoNfse | null | undefined): NotaDaOrigemNfse[] {
  return s ? s.notas.filter((n) => n.estado === "emitida" && !!n.nfse_id) : [];
}

/** "nº 312" ou "nº 312 e 313" (venda com dois códigos de serviço). */
export function numerosDasNotas(s: SituacaoNfse | null | undefined): string {
  const ns = notasEmitidas(s).map((n) => n.nfse_number).filter((x) => x != null && String(x) !== "").map(String);
  if (!ns.length) return "";
  return "nº " + (ns.length === 1 ? ns[0] : ns.slice(0, -1).join(", ") + " e " + ns[ns.length - 1]);
}

/**
 * O que a linha da NFS-e oferece nas telas de detalhe (OS, venda, cobrança).
 * Regra do dono: nota emitida → só a 2ª via; "Emitir NFS-e" só em falha ou
 * pendência; 'nenhuma' (sem serviço, anterior ao opt-in ou loja que não
 * emite) → nada, para a tela ficar como antes.
 */
export type BotaoDaNfse = "nada" | "aguardar" | "segunda_via" | "emitir" | "completar_e_emitir" | "cadastrar_codigo";

export function botaoDaNfse(s: SituacaoNfse | null | undefined): BotaoDaNfse {
  if (!s) return "nada";
  if (s.tem_nota && s.estado === "emitida") return "segunda_via";
  const mapa: Record<AcaoDaOrigemNfse, BotaoDaNfse> = {
    emitir: "emitir",
    aguardar: "aguardar",
    completar_dados: "completar_e_emitir",
    tentar_de_novo: "emitir",
    imprimir_2a_via: "segunda_via",
    cadastrar_codigo: "cadastrar_codigo",
  };
  if (s.estado === "nenhuma") return "nada";
  return mapa[s.acao] || "nada";
}

/** Qual POST o "Emitir NFS-e" usa: erro/rejeitada/cancelada pedem nova tentativa. */
export function rotaDoEmitir(s: SituacaoNfse | null | undefined): "emitir" | "tentar_de_novo" {
  if (!s) return "emitir";
  return s.estado === "erro" || s.estado === "cancelada" ? "tentar_de_novo" : "emitir";
}

// ── NFC-e de venda só de serviço (Aura-backend#983) ──────────

export const TEXTO_NFCE_SO_SERVICO = "Venda só de serviços: a nota de serviço sai separada.";

/** POST /nfce/emit devolveu 200 sem nota porque a venda é só de serviço. */
export function nfcePulada(res: any): boolean {
  return !!res && res.skipped === true && !res.nfce;
}

/** Frase da venda mista: os serviços ficaram fora do cupom fiscal. */
export function textoServicosForaDaNfce(res: any): string | null {
  const f = res && res.servicos_fora_da_nfce;
  if (!f || !(Number(f.itens) > 0)) return null;
  const n = Number(f.itens);
  return (n === 1 ? "O serviço ficou" : "Os " + n + " serviços ficaram") + " fora do cupom fiscal: " + (n === 1 ? "sai" : "saem") + " na nota de serviço (NFS-e).";
}

/** Mensagem curta de WhatsApp da NFS-e emitida (sem link autenticado). */
export function mensagemWhatsAppDaNfse(p: { numero: string; total: number; chave?: string | null }): string {
  const tot = (p.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  return "Olá! Sua nota de serviço (NFS-e) " + p.numero + " (R$ " + tot + ") foi emitida."
    + (p.chave ? " Chave de acesso: " + p.chave + "." : "")
    + " Consulte em https://www.nfse.gov.br/consultapublica";
}
