import { View, Text } from "react-native";
import { OdontoDashboard, type SectionKey } from "@/components/verticals/odonto/OdontoDashboard";
import { useDentalPersona, dentalPersonaLabel, type DentalPersona } from "@/hooks/useDentalPersona";
import { useAuthStore } from "@/stores/auth";
import { DentalColors } from "@/constants/dental-tokens";

// ============================================================
// Hoje — tela inicial do shell Aura Odonto.
//
// Persona-aware (PR4 — Fase 3, 2026-04-26): mesma vista para
// todos, mas a ORDEM das secoes do dashboard muda por persona
// para destacar o que cada perfil mais usa no comeco do dia.
//
// Persona detectada via useDentalPersona() (member_role mapping).
// Sem toggle: persona e fixa por usuario, definida pelo admin
// no convite (Gestao Aura > Membros).
// ============================================================

const ORDERS: Record<DentalPersona, SectionKey[]> = {
  // Dentista: comeca pela agenda do dia (proximo paciente),
  // depois base de pacientes (recall), funil (orcamentos abertos),
  // top procedimentos (sente o ritmo), e por fim financeiro/cobranca.
  dentista: ["agenda", "pacientes", "funil", "topProcs", "financeiro", "cobranca"],

  // Recepcao: agenda (confirmar, check-in), cobranca (cobrar quem deve),
  // pacientes (recall — ligar pra agendar retorno), funil (leads novos),
  // financeiro (visao geral), procedimentos (menos relevante no dia-a-dia).
  recepcao: ["agenda", "cobranca", "pacientes", "funil", "financeiro", "topProcs"],

  // Gestor: financeiro (faturamento mes), cobranca (saude do caixa),
  // funil (conversao), procedimentos (ranking), agenda (operacional),
  // pacientes (base instalada).
  gestor:   ["financeiro", "cobranca", "funil", "topProcs", "agenda", "pacientes"],
};

const PERSONA_TAGLINE: Record<DentalPersona, string> = {
  dentista: "Sua agenda, pacientes e atendimentos do dia.",
  recepcao: "Confirmacoes, check-ins, cobrancas e recall.",
  gestor:   "Faturamento, conversao e indicadores da clinica.",
};

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
      <OdontoDashboard sectionsOrder={order} hideTitle />
    </View>
  );
}
