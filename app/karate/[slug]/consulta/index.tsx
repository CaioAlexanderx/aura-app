// ============================================================
// Consulta de Praticante — Portal público FPKT
// Rota: /karate/[slug]/consulta
//
// Campo único "CPF, e-mail ou Número FPKT" → chama
// POST /public/karate/:slug/lookup → exibe perfil + faixa + inscrições.
// Sem OTP, sem fluxo de autenticação — consulta pública.
// Erro 404 (PRACTITIONER_NOT_FOUND) → mensagem sóbria.
//
// Fica dentro do [slug]/_layout.tsx (carrega useShojiFonts).
// AuthGuard bypass: segments[0]==="karate" && segments[2]==="consulta".
// ============================================================
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  ScrollView, StyleSheet, ViewStyle, TextStyle, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateFonts, KarateRadius, ShojiPalette } from "@/constants/karateTheme";
import { FpktLogo } from "@/components/karate/FpktLogo";
import { BeltTag } from "@/components/karate/shoji";
import {
  karatePublicApi,
  LookupResponse,
  LookupRegistration,
  ApiError,
} from "@/services/karatePublicApi";
type Phase = "form" | "loading" | "result" | "error";

// `registration.created_at` é um TIMESTAMPTZ (INSERT ... created_at NOW()),
// diferente de event_date que é DATA pura — aqui `new Date(iso)` é seguro
// (mesmo padrão de fmtDate em praticante.tsx para graduated_at/issued_at).
function formatRegisteredAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function kindLabel(kind: string): string {
  if (kind === "exam") return "Exame";
  if (kind === "course") return "Curso";
  if (kind === "competition") return "Campeonato";
  return kind;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Pendente", confirmed: "Confirmada", approved: "Aprovada",
    rejected: "Recusada", cancelled: "Cancelada", waitlist: "Lista de espera",
  };
  return map[status] || status;
}

function paymentStatusLabel(status: string | null): string | null {
  if (!status) return null;
  const map: Record<string, string> = {
    pending: "Pagamento pendente", paid: "Pago", confirmed: "Pagamento confirmado",
    failed: "Pagamento falhou", refunded: "Reembolsado", waived: "Isento",
  };
  return map[status] || status;
}

