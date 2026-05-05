import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, Image, Linking } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";
import { nfceApi, type EmitResponse } from "@/services/nfceApi";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import type { SaleResult } from "@/hooks/useCart";
import { PAYMENTS } from "@/hooks/useCart";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// QR code rendering: usamos api.qrserver.com (público, free) com a string
// completa do qrCode que a Nuvem Fiscal devolve em infNFeSupl.qrCode.
// Funciona em web e mobile via React Native Image.
function buildQrImageUrl(qrText: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(qrText)}&margin=8`;
}

async function openPrintReceipt(companyId: string, saleId: string, token: string | null) {
  if (!token || !companyId) { toast.error("Sessao expirada"); return; }
  if (Platform.OS !== "web" || typeof window === "undefined") {
    toast.info("Impressao disponivel apenas na versao web");
    return;
  }
  try {
    const res = await fetch(`${BASE_URL}/companies/${companyId}/print/receipt/${saleId}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { toast.error("Erro ao gerar cupom"); return; }
    const html = await res.text();
    const win = window.open("", "_blank", "width=420,height=700,scrollbars=yes");
    if (win) { win.document.write(html); win.document.close(); }
    else toast.error("Pop-up bloqueado. Permita pop-ups para imprimir.");
  } catch { toast.error("Erro ao gerar cupom"); }
}

function openExternal(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") window.open(url, "_blank");
  else Linking.openURL(url);
}

