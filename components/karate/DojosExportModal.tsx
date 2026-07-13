// ============================================================
// Exportar Dojôs (federação inteira) — MODAL seletor · Aura Karatê (Shoji)
//
// NÃO confundir com DojoExportModal.tsx (export de UM dojô, round-trip com o
// import — abas Academias/Alunos/Histórico). Este modal é o "Exportar" da
// LISTA de Dojôs: baixa uma planilha .xlsx com uma linha por dojô, seguindo
// os filtros ATIVOS na tela (status e região).
//
// Fluxo: abre pré-preenchido com o status/região que a tela de Dojôs já
// está mostrando (initialStatus/initialRegion) — a UI deixa isso explícito
// num resumo no topo — e permite ajustar antes de confirmar (mesmo espírito
// do toggle/chips do DojoExportModal). Ao confirmar, chama
// karateApi.exportDojos com os filtros escolhidos, monta o .xlsx com
// SheetJS (import dinâmico) e baixa via Blob — web-only (no nativo, mostra
// aviso "use no computador", igual ao padrão de exportAllPractitioners e
// DojoExportModal).
//
// Camadas: um ÚNICO <Modal> (sem Modal aninhado dentro de Modal — no RN Web
// isso renderiza atrás e fica invisível, já vimos esse bug 2×). Este modal é
// montado como IRMÃO do DojoFichaModal na tela de Dojôs, nunca dentro dele.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  Modal, View, Text, Pressable, TouchableOpacity, ActivityIndicator,
  Platform, useWindowDimensions, StyleSheet, ViewStyle, TextStyle, Alert,
} from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { karateApi, DojoStatus } from "@/services/karateApi";

interface Props {
  federationId: string;
  visible: boolean;
  onClose: () => void;
  /** Filtros ATUAIS da tela de Dojôs — pré-preenchem o seletor. */
  initialStatus: DojoStatus | "all";
  initialRegion: string | "all";
  /** Catálogo de regiões (mesmo `allRegions` já carregado pela tela). */
  regions: string[];
}

const STATUS_LABEL: Record<string, string> = { active: "Ativo", inactive: "Inativo" };
// Plano de anuidade REAL (anual|semestral|trimestral) — NÃO confundir com o
// extinto "Modelo de Filiação" (affiliation_model, decorativo/legado,
// removido desta planilha em 13/07/2026: mostrava "Anual" pra dojô nenhum
// plano definido, contradizendo a ficha do dojô). Sem plano → "Não definido",
// nunca inventado.
const ANNUITY_PLAN_LABEL_XLSX: Record<string, string> = { anual: "Anual", semestral: "Semestral", trimestral: "Trimestral" };

const STATUS_CHIPS: { key: DojoStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativo" },
  { key: "inactive", label: "Inativo" },
];

const slug = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

