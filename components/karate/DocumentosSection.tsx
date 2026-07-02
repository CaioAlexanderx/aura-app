// ============================================================
// DocumentosSection — Aura Karatê · Fase 2 (anexos/documentos)
//
// Seção reutilizável de upload/lista/download/exclusão de documentos,
// usada na aba "Documentos" do praticante e numa seção nova do dojô.
// Contrato: services/karateApi.ts (listDocuments/uploadDocument/
// getDocumentDownload/deleteDocument).
//
// MVP web-first: upload real só em Platform.OS === "web" (input file
// dinâmico + FileReader.readAsDataURL → extrai o base64 puro). Em
// nativo mostramos um aviso neutro em vez de quebrar a tela.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ViewStyle, TextStyle,
  TouchableOpacity, TextInput, ActivityIndicator, Platform, Linking,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { KarateEmptyState as EmptyState } from "@/components/karate/EmptyState";
import { KarateButton } from "@/components/karate/KarateButton";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { toast } from "@/components/Toast";
import { karateApi, KarateDocument, DocumentOwnerType } from "@/services/karateApi";
import { formatEventDateNumeric } from "@/utils/eventDate";

interface DocumentosSectionProps {
  federationId: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  canEdit: boolean;
}

const ACCEPT = "image/*,.pdf,.doc,.docx";

/** bytes → "12,4 KB" / "3,1 MB" (pt-BR, 1 casa decimal a partir de KB). */
function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace(".", ",")} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}

