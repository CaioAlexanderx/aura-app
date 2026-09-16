// ─── CRM Comercial — Constantes ──────────────────────────────────────────────
import { Colors } from "@/constants/colors";
import type { LeadStatus, LeadChannel, ExpectedPlan } from "@/services/crmApi";

export type StatusMeta = { key: LeadStatus; label: string; color: string };

export const STATUSES: StatusMeta[] = [
  { key: "new",        label: "Novo",        color: Colors.ink3 },
  { key: "contacted",  label: "Contatado",   color: Colors.amber },
  { key: "responded",  label: "Respondeu",   color: "#06b6d4" },
  { key: "interested", label: "Interessado", color: Colors.violet3 },
  { key: "demo",       label: "Demo",        color: Colors.green },
  { key: "converted",  label: "Convertido",  color: Colors.green },
  { key: "lost",       label: "Perdido",     color: Colors.red },
];

export const CHANNELS: LeadChannel[] = ["whatsapp", "ligacao", "email", "visita", "sem_resposta", "outro"];

// ── Motivo de perda (Fase 0 — C0.1, 16/09/2026) ──────────────────────────────
// Lista fechada pra sempre sabermos POR QUE um lead foi perdido. Nasceu do
// primeiro trial perdido pra concorrente (15/09/2026) por nao achar uma
// funcao que existia — daí a chave `nao_encontrou_funcao`.
// O backend ja tem a coluna `lost_reason` (services/crmApi.ts::Lead), livre
// (string), entao gravamos a CHAVE aqui (nao o label) pra poder trocar o
// texto sem migrar dado antigo.
export type LostReasonKey =
  | "sem_resposta"
  | "preco"
  | "ja_tem_sistema"
  | "sem_tempo"
  | "fora_do_perfil"
  | "falta_funcionalidade"
  | "concorrente"
  | "nao_encontrou_funcao"
  | "travou_no_cadastro"
  | "outro";

export type LostReasonMeta = { key: LostReasonKey; label: string };

export const LOST_REASONS: LostReasonMeta[] = [
  { key: "sem_resposta",          label: "Sem resposta" },
  { key: "preco",                 label: "Preço" },
  { key: "ja_tem_sistema",        label: "Já tem sistema" },
  { key: "sem_tempo",             label: "Sem tempo para implantar" },
  { key: "fora_do_perfil",        label: "Fora do perfil" },
  { key: "falta_funcionalidade",  label: "Falta funcionalidade" },
  { key: "concorrente",           label: "Foi para concorrente" },
  { key: "nao_encontrou_funcao",  label: "Não encontrou a função no app" },
  { key: "travou_no_cadastro",    label: "Travou no cadastro" },
  { key: "outro",                 label: "Outro" },
];

export function lostReasonLabel(key: string | null | undefined): string {
  if (!key) return "";
  return LOST_REASONS.find((r) => r.key === key)?.label || key;
}

export const PLANS: { key: ExpectedPlan; label: string; price: number }[] = [
  { key: "essencial", label: "Essencial", price: 89 },
  { key: "negocio",   label: "Negócio",   price: 169.90 },
  { key: "expansao",  label: "Expansão",  price: 269.90 },
];

export const WA_TEMPLATE_DEFAULT = `Ola, {nome}! Tudo bem? 😄

Vou ser breve — somos a Aura, uma plataforma de gestao para negocios como o seu.

Caixa, estoque, NF-e e muito mais em um lugar so — e a migracao fica por nossa conta 😊

Vale 5 minutos para conhecer?

www.getaura.com.br`;

// Cor do score por faixa
export function scoreColor(score: number): string {
  if (score >= 50) return Colors.green;
  if (score >= 30) return Colors.amber;
  if (score >= 15) return Colors.violet3;
  return Colors.ink3;
}

// Label do score por faixa
export function scoreLabel(score: number): string {
  if (score >= 50) return "Quente";
  if (score >= 30) return "Morno";
  if (score >= 15) return "Acompanhar";
  return "Frio";
}
