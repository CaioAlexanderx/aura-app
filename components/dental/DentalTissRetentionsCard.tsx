// ============================================================
// PR40 Sprint B (2026-04-28)
// Card "Retencoes TISS no mes" pra contabilidade odonto.
//
// Mostra:
// - Soma IRRF retido por convenios (deduzir do IRPJ devido = compensacao)
// - Soma ISS retido (substituicao tributaria)
// - Soma PIS+COFINS+CSLL retido (Lucro Presumido/Real)
// - Detalhamento por convenio
// - Valor liquido recebido vs autorizado vs pago
//
// Endpoint: GET /companies/:cid/dental/tiss/retentions/summary
// ============================================================

import React, { useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { apiClient } from "@/services/apiClient";
import { DentalColors } from "@/constants/dental-tokens";

type RetentionsResponse = {
  period: { from: string; to: string };
  summary: {
    total_guides: number;
    total_authorized: number;
    total_paid: number;
    total_glossed: number;
    total_irrf_retido: number;
    total_iss_retido: number;
    total_pis_cofins_csll_retido: number;
    total_retencoes: number;
    total_net_paid: number;
    compensacao_irrf_disponivel: number;
  };
  by_insurance: Array<{
    insurance_id: string;
    insurance_name: string;
    guides: number;
    paid: number;
    irrf: number;
    iss: number;
    pis_cofins_csll: number;
  }>;
};

const fmtBRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}
function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
}

export function DentalTissRetentionsCard() {
  const { company } = useAuthStore();
  const companyId = company?.id;
  const [periodOffset, setPeriodOffset] = useState(0); // 0 = mes atual, -1 = anterior

  const ref = new Date();
  ref.setMonth(ref.getMonth() + periodOffset);
  const from = startOfMonth(ref);
  const to = endOfMonth(ref);

  const { data, isLoading } = useQuery<RetentionsResponse>({
    queryKey: ["dental-tiss-retentions", companyId, from, to],
    queryFn: async () => {
      const r = await apiClient.get(
        `/companies/${companyId}/dental/tiss/retentions/summary?from=${from}&to=${to}`
      );
      return r.data;
    },
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.04)",
          borderWidth: 1,
          borderColor: DentalColors.border,
          borderRadius: 14,
          padding: 18,
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={DentalColors.cyan} />
      </View>
    );
  }

  const s = data?.summary;
  if (!s || s.total_guides === 0) {
    return (
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.04)",
          borderWidth: 1,
          borderColor: DentalColors.border,
          borderRadius: 14,
          padding: 18,
        }}
      >
        <Text style={{ fontSize: 14, color: DentalColors.ink, fontWeight: "700" }}>
          Retencoes TISS no periodo
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: DentalColors.ink3,
            marginTop: 8,
            lineHeight: 16,
          }}
        >
          Sem guias TISS pagas no periodo selecionado. Quando convenios pagarem com
          retencao na fonte (IRRF/ISS/PIS-COFINS-CSLL), os valores aparecem aqui pra
          compensacao tributaria.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: DentalColors.border,
        borderRadius: 14,
        padding: 18,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 16, fontWeight: "800", color: DentalColors.ink }}
          >
            🏥 Retencoes TISS · {ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: DentalColors.ink3,
              marginTop: 2,
              lineHeight: 15,
            }}
          >
            {s.total_guides} guia(s) · Pago: {fmtBRL(s.total_paid)} · Liquido: {fmtBRL(s.total_net_paid)}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable
            onPress={() => setPeriodOffset((o) => o - 1)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: DentalColors.bg,
              borderWidth: 1,
              borderColor: DentalColors.border,
            }}
          >
            <Text style={{ fontSize: 11, color: DentalColors.ink2 }}>← Anterior</Text>
          </Pressable>
          {periodOffset !== 0 && (
            <Pressable
              onPress={() => setPeriodOffset(0)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: DentalColors.cyan,
              }}
            >
              <Text style={{ fontSize: 11, color: "#000", fontWeight: "700" }}>Hoje</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* KPIs - 3 colunas */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <RetentionKpi
          label="IRRF retido"
          value={fmtBRL(s.total_irrf_retido)}
          hint="1,5% (compensavel no IRPJ)"
          accent={DentalColors.cyan}
        />
        <RetentionKpi
          label="ISS retido"
          value={fmtBRL(s.total_iss_retido)}
          hint="ST municipal"
          accent={DentalColors.violet}
        />
        <RetentionKpi
          label="PIS/COFINS/CSLL"
          value={fmtBRL(s.total_pis_cofins_csll_retido)}
          hint="4,65% LP/LR"
          accent={DentalColors.amber}
        />
      </View>

      {/* Compensacao IRPJ destaque */}
      {s.compensacao_irrf_disponivel > 0 && (
        <View
          style={{
            padding: 12,
            borderRadius: 10,
            backgroundColor: "rgba(34, 211, 238, 0.08)",
            borderWidth: 1,
            borderColor: "rgba(34, 211, 238, 0.25)",
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 11, color: DentalColors.cyan, fontWeight: "700" }}>
            💡 COMPENSACAO IRPJ DISPONIVEL
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: DentalColors.ink,
              marginTop: 4,
              lineHeight: 18,
            }}
          >
            Os {fmtBRL(s.compensacao_irrf_disponivel)} de IRRF retido pelos convenios
            podem ser deduzidos do IRPJ devido no proximo recolhimento. Informe seu
            contador.
          </Text>
        </View>
      )}

      {/* Detalhamento por convenio */}
      {data && data.by_insurance.length > 0 && (
        <View>
          <Text
            style={{
              fontSize: 12,
              color: DentalColors.ink2,
              fontWeight: "700",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Por convenio
          </Text>
          <View style={{ gap: 6 }}>
            {data.by_insurance.map((row) => (
              <View
                key={row.insurance_id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: DentalColors.bg,
                  borderWidth: 1,
                  borderColor: DentalColors.border,
                  gap: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: DentalColors.ink,
                      fontWeight: "700",
                    }}
                  >
                    {row.insurance_name}
                  </Text>
                  <Text
                    style={{ fontSize: 10, color: DentalColors.ink3, marginTop: 1 }}
                  >
                    {row.guides} guia(s) · {fmtBRL(row.paid)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontSize: 11,
                      color: DentalColors.ink2,
                      fontWeight: "700",
                    }}
                  >
                    {fmtBRL(row.irrf + row.iss + row.pis_cofins_csll)}
                  </Text>
                  <Text style={{ fontSize: 9, color: DentalColors.ink3 }}>retido</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function RetentionKpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 10,
        backgroundColor: DentalColors.bg,
        borderWidth: 1,
        borderColor: DentalColors.border,
        borderTopWidth: 2,
        borderTopColor: accent,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          color: DentalColors.ink3,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 16,
          color: DentalColors.ink,
          fontWeight: "800",
          marginTop: 4,
        }}
      >
        {value}
      </Text>
      <Text style={{ fontSize: 9, color: DentalColors.ink3, marginTop: 2 }}>
        {hint}
      </Text>
    </View>
  );
}
