// ============================================================
// ConexaoCard — conectar o WhatsApp da LOJA (Embedded Signup)
//
// Irmão varejo do WaConnectCard do dojô: mesma mecânica (o hook
// useWaEmbeddedSignup), mesmo contrato de backend, paleta violeta.
//
// O número continua sendo da loja: a Aura é Tech Provider e só envia
// por ele o que o lojista autorizar. Cada conversa iniciada por template
// é cobrada pela Meta na conta da loja — é por isso que desconectar tem
// confirmação e que o cartão diz, em voz alta, quem paga.
// ============================================================
import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { WaSignupMode, WaStatus } from "@/services/waApi";
import { useWaEmbeddedSignup } from "./useWaEmbeddedSignup";
import { fmtPhoneBR } from "./waGuards";

interface Props {
  companyId: string;
  status: WaStatus | null;
  /** Conectou/desconectou — o pai recarrega status, templates e fila. */
  onChanged: () => void;
}

/** Escolha de número antes de conectar — radio compacto (mesmo desenho do SecaoEstoque). */
function ModeOption({
  selected, title, onPress, testID,
}: { selected: boolean; title: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
      style={[s.modeOption, selected && s.modeOptionOn]}
      testID={testID}
    >
      <View style={[s.modeRadio, selected && s.modeRadioOn]}>
        {selected ? <View style={s.modeRadioDot} /> : null}
      </View>
      <Text style={[s.modeOptionTxt, selected && s.modeOptionTxtOn]}>{title}</Text>
    </Pressable>
  );
}

