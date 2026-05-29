import { View, Text, StyleSheet, Pressable, Platform, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { Icon } from "@/components/Icon";
import type { NfceEmission, NfceStatus } from "@/services/nfceApi";

// Tipo legado mantido por componentes que ainda chamam nfeApi (a aba NFS-e vai
// ser repointada num PR separado). Para a aba Documentos usamos NfceEmission.
export type NfeDoc = {
  id: string; ref: string; type: string; status: string;
  number: string | null; recipient_name: string; description: string;
  value: number; issued_at: string | null; cancelled_at: string | null; created_at: string;
};

// Aba Configuração some — certificado A1 é cadastrado direto via console
// da Nuvem Fiscal (decisão registrada no plano).
export const TABS = ["Documentos", "Emitir NFS-e", "Emitir NFC-e"];

export const fmt = (n: number) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// Status do nfce_emissions (autorizada/processando/etc.) — fonte de verdade
// agora que a aba Documentos consome o /nfce do backend.
export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  autorizada:  { label: "Autorizada",  color: Colors.green },
  cancelada:   { label: "Cancelada",   color: Colors.red },
  rejeitada:   { label: "Rejeitada",   color: Colors.red },
  processando: { label: "Processando", color: Colors.violet3 },
  erro:        { label: "Erro",        color: Colors.red },
  // Legado nfe_documents — mantido pra retrocompat enquanto NFS-e ainda usa
  authorized:  { label: "Autorizada",  color: Colors.green },
  cancelled:   { label: "Cancelada",   color: Colors.red },
  pending:     { label: "Pendente",    color: Colors.amber },
  processing:  { label: "Processando", color: Colors.violet3 },
  error:       { label: "Erro",        color: Colors.red },
};

export function StatusBadge({ status }: { status: string }) {
  const st = STATUS_MAP[status] || STATUS_MAP.processando;
  return <View style={[ns.badge, { backgroundColor: st.color + "18" }]}><Text style={[ns.badgeText, { color: st.color }]}>{st.label}</Text></View>;
}

// ── EmissionRow: novo formato consumindo /nfce do backend ──────
// onReemit é opcional — só usado quando status === 'rejeitada'.
// Mantemos o mesmo padrão visual de Ver/Cancelar (miniBtn) pra reduzir
// peso visual e deixar claro que é uma ação no nível do card.
export function EmissionRow({
  emission,
  onCancel,
  onView,
  onReemit,
}: {
  emission: NfceEmission;
  onCancel: () => void;
  onView: () => void;
  onReemit?: () => void;
}) {
  const typeLabel = emission.tipo === "nfe" ? "NF-e" : "NFC-e";
  const dateStr = emission.authorized_at || emission.created_at;
  const recipient = emission.customer_name || (emission.customer_cpf ? "CPF " + emission.customer_cpf : "Consumidor");

  return (
    <View style={ns.docRow}>
      <View style={ns.docIcon}><Icon name="file_text" size={16} color={Colors.violet3} /></View>
      <View style={ns.docInfo}>
        <Text style={ns.docNumber}>#{emission.numero || "—"} · {typeLabel} · S{emission.serie}</Text>
        <Text style={ns.docRecipient} numberOfLines={1}>{recipient}</Text>
        <Text style={ns.docDate}>{new Date(dateStr).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</Text>
        {emission.error_message && (
          <Text style={[ns.docDate, { color: Colors.red }]} numberOfLines={2}>
            {emission.error_message}
          </Text>
        )}
      </View>
      <View style={ns.docRight}>
        <Text style={ns.docAmount}>{fmt(emission.total_nfce)}</Text>
        <StatusBadge status={emission.status} />
        <View style={{ flexDirection: "row", gap: 4, marginTop: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Pressable onPress={onView} style={ns.miniBtn}>
            <Text style={ns.miniBtnText}>{emission.pdf_url ? "PDF" : "Ver"}</Text>
          </Pressable>
          {emission.status === "autorizada" && (
            <Pressable onPress={onCancel} style={[ns.miniBtn, { borderColor: Colors.red + "33" }]}>
              <Text style={[ns.miniBtnText, { color: Colors.red }]}>Cancelar</Text>
            </Pressable>
          )}
          {emission.status === "rejeitada" && onReemit && (
            <Pressable
              onPress={onReemit}
              style={[ns.miniBtn, { borderColor: Colors.violet3 + "55", backgroundColor: Colors.violetD }]}
              accessibilityLabel={`Reemitir nota ${emission.numero}`}
            >
              <Text style={[ns.miniBtnText, { color: Colors.violet3 }]}>Reemitir</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// Helper: abre PDF do DANFE em nova aba (web) ou via Linking (mobile)
export function openDanfe(url: string | null) {
  if (!url) return;
  if (Platform.OS === "web" && typeof window !== "undefined") window.open(url, "_blank");
  else Linking.openURL(url);
}

// ── DocRow legado — usado pela aba NFS-e enquanto não migra ────
export function DocRow({ doc, onCancel, onView }: { doc: NfeDoc; onCancel: () => void; onView: () => void }) {
  const typeLabel = doc.type === "nfse" ? "NFS-e" : doc.type === "nfce" ? "NFC-e" : "NF-e";
  return (
    <View style={ns.docRow}>
      <View style={ns.docIcon}><Icon name="file_text" size={16} color={Colors.violet3} /></View>
      <View style={ns.docInfo}>
        <Text style={ns.docNumber}>#{doc.number || "---"} - {typeLabel}</Text>
        <Text style={ns.docRecipient}>{doc.recipient_name || "Consumidor"}</Text>
        <Text style={ns.docDate}>{doc.issued_at ? new Date(doc.issued_at).toLocaleDateString("pt-BR") : new Date(doc.created_at).toLocaleDateString("pt-BR")}</Text>
      </View>
      <View style={ns.docRight}>
        <Text style={ns.docAmount}>{fmt(doc.value)}</Text>
        <StatusBadge status={doc.status} />
        <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
          <Pressable onPress={onView} style={ns.miniBtn}><Text style={ns.miniBtnText}>Ver</Text></Pressable>
          {doc.status === "authorized" && <Pressable onPress={onCancel} style={[ns.miniBtn, { borderColor: Colors.red + "33" }]}><Text style={[ns.miniBtnText, { color: Colors.red }]}>Cancelar</Text></Pressable>}
        </View>
      </View>
    </View>
  );
}

export const ns = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }, badgeText: { fontSize: 9, fontWeight: "700" },
  docRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  docIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  docInfo: { flex: 1, gap: 2 },
  docNumber: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  docRecipient: { fontSize: 11, color: Colors.ink3 }, docDate: { fontSize: 10, color: Colors.ink3 },
  docRight: { alignItems: "flex-end", gap: 4 },
  docAmount: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  miniBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  miniBtnText: { fontSize: 10, color: Colors.violet3, fontWeight: "600" },
  formCard: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  formTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  formHint: { fontSize: 12, color: Colors.ink3, marginBottom: 16 },
  formRow: { flexDirection: IS_WIDE ? "row" : "column", gap: IS_WIDE ? 12 : 0, marginBottom: 4 },
  fLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  fInput: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" }, chipTextActive: { color: Colors.violet3, fontWeight: "600" },
  emitBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  emitBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  configItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  configLabel: { flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "600" },
  configValue: { fontSize: 12, fontWeight: "600" },
  configBtn: { backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2, alignSelf: "flex-start" },
  configBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  infoText: { fontSize: 11, color: Colors.ink3, flex: 1, lineHeight: 16 },
});
