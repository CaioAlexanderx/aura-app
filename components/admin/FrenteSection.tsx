import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { request, adminApi } from "@/services/api";
import type { SetSegmentBody, SegmentFlags, SetSegmentResponse } from "@/services/adminApi";
import { SEGMENT_LABEL, SEGMENTOS } from "@/constants/primeirosPassos";
import type { Segmento } from "@/services/primeirosPassosApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

// ============================================================
// Gestão Aura › Clientes › Frente (05/10/2026)
//
// A equipe define/troca a frente de qualquer empresa (por CNPJ) e liga ou
// desliga recursos: PATCH /admin/clients/:cid/segment (Aura-backend #786).
//   · frente atual, origem (cnae/landing/user/staff), sugestão pelo CNAE e
//     CNAE vêm de GET /admin/clients (o /clients-360 da lista não traz)
//   · o que está ligado vem do pdv-settings da empresa (staff com
//     role admin passa no requireCompanyAccess) e é atualizado pela
//     resposta do PATCH
//   · 409 STUDIO_PLAN_REQUIRED → "Studio exige plano Negócio ou superior"
// ============================================================

export const STUDIO_PLAN_MSG = "Studio exige plano Negócio ou superior";

export function isStudioPlanError(err: any): boolean {
  if (!err) return false;
  return err?.data?.code === "STUDIO_PLAN_REQUIRED" || err?.code === "STUDIO_PLAN_REQUIRED" || err?.status === 409;
}

const SOURCE_LABEL: Record<string, string> = {
  cnae: "pelo CNAE",
  landing: "pelo site",
  user: "escolha do cliente",
  staff: "equipe Aura",
};

type FlagKey = "matcon" | "otica" | "os";
const FLAGS: { key: FlagKey; flag: keyof SegmentFlags; label: string }[] = [
  { key: "matcon", flag: "matcon_enabled", label: "Materiais de construção" },
  { key: "otica", flag: "otica_enabled", label: "Ótica" },
  { key: "os", flag: "os_enabled", label: "Ordem de Serviço" },
];

type AdminClientRow = {
  id: string;
  segment?: Segmento | null;
  segment_source?: string | null;
  segment_suggested?: Segmento | null;
  cnae_principal?: string | null;
};

