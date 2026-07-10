// ============================================================
// AURA. — components/screens/pdv/NfceActions.tsx
//
// 25/05/2026 — Extraído de SaleComplete.tsx pra reuso entre PDV
// normal e Step5Success da Troca. Componente puro de emissão NFC-e:
// estados idle/emitting/authorized/rejected/error, QR Code, chave de
// acesso copiável, polling, auto-emit, ações WhatsApp/SEFAZ/Imprimir.
//
// Não assume shape de venda — props genéricas que qualquer caller
// (venda nova, troca, marketplace order etc.) pode preencher.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";
import { nfceApi, type EmitResponse, type NfcePaymentEntry } from "@/services/nfceApi";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { QrCode } from "@/components/QrCode";
import { openPrintWindow } from "@/services/printWindow";
import { Linking } from "react-native";

export type NfceActionsItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
};

export type NfceActionsProps = {
  companyId: string;
  saleId: string;
  items: NfceActionsItem[];
  total: number;
  customerName?: string | null;
  customerCpf?: string | null;
  customerPhone?: string | null;
  /** Single method (ex: "dinheiro", "pix", "cartao", "debito"). */
  paymentMethod?: string;
  /** Multi-pagamento. Tem prioridade sobre paymentMethod quando preenchido. */
  payments?: NfcePaymentEntry[];
  /** Se true, dispara nfceApi.emit() automaticamente no mount. */
  autoEmit?: boolean;
  /** Callback opcional após autorização (pode marcar venda como emitida no caller). */
  onEmitted?: (result: EmitResponse) => void;
};

type EmitState = "idle" | "emitting" | "authorized" | "rejected" | "error";

function formatAccessKey(k: string | null | undefined): string {
  if (!k) return "";
  const clean = String(k).replace(/\D/g, "");
  if (clean.length !== 44) return clean;
  return clean.match(/.{1,4}/g)!.join(" ");
}

function openExternal(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") window.open(url, "_blank");
  else Linking.openURL(url);
}

function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (!d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(message)}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { return false; }
}

function openPrintNfceTermica(companyId: string, nfceId: string, token: string | null) {
  if (!token || !companyId) { toast.error("Sessao expirada"); return; }
  if (Platform.OS !== "web" || typeof window === "undefined") {
    toast.info("Impressao disponivel apenas na versao web");
    return;
  }
  // Fix 10/07 (relato Davi): janela abre SINCRONA no clique (printWindow).
  // Bonus: o erro do backend (ex.: 409 "DANFE so pode ser impressa quando
  // autorizada") agora aparece DENTRO da janela, nao num toast perdivel.
  openPrintWindow(async () => {
    const res = await fetch(`${BASE_URL}/companies/${companyId}/nfce/${nfceId}/danfe-termica`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false as const, error: txt || "Erro ao gerar NFCe" };
    }
    return { ok: true as const, html: await res.text() };
  }).then((r) => {
    if (r === "blocked") toast.error("Pop-up bloqueado. Permita pop-ups para imprimir.");
  });
}

