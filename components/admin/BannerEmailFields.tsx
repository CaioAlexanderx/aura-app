// ============================================================
// AURA. — Campos do e-mail de notificação de empresa específica
// Usado no "Novo banner" (com o interruptor) e na lista de banners
// publicados (sem interruptor: o painel já é o envio). Carrega os
// destinatários da empresa e mostra o nome dela para conferência.
// Mockup aprovado pelo Caio em 18/09/2026.
// ============================================================
import { useEffect, useState, Dispatch, SetStateAction } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { adminApi, BannerRecipientsResponse } from "@/services/adminApi";
import { EmailDraft, UUID_RE, sourceLabel } from "@/components/admin/bannerEmail";

type Props = {
  companyId:  string;
  title:      string;                         // assunto padrão
  draft:      EmailDraft;
  setDraft:   Dispatch<SetStateAction<EmailDraft>>;
  withToggle?: boolean;                       // true no "Novo banner"
  onCompany?: (c: BannerRecipientsResponse["company"] | null) => void;
};

export function BannerEmailFields({ companyId, title, draft, setDraft, withToggle, onCompany }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const id = companyId.trim();
  const idOk = UUID_RE.test(id);

  // Destinatários da empresa: recarrega quando o id muda. As marcações
  // sugeridas pelo backend (dono e empresa) viram o estado inicial.
  useEffect(() => {
    let vivo = true;
    if (!idOk) {
      setError("");
      onCompany && onCompany(null);
      setDraft(d => (d.recipients.length ? { ...d, recipients: [], selected: [] } : d));
      return;
    }
    setLoading(true); setError("");
    adminApi.notifications.recipients(id)
      .then((r) => {
        if (!vivo) return;
        onCompany && onCompany(r.company);
        setDraft(d => ({ ...d, recipients: r.recipients, selected: r.recipients.filter(x => x.selected).map(x => x.email) }));
      })
      .catch((e: any) => {
        if (!vivo) return;
        onCompany && onCompany(null);
        setError(e?.data?.error || e?.message || "Erro ao buscar destinatários");
        setDraft(d => ({ ...d, recipients: [], selected: [] }));
      })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function set(p: Partial<EmailDraft>) { setDraft(d => ({ ...d, ...p })); }
  function toggleEmail(email: string) {
    setDraft(d => ({
      ...d,
      selected: d.selected.includes(email) ? d.selected.filter(e => e !== email) : [...d.selected, email],
    }));
  }

  const aberto = !withToggle || draft.enabled;

  return (
    <View style={s.box}>
      {withToggle && (
        <Pressable
          onPress={() => set({ enabled: !draft.enabled })}
          style={s.toggleRow}
          accessibilityRole="switch"
          accessibilityState={{ checked: draft.enabled }}
        >
          <View style={[s.sw, draft.enabled && s.swOn]}>
            <View style={[s.knob, draft.enabled && s.knobOn]} />
          </View>
          <Text style={s.toggleTxt}>Também enviar por e-mail</Text>
        </Pressable>
      )}

      {aberto && (
        <>
          <View style={s.field}>
            <Text style={s.label}>Destinatários</Text>
            {!idOk ? (
              <Text style={s.hint}>Informe a empresa para ver os destinatários.</Text>
            ) : loading ? (
              <ActivityIndicator size="small" color={Colors.violet} style={{ alignSelf: "flex-start" }} />
            ) : error ? (
              <Text style={[s.hint, { color: Colors.red }]}>{error}</Text>
            ) : draft.recipients.length === 0 ? (
              <Text style={[s.hint, { color: Colors.red }]}>Esta empresa não tem e-mail cadastrado.</Text>
            ) : (
              draft.recipients.map(r => {
                const on = draft.selected.includes(r.email);
                return (
                  <Pressable
                    key={r.email}
                    onPress={() => toggleEmail(r.email)}
                    style={s.rcpt}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <View style={[s.ck, on && s.ckOn]}>{on && <Text style={s.ckTxt}>✓</Text>}</View>
                    <Text style={s.rcptTxt} numberOfLines={1}>{r.email}</Text>
                    <Text style={s.tag}>{sourceLabel(r)}</Text>
                  </Pressable>
                );
              })
            )}
            <Text style={s.hint}>Vem do cadastro: quem é dono da conta e o e-mail da empresa. A equipe entra desmarcada.</Text>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Assunto</Text>
            <TextInput
              value={draft.subjectTouched ? draft.subject : title}
              onChangeText={(t) => set({ subject: t, subjectTouched: true })}
              placeholder="Assunto do e-mail"
              placeholderTextColor={Colors.ink3}
              style={s.input}
            />
            <Text style={s.hint}>Começa igual ao título; pode editar.</Text>
          </View>

          <View style={s.field}>
            <Text style={s.pixHead}>Cobrança PIX <Text style={s.pixOpt}>(opcional)</Text></Text>
            <View style={s.row2}>
              <View style={[s.field, { flex: 1, minWidth: 120 }]}>
                <Text style={s.label}>Valor</Text>
                <TextInput value={draft.pixAmount} onChangeText={(t) => set({ pixAmount: t })} placeholder="169,00" placeholderTextColor={Colors.ink3} style={s.input} />
              </View>
              <View style={[s.field, { flex: 1, minWidth: 120 }]}>
                <Text style={s.label}>Vencimento</Text>
                <TextInput value={draft.pixDue} onChangeText={(t) => set({ pixDue: t })} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} style={s.input} />
              </View>
            </View>
            <View style={s.field}>
              <Text style={s.label}>PIX copia e cola</Text>
              <TextInput
                value={draft.pixCode}
                onChangeText={(t) => set({ pixCode: t })}
                placeholder="000201…"
                placeholderTextColor={Colors.ink3}
                style={[s.input, s.mono]}
                multiline
              />
            </View>
            <Text style={s.hint}>O QR Code é gerado a partir do código e vai no corpo do e-mail. Sem código, o e-mail sai só com texto e botão.</Text>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box:       { borderWidth: 1, borderColor: "rgba(124,58,237,0.45)", backgroundColor: "rgba(124,58,237,0.06)", borderRadius: 12, padding: 14, gap: 12 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "flex-start", minHeight: 32 },
  sw:        { width: 38, height: 22, borderRadius: 11, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, justifyContent: "center" },
  swOn:      { backgroundColor: Colors.violet, borderColor: Colors.violet },
  knob:      { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.ink3, marginLeft: 3 },
  knobOn:    { backgroundColor: "#fff", marginLeft: 18 },
  toggleTxt: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  field:     { gap: 6 },
  label:     { fontSize: 11, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  hint:      { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  input:     { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink },
  mono:      { fontFamily: "monospace", fontSize: 12, minHeight: 60, textAlignVertical: "top" },
  row2:      { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  rcpt:      { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 9 },
  ck:        { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  ckOn:      { backgroundColor: Colors.violet, borderColor: Colors.violet },
  ckTxt:     { color: "#fff", fontSize: 11, fontWeight: "800" },
  rcptTxt:   { flex: 1, minWidth: 0, fontSize: 13, color: Colors.ink },
  tag:       { fontSize: 10, fontWeight: "800", color: Colors.ink3, backgroundColor: Colors.bg2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  pixHead:   { fontSize: 13, fontWeight: "800", color: Colors.ink },
  pixOpt:    { fontWeight: "600", color: Colors.ink3 },
});