export default function ConsultaScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSearch = async () => {
    const q = identifier.trim();
    if (!q) return;
    setPhase("loading");
    setResult(null);
    setErrorMsg("");
    try {
      const data = await karatePublicApi.lookup(String(slug || ""), q);
      setResult(data);
      setPhase("result");
    } catch (err: any) {
      const ae = err as ApiError;
      if (ae.status === 404 || ae.code === "PRACTITIONER_NOT_FOUND") {
        setErrorMsg("Nenhum praticante encontrado com os dados informados.");
      } else {
        setErrorMsg("Não foi possível realizar a consulta. Tente novamente.");
      }
      setPhase("error");
    }
  };

  const handleReset = () => {
    setPhase("form");
    setIdentifier("");
    setResult(null);
    setErrorMsg("");
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <FpktLogo size={30} />
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName} numberOfLines={1}>{result?.federation?.name || "FPKT"}</Text>
            <Text style={styles.brandSub}>Portal do praticante</Text>
          </View>
          <TouchableOpacity
            style={styles.back}
            onPress={() => router.canGoBack() ? router.back() : router.push(`/karate/${slug}` as any)}
            accessibilityLabel="Voltar"
          >
            <Icon name="chevron_left" size={18} color={KarateColors.ink2} />
            <Text style={styles.backLabel}>Início</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowLine} />
          <Text style={styles.eyebrow}>Praticante</Text>
        </View>
        <Text style={styles.h1}>Consultar dados</Text>
        <Text style={styles.sub}>
          Informe o CPF, e-mail ou Número FPKT para consultar o perfil do praticante.
        </Text>
      </View>

      {/* Painel de busca */}
      {(phase === "form" || phase === "loading" || phase === "error") && (
        <View style={styles.panel}>
          <Text style={styles.fieldLabel}>CPF, e-mail ou Número FPKT</Text>
          <TextInput
            style={styles.fieldInput as any}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="100312  ·  012.345.678-90  ·  voce@email.com"
            placeholderTextColor={ShojiPalette.ink4}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            editable={phase !== "loading"}
          />
          <Text style={styles.fieldHint}>Use qualquer um dos três — o que você tiver em mãos.</Text>

          {phase === "error" && (
            <View style={styles.errorBox}>
              <Icon name="alert_circle" size={15} color={ShojiPalette.alert} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, phase === "loading" && { opacity: 0.6 }]}
            onPress={handleSearch}
            disabled={phase === "loading"}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {phase === "loading" ? (
              <ActivityIndicator size="small" color={ShojiPalette.paperWarm} />
            ) : (
              <Icon name="search" size={16} color={ShojiPalette.paperWarm} />
            )}
            <Text style={styles.btnLabel}>
              {phase === "loading" ? "Consultando…" : "Buscar"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Resultado */}
      {phase === "result" && result && (
        <View style={styles.resultWrap}>
          {/* Card do praticante */}
          <View style={styles.card}>
            {/* Avatar inicial */}
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {(result.practitioner.name || "?").trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{result.practitioner.name}</Text>
                {result.practitioner.registration ? (
                  <Text style={styles.registration}>FPKT {result.practitioner.registration}</Text>
                ) : null}
              </View>
            </View>

            {/* Faixa atual */}
            {result.practitioner.current_belt_name || result.practitioner.current_belt ? (
              <View style={styles.beltRow}>
                <Text style={styles.kv}>Faixa atual</Text>
                <BeltTag
                  level={result.practitioner.current_belt || ""}
                  name={result.practitioner.current_belt_name || undefined}
                />
              </View>
            ) : null}
          </View>

          {/* Inscrições */}
          {(result.registrations || []).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Inscrições</Text>
              {(result.registrations || []).map((r: LookupRegistration, idx: number) => {
                const payLabel = paymentStatusLabel(r.payment_status);
                return (
                  <View key={`${r.kind}-${r.event_id}-${idx}`} style={styles.enrollCard}>
                    <View style={styles.enrollKind}>
                      <Text style={styles.enrollKindText}>{kindLabel(r.kind)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.enrollName}>{r.event_name}</Text>
                      <Text style={styles.enrollMeta}>
                        {r.category_name ? r.category_name : "Sem categoria"}
                        {"  ·  "}
                        {formatRegisteredAt(r.created_at)}
                      </Text>
                      <View style={styles.enrollBadges}>
                        <View style={styles.statusChip}>
                          <Text style={styles.statusChipText}>{statusLabel(r.status)}</Text>
                        </View>
                        {payLabel ? (
                          <View style={styles.payChip}>
                            <Text style={styles.payChipText}>{payLabel}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {(result.registrations || []).length === 0 && (
            <View style={styles.emptyEnroll}>
              <Text style={styles.emptyEnrollText}>Nenhuma inscrição encontrada no momento.</Text>
            </View>
          )}

          {/* Nova consulta */}
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.85}>
            <Icon name="refresh" size={15} color={KarateColors.ink2} />
            <Text style={styles.resetLabel}>Nova consulta</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Rodapé */}
      <View style={styles.foot}>
        <TouchableOpacity
          style={styles.footLink}
          onPress={() => {
            const url = "https://www.getaura.com.br/dojo";
            if (typeof window !== "undefined") {
              window.open(url, "_blank", "noopener,noreferrer");
            }
          }}
          accessibilityRole="link"
          accessibilityLabel="Desenvolvido por Aura Karatê"
        >
          <Text style={styles.footText}>Desenvolvido por </Text>
          <View style={styles.footSeal}>
            <Text style={styles.footSealK}>空</Text>
          </View>
          <Text style={styles.footWord}>Aura</Text>
          <Text style={[styles.footWord, { color: ShojiPalette.red }]}>.</Text>
          <Text style={styles.footWord}> Karatê</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const C = KarateColors;
const F = KarateFonts;
const R = KarateRadius;
const P = ShojiPalette;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg } as ViewStyle,
  content: {
    padding: 24,
    paddingTop: 32,
    paddingBottom: 48,
    maxWidth: 540,
    width: "100%",
    alignSelf: "center",
  } as ViewStyle,

  header: { marginBottom: 28 } as ViewStyle,
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  } as ViewStyle,
  brandName: {
    fontFamily: F.heading,
    fontSize: 15,
    fontWeight: "400",
    color: C.ink,
  } as TextStyle,
  brandSub: {
    fontSize: 11,
    color: C.ink3,
    fontFamily: F.body,
    marginTop: 1,
  } as TextStyle,
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  } as ViewStyle,
  backLabel: { fontSize: 13, color: C.ink2, fontFamily: F.body } as TextStyle,

  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
  } as ViewStyle,
  eyebrowLine: { width: 18, height: 1.5, backgroundColor: P.red } as ViewStyle,
  eyebrow: {
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    textTransform: "uppercase",
    color: P.red,
    fontFamily: F.body,
    fontWeight: "500",
  } as TextStyle,

  h1: {
    fontFamily: F.heading,
    fontSize: 30,
    fontWeight: "400",
    color: C.ink,
    lineHeight: 34,
    marginBottom: 8,
  } as TextStyle,
  sub: {
    fontSize: 14,
    color: C.ink2,
    fontFamily: F.body,
    lineHeight: 14 * 1.6,
    maxWidth: 500,
  } as TextStyle,

  panel: {
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.xl,
    padding: 28,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 1px 2px rgba(43,38,32,0.03), 0 18px 50px -30px rgba(43,38,32,0.30)" }
      : { shadowColor: "#2b2620", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 4 }),
  } as ViewStyle,

  fieldLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: C.ink2,
    fontFamily: F.body,
    marginBottom: 8,
  } as TextStyle,
  fieldInput: {
    width: "100%",
    padding: 13,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: R.md,
    backgroundColor: "#fff",
    fontFamily: F.mono,
    fontSize: 14,
    color: C.ink,
    ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}),
  } as any,
  fieldHint: {
    fontSize: 11.5,
    color: C.ink3,
    marginTop: 9,
    lineHeight: 11.5 * 1.5,
    fontFamily: F.body,
  } as TextStyle,

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: P.alertWash,
  } as ViewStyle,
  errorText: {
    flex: 1,
    fontSize: 13,
    color: P.alert,
    fontFamily: F.body,
    lineHeight: 18,
  } as TextStyle,

  btn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingVertical: 14,
    borderRadius: R.md,
    backgroundColor: C.ink,
  } as ViewStyle,
  btnLabel: {
    fontFamily: F.body,
    fontSize: 14,
    fontWeight: "500",
    color: P.paperWarm,
  } as TextStyle,

  resultWrap: { gap: 14 } as ViewStyle,

  card: {
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.xl,
    padding: 22,
    gap: 16,
  } as ViewStyle,
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  } as ViewStyle,
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: P.ink,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  avatarInitial: {
    fontFamily: F.heading,
    fontSize: 24,
    color: P.paperWarm,
    lineHeight: 28,
  } as TextStyle,
  name: {
    fontFamily: F.heading,
    fontSize: 20,
    fontWeight: "400",
    color: C.ink,
  } as TextStyle,
  registration: {
    fontFamily: F.mono,
    fontSize: 12,
    color: C.ink3,
    marginTop: 3,
  } as TextStyle,
  beltRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
  } as ViewStyle,
  kv: {
    fontFamily: F.body,
    fontSize: 11,
    fontWeight: "600",
    color: C.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    width: 90,
  } as TextStyle,

  section: { gap: 10 } as ViewStyle,
  sectionTitle: {
    fontFamily: F.heading,
    fontSize: 16,
    fontWeight: "400",
    color: C.ink,
    marginBottom: 2,
  } as TextStyle,
  enrollCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: 14,
  } as ViewStyle,
  enrollKind: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: R.pill,
    backgroundColor: P.redWash,
    borderWidth: 1,
    borderColor: P.redLine,
  } as ViewStyle,
  enrollKindText: {
    fontFamily: F.body,
    fontSize: 10.5,
    fontWeight: "600",
    color: P.red,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  } as TextStyle,
  enrollName: {
    fontFamily: F.body,
    fontSize: 13.5,
    fontWeight: "600",
    color: C.ink,
  } as TextStyle,
  enrollMeta: {
    fontFamily: F.body,
    fontSize: 11.5,
    color: C.ink3,
    marginTop: 2,
  } as TextStyle,
  enrollBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  } as ViewStyle,
  statusChip: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: R.pill,
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: C.border,
  } as ViewStyle,
  statusChipText: {
    fontFamily: F.body,
    fontSize: 10.5,
    fontWeight: "600",
    color: C.ink2,
  } as TextStyle,
  payChip: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: R.pill,
    backgroundColor: P.redWash,
    borderWidth: 1,
    borderColor: P.redLine,
  } as ViewStyle,
  payChipText: {
    fontFamily: F.body,
    fontSize: 10.5,
    fontWeight: "600",
    color: P.red,
  } as TextStyle,

  emptyEnroll: {
    padding: 18,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
    alignItems: "center",
  } as ViewStyle,
  emptyEnrollText: {
    fontFamily: F.body,
    fontSize: 13,
    color: C.ink3,
  } as TextStyle,

  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border2,
    backgroundColor: C.glass,
    alignSelf: "center",
    marginTop: 6,
  } as ViewStyle,
  resetLabel: {
    fontFamily: F.body,
    fontSize: 13,
    color: C.ink2,
    fontWeight: "500",
  } as TextStyle,

  foot: {
    marginTop: 48,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 16,
    alignItems: "center",
  } as ViewStyle,
  footLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  } as ViewStyle,
  footText: {
    fontFamily: F.body,
    fontSize: 12,
    color: C.ink3,
  } as TextStyle,
  footSeal: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: P.red2,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  footSealK: {
    fontFamily: F.heading,
    fontSize: 11,
    color: "#fbeee4",
    lineHeight: 14,
  } as TextStyle,
  footWord: {
    fontFamily: F.heading,
    fontSize: 14,
    fontWeight: "500",
    color: C.ink2,
  } as TextStyle,
});
