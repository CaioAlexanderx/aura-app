// ============================================================
// Hub Social / Aurinha — metadados visuais compartilhados.
// Segue o mockup aprovado em 30/08/2026 (artifact "Aura Atende"):
// canal é filtro (badge no avatar), status diz quem está no comando,
// categoria é a triagem automática com correção manual.
// ============================================================
import { Colors } from "@/constants/colors";
import type { HubCategory, HubChannel, HubStatus } from "@/services/hubApi";

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

/** Horas restantes da janela de 24h da Meta; null = janela fechada/desconhecida. */
export function windowHoursLeft(lastInboundAt: string | null): number | null {
  if (!lastInboundAt) return null;
  const left = 24 - (Date.now() - new Date(lastInboundAt).getTime()) / 3600000;
  return left > 0 ? left : null;
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
