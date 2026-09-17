// ============================================================
// AURA. — D-UNIFY: Detalhes do agendamento odonto
// PATCH /companies/:id/dental/appointments/:aid
//
// Item 10 (2026-04-27): Assinatura vinculada ao fim do atendimento.
// PR24 (2026-04-28): atalho "Abrir prontuario".
// Mockup "Agenda Odonto" (16/09/2026, abas C e G):
// - selo de status no cabeçalho, clicável, com os 8 status (cor e dica de
//   constants/dentalStatus);
// - faixa vermelha de alergia antes de qualquer dado;
// - WhatsApp abre a prévia da mensagem ancorada abaixo do botão ("Abrir no
//   WhatsApp", "Copiar texto"); Ligar mostra o número;
// - um único botão principal que muda com o status (utils/dentalAgenda),
//   "Editar / remarcar" do lado oposto, "Cancelar consulta" só no menu ⋯;
// - "Concluir atendimento" oferece concluir agora ou pedir a assinatura
//   do paciente (SignatureRequestModal, fluxo de antes);
// - "Iniciar atendimento" muda o status e abre o modo consulta;
// - atualização otimista + carregamento no botão (o QA via 3–4 s de atraso);
// - no celular (< 768 px) vira folha de baixo com botões de 48 px.
// ============================================================
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { DENTAL_STATUS_ORDER, dentalStatus } from "@/constants/dentalStatus";
import { appointmentMessage, openTel, openWhatsApp } from "@/utils/whatsapp";
import { primaryActionFor, showEditButton, whenLine } from "@/utils/dentalAgenda";
import { useDentalAppointmentMutation } from "@/hooks/useDentalAppointmentMutation";
import { SignatureRequestModal } from "./SignatureRequestModal";
import { NewAppointmentModal } from "./NewAppointmentModal";
import { CancelAppointmentModal } from "./CancelAppointmentModal";
import {
  AC, AgendaBtn, AgendaModalFrame, AnchoredBox, CopyButton, Hint, MessageBubble, StatusBadge, canCopy, copyText, useIsSheet,
} from "./agendaModalKit";

interface Props {
  visible: boolean;
  appointmentId: string | null;
  onClose: () => void;
  /** Dados já carregados na lista/grade: o modal abre na hora, sem esperar o GET. */
  seed?: Record<string, any> | null;
}

type Step = "detail" | "edit" | "cancel" | "return" | "signature";
type Menu = null | "status" | "more";
type Pop = null | "wa" | "call" | "conclude";

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";
const firstName = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "paciente";

