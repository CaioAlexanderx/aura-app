// ============================================================
// AnuidadeCard — card "Anuidade" na ficha de detalhe do praticante.
//
// Reusa os MESMOS endpoints CPF já usados na aba Financeiro:
//   - listar: karateApi.listCpfAnnuities(federationId, { pageSize })
//     (GET /federation/{id}/financial/annuities/cpf) — sem filtro por
//     praticante no backend, então filtramos client-side por
//     practitioner_id (ver CpfAnnuitiesTab.tsx, que faz o mesmo tipo de
//     filtro client-side para busca por nome/registro).
//   - lançar: karateApi.chargeCpfAnnuity(federationId, practitionerId, body)
//     (POST /federation/{id}/financial/annuities/cpf/{practitionerId}/charge)
//     via LancarAnuidadeModal.
//
// Não duplica lógica de anuidade — só consome os métodos existentes.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts, ShojiPalette, annuityStatusView } from "@/constants/karateTheme";
import { Skeleton } from "@/components/karate/Skeleton";
import { karateApi, AnnuityStatus, CpfAnnuity } from "@/services/karateApi";
import { toast } from "@/components/Toast";
import { LancarAnuidadeModal } from "./LancarAnuidadeModal";

interface Props {
  federationId: string;
  practitionerId: string;
  practitionerName?: string;
  cpf?: string | null;
  allowed: boolean; // pode lançar anuidade (mesmo gate de escrita da ficha)
}

// Estado da anuidade -> view canônica (fonte única: annuityStatusView).
function sm(status: string) {
  return annuityStatusView(status);
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AnuidadeCard({ federationId, practitionerId, practitionerName, cpf, allowed }: Props) {
  const [annuities, setAnnuities] = useState<CpfAnnuity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Backend não filtra CPF por praticante na listagem — página ampla e
      // filtro client-side por practitioner_id (mesmo padrão de filtro
      // client-side já usado em CpfAnnuitiesTab, ali por nome/registro).
      const res = await karateApi.listCpfAnnuities(federationId, { pageSize: 500 });
      const mine = (res.data || []).filter((a) => a.practitioner_id === practitionerId);
      // Mais recente primeiro (por período/criação).
      mine.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      setAnnuities(mine);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId, practitionerId]);

  useEffect(() => { load(); }, [load]);

  const current = annuities[0] || null;

  return (
    <View style={st.card}>
      <View style={st.head}>
        <View>
          <Text style={st.title}>Anuidade</Text>
          <Text style={st.sub}>Cobrança CPF individual</Text>
        </View>
        {allowed && (
          <TouchableOpacity
            style={st.launchBtn}
            onPress={() => setModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Lançar anuidade"
          >
            <Icon name="add" size={13} color={KarateColors.ink} />
            <Text style={st.launchBtnTxt}>Lançar anuidade</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ gap: 8 }}>
          <Skeleton height={48} />
          <Skeleton height={48} />
        </View>
      ) : error ? (
        <Text style={st.errTxt}>Não foi possível carregar as anuidades.</Text>
      ) : (
        <>
          {/* Status atual */}
          <View style={st.currentRow}>
            <Text style={st.currentLabel}>Status atual</Text>
            {current ? (
              <View style={[st.badge, { backgroundColor: sm(current.status).bg }]} accessibilityLabel={sm(current.status).label}>
                <Icon name={sm(current.status).icon as any} size={11} color={sm(current.status).color} />
                <Text style={[st.badgeText, { color: sm(current.status).color }]}>{sm(current.status).label}</Text>
              </View>
            ) : (
              <Text style={st.emptyLabel}>Sem anuidade lançada</Text>
            )}
          </View>

          {/* Histórico */}
          {annuities.length > 0 && (
            <View style={st.history}>
              {annuities.map((a) => (
                <View key={a.id} style={st.histRow}>
                  <Text style={st.histPeriod}>{a.reference_period}</Text>
                  <Text style={st.histAmount}>{formatCurrency(a.amount)}</Text>
                  <View style={[st.badge, { backgroundColor: sm(a.status).bg }]} accessibilityLabel={sm(a.status).label}>
                    <Icon name={sm(a.status).icon as any} size={10} color={sm(a.status).color} />
                    <Text style={[st.badgeText, { color: sm(a.status).color }]}>{sm(a.status).label}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <LancarAnuidadeModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        federationId={federationId}
        practitionerId={practitionerId}
        practitionerName={practitionerName}
        onDone={() => {
          setModalOpen(false);
          toast.success("Anuidade lançada com sucesso");
          load();
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  card:        { backgroundColor: "#fff", borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, padding: 16, margin: 16, gap: 12 } as ViewStyle,
  head:        { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 } as ViewStyle,
  title:       { fontFamily: KarateFonts.heading, fontSize: 16, color: KarateColors.ink } as TextStyle,
  sub:         { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  launchBtn:   { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border2, backgroundColor: KarateColors.bg2 } as ViewStyle,
  launchBtnTxt:{ fontSize: 12, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  currentRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } as ViewStyle,
  currentLabel:{ fontSize: 12, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
  emptyLabel:  { fontSize: 12, color: KarateColors.ink4 } as TextStyle,
  badge:       { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 3, paddingHorizontal: 7, borderRadius: KarateRadius.sm } as ViewStyle,
  badgeText:   { fontSize: 10, fontWeight: "700" } as TextStyle,
  history:     { gap: 6, borderTopWidth: 1, borderTopColor: KarateColors.border, paddingTop: 10 } as ViewStyle,
  histRow:     { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  histPeriod:  { fontFamily: KarateFonts.mono, fontSize: 12, color: KarateColors.ink, width: 56 } as TextStyle,
  histAmount:  { fontFamily: KarateFonts.mono, fontSize: 12.5, color: KarateColors.ink2, flex: 1 } as TextStyle,
  errTxt:      { fontSize: 12, color: KarateColors.primary } as TextStyle,
});
