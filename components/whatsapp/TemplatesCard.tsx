// ============================================================
// TemplatesCard — os dois templates que a régua do crediário precisa
//
// Só dá para INICIAR uma conversa no WhatsApp com um template aprovado
// pela Meta. A régua do crediário usa dois:
//   · parcela_lembrete — antes e no dia do vencimento
//   · parcela_atraso   — depois de vencer
// Sem os DOIS aprovados o envio automático não liga (waAutoBlockers com
// templateKeys). Mandar o lojista até o Gerenciador da Meta escrever o
// texto certo é onde quase todo mundo desiste — por isso cada um tem o
// seu botão "Criar": o backend manda o texto UTILITY pt-BR já formatado
// com as variáveis que o disparo preenche.
//
// Depois disso a aprovação é da Meta e leva até ~24h. Enquanto estiver
// PENDING a tela diz isso, em vez de deixar o lojista achando que travou.
// ============================================================
import React, { useState } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { waApi, WaStatus, WaTemplate, WaTemplatePreset } from "@/services/waApi";
import { fmtWhenBR, mapWaError, waCategoryLabel, waTemplateStatusSpec } from "./waGuards";
import { waTonePair } from "./varejoTheme";

/** Os presets do crediário, na ordem em que a régua os usa. */
const PRESETS: { preset: WaTemplatePreset; titulo: string; descricao: string }[] = [
  {
    preset: "parcela_lembrete",
    titulo: "Lembrete de parcela",
    descricao: "Usado nas etapas que avisam antes do vencimento e no dia. Leva o Pix copia e cola.",
  },
  {
    preset: "parcela_atraso",
    titulo: "Parcela em atraso",
    descricao: "Usado nas etapas de atraso. Diz há quantos dias venceu e leva o Pix copia e cola.",
  },
];

interface Props {
  companyId: string;
  templates: WaTemplate[];
  status: WaStatus | null;
  loading: boolean;
  /** true = 409 NAO_CONECTADO (falta WABA/token) — estado vazio, não erro. */
  notConnected: boolean;
  error: string | null;
  onReload: () => void;
}

