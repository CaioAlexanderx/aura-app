// ============================================================
// AURA KARATÊ — Portal público do sensei (validação de quadro por token)
// URL: /karate/roster-update/:token
// Backend: GET  /public/roster-update/:token
//          POST /public/roster-update/:token
//          GET  /public/roster-update/:token/export (CSV)
//
// PÚBLICA — sem login, sem Authorization. O token opaco é a própria
// autenticação (karate_dojo_roster_validation) e é de USO ÚNICO: o POST
// expira o token no backend, então após confirmar não há como reenviar
// (um novo GET voltaria 410). Usa services/karatePublicApi.ts (mesmo
// fetch cru sem Bearer, padrão dos outros portais públicos do karatê).
//
// app/_layout.tsx precisa reconhecer segments[1]==="roster-update" como
// rota pública do karatê (bypass do AuthGuard) — ver onKaratePublic e
// onPublicMicrosite lá.
// ============================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  Platform,
  Linking,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { BeltBadge } from "@/components/karate/BeltBadge";
import { KarateButton } from "@/components/karate/KarateButton";
import {
  karatePublicApi,
  RosterPractitioner,
  RosterUpdateInput,
} from "@/services/karatePublicApi";

export default function RosterUpdatePortalScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const tokenStr = Array.isArray(token) ? token[0] : token || "";

  const [search, setSearch] = useState("");
  const [activeMap, setActiveMap] = useState<Record<string, boolean> | null>(null);
  const [validatedBy, setValidatedBy] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["karate-roster-update", tokenStr],
    queryFn: () => karatePublicApi.getPublicRoster(tokenStr),
    enabled: !!tokenStr,
    retry: 1,
    staleTime: Infinity, // token de uso único — não faz sentido refazer o GET sozinho
  });

  // Inicializa o mapa de is_active local UMA vez, a partir do valor atual
  // do backend. Depois disso, edições do sensei (toggle) vivem só aqui —
  // não sobrescrevemos com refetch (staleTime:Infinity evita isso também).
  useEffect(() => {
    if (data?.praticantes && activeMap === null) {
      const map: Record<string, boolean> = {};
      for (const p of data.praticantes) map[p.id] = p.is_active;
      setActiveMap(map);
    }
  }, [data, activeMap]);

  const submitMut = useMutation({
    mutationFn: () => {
      const praticantes = data?.praticantes || [];
      const updates: RosterUpdateInput[] = praticantes.map((p) => ({
        student_id: p.id,
        is_active: activeMap?.[p.id] ?? p.is_active,
      }));
      return karatePublicApi.submitPublicRoster(tokenStr, updates, validatedBy.trim() || undefined);
    },
    onSuccess: () => setConfirmed(true),
  });

  const praticantes: RosterPractitioner[] = data?.praticantes || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return praticantes;
    return praticantes.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.karate_registration_number?.toLowerCase().includes(q)
    );
  }, [praticantes, search]);

  function toggleActive(id: string) {
    if (confirmed) return;
    setActiveMap((prev) => ({ ...(prev || {}), [id]: !(prev?.[id] ?? true) }));
  }

  function handleDownloadCsv() {
    const url = karatePublicApi.getRosterExportUrl(tokenStr);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url).catch(() => {});
    }
  }

  const activeCount = activeMap ? Object.values(activeMap).filter(Boolean).length : 0;

  // ── Loading ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={st.page}>
        <View style={st.loaderBox}>
          <ActivityIndicator color={P.primary} size="large" />
        </View>
      </View>
    );
  }

  // ── Token inválido / expirado / erro genérico ───────────
  if (error) {
    const status = (error as any)?.status;
    const isExpired = status === 410;
    const isInvalid = status === 404;
    return (
      <View style={st.page}>
        <View style={st.errorWrap}>
          <View style={[st.glyph, { backgroundColor: isExpired ? P.warnSoft : P.dangerSoft }]}>
            <Icon name={isExpired ? "clock" : "alert-circle"} size={26} color={isExpired ? P.warn : P.danger} />
          </View>
          <Text style={st.errorTitle}>
            {isExpired ? "Este link expirou" : isInvalid ? "Link inválido" : "Não foi possível carregar"}
          </Text>
          <Text style={st.errorText}>
            {isExpired
              ? "Este link expirou. Peça um novo à federação para atualizar o quadro do seu dojô."
              : isInvalid
              ? "Este link não é válido. Verifique se o endereço foi copiado corretamente ou peça um novo à federação."
              : "Ocorreu um erro ao carregar os dados do seu dojô. Verifique sua conexão e tente novamente."}
          </Text>
          {!isExpired && !isInvalid && (
            <TouchableOpacity onPress={() => refetch()} style={st.retryBtn} disabled={isRefetching}>
              {isRefetching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={st.retryBtnText}>Tentar novamente</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── Confirmação (pós-submit) ─────────────────────────────
  if (confirmed) {
    const applied = submitMut.data?.applied?.length ?? 0;
    return (
      <View style={st.page}>
        <View style={st.errorWrap}>
          <View style={[st.glyph, { backgroundColor: P.okSoft }]}>
            <Icon name="checkmark-circle" size={26} color={P.ok} />
          </View>
          <Text style={st.errorTitle}>Quadro confirmado, obrigado!</Text>
          <Text style={st.errorText}>
            {applied > 0
              ? `Atualizamos a situação de ${applied} praticante${applied > 1 ? "s" : ""} do ${data?.dojo_nome || "seu dojô"}.`
              : `O quadro do ${data?.dojo_nome || "seu dojô"} foi confirmado sem alterações.`}
            {"\n"}Este link já foi utilizado e não pode ser reenviado.
          </Text>
        </View>
      </View>
    );
  }

  // ── Formulário principal ─────────────────────────────────
  return (
    <ScrollView style={st.page} contentContainerStyle={st.content}>
      <View style={st.header}>
        <Text style={st.eyebrow}>Portal do sensei</Text>
        <Text style={st.dojoName}>{data?.dojo_nome || "Seu dojô"}</Text>
        <Text style={st.subtitle}>Confirme quem está ativo no seu dojô.</Text>
      </View>

      <View style={st.searchBox}>
        <Icon name="search" size={16} color={P.ink3} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome ou registro"
          placeholderTextColor={P.ink4}
          style={st.searchInput}
        />
      </View>

      <Text style={st.countLabel}>
        {activeCount} de {praticantes.length} praticante{praticantes.length !== 1 ? "s" : ""} ativo{activeCount !== 1 ? "s" : ""}
      </Text>

      {filtered.length === 0 ? (
        <View style={st.emptyCard}>
          <Text style={st.emptyText}>Nenhum praticante encontrado.</Text>
        </View>
      ) : (
        filtered.map((p) => {
          const isActive = activeMap?.[p.id] ?? p.is_active;
          return (
            <View key={p.id} style={st.row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={st.rowName}>{p.name}</Text>
                <View style={st.rowMeta}>
                  {p.karate_registration_number && (
                    <Text style={st.rowReg}>Nº {p.karate_registration_number}</Text>
                  )}
                  <BeltBadge beltLevel={p.belt_name || ""} beltName={p.belt_name || undefined} />
                </View>
              </View>
              <View style={st.switchCol}>
                <Text style={[st.switchLabel, { color: isActive ? P.ok : P.ink3 }]}>
                  {isActive ? "Ativo" : "Inativo"}
                </Text>
                <Switch
                  value={isActive}
                  onValueChange={() => toggleActive(p.id)}
                  trackColor={{ false: P.border, true: P.okSoft }}
                  thumbColor={isActive ? P.ok : "#fff"}
                />
              </View>
            </View>
          );
        })
      )}

      <View style={st.footerCard}>
        <Text style={st.fieldLabel}>Seu nome</Text>
        <TextInput
          value={validatedBy}
          onChangeText={setValidatedBy}
          placeholder="Quem está confirmando o quadro"
          placeholderTextColor={P.ink4}
          style={st.textInput}
        />

        {submitMut.isError && (
          <Text style={st.submitError}>
            {(submitMut.error as any)?.message || "Erro ao confirmar o quadro. Tente novamente."}
          </Text>
        )}

        <KarateButton
          label={submitMut.isPending ? "Confirmando..." : "Confirmar quadro"}
          onPress={() => submitMut.mutate()}
          loading={submitMut.isPending}
          disabled={submitMut.isPending || praticantes.length === 0}
          size="lg"
          style={{ marginTop: 12 }}
        />

        <TouchableOpacity onPress={handleDownloadCsv} style={st.csvBtn} accessibilityRole="button" accessibilityLabel="Baixar planilha CSV">
          <Icon name="download" size={16} color={P.primary} />
          <Text style={st.csvBtnText}>Baixar planilha (CSV)</Text>
        </TouchableOpacity>
      </View>

      <View style={st.footer}>
        <Text style={st.footerText}>Portal do sensei · Aura Karatê</Text>
        <Text style={st.footerTextSmall}>Em caso de dúvidas, entre em contato com a federação.</Text>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: P.bg },
  content: { padding: 20, paddingTop: 32, paddingBottom: 56, maxWidth: 640, alignSelf: "center", width: "100%" },

  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 60 },

  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 60, paddingHorizontal: 24, maxWidth: 440, alignSelf: "center" },
  glyph: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  errorTitle: { fontFamily: KarateFonts.heading, fontSize: 20, color: P.ink, textAlign: "center" },
  errorText: { fontSize: 13, color: P.ink3, textAlign: "center", lineHeight: 20 },
  retryBtn: { backgroundColor: P.ink, borderRadius: KarateRadius.md, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  retryBtnText: { color: "#fdf8f2", fontSize: 14, fontWeight: "700" },

  header: { alignItems: "center", paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: P.border, marginBottom: 20 },
  eyebrow: { fontSize: 11, color: P.primary, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  dojoName: { fontFamily: KarateFonts.heading, fontSize: 24, color: P.ink, marginTop: 8, textAlign: "center" },
  subtitle: { fontSize: 13, color: P.ink3, marginTop: 6, textAlign: "center" },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.glass, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, color: P.ink, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },

  countLabel: { fontSize: 11.5, color: P.ink3, fontWeight: "600", marginBottom: 10 },

  emptyCard: { backgroundColor: P.glass, borderRadius: KarateRadius.md, padding: 20, borderWidth: 1, borderColor: P.border, alignItems: "center" },
  emptyText: { fontSize: 13, color: P.ink3 },

  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: P.glass, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: P.border, padding: 14, marginBottom: 8 },
  rowName: { fontSize: 14.5, fontWeight: "700", color: P.ink },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  rowReg: { fontFamily: KarateFonts.mono, fontSize: 11.5, color: P.ink3 },
  switchCol: { alignItems: "center", gap: 4 },
  switchLabel: { fontSize: 10.5, fontWeight: "700" },

  footerCard: { backgroundColor: P.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: P.border, padding: 16, marginTop: 16 },
  fieldLabel: { fontSize: 11.5, fontWeight: "700", color: P.ink2, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  textInput: { borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: P.ink, backgroundColor: P.paperWarm },
  submitError: { fontSize: 12, color: P.danger, marginTop: 10, textAlign: "center" },

  csvBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, marginTop: 10 },
  csvBtnText: { fontSize: 13, fontWeight: "700", color: P.primary },

  footer: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: P.border, alignItems: "center", gap: 4 },
  footerText: { fontSize: 11, color: P.ink3, fontWeight: "600" },
  footerTextSmall: { fontSize: 10, color: P.ink4, textAlign: "center", maxWidth: 320 },
});
