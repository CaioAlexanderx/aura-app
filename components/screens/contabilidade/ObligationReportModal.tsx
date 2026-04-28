// ============================================================
// ObligationReportModal - PR38 (2026-04-28)
//
// Modal que aciona POST /companies/:cid/obligations/:code/report
// e mostra o relatorio gerado pela Aura com:
//  - Conteudo formatado (txt/csv/json/xml/guide_text inline)
//  - Resumo de uma linha
//  - Instrucoes numeradas (passos pra entregar no portal)
//  - Link do portal externo (Receita, Anvisa, CRO, Vigilancia)
//  - Botao "Baixar arquivo" pra salvar o relatorio
//
// Uso: <ObligationReportModal visible={open} obligation={...} onClose={...} />
// ============================================================

import { useState, useEffect } from "react";
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator, Linking, Platform, StyleSheet } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

interface ReportPayload {
  code: string;
  name: string;
  description?: string;
  format: "pdf" | "csv" | "json" | "xml" | "txt" | "guide_text";
  filename: string;
  content: string;
  summary: string;
  instructions: string[];
  help_url?: string | null;
  generated_at: string;
}

interface Props {
  visible: boolean;
  obligationCode: string | null;
  obligationName?: string;
  onClose: () => void;
}

export function ObligationReportModal({ visible, obligationCode, obligationName, onClose }: Props) {
  const cid = useAuthStore().company?.id;
  const [report, setReport] = useState<ReportPayload | null>(null);

  const reportMut = useMutation({
    mutationFn: () =>
      request<{ report: ReportPayload }>(
        `/companies/${cid}/obligations/${obligationCode}/report`,
        { method: "POST", body: {} }
      ),
    onSuccess: (data) => setReport(data.report),
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao gerar relatorio"),
  });

  useEffect(() => {
    if (visible && obligationCode && cid && !report) {
      reportMut.mutate();
    }
    if (!visible) {
      setReport(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, obligationCode, cid]);

  function handleDownload() {
    if (!report) return;
    if (Platform.OS !== "web" || typeof document === "undefined") {
      toast.info("Download disponivel apenas na web");
      return;
    }
    try {
      const mimeMap: Record<string, string> = {
        json: "application/json",
        csv: "text/csv",
        txt: "text/plain",
        guide_text: "text/plain",
        xml: "application/xml",
        pdf: "application/pdf",
      };
      const mime = mimeMap[report.format] || "text/plain";
      const blob = new Blob([report.content], { type: mime + ";charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = report.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Arquivo baixado");
    } catch (e) {
      toast.error("Erro ao baixar");
    }
  }

  function handleCopy() {
    if (!report) return;
    if (Platform.OS === "web" && navigator?.clipboard) {
      navigator.clipboard.writeText(report.content);
      toast.success("Copiado");
    }
  }

  function openPortal() {
    if (report?.help_url) Linking.openURL(report.help_url).catch(() => {});
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.modal}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{obligationName || obligationCode || "Relatorio"}</Text>
              <Text style={s.subtitle}>Relatorio gerado pela Aura</Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Icon name="x" size={18} color={Colors.ink3} />
            </Pressable>
          </View>

          {reportMut.isPending && !report ? (
            <View style={s.center}>
              <ActivityIndicator color={Colors.violet3} size="large" />
              <Text style={s.hint}>Gerando relatorio com base nos seus dados...</Text>
            </View>
          ) : reportMut.isError ? (
            <View style={s.center}>
              <Icon name="alert" size={28} color={Colors.red} />
              <Text style={s.errText}>Nao foi possivel gerar o relatorio.</Text>
              <Pressable onPress={() => reportMut.mutate()} style={s.btnRetry}>
                <Text style={s.btnRetryText}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : report ? (
            <ScrollView style={{ maxHeight: 480 }}>
              {/* Summary */}
              <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>📋 RESUMO</Text>
                <Text style={s.summaryText}>{report.summary}</Text>
                <Text style={s.formatBadge}>
                  Formato: {report.format.toUpperCase()} · Arquivo: {report.filename}
                </Text>
              </View>

              {/* Conteudo do relatorio */}
              <View style={s.contentCard}>
                <View style={s.contentHeader}>
                  <Text style={s.contentLabel}>📄 CONTEUDO</Text>
                  <Pressable onPress={handleCopy} style={s.btnCopySmall}>
                    <Icon name="copy" size={11} color={Colors.violet3} />
                    <Text style={s.btnCopyText}>Copiar</Text>
                  </Pressable>
                </View>
                <View style={s.contentPre}>
                  <Text style={s.preText} selectable>{report.content}</Text>
                </View>
              </View>

              {/* Instrucoes */}
              {report.instructions && report.instructions.length > 0 && (
                <View style={s.instructionsCard}>
                  <Text style={s.instructionsLabel}>✅ COMO ENTREGAR</Text>
                  {report.instructions.map((step, i) => (
                    <Text key={i} style={s.instructionItem}>{step}</Text>
                  ))}
                </View>
              )}
            </ScrollView>
          ) : null}

          {/* Footer com acoes */}
          <View style={s.footer}>
            {report?.help_url && (
              <Pressable onPress={openPortal} style={s.btnPortal}>
                <Icon name="globe" size={13} color="#fff" />
                <Text style={s.btnPortalText}>Abrir portal</Text>
              </Pressable>
            )}
            {report && (
              <Pressable onPress={handleDownload} style={s.btnDownload}>
                <Icon name="package" size={13} color="#fff" />
                <Text style={s.btnDownloadText}>Baixar arquivo</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} style={s.btnClose}>
              <Text style={s.btnCloseText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 640, backgroundColor: Colors.bg2, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  title: { fontSize: 17, fontWeight: "800", color: Colors.ink },
  subtitle: { fontSize: 11, color: Colors.violet3, marginTop: 2, fontWeight: "600" },
  closeBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },
  center: { padding: 40, alignItems: "center", gap: 10 },
  hint: { fontSize: 12, color: Colors.ink3, textAlign: "center" },
  errText: { fontSize: 13, color: Colors.ink, textAlign: "center" },
  btnRetry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.violet, marginTop: 10 },
  btnRetryText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  summaryCard: { padding: 14, backgroundColor: Colors.violetD, borderRadius: 10, margin: 16, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: Colors.violet },
  summaryLabel: { fontSize: 9, color: Colors.violet3, fontWeight: "700", letterSpacing: 1.4, marginBottom: 6 },
  summaryText: { fontSize: 13, color: Colors.ink, lineHeight: 19, fontWeight: "500" },
  formatBadge: { fontSize: 10, color: Colors.ink3, marginTop: 8, fontStyle: "italic" },

  contentCard: { margin: 16, marginTop: 8, marginBottom: 8 },
  contentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  contentLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 1.2 },
  btnCopySmall: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Colors.violetD, borderRadius: 5, borderWidth: 1, borderColor: Colors.border2 },
  btnCopyText: { fontSize: 10, color: Colors.violet3, fontWeight: "600" },
  contentPre: { backgroundColor: Colors.bg3, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, maxHeight: 280 },
  preText: { fontSize: 11, color: Colors.ink, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), lineHeight: 16 },

  instructionsCard: { margin: 16, marginTop: 8, padding: 12, backgroundColor: Colors.greenD, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: Colors.green },
  instructionsLabel: { fontSize: 9, color: Colors.green, fontWeight: "700", letterSpacing: 1.4, marginBottom: 8 },
  instructionItem: { fontSize: 12, color: Colors.ink, lineHeight: 18, marginBottom: 4 },

  footer: { flexDirection: "row", gap: 6, padding: 12, borderTopWidth: 1, borderTopColor: Colors.border, flexWrap: "wrap" },
  btnPortal: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: Colors.violet },
  btnPortalText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  btnDownload: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: Colors.green },
  btnDownloadText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  btnClose: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border, marginLeft: "auto" },
  btnCloseText: { color: Colors.ink2, fontSize: 12, fontWeight: "600" },
});

// ============================================================
// ObligationReportTrigger - botao "Gerar relatorio Aura" auto-contido
// Pode ser plugado em qualquer obligation row no Guide ou Timeline.
// ============================================================
export function ObligationReportTrigger({ obligationCode, obligationName }: { obligationCode: string; obligationName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row", alignItems: "center", gap: 6,
          paddingHorizontal: 12, paddingVertical: 8,
          backgroundColor: Colors.violet, borderRadius: 8,
          alignSelf: "flex-start",
        }}
      >
        <Text style={{ fontSize: 12 }}>✨</Text>
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Gerar relatorio Aura</Text>
      </Pressable>
      <ObligationReportModal
        visible={open}
        obligationCode={obligationCode}
        obligationName={obligationName}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export default ObligationReportModal;