export function DocumentosSection({ federationId, ownerType, ownerId, canEdit }: DocumentosSectionProps) {
  const [docs, setDocs] = useState<KarateDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [storageMockWarning, setStorageMockWarning] = useState(false);

  // Fluxo simples: escolher arquivo primeiro, depois pedir a nota (opcional)
  // num pequeno formulário inline antes de confirmar o envio.
  const [pendingFile, setPendingFile] = useState<{ file: File; content: string } | null>(null);
  const [note, setNote] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(() => {
    if (!ownerId) return;
    setError(false);
    karateApi.listDocuments(federationId, ownerType, ownerId)
      .then((res) => setDocs(res.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [federationId, ownerType, ownerId]);

  useEffect(() => { load(); }, [load]);

  // ── Upload (web) ────────────────────────────────────────────────
  function openFilePicker() {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (!fileInputRef.current) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ACCEPT;
      input.style.display = "none";
      input.onchange = handleFileSelected;
      document.body.appendChild(input);
      fileInputRef.current = input;
    }
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  }

  function handleFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      // "data:<mime>;base64,AAAA..." → mantém só o base64 puro.
      const commaIdx = result.indexOf(",");
      const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
      setPendingFile({ file, content: base64 });
      setNote("");
    };
    reader.onerror = () => {
      toast.error("Não foi possível ler o arquivo selecionado.");
    };
    reader.readAsDataURL(file);
  }

  function cancelPendingUpload() {
    setPendingFile(null);
    setNote("");
  }

  async function confirmUpload() {
    if (!pendingFile || uploading) return;
    setUploading(true);
    try {
      const result = await karateApi.uploadDocument(federationId, ownerType, ownerId, {
        content: pendingFile.content,
        filename: pendingFile.file.name,
        content_type: pendingFile.file.type || undefined,
        note: note.trim() || undefined,
      });
      if (result?.storage_mock) setStorageMockWarning(true);
      toast.success("Documento enviado.");
      setPendingFile(null);
      setNote("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível enviar o documento.");
    } finally {
      setUploading(false);
    }
  }

  // ── Download ────────────────────────────────────────────────────
  async function handleDownload(doc: KarateDocument) {
    if (downloadingId) return;
    setDownloadingId(doc.id);
    try {
      const res = await karateApi.getDocumentDownload(federationId, ownerType, ownerId, doc.id);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(res.url, "_blank");
      } else {
        await Linking.openURL(res.url);
      }
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível baixar o documento.");
    } finally {
      setDownloadingId(null);
    }
  }

  // ── Exclusão ────────────────────────────────────────────────────
  async function handleDelete(doc: KarateDocument) {
    if (deletingId) return;
    const ok = await confirmAsync({
      title: "Excluir documento?",
      message: "Excluir documento? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(doc.id);
    try {
      await karateApi.deleteDocument(federationId, ownerType, ownerId, doc.id);
      toast.success("Documento excluído.");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível excluir o documento.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <View style={styles.container}>
      {storageMockWarning && (
        <View style={styles.warningBanner}>
          <Icon name="alert" size={14} color={KarateColors.alert} />
          <Text style={styles.warningText}>
            Armazenamento em modo de teste — os arquivos podem não persistir.
          </Text>
        </View>
      )}

      {canEdit && (
        <View style={styles.uploadArea}>
          {Platform.OS === "web" ? (
            pendingFile ? (
              <View style={styles.pendingBox}>
                <View style={styles.pendingHeader}>
                  <Icon name="document-outline" size={16} color={KarateColors.ink2} />
                  <Text style={styles.pendingFilename} numberOfLines={1}>{pendingFile.file.name}</Text>
                </View>
                <Text style={styles.fieldLabel}>Nota (opcional)</Text>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Ex.: RG do responsável"
                  placeholderTextColor={KarateColors.ink4}
                  editable={!uploading}
                  accessibilityLabel="Nota do documento"
                />
                <View style={styles.pendingActions}>
                  <KarateButton
                    label={uploading ? "Enviando..." : "Enviar documento"}
                    onPress={confirmUpload}
                    loading={uploading}
                    disabled={uploading}
                    size="sm"
                  />
                  <KarateButton
                    label="Cancelar"
                    onPress={cancelPendingUpload}
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                  />
                </View>
              </View>
            ) : (
              <KarateButton
                label="Adicionar documento"
                onPress={openFilePicker}
                variant="secondary"
                size="sm"
              />
            )
          ) : (
            <View style={styles.nativeNotice}>
              <Icon name="alert" size={14} color={KarateColors.ink3} />
              <Text style={styles.nativeNoticeText}>Upload de documentos disponível no navegador.</Text>
            </View>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={KarateColors.primary} style={{ marginVertical: 24 }} />
      ) : error ? (
        <EmptyState
          icon="alert"
          title="Não foi possível carregar os documentos"
          subtitle="Verifique sua conexão e tente novamente."
          style={{ paddingVertical: 32 }}
        />
      ) : docs.length === 0 ? (
        <EmptyState
          icon="document-outline"
          title="Nenhum documento anexado ainda."
          style={{ paddingVertical: 32 }}
        />
      ) : (
        <View style={styles.list}>
          {docs.map((doc) => (
            <View key={doc.id} style={styles.docRow}>
              <View style={styles.docIconWrap}>
                <Icon name="document-outline" size={18} color={KarateColors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docFilename} numberOfLines={1}>{doc.filename}</Text>
                <Text style={styles.docMeta}>
                  {formatBytes(doc.size_bytes)} · {formatEventDateNumeric(doc.created_at)}
                </Text>
                {doc.note ? <Text style={styles.docNote} numberOfLines={2}>{doc.note}</Text> : null}
              </View>
              <View style={styles.docActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Baixar ${doc.filename}`}
                >
                  {downloadingId === doc.id ? (
                    <ActivityIndicator size="small" color={KarateColors.ink2} />
                  ) : (
                    <Icon name="download" size={15} color={KarateColors.ink2} />
                  )}
                </TouchableOpacity>
                {canEdit && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Excluir ${doc.filename}`}
                  >
                    {deletingId === doc.id ? (
                      <ActivityIndicator size="small" color={KarateColors.danger} />
                    ) : (
                      <Icon name="trash" size={15} color={KarateColors.danger} />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 } as ViewStyle,

  warningBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: KarateColors.dangerSoft ?? "rgba(184,70,58,0.10)",
    borderWidth: 1, borderColor: KarateColors.alert, borderRadius: KarateRadius.md,
    paddingVertical: 10, paddingHorizontal: 12,
  } as ViewStyle,
  warningText: { flex: 1, fontFamily: KarateFonts.body, fontSize: 12.5, color: KarateColors.ink } as TextStyle,

  uploadArea: { alignItems: "flex-start" } as ViewStyle,

  pendingBox: {
    width: "100%", backgroundColor: KarateColors.surface, borderWidth: 1,
    borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, gap: 8,
  } as ViewStyle,
  pendingHeader: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  pendingFilename: { flex: 1, fontFamily: KarateFonts.body, fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  pendingActions: { flexDirection: "row", gap: 8, marginTop: 4 } as ViewStyle,

  fieldLabel: { fontFamily: KarateFonts.body, fontSize: 11, fontWeight: "700", color: KarateColors.ink3, letterSpacing: 0.3 } as TextStyle,
  noteInput: {
    fontFamily: KarateFonts.body, fontSize: 13, color: KarateColors.ink,
    backgroundColor: "#fff", borderWidth: 1, borderColor: KarateColors.border,
    borderRadius: KarateRadius.sm, paddingHorizontal: 10, paddingVertical: 9,
  } as TextStyle,

  nativeNotice: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.surface,
    borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md,
    paddingVertical: 10, paddingHorizontal: 12,
  } as ViewStyle,
  nativeNoticeText: { fontFamily: KarateFonts.body, fontSize: 12.5, color: KarateColors.ink3 } as TextStyle,

  list: { gap: 8 } as ViewStyle,
  docRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 12,
  } as ViewStyle,
  docIconWrap: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: KarateColors.primarySoft,
    alignItems: "center", justifyContent: "center",
  } as ViewStyle,
  docFilename: { fontFamily: KarateFonts.body, fontSize: 13.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  docMeta: { fontFamily: KarateFonts.body, fontSize: 11.5, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  docNote: { fontFamily: KarateFonts.body, fontSize: 12, color: KarateColors.ink2, marginTop: 3 } as TextStyle,
  docActions: { flexDirection: "row", gap: 6 } as ViewStyle,
  actionBtn: {
    width: 30, height: 30, borderRadius: KarateRadius.sm, borderWidth: 1,
    borderColor: KarateColors.border, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  } as ViewStyle,
});

export default DocumentosSection;
