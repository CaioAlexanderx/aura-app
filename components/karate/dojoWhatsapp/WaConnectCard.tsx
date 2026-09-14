// ============================================================
// WaConnectCard — "Conectar meu WhatsApp" (Embedded Signup da Meta)
//
// A Aura é Tech Provider: cada dojô conecta o PRÓPRIO número, e quem
// paga a conversa é o dojô. O caminho oficial da Meta para isso é o
// Embedded Signup — um popup do Facebook Login for Business que devolve
// um `code` de autorização. O backend troca esse code por token, assina
// o webhook (subscribed_apps) e registra o número (/register).
//
// Contrato (services/waApi.ts):
//   POST /companies/:id/whatsapp/connect     { code, waba_id, phone_number_id }
//   POST /companies/:id/whatsapp/disconnect
// Os parâmetros do popup (app_id, config_id, graph_version) vêm do
// backend em status.embedded_signup — NÃO ficam no bundle do app: eles
// mudam por ambiente e são do app da Meta, não do cliente.
//
// A mecânica frágil do popup (carregar o SDK uma vez só, carregar no
// MOUNT e não no clique, aceitar `message` só do domínio da Meta) mora
// em components/whatsapp/useWaEmbeddedSignup — o varejo conecta pelo
// mesmo caminho e uma segunda cópia divergiria em silêncio. Aqui ficou
// só o desenho sépia do cartão.
//
// No nativo não existe popup: o cartão vira orientação ("conecte pelo
// computador"), nunca um botão que não funciona.
// ============================================================
import React, { useCallback, useState } from "react";
import {
  View, Text, ActivityIndicator, Modal, Pressable,
  TouchableOpacity, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { WaStatus } from "@/services/waApi";
import { useWaEmbeddedSignup } from "@/components/whatsapp/useWaEmbeddedSignup";
import { fmtPhoneBR } from "./helpers";

interface Props {
  companyId: string;
  status: WaStatus | null;
  /** Conectou/desconectou — o pai recarrega o status e a lista de templates. */
  onChanged: () => void;
}

export function WaConnectCard({ companyId, status, onChanged }: Props) {
  const {
    mode, sdkError, busy, error, warnings, btnDisabled, startSignup, disconnect,
  } = useWaEmbeddedSignup(companyId, status, onChanged);
  const [confirmOff, setConfirmOff] = useState(false);

  const doDisconnect = useCallback(async () => {
    try {
      await disconnect();
      setConfirmOff(false);
    } catch {
      // O erro já está no `error` do hook — o diálogo fica aberto para
      // o sensei ler o motivo sem perder o contexto.
    }
  }, [disconnect]);

  const connectLabel = mode === "reconectar" ? "Reconectar meu WhatsApp" : "Conectar meu WhatsApp";

  return (
    <View style={styles.card} testID="wa-connect-card">
      <View style={styles.headTitle}>
        <Icon name="link" size={16} color={KarateColors.primary} />
        <Text style={styles.cardTitle}>Número do dojô</Text>
      </View>

      {mode === "conectado" && (
        <View testID="wa-connect-conectado">
          <Text style={styles.cardSub}>
            O WhatsApp {fmtPhoneBR(status?.phone_display)} está conectado e é ele que aparece para o
            aluno. As conversas iniciadas por template são cobradas pela Meta na conta do dojô.
          </Text>
          {status?.registered === false && (
            <View style={styles.warnBox} testID="wa-connect-nao-registrado">
              <Icon name="alert" size={14} color={KarateColors.warn} />
              <Text style={styles.warnTxt}>
                O registro do número na Meta não foi concluído — reconecte antes de ligar o envio
                automático, senão as mensagens falham na hora do disparo.
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => setConfirmOff(true)}
            accessibilityRole="button"
            style={styles.iconBtn}
            testID="wa-disconnect-btn"
          >
            <Icon name="x_circle" size={14} color={KarateColors.ink2} />
            <Text style={styles.iconBtnTxt}>Desconectar</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === "nativo" && (
        <Text style={styles.cardSub} testID="wa-connect-nativo">
          A conexão do número é feita pelo computador, numa janela oficial do Facebook. Acesse
          app.getaura.com.br pelo navegador e volte a esta tela para conectar o WhatsApp do dojô.
        </Text>
      )}

      {mode === "indisponivel" && (
        <Text style={styles.cardSub} testID="wa-connect-indisponivel">
          A conexão automática do WhatsApp ainda não está liberada neste ambiente. Fale com a Aura —
          enquanto isso, a fila manual da aba Régua continua funcionando normalmente.
        </Text>
      )}

      {(mode === "conectar" || mode === "reconectar") && (
        <View testID="wa-connect-disponivel">
          <Text style={styles.cardSub}>
            {mode === "reconectar"
              ? "A autorização da Meta expirou. Reconecte o mesmo número para voltar a enviar — nada precisa ser cadastrado de novo."
              : "Conecte o número do dojô numa janela oficial do Facebook. O número continua sendo do dojô: a Aura só passa a enviar por ele as mensagens que você autorizar."}
          </Text>
          <Text style={styles.hint}>
            Tenha em mãos o acesso ao Facebook do dojô e um número que ainda não esteja em uso no
            aplicativo do WhatsApp. Cada conversa iniciada por template é cobrada pela Meta.
          </Text>
          <View style={styles.actions}>
            <KarateButton
              label={busy ? "Conectando…" : btnDisabled ? "Carregando…" : connectLabel}
              variant="sumi"
              size="sm"
              loading={busy}
              disabled={btnDisabled}
              onPress={startSignup}
            />
          </View>
          {!!sdkError && <Text style={styles.errTxt} testID="wa-connect-sdk-erro">{sdkError}</Text>}
        </View>
      )}

      {!!error && <Text style={styles.errTxt} testID="wa-connect-erro">{error}</Text>}

      {warnings.length > 0 && (
        <View style={styles.warnBox} testID="wa-connect-warnings">
          <Icon name="alert" size={14} color={KarateColors.warn} />
          <View style={{ flex: 1, gap: 4 }}>
            {warnings.map((w, i) => (
              <Text key={i} style={styles.warnTxt}>{w}</Text>
            ))}
          </View>
        </View>
      )}

      <Modal visible={confirmOff} transparent animationType="fade" onRequestClose={() => setConfirmOff(false)}>
        <Pressable style={styles.backdrop} onPress={() => (busy ? null : setConfirmOff(false))}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Text style={styles.dialogTitle}>Desconectar o WhatsApp do dojô?</Text>
            <Text style={styles.dialogSub}>
              O envio automático para de sair na hora e as mensagens que ainda estão na fila não
              serão enviadas. O número continua sendo do dojô e pode ser conectado de novo depois.
              A fila manual da aba Régua não é afetada.
            </Text>
            <View style={styles.dialogActions}>
              <KarateButton label="Cancelar" variant="secondary" size="sm" disabled={busy} onPress={() => setConfirmOff(false)} />
              <KarateButton
                label={busy ? "Desconectando…" : "Desconectar"}
                variant="primary"
                size="sm"
                loading={busy}
                onPress={doDisconnect}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {busy && mode !== "conectado" && (
        <View style={styles.busyRow}>
          <ActivityIndicator size="small" color={KarateColors.primary} />
          <Text style={styles.hint}>Falando com a Meta — isto pode levar alguns segundos.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 8, lineHeight: 18, maxWidth: 620 } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 8, lineHeight: 16.5, maxWidth: 620 } as TextStyle,
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 } as ViewStyle,
  iconBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingVertical: 6, paddingHorizontal: 10, marginTop: 14, alignSelf: "flex-start" } as ViewStyle,
  iconBtnTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  errTxt: { fontSize: 12, color: KarateColors.danger, marginTop: 10, lineHeight: 17, maxWidth: 620 } as TextStyle,
  warnBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 10,
    backgroundColor: KarateColors.warnSoft, borderRadius: KarateRadius.sm,
    paddingVertical: 9, paddingHorizontal: 10, maxWidth: 620,
  } as ViewStyle,
  warnTxt: { flex: 1, fontSize: 12, fontWeight: "600", color: KarateColors.warn, lineHeight: 17 } as TextStyle,
  busyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 } as ViewStyle,
  backdrop: { flex: 1, backgroundColor: "rgba(20,16,12,0.45)", alignItems: "center", justifyContent: "center", padding: 20 } as ViewStyle,
  dialog: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 18, width: "100%", maxWidth: 460, gap: 10 } as ViewStyle,
  dialogTitle: { fontSize: 15, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  dialogSub: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 6, flexWrap: "wrap" } as ViewStyle,
});
