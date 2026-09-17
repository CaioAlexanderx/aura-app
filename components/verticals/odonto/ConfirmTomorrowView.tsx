// ============================================================
// AURA. — Confirmar amanhã (mockup 16/09/2026, aba F)
//
// Rotina de fim de dia dentro da aba Lista (não é tela nova no NAV).
// - "A confirmar": WhatsApp com a mensagem pronta ancorada na linha e
//   "Marcar confirmado";
// - confirmados descem esmaecidos; os confirmados aqui ganham Desfazer;
// - barra "3 de 7 confirmados · faltam 4" soma em tempo real (cache
//   otimista de useDentalAppointmentMutation);
// - no celular (< 768 px) um cartão por paciente com botões grandes.
// O contador do atalho usa o mesmo cache (useTomorrowAppointments).
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { dentalStatus } from "@/constants/dentalStatus";
import { confirmationText, openWhatsApp } from "@/utils/whatsapp";
import { notify } from "@/utils/webAlert";
import { hhmm, pendingTomorrowCount, splitTomorrow, tomorrowLocalString } from "@/utils/dentalAgenda";
import { dateOnlyToLocalDate } from "@/utils/dateOnly";
import { useDentalAppointmentMutation } from "@/hooks/useDentalAppointmentMutation";
import { AC, AgendaBtn, AnchoredBox, CopyButton, Hint, MessageBubble, useIsSheet } from "./agendaModalKit";

export interface TomorrowAppointment {
  id: string;
  scheduled_at: string;
  duration_min?: number | null;
  status?: string | null;
  patient_name?: string | null;
  patient_phone?: string | null;
  chief_complaint?: string | null;
  professional_name?: string | null;
}

