// ============================================================
// KarateBillingGate — checkout "invisível" do Aura Karatê.
// Fica INVISÍVEL enquanto a federação está em dia (state === "ok").
// No vencimento/atraso (state === "blocked") vira um overlay BLOQUEANTE
// cobrindo o app, com o checkout de regularização: PIX ou Cartão, valor
// fixo R$169 (plano Negócio), SEM seleção de plano.
//
// Recorrência: o /billing/subscribe cria a assinatura mensal no Asaas; o
// webhook atualiza billing_status. Após pagar, o usuário toca em "Já paguei
// / Atualizar" (ou a tela re-checa) e o gate some quando o status vira active.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateButton } from "@/components/karate/KarateButton";
import { PixQRCode } from "@/components/karate/PixQRCode";
import { toast } from "@/components/Toast";
import { billingApi, KarateGateResponse, SubscribeResponse } from "@/services/billingApi";
import { KarateColors as C, KarateFonts as F, KarateRadius as R, ShojiPalette as P } from "@/constants/karateTheme";

type Method = "pix" | "card";

function onlyDigits(v: string) { return String(v || "").replace(/\D/g, ""); }
function maskCpf(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskCep(v: string) { const d = onlyDigits(v).slice(0, 8); return d.replace(/(\d{5})(\d)/, "$1-$2"); }
function maskCard(v: string) { return onlyDigits(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 "); }
function maskExpiry(v: string) { const d = onlyDigits(v).slice(0, 4); return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; }

export function KarateBillingGate({ federationId }: { federationId: string }) {
  const [gate, setGate] = useState<KarateGateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<Method>("pix");
  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<SubscribeResponse | null>(null);

  // Cartão
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [ccv, setCcv] = useState("");
  const [holder, setHolder] = useState("");
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [addrNum, setAddrNum] = useState("");

  const refresh = useCallback(async () => {
    try {
      const g = await billingApi.karateGate(federationId);
      setGate(g);
    } catch {
      // Falha ao consultar o gate: não bloqueia por precaução (fail-open).
      setGate({ state: "ok", amount: 169, billing_status: null, due_date: null, has_subscription: false });
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Enquanto carrega o 1º estado, não mostra nada (evita flash).
  if (loading || !gate || gate.state !== "blocked") return null;

  const amount = gate.amount || 169;
  const amountLabel = "R$ " + amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  async function payPix() {
    setBusy(true);
    try {
      const res = await billingApi.subscribe(federationId, "negocio", "PIX", "monthly");
      setPix(res);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar o PIX.");
    } finally {
      setBusy(false);
    }
  }

  async function payCard() {
    const num = onlyDigits(cardNumber);
    const exp = onlyDigits(expiry);
    if (num.length < 13 || exp.length < 4 || onlyDigits(ccv).length < 3 || !holder.trim() || onlyDigits(cpf).length !== 11) {
      toast.error("Preencha os dados do cartão corretamente.");
      return;
    }
    setBusy(true);
    try {
      const tok = await billingApi.tokenize(federationId, {
        card_number: num,
        card_expiry_month: exp.slice(0, 2),
        card_expiry_year: "20" + exp.slice(2, 4),
        card_ccv: onlyDigits(ccv),
        holder_name: holder.trim(),
        holder_cpf: onlyDigits(cpf),
        holder_postal_code: onlyDigits(cep) || undefined,
        holder_address_number: addrNum || undefined,
      });
      await billingApi.subscribe(federationId, "negocio", "CREDIT_CARD", "monthly", {
        creditCardToken: tok.credit_card_token,
        holderName: holder.trim(),
        holderCpf: onlyDigits(cpf),
        holderPostalCode: onlyDigits(cep) || undefined,
        holderAddressNumber: addrNum || undefined,
      });
      toast.success("Pagamento processado. Atualizando…");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível processar o cartão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.accent} />
          <View style={styles.body}>
            <View style={styles.seal}><Icon name="lock-closed" size={20} color={C.bg} /></View>
            <Text style={styles.title}>Assinatura Aura Karatê</Text>
            <Text style={styles.sub}>
              Para continuar usando a plataforma, regularize a mensalidade da federação.
            </Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Mensalidade</Text>
              <Text style={styles.price}>{amountLabel}<Text style={styles.priceMo}> /mês</Text></Text>
            </View>

            {/* Seletor de método */}
            <View style={styles.tabs}>
              <Text
                onPress={() => setMethod("pix")}
                style={[styles.tab, method === "pix" && styles.tabActive]}
                accessibilityRole="button"
              >PIX</Text>
              <Text
                onPress={() => setMethod("card")}
                style={[styles.tab, method === "card" && styles.tabActive]}
                accessibilityRole="button"
              >Cartão</Text>
            </View>

            {method === "pix" ? (
              pix ? (
                <View style={styles.pixBox}>
                  <PixQRCode payload={pix.pix_copy_paste || ""} qrImage={pix.pix_qr_code || undefined} size={188} />
                  {!!pix.pix_copy_paste && (
                    <Text selectable style={styles.pixCode} numberOfLines={3}>{pix.pix_copy_paste}</Text>
                  )}
                  <Text style={styles.pixHint}>Pague no app do seu banco. A liberação é automática após a confirmação.</Text>
                  <KarateButton label="Já paguei / Atualizar" variant="sumi" size="md" onPress={refresh} style={{ alignSelf: "stretch" }} />
                </View>
              ) : (
                <KarateButton label={busy ? "Gerando PIX…" : `Gerar PIX de ${amountLabel}`} variant="sumi" size="md" loading={busy} onPress={payPix} style={{ alignSelf: "stretch", marginTop: 4 }} />
              )
            ) : (
              <View style={{ alignSelf: "stretch", gap: 8, marginTop: 4 }}>
                <Field label="Número do cartão" value={cardNumber} onChangeText={(v) => setCardNumber(maskCard(v))} placeholder="0000 0000 0000 0000" keyboardType="numeric" />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}><Field label="Validade" value={expiry} onChangeText={(v) => setExpiry(maskExpiry(v))} placeholder="MM/AA" keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Field label="CVV" value={ccv} onChangeText={(v) => setCcv(onlyDigits(v).slice(0, 4))} placeholder="123" keyboardType="numeric" /></View>
                </View>
                <Field label="Nome no cartão" value={holder} onChangeText={setHolder} placeholder="Como impresso no cartão" />
                <Field label="CPF do titular" value={cpf} onChangeText={(v) => setCpf(maskCpf(v))} placeholder="000.000.000-00" keyboardType="numeric" />
                <View style={styles.row}>
                  <View style={{ flex: 1.4 }}><Field label="CEP" value={cep} onChangeText={(v) => setCep(maskCep(v))} placeholder="00000-000" keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Field label="Nº" value={addrNum} onChangeText={setAddrNum} placeholder="123" keyboardType="numeric" /></View>
                </View>
                <KarateButton label={busy ? "Processando…" : `Pagar ${amountLabel}`} variant="sumi" size="md" loading={busy} onPress={payCard} style={{ alignSelf: "stretch", marginTop: 4 }} />
              </View>
            )}

            <Text style={styles.foot}>Cobrança recorrente mensal. Pagamento processado com segurança via Asaas.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: any;
}) {
  return (
    <View>
      <Text style={styles.fLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.ink4}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(28,23,20,0.55)", zIndex: 9999 } as ViewStyle,
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20 } as ViewStyle,
  card: { width: "100%", maxWidth: 420, backgroundColor: C.bg2, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, overflow: "hidden" } as ViewStyle,
  accent: { height: 4, backgroundColor: P.headRed } as ViewStyle,
  body: { padding: 24, alignItems: "center" } as ViewStyle,
  seal: { width: 46, height: 46, borderRadius: 13, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", marginBottom: 12 } as ViewStyle,
  title: { fontFamily: F.heading, fontSize: 21, fontWeight: "400", color: C.ink, textAlign: "center" } as TextStyle,
  sub: { fontSize: 13, color: C.ink2, textAlign: "center", marginTop: 6, lineHeight: 19 } as TextStyle,
  priceRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", alignSelf: "stretch", marginTop: 18, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.border } as ViewStyle,
  priceLabel: { fontSize: 12, fontWeight: "700", color: C.ink3, textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,
  price: { fontFamily: F.heading, fontSize: 24, color: C.ink } as TextStyle,
  priceMo: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,
  tabs: { flexDirection: "row", alignSelf: "stretch", gap: 2, marginTop: 16, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border } as ViewStyle,
  tab: { flex: 1, textAlign: "center", paddingVertical: 10, fontSize: 13.5, fontWeight: "700", color: C.ink3, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 } as TextStyle,
  tabActive: { color: C.primary, borderBottomColor: C.primary } as TextStyle,
  pixBox: { alignSelf: "stretch", alignItems: "center", gap: 12, marginTop: 4 } as ViewStyle,
  pixCode: { fontFamily: F.mono, fontSize: 10.5, color: C.ink2, backgroundColor: C.surface, padding: 10, borderRadius: 8, alignSelf: "stretch" } as TextStyle,
  pixHint: { fontSize: 12, color: C.ink3, textAlign: "center" } as TextStyle,
  row: { flexDirection: "row", gap: 8 } as ViewStyle,
  fLabel: { fontSize: 11, fontWeight: "700", color: C.ink2, marginBottom: 4, marginTop: 2 } as TextStyle,
  input: { borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink, backgroundColor: C.surface, fontFamily: F.mono } as TextStyle,
  foot: { fontSize: 11, color: C.ink3, textAlign: "center", marginTop: 16 } as TextStyle,
});
