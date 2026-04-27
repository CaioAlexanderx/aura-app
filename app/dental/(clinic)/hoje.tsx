import { View, Text, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { OdontoDashboard, type SectionKey } from "@/components/verticals/odonto/OdontoDashboard";
import { HojeAppointmentsPanel } from "@/components/dental/HojeAppointmentsPanel";
import { DentalAuraBackdrop } from "@/components/dental/DentalAuraBackdrop";
import { DentalDesignStyle } from "@/components/dental/DentalDesignStyle";
import { DentalHeroCard } from "@/components/dental/DentalHeroCard";
import { DentalQuickActions } from "@/components/dental/DentalQuickActions";
import { DentalSectionHeader } from "@/components/dental/DentalSectionHeader";

import { useDentalPersona, dentalPersonaLabel, type DentalPersona } from "@/hooks/useDentalPersona";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";
import { DentalColors } from "@/constants/dental-tokens";

// ============================================================
// Hoje — tela inicial do shell Aura Odonto.
//
// PR4 (2026-04-26) — persona-aware: ordem das secoes muda por persona.
// PR5 (2026-04-26) — panel de proximos atendimentos no topo (dentista/recepcao).
// PR16 (2026-04-27) — design rico: backdrop animado, hero com count-up,
//                     quick actions com glow, KPIs com accent stripe.
//                     Padrao visual herdado do shell negocio (violeta)
//                     mas tokenizado em cyan/violet (DentalColors).
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

function fakeSpark(target: number, n = 14): number[] {
  if (!target || target < 1) return [];
  const out: number[] = [];
  let cur = target * 0.55;
  for (let i = 0; i < n; i++) {
    cur += (target - cur) * (0.05 + Math.random() * 0.08);
    cur += (Math.random() - 0.45) * (target * 0.04);
    out.push(Math.max(0, cur));
  }
  out[n - 1] = target;
  return out;
}

export default function HojeScreen() {
  const persona = useDentalPersona();
  const { user, company } = useAuthStore();
  const firstName = firstNameOf(user?.name);
  const greeting = greetingFor();
  const order = ORDERS[persona];
  const personaLabel = dentalPersonaLabel(persona);
  const showAppointmentsPanel = PERSONAS_WITH_APPOINTMENTS_PANEL.has(persona);

  const { data: dashData } = useQuery({
    queryKey: ["dental-dashboard", company?.id],
    queryFn: () => request<any>(`/companies/${company!.id}/dental/dashboard`),
    enabled: !!company?.id,
    staleTime: 30000,
  });

  const heroProps = useMemo(() => {
    const d: any = dashData || {};
    const fat = d.faturamento_mes || { realizado: 0, previsto: 0 };
    const hoje = d.consultas_hoje || {};
    const repasse = d.repasse_mes || { a_pagar: 0, pago: 0 };
    const pacientes = d.pacientes || { total: 0, novos_mes: 0 };

    if (persona === "gestor") {
      return {
        eyebrow: "FATURAMENTO REALIZADO · MES",
        value: Number(fat.realizado || 0),
        format: "brl" as const,
        spark: fakeSpark(Number(fat.realizado || 0)),
        meta: [
          { label: "Previsto", value: "R$ " + (Number(fat.previsto || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 0 }) },
          { label: "Repasse", value: "R$ " + (Number(repasse.a_pagar || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 0 }) },
          { label: "Base ativa", value: String(pacientes.total || 0), highlight: true },
        ],
      };
    }

    return {
      eyebrow: "CONSULTAS HOJE",
      value: Number(hoje.total || 0),
      format: "int" as const,
      spark: fakeSpark(Math.max(1, Number(hoje.total || 1))),
      meta: [
        { label: "Confirmadas", value: String(hoje.confirmados || 0), highlight: true },
        { label: "Pendentes",   value: String(hoje.pendentes || 0) },
        { label: "Concluidas",  value: String(hoje.concluidos || 0) },
      ],
    };
  }, [dashData, persona]);

  return (
    <View style={{ position: "relative" }}>
      <DentalDesignStyle />
      <DentalAuraBackdrop />

      <View style={Platform.OS === "web" ? { position: "relative", zIndex: 1 } as any : undefined}>
        <View style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{
              fontSize: 11, color: DentalColors.ink3, letterSpacing: 1.5,
              textTransform: "uppercase", fontWeight: "600",
            }}>
              OPERACAO · {personaLabel.toUpperCase()}
            </Text>
            {Platform.OS === "web" ? (
              <View style={{
                width: 6, height: 6, borderRadius: 3, backgroundColor: DentalColors.green,
                animation: "dentalPulse 1.8s ease-in-out infinite",
                boxShadow: "0 0 8px rgba(34,197,94,0.6)",
              } as any} />
            ) : null}
          </View>
          <Text style={{ fontSize: 28, color: DentalColors.ink, fontWeight: "700", letterSpacing: -0.5, marginTop: 4 }}>
            {greeting}{firstName ? ", " : ""}
            {firstName ? <Text style={{ color: DentalColors.cyan }}>{firstName}</Text> : null}
          </Text>
          <Text style={{ fontSize: 13, color: DentalColors.ink2, marginTop: 4 }}>
            {PERSONA_TAGLINE[persona]}
          </Text>
        </View>

        <DentalHeroCard {...heroProps} />

        <DentalSectionHeader title="Atalhos" />
        <DentalQuickActions persona={persona} />

        {showAppointmentsPanel && <HojeAppointmentsPanel />}

        <OdontoDashboard sectionsOrder={order} hideTitle />
      </View>
    </View>
  );
}
