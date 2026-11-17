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
//
// 29/10/2026 (tq-39): item aceita `discount` (vDesc do item, em R$ no total
// da linha). Só a Troca preenche; sem desconto o corpo do /emit sai igual.
//
// 10/11/2026 (Aura-backend#983): venda só de serviço volta 200 { skipped:
// true, nfce: null } — antes caía em "authorized" sem número. Agora é o
// estado "skipped", neutro: "Venda só de serviços: a nota de serviço sai
// separada". Venda mista: a nota sai e uma linha diz que os serviços ficaram
// de fora (servicos_fora_da_nfce).
//
// 13/11/2026: desconto da venda (cupom + manual) na nota. Quem vale é a
// venda gravada: com sale_id, o backend lê sales.discount_amount e rateia o
// desconto no vDesc de cada item (aura-backend
// services/descontoDaVendaNaNfce.js). `saleDiscount` é o desconto que o
// servidor gravou, mandado como `discount_amount` só para o backend ter com
// o que conferir quando não há venda gravada a ler. O app não recalcula
// total nenhum. Sem desconto, o corpo do /emit sai igual.
//
// 17/11/2026 (p-147): o pedido e a consulta à SEFAZ saíram daqui para
// services/emissaoDaNfce (com a prop `chave`, sobrevivem à tela final).
// Este componente só desenha o estado. Telas iguais.
//
// 14/11/2026 (NF-e 55, CP4b): prop `notaAtiva` — loja com a nota fiscal
// desligada vê o convite para ligar (ConviteNotaFiscal) em vez de um
// "Emitir NFC-e" que falhava ao tocar; a automática não dispara.
// ============================================================
import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";
import { type EmitResponse, type NfcePaymentEntry } from "@/services/nfceApi";
import { emitirNota, esquecerNota, estadoDaNota } from "@/services/emissaoDaNfce";
import { useEmissaoDaNfce } from "@/hooks/useEmissaoDaNfce";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { QrCode } from "@/components/QrCode";
import { openPrintWindow } from "@/services/printWindow";
import { Linking } from "react-native";
import { textoServicosForaDaNfce, TEXTO_NFCE_SO_SERVICO } from "@/utils/nfseAutomatica";
import { ConviteNotaFiscal } from "@/components/nfe55/ConviteNotaFiscal";

export type NfceActionsItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  /** 29/10/2026 (tq-39): desconto do item no total da linha (vDesc). */
  discount?: number;
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
  /** 13/11/2026: desconto da venda (cupom + manual) como o servidor gravou
   *  (sales.discount_amount). Vai como `discount_amount`; o backend rateia
   *  nos itens a partir da venda gravada. Não somar aqui o lápis do item. */
  saleDiscount?: number | null;
  /** Se true, dispara nfceApi.emit() automaticamente no mount. */
  autoEmit?: boolean;
  /** Callback opcional após autorização (pode marcar venda como emitida no caller). */
  onEmitted?: (result: EmitResponse) => void;
  /** 14/11/2026 (CP4b): nfce_config.is_active da loja. false = sem "Emitir
   *  NFC-e" (tocar dava erro): aparece o convite para ligar a nota, nunca
   *  bloqueio. undefined = não se sabe (Troca, telas antigas): como sempre. */
  notaAtiva?: boolean;
  /** 17/11/2026 (p-147): chave da nota em services/emissaoDaNfce. A venda do
   *  Caixa passa `chaveDaNotaDaVenda(id)`: a emissão continua depois que a
   *  tela final sai e a faixa da venda anterior mostra o resultado. Sem
   *  chave: o estado é deste componente, como sempre. */
  chave?: string;
};

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
  if (!token || !companyId) { toast.error("Sessão expirada"); return; }
  if (Platform.OS !== "web" || typeof window === "undefined") {
    toast.info("Impressão disponível apenas na versão web");
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
  paymentMethod, payments, saleDiscount,
  autoEmit, onEmitted, notaAtiva, chave,
}: NfceActionsProps) {
  const { token } = useAuthStore();

  // 17/11/2026 (p-147): o estado mora em services/emissaoDaNfce. Com `chave`
  // (a venda do Caixa) ele sobrevive à tela final; sem ela, a chave é só
  // deste componente e é esquecida ao desmontar, como antes.
  const chaveSo = useRef("nfce-tela:" + Math.random().toString(36).slice(2)).current;
  const chaveDaNota = chave || chaveSo;
  const nota = useEmissaoDaNfce(chaveDaNota);
  const emitState = nota.fase;
  const emitResult = nota.resultado;
  const errorMsg = nota.erro;
  const errorPayload = nota.payloadDoErro;
  const pollAttempts = nota.tentativas;
  const autoEmitFired = useRef(false);

  useEffect(() => () => { if (!chave) esquecerNota(chaveSo); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  // onEmitted a cada autorização (na hora ou depois da consulta à SEFAZ).
  const onEmittedRef = useRef(onEmitted);
  onEmittedRef.current = onEmitted;
  const autorizacoesVistas = useRef(0);
  useEffect(() => {
    if (nota.autorizacoes > autorizacoesVistas.current) {
      autorizacoesVistas.current = nota.autorizacoes;
      if (nota.resultado) onEmittedRef.current?.(nota.resultado);
    }
  }, [nota.autorizacoes, nota.resultado]);

  function emitir() {
    const body: any = {
      items: items.map(i => ({
        product_id: String(i.product_id).split("__")[0],
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        ...(i.discount && i.discount > 0 ? { discount: i.discount } : {}),
      })),
      sale_id: saleId,
      customer_cpf: customerCpf || undefined,
      customer_name: customerName || undefined,
      tipo: "nfce",
      ...(saleDiscount && saleDiscount > 0 ? { discount_amount: saleDiscount } : {}),
    };
    if (payments && payments.length > 0) {
      body.payments = payments;
    } else if (paymentMethod) {
      body.payment_method = paymentMethod;
    }
    emitirNota(chaveDaNota, companyId, body);
  }

  useEffect(() => {
    if (!autoEmit) return;
    if (notaAtiva === false) return; // loja sem nota ativa: não tenta emitir
    if (autoEmitFired.current) return;
    if (estadoDaNota(chaveDaNota).fase !== "idle") return;
    autoEmitFired.current = true;
    emitir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEmit]);

  function handleEmitNfce() { emitir(); }
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

  if (emitState === "idle" && notaAtiva === false) {
    return <ConviteNotaFiscal />;
  }
  if (emitState === "idle") {
    return (
      <Pressable onPress={handleEmitNfce} style={s.nfcePrimaryBtn}>
        <Icon name="file_text" size={16} color="#fff" />
        <Text style={s.nfcePrimaryText}>Emitir NFC-e</Text>
      </Pressable>
    );
  }
  if (emitState === "skipped") {
    return (
      <View style={s.nfceSkipped} testID="nfce-pulada">
        <Icon name="info" size={14} color={Colors.ink3} />
        <Text style={s.nfceSkippedText}>{TEXTO_NFCE_SO_SERVICO}</Text>
      </View>
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
        {!!textoServicosForaDaNfce(emitResult) && (
          <Text style={s.nfceProtocolo} testID="nfce-servicos-fora">{textoServicosForaDaNfce(emitResult)}</Text>
        )}
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
  nfceSkipped: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%", padding: 12, borderRadius: 12, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  nfceSkippedText: { flex: 1, fontSize: 12, color: Colors.ink2, lineHeight: 17 },
});

export default NfceActions;
