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

export const PLANS: { key: ExpectedPlan; label: string; price: number }[] = [
  { key: "essencial", label: "Essencial", price: 89 },
  { key: "negocio",   label: "Negocio",   price: 169.90 },
  { key: "expansao",  label: "Expansao",  price: 269.90 },
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
