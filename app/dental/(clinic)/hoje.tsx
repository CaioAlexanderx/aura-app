import { View, Text } from "react-native";
import { OdontoDashboard, type SectionKey } from "@/components/verticals/odonto/OdontoDashboard";
import { HojeAppointmentsPanel } from "@/components/dental/HojeAppointmentsPanel";
import { useDentalPersona, dentalPersonaLabel, type DentalPersona } from "@/hooks/useDentalPersona";
import { useAuthStore } from "@/stores/auth";
import { DentalColors } from "@/constants/dental-tokens";

// ============================================================
// Hoje — tela inicial do shell Aura Odonto.
//
// Persona-aware (PR4 — Fase 3, 2026-04-26): mesma vista para todos,
// mas a ORDEM das secoes do dashboard muda por persona para destacar
// o que cada perfil mais usa no comeco do dia.
//
// Enriquecida (PR5 — 2026-04-26): Dentista e Recepcao ganham um panel
// destacado no topo com proximos atendimentos detalhados (horario,
// paciente, procedimento, status). Gestor pula o panel — financeiro
// ja fica em destaque pela ordenacao persona.
//
// Persona detectada via useDentalPersona() (member_role mapping).
// Sem toggle: persona e fixa por usuario, definida pelo admin
// no convite (Gestao Aura > Membros).
// ============================================================

const ORDERS: Record<DentalPersona, SectionKey[]> = {
  dentista: ["agenda", "pacientes", "funil", "topProcs", "financeiro", "cobranca"],
  recepcao: ["agenda", "cobranca", "pacientes", "funil", "financeiro", "topProcs"],
  gestor:   ["financeiro", "cobranca", "funil", "topProcs", "agenda", "pacientes"],
};

const PERSONA_TAGLINE: Record<DentalPersona, string> = {
  dentista: "Sua agenda, pacientes e atendimentos do dia.",
  recepcao: "Confirmacoes, check-ins, cobrancas e recall.",
  gestor:   "Faturamento, conversao e indicadores da clinica.",
};

// Personas que ganham o panel "Proximos atendimentos" no topo.
// Gestor nao precisa — financeiro ja e destacado pela ordenacao do dashboard.
const PERSONAS_WITH_APPOINTMENTS_PANEL = new Set<DentalPersona>(["dentista", "recepcao"]);

function firstNameOf(name: string | null | undefined): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

function greetingFor(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5)  return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function HojeScreen() {
  const persona = useDentalPersona();
  const { user } = useAuthStore();
  const firstName = firstNameOf(user?.name);
  const greeting = greetingFor();
  const order = ORDERS[persona];
  const personaLabel = dentalPersonaLabel(persona);
  const showAppointmentsPanel = PERSONAS_WITH_APPOINTMENTS_PANEL.has(persona);

  return (
    <View>
      <View style={{ marginBottom: 18 }}>
        <Text style={{ fontSize: 11, color: DentalColors.ink3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontWeight: "600" }}>
          OPERACAO · {personaLabel.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 26, color: DentalColors.ink, fontWeight: "700", letterSpacing: -0.5 }}>
          {greeting}{firstName ? ", " : ""}
          {firstName ? <Text style={{ color: DentalColors.cyan }}>{firstName}</Text> : null}
        </Text>
        <Text style={{ fontSize: 13, color: DentalColors.ink2, marginTop: 4 }}>
          {PERSONA_TAGLINE[persona]}
        </Text>
      </View>

      {showAppointmentsPanel && <HojeAppointmentsPanel />}

      <OdontoDashboard sectionsOrder={order} hideTitle />
    </View>
  );
}
