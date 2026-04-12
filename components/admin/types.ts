import { Colors } from "@/constants/colors";

export type AdminClient = {
  id: string;
  trade_name: string;
  legal_name: string;
  plan: string;
  is_active: boolean;
  module_overrides: Record<string, boolean> | null;
  created_at: string;
  owner_email: string;
  owner_name: string;
  visible_modules: string[];
};

export const PLAN_C: Record<string, { color: string; label: string }> = {
  essencial: { color: Colors.ink3, label: "Essencial" },
  negocio: { color: Colors.violet3, label: "Negocio" },
  expansao: { color: Colors.green, label: "Expansao" },
};

export const STATUS_C: Record<string, { color: string; label: string }> = {
  active: { color: Colors.green, label: "Ativo" },
  overdue: { color: Colors.amber, label: "Inadimplente" },
  cancelled: { color: Colors.red, label: "Cancelado" },
  true: { color: Colors.green, label: "Ativo" },
  false: { color: Colors.red, label: "Inativo" },
};

export const MODULE_LABELS = [
  { key: "financeiro", label: "Financeiro" },
  { key: "pdv", label: "PDV" },
  { key: "estoque", label: "Estoque" },
  { key: "crm", label: "CRM" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "canal_digital", label: "Canal Digital" },
  { key: "folha", label: "Folha" },
  { key: "agentes_ia", label: "Agentes IA" },
];