export function FrenteSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const ownCompanyId = useAuthStore((st: any) => st.company?.id);

  const { data: clientsData } = useQuery<{ clients: AdminClientRow[] }>({
    queryKey: ["admin-clients"],
    queryFn: () => request("/admin/clients"),
    staleTime: 60_000,
  });
  const row = (clientsData?.clients || []).find((c) => c.id === companyId) || null;

  const { data: settingsData, isLoading: loadingFlags, isError: flagsError } = useQuery<{ settings: any }>({
    queryKey: ["admin-client-flags", companyId],
    queryFn: () => request("/companies/" + companyId + "/pdv-settings"),
    staleTime: 30_000,
    retry: 0,
  });

  const [flags, setFlags] = useState<SegmentFlags | null>(null);
  const [segment, setSegment] = useState<Segmento | null>(null);
  const [extraOs, setExtraOs] = useState(false);
  const [disable, setDisable] = useState<FlagKey[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  // Sincroniza com o servidor ao trocar de cliente / chegar dado novo.
  useEffect(() => { setSegment(row?.segment ?? null); }, [companyId, row?.segment]);
  useEffect(() => {
    const st = settingsData?.settings;
    if (!st) return;
    setFlags({
      matcon_enabled: st.matcon_enabled === true,
      otica_enabled: st.otica_enabled === true,
      os_enabled: st.os_enabled === true,
      studio_enabled: st.studio_enabled === true,
    });
  }, [settingsData]);
  useEffect(() => { setExtraOs(false); setDisable([]); setErro(null); }, [companyId]);

  const mutation = useMutation({
    mutationFn: (body: SetSegmentBody) => adminApi.setSegment(companyId, body),
    onSuccess: (res: SetSegmentResponse) => {
      setErro(null);
      setFlags(res.flags);
      setDisable([]);
      setExtraOs(false);
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      qc.invalidateQueries({ queryKey: ["admin-clients-360"] });
      qc.invalidateQueries({ queryKey: ["admin-client-flags", companyId] });
      // Mexeu na própria empresa: o menu precisa refletir as flags novas.
      if (ownCompanyId === companyId) {
        const st: any = useAuthStore.getState();
        if (typeof st.refreshMe === "function") st.refreshMe().catch(() => {});
        qc.invalidateQueries({ queryKey: ["pdv-settings"] });
      }
      toast.success("Frente salva: " + (res.segment ? SEGMENT_LABEL[res.segment] : "—"));
    },
    onError: (err: any) => {
      const msg = isStudioPlanError(err) ? STUDIO_PLAN_MSG : (err?.data?.error || "Erro ao salvar a frente");
      setErro(msg);
      toast.error(msg);
    },
  });

  function salvar() {
    if (!segment || mutation.isPending) return;
    const body: SetSegmentBody = { segment };
    if (extraOs && segment !== "assistencia") body.extras = ["os"];
    if (disable.length) body.disable = disable;
    mutation.mutate(body);
  }

  function alternarDesligar(k: FlagKey) {
    setDisable((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));
  }

  const ligados = flags ? FLAGS.filter((f) => flags[f.flag]) : [];
  const atual = row?.segment ?? null;

  return (
    <View style={s.section} testID="frente-section">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={s.sectionTitle}>Frente</Text>
        {mutation.isPending && <ActivityIndicator size="small" color={Colors.violet3} />}
      </View>

      <View style={s.infoGrid}>
        <Info label="Frente atual" value={atual ? SEGMENT_LABEL[atual] : "sem frente (conta antiga)"} testID="frente-atual" />
        <Info label="Origem" value={row?.segment_source ? (SOURCE_LABEL[row.segment_source] || row.segment_source) : "—"} />
        <Info label="Sugestão pelo CNAE" value={row?.segment_suggested ? SEGMENT_LABEL[row.segment_suggested] : "—"} />
        <Info label="CNAE" value={row?.cnae_principal || "—"} />
      </View>

      <Text style={s.label}>Trocar para</Text>
      <View style={s.grid}>
        {SEGMENTOS.map((k) => {
          const on = segment === k;
          return (
            <Pressable
              key={k}
              onPress={() => { setSegment(k); setErro(null); }}
              style={[s.chip, on && s.chipOn]}
              testID={"frente-opcao-" + k}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.chipText, on && s.chipTextOn]}>{SEGMENT_LABEL[k]}</Text>
              {atual === k && <Text style={s.chipMeta}>atual</Text>}
            </Pressable>
          );
        })}
      </View>

      {segment !== "assistencia" && (
        <>
          <Text style={s.label}>Extra</Text>
          <View style={s.grid}>
            <Pressable
              onPress={() => setExtraOs((v) => !v)}
              style={[s.chip, extraOs && s.chipOn]}
              testID="frente-extra-os"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: extraOs }}
            >
              <Text style={[s.chipText, extraOs && s.chipTextOn]}>{extraOs ? "✓ " : "+ "}Ordem de Serviço</Text>
            </Pressable>
          </View>
        </>
      )}

      <Text style={s.label}>Ligado agora</Text>
      {loadingFlags && !flags ? (
        <Text style={s.hint}>Carregando…</Text>
      ) : flagsError && !flags ? (
        <Text style={s.hint}>Não deu pra ler o que está ligado. Salvar a frente mostra o estado novo.</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {ligados.length === 0 && !flags?.studio_enabled && <Text style={s.hint}>Nada além do básico da loja.</Text>}
          {ligados.map((f) => {
            const vaiDesligar = disable.includes(f.key);
            return (
              <View key={f.key} style={s.flagRow} testID={"frente-ligado-" + f.key}>
                <Text style={[s.flagText, vaiDesligar && { textDecorationLine: "line-through", color: Colors.ink3 }]}>{f.label}</Text>
                <Pressable onPress={() => alternarDesligar(f.key)} style={[s.flagBtn, vaiDesligar && s.flagBtnOn]} testID={"frente-desligar-" + f.key}>
                  <Text style={[s.flagBtnText, vaiDesligar && { color: Colors.red }]}>{vaiDesligar ? "vai desligar · desfazer" : "Desligar"}</Text>
                </Pressable>
              </View>
            );
          })}
          {flags?.studio_enabled && (
            <View style={s.flagRow}>
              <Text style={s.flagText}>Aura Studio</Text>
              <Text style={s.hint}>sai trocando a frente</Text>
            </View>
          )}
        </View>
      )}

      {erro && <Text style={s.erro} testID="frente-erro">{erro}</Text>}

      <Pressable
        onPress={salvar}
        disabled={!segment || mutation.isPending}
        style={[s.btn, (!segment || mutation.isPending) && { opacity: 0.5 }]}
        testID="frente-salvar"
        accessibilityRole="button"
      >
        <Text style={s.btnText}>Salvar frente</Text>
      </Pressable>
      <Text style={s.hint}>
        A frente nova liga o que ela usa. Nada é desligado sem marcar acima. Sair do Studio desativa o Studio.
        {" "}{STUDIO_PLAN_MSG}. Ação registrada em admin_audit_log.
      </Text>
    </View>
  );
}

function Info({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={s.info}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} testID={testID}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  section: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  info: { minWidth: 140, flexGrow: 1, flexBasis: 140, backgroundColor: Colors.bg4, borderRadius: 10, padding: 10 },
  infoLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  infoValue: { fontSize: 13, color: Colors.ink, fontWeight: "600", marginTop: 3 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  chipOn: { borderColor: Colors.violet, backgroundColor: Colors.violet + "1F" },
  chipText: { fontSize: 12, color: Colors.ink2, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },
  chipMeta: { fontSize: 10, color: Colors.ink3 },
  flagRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 4 },
  flagText: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  flagBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  flagBtnOn: { borderColor: Colors.red + "66" },
  flagBtnText: { fontSize: 11, color: Colors.ink2, fontWeight: "600" },
  erro: { fontSize: 12, color: Colors.red, fontWeight: "600", marginTop: 10 },
  btn: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 14 },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  hint: { fontSize: 10, color: Colors.ink3, marginTop: 8, lineHeight: 14 },
});

export default FrenteSection;
