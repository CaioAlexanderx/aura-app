// ============================================================
// Gestão Aura — etapa da conta no ciclo de vida.
//
// billing_status fica "trial" para sempre no banco, então a lista juntava
// quem acabou de se cadastrar, quem venceu ontem e quem nunca aderiu. A
// etapa vem calculada do backend (src/services/clientLifecycle.js); o
// cálculo daqui é só o fallback para um backend que ainda não a devolve.
// ============================================================

export type Stage = "trial" | "vencido" | "cliente" | "arquivo" | "interno";
export type Tone = "red" | "amber" | "neutral" | "muted";

export type LifecycleClient = {
  stage?: Stage;
  archive_reason?: "nao_aderiu" | "cancelado" | "inativo" | null;
  billing_status: string;
  is_active: boolean;
  created_at: string;
  trial_ends_at: string | null;
  owner_phone?: string | null;
  prod_count?: number;
  sale_count?: number;
  cust_count?: number;
  login_days?: number;
  last_login_at?: string | null;
  health_score?: number | null;
};

var DAY_MS = 86400000;
var HOUR_MS = 3600000;
export var RECOVERY_WINDOW_DAYS = 14;
export var NEW_ACCOUNT_DAYS = 2;

export var STAGE_TABS: Array<{ key: Stage; label: string; empty: string }> = [
  { key: "trial",   label: "Em trial",  empty: "Nenhuma conta em trial agora" },
  { key: "vencido", label: "Vencidos",  empty: "Nenhum trial vencido nos últimos " + RECOVERY_WINDOW_DAYS + " dias" },
  { key: "cliente", label: "Clientes",  empty: "Nenhum cliente ativo" },
  { key: "arquivo", label: "Arquivo",   empty: "Nada arquivado" },
  { key: "interno", label: "Internos",  empty: "Nenhuma conta interna" },
];

export function stageOf(c: LifecycleClient, now: number = Date.now()): Stage {
  if (c.stage) return c.stage;
  if (c.is_active === false || c.billing_status === "cancelled") return "arquivo";
  if (["active", "pending", "overdue"].indexOf(c.billing_status) >= 0) return "cliente";
  var ends = c.trial_ends_at ? new Date(c.trial_ends_at).getTime() : null;
  if (ends !== null && ends > now) return "trial";
  var ref = ends !== null ? ends : new Date(c.created_at).getTime();
  return (now - ref) / DAY_MS <= RECOVERY_WINDOW_DAYS ? "vencido" : "arquivo";
}

function plural(n: number, one: string, many: string): string {
  return n + " " + (n === 1 ? one : many);
}

// Contagem regressiva do trial: número grande + unidade, e o tom da urgência.
export function trialCountdown(c: LifecycleClient, now: number = Date.now()): { value: string; unit: string; tone: Tone } {
  var ends = c.trial_ends_at ? new Date(c.trial_ends_at).getTime() : new Date(c.created_at).getTime();
  var diff = ends - now;
  if (diff > 0) {
    if (diff < DAY_MS) return { value: String(Math.max(1, Math.ceil(diff / HOUR_MS))), unit: "horas", tone: "red" };
    var days = Math.ceil(diff / DAY_MS);
    return { value: String(days), unit: days === 1 ? "dia" : "dias", tone: days <= 3 ? "amber" : "neutral" };
  }
  var since = Math.floor(-diff / DAY_MS);
  if (since === 0) return { value: "hoje", unit: "venceu", tone: "red" };
  return { value: String(since) + "d", unit: "vencido", tone: since <= 3 ? "red" : "muted" };
}

export function isNewAccount(c: LifecycleClient, now: number = Date.now()): boolean {
  return (now - new Date(c.created_at).getTime()) / DAY_MS <= NEW_ACCOUNT_DAYS;
}

// "138 produtos · 4 dias de uso" — ou "só cadastrou" quando não há nada.
export function usageSummary(c: LifecycleClient): { text: string; engaged: boolean } {
  var parts: string[] = [];
  if ((c.prod_count || 0) > 0) parts.push(plural(c.prod_count || 0, "produto", "produtos"));
  if ((c.sale_count || 0) > 0) parts.push(plural(c.sale_count || 0, "venda", "vendas"));
  if ((c.cust_count || 0) > 0) parts.push(plural(c.cust_count || 0, "cliente", "clientes"));
  var days = c.login_days || 0;
  if (days > 1) parts.push(plural(days, "dia", "dias") + " de uso");
  var engaged = days > 1 || (c.sale_count || 0) > 0 || (c.prod_count || 0) >= 10;
  if (parts.length === 0) return { text: "só cadastrou", engaged: false };
  return { text: parts.join(" · "), engaged: engaged };
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  var d = new Date(iso);
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
}

export function archiveLabel(c: LifecycleClient, now: number = Date.now()): string {
  if (c.archive_reason === "cancelado" || c.billing_status === "cancelled") return "Cancelou";
  if (c.archive_reason === "inativo" || c.is_active === false) return "Desativada";
  var ref = c.trial_ends_at || c.created_at;
  return "Não aderiu · trial venceu em " + shortDate(ref) + " (" + plural(Math.floor((now - new Date(ref).getTime()) / DAY_MS), "dia", "dias") + ")";
}

// Ordem dentro de cada etapa: trial pelo que vence primeiro, vencido e
// arquivo pelo mais recente, cliente pelo pior health (como já era).
export function sortForStage<T extends LifecycleClient>(list: T[], stage: Stage): T[] {
  var time = function(iso: string | null | undefined) { return iso ? new Date(iso).getTime() : 0; };
  var ref = function(c: T) { return time(c.trial_ends_at || c.created_at); };
  var out = list.slice();
  if (stage === "trial") out.sort(function(a, b) { return ref(a) - ref(b); });
  else if (stage === "vencido" || stage === "arquivo") out.sort(function(a, b) { return ref(b) - ref(a); });
  else if (stage === "cliente") out.sort(function(a, b) {
    var ha = a.health_score == null ? Infinity : a.health_score;
    var hb = b.health_score == null ? Infinity : b.health_score;
    return ha !== hb ? ha - hb : time(b.created_at) - time(a.created_at);
  });
  return out;
}

export function waLink(phone: string | null | undefined): string | null {
  var digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length <= 11) digits = "55" + digits;
  return "https://wa.me/" + digits;
}

// Faixa de resumo no topo da lista.
export function lifecycleSummary(list: LifecycleClient[], now: number = Date.now()) {
  var trial = list.filter(function(c) { return stageOf(c, now) === "trial"; });
  return {
    trial: trial.length,
    expiring: trial.filter(function(c) { return new Date(c.trial_ends_at || c.created_at).getTime() - now <= 3 * DAY_MS; }).length,
    expired: list.filter(function(c) { return stageOf(c, now) === "vencido"; }).length,
    newThisWeek: list.filter(function(c) {
      var st = stageOf(c, now);
      return st !== "interno" && (now - new Date(c.created_at).getTime()) / DAY_MS <= 7;
    }).length,
  };
}