/** Agendamentos de amanhã (todos os status). Mesma chave para o contador e a lista. */
export function useTomorrowAppointments() {
  const cid = useAuthStore().company?.id;
  const ymd = tomorrowLocalString();
  const query = useQuery({
    queryKey: ["dental-tomorrow", cid, ymd],
    queryFn: () => request<{ appointments: TomorrowAppointment[] }>(`/companies/${cid}/dental/appointments?from=${ymd}&to=${ymd}`),
    enabled: !!cid,
    staleTime: 30000,
  });
  const list = query.data?.appointments || [];
  return { ...query, ymd, list, pending: pendingTomorrowCount(list) };
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const firstName = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "Paciente";

export function ConfirmTomorrowView({ onOpen }: { onOpen?: (a: TomorrowAppointment) => void }) {
  const company = useAuthStore().company;
  const sheet = useIsSheet();
  const { list, ymd, isLoading, error } = useTomorrowAppointments();
  const mut = useDentalAppointmentMutation(company?.id);
  const [popId, setPopId] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<Record<string, string>>({});
  const [confirmedHere, setConfirmedHere] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const split = useMemo(() => splitTomorrow(list), [list]);
  const day = dateOnlyToLocalDate(ymd);
  const dayTitle = day ? `${WEEKDAYS[day.getDay()]}, ${day.getDate()} de ${MONTHS[day.getMonth()]}` : "Amanhã";

  function textFor(a: TomorrowAppointment) {
    return confirmationText({ patientName: a.patient_name || "", clinicName: company?.name, when: new Date(a.scheduled_at) });
  }

  function openWa(a: TomorrowAppointment) {
    if (openWhatsApp(a.patient_phone, textFor(a))) {
      setSentAt((m) => ({ ...m, [a.id]: m[a.id] || hhmm(new Date()) }));
    }
  }

  function setStatus(a: TomorrowAppointment, to: "confirmado" | "agendado") {
    setBusyId(a.id);
    mut.mutate(
      { id: a.id, patch: { status: to } },
      {
        onSuccess: () => {
          if (to === "confirmado") {
            setConfirmedHere((m) => ({ ...m, [a.id]: true }));
            if (popId === a.id) setPopId(null);
            notify(`${firstName(a.patient_name)} confirmado para amanhã às ${hhmm(new Date(a.scheduled_at))}`);
          } else {
            setConfirmedHere((m) => ({ ...m, [a.id]: false }));
          }
        },
        onSettled: () => setBusyId(null),
      },
    );
  }

  const sentTag = (a: TomorrowAppointment) =>
    sentAt[a.id] ? (
      <View style={[s.tag, s.tagSent]}><Icon name="whatsapp" size={12} color={AC.waInk} /><Text style={[s.tagText, { color: AC.waInk }]}>Mensagem enviada {sentAt[a.id]}</Text></View>
    ) : (
      <View style={s.tag}><Text style={s.tagText}>Sem contato ainda</Text></View>
    );

  const statusTag = (a: TomorrowAppointment) => {
    const st = dentalStatus(a.status);
    return (
      <View style={[s.tag, { backgroundColor: st.bg }]}>
        <Icon name="check" size={12} color={st.color} />
        <Text style={[s.tagText, { color: st.color }]}>{st.short}</Text>
      </View>
    );
  };

  const preview = (a: TomorrowAppointment) =>
    popId === a.id && (
      <AnchoredBox testID={`tomorrow-preview-${a.id}`} title={`Mensagem pronta para ${firstName(a.patient_name)} · ${a.patient_phone}`} caretLeft={sheet ? "22%" : "68%"}>
        <MessageBubble text={textFor(a)} />
        <View style={s.acts}>
          <AgendaBtn testID={`tomorrow-wa-open-${a.id}`} small variant="waSolid" icon="whatsapp" label="Abrir no WhatsApp" onPress={() => openWa(a)} />
          <CopyButton text={textFor(a)} label="Copiar" />
        </View>
        <Hint>Abre a conversa com o texto; você só aperta enviar. Quando responder, toque em Marcar confirmado.</Hint>
      </AnchoredBox>
    );

  const waBtn = (a: TomorrowAppointment, big: boolean) =>
    a.patient_phone ? (
      <AgendaBtn
        testID={`tomorrow-wa-${a.id}`}
        small={!big}
        variant="wa"
        icon="whatsapp"
        label="WhatsApp"
        onPress={() => setPopId((cur) => (cur === a.id ? null : a.id))}
        style={big ? s.bigBtn : undefined}
        accessibilityLabel={`WhatsApp de ${a.patient_name || "paciente"}`}
      />
    ) : (
      <Text style={[s.noPhone, big && s.bigBtn]}>Sem telefone</Text>
    );

  const confirmBtn = (a: TomorrowAppointment, big: boolean) => (
    <AgendaBtn
      testID={`tomorrow-confirm-${a.id}`}
      small={!big}
      variant="primary"
      icon="check"
      label={big ? "Confirmado" : "Marcar confirmado"}
      loading={busyId === a.id}
      disabled={!!busyId && busyId !== a.id}
      onPress={() => setStatus(a, "confirmado")}
      style={big ? s.bigBtn : undefined}
      accessibilityLabel={`Marcar ${a.patient_name || "paciente"} como confirmado`}
    />
  );

  const undoBtn = (a: TomorrowAppointment) =>
    confirmedHere[a.id] && a.status === "confirmado" ? (
      <AgendaBtn testID={`tomorrow-undo-${a.id}`} small variant="ghost" label="Desfazer" loading={busyId === a.id} onPress={() => setStatus(a, "agendado")} />
    ) : null;

  const sub = (a: TomorrowAppointment) =>
    [a.chief_complaint || "Consulta", a.duration_min ? `${a.duration_min} min` : null].filter(Boolean).join(" · ");

  return (
    <View style={[s.wrap, !sheet && s.wrapDesk]} testID="confirm-tomorrow">
      <View style={s.head}>
        <View style={{ flexShrink: 1 }}>
          <Text style={s.title}>Confirmar amanhã</Text>
          <Text style={s.subtitle}>{dayTitle} · {split.total} consulta{split.total === 1 ? "" : "s"}</Text>
        </View>
        {split.total > 0 && (
          <View style={s.prog} testID="tomorrow-progress">
            <Text style={s.progText}><Text style={{ fontWeight: "700", color: AC.ink }}>{split.label}</Text> · faltam {split.pending.length}</Text>
            <View style={s.bar}><View style={[s.barFill, { width: `${split.pct}%` as any }]} /></View>
          </View>
        )}
      </View>

      {isLoading && <View style={{ padding: 30, alignItems: "center" }}><ActivityIndicator color={AC.cyan} /></View>}
      {!isLoading && error && <Hint style={{ marginTop: 16 }}>Não foi possível carregar as consultas de amanhã.</Hint>}
      {!isLoading && !error && split.total === 0 && (
        <View style={s.empty}><Text style={s.emptyText}>Nenhuma consulta marcada para amanhã.</Text></View>
      )}
      {!isLoading && !error && split.total > 0 && split.pending.length === 0 && (
        <View style={s.empty} testID="tomorrow-all-done">
          <Text style={s.emptyText}>Tudo certo! {split.total === 1 ? "O paciente de amanhã está confirmado." : `Os ${split.total} pacientes de amanhã estão confirmados.`}</Text>
        </View>
      )}

      {split.pending.length > 0 && <Text style={s.sec}>A confirmar ({split.pending.length})</Text>}
      {split.pending.map((a) =>
        sheet ? (
          <View key={a.id} style={s.card} testID={`tomorrow-row-${a.id}`}>
            <View style={s.cardTop}>
              <Text style={s.time}>{hhmm(new Date(a.scheduled_at))}</Text>
              <Text style={s.who} numberOfLines={1} onPress={onOpen ? () => onOpen(a) : undefined}>{a.patient_name || "Paciente"}</Text>
            </View>
            <Text style={s.cardSub}>{sub(a)}{a.patient_phone ? ` · ${a.patient_phone}` : ""}</Text>
            {sentTag(a)}
            <View style={s.cardActs}>{waBtn(a, true)}{confirmBtn(a, true)}</View>
            {preview(a)}
          </View>
        ) : (
          <View key={a.id} style={s.row} testID={`tomorrow-row-${a.id}`}>
            <View style={s.rowMain}>
              <Text style={[s.time, { width: 62 }]}>{hhmm(new Date(a.scheduled_at))}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.who} numberOfLines={1} onPress={onOpen ? () => onOpen(a) : undefined}>{a.patient_name || "Paciente"}</Text>
                <Text style={s.rowSub} numberOfLines={1}>{sub(a)}</Text>
              </View>
              <Text style={s.phone}>{a.patient_phone || ""}</Text>
              <View style={{ width: 200 }}>{sentTag(a)}</View>
              <View style={s.rowActs}>{waBtn(a, false)}{confirmBtn(a, false)}</View>
            </View>
            {preview(a)}
          </View>
        ),
      )}

      {split.done.length > 0 && <Text style={s.sec}>Confirmados ({split.done.length})</Text>}
      {split.done.map((a) =>
        sheet ? (
          <View key={a.id} style={[s.card, s.done]} testID={`tomorrow-done-${a.id}`}>
            <View style={s.cardTop}>
              <Text style={s.time}>{hhmm(new Date(a.scheduled_at))}</Text>
              <Text style={[s.who, { flex: 1 }]} numberOfLines={1}>{a.patient_name || "Paciente"}</Text>
              {undoBtn(a)}
            </View>
            <Text style={[s.cardSub, { marginBottom: 4 }]}>{a.chief_complaint || "Consulta"}</Text>
            {statusTag(a)}
          </View>
        ) : (
          <View key={a.id} style={[s.row, s.done]} testID={`tomorrow-done-${a.id}`}>
            <View style={s.rowMain}>
              <Text style={[s.time, { width: 62 }]}>{hhmm(new Date(a.scheduled_at))}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.who} numberOfLines={1}>{a.patient_name || "Paciente"}</Text>
                <Text style={s.rowSub} numberOfLines={1}>{sub(a)}</Text>
              </View>
              <Text style={s.phone}>{a.patient_phone || ""}</Text>
              <View style={{ width: 200 }}>{statusTag(a)}</View>
              <View style={s.rowActs}>{undoBtn(a)}</View>
            </View>
          </View>
        ),
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 0 },
  wrapDesk: { backgroundColor: AC.bg2, borderWidth: 1, borderColor: AC.border, borderRadius: 12, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 },
  head: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16 },
  title: { fontSize: 17, fontWeight: "700", color: AC.ink },
  subtitle: { fontSize: 12.5, color: AC.ink2, marginTop: 2 },
  prog: { minWidth: 220 },
  progText: { fontSize: 12, color: AC.ink2 },
  bar: { height: 8, borderRadius: 4, backgroundColor: AC.surfaceStrong, overflow: "hidden", marginTop: 6 },
  barFill: { height: "100%" as any, backgroundColor: AC.confirmed, borderRadius: 4 },
  sec: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: AC.ink3, marginTop: 18, marginBottom: 6, fontWeight: "700" },
  row: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: AC.border, borderRadius: 10, marginBottom: 6, backgroundColor: AC.surface },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowSub: { fontSize: 12, color: AC.ink2 },
  rowActs: { flexDirection: "row", gap: 6, justifyContent: "flex-end", width: 290 },
  done: { opacity: 0.55, backgroundColor: "transparent" },
  time: { fontSize: 15, fontWeight: "500", color: AC.ink, fontVariant: ["tabular-nums"] },
  who: { fontSize: 13.5, fontWeight: "700", color: AC.ink },
  phone: { width: 140, fontSize: 13, color: AC.ink2, fontVariant: ["tabular-nums"] },
  tag: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: AC.surfaceStrong },
  tagSent: { backgroundColor: AC.waBg },
  tagText: { fontSize: 11.5, fontWeight: "600", color: AC.ink2 },
  acts: { flexDirection: "row", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" },
  card: { borderWidth: 1, borderColor: AC.border, backgroundColor: AC.surface, borderRadius: 14, padding: 12, marginBottom: 8 },
  cardTop: { flexDirection: "row", gap: 10, alignItems: "center" },
  cardSub: { fontSize: 12, color: AC.ink2, marginTop: 2, marginBottom: 8 },
  cardActs: { flexDirection: "row", gap: 8, marginTop: 10 },
  bigBtn: { flex: 1, minHeight: 44 },
  noPhone: { fontSize: 12, color: AC.ink3, fontStyle: "italic", textAlign: "center", textAlignVertical: "center", paddingVertical: 8 },
  empty: { marginTop: 16, padding: 26, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: AC.border2, borderRadius: 12 },
  emptyText: { fontSize: 13, color: AC.ink2, textAlign: "center" },
});

export default ConfirmTomorrowView;