export function AppointmentDetailModal({ visible, appointmentId, onClose, seed }: Props) {
  const company = useAuthStore().company;
  const cid = company?.id;
  const router = useRouter();
  const sheet = useIsSheet();
  const mut = useDentalAppointmentMutation(cid);

  const [step, setStep] = useState<Step>("detail");
  const [menu, setMenu] = useState<Menu>(null);
  const [pop, setPop] = useState<Pop>(null);
  const [waOpened, setWaOpened] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setStep("detail"); setMenu(null); setPop(null); setWaOpened(false); setBusy(null);
  }, [appointmentId, visible]);

  const { data, isLoading } = useQuery({
    queryKey: ["dental-appointment", cid, appointmentId],
    queryFn: () => request<any>(`/companies/${cid}/dental/appointments/${appointmentId}`),
    enabled: !!cid && !!appointmentId && visible,
    staleTime: 5000,
    placeholderData: seed && seed.id === appointmentId ? { appointment: seed } : undefined,
  });

  const appt = (data as any)?.appointment;
  const status: string = appt?.status || "agendado";
  const primary = primaryActionFor(status);
  const patientName: string = appt?.patient_name || "Paciente";
  const phone: string | null = appt?.patient_phone || null;
  const patientId = appt?.customer_id || appt?.patient_id;
  const when = appt?.scheduled_at ? new Date(appt.scheduled_at) : null;
  const message = when ? appointmentMessage({ status, patientName, clinicName: company?.name, when }) : "";

  function closeAll() {
    setStep("detail");
    onClose();
  }

  function toggleMenu(m: Menu) { setPop(null); setMenu((cur) => (cur === m ? null : m)); }
  function togglePop(p: Pop) { setMenu(null); setWaOpened(false); setPop((cur) => (cur === p ? null : p)); }

  function changeStatus(to: string, after?: () => void) {
    if (!appointmentId) return;
    setBusy(to);
    mut.mutate(
      { id: appointmentId, patch: { status: to } },
      { onSuccess: () => after?.(), onSettled: () => setBusy(null) },
    );
  }

  function openConsulta() {
    if (!appointmentId) return;
    closeAll();
    router.push(`/dental/consulta/${appointmentId}` as any);
  }

  function openProntuario() {
    if (!patientId) return;
    closeAll();
    router.push(`/dental/(clinic)/pacientes?open_patient=${patientId}&tab=prontuario` as any);
  }

  function pickStatus(to: string) {
    setMenu(null);
    if (to === status) return;
    if (to === "cancelado") { setStep("cancel"); return; }
    changeStatus(to);
  }

  function onPrimary() {
    setMenu(null);
    switch (primary.kind) {
      case "status":
        setPop(null);
        changeStatus(primary.to, primary.openConsulta ? openConsulta : undefined);
        break;
      case "conclude":
        togglePop("conclude");
        break;
      case "return":
        setStep("return");
        break;
      case "reschedule":
        setStep("edit");
        break;
    }
  }

  // ── cabeçalho ──
  const statusMenu = menu === "status" && (
    <View style={[s.menu, s.menuLeft]} testID="detail-status-menu" accessibilityRole="menu">
      {DENTAL_STATUS_ORDER.map((k) => {
        const st = dentalStatus(k);
        return (
          <Pressable key={k} testID={`status-opt-${k}`} onPress={() => pickStatus(k)} style={s.menuItem} accessibilityRole="menuitem">
            <View style={[s.dot, st.dashed ? { borderWidth: 2, borderStyle: "dashed", borderColor: st.color } : { backgroundColor: st.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.menuText}>{st.label}</Text>
              <Text style={s.menuHint}>{st.hint}</Text>
            </View>
            {k === status && <Icon name="check" size={14} color={AC.cyanInk} />}
          </Pressable>
        );
      })}
    </View>
  );

  const canConclude = status === "em_atendimento" || status === "confirmado" || status === "agendado" || status === "paciente_consultorio";
  const moreMenu = menu === "more" && (
    <View style={[s.menu, s.menuRight]} testID="detail-more-menu" accessibilityRole="menu">
      {sheet && patientId && (
        <MenuItem icon="file_text" label="Abrir prontuário" onPress={openProntuario} />
      )}
      {status === "em_atendimento" && (
        <MenuItem icon="play_circle" label="Abrir modo consulta" onPress={openConsulta} />
      )}
      {canConclude && (
        <MenuItem testID="more-signature" icon="edit" label="Concluir com assinatura do paciente" onPress={() => { setMenu(null); setStep("signature"); }} />
      )}
      {canCopy && phone && (
        <MenuItem icon="copy" label="Copiar telefone" onPress={() => { copyText(phone); setMenu(null); }} />
      )}
      {status !== "cancelado" && status !== "concluido" && (
        <>
          <View style={s.menuSep} />
          <MenuItem testID="more-cancel" icon="x" label="Cancelar consulta…" danger onPress={() => { setMenu(null); setStep("cancel"); }} />
        </>
      )}
    </View>
  );

  const header = (
    <View style={[s.head, sheet && s.headSheet]}>
      <View style={s.avatar}><Text style={s.avatarText}>{initials(patientName)}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.name} numberOfLines={2}>{patientName}</Text>
        {appt && (
          <Text style={s.sub}>
            {whenLine(appt.scheduled_at, appt.duration_min || 60)} · {appt.duration_min || 60} min
            {appt.professional_name ? ` · ${appt.professional_name}` : ""}
          </Text>
        )}
        {appt && (
          <View style={{ marginTop: 8, zIndex: 30 }}>
            <StatusBadge testID="detail-status" status={status} chevron expanded={menu === "status"} onPress={() => toggleMenu("status")} />
            {statusMenu}
          </View>
        )}
      </View>
      <View style={s.tools}>
        {appt && (
          <View style={{ zIndex: 30 }}>
            <Pressable testID="detail-more" onPress={() => toggleMenu("more")} style={s.iconBtn} accessibilityLabel="Mais ações" accessibilityRole="button">
              <Icon name="more_vertical" size={18} color={AC.ink2} />
            </Pressable>
            {moreMenu}
          </View>
        )}
        <Pressable testID="detail-close" onPress={closeAll} style={s.iconBtn} accessibilityLabel="Fechar" accessibilityRole="button">
          <Icon name="x" size={16} color={AC.ink2} />
        </Pressable>
      </View>
    </View>
  );

  const allergy = appt?.allergies ? (
    <View style={[s.allergy, sheet && { marginHorizontal: 16 }]} testID="detail-allergy" accessibilityRole="alert">
      <Icon name="alert" size={16} color={AC.redInk} />
      <Text style={s.allergyText}><Text style={{ fontWeight: "800" }}>Alergia:</Text> {appt.allergies}</Text>
    </View>
  ) : null;

  // ── rodapé ──
  const primaryBtn = appt && (
    <AgendaBtn
      testID="detail-primary"
      variant="primary"
      large={sheet}
      icon={primary.icon}
      label={primary.label}
      loading={!!busy}
      disabled={mut.isPending}
      onPress={onPrimary}
    />
  );
  const editBtn = appt && showEditButton(status) && (
    <AgendaBtn testID="detail-edit" variant="outline" large={sheet} icon="edit" label="Editar / remarcar" onPress={() => { setMenu(null); setStep("edit"); }} disabled={mut.isPending} />
  );
  const footer = appt ? (sheet ? <>{primaryBtn}{editBtn}</> : <>{editBtn}<View style={{ flex: 1 }} />{primaryBtn}</>) : undefined;

  const procedures: any[] = appt?.procedures || [];

  return (
    <>
      <AgendaModalFrame
        visible={visible && step === "detail"}
        onClose={closeAll}
        sheet={sheet}
        testID="detail-modal"
        header={header}
        banner={allergy}
        footer={footer}
      >
        {isLoading && !appt ? (
          <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={AC.cyan} /></View>
        ) : !appt ? (
          <View style={{ padding: 40, alignItems: "center" }}><Hint>Agendamento não encontrado</Hint></View>
        ) : (
          <>
            <View style={s.facts}>
              {procedures.length > 0 && <Fact label="Procedimento" value={procedures.map((p) => p.procedure_name).filter(Boolean).join(", ")} sheet={sheet} />}
              <Fact label="Telefone" value={phone || "Sem telefone cadastrado"} sheet={sheet} />
              <Fact label="Pagamento" value={appt.insurance_name ? `Convênio ${appt.insurance_name}` : "Particular"} sheet={sheet} />
              <Fact label="Observação" value={appt.chief_complaint || "Sem observações"} sheet={sheet} />
              {status === "cancelado" && appt.cancel_reason ? <Fact label="Motivo" value={appt.cancel_reason} sheet={sheet} /> : null}
            </View>

            {procedures.length > 0 && Number(appt.total) > 0 && (
              <Text style={s.total}>Total dos procedimentos: R$ {Number(appt.total).toFixed(2).replace(".", ",")}</Text>
            )}

            {phone ? (
              <View style={s.contact}>
                <AgendaBtn testID="detail-wa" variant="wa" large={sheet} icon="whatsapp" label="WhatsApp" onPress={() => togglePop("wa")} style={sheet ? { flex: 1 } : undefined} accessibilityLabel={`WhatsApp de ${patientName}`} />
                <AgendaBtn testID="detail-call" variant="outline" large={sheet} icon="call" label="Ligar" onPress={() => togglePop("call")} style={sheet ? { flex: 1 } : undefined} accessibilityLabel={`Ligar para ${patientName}`} />
                {!sheet && patientId && (
                  <Pressable onPress={openProntuario} style={s.link} testID="detail-prontuario" accessibilityRole="link">
                    <Text style={s.linkText}>Ver prontuário →</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={s.contact}>
                <Hint style={{ marginTop: 0 }}>Sem telefone cadastrado</Hint>
                {!sheet && patientId && (
                  <Pressable onPress={openProntuario} style={s.link} testID="detail-prontuario" accessibilityRole="link">
                    <Text style={s.linkText}>Ver prontuário →</Text>
                  </Pressable>
                )}
              </View>
            )}

            {pop === "wa" && phone && (
              <AnchoredBox testID="detail-wa-preview" title={`Mensagem pronta · ${phone}`} caretLeft={sheet ? "22%" : 26}>
                <MessageBubble text={message} />
                <View style={s.acts}>
                  {waOpened ? (
                    <View style={s.tagSent}><Icon name="check" size={12} color={AC.waInk} /><Text style={s.tagSentText}>WhatsApp aberto em outra aba</Text></View>
                  ) : (
                    <AgendaBtn
                      testID="detail-wa-open"
                      small
                      variant="waSolid"
                      icon="whatsapp"
                      label="Abrir no WhatsApp"
                      onPress={() => { if (openWhatsApp(phone, message)) setWaOpened(true); }}
                    />
                  )}
                  <CopyButton text={message} />
                </View>
                <Hint>Abre a conversa com o texto já escrito. Você revisa e aperta enviar.</Hint>
              </AnchoredBox>
            )}

            {pop === "call" && phone && (
              <AnchoredBox testID="detail-call-box" title={`Ligar para ${firstName(patientName)}`} caretLeft={sheet ? "70%" : 140}>
                <Text style={s.bignum} selectable>{phone}</Text>
                <View style={s.acts}>
                  <CopyButton text={phone} label="Copiar número" />
                  {sheet ? (
                    <AgendaBtn small variant="primary" icon="call" label="Chamar" onPress={() => openTel(phone)} />
                  ) : (
                    <Hint style={{ marginTop: 0 }}>No celular, este botão abre o discador direto.</Hint>
                  )}
                </View>
              </AnchoredBox>
            )}

            {pop === "conclude" && (
              <AnchoredBox testID="detail-conclude" title="Como concluir o atendimento?" caretLeft={sheet ? 26 : "85%"}>
                <View style={s.acts}>
                  <AgendaBtn testID="detail-conclude-now" small variant="primary" icon="check" label="Concluir agora" loading={busy === "concluido"} onPress={() => changeStatus("concluido", () => setPop(null))} />
                  <AgendaBtn testID="detail-conclude-sign" small icon="edit" label="Pedir assinatura do paciente" onPress={() => { setPop(null); setStep("signature"); }} />
                </View>
                <Hint>Com assinatura, a consulta é concluída quando o paciente assinar no celular dele.</Hint>
              </AnchoredBox>
            )}
          </>
        )}
      </AgendaModalFrame>

      <NewAppointmentModal
        visible={visible && step === "edit" && !!appt}
        appointment={appt ? { ...appt, id: appointmentId! } : null}
        onClose={() => setStep("detail")}
        onSaved={closeAll}
      />
      <NewAppointmentModal
        visible={visible && step === "return" && !!appt}
        initialPatient={appt && patientId ? { id: patientId, name: patientName, phone, allergies: appt.allergies } : null}
        initialNote="Retorno"
        initialDateTime={when ? new Date(when.getTime() + 7 * 24 * 3600 * 1000).toISOString() : undefined}
        onClose={() => setStep("detail")}
        onSaved={closeAll}
      />
      <CancelAppointmentModal
        visible={visible && step === "cancel" && !!appt}
        appointment={appt ? { ...appt, id: appointmentId! } : null}
        onBack={() => setStep("detail")}
        onCancelled={closeAll}
        onReschedule={() => setStep("edit")}
      />
      <SignatureRequestModal
        visible={visible && step === "signature"}
        appointmentId={appointmentId}
        patientName={appt?.patient_name}
        patientPhone={appt?.patient_phone}
        onClose={() => setStep("detail")}
        onSigned={closeAll}
      />
    </>
  );
}

function Fact({ label, value, sheet }: { label: string; value: string; sheet: boolean }) {
  return (
    <View style={s.fact}>
      <Text style={[s.factLabel, { width: sheet ? 100 : 120 }]}>{label}</Text>
      <Text style={s.factValue}>{value}</Text>
    </View>
  );
}

function MenuItem({ icon, label, onPress, danger, testID }: { icon: string; label: string; onPress: () => void; danger?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={s.menuItem} accessibilityRole="menuitem">
      <Icon name={icon} size={15} color={danger ? AC.redInk : AC.ink2} />
      <Text style={[s.menuText, danger && { color: AC.redInk }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, alignItems: "flex-start", zIndex: 20 },
  headSheet: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: AC.violet, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  name: { fontSize: 18, fontWeight: "700", color: AC.ink, letterSpacing: -0.2 },
  sub: { fontSize: 12.5, color: AC.ink2, marginTop: 1 },
  tools: { flexDirection: "row", gap: 6 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: AC.border, backgroundColor: AC.surface, alignItems: "center", justifyContent: "center" },
  menu: { position: "absolute", top: "100%" as any, marginTop: 6, zIndex: 40, backgroundColor: AC.modal, borderWidth: 1, borderColor: AC.border2, borderRadius: 12, padding: 6, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16 },
  menuLeft: { left: 0, minWidth: 260 },
  menuRight: { right: 0, minWidth: 250 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 8, minHeight: 40 },
  menuText: { fontSize: 13, color: AC.ink, fontWeight: "600" },
  menuHint: { fontSize: 11, color: AC.ink3 },
  menuSep: { height: 1, backgroundColor: AC.border, marginVertical: 5, marginHorizontal: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  allergy: { marginHorizontal: 20, marginBottom: 12, flexDirection: "row", gap: 8, alignItems: "center", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: AC.redBg, borderWidth: 1, borderColor: AC.redBorder },
  allergyText: { color: AC.redInk, fontSize: 13, flex: 1 },
  facts: { marginTop: 4, marginBottom: 14, gap: 7 },
  fact: { flexDirection: "row", gap: 12 },
  factLabel: { fontSize: 13, color: AC.ink3 },
  factValue: { fontSize: 13, color: AC.ink, fontWeight: "500", flex: 1 },
  total: { fontSize: 12.5, color: AC.ink2, marginTop: -6, marginBottom: 12 },
  contact: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  link: { marginLeft: "auto" as any, paddingVertical: 6 },
  linkText: { color: AC.cyanInk, fontSize: 12.5, fontWeight: "600" },
  acts: { flexDirection: "row", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" },
  tagSent: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: AC.waBg },
  tagSentText: { fontSize: 11.5, fontWeight: "600", color: AC.waInk },
  bignum: { fontSize: 20, fontWeight: "500", letterSpacing: 0.3, color: AC.ink, fontVariant: ["tabular-nums"] },
});

export default AppointmentDetailModal;
