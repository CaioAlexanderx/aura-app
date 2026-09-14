// ============================================================
// Reativação por WhatsApp (Fase 7) — quem sumiu, e o cupom que traz de volta
//
// O motor de reativação já existia e só fazia uma coisa: mostrar a lista.
// Esta tela é a outra metade — ela ENVIA. E porque envia, ela é escrita
// com as mesmas três travas do resto do módulo de WhatsApp:
//
// 1. Nada sai sem prévia. O botão de disparo abre a simulação (quantas
//    mensagens sairiam, quantas seriam puladas e por quê) e só depois
//    existe o confirmar. Aqui a mensagem é MARKETING: custa mais que a
//    cobrança, então a contagem aparece como "N mensagens de marketing
//    pagas", não como "N clientes".
// 2. Campo ausente = bloqueado. `marketing_consent_at`, `addon_active`,
//    `templates_ready.reativacao_cupom` — qualquer um faltando trava o
//    envio e o automático, com o motivo escrito e o caminho para
//    resolver. Backend anterior à fase não devolve nada disso, e é
//    exatamente por isso que omissão nunca pode virar permissão.
// 3. Desligar é livre. Ligar o automático semanal passa pela prévia;
//    desligar salva na hora, sem diálogo — quem está gastando tem que
//    poder parar.
//
// O teto de 50 por disparo é do backend e é de propósito: marketing em
// volume derruba a qualidade do número na Meta, e número rebaixado deixa
// de mandar até a cobrança.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Switch } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import {
  reactivationApi, type ReactivationCustomer, type ReactivationTarget,
} from "@/services/reactivationApi";
import { waApi, WaStatus, WA_REATIVACAO_TEMPLATES } from "@/services/waApi";
import {
  fmtDayMonthBR, isWaErrorCode, mapWaError, waMarketingBlockers, waMarketingCostLabel,
  waPreviewSkippedSummary, waSkipReasonLabel,
} from "@/components/whatsapp/waGuards";
import { PreviaMarketingModal } from "@/components/whatsapp/PreviaMarketingModal";

/** Teto do backend por disparo. Repetido aqui só para avisar ANTES do clique. */
const MAX_POR_DISPARO = 50;

const ALVOS: { key: ReactivationTarget; label: string; desc: string }[] = [
  { key: "at_risk", label: "Em risco", desc: "sem comprar há 31 a 60 dias" },
  { key: "dormant", label: "Inativo", desc: "sem comprar há 61 a 120 dias" },
  { key: "both", label: "Os dois", desc: "em risco + inativo, dos que gastaram mais" },
];

