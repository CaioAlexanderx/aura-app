// ─── CRM Comercial — Helpers puros ───────────────────────────────────────────
import { Clipboard } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { STATUSES, type StatusMeta } from "./constants";
import type { LeadStatus } from "@/services/crmApi";

// ── Datas ────────────────────────────────────────────────────────────────────

export function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** "hoje" | "ontem" | "ha Nd" | "em Nd" | null */
export function fmtRelative(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff < 0)   return "em " + Math.abs(diff) + "d";
  return "ha " + diff + "d";
}

/** "2026-05-21" formato pra input de proximo follow-up */
export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// ── Status ───────────────────────────────────────────────────────────────────

export function statusMeta(key: string): StatusMeta | { key: string; label: string; color: string } {
  return STATUSES.find((s) => s.key === key) || { key, label: key, color: Colors.ink3 };
}

// ── WhatsApp ─────────────────────────────────────────────────────────────────

export function waLink(phone: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = "55" + digits;
  return "https://wa.me/" + digits;
}

export function fillWaTemplate(template: string, leadName: string): string {
  const firstName = leadName.split(" ")[0] || leadName;
  return template.replace(/\{nome\}/g, firstName);
}

export function copyToClipboard(text: string, successMsg = "Copiado!"): void {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast.success(successMsg));
  } else {
    Clipboard.setString(text);
    toast.success(successMsg);
  }
}

// ── Excel import ─────────────────────────────────────────────────────────────

/** Extrai "Sao Paulo" de "Av X, 123 - Centro, Sao Paulo - SP, 01000-000". */
export function extractCity(address: string): string {
  if (!address) return "";
  const match = address.match(/,\s*([^,\-]+?)\s*-\s*[A-Z]{2},/);
  return match ? match[1].trim() : "";
}

// ── Formatadores BR ──────────────────────────────────────────────────────────

export function fmtMoney(value: number | null | undefined): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

export function fmtPhone(phone: string | null): string {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

// ── Pluralizacao simples ─────────────────────────────────────────────────────

export function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural || singular + "s"}`;
}

// ── Status drag-and-drop helpers ─────────────────────────────────────────────

/** Indice do status no funil (pra evitar arrastar pra tras sem confirmacao). */
export function statusIndex(status: LeadStatus): number {
  return STATUSES.findIndex((s) => s.key === status);
}