// Constrói wa.me link; assume número BR. Strip não-dígitos. Se não tem
// 55 no começo, adiciona. Se < 10 dígitos, retorna null (inválido).
function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (!d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(message)}`;
}

type EmitState = "idle" | "emitting" | "authorized" | "rejected" | "error";

export function SaleComplete({ sale, onNewSale }: { sale: SaleResult; onNewSale: () => void }) {
  const { company, token } = useAuthStore();
  const subtotal = sale.items.reduce((s, i) => s + i.price * i.qty, 0);
  const hasCoupon = !!(sale.couponCode && sale.couponDiscount && sale.couponDiscount > 0);

  const [emitState, setEmitState] = useState<EmitState>("idle");
  const [emitResult, setEmitResult] = useState<EmitResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorPayload, setErrorPayload] = useState<any>(null);

  const emitMut = useMutation({
    mutationFn: () => {
      if (!company?.id) throw new Error("Empresa não identificada");
      return nfceApi.emit(company.id, {
        items: sale.items.map(i => ({
          product_id: i.productId.split("__")[0],
          product_name: i.name,
          quantity: i.qty,
          unit_price: i.price,
        })),
        sale_id: sale.id,
        customer_cpf:  sale.cpfNaNota || undefined,
        customer_name: sale.customerName || undefined,
        payment_method: sale.payment,
        tipo: "nfce",
      });
    },
    onMutate: () => { setEmitState("emitting"); setErrorMsg(null); setErrorPayload(null); },
    onSuccess: (res) => {
      setEmitResult(res);
      const status = res.nfce?.status;
      if (status === "autorizada") {
        setEmitState("authorized");
        toast.success(`NFC-e #${res.nfce.numero} autorizada!`);
      } else if (status === "rejeitada") {
        setEmitState("rejected");
        setErrorMsg(res.nfce.error_message || "Nota rejeitada pela SEFAZ");
      } else {
        setEmitState("authorized"); // processando ainda mostra como autorizada com aviso
      }
    },
    onError: (err: any) => {
      setEmitState("error");
      setErrorMsg(err?.message || "Erro ao emitir NFC-e");
      setErrorPayload(err?.data?.payload || null);
    },
  });

  function handlePrint() {
    if (!company?.id) return;
    openPrintReceipt(company.id, sale.id, token);
  }

  function handleEmitNfce() { emitMut.mutate(); }

  function handleOpenDanfe() {
    const url = emitResult?.pdf_url || emitResult?.nfce?.pdf_url;
    if (url) openExternal(url);
    else toast.error("PDF do DANFE indisponível");
  }

  function handleOpenConsultaSefaz() {
    const url = emitResult?.url_consulta || emitResult?.nfce?.url_consulta;
    if (url) openExternal(url);
    else toast.error("URL de consulta SEFAZ indisponível");
  }

  function handleSendWhatsApp() {
    const pdfUrl = emitResult?.pdf_url || emitResult?.nfce?.pdf_url;
    const consulta = emitResult?.url_consulta || emitResult?.nfce?.url_consulta;
    const numero = emitResult?.nfce?.numero;
    const total = sale.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const link = pdfUrl || consulta;
    const message = link
      ? `Olá! Sua nota fiscal #${numero} (R$ ${total}) está disponível: ${link}`
      : `Olá! Sua nota fiscal #${numero} (R$ ${total}) foi emitida.`;
    const wa = buildWhatsAppLink(sale.customerPhone, message);
    if (wa) openExternal(wa);
    else toast.error("Cliente sem telefone cadastrado. Selecione um cliente com telefone para enviar.");
  }

  const canSendWhatsApp = !!sale.customerPhone && (
    !!emitResult?.pdf_url || !!emitResult?.nfce?.pdf_url ||
    !!emitResult?.url_consulta || !!emitResult?.nfce?.url_consulta
  );

  // Renderização condicional do bloco NFC-e
  function renderNfceBlock() {
    if (emitState === "idle") {
      return (
        <Pressable onPress={handleEmitNfce} style={s.nfcePrimaryBtn}>
          <Icon name="file_text" size={16} color="#fff" />
          <Text style={s.nfcePrimaryText}>Emitir NFC-e</Text>
        </Pressable>
      );
    }
    if (emitState === "emitting") {
      return (
        <View style={s.nfceLoading}>
          <ActivityIndicator color={Colors.violet3} size="small" />
          <Text style={s.nfceLoadingText}>Enviando à SEFAZ...</Text>
        </View>
      );
    }
    if (emitState === "authorized" && emitResult) {
      const qrText = emitResult.qr_code || emitResult.nfce?.qr_code;
      const numero = emitResult.nfce?.numero;
      const protocolo = emitResult.nfce?.protocolo;
      return (
        <View style={s.nfceAuthorized}>
          <View style={s.nfceHeaderRow}>
            <View style={[s.nfceStatusDot, { backgroundColor: Colors.green }]} />
            <Text style={s.nfceStatusLabel}>NFC-e #{numero} autorizada</Text>
          </View>
          {protocolo && <Text style={s.nfceProtocolo}>Protocolo {protocolo}</Text>}

          {qrText && (
            <View style={s.qrWrap}>
              <Image
                source={{ uri: buildQrImageUrl(qrText, 200) }}
                style={s.qrImg}
                accessibilityLabel="QR code da NFC-e"
              />
              <Text style={s.qrHint}>Cliente pode escanear ↑</Text>
            </View>
          )}

          <View style={s.nfceActions}>
            <Pressable onPress={handleOpenDanfe} style={s.nfceActionBtn}>
              <Icon name="download" size={14} color={Colors.violet3} />
              <Text style={s.nfceActionText}>Abrir DANFE</Text>
            </Pressable>
            <Pressable
              onPress={handleSendWhatsApp}
              disabled={!canSendWhatsApp}
              style={[s.nfceActionBtn, !canSendWhatsApp && { opacity: 0.45 }]}
            >
              <Icon name="message" size={14} color={Colors.green} />
              <Text style={[s.nfceActionText, { color: Colors.green }]}>WhatsApp</Text>
            </Pressable>
            <Pressable onPress={handleOpenConsultaSefaz} style={s.nfceActionBtn}>
              <Icon name="globe" size={14} color={Colors.ink3} />
              <Text style={[s.nfceActionText, { color: Colors.ink3 }]}>SEFAZ</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    if (emitState === "rejected" || emitState === "error") {
      return (
        <View style={s.nfceError}>
          <View style={s.nfceHeaderRow}>
            <Icon name="alert" size={14} color={Colors.red} />
            <Text style={[s.nfceStatusLabel, { color: Colors.red }]}>
              {emitState === "rejected" ? "Rejeitada pela SEFAZ" : "Falha na emissão"}
            </Text>
          </View>
          {errorMsg && <Text style={s.nfceErrorMsg}>{errorMsg}</Text>}
          {errorPayload?.erros?.[0]?.campo && (
            <Text style={s.nfceErrorField}>Campo: {errorPayload.erros[0].campo}</Text>
          )}
          <Pressable onPress={handleEmitNfce} style={s.nfceRetryBtn}>
            <Icon name="refresh" size={13} color={Colors.violet3} />
            <Text style={s.nfceRetryText}>Tentar de novo</Text>
          </Pressable>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <View style={s.checkCircle}><Text style={s.checkIcon}>OK</Text></View>
        <Text style={s.title}>Venda registrada!</Text>
        <Text style={s.saleId}>#{sale.id}</Text>

        {hasCoupon && (
          <View style={s.couponRow}>
            <View style={s.couponBadge}>
              <Text style={s.couponBadgeText}>{sale.couponCode}</Text>
            </View>
            <Text style={s.couponDiscount}>-{fmt(sale.couponDiscount!)}</Text>
          </View>
        )}

        {hasCoupon && (
          <View style={s.row}>
            <Text style={s.label}>Subtotal</Text>
            <Text style={s.metaStrike}>{fmt(subtotal)}</Text>
          </View>
        )}
        <View style={s.row}>
          <Text style={s.label}>Total</Text>
          <Text style={s.value}>{fmt(sale.total)}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Pagamento</Text>
          <Text style={s.meta}>{PAYMENTS.find(p => p.key === sale.payment)?.label}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Itens</Text>
          <Text style={s.meta}>{sale.items.reduce((s, i) => s + i.qty, 0)} produtos</Text>
        </View>
        {sale.customerName && (
          <View style={s.row}>
            <Text style={s.label}>Cliente</Text>
            <Text style={s.meta}>{sale.customerName}</Text>
          </View>
        )}
        {sale.cpfNaNota && (
          <View style={s.row}>
            <Text style={s.label}>CPF na nota</Text>
            <Text style={s.meta}>{sale.cpfNaNota}</Text>
          </View>
        )}
        {sale.employeeName && (
          <View style={s.row}>
            <Text style={s.label}>Vendedor</Text>
            <Text style={s.meta}>{sale.employeeName}</Text>
          </View>
        )}

        <View style={s.divider} />

        {/* Bloco NFC-e: botão idle / loading / autorizada (QR+PDF+WA) / erro */}
        {renderNfceBlock()}

        <View style={[s.actions, { marginTop: 14 }]}>
          <Pressable onPress={handlePrint} style={s.secondaryBtn}>
            <Text style={s.secondaryText}>Imprimir cupom</Text>
          </Pressable>
          <Pressable onPress={onNewSale} style={s.primaryBtn}>
            <Text style={s.primaryText}>Nova venda</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.border, maxWidth: 460, width: "100%" },
  checkCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 2, borderColor: Colors.green },
  checkIcon: { fontSize: 20, color: Colors.green, fontWeight: "800" },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  saleId: { fontSize: 12, color: Colors.ink3, marginBottom: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: 8 },
  label: { fontSize: 13, color: Colors.ink3 },
  value: { fontSize: 18, color: Colors.green, fontWeight: "800" },
  meta: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  metaStrike: { fontSize: 13, color: Colors.ink3, fontWeight: "500", textDecorationLine: "line-through" },
  couponRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.greenD, borderRadius: 10, padding: 10, width: "100%", marginBottom: 8, borderWidth: 1, borderColor: Colors.green + "33" },
  couponBadge: { backgroundColor: Colors.green + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  couponBadgeText: { fontSize: 11, color: Colors.green, fontWeight: "800", letterSpacing: 1 },
  couponDiscount: { fontSize: 14, color: Colors.green, fontWeight: "700", flex: 1, textAlign: "right" },
  divider: { height: 1, backgroundColor: Colors.border, width: "100%", marginVertical: 16 },
  actions: { flexDirection: "row", gap: 10, width: "100%" },
  secondaryBtn: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 12, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  secondaryText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  primaryBtn: { flex: 1, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  primaryText: { fontSize: 14, color: "#fff", fontWeight: "700" },

  // ── NFC-e flow ──────────────────────────────────────────────
  nfcePrimaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.violet,
  },
  nfcePrimaryText: { fontSize: 14, color: "#fff", fontWeight: "700" },

  nfceLoading: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    width: "100%", paddingVertical: 16, borderRadius: 12,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  nfceLoadingText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },

  nfceAuthorized: {
    width: "100%", padding: 16, borderRadius: 14,
    backgroundColor: Colors.greenD, borderWidth: 1, borderColor: Colors.green + "44",
    alignItems: "center", gap: 12,
  },
  nfceHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nfceStatusDot: { width: 8, height: 8, borderRadius: 4 },
  nfceStatusLabel: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  nfceProtocolo: { fontSize: 10, color: Colors.ink3, letterSpacing: 0.4 },

  qrWrap: { alignItems: "center", gap: 6, marginVertical: 4 },
  qrImg: {
    width: 200, height: 200, borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1, borderColor: Colors.border,
  },
  qrHint: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },

  nfceActions: { flexDirection: "row", gap: 8, width: "100%", flexWrap: "wrap", justifyContent: "center" },
  nfceActionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
    minWidth: 120,
  },
  nfceActionText: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },

  nfceError: {
    width: "100%", padding: 14, borderRadius: 12,
    backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red + "44",
    gap: 8,
  },
  nfceErrorMsg: { fontSize: 12, color: Colors.ink, lineHeight: 18 },
  nfceErrorField: { fontSize: 11, color: Colors.red, fontWeight: "700" },
  nfceRetryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, marginTop: 4,
  },
  nfceRetryText: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
});

export default SaleComplete;
