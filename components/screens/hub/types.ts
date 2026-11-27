// ============================================================
// Hub Social / Aurinha — metadados visuais compartilhados.
// Segue o mockup aprovado em 30/08/2026 (artifact "Aura Atende"):
// canal é filtro (badge no avatar), status diz quem está no comando,
// categoria é a triagem automática com correção manual.
// ============================================================
import { Colors } from "@/constants/colors";
import type { HubCategory, HubChannel, HubStatus, HubMessage } from "@/services/hubApi";
import { formatarTelefone } from "@/utils/telefone";

export const CHANNEL_META: Record<HubChannel, { label: string; color: string; short: string }> = {
  instagram:  { label: "Instagram",    color: "#d6249f", short: "IG" },
  whatsapp:   { label: "WhatsApp",     color: "#25d366", short: "WA" },
  storefront: { label: "Loja virtual", color: Colors.violet, short: "LV" },
};

export const STATUS_META: Record<HubStatus, { label: string; color: string }> = {
  ia:             { label: "IA atendendo",    color: Colors.violet3 },
  precisa_humano: { label: "Precisa de você", color: Colors.amber },
  humano:         { label: "Você no comando", color: Colors.green },
  resolvida:      { label: "Resolvida",       color: Colors.ink3 },
};

export const CATEGORY_META: Record<HubCategory, { label: string; color: string }> = {
  produto:   { label: "Produto",   color: Colors.violet3 },
  troca:     { label: "Troca",     color: Colors.amber },
  entrega:   { label: "Entrega",   color: "#60a5fa" },
  pagamento: { label: "Pagamento", color: Colors.green },
  novidades: { label: "Novidades", color: "#f472b6" },
};

export const CATEGORIES: HubCategory[] = ["produto", "troca", "entrega", "pagamento", "novidades"];

/**
 * Quem está no comando, só quando NÃO é o usuário logado: a Aurinha ("Aurinha" no
 * cabeçalho, "Aurinha atendendo" na lista) ou OUTRO usuário ("Com <nome>", ou
 * "Com outra pessoa" se o nome não vier). Com você: null, nada na tela.
 */
export function quemAtende(
  conv: { status: string; assigned_user_id?: string | null; assigned_user_name?: string | null },
  meuId: string | null | undefined,
  aurinhaLigada: boolean,
  longo = false,
): { rotulo: string; cor: string } | null {
  if (conv.status === "ia") return aurinhaLigada ? { rotulo: longo ? "Aurinha atendendo" : "Aurinha", cor: Colors.violet3 } : null;
  if (conv.assigned_user_id && meuId && conv.assigned_user_id !== meuId) {
    const nome = (conv.assigned_user_name || "").trim();
    return { rotulo: nome ? `Com ${nome}` : "Com outra pessoa", cor: Colors.amber };
  }
  return null;
}

/** Horas restantes da janela de 24h da Meta; null = janela fechada/desconhecida. */
export function windowHoursLeft(lastInboundAt: string | null): number | null {
  if (!lastInboundAt) return null;
  const left = 24 - (Date.now() - new Date(lastInboundAt).getTime()) / 3600000;
  return left > 0 ? left : null;
}

/**
 * "amanhã, 10h15": até quando a conversa fica aberta (24 h depois da última
 * mensagem do cliente). null = fechada ou desconhecida.
 */
export function conversaAbertaAte(lastInboundAt: string | null, agora: Date = new Date()): string | null {
  if (!lastInboundAt) return null;
  const fim = new Date(new Date(lastInboundAt).getTime() + 24 * 3600000);
  if (isNaN(fim.getTime()) || fim.getTime() <= agora.getTime()) return null;
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((dia(fim) - dia(agora)) / 86400000);
  const quando = diff <= 0 ? "hoje" : diff === 1 ? "amanhã" : fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const hora = `${fim.getHours()}h${fim.getMinutes() ? String(fim.getMinutes()).padStart(2, "0") : ""}`;
  return `${quando}, ${hora}`;
}

/** "14:32" hoje, "ontem", "seg", "12/08" — curto, padrão de inbox. */
export function shortTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Nome exibível: customer_name > @external_id truncado. */
export function displayName(name: string | null, externalId: string): string {
  if (name && name.trim()) return name.trim();
  return `Cliente ${externalId.slice(-4)}`;
}

/** Contato na thread: nome, ou o telefone no WhatsApp (external_id é o número). */
export function nomeDoContato(conv: { customer_name: string | null; external_id: string; channel: HubChannel }): string {
  if (conv.customer_name && conv.customer_name.trim()) return conv.customer_name.trim();
  if (conv.channel === "whatsapp") return formatarTelefone(conv.external_id) || displayName(null, conv.external_id);
  return displayName(null, conv.external_id);
}

/**
 * Rótulo do autor da bolha. Com `author` (hub_messages, WhatsApp) vale o
 * que o backend gravou: o eco do celular vem como 'humano'. Sem ele
 * (Instagram), o critério antigo por direção + source_type.
 */
export function rotuloDoAutor(
  m: Pick<HubMessage, "direction" | "source_type" | "author">,
  conv: { customer_name: string | null; external_id: string; channel: HubChannel },
): string | null {
  if (m.author === "cliente") return nomeDoContato(conv);
  if (m.author === "humano") return "EQUIPE";
  if (m.author === "aurinha") return "AURINHA";
  if (m.direction !== "outbound") return null;
  return m.source_type === "humano" ? "VOCÊ" : "AURINHA";
}
