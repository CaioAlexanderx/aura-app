// ============================================================
// AURA. — Ótica: detalhe da OS de óculos
//
// A esteira vira linha do tempo: aberta → enviada ao laboratório → no
// laboratório → lentes recebidas → montagem → pronta → entregue. O botão
// principal muda conforme a estação; refação é ação secundária (volta ao
// laboratório com contador e motivo, sem perder a OS).
//
// "Avisar cliente" só existe depois de PRONTA e manda o link de
// acompanhamento (/acompanhar/:token) — nunca a receita (dado de saúde).
// Se o WhatsApp oficial não estiver conectado ou a fila pular, cai no
// wa.me com o texto pronto.
//
// Entrega: aqui, e não no PDV. A OS de óculos já tem venda (o sinal), e o
// saldo é uma parcela no crediário — vincular uma segunda venda cobraria o
// cliente duas vezes. Ver OsActions.tsx (kind='reparo').
//
// Mockup aprovado: docs/mockups/otica-modulo.html, tela 3.
// ============================================================
import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput, Platform, Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { copyToClipboard } from "@/utils/clipboard";
import { serviceOrdersApi, printOs, type ServiceOrderItem } from "@/services/serviceOrdersApi";
import {
  oticaApi, LAB_STATUS_LABEL, LENS_USE_LABEL, PRESCRIBER_LABEL,
  type LabStatus, type OpticalOrder, fmtIsoDate, daysUntil,
} from "@/services/oticaApi";
import { RxGrid } from "@/components/otica/RxGrid";

