// ============================================================
// DENTAL CONSULTA — shared types
//
// Tipos compartilhados entre os componentes de Modo Consulta
// (app/dental/consulta/[appointmentId].tsx + filhos).
//
// Mantido propositalmente magro: tipos de wire (resposta da API)
// ficam em hooks/clients especificos. Aqui so o que circula
// entre componentes da consulta.
// ============================================================

import type { ToothData, ToothStatus } from "@/components/verticals/odonto/OdontogramaSVG";

export type ConsultaStage = "intro" | "active" | "ended";

export interface ConsultaPatient {
  id: string;                 // customer_id
  name: string;
  age?: number | null;
  phone?: string | null;
  allergies?: string | null;
  conditions?: string | null;
  medications?: string | null;
  insurance_name?: string | null;
}

export interface ConsultaAppointment {
  id: string;
  scheduled_at: string;
  duration_min: number;
  chief_complaint?: string | null;
  status: string;
  practitioner_id?: string | null;
  professional_name?: string | null;
}

export interface ToothChange {
  tooth_number: number;
  prev_status?: ToothStatus | null;
  status: ToothStatus;
  notes?: string | null;
  added_at: string; // ISO
}

export interface VoiceSegment {
  id: string;
  text: string;
  ts: string;       // ISO
  isCommand?: boolean;
}

export interface ConsultaState {
  stage: ConsultaStage;
  startedAt: string | null;     // ISO when "Iniciar" clicked
  endedAt: string | null;
  toothChanges: ToothChange[];
  transcript: VoiceSegment[];
  evolutionDraft: string;       // editable in EndModal
  whatsappDraft: string;
  nextAppointmentDraft: string;
}
