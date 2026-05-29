// ============================================================
// AURA. — PDV · Troca v3 · Step 5 — SUCESSO
//
// 24/05/2026 — Novo na v3.
// 25/05/2026 — NfceActions integrado.
// 26/05/2026 (fixes B3 + A3 da auditoria):
//   B3 — cross-filial: usa result.origin_company_id como companyId
//   fiscal (sale gravada na origem).
//   A3 — split: monta payments[] array a partir de paymentSplits
//   prop (em vez de paymentMethod singular).
// 29/05/2026 (fase2):
//   - Status fiscal usa result.fiscal.per_origin[] (resposta real
//     do backend fase1). Substitui strings fixas por status dinamico.
// 29/05/2026 (C5+C6.2):
//   - fiscalOriginStatus cobre pendente + none + falha honestamente.
//   - Botao Reemitir nota quando ha falha ou pendente.
//   - handleReemitir usa getApiBase() + fetch com Authorization header
//     (mesmo padrao de openReceipt/openDanfe — sem fetch cru/URL relativa).
// 29/05/2026 (fix 404 DANFE/Reemitir):
//   - getApiBase() ganhou fallback de producao (Railway), igual ao
//     BASE_URL de services/api.ts. Antes retornava "" quando
//     EXPO_PUBLIC_API_URL nao estava no bundle web, gerando URL relativa
//     que o Expo Router tratava como rota interna -> "Unmatched Route".
// 29/05/2026 (DANFE autenticado):
//   - openDanfe agora baixa o PDF via fetch com Authorization + blob e
//     abre em nova aba. A rota /print/danfe/devolucao/:saleId exige auth;
//     window.open direto nao manda o Bearer -> 401. Mesmo padrao do
//     NfceActions (openPrintNfceTermica).
// ============================================================
import { useState } from "react";
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

// Retorna label + cor para cada item de fiscal.per_origin.
// Helper no escopo do modulo — nunca injetar dentro de .map().
function fiscalOriginStatus(item: any): { label: string; color: string } {
  if (!item) return { label: "Processando...", color: "#fbbf24" };
  if (item.status === "autorizada") {
    const stratLabel =
      item.strategy === "cancel_reissue" ? "NFC-e cancelada" : "NF-e emitida";
    return { label: stratLabel, color: "#4ade80" };
  }
  if (item.status === "falha") {
    return { label: "Falhou — emitir manualmente", color: "#f87171" };
  }
  if (item.status === "pendente") {
    return { label: "Pendente de emissao", color: "#fbbf24" };
  }
  if (item.status === "none") {
    return { label: "Sem nota fiscal", color: "#94a3b8" };
  }
  return { label: "Processando...", color: "#fbbf24" };
}

