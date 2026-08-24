// ============================================================
// WaTestSendCard — envio de teste pela Cloud API (Onda 5b)
//
// POST /companies/:id/whatsapp/test-send. Serve pra responder a única
// pergunta que importa antes de ligar a régua: "isso chega mesmo no
// celular do responsável?".
//
// O resultado NÃO é um alerta de sucesso genérico: o backend devolve
// { status, skip_reason, last_error, wa_message_id } e a UI mostra
// exatamente isso — inclusive quando o envio foi PULADO (ex.: contato em
// opt-out), que não é erro e não pode aparecer como se fosse.
//
// Os templates aprovados vêm do pai (a lista já foi buscada uma vez).
// Sem template aprovado, o campo de texto livre continua disponível —
// mas ele só funciona dentro da janela de 24h, e a microcópia diz isso.
// ============================================================
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { waApi, WaTemplate, WaTestSendResult } from "@/services/waApi";
import {
  isValidWaPhone, mapWaError, waErrorLabel, waOutboxStatusView, waSkipReasonLabel,
} from "./helpers";

interface Props {
  companyId: string;
  /** Só os aprovados — enviar com template pendente/recusado a Meta recusa. */
  approvedTemplates: WaTemplate[];
  /** Avisa o pai pra recarregar status e fila (o teste entra no outbox). */
  onSent?: () => void;
}

export function WaTestSendCard({ companyId, approvedTemplates, onSent }: Props) {
  const [phone, setPhone] = useState("");
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [text, setText] = useState("");

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<WaTestSendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = approvedTemplates.find((t) => t.name === templateName) || null;
  const canSend = isValidWaPhone(phone) && (!!selected || text.trim().length > 0);

  async function send() {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await waApi.testSend(companyId, {
        to: phone.replace(/\D/g, ""),
        template_name: selected?.name,
        language: selected?.language,
        text: selected ? undefined : text.trim(),
      });
      setResult(res);
      onSent?.();
    } catch (e: any) {
      setError(mapWaError(e).message);
    } finally {
      setSending(false);
    }
  }

  const outcome = result?.result;
  const outcomeView = outcome ? waOutboxStatusView(outcome.status) : null;
  const outcomeSkip = waSkipReasonLabel(outcome?.skip_reason);
  const outcomeErr = waErrorLabel(outcome?.last_error);

  return (
    <View style={styles.card}>
      <View style={styles.headTitle}>
        <Icon name="send" size={16} color={KarateColors.primary} />
        <Text style={styles.cardTitle}>Envio de teste</Text>
      </View>
      <Text style={styles.cardSub}>
        Dispara uma mensagem para um número seu, pela Cloud API, e mostra o que aconteceu de verdade
        com ela — inclusive quando foi pulada.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Telefone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="(11) 91234-5678"
          placeholderTextColor={KarateColors.ink4}
          keyboardType="phone-pad"
          accessibilityLabel="Telefone do destinatário do teste"
        />
      </View>

      {approvedTemplates.length > 0 ? (
        <View style={styles.field}>
          <Text style={styles.label}>Template aprovado</Text>
          <View style={styles.chips}>
            {approvedTemplates.map((t) => {
              const on = t.name === templateName;
              return (
                <TouchableOpacity
                  key={`${t.name}:${t.language}`}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setTemplateName(on ? null : t.name)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]} numberOfLines={1}>
                    {t.name} · {t.language}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>
          Nenhum template aprovado ainda — só é possível testar com texto livre, e ele exige que o
          número já tenha falado com o dojô nas últimas 24 horas.
        </Text>
      )}

      {!selected && (
        <View style={styles.field}>
          <Text style={styles.label}>Texto livre (janela de 24h)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={text}
            onChangeText={setText}
            placeholder="Mensagem de teste"
            placeholderTextColor={KarateColors.ink4}
            multiline
            accessibilityLabel="Texto livre da mensagem de teste"
          />
        </View>
      )}

      <View style={styles.actions}>
        <KarateButton
          label={sending ? "Enviando…" : "Enviar teste"}
          variant="sumi"
          size="sm"
          loading={sending}
          disabled={!canSend}
          onPress={send}
        />
      </View>

      {!!error && <Text style={styles.errTxt}>{error}</Text>}

      {!!outcome && !!outcomeView && (
        <View style={[styles.resultBox, { backgroundColor: outcomeView.bg }]}>
          <View style={styles.resultHead}>
            <Icon name={outcomeView.icon} size={14} color={outcomeView.color} />
            <Text style={[styles.resultTitle, { color: outcomeView.color }]}>{outcomeView.label}</Text>
          </View>
          {!!outcomeSkip && <Text style={styles.resultLine}>{outcomeSkip}</Text>}
          {!!outcomeErr && <Text style={styles.resultLine}>{outcomeErr}</Text>}
          {!outcomeSkip && !outcomeErr && !!outcome.wa_message_id && (
            <Text style={styles.resultLine}>A Meta aceitou a mensagem e devolveu um identificador de entrega.</Text>
          )}
          <Text style={styles.resultMeta}>
            Registro {result?.outbox_id}
            {outcome.wa_message_id ? ` · WhatsApp ${outcome.wa_message_id}` : ""}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 8, lineHeight: 18, maxWidth: 560 } as TextStyle,
  field: { marginTop: 12, gap: 6 } as ViewStyle,
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2, color: KarateColors.ink2, textTransform: "uppercase" } as TextStyle,
  input: {
    borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm,
    backgroundColor: KarateColors.bg2, paddingVertical: 9, paddingHorizontal: 11,
    fontSize: 13, color: KarateColors.ink, maxWidth: 320,
  } as TextStyle,
  inputMulti: { minHeight: 68, maxWidth: 560, textAlignVertical: "top" } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  chip: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11, backgroundColor: KarateColors.bg2 } as ViewStyle,
  chipOn: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  chipTxt: { fontSize: 12, fontWeight: "600", color: KarateColors.ink2, maxWidth: 260 } as TextStyle,
  chipTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 12, lineHeight: 16, maxWidth: 560 } as TextStyle,
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 } as ViewStyle,
  errTxt: { fontSize: 12, color: KarateColors.danger, marginTop: 8 } as TextStyle,
  resultBox: { marginTop: 12, borderRadius: KarateRadius.sm, padding: 10, gap: 4, alignSelf: "flex-start", maxWidth: 560 } as ViewStyle,
  resultHead: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  resultTitle: { fontSize: 12.5, fontWeight: "800" } as TextStyle,
  resultLine: { fontSize: 12, color: KarateColors.ink2, lineHeight: 17 } as TextStyle,
  resultMeta: { fontSize: 10.5, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
});
