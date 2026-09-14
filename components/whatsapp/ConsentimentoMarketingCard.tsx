// ============================================================
// ConsentimentoMarketingCard — a chave das Fases 7 e 8
//
// Cobrança e marketing não são a mesma coisa para a Meta nem para a lei.
// Avisar que uma parcela vence é UTILITY: o cliente comprou, existe
// relação. Mandar cupom de aniversário ou "sentimos sua falta" é
// MARKETING: custa mais por mensagem, tem limite por usuário, e só pode
// sair para quem autorizou.
//
// Quem declara essa autorização é o LOJISTA, porque é ele quem coletou
// os cadastros. Este cartão é esse ato — uma caixa marcada grava
// `companies.wa_marketing_consent_at`, e sem essa data o backend recusa
// todo marketing com SEM_CONSENTIMENTO. Desmarcar volta a bloquear na
// hora.
//
// O texto diz as duas metades porque as duas confundem: sem isto nenhum
// marketing sai, E a cobrança não depende disto. Já vimos lojista
// desligar cobrança achando que estava desligando propaganda.
// ============================================================
import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WaStatus } from "@/services/waApi";
import { birthdayApi } from "@/services/birthdayApi";
import { fmtWhenBR, mapWaError, waMarketingConsentAt, waMarketingQualityOk } from "./waGuards";

interface Props {
  companyId: string;
  status: WaStatus | null;
  /** Consentimento mudou — o pai recarrega o /status. */
  onChanged: () => void;
}

const TEXTO_CONSENTIMENTO =
  "Meus clientes autorizaram receber mensagens da loja pelo WhatsApp (cupons, aniversário, reativação).";

export function ConsentimentoMarketingCard({ companyId, status, onChanged }: Props) {
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const consentAt = waMarketingConsentAt(status);
  const marcado = consentAt !== null;
  // Consentimento dado mas a Meta rebaixou o número: marketing pausado
  // mesmo com a caixa marcada. Dizer isso aqui evita o lojista procurar
  // o erro no lugar errado.
  const qualidadeOk = !marcado || waMarketingQualityOk(status);

  const alternar = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setErro(null);
    try {
      await birthdayApi.saveSettings(companyId, { wa_marketing_consent: !marcado });
      onChanged();
    } catch (e: any) {
      setErro(mapWaError(e).message);
    } finally {
      setSaving(false);
    }
  }, [companyId, marcado, onChanged, saving]);

  return (
    <View style={s.card} testID="wa-marketing-consentimento">
      <View style={s.headRow}>
        <Icon name="shield" size={16} color={Colors.violet3} />
        <Text style={s.title}>Mensagens de marketing</Text>
      </View>

      <Text style={s.sub}>
        Cupom de aniversário e mensagem de reativação são marketing: custam mais por mensagem que a
        cobrança e só podem ser enviados para quem autorizou. Sem esta confirmação, nenhuma delas
        sai. A cobrança do crediário não depende disto e continua funcionando normalmente.
      </Text>

      <Pressable
        onPress={alternar}
        disabled={saving}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: marcado, disabled: saving }}
        accessibilityLabel={TEXTO_CONSENTIMENTO}
        style={[s.checkRow, saving && s.disabled]}
        testID={marcado ? "wa-marketing-consentimento-marcado" : "wa-marketing-consentimento-desmarcado"}
      >
        <View style={[s.box, marcado && s.boxOn]}>
          {saving
            ? <ActivityIndicator size="small" color={marcado ? "#fff" : Colors.violet3} />
            : marcado
              ? <Icon name="check" size={13} color="#fff" />
              : null}
        </View>
        <Text style={s.checkTxt}>{TEXTO_CONSENTIMENTO}</Text>
      </Pressable>

      {marcado && (
        <Text style={s.desde} testID="wa-marketing-consentimento-desde">
          Confirmado em {fmtWhenBR(consentAt)}. Desmarcar interrompe todo o marketing na hora.
        </Text>
      )}

      {!marcado && (
        <Text style={s.hint} testID="wa-marketing-consentimento-sem">
          Enquanto esta caixa estiver desmarcada, o envio de aniversário e de reativação fica
          travado — inclusive o manual pela tela, não só o automático.
        </Text>
      )}

      {!qualidadeOk && (
        <View style={s.warnBox} testID="wa-marketing-qualidade">
          <Icon name="alert" size={13} color={Colors.amber} />
          <Text style={s.warnTxt}>
            A Meta colocou o número em atenção: as mensagens de marketing ficam pausadas até a
            qualidade voltar. A cobrança continua saindo.
          </Text>
        </View>
      )}

      {!!erro && <Text style={s.errTxt} testID="wa-marketing-consentimento-erro">{erro}</Text>}

      <Text style={s.legal}>
        Quem responder SAIR para de receber automaticamente, e cada cliente recebe no máximo uma
        mensagem de marketing a cada 7 dias — independentemente de quantas rotinas estiverem ligadas.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  headRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 12.5, color: Colors.ink2, marginTop: 8, lineHeight: 18, maxWidth: 620 },
  checkRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 14,
    backgroundColor: Colors.bg2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2,
    paddingVertical: 12, paddingHorizontal: 13, maxWidth: 620, minHeight: 44,
  },
  disabled: { opacity: 0.6 },
  box: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg3,
  },
  boxOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  checkTxt: { flex: 1, fontSize: 12.5, fontWeight: "600", color: Colors.ink, lineHeight: 18 },
  desde: { fontSize: 11.5, color: Colors.ink3, marginTop: 9, lineHeight: 16.5, maxWidth: 620 },
  hint: { fontSize: 11.5, color: Colors.amber, marginTop: 9, lineHeight: 16.5, fontWeight: "600", maxWidth: 620 },
  warnBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 10,
    backgroundColor: Colors.amberD, borderRadius: 10, borderWidth: 1, borderColor: Colors.amber + "33",
    paddingVertical: 9, paddingHorizontal: 10, maxWidth: 620,
  },
  warnTxt: { flex: 1, fontSize: 11.5, fontWeight: "600", color: Colors.amber, lineHeight: 16.5 },
  errTxt: { fontSize: 12, color: Colors.red, marginTop: 10, lineHeight: 17, maxWidth: 620 },
  legal: { fontSize: 11, color: Colors.ink3, marginTop: 12, lineHeight: 16, maxWidth: 620 },
} as any);