export function Step5Success({
  companyId, result, selectedSales,
  returnedValue, newValue, netAmount,
  paymentSplits,
  onClose, onNew,
}: Props) {
  const { company, token } = useAuthStore();
  const autoEmit = !!(company as any)?.nfce_config?.auto_emit_nfce;

  const trocaSaleId = result?.sale?.id || result?.original_sale_ids?.[0] || "";
  const isCrossFilial = Boolean(result?.cross_filial);
  const originName = selectedSales[0]?.company_name || "—";
  const nfceStrategy = result?.nfce?.strategy || result?.fiscal?.strategy || "none";
  const receiptUrl = result?.receipt_url || (trocaSaleId ? `/companies/${companyId}/print/receipt/${trocaSaleId}` : "");

  // fiscal.per_origin[] — resposta real do backend (fase1).
  // Fallback para array vazio caso backend mais antigo nao retorne o campo.
  const perOriginInit: any[] = Array.isArray(result?.fiscal?.per_origin)
    ? result.fiscal.per_origin
    : [];

  // State local para refletir reemissao sem recarregar o modal inteiro.
  const [perOriginLocal, setPerOriginLocal] = useState<any[]>(perOriginInit);
  const [reemitindo, setReemitindo] = useState(false);

  // 26/05/2026 (B3): companyId fiscal = origem da sale.
  const fiscalCompanyId =
    result?.fiscal_company_id ??
    result?.origin_company_id ??
    (Array.isArray(result?.origin_company_ids) && result.origin_company_ids[0]) ??
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
  const customerPhone = result?.sale?.customer_phone || null;

  const hasMultipleSplits = !!(paymentSplits && paymentSplits.length >= 1 && netAmount > 0);
  const nfcePayments: NfcePaymentEntry[] | undefined = hasMultipleSplits
    ? paymentSplits!.map((p) => ({ method: p.method, value: p.amount }))
    : undefined;

  const paymentMethodFallback = (result?.sale?.payment_method || "dinheiro").toLowerCase()
    .replace("cartao_credito", "cartao")
    .replace("cartao_debito", "debito");

  const showNfce = netAmount > 0 && nfceItems.length > 0 && !!trocaSaleId && !!fiscalCompanyId;

  // C6.2 — handler de reemissao fiscal.
  // Usa getApiBase() + fetch com Authorization header — mesmo padrao de
  // openReceipt/openDanfe. Sem fetch cru nem URL relativa.
  const handleReemitir = async () => {
    setReemitindo(true);
    try {
      const saleId = result?.troca?.id ?? trocaSaleId;
      const url = `${getApiBase()}/companies/${fiscalCompanyId}/troca/${saleId}/reemitir-fiscal`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await resp.json();
      if (data?.fiscal?.per_origin) {
        setPerOriginLocal(data.fiscal.per_origin);
      }
    } catch {
      // silencioso — badge permanece no estado atual
    } finally {
      setReemitindo(false);
    }
  };

  function openReceipt() {
    if (!receiptUrl) return;
    const fullUrl = receiptUrl.startsWith("http") ? receiptUrl : `${getApiBase()}${receiptUrl}`;
    if (Platform.OS === "web") {
      window.open(fullUrl, "_blank");
    } else {
      Linking.openURL(fullUrl).catch(() => {});
    }
  }

  // 29/05/2026: DANFE da NF-e 55 de devolucao. A rota exige auth, entao
  // baixamos via fetch com Authorization + blob e abrimos em nova aba
  // (mesmo padrao do NfceActions). window.open direto -> 401.
  async function openDanfe() {
    if (!trocaSaleId) return;
    const url = `${getApiBase()}/companies/${fiscalCompanyId}/print/danfe/devolucao/${trocaSaleId}`;
    try {
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) {
        let msg = "Nao foi possivel gerar o DANFE da devolucao.";
        try {
          const j = await resp.json();
          if (j?.error) msg = j.error;
        } catch {}
        if (Platform.OS === "web") window.alert(msg);
        return;
      }
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (Platform.OS === "web") {
        window.open(blobUrl, "_blank");
      } else {
        Linking.openURL(blobUrl).catch(() => {});
      }
    } catch {
      if (Platform.OS === "web") window.alert("Erro ao baixar o DANFE da devolucao.");
    }
  }

  // Texto do subtitulo baseado no resultado fiscal real.
  // Prefere perOriginLocal quando disponivel; cai em nfceStrategy como fallback.
  const subTitle = buildSubTitle(perOriginLocal, nfceStrategy);

  return (
    <View style={s.wrap}>
      <View style={s.checkOuter}>
        <View style={s.check}>
          <Icon name="check" size={40} color="#fff" />
        </View>
      </View>

      <Text style={s.title}>Troca concluida!</Text>
      <Text style={s.sub}>{subTitle}</Text>

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

        {/* Status fiscal real por origem — usa perOriginLocal para refletir reemissao */}
        {perOriginLocal.length > 0
          ? perOriginLocal.map((item: any, idx: number) => {
              const st = fiscalOriginStatus(item);
              return (
                <SummaryRow
                  key={item?.origin_sale_id || idx}
                  label={perOriginLocal.length > 1 ? `Fiscal origem ${idx + 1}` : "Fiscal"}
                  value={st.label}
                  valueColor={st.color}
                />
              );
            })
          : (
            // Fallback para backend sem per_origin (versao anterior)
            <>
              {nfceStrategy === "devolucao_55" && (
                <SummaryRow label="NF-e devolucao" value="Emitida" valueColor="#6ee7b7" />
              )}
              {nfceStrategy === "cancel_reissue" && (
                <SummaryRow label="NFC-e original" value="Cancelada" valueColor="#6ee7b7" />
              )}
            </>
          )
        }

        <View style={s.divider} />

        {netAmount > 0 ? (
          <SummaryRow label="Recebido do cliente" value={fmtBRL(netAmount)} valueColor="#10b981" big />
        ) : netAmount < 0 ? (
          <SummaryRow label="Devolvido ao cliente" value={fmtBRL(-netAmount)} valueColor="#60a5fa" big />
        ) : (
          <SummaryRow label="Troca par-a-par" value="Sem diferenca" big />
        )}
      </View>

      {/* C6.2 — botao Reemitir nota quando ha falha ou pendente */}
      {perOriginLocal.some((i) => i.status === "falha" || i.status === "pendente") && (
        <Pressable
          style={[s.reemitirBtn, reemitindo && { opacity: 0.6 }]}
          onPress={reemitindo ? undefined : handleReemitir}
          disabled={reemitindo}
        >
          <Text style={s.reemitirTxt}>
            {reemitindo ? "Reemitindo..." : "Reemitir nota"}
          </Text>
        </Pressable>
      )}

      {isCrossFilial && (
        <View style={s.xfilial}>
          <Icon name="repeat" size={14} color="#60a5fa" />
          <Text style={s.xfilialTxt}>
            Estoque devolvido para <Text style={{ fontWeight: "700", color: "#bfdbfe" }}>{originName}</Text>. Tudo sincronizado.
          </Text>
        </View>
      )}

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

// Monta subtitulo a partir do resultado fiscal real.
// Helper no escopo do modulo — nao injetar dentro de render.
function buildSubTitle(perOrigin: any[], nfceStrategy: string): string {
  if (perOrigin.length > 0) {
    const allOk = perOrigin.every((i) => i?.status === "autorizada");
    const anyFail = perOrigin.some((i) => i?.status === "falha");
    if (allOk) return "Fiscal processado · Estoque atualizado · Caixa registrado";
    if (anyFail) return "Fiscal com erro em uma origem · Estoque atualizado · Caixa registrado";
    return "Processando fiscal · Estoque atualizado · Caixa registrado";
  }
  // Fallback
  if (nfceStrategy === "cancel_reissue") return "NFC-e original cancelada e estoque atualizado";
  if (nfceStrategy === "devolucao_55") return "NF-e de devolucao emitida e estoque atualizado";
  return "Estoque atualizado e caixa registrado";
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

// 29/05/2026 (fix 404): fallback de producao igual ao BASE_URL de
// services/api.ts. Sem ele, quando EXPO_PUBLIC_API_URL nao esta no bundle
// web getApiBase() devolvia "" -> URL relativa -> "Unmatched Route".
const API_FALLBACK = "https://aura-backend-production-f805.up.railway.app/api/v1";
function getApiBase(): string {
  try {
    // @ts-ignore
    const env = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
    return env || API_FALLBACK;
  } catch { return API_FALLBACK; }
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
  reemitirBtn: {
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 10, backgroundColor: "rgba(124,58,237,0.15)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.4)",
    alignSelf: "center",
  },
  reemitirTxt: { color: "#a78bfa", fontSize: 13, fontWeight: "700" },
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
