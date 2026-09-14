// ============================================================
// AniversarioAutoCard — "manda o parabéns sozinho no dia" (Fase 8)
//
// Mesmo padrão do interruptor da régua do crediário, e de propósito: um
// único jeito de ligar envio pago no app inteiro. Travado enquanto faltar
// plano, conexão, template aprovado OU consentimento de marketing; ligar
// passa obrigatoriamente pela prévia (quem receberia hoje e quanto custa)
// e desligar é livre e imediato.
//
// A diferença para a cobrança é só uma, e é a cara: aqui a mensagem é
// MARKETING. Custa mais, tem limite por cliente e depende de autorização.
// Por isso a prévia fala em "mensagens de marketing pagas" em vez de
// "clientes receberiam".
//
// Campo ausente = desligado e travado. Um backend anterior à Fase 8 não
// devolve `wa_birthday_auto`; nesse caso o cartão mostra desligado, e o
// PUT (que é quem decide de verdade) responde o estado real.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Switch, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { birthdayApi } from "@/services/birthdayApi";
import { waApi, WaStatus, WA_ANIVERSARIO_TEMPLATES } from "@/services/waApi";
import { isWaErrorCode, mapWaError, waMarketingBlockers } from "./waGuards";
import { PreviaMarketingModal } from "./PreviaMarketingModal";

interface Props {
  companyId: string;
}

export function AniversarioAutoCard({ companyId }: Props) {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [previaAberta, setPreviaAberta] = useState(false);

  const carregarStatus = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await waApi.getStatus(companyId));
    } catch {
      // null bloqueia o automático — o lado certo do erro.
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const carregarSettings = useCallback(async () => {
    try {
      const st = await birthdayApi.getSettings(companyId);
      setAuto(st?.wa_birthday_auto === true);
    } catch {
      setAuto(false);
    }
  }, [companyId]);

  useEffect(() => { carregarStatus(); }, [carregarStatus]);
  useEffect(() => { carregarSettings(); }, [carregarSettings]);

  const blockers = waMarketingBlockers(status, {
    templateKeys: WA_ANIVERSARIO_TEMPLATES,
    labels: {
      SEM_STATUS: "Não foi possível verificar o WhatsApp da loja — recarregue antes de ligar o envio automático.",
      ADDON: "O envio automático por WhatsApp não está no seu plano. Fale com a Aura para ativar.",
      CONEXAO: "Conecte o número da loja na aba WhatsApp.",
      TOKEN: "A autorização da Meta expirou — reconecte o número da loja.",
      TEMPLATE: "O template de aniversário ainda não foi aprovado pela Meta.",
      CONSENTIMENTO: "Marque o consentimento de marketing na aba WhatsApp — sem ele nenhum cupom de aniversário sai.",
    },
  });
  const travado = !auto && (loading || blockers.length > 0);

  async function salvar(next: boolean) {
    setSaving(true);
    setErro(null);
    try {
      const res = await birthdayApi.saveSettings(companyId, { wa_birthday_auto: next });
      setAuto(typeof res?.wa_birthday_auto === "boolean" ? res.wa_birthday_auto : next);
      setPreviaAberta(false);
    } catch (e: any) {
      const code = e?.data?.code ?? e?.code ?? null;
      setErro(isWaErrorCode(code) ? mapWaError(e).message : (e?.data?.error || e?.message || "Não foi possível salvar."));
      // O servidor recusou: o que está na tela está velho.
      setAuto(false);
      if (isWaErrorCode(code)) carregarStatus();
    } finally {
      setSaving(false);
    }
  }

  // Ligar passa pela prévia; desligar é imediato — quem está gastando tem
  // que poder parar sem mais um diálogo no caminho.
  function alternar(next: boolean) {
    setErro(null);
    if (!next) { salvar(false); return; }
    setPreviaAberta(true);
  }

  return (
    <View style={s.box} testID="aniversario-wa-auto">
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Icon name="whatsapp" size={14} color={Colors.violet} />
            <Text style={s.title}>Enviar automaticamente no dia</Text>
          </View>
          <Text style={s.sub}>
            Todo dia de manhã a loja manda o parabéns com cupom para quem faz aniversário, pelo
            número oficial. Cada mensagem é de marketing e é cobrada pela Meta na conta da loja; cada
            cliente recebe no máximo uma por ano. Quem pediu para não receber nunca recebe.
          </Text>
        </View>
        <Switch
          value={auto}
          onValueChange={alternar}
          disabled={travado || saving}
          trackColor={{ false: Colors.bg4 as any, true: Colors.violet }}
          thumbColor="#fff"
          accessibilityLabel="Enviar aniversário automaticamente no dia"
          accessibilityState={{ disabled: travado || saving, checked: auto }}
          testID={travado ? "aniversario-wa-switch-travado" : "aniversario-wa-switch"}
        />
      </View>

      {loading && !auto && (
        <Text style={s.verificando} testID="aniversario-wa-verificando">
          Verificando a conexão do WhatsApp da loja…
        </Text>
      )}

      {!loading && travado && (
        <>
          <View style={s.motivos} testID="aniversario-wa-motivos">
            {blockers.map((b) => (
              <View key={b.code} style={s.motivoRow}>
                <Icon name="alert" size={12} color={Colors.amber} />
                <Text style={s.motivoTxt}>{b.label}</Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/whatsapp")}
            accessibilityRole="button"
            style={s.link}
            testID="aniversario-wa-configurar"
          >
            <Icon name="arrow_right" size={13} color={Colors.violet} />
            <Text style={s.linkTxt}>Configurar WhatsApp</Text>
          </Pressable>
        </>
      )}

      {!!erro && <Text style={s.err} testID="aniversario-wa-erro">{erro}</Text>}

      <PreviaMarketingModal
        visible={previaAberta}
        titulo="Ligar o parabéns automático por WhatsApp"
        descricao="Antes de ligar, veja quantos aniversariantes receberiam hoje e o que isso custa."
        confirmLabel="Ativar envio automático"
        savingLabel="Ativando…"
        carregar={() => birthdayApi.preview(companyId)}
        status={status}
        saving={saving}
        onCancel={() => setPreviaAberta(false)}
        onConfirm={() => salvar(true)}
        idBase="aniversario-wa-previa"
      />
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    marginTop: 14, backgroundColor: Colors.bg4, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, padding: 13,
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { fontSize: 13, fontWeight: "800", color: Colors.ink, flexShrink: 1 },
  sub: { fontSize: 11, color: Colors.ink3, lineHeight: 16, marginTop: 6, maxWidth: 520 },
  verificando: { fontSize: 11, color: Colors.ink3, marginTop: 9, fontStyle: "italic" },
  motivos: { gap: 5, marginTop: 10 },
  motivoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  motivoTxt: { flex: 1, fontSize: 11, color: Colors.amber, lineHeight: 16, fontWeight: "600" },
  link: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 11, alignSelf: "flex-start",
    borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 11,
  },
  linkTxt: { fontSize: 12, fontWeight: "700", color: Colors.violet },
  err: { fontSize: 11.5, color: Colors.red, marginTop: 10, lineHeight: 16, fontWeight: "600" },
} as any);