export function DojosExportModal({ federationId, visible, onClose, initialStatus, initialRegion, regions }: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(560, width - 24);

  const [status, setStatus] = useState<DojoStatus | "all">(initialStatus);
  const [region, setRegion] = useState<string | "all">(initialRegion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sincroniza com os filtros da tela toda vez que o modal abre — se o
  // usuário mudou status/região na tela, ajustou e reabriu, o seletor deve
  // refletir o estado atual da tela (não um valor "grudado" de uma abertura
  // anterior).
  useEffect(() => {
    if (visible) {
      setStatus(initialStatus);
      setRegion(initialRegion);
      setError(null);
    }
  }, [visible, initialStatus, initialRegion]);

  const statusLabel = status === "all" ? "Todos" : STATUS_LABEL[status] || status;
  const regionLabel = region === "all" ? "Todas" : region;

  const handleExport = useCallback(async () => {
    setError(null);
    if (Platform.OS !== "web") {
      Alert.alert("Use no computador", "A exportação de planilha funciona no Aura pelo navegador (desktop).");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const data = await karateApi.exportDojos(federationId, {
        status: status === "all" ? undefined : status,
        region: region === "all" ? undefined : region,
      });

      // perf: xlsx (~1MB) carregado sob demanda, fora do bundle inicial
      const xlsx = await import("xlsx");
      const headers = [
        "Dojô", "Código FPKT", "Status", "Região", "Plano de Anuidade",
        "CNPJ", "Telefone", "Celular", "E-mail", "Cidade", "Estado",
        "Total de Praticantes", "Praticantes Ativos",
      ];
      const rows = data.dojos.map((d) => [
        d.nome || "",
        d.codigo_fpkt || "",
        STATUS_LABEL[d.status] || d.status || "",
        d.regiao || "",
        d.plano_anuidade ? (ANNUITY_PLAN_LABEL_XLSX[d.plano_anuidade] || d.plano_anuidade) : "Não definido",
        d.cnpj || "",
        d.telefone || "",
        d.telefone_celular || "",
        d.email || "",
        d.cidade || "",
        d.estado || "",
        String(d.total_praticantes ?? 0),
        String(d.praticantes_ativos ?? 0),
      ]);
      const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Dojôs");

      const today = new Date().toISOString().slice(0, 10);
      // Nome do arquivo reflete os filtros escolhidos (ex.:
      // FPKT_dojos_ativos_2026-07-11.xlsx), para o usuário nunca achar que
      // baixou a federação inteira quando exportou filtrado.
      const statusSlug = status === "all" ? "" : status === "active" ? "_ativos" : "_inativos";
      const regionSlug = region === "all" ? "" : `_${slug(region)}`;
      const fname = `FPKT_dojos${statusSlug}${regionSlug}_${today}.xlsx`;

      const out = xlsx.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      setBusy(false);
      onClose();
    } catch (e: any) {
      setBusy(false);
      setError(e?.message || "Não foi possível exportar os dojôs. Tente novamente.");
    }
  }, [federationId, status, region, busy, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { width: cardW }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>空  FPKT · Exportar</Text>
              <Text style={styles.title}>Exportar dojôs<Text style={{ color: P.red }}>.</Text></Text>
              <Text style={styles.sub}>
                A exportação segue os filtros da tela de Dojôs. Confirme ou ajuste antes de baixar a planilha (.xlsx).
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}><Icon name="x" size={20} color={P.ink2} /></TouchableOpacity>
          </View>

          <View style={{ padding: 20, paddingTop: 14 }}>
            {/* Resumo explícito dos filtros que serão aplicados */}
            <View style={styles.summaryBox}>
              <Icon name="filter" size={14} color={P.ink2} />
              <Text style={styles.summaryTxt}>
                Filtros da página: <Text style={styles.summaryStrong}>Status = {statusLabel}</Text>
                {"  ·  "}
                <Text style={styles.summaryStrong}>Região = {regionLabel}</Text>
              </Text>
            </View>

            {/* Status */}
            <Text style={styles.label}>Status</Text>
            <View style={styles.chips}>
              {STATUS_CHIPS.map((s) => {
                const on = status === s.key;
                return (
                  <TouchableOpacity key={s.key} style={[styles.chip, on && styles.chipOn]} onPress={() => setStatus(s.key)} activeOpacity={0.85} accessibilityLabel={`Status ${s.label}`}>
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Região */}
            {regions.length > 0 && (
              <>
                <Text style={[styles.label, { marginTop: 18 }]}>Região</Text>
                <View style={[styles.chips, { flexWrap: "wrap" }]}>
                  <TouchableOpacity style={[styles.chip, region === "all" && styles.chipOn]} onPress={() => setRegion("all")} activeOpacity={0.85} accessibilityLabel="Região Todas">
                    <Text style={[styles.chipTxt, region === "all" && styles.chipTxtOn]}>Todas</Text>
                  </TouchableOpacity>
                  {regions.map((r) => {
                    const on = region === r;
                    return (
                      <TouchableOpacity key={r} style={[styles.chip, on && styles.chipOn]} onPress={() => setRegion(r)} activeOpacity={0.85} accessibilityLabel={`Região ${r}`}>
                        <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{r}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {error ? (
              <View style={styles.errBox}><Icon name="alert_circle" size={15} color={P.red} /><Text style={styles.errTxt}>{error}</Text></View>
            ) : null}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.btnGhost}><Text style={styles.btnGhostTxt}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleExport} disabled={busy} style={[styles.btnPrimary, busy && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Exportar planilha de dojôs">
              {busy ? <ActivityIndicator color="#fdf8f2" size="small" /> : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="download" size={16} color="#fdf8f2" />
                  <Text style={styles.btnPrimaryTxt}>Exportar .xlsx</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, overflow: "hidden", maxHeight: "92%", borderWidth: 1, borderColor: P.line2 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 22, color: P.ink, marginTop: 2 } as TextStyle,
  sub: { fontFamily: F.body, fontSize: 12.5, color: P.ink2, marginTop: 4, lineHeight: 17 } as TextStyle,
  close: { padding: 4, borderRadius: 999 } as ViewStyle,

  summaryBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: P.paper3, borderWidth: 1, borderColor: P.line, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 18 } as ViewStyle,
  summaryTxt: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: P.ink2, lineHeight: 17 } as TextStyle,
  summaryStrong: { fontWeight: "700", color: P.ink } as TextStyle,

  label: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 8, textTransform: "uppercase" } as TextStyle,

  chips: { flexDirection: "row", gap: 8 } as ViewStyle,
  chip: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glassHi } as ViewStyle,
  chipOn: { borderColor: P.red, backgroundColor: P.redWash } as ViewStyle,
  chipTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: P.ink2 } as TextStyle,
  chipTxtOn: { color: P.red } as TextStyle,

  errBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11, marginTop: 14 } as ViewStyle,
  errTxt: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  btnGhost: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: R.md, borderWidth: 1, borderColor: P.line2 } as ViewStyle,
  btnGhostTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: R.md, backgroundColor: P.ink, minWidth: 160, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
});

export default DojosExportModal;