function fmtBRL(v: number | null | undefined): string {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ReativacaoScreen() {
  const { company } = useAuthStore();
  const companyId = company?.id || "";

  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);
  const [clientes, setClientes] = useState<ReactivationCustomer[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});

  const [waStatus, setWaStatus] = useState<WaStatus | null>(null);
  const [waLoading, setWaLoading] = useState(true);

  const [alvo, setAlvo] = useState<ReactivationTarget>("at_risk");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const [previaEnvio, setPreviaEnvio] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const [auto, setAuto] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoErr, setAutoErr] = useState<string | null>(null);
  const [previaAuto, setPreviaAuto] = useState(false);

  // ── Carregamentos ───────────────────────────────────────
  const carregarLista = useCallback(async () => {
    if (!companyId) { setCarregando(false); return; }
    setCarregando(true);
    setErroLista(null);
    setSemAcesso(false);
    try {
      const d = await reactivationApi.get(companyId);
      setClientes(Array.isArray(d?.priority_reactivation) ? d.priority_reactivation : []);
      setMetrics((d?.metrics || {}) as Record<string, number>);
    } catch (e: any) {
      // 403 = plano sem o módulo. Não é falha: é o plano.
      if (e?.status === 403) setSemAcesso(true);
      else setErroLista(e?.data?.error || e?.message || "Não foi possível carregar a lista.");
      setClientes([]);
    } finally {
      setCarregando(false);
    }
  }, [companyId]);

  const carregarWa = useCallback(async () => {
    if (!companyId) { setWaLoading(false); return; }
    setWaLoading(true);
    try {
      setWaStatus(await waApi.getStatus(companyId));
    } catch {
      setWaStatus(null);
    } finally {
      setWaLoading(false);
    }
  }, [companyId]);

  const carregarSettings = useCallback(async () => {
    if (!companyId) return;
    try {
      const st = await reactivationApi.getSettings(companyId);
      setAuto(st?.wa_reactivation_auto === true);
    } catch {
      setAuto(false);
    }
  }, [companyId]);

  useEffect(() => { carregarLista(); }, [carregarLista]);
  useEffect(() => { carregarWa(); }, [carregarWa]);
  useEffect(() => { carregarSettings(); }, [carregarSettings]);

  // ── Guardas ─────────────────────────────────────────────
  const blockers = waMarketingBlockers(waStatus, {
    templateKeys: WA_REATIVACAO_TEMPLATES,
    labels: {
      SEM_STATUS: "Não foi possível verificar o WhatsApp da loja — recarregue antes de enviar.",
      ADDON: "O envio por WhatsApp oficial não está no seu plano. Fale com a Aura para ativar.",
      CONEXAO: "Conecte o número da loja na aba WhatsApp.",
      TOKEN: "A autorização da Meta expirou — reconecte o número da loja.",
      TEMPLATE: "O template de reativação ainda não foi aprovado pela Meta.",
      CONSENTIMENTO: "Marque o consentimento de marketing na aba WhatsApp — sem ele nenhuma mensagem de reativação sai.",
    },
  });
  const podeEnviar = !waLoading && blockers.length === 0;

  const doAlvo = useMemo(() => {
    return clientes.filter((c) => {
      const seg = String(c.segment || "");
      if (alvo === "both") return seg === "at_risk" || seg === "dormant";
      return seg === alvo;
    });
  }, [clientes, alvo]);

  const selecionadosDoAlvo = useMemo(
    () => doAlvo.filter((c) => selecionados.has(c.id)),
    [doAlvo, selecionados]
  );

  // Sem seleção, o disparo vale para o segmento inteiro (com o teto).
  const quantidadeEnvio = selecionadosDoAlvo.length > 0
    ? Math.min(selecionadosDoAlvo.length, MAX_POR_DISPARO)
    : Math.min(doAlvo.length, MAX_POR_DISPARO);

  function alternarSelecao(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_POR_DISPARO) next.add(id);
      return next;
    });
  }

  // ── Disparo ─────────────────────────────────────────────
  async function enviar() {
    setEnviando(true);
    setErroEnvio(null);
    setResultado(null);
    try {
      const ids = selecionadosDoAlvo.map((c) => c.id).slice(0, MAX_POR_DISPARO);
      const r = await reactivationApi.send(companyId, {
        segment: alvo,
        limit: quantidadeEnvio,
        ...(ids.length ? { customer_ids: ids } : {}),
      });
      const enviadas = Number(r?.queued) || 0;
      const motivoGeral = waSkipReasonLabel(r?.skipped_reason);
      const pulados = waPreviewSkippedSummary(r?.skipped);
      setResultado(
        enviadas > 0
          ? `${waMarketingCostLabel(enviadas)} entraram na fila.${pulados ? ` Pulados: ${pulados}.` : ""}`
          : motivoGeral
            ? motivoGeral
            : `Nenhuma mensagem entrou na fila.${pulados ? ` Motivos: ${pulados}.` : ""}`
      );
      if (enviadas > 0) toast.success(`${enviadas} ${enviadas === 1 ? "mensagem enviada" : "mensagens enviadas"} para a fila`);
      setSelecionados(new Set());
      setPreviaEnvio(false);
      carregarLista();
      carregarWa();
    } catch (e: any) {
      const code = e?.data?.code ?? e?.code ?? null;
      setErroEnvio(isWaErrorCode(code) ? mapWaError(e).message : (e?.data?.error || e?.message || "Não foi possível enviar."));
      if (isWaErrorCode(code)) carregarWa();
    } finally {
      setEnviando(false);
    }
  }

  // ── Automático semanal ──────────────────────────────────
  async function salvarAuto(next: boolean) {
    setAutoSaving(true);
    setAutoErr(null);
    try {
      const res = await reactivationApi.saveSettings(companyId, { wa_reactivation_auto: next });
      setAuto(typeof res?.wa_reactivation_auto === "boolean" ? res.wa_reactivation_auto : next);
      setPreviaAuto(false);
    } catch (e: any) {
      const code = e?.data?.code ?? e?.code ?? null;
      setAutoErr(isWaErrorCode(code) ? mapWaError(e).message : (e?.data?.error || e?.message || "Não foi possível salvar."));
      setAuto(false);
      if (isWaErrorCode(code)) carregarWa();
    } finally {
      setAutoSaving(false);
    }
  }

  const autoTravado = !auto && (waLoading || blockers.length > 0);

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <View style={st.headerRow}>
        <Pressable onPress={() => router.push("/(tabs)/clientes")} style={st.backBtn} testID="reativacao-voltar">
          <Icon name="chevron_left" size={16} color={Colors.violet3} />
          <Text style={st.backText}>Clientes</Text>
        </Pressable>
      </View>

      <Text style={st.pageTitle}>Reativação por WhatsApp</Text>
      <Text style={st.pageSubtitle}>
        Um cupom com prazo curto para quem parou de comprar. A mensagem é de marketing: custa mais
        que a cobrança, depende da autorização do cliente e cada pessoa recebe no máximo uma a cada
        7 dias.
      </Text>

      {semAcesso && (
        <View style={st.card} testID="reativacao-sem-plano">
          <Text style={st.cardTitle}>Disponível no plano Expansão</Text>
          <Text style={st.cardSub}>
            A reativação de clientes faz parte do plano Expansão. Fale com a Aura para ativar — a
            lista de quem sumiu continua no painel de retenção.
          </Text>
          <Pressable onPress={() => router.push("/(tabs)/planos")} style={st.primaryBtn} accessibilityRole="button">
            <Text style={st.primaryTxt}>Ver planos</Text>
          </Pressable>
        </View>
      )}

      {!semAcesso && (
        <>
          {/* ── Resumo dos segmentos ── */}
          <View style={st.metrics} testID="reativacao-metricas">
            <View style={st.metric}>
              <Text style={st.metricNum}>{metrics.at_risk ?? 0}</Text>
              <Text style={st.metricTxt}>em risco</Text>
            </View>
            <View style={st.metric}>
              <Text style={st.metricNum}>{metrics.dormant ?? 0}</Text>
              <Text style={st.metricTxt}>inativos</Text>
            </View>
            <View style={st.metric}>
              <Text style={st.metricNum}>{metrics.lost ?? 0}</Text>
              <Text style={st.metricTxt}>perdidos</Text>
            </View>
          </View>

          {/* ── Bloqueios do canal ── */}
          {!waLoading && blockers.length > 0 && (
            <View style={st.blockBox} testID="reativacao-bloqueios">
              {blockers.map((b) => (
                <View key={b.code} style={st.blockRow}>
                  <Icon name="alert" size={12} color={Colors.amber} />
                  <Text style={st.blockTxt}>{b.label}</Text>
                </View>
              ))}
              <Pressable
                onPress={() => router.push("/(tabs)/whatsapp")}
                accessibilityRole="button"
                style={st.link}
                testID="reativacao-configurar-wa"
              >
                <Icon name="arrow_right" size={13} color={Colors.violet3} />
                <Text style={st.linkTxt}>Configurar WhatsApp</Text>
              </Pressable>
            </View>
          )}

          {/* ── Quem receber ── */}
          <Text style={st.sectionTitle}>Quem receber</Text>
          <View style={st.card}>
            <View style={st.chips}>
              {ALVOS.map((a) => (
                <Pressable
                  key={a.key}
                  onPress={() => { setAlvo(a.key); setSelecionados(new Set()); }}
                  style={[st.chip, alvo === a.key && st.chipOn]}
                  testID={`reativacao-alvo-${a.key}`}
                >
                  <Text style={[st.chipTxt, alvo === a.key && st.chipTxtOn]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={st.hint}>
              {ALVOS.find((a) => a.key === alvo)?.desc}. A lista abaixo é a prioritária: os que mais
              gastaram entre os que sumiram. Sem marcar ninguém, o envio vale para o segmento inteiro
              (no máximo {MAX_POR_DISPARO} por disparo).
            </Text>

            {carregando && <View style={st.loadingBox}><ActivityIndicator color={Colors.violet3} /></View>}

            {!carregando && !!erroLista && (
              <View style={st.loadingBox}>
                <Text style={st.errTxt}>{erroLista}</Text>
                <Pressable onPress={carregarLista} accessibilityRole="button">
                  <Text style={st.retryTxt}>Tentar de novo</Text>
                </Pressable>
              </View>
            )}

            {!carregando && !erroLista && doAlvo.length === 0 && (
              <Text style={st.vazio} testID="reativacao-vazio">
                Ninguém neste segmento agora — o que é uma boa notícia.
              </Text>
            )}

            {!carregando && !erroLista && doAlvo.length > 0 && (
              <View style={st.lista} testID="reativacao-lista">
                {doAlvo.map((c) => {
                  const marcado = selecionados.has(c.id);
                  const contatado = String(c.reactivation_status || "") === "contacted";
                  const quando = fmtDayMonthBR(c.contacted_at);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => alternarSelecao(c.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: marcado }}
                      style={[st.linha, marcado && st.linhaOn]}
                      testID={`reativacao-cliente-${c.id}`}
                    >
                      <View style={[st.box, marcado && st.boxOn]}>
                        {marcado && <Icon name="check" size={12} color="#fff" />}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={st.nome} numberOfLines={1}>{c.name}</Text>
                        <Text style={st.meta} numberOfLines={1}>
                          {fmtBRL(c.total_spent)}
                          {typeof c.days_since_purchase === "number" ? ` · há ${c.days_since_purchase} dias sem comprar` : ""}
                          {!c.phone ? " · sem telefone" : ""}
                        </Text>
                        {contatado && (
                          <Text style={st.contatado} testID={`reativacao-contatado-${c.id}`}>
                            contatado{quando ? ` em ${quando}` : ""}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Pressable
              onPress={() => { setErroEnvio(null); setResultado(null); setPreviaEnvio(true); }}
              disabled={!podeEnviar || quantidadeEnvio === 0 || enviando}
              accessibilityRole="button"
              style={[st.primaryBtn, (!podeEnviar || quantidadeEnvio === 0 || enviando) && st.btnDisabled]}
              testID={podeEnviar ? "reativacao-enviar" : "reativacao-enviar-travado"}
            >
              <Icon name="whatsapp" size={14} color="#fff" />
              <Text style={st.primaryTxt}>
                {selecionadosDoAlvo.length > 0
                  ? `Enviar cupom para ${selecionadosDoAlvo.length} selecionados`
                  : "Enviar cupom de reativação por WhatsApp"}
              </Text>
            </Pressable>

            {!!resultado && <Text style={st.resultado} testID="reativacao-resultado">{resultado}</Text>}
            {!!erroEnvio && <Text style={st.errTxt} testID="reativacao-erro">{erroEnvio}</Text>}
          </View>

          {/* ── Automático semanal ── */}
          <Text style={st.sectionTitle}>Reativação automática</Text>
          <View style={st.card}>
            <View style={st.autoHead}>
              <View style={{ flex: 1 }}>
                <Text style={st.cardTitle}>Reativação automática semanal</Text>
                <Text style={st.cardSub}>
                  Uma vez por semana a loja manda o cupom para quem entrou em risco, num lote
                  pequeno. O teto é baixo de propósito: marketing em volume derruba a qualidade do
                  número na Meta, e número rebaixado para de enviar até a cobrança.
                </Text>
              </View>
              <Switch
                value={auto}
                onValueChange={(v) => { setAutoErr(null); if (!v) salvarAuto(false); else setPreviaAuto(true); }}
                disabled={autoTravado || autoSaving}
                trackColor={{ false: Colors.bg4 as any, true: Colors.violet }}
                thumbColor="#fff"
                accessibilityLabel="Reativação automática semanal"
                accessibilityState={{ disabled: autoTravado || autoSaving, checked: auto }}
                testID={autoTravado ? "reativacao-auto-travado" : "reativacao-auto"}
              />
            </View>
            {waLoading && !auto && (
              <Text style={st.verificando} testID="reativacao-auto-verificando">
                Verificando a conexão do WhatsApp da loja…
              </Text>
            )}
            {!!autoErr && <Text style={st.errTxt} testID="reativacao-auto-erro">{autoErr}</Text>}
          </View>
        </>
      )}

      <PreviaMarketingModal
        visible={previaEnvio}
        titulo="Enviar cupom de reativação"
        descricao={
          selecionadosDoAlvo.length > 0
            ? `A prévia simula o segmento; o envio vai para os ${selecionadosDoAlvo.length} clientes marcados — ${waMarketingCostLabel(selecionadosDoAlvo.length)}.`
            : `O envio vai para até ${quantidadeEnvio} clientes deste segmento — ${waMarketingCostLabel(quantidadeEnvio)}.`
        }
        confirmLabel="Enviar agora"
        savingLabel="Enviando…"
        carregar={() => reactivationApi.preview(companyId, { segment: alvo, limit: quantidadeEnvio })}
        status={waStatus}
        saving={enviando}
        onCancel={() => setPreviaEnvio(false)}
        onConfirm={() => enviar()}
        idBase="reativacao-previa"
      />

      <PreviaMarketingModal
        visible={previaAuto}
        titulo="Ligar a reativação automática semanal"
        descricao="Antes de ligar, veja quantos clientes entrariam no próximo lote e o que isso custa."
        confirmLabel="Ativar envio automático"
        savingLabel="Ativando…"
        carregar={() => reactivationApi.preview(companyId, { segment: "at_risk", limit: 30 })}
        status={waStatus}
        saving={autoSaving}
        onCancel={() => setPreviaAuto(false)}
        onConfirm={() => salvarAuto(true)}
        idBase="reativacao-auto-previa"
      />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 720, alignSelf: "center", width: "100%" },

  headerRow: { marginBottom: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },

  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 6, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginBottom: 20, maxWidth: 620 },

  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 10, marginTop: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  cardSub: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginTop: 6, maxWidth: 520 },

  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flex: 1, minWidth: 110, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingVertical: 12, paddingHorizontal: 13 },
  metricNum: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  metricTxt: { fontSize: 11.5, fontWeight: "600", color: Colors.ink2, marginTop: 2 },

  blockBox: { marginTop: 14, backgroundColor: Colors.amberD, borderRadius: 12, borderWidth: 1, borderColor: Colors.amber + "33", padding: 12, gap: 6 },
  blockRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  blockTxt: { flex: 1, fontSize: 11.5, color: Colors.amber, fontWeight: "600", lineHeight: 16.5 },
  link: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, alignSelf: "flex-start", borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 11 },
  linkTxt: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  chipTxt: { fontSize: 13, fontWeight: "700", color: Colors.ink2 },
  chipTxtOn: { color: "#fff" },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 12, lineHeight: 16, maxWidth: 560 },

  loadingBox: { paddingVertical: 26, alignItems: "center", gap: 6 },
  vazio: { fontSize: 12.5, color: Colors.ink3, marginTop: 16, lineHeight: 18 },
  lista: { gap: 7, marginTop: 14 },
  linha: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: Colors.bg2, borderRadius: 11, borderWidth: 1, borderColor: Colors.border, paddingVertical: 10, paddingHorizontal: 11, minHeight: 44 },
  linhaOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  box: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.border2, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg3, marginTop: 1 },
  boxOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  nome: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  meta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  contatado: { fontSize: 10.5, color: Colors.violet3, fontWeight: "700", marginTop: 3 },

  autoHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  verificando: { fontSize: 11, color: Colors.ink3, marginTop: 9, fontStyle: "italic" },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.violet, borderRadius: 11, paddingVertical: 13, paddingHorizontal: 16,
    marginTop: 16, alignSelf: "flex-start", minHeight: 44,
  },
  primaryTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.45 },
  resultado: { fontSize: 12, color: Colors.ink2, marginTop: 12, lineHeight: 17, fontWeight: "600" },
  errTxt: { fontSize: 12, color: Colors.red, marginTop: 10, lineHeight: 17 },
  retryTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
} as any);