export function ConexaoCard({ companyId, status, onChanged }: Props) {
  // Coexistence é o default: a maioria das lojas já usa o número no app
  // do celular, e trocar de número para conectar seria o pior caminho.
  const [signupMode, setSignupMode] = useState<WaSignupMode>("coexistence");
  const {
    mode, sdkError, busy, error, warnings, btnDisabled, startSignup, disconnect,
  } = useWaEmbeddedSignup(companyId, status, onChanged, signupMode);
  const [confirmOff, setConfirmOff] = useState(false);

  const doDisconnect = useCallback(async () => {
    try {
      await disconnect();
      setConfirmOff(false);
    } catch {
      // O motivo já está em `error` — o diálogo fica aberto para ser lido.
    }
  }, [disconnect]);

  const connectLabel = mode === "reconectar" ? "Reconectar o WhatsApp" : "Conectar o WhatsApp da loja";

  return (
    <View style={s.card} testID="wa-varejo-conexao">
      <View style={s.headRow}>
        <Icon name="whatsapp" size={16} color={Colors.violet3} />
        <Text style={s.title}>Número da loja</Text>
      </View>

      {mode === "conectado" && (
        <View testID="wa-varejo-conectado">
          <Text style={s.sub}>
            O WhatsApp {fmtPhoneBR(status?.phone_display)} está conectado e é ele que aparece para o
            cliente. As conversas iniciadas por template são cobradas pela Meta na conta da loja.
          </Text>
          {status?.coexistence === true && (
            <View style={s.badge} testID="wa-varejo-coexistence-badge">
              <Icon name="qr_code" size={12} color={Colors.violet3} />
              <Text style={s.badgeTxt}>Também no celular</Text>
            </View>
          )}
          {status?.registered === false && (
            <View style={s.warnBox} testID="wa-varejo-nao-registrado">
              <Icon name="alert" size={13} color={Colors.amber} />
              <Text style={s.warnTxt}>
                O registro do número na Meta não foi concluído — reconecte antes de ligar o envio
                automático, senão as mensagens falham na hora do disparo.
              </Text>
            </View>
          )}
          <Pressable
            onPress={() => setConfirmOff(true)}
            accessibilityRole="button"
            style={s.ghostBtn}
            testID="wa-varejo-desconectar"
          >
            <Icon name="x_circle" size={13} color={Colors.ink3} />
            <Text style={s.ghostTxt}>Desconectar</Text>
          </Pressable>
        </View>
      )}

      {mode === "nativo" && (
        <Text style={s.sub} testID="wa-varejo-conexao-nativo">
          A conexão do número é feita pelo computador, numa janela oficial do Facebook. Acesse
          app.getaura.com.br pelo navegador e volte a esta tela para conectar o WhatsApp da loja.
        </Text>
      )}

      {mode === "indisponivel" && (
        <Text style={s.sub} testID="wa-varejo-conexao-indisponivel">
          A conexão automática do WhatsApp ainda não está liberada nesta conta. Fale com a Aura —
          enquanto isso, a cobrança manual pelo wa.me continua funcionando normalmente.
        </Text>
      )}

      {(mode === "conectar" || mode === "reconectar") && (
        <View testID="wa-varejo-conexao-disponivel">
          <Text style={s.sub}>
            {mode === "reconectar"
              ? "A autorização da Meta expirou. Reconecte o mesmo número para voltar a enviar — nada precisa ser cadastrado de novo."
              : "Conecte o número da loja numa janela oficial do Facebook. O número continua sendo seu: a Aura só passa a enviar por ele as mensagens que você autorizar."}
          </Text>
          <Text style={s.hint}>
            Tenha em mãos o acesso ao Facebook da loja. Cada conversa iniciada por template é cobrada
            pela Meta.
          </Text>

          <View style={s.modeGroup} testID="wa-varejo-modo-numero">
            <ModeOption
              selected={signupMode === "coexistence"}
              title="Já uso este número no app WhatsApp Business do celular (recomendado — continua funcionando no celular)"
              onPress={() => setSignupMode("coexistence")}
              testID="wa-varejo-modo-coexistence"
            />
            <ModeOption
              selected={signupMode === "padrao"}
              title="Vou usar um número novo, só para o sistema"
              onPress={() => setSignupMode("padrao")}
              testID="wa-varejo-modo-padrao"
            />
          </View>
          {signupMode === "coexistence" && (
            <Text style={s.modeHint} testID="wa-varejo-modo-hint">
              Durante a conexão, o celular vai pedir para escanear um QR code — é assim que o WhatsApp
              Business do celular passa a funcionar junto com o sistema, sem trocar de número.
            </Text>
          )}

          <Pressable
            onPress={startSignup}
            disabled={btnDisabled}
            accessibilityRole="button"
            style={[s.primaryBtn, btnDisabled && s.btnDisabled]}
            testID="wa-varejo-conectar"
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="link" size={14} color="#fff" />}
            <Text style={s.primaryTxt}>
              {busy ? "Conectando…" : btnDisabled ? "Carregando…" : connectLabel}
            </Text>
          </Pressable>
          {!!sdkError && <Text style={s.errTxt} testID="wa-varejo-sdk-erro">{sdkError}</Text>}
        </View>
      )}

      {!!error && <Text style={s.errTxt} testID="wa-varejo-conexao-erro">{error}</Text>}

      {warnings.length > 0 && (
        <View style={s.warnBox} testID="wa-varejo-conexao-warnings">
          <Icon name="alert" size={13} color={Colors.amber} />
          <View style={{ flex: 1, gap: 4 }}>
            {warnings.map((w, i) => <Text key={i} style={s.warnTxt}>{w}</Text>)}
          </View>
        </View>
      )}

      <ResponsiveSheet
        visible={confirmOff}
        onClose={() => (busy ? null : setConfirmOff(false))}
        maxWidth={440}
        sheetStyle={{ backgroundColor: Colors.bg3, padding: 20 }}
      >
        <View style={{ gap: 10 }} testID="wa-varejo-confirmar-desconectar">
          <Text style={s.dialogTitle}>Desconectar o WhatsApp da loja?</Text>
          <Text style={s.sub}>
            O envio automático para de sair na hora e as mensagens que ainda estão na fila não serão
            enviadas. O número continua sendo da loja e pode ser conectado de novo depois. A
            cobrança manual pelo wa.me não é afetada.
          </Text>
          <View style={s.dialogActions}>
            <Pressable onPress={() => setConfirmOff(false)} disabled={busy} style={s.ghostWide} accessibilityRole="button">
              <Text style={s.ghostTxt}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={doDisconnect} disabled={busy} style={[s.dangerBtn, busy && s.btnDisabled]} accessibilityRole="button">
              <Text style={s.dangerTxt}>{busy ? "Desconectando…" : "Desconectar"}</Text>
            </Pressable>
          </View>
        </View>
      </ResponsiveSheet>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  headRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 12.5, color: Colors.ink2, marginTop: 8, lineHeight: 18, maxWidth: 620 },
  hint: { fontSize: 11.5, color: Colors.ink3, marginTop: 8, lineHeight: 16.5, maxWidth: 620 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.violet, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 16,
    marginTop: 14, alignSelf: "flex-start", minHeight: 44,
  },
  primaryTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.5 },
  ghostBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginTop: 14, alignSelf: "flex-start",
  },
  ghostWide: {
    flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingVertical: 12, minHeight: 44,
  },
  ghostTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.ink3 },
  dangerBtn: {
    flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.red,
    borderRadius: 10, paddingVertical: 12, minHeight: 44,
  },
  dangerTxt: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  errTxt: { fontSize: 12, color: Colors.red, marginTop: 10, lineHeight: 17, maxWidth: 620 },
  warnBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 10,
    backgroundColor: Colors.amberD, borderRadius: 10, borderWidth: 1, borderColor: Colors.amber + "33",
    paddingVertical: 9, paddingHorizontal: 10, maxWidth: 620,
  },
  warnTxt: { flex: 1, fontSize: 11.5, fontWeight: "600", color: Colors.amber, lineHeight: 16.5 },
  dialogTitle: { fontSize: 15, fontWeight: "800", color: Colors.ink },
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 3,
    paddingHorizontal: 9, backgroundColor: Colors.violetD, alignSelf: "flex-start", marginTop: 8,
  },
  badgeTxt: { fontSize: 10.5, fontWeight: "700", color: Colors.violet3 },
  modeGroup: { gap: 8, marginTop: 14 },
  modeOption: {
    flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 11, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: Colors.bg4,
  },
  modeOptionOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  modeOptionTxt: { flex: 1, fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  modeOptionTxtOn: { color: Colors.ink, fontWeight: "700" },
  modeRadio: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  modeRadioOn: { borderColor: Colors.violet },
  modeRadioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.violet },
  modeHint: { fontSize: 11.5, color: Colors.ink3, marginTop: 8, lineHeight: 16.5, maxWidth: 620 },
} as any);