const fmt = (n: number | string | null | undefined) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function fmtDate(iso?: string | null, hora = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
    ...(hora ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).replace(",", "");
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

type Step = { key: string; title: string; detail: string; state: "done" | "now" | "todo" };

/** Monta a linha do tempo a partir do status + lab_status da OS. */
export function buildTimeline(os: OpticalOrder): Step[] {
  const ls = (os.lab_status || "aguardando_envio") as LabStatus;
  const closed = os.status === "entregue" || os.status === "cancelada";
  const ready = os.status === "pronta" || os.status === "entregue";
  const inLabDays = daysSince(os.lab_sent_at);
  const labLine = os.lab_name ? os.lab_name + (os.lab_order_ref ? " · pedido " + os.lab_order_ref : "") : "sem laboratório";

  const sent = !!os.lab_sent_at || ready || ["no_laboratorio", "recebida", "em_montagem", "refacao"].includes(ls);
  const received = !!os.lab_received_at || ready || ["recebida", "em_montagem"].includes(ls);
  // Lentes recebidas = a bancada é a etapa ATUAL (o botão "Iniciar montagem"
  // mora nela). Antes só virava atual em em_montagem, e a OS ficava sem
  // botão nenhum entre "chegaram" e "montar" (QA no app, 15/09/2026).
  const mounting = ready || received;

  const steps: Step[] = [
    { key: "aberta", title: `Aberta${os.deposit_sale_total != null ? " · sinal recebido" : ""}`, detail: fmtDate(os.created_at, true), state: "done" },
    { key: "enviada", title: "Enviada ao laboratório", detail: sent ? `${fmtDate(os.lab_sent_at, true)} · ${labLine}` : "Aguardando envio", state: sent ? "done" : "now" },
    {
      key: "no_lab",
      title: ls === "refacao" ? "Refação: volta ao laboratório" : received ? "Lentes recebidas" : "No laboratório",
      detail: received ? fmtDate(os.lab_received_at, true) : sent && inLabDays != null ? `há ${inLabDays} ${inLabDays === 1 ? "dia" : "dias"}` : "",
      state: received ? "done" : sent ? "now" : "todo",
    },
    { key: "montagem", title: "Conferência e montagem", detail: "Lensômetro · checklist de bancada", state: ready ? "done" : mounting ? "now" : "todo" },
    { key: "pronta", title: "Pronta", detail: os.ready_notified_at ? `Cliente avisado em ${fmtDate(os.ready_notified_at, true)}` : "Avisa o cliente com o link de acompanhamento", state: ready ? (os.status === "entregue" ? "done" : "now") : "todo" },
    { key: "entregue", title: "Entregue", detail: os.delivered_at ? fmtDate(os.delivered_at, true) : "Recebe o saldo e fecha a OS", state: os.status === "entregue" ? "done" : "todo" },
  ];
  if (closed && os.status === "cancelada") steps.forEach((s) => { if (s.state === "now") s.state = "todo"; });
  return steps;
}

export default function OticaOsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company } = useAuthStore();
  const { settings } = usePdvSettings();
  const enabled = settings.otica_enabled === true;
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [labRef, setLabRef] = useState<string | null>(null);
  const [redoNote, setRedoNote] = useState("");
  const [showRedo, setShowRedo] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [notify, setNotify] = useState<{ queued: boolean; skip_reason?: string | null; track_url: string; wa_link: string | null } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["service-order", company?.id, id],
    queryFn: () => serviceOrdersApi.get(company!.id, String(id)),
    enabled: !!company?.id && !!id,
  });
  const os = data?.order as OpticalOrder | undefined;
  const items: ServiceOrderItem[] = data?.items || [];

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["service-order", company?.id, id] });
    qc.invalidateQueries({ queryKey: ["service-orders"] });
    qc.invalidateQueries({ queryKey: ["otica-dashboard"] });
  }

  async function run(fn: () => Promise<any>, okMsg?: string) {
    if (busy || !company?.id) return;
    setBusy(true);
    try {
      await fn();
      invalidate();
      if (okMsg) toast.success(okMsg);
    } catch (err: any) {
      toast.error(err?.data?.error || "Não deu para atualizar a OS");
    } finally {
      setBusy(false);
    }
  }

  function handlePrint() {
    if (!company?.id || !os) return;
    if (Platform.OS !== "web") { toast.info("Impressão disponível apenas na versão web"); return; }
    printOs(company.id, os.id);
  }

  async function handleNotify() {
    if (!company?.id || !os) return;
    setBusy(true);
    try {
      const r = await oticaApi.notifyReady(company.id, os.id);
      setNotify(r);
      invalidate();
      if (r.queued) toast.success("Aviso enfileirado no WhatsApp oficial");
      else if (r.wa_link) toast.info("WhatsApp oficial indisponível — abrindo o wa.me com o texto pronto");
    } catch (err: any) {
      toast.error(err?.data?.error || "Não deu para avisar o cliente");
    } finally {
      setBusy(false);
    }
  }

  async function copyTrack() {
    if (!os?.tracker_token) return;
    const url = notify?.track_url || (typeof window !== "undefined" ? `${window.location.origin}/acompanhar/${os.tracker_token}` : `/acompanhar/${os.tracker_token}`);
    const ok = await copyToClipboard(url);
    toast[ok ? "success" : "info"](ok ? "Link de acompanhamento copiado" : url);
  }

  if (isLoading || !os) {
    return (
      <View style={[st.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={Colors.violet3} />
      </View>
    );
  }

  const optical = os.optical;
  const ls = (os.lab_status || "aguardando_envio") as LabStatus;
  const fechada = os.status === "entregue" || os.status === "cancelada";
  const late = !!os.promised_at && !fechada && os.status !== "pronta" && (daysUntil(String(os.promised_at).slice(0, 10)) ?? 0) < 0;
  const lateDays = late ? Math.abs(daysUntil(String(os.promised_at).slice(0, 10)) ?? 0) : 0;
  const timeline = buildTimeline(os);
  const deposit = os.deposit_sale_total != null ? Number(os.deposit_sale_total) : null;
  const total = Number(os.estimated_amount || 0);
  const canWrite = enabled && !fechada;

  // Botão principal por estação. Uma ação de cada vez: é o que o balcão faz.
  let primary: { label: string; run: () => void } | null = null;
  if (canWrite) {
    if (os.status === "pronta") primary = { label: "Entregar ao cliente", run: () => run(() => serviceOrdersApi.setStatus(company!.id, os.id, "entregue"), "Óculos entregues · OS fechada") };
    else if (ls === "aguardando_envio" || ls === "refacao") primary = { label: ls === "refacao" ? "Reenviar ao laboratório" : "Enviar ao laboratório", run: () => run(() => oticaApi.setLabStatus(company!.id, os.id, "no_laboratorio", labRef ? { lab_order_ref: labRef } : undefined), "Enviada ao laboratório") };
    else if (ls === "no_laboratorio") primary = { label: "Lentes chegaram", run: () => run(() => oticaApi.setLabStatus(company!.id, os.id, "recebida"), "Lentes recebidas · conferir na bancada") };
    else if (ls === "recebida") primary = { label: "Iniciar montagem", run: () => run(() => oticaApi.setLabStatus(company!.id, os.id, "em_montagem"), "Em montagem") };
    else if (ls === "em_montagem") primary = { label: "Marcar como pronta", run: () => run(() => serviceOrdersApi.setStatus(company!.id, os.id, "pronta"), "Óculos prontos! Avise o cliente.") };
  }
  const canRedo = canWrite && (ls === "recebida" || ls === "em_montagem");

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <Pressable onPress={() => router.back()} style={st.backBtn}>
        <Icon name="chevron_left" size={16} color={Colors.violet3} />
        <Text style={st.backText}>Laboratório</Text>
      </Pressable>

      <View style={st.titleRow}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={st.pageTitle}>OS #{os.os_number} · {os.customer_name || "Cliente"}<Text style={{ color: Colors.violet }}>.</Text></Text>
          <Text style={st.pageSubtitle}>
            Aberta em {fmtDate(os.created_at)}{os.lab_name ? ` · ${os.lab_name}${os.lab_order_ref ? " pedido " + os.lab_order_ref : ""}` : ""}
            {!!os.promised_at && (
              <Text style={late ? { color: Colors.amber, fontWeight: "700" } : undefined}>
                {" "}· prometido {fmtDate(os.promised_at)}{late ? `, ${lateDays} ${lateDays === 1 ? "dia" : "dias"} de atraso` : ""}
              </Text>
            )}
            {os.status === "cancelada" ? " · CANCELADA" : os.status === "entregue" ? " · ENTREGUE" : ""}
          </Text>
        </View>
        <View style={st.headActions}>
          <Pressable onPress={handlePrint} style={st.ghostBtn} testID="otica-imprimir">
            <Icon name="receipt" size={14} color={Colors.ink} />
            <Text style={st.ghostBtnText}>Imprimir A4</Text>
          </Pressable>
          {!!os.tracker_token && (
            <Pressable onPress={copyTrack} style={st.ghostBtn} testID="otica-link">
              <Icon name="link" size={14} color={Colors.ink} />
              <Text style={st.ghostBtnText}>Link de acompanhamento</Text>
            </Pressable>
          )}
        </View>
      </View>

      {!enabled && !fechada && (
        <View style={st.warn}><Text style={st.warnText}>Módulo Ótica desligado: a OS fica só para leitura. Ligue em Configurações › Vendas para mudar de etapa.</Text></View>
      )}

      {/* ══ ESTEIRA ══ */}
      <Text style={st.sectionTitle}>Esteira</Text>
      <View style={st.card}>
        {timeline.map((s, i) => (
          <View key={s.key} style={[st.tl, i < timeline.length - 1 && st.tlLine]}>
            <View style={[st.dot, s.state === "done" && st.dotDone, s.state === "now" && st.dotNow]} />
            <View style={{ flex: 1 }}>
              <Text style={[st.tlTitle, s.state === "now" && { color: Colors.violet3 }, s.state === "todo" && { color: Colors.ink3 }]}>{s.title}</Text>
              {!!s.detail && <Text style={st.tlDetail}>{s.detail}</Text>}
            </View>
            {s.state === "now" && primary && (
              <Pressable onPress={primary.run} style={st.primaryBtn} disabled={busy} testID="otica-acao-principal">
                {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.primaryBtnText}>{primary.label}</Text>}
              </Pressable>
            )}
          </View>
        ))}

        {canWrite && (ls === "aguardando_envio" || ls === "refacao") && (
          <View style={{ marginTop: 12 }}>
            <Text style={st.lbl}>Nº do pedido no laboratório (opcional)</Text>
            <TextInput style={st.input} value={labRef ?? os.lab_order_ref ?? ""} onChangeText={setLabRef} placeholder="88213" placeholderTextColor={Colors.ink3} testID="otica-lab-ref" />
          </View>
        )}

        {late && (
          <View style={[st.warn, { marginTop: 12 }]}>
            <Text style={st.warnText}>Atrasada: o prazo prometido ao cliente foi {fmtDate(os.promised_at)}. Se o laboratório ainda não devolveu, vale ligar — e avisar o cliente antes que ele ligue.</Text>
          </View>
        )}

        {os.status === "pronta" && (
          <View style={[st.ok, { marginTop: 12 }]}>
            <Text style={st.okText}>
              {os.ready_notified_at
                ? `Cliente avisado em ${fmtDate(os.ready_notified_at, true)}. Quando ele vier buscar, entregue aqui: o saldo é recebido no caixa ou pelo Pix do link.`
                : "Óculos prontos. Avise o cliente pelo WhatsApp: a mensagem leva só o link de acompanhamento, nunca a receita."}
            </Text>
            {canWrite && (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <Pressable onPress={handleNotify} style={[st.primaryBtn, { backgroundColor: Colors.green, borderColor: Colors.green }]} disabled={busy} testID="otica-avisar">
                  <Icon name="whatsapp" size={14} color="#fff" />
                  <Text style={st.primaryBtnText}>{os.ready_notified_at ? "Avisar de novo" : "Avisar cliente"}</Text>
                </Pressable>
                {notify && !notify.queued && notify.wa_link && (
                  <Pressable onPress={() => Linking.openURL(notify.wa_link!)} style={st.ghostBtn} testID="otica-wa-me">
                    <Icon name="external_link" size={14} color={Colors.ink} />
                    <Text style={st.ghostBtnText}>Abrir no WhatsApp</Text>
                  </Pressable>
                )}
              </View>
            )}
            {notify && !notify.queued && (
              <Text style={st.hint}>Fila do WhatsApp oficial pulou ({notify.skip_reason || "sem motivo"}). O wa.me abre a conversa no seu celular ou WhatsApp Web com o texto pronto.</Text>
            )}
          </View>
        )}
      </View>

      {/* ══ RECEITA ══ */}
      {optical?.prescription && (
        <>
          <Text style={st.sectionTitle}>Receita congelada nesta OS</Text>
          <View style={st.card}>
            <RxGrid od={optical.prescription.od} oe={optical.prescription.oe} />
            <Text style={[st.hint, { marginTop: 10 }]}>
              {[optical.prescription.prescriber_name, optical.prescription.prescriber_registry].filter(Boolean).join(" · ") || PRESCRIBER_LABEL[optical.prescription.prescriber_type] || "prescritor não informado"}
              {optical.prescription.issued_at ? ` · emitida ${fmtIsoDate(optical.prescription.issued_at)}` : ""}
              {optical.prescription.valid_until ? ` · válida até ${fmtIsoDate(optical.prescription.valid_until)}` : ""}
            </Text>
          </View>
        </>
      )}

      {/* ══ ARMAÇÃO E LENTES ══ */}
      <Text style={st.sectionTitle}>Armação e lentes</Text>
      <View style={st.card}>
        <Row k="Armação" v={optical?.frame?.description ? `${optical.frame.description}${optical.frame.source === "cliente" ? " (do cliente)" : ""}` : "—"} />
        <Row k="Uso" v={optical?.use ? LENS_USE_LABEL[optical.use] || optical.use : "—"} />
        <Row k="Lente" v={[optical?.lens?.brand, optical?.lens?.design, optical?.lens?.material].filter(Boolean).join(" · ") || "—"} />
        <Row k="Tipo" v={optical?.lens?.type === "pronta" ? "Pronta (estoque)" : optical?.lens?.type === "surfacada" ? "Surfaçada (sob encomenda)" : "—"} />
        {!!optical?.lens?.treatments?.length && <Row k="Tratamentos" v={optical.lens.treatments.join(" · ")} />}
        {os.lab_redo_count != null && os.lab_redo_count > 0 && <Row k="Refações" v={String(os.lab_redo_count)} />}
      </View>

      {/* ══ FINANCEIRO ══ */}
      <Text style={st.sectionTitle}>Financeiro</Text>
      <View style={st.card}>
        {items.map((it, i) => (
          <View key={it.id || i} style={st.itemRow}>
            <Text style={st.itemDesc}>{it.description}</Text>
            <Text style={st.itemTotal}>{fmt(Number(it.quantity) * Number(it.unit_price))}</Text>
          </View>
        ))}
        <View style={st.totalRow}><Text style={st.totalLabel}>Total</Text><Text style={st.totalValue}>{fmt(total)}</Text></View>
        {deposit != null ? (
          <>
            {os.deposit_paid != null && Number(os.deposit_paid) > 0 ? (
              <>
                <Row k={`Sinal recebido · venda #${String(os.deposit_sale_id).slice(0, 8).toUpperCase()}`} v={fmt(os.deposit_paid)} />
                <Row k="Saldo na entrega" v={fmt(Math.max(0, deposit - Number(os.deposit_paid)))} />
              </>
            ) : (
              <Row k="Venda com sinal" v={`#${String(os.deposit_sale_id).slice(0, 8).toUpperCase()} · ${fmt(deposit)}`} />
            )}
            <Text style={st.hint}>O sinal entrou no caixa na abertura; o saldo virou parcela no crediário com vencimento na data prometida e aparece no link de acompanhamento com Pix.</Text>
          </>
        ) : (
          <Text style={st.hint}>Sem venda vinculada: o caixa fecha na entrega, pelo PDV.</Text>
        )}
      </View>

      {/* ══ GARANTIA ══ */}
      <Text style={st.sectionTitle}>Garantia</Text>
      <View style={st.card}>
        <Row k="Adaptação" v={`${optical?.adaptation_warranty_days ?? 0} dias após a entrega`} />
        <Row k="Laboratório" v={`${os.warranty_days || 0} dias`} />
        {!!os.delivered_at && !!optical?.adaptation_warranty_days && (
          <Row k="Adaptação até" v={fmtDate(new Date(new Date(os.delivered_at).getTime() + optical.adaptation_warranty_days * 86400000).toISOString())} />
        )}
      </View>

      {!!os.notes && (
        <>
          <Text style={st.sectionTitle}>Observações</Text>
          <View style={st.card}><Text style={st.txtBody}>{os.notes}</Text></View>
        </>
      )}

      {/* ══ AÇÕES SECUNDÁRIAS ══ */}
      {canWrite && (
        <>
          <Text style={st.sectionTitle}>Ações</Text>
          <View style={st.card}>
            <View style={st.actionsRow}>
              {canRedo && (
                <Pressable onPress={() => setShowRedo((v) => !v)} style={st.actionBtn} disabled={busy} testID="otica-refacao">
                  <Text style={st.actionText}>Refação (volta ao laboratório)</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setShowCancel((v) => !v)} style={[st.actionBtn, st.actionDanger]} disabled={busy} testID="otica-cancelar">
                <Text style={[st.actionText, st.actionTextDanger]}>Cancelar OS</Text>
              </Pressable>
            </View>
            {showRedo && (
              <View style={{ marginTop: 12 }}>
                <Text style={st.lbl}>Motivo da refação (vai para o laboratório)</Text>
                <TextInput style={[st.input, st.multiline]} value={redoNote} onChangeText={setRedoNote} placeholder="Eixo trocado, lente riscada, grau diferente da receita…" placeholderTextColor={Colors.ink3} multiline testID="otica-refacao-motivo" />
                <Pressable
                  onPress={() => {
                    if (!redoNote.trim()) { toast.error("Descreva o motivo: é o que o laboratório vai ler"); return; }
                    run(() => oticaApi.setLabStatus(company!.id, os.id, "refacao", { note: redoNote.trim() }), "Refação registrada").then(() => { setShowRedo(false); setRedoNote(""); });
                  }}
                  style={[st.actionBtn, { marginTop: 10, alignSelf: "flex-start" }]}
                  disabled={busy}
                  testID="otica-refacao-confirmar"
                >
                  <Text style={st.actionText}>Confirmar refação</Text>
                </Pressable>
              </View>
            )}
            {showCancel && (
              <View style={{ marginTop: 12 }}>
                <Text style={st.lbl}>Motivo do cancelamento</Text>
                <TextInput style={[st.input, st.multiline]} value={cancelReason} onChangeText={setCancelReason} placeholder="Cliente desistiu, receita refeita…" placeholderTextColor={Colors.ink3} multiline />
                <Text style={st.hint}>O sinal já registrado no caixa não é estornado por aqui — estorne pela venda, em Vendas.</Text>
                <Pressable
                  onPress={() => run(() => serviceOrdersApi.setStatus(company!.id, os.id, "cancelada", { cancel_reason: cancelReason.trim() || undefined }), "OS cancelada").then(() => setShowCancel(false))}
                  style={[st.actionBtn, st.actionDanger, { marginTop: 10, alignSelf: "flex-start" }]}
                  disabled={busy}
                  testID="otica-cancelar-confirmar"
                >
                  <Text style={[st.actionText, st.actionTextDanger]}>Confirmar cancelamento</Text>
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={st.row}>
      <Text style={st.rowK}>{k}</Text>
      <Text style={st.rowV}>{v}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 760, alignSelf: "center", width: "100%" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  titleRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 14, flexWrap: "wrap" },
  pageTitle: { fontFamily: Fonts.heading, fontSize: 34, lineHeight: 37, color: Colors.ink, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, color: Colors.ink3, lineHeight: 19, marginTop: 6 },
  headActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  ghostBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  ghostBtnText: { fontSize: 12, color: Colors.ink, fontWeight: "700" },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderWidth: 1, borderColor: Colors.violet, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, alignSelf: "flex-start" },
  primaryBtnText: { fontSize: 12, color: "#fff", fontWeight: "700" },

  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 10, marginTop: 18 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },

  tl: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 8, flexWrap: "wrap" },
  tlLine: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: Colors.border2, backgroundColor: Colors.bg3, marginTop: 3 },
  dotDone: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  dotNow: { borderColor: Colors.violet, shadowColor: Colors.violet, shadowOpacity: 0.5, shadowRadius: 6, elevation: 2 },
  tlTitle: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  tlDetail: { fontSize: 11, color: Colors.ink3, marginTop: 2 },

  lbl: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginBottom: 7 },
  input: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  multiline: { minHeight: 64, textAlignVertical: "top" },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 8, lineHeight: 16 },
  txtBody: { fontSize: 13, color: Colors.ink, lineHeight: 19 },
  warn: { backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber + "55", borderRadius: 10, padding: 10, marginBottom: 12 },
  warnText: { fontSize: 12, color: Colors.amber, lineHeight: 17 },
  ok: { backgroundColor: Colors.greenD, borderWidth: 1, borderColor: Colors.green + "55", borderRadius: 10, padding: 10 },
  okText: { fontSize: 12, color: Colors.green, lineHeight: 17 },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: 12 },
  rowK: { fontSize: 12, color: Colors.ink3 },
  rowV: { fontSize: 12, color: Colors.ink, fontWeight: "600", flex: 1, textAlign: "right" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemDesc: { fontSize: 13, color: Colors.ink, flex: 1 },
  itemTotal: { fontSize: 13, color: Colors.ink, fontWeight: "700", fontFamily: Fonts.mono },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 6 },
  totalLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  totalValue: { fontSize: 17, color: Colors.ink, fontWeight: "800", fontFamily: Fonts.mono },

  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  actionDanger: { backgroundColor: "transparent", borderColor: Colors.red + "66" },
  actionText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  actionTextDanger: { color: Colors.red },
});