export function TemplatesCard({
  companyId, templates, status, loading, notConnected, error, onReload,
}: Props) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);
  const [criando, setCriando] = useState<WaTemplatePreset | null>(null);
  const [criarErr, setCriarErr] = useState<string | null>(null);

  const ready = status?.templates_ready || null;

  /**
   * O status vem de duas fontes e elas podem discordar: a lista
   * sincronizada (detalhe) e o `templates_ready` do /status (o que o
   * backend de fato aceita como aprovado). A lista ganha quando existe;
   * na ausência dela, `templates_ready === true` vale como APPROVED e
   * qualquer outra coisa (inclusive ausente) fica vazia = "não existe".
   */
  function statusDoPreset(preset: WaTemplatePreset): string {
    const row = templates.find((t) => t.name === preset);
    if (row) return String(row.status || "").toUpperCase();
    if (ready && ready[preset] === true) return "APPROVED";
    return "";
  }

  async function criar(preset: WaTemplatePreset) {
    setCriando(preset);
    setCriarErr(null);
    try {
      await waApi.createTemplate(companyId, { preset });
      onReload();
    } catch (e: any) {
      setCriarErr(mapWaError(e).message);
    } finally {
      setCriando(null);
    }
  }

  async function sincronizar() {
    setSyncing(true);
    setSyncMsg(null);
    setSyncErr(null);
    try {
      const res = await waApi.syncTemplates(companyId);
      const n = res?.synced ?? 0;
      setSyncMsg(n === 1 ? "1 template sincronizado da Meta." : `${n} templates sincronizados da Meta.`);
      onReload();
    } catch (e: any) {
      // Só `message` (pt-BR do backend) vai pra tela — `detail` é o inglês da Meta.
      setSyncErr(mapWaError(e).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View style={s.card} testID="wa-varejo-templates">
      <View style={s.head}>
        <View style={s.headTitle}>
          <Icon name="file_text" size={16} color={Colors.violet3} />
          <Text style={s.title}>Templates de cobrança</Text>
        </View>
        <Pressable
          onPress={sincronizar}
          disabled={syncing}
          accessibilityRole="button"
          style={[s.ghostBtn, syncing && s.btnDisabled]}
          testID="wa-varejo-sincronizar"
        >
          <Icon name="refresh" size={13} color={Colors.ink3} />
          <Text style={s.ghostTxt}>{syncing ? "Sincronizando…" : "Sincronizar"}</Text>
        </Pressable>
      </View>
      <Text style={s.sub}>
        A régua do crediário só liga com os dois templates abaixo aprovados pela Meta. A aprovação
        acontece do lado da Meta — aqui você cria o texto certo e acompanha o status.
      </Text>

      {!!syncErr && <Text style={s.errTxt}>{syncErr}</Text>}
      {!syncErr && !!syncMsg && (
        <View style={s.okBox}>
          <Icon name="check_circle" size={13} color={Colors.green} />
          <Text style={s.okTxt}>{syncMsg}</Text>
        </View>
      )}

      {notConnected && (
        <View style={s.stateBox} testID="wa-varejo-templates-sem-conexao">
          <Icon name="link" size={20} color={Colors.ink3} />
          <Text style={s.stateTxt}>Conecte o WhatsApp da loja para criar e ver os templates.</Text>
        </View>
      )}

      {!notConnected && (
        <View style={s.presets}>
          {PRESETS.map((p) => {
            const st = statusDoPreset(p.preset);
            const spec = waTemplateStatusSpec(st);
            const tone = waTonePair(spec.tone);
            const existe = !!st;
            return (
              <View key={p.preset} style={s.preset} testID={`wa-varejo-preset-${p.preset}`}>
                <View style={s.presetHead}>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={s.presetTitulo}>{p.titulo}</Text>
                    <Text style={s.presetNome}>{p.preset}</Text>
                  </View>
                  {existe && (
                    <View style={[s.badge, { backgroundColor: tone.bg }]}>
                      <Icon name={spec.icon} size={12} color={tone.color} />
                      <Text style={[s.badgeTxt, { color: tone.color }]}>{spec.label}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.presetDesc}>{p.descricao}</Text>

                {!existe && (
                  <Pressable
                    onPress={() => criar(p.preset)}
                    disabled={criando === p.preset}
                    accessibilityRole="button"
                    style={[s.primaryBtn, criando === p.preset && s.btnDisabled]}
                    testID={`wa-varejo-criar-${p.preset}`}
                  >
                    {criando === p.preset
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Icon name="plus" size={13} color="#fff" />}
                    <Text style={s.primaryTxt}>
                      {criando === p.preset
                        ? "Criando…"
                        : p.preset === "parcela_lembrete" ? "Criar template de lembrete" : "Criar template de atraso"}
                    </Text>
                  </Pressable>
                )}

                {(st === "PENDING" || st === "IN_APPEAL") && (
                  <Text style={s.presetNota} testID={`wa-varejo-pendente-${p.preset}`}>
                    Aguardando aprovação da Meta (normalmente até 24h). Quando sair a resposta, toque
                    em Sincronizar para atualizar o status aqui.
                  </Text>
                )}
                {st === "REJECTED" && (
                  <Text style={[s.presetNota, { color: Colors.red }]}>
                    A Meta recusou este template. Fale com a Aura: é preciso ajustar o texto e
                    reenviar para análise antes de ligar o envio automático.
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {!!criarErr && <Text style={s.errTxt}>{criarErr}</Text>}

      {loading && (
        <View style={s.stateBox}>
          <ActivityIndicator size="small" color={Colors.violet3} />
        </View>
      )}

      {!loading && !notConnected && !!error && (
        <View style={s.stateBox}>
          <Text style={s.errTxt}>{error}</Text>
          <Pressable onPress={onReload} accessibilityRole="button">
            <Text style={s.retryTxt}>Tentar de novo</Text>
          </Pressable>
        </View>
      )}

      {!loading && !notConnected && !error && templates.length > 0 && (
        <View style={s.list}>
          <Text style={s.listaTitulo}>Todos os templates da conta</Text>
          {templates.map((t) => {
            const spec = waTemplateStatusSpec(t.status);
            const tone = waTonePair(spec.tone);
            return (
              <View key={`${t.name}:${t.language}`} style={s.row}>
                <View style={s.rowMain}>
                  <Text style={s.rowTitle} numberOfLines={1}>{t.name}</Text>
                  <Text style={s.rowMeta} numberOfLines={1}>
                    {waCategoryLabel(t.category)} · {t.language || "—"}
                    {t.last_status_at ? ` · atualizado ${fmtWhenBR(t.last_status_at)}` : ""}
                  </Text>
                  {!!t.body_preview && <Text style={s.rowPreview} numberOfLines={2}>{t.body_preview}</Text>}
                </View>
                <View style={[s.badge, { backgroundColor: tone.bg }]}>
                  <Icon name={spec.icon} size={12} color={tone.color} />
                  <Text style={[s.badgeTxt, { color: tone.color }]}>{spec.label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink2, marginTop: 8, lineHeight: 17, maxWidth: 620 },
  ghostBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 9, paddingVertical: 7, paddingHorizontal: 11,
  },
  ghostTxt: { fontSize: 12, fontWeight: "700", color: Colors.ink3 },
  btnDisabled: { opacity: 0.5 },
  presets: { gap: 10, marginTop: 14 },
  preset: { backgroundColor: Colors.bg2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, padding: 12, gap: 4 },
  presetHead: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  presetTitulo: { fontSize: 13.5, fontWeight: "800", color: Colors.ink },
  presetNome: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  presetDesc: { fontSize: 11.5, color: Colors.ink2, lineHeight: 16.5, marginTop: 4, maxWidth: 560 },
  presetNota: { fontSize: 11.5, color: Colors.amber, lineHeight: 16.5, marginTop: 6, maxWidth: 560 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    marginTop: 9, alignSelf: "flex-start", minHeight: 40,
  },
  primaryTxt: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  list: { gap: 8, marginTop: 16 },
  listaTitulo: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase" },
  row: {
    flexDirection: "row", alignItems: "flex-start", gap: 10, flexWrap: "wrap",
    backgroundColor: Colors.bg2, borderRadius: 11, borderWidth: 1, borderColor: Colors.border, padding: 11,
  },
  rowMain: { flex: 1, minWidth: 180, gap: 2 },
  rowTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  rowMeta: { fontSize: 11, color: Colors.ink3 },
  rowPreview: { fontSize: 11.5, color: Colors.ink2, marginTop: 3, lineHeight: 16 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  badgeTxt: { fontSize: 10.5, fontWeight: "700" },
  stateBox: { alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 22 },
  stateTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.ink2, textAlign: "center", maxWidth: 420 },
  errTxt: { fontSize: 12, color: Colors.red, marginTop: 10, lineHeight: 17 },
  retryTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3, marginTop: 4 },
  okBox: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: Colors.greenD,
    borderRadius: 9, paddingVertical: 8, paddingHorizontal: 10, alignSelf: "flex-start",
  },
  okTxt: { fontSize: 12, fontWeight: "700", color: Colors.green },
} as any);
