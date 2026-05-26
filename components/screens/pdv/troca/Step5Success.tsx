// ============================================================
// AURA. — PDV · Troca v3 · Step 5 — SUCESSO
//
// 24/05/2026 — Novo na v3.
// 25/05/2026 — NfceActions integrado.
// 26/05/2026 (fixes B3 + A3 da auditoria):
//   B3 — cross-filial: usa result.origin_company_id como companyId
//   fiscal (sale gravada na origem). Antes usava companyId da filial
//   física, gerando NFC-e em company_id errado.
//   A3 — split: monta payments[] array a partir de paymentSplits
//   prop (em vez de paymentMethod singular). NFC-e com split correto.
// ============================================================
import { View, Text, Pressable, StyleSheet, Linking, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { NfceActions, type NfceActionsItem } from "../NfceActions";
import type { SelectedSaleRow, PaymentSplit } from "./types";
import { fmtBRL } from "./types";
import type { NfcePaymentEntry } from "@/services/nfceApi";

type Props = {
  companyId: string;
  result: any;
  selectedSales: SelectedSaleRow[];
  returnedValue: number;
  newValue: number;
  netAmount: number;
  /** 26/05/2026: splits do TrocaModal pra montar payments[] correto em NFC-e */
  paymentSplits?: PaymentSplit[];
  onClose: () => void;
  onNew: () => void;
};

export function Step5Success({
  companyId, result, selectedSales,
  returnedValue, newValue, netAmount,
  paymentSplits,
  onClose, onNew,
}: Props) {
  const { company } = useAuthStore();
  const autoEmit = !!(company as any)?.nfce_config?.auto_emit_nfce;

  const trocaSaleId = result?.sale?.id || result?.original_sale_ids?.[0] || "";
  const isCrossFilial = Boolean(result?.cross_filial);
  const originName = selectedSales[0]?.company_name || "—";
  const nfceStrategy = result?.nfce?.strategy || result?.fiscal?.strategy || "none";
  const receiptUrl = result?.receipt_url || (trocaSaleId ? `/companies/${companyId}/print/receipt/${trocaSaleId}` : "");

  // 26/05/2026 (B3): companyId fiscal = origem da sale. Em cross-filial,
  // trocaSale.company_id é da filial origem; emitir NFC-e na física geraria
  // registro em company_id errado. Backend agora retorna origin_company_id
  // (escalar) tanto em v1 quanto em v2.
  const fiscalCompanyId =
    result?.origin_company_id ||
    (Array.isArray(result?.origin_company_ids) && result.origin_company_ids[0]) ||
    companyId;

  const newItemsRaw: any[] = Array.isArray(result?.new_items) ? result.new_items : [];
  const nfceItems: NfceActionsItem[] = newItemsRaw
    .filter((it) => it && it.product_id)
    .map((it) => ({
      product_id: String(it.product_id),
      product_name: it.product_name || it.product_name_snapshot || "Item",
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
    }));

  const customerName = result?.sale?.customer_name || null;
  // 26/05/2026 (A1): backend agora retorna customer_phone via JOIN customers
  const customerPhone = result?.sale?.customer_phone || null;

  // 26/05/2026 (A3): preferir paymentSplits (mantém split fiscal correto).
  // Se TrocaModal não passou paymentSplits ou está vazio, cai no fallback
  // singular do result.sale.payment_method.
  const hasMultipleSplits = !!(paymentSplits && paymentSplits.length >= 1 && netAmount > 0);
  const nfcePayments: NfcePaymentEntry[] | undefined = hasMultipleSplits
    ? paymentSplits!.map((p) => ({ method: p.method, value: p.amount }))
    : undefined;

  const paymentMethodFallback = (result?.sale?.payment_method || "dinheiro").toLowerCase()
    .replace("cartao_credito", "cartao")
    .replace("cartao_debito", "debito");

  const showNfce = netAmount > 0 && nfceItems.length > 0 && !!trocaSaleId && !!fiscalCompanyId;

  function openReceipt() {
    if (!receiptUrl) return;
    const fullUrl = receiptUrl.startsWith("http") ? receiptUrl : `${getApiBase()}${receiptUrl}`;
    if (Platform.OS === "web") {
      window.open(fullUrl, "_blank");
    } else {
      Linking.openURL(fullUrl).catch(() => {});
    }
  }

  function openDanfe() {
    if (!trocaSaleId) return;
    const url = `${getApiBase()}/companies/${fiscalCompanyId}/print/danfe/devolucao/${trocaSaleId}`;
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url).catch(() => {});
    }
  }

  return (
    <View style={s.wrap}>
      <View style={s.checkOuter}>
        <View style={s.check}>
          <Icon name="check" size={40} color="#fff" />
        </View>
      </View>

      <Text style={s.title}>Troca concluída!</Text>
      <Text style={s.sub}>
        {nfceStrategy === "cancel_reissue" && "NFC-e original cancelada e estoque atualizado"}
        {nfceStrategy === "devolucao_55" && "NF-e de devolução emitida e estoque atualizado"}
        {(nfceStrategy === "none" || nfceStrategy === "per_origin") && "Estoque atualizado e caixa registrado"}
      </Text>

      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardId}>
            {trocaSaleId ? `Troca #${String(trocaSaleId).slice(0, 8).toUpperCase()}` : "Nova troca"}
          </Text>
          <Text style={s.cardDate}>{fmtNow()}</Text>
        </View>

        <SummaryRow label="Venda original" value={originName} mono />
        <SummaryRow label="Devolvido" value={`${fmtBRL(returnedValue)}`} valueColor="#fb923c" />
        <SummaryRow label="Levado" value={`${fmtBRL(newValue)}`} valueColor="#6ee7b7" />

        {nfceStrategy === "devolucao_55" && (
          <SummaryRow label="NF-e devolução" value="✓ Emitida" valueColor="#6ee7b7" />
        )}
        {nfceStrategy === "cancel_reissue" && (
          <SummaryRow label="NFC-e original" value="✓ Cancelada" valueColor="#6ee7b7" />
        )}

        <View style={s.divider} />

        {netAmount > 0 ? (
          <SummaryRow label="Recebido do cliente" value={fmtBRL(netAmount)} valueColor="#10b981" big />
        ) : netAmount < 0 ? (
          <SummaryRow label="Devolvido ao cliente" value={fmtBRL(-netAmount)} valueColor="#60a5fa" big />
        ) : (
          <SummaryRow label="Troca par-a-par" value="Sem diferença" big />
        )}
      </View>

      {isCrossFilial && (
        <View style={s.xfilial}>
          <Icon name="repeat" size={14} color="#60a5fa" />
          <Text style={s.xfilialTxt}>
            Estoque devolvido para <Text style={{ fontWeight: "700", color: "#bfdbfe" }}>{originName}</Text>. Tudo sincronizado.
          </Text>
        </View>
      )}

      {/* NFC-e da venda nova — 25/05/2026 + B3/A3 fixes 26/05/2026 */}
      {showNfce && (
        <View style={s.nfceWrap}>
          <NfceActions
            companyId={fiscalCompanyId}
            saleId={trocaSaleId}
            items={nfceItems}
            total={newValue}
            customerName={customerName}
            customerPhone={customerPhone}
            payments={nfcePayments}
            paymentMethod={nfcePayments ? undefined : paymentMethodFallback}
            autoEmit={autoEmit}
          />
        </View>
      )}

      <View style={s.actionsRow}>
        <Pressable style={[s.btn, s.btnPri]} onPress={openReceipt}>
          <Icon name="printer" size={16} color="#fff" />
          <Text style={s.btnPriTxt}>Imprimir cupom</Text>
        </Pressable>
        {(nfceStrategy === "devolucao_55") && (
          <Pressable style={[s.btn, s.btnSec]} onPress={openDanfe}>
            <Icon name="file-text" size={16} color={Colors.ink} />
            <Text style={s.btnSecTxt}>Imprimir DANFE</Text>
          </Pressable>
        )}
      </View>

      <View style={s.bottomRow}>
        <Pressable onPress={onNew} style={s.btnGhost}>
          <Text style={s.btnGhostTxt}>Fazer nova troca →</Text>
        </Pressable>
        <Pressable onPress={onClose} style={s.btnGhost}>
          <Text style={s.btnGhostTxt}>Voltar ao PDV</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SummaryRow({
  label, value, valueColor, big, mono,
}: { label: string; value: string; valueColor?: string; big?: boolean; mono?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text
        style={[
          s.rowValue,
          big && { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
          mono && { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), fontSize: 13 },
          valueColor ? { color: valueColor } : null,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function fmtNow(): string {
  const d = new Date();
  return d.toLocaleDateString("pt-BR") + " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function getApiBase(): string {
  try {
    // @ts-ignore
    return (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
  } catch { return ""; }
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 20 },
  checkOuter: { marginBottom: 18 },
  check: {
    width: 88, height: 88, borderRadius: 999,
    backgroundColor: "#10b981",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#10b981", shadowOpacity: 0.6, shadowRadius: 24,
  },
  title: { fontSize: 26, fontWeight: "800", color: Colors.ink, letterSpacing: -0.4, marginBottom: 4 },
  sub: { fontSize: 13.5, color: Colors.ink2, textAlign: "center", marginBottom: 22, maxWidth: 460 },
  card: {
    width: "100%", maxWidth: 520,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.18)",
    borderRadius: 14, padding: 18, gap: 6,
  },
  cardHead: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingBottom: 12, marginBottom: 6,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  cardId: { color: Colors.ink, fontSize: 13.5, fontWeight: "700" },
  cardDate: { color: Colors.ink3, fontSize: 12 },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 7,
  },
  rowLabel: { color: Colors.ink3, fontSize: 13 },
  rowValue: { color: Colors.ink, fontSize: 13, fontWeight: "600", maxWidth: 280, textAlign: "right" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 6 },
  xfilial: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(37,99,235,0.12)",
    borderWidth: 1, borderColor: "rgba(96,165,250,0.25)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginTop: 14, maxWidth: 520,
  },
  xfilialTxt: { color: "#93c5fd", fontSize: 12.5, flex: 1 },
  nfceWrap: { width: "100%", maxWidth: 520, marginTop: 18 },
  actionsRow: {
    flexDirection: "row", gap: 10, marginTop: 22, flexWrap: "wrap",
    justifyContent: "center", width: "100%", maxWidth: 520,
  },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 12, paddingHorizontal: 18, borderRadius: 11,
    minWidth: 180,
  },
  btnPri: { backgroundColor: Colors.violet },
  btnPriTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnSec: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  btnSecTxt: { color: Colors.ink, fontSize: 14, fontWeight: "600" },
  bottomRow: { flexDirection: "row", gap: 18, marginTop: 14 },
  btnGhost: { paddingVertical: 8, paddingHorizontal: 10 },
  btnGhostTxt: { color: "#a78bfa", fontSize: 13, fontWeight: "600" },
});

export default Step5Success;