export function NfceActions({
  companyId, saleId, items, total,
  customerName, customerCpf, customerPhone,
  paymentMethod, payments,
  autoEmit, onEmitted,
}: NfceActionsProps) {
  const { token } = useAuthStore();

  const [emitState, setEmitState] = useState<EmitState>("idle");
  const [emitResult, setEmitResult] = useState<EmitResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorPayload, setErrorPayload] = useState<any>(null);
  const [pollAttempts, setPollAttempts] = useState(0);
  const pollTimer = useRef<any>(null);
  const autoEmitFired = useRef(false);

  useEffect(() => () => { if (pollTimer.current) clearTimeout(pollTimer.current); }, []);

  const emitMut = useMutation({
    mutationFn: () => {
      if (!companyId) throw new Error("Empresa não identificada");
      const body: any = {
        items: items.map(i => ({
          product_id: String(i.product_id).split("__")[0],
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        sale_id: saleId,
        customer_cpf: customerCpf || undefined,
        customer_name: customerName || undefined,
        tipo: "nfce",
      };
      if (payments && payments.length > 0) {
        body.payments = payments;
      } else if (paymentMethod) {
        body.payment_method = paymentMethod;
      }
      return nfceApi.emit(companyId, body);
    },
    onMutate: () => {
      setEmitState("emitting");
      setErrorMsg(null); setErrorPayload(null);
      setPollAttempts(0);
    },
    onSuccess: (res) => {
      setEmitResult(res);
      const status = res.nfce?.status;
      if (status === "autorizada") {
        setEmitState("authorized");
        toast.success(`NFC-e #${res.nfce.numero} autorizada!`);
        onEmitted?.(res);
        if (!res.pdf_url && !res.nfce.pdf_url) startPollingForPdf(res.nfce.id);
      } else if (status === "rejeitada") {
        setEmitState("rejected");
        setErrorMsg(res.nfce.error_message || "Nota rejeitada pela SEFAZ");
      } else if (status === "processando") {
        setEmitState("authorized");
        startPollingForAuthorization(res.nfce.id);
      } else {
        setEmitState("authorized");
      }
    },
    onError: (err: any) => {
      setEmitState("error");
      setErrorMsg(err?.message || "Erro ao emitir NFC-e");
      setErrorPayload(err?.data?.payload || null);
    },
  });

  useEffect(() => {
    if (!autoEmit) return;
    if (autoEmitFired.current) return;
    if (emitState !== "idle") return;
    autoEmitFired.current = true;
    emitMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEmit]);

  function startPollingForAuthorization(emissionId: string) {
    if (!companyId || pollTimer.current) return;
    let attempt = 0;
    const maxAttempts = 10;
    const tick = async () => {
      attempt++;
      setPollAttempts(attempt);
      try {
        const { emission } = await nfceApi.get(companyId, emissionId);
        if (emission.status === "autorizada") {
          setEmitResult(prev => ({
            ...(prev as EmitResponse),
            nfce: emission,
            pdf_url: emission.pdf_url,
            xml_url: emission.xml_url,
            qr_code: emission.qr_code,
            url_consulta: emission.url_consulta,
          }));
          toast.success(`NFC-e #${emission.numero} autorizada!`);
          pollTimer.current = null;
          onEmitted?.({ ...(emitResult as any), nfce: emission });
          return;
        }
        if (emission.status === "rejeitada" || emission.status === "erro") {
          setEmitState("rejected");
          setErrorMsg(emission.error_message || "Nota rejeitada");
          pollTimer.current = null;
          return;
        }
        if (attempt >= maxAttempts) {
          pollTimer.current = null;
          toast.info("SEFAZ ainda processando a nota — acompanhe na aba Notas.");
          return;
        }
        pollTimer.current = setTimeout(tick, 3000);
      } catch { pollTimer.current = null; }
    };
    pollTimer.current = setTimeout(tick, 3000);
  }

  function startPollingForPdf(emissionId: string) {
    if (!companyId || pollTimer.current) return;
    let attempt = 0;
    const tick = async () => {
      attempt++;
      try {
        const { emission } = await nfceApi.get(companyId, emissionId);
        if (emission.pdf_url) {
          setEmitResult(prev => ({
            ...(prev as EmitResponse),
            nfce: emission,
            pdf_url: emission.pdf_url,
            xml_url: emission.xml_url,
            qr_code: emission.qr_code,
            url_consulta: emission.url_consulta,
          }));
          pollTimer.current = null;
          return;
        }
        if (attempt >= 5) { pollTimer.current = null; return; }
        pollTimer.current = setTimeout(tick, 2000);
      } catch { pollTimer.current = null; }
    };
    pollTimer.current = setTimeout(tick, 2000);
  }

  function handleEmitNfce() { emitMut.mutate(); }
  function handlePrintNfce() {
    if (!companyId) return;
    const nfceId = emitResult?.nfce?.id;
    if (!nfceId) { toast.error("ID da NFC-e indisponivel"); return; }
    openPrintNfceTermica(companyId, nfceId, token);
  }
  function handleOpenConsultaSefaz() {
    const url = emitResult?.url_consulta || emitResult?.nfce?.url_consulta;
    if (url) openExternal(url);
    else toast.error("URL de consulta SEFAZ indisponível");
  }
  async function handleCopyChave() {
    const k = emitResult?.nfce?.chave_acesso;
    if (!k) return;
    const ok = await copyToClipboard(k.replace(/\D/g, ""));
    toast[ok ? "success" : "error"](ok ? "Chave de acesso copiada" : "Não foi possível copiar");
  }
  function handleSendWhatsApp() {
    const pdfUrl = emitResult?.pdf_url || emitResult?.nfce?.pdf_url;
    const consulta = emitResult?.url_consulta || emitResult?.nfce?.url_consulta;
    const numero = emitResult?.nfce?.numero;
    const tot = total.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const link = pdfUrl || consulta;
    const message = link
      ? `Olá! Sua nota fiscal #${numero} (R$ ${tot}) está disponível: ${link}`
      : `Olá! Sua nota fiscal #${numero} (R$ ${tot}) foi emitida.`;
    const wa = buildWhatsAppLink(customerPhone, message);
    if (wa) openExternal(wa);
    else toast.error("Cliente sem telefone cadastrado. Selecione um cliente com telefone para enviar.");
  }

  const hasNfceId = !!emitResult?.nfce?.id;
  const hasPdf = !!(emitResult?.pdf_url || emitResult?.nfce?.pdf_url);
  const hasConsulta = !!(emitResult?.url_consulta || emitResult?.nfce?.url_consulta);
  const canSendWhatsApp = !!customerPhone && (hasNfceId || hasPdf || hasConsulta);

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
    const chave = emitResult.nfce?.chave_acesso;
    const isProcessing = emitResult.nfce?.status === "processando";
    return (
      <View style={s.nfceAuthorized}>
        <View style={s.nfceHeaderRow}>
          <View style={[s.nfceStatusDot, { backgroundColor: isProcessing ? Colors.amber : Colors.green }]} />
          <Text style={s.nfceStatusLabel}>
            {isProcessing
              ? `NFC-e #${numero} processando...`
              : `NFC-e #${numero} autorizada`}
          </Text>
        </View>
        {protocolo && <Text style={s.nfceProtocolo}>Protocolo {protocolo}</Text>}
        {pollAttempts > 0 && isProcessing && (
          <Text style={s.nfceProtocolo}>Aguardando SEFAZ confirmar... ({pollAttempts}/10)</Text>
        )}

        {qrText && (
          <View style={s.qrWrap}>
            <QrCode value={qrText} size={200} />
            <Text style={s.qrHint}>Cliente pode escanear ↑</Text>
          </View>
        )}

        {chave && (
          <Pressable onPress={handleCopyChave} style={s.chaveBox}>
            <Text style={s.chaveLabel}>Chave de acesso (clique pra copiar)</Text>
            <Text style={s.chaveValue} numberOfLines={2}>{formatAccessKey(chave)}</Text>
          </Pressable>
        )}

        <View style={s.nfceActions}>
          <Pressable
            onPress={handlePrintNfce}
            disabled={!hasNfceId}
            style={[s.nfceActionBtn, !hasNfceId && { opacity: 0.45 }]}>
            <Icon name="file_text" size={14} color={Colors.violet3} />
            <Text style={s.nfceActionText}>Imprimir NFCe</Text>
          </Pressable>
          <Pressable
            onPress={handleSendWhatsApp}
            disabled={!canSendWhatsApp}
            style={[s.nfceActionBtn, !canSendWhatsApp && { opacity: 0.45 }]}>
            <Icon name="message" size={14} color={Colors.green} />
            <Text style={[s.nfceActionText, { color: Colors.green }]}>
              {!customerPhone ? "Cliente s/ tel" : "WhatsApp"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleOpenConsultaSefaz}
            disabled={!hasConsulta}
            style={[s.nfceActionBtn, !hasConsulta && { opacity: 0.45 }]}>
            <Icon name="globe" size={14} color={Colors.ink3} />
            <Text style={[s.nfceActionText, { color: Colors.ink3 }]}>SEFAZ</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  if (emitState === "rejected" || emitState === "error") {
    const erros = errorPayload?.erros || errorPayload?.errors || [];
    const firstErro = Array.isArray(erros) && erros.length ? erros[0] : null;
    const campo = firstErro?.campo || firstErro?.field;
    const detail = firstErro?.mensagem || firstErro?.message || firstErro?.descricao;
    return (
      <View style={s.nfceError}>
        <View style={s.nfceHeaderRow}>
          <Icon name="alert" size={14} color={Colors.red} />
          <Text style={[s.nfceStatusLabel, { color: Colors.red }]}>
            {emitState === "rejected" ? "Rejeitada pela SEFAZ" : "Falha na emissão"}
          </Text>
        </View>
        {errorMsg && <Text style={s.nfceErrorMsg}>{errorMsg}</Text>}
        {campo && (
          <Text style={s.nfceErrorField}>
            Campo: {campo}{detail ? ` — ${detail}` : ""}
          </Text>
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

const s = StyleSheet.create({
  nfcePrimaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.violet },
  nfcePrimaryText: { fontSize: 14, color: "#fff", fontWeight: "700" },
  nfceLoading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", paddingVertical: 16, borderRadius: 12, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  nfceLoadingText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  nfceAuthorized: { width: "100%", padding: 16, borderRadius: 14, backgroundColor: Colors.greenD, borderWidth: 1, borderColor: Colors.green + "44", alignItems: "center", gap: 12 },
  nfceHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nfceStatusDot: { width: 8, height: 8, borderRadius: 4 },
  nfceStatusLabel: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  nfceProtocolo: { fontSize: 10, color: Colors.ink3, letterSpacing: 0.4 },
  qrWrap: { alignItems: "center", gap: 6, marginVertical: 4 },
  qrHint: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
  chaveBox: { width: "100%", padding: 10, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  chaveLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  chaveValue: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", fontSize: 11, color: Colors.ink, letterSpacing: 0.3 },
  nfceActions: { flexDirection: "row", gap: 8, width: "100%", flexWrap: "wrap", justifyContent: "center" },
  nfceActionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, minWidth: 120 },
  nfceActionText: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  nfceError: { width: "100%", padding: 14, borderRadius: 12, backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red + "44", gap: 8 },
  nfceErrorMsg: { fontSize: 12, color: Colors.ink, lineHeight: 18 },
  nfceErrorField: { fontSize: 11, color: Colors.red, fontWeight: "700" },
  nfceRetryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  nfceRetryText: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
});

export default NfceActions;
