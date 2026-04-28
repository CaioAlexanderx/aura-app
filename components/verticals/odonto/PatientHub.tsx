// AURA. — PatientHub — orchestrator
// 11 sub-tabs + header redesenhado (PR28 mockup v2 aprovado)
//
// Header minimalista (cirurgico):
//   - Avatar 56px com botao webcam pra capturar/atualizar foto
//   - Nome + meta-linha (idade · genero · paciente desde)
//   - Max 2 tags clinicas (alergia red, condicao amber)
//   - 1 botao primario Editar + kebab com acoes secundarias
//
// Aba Dados embed inline - substitui DataTab antiga.

import { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView,
  Platform, Pressable, Image,
} from 'react-native';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { request } from '@/services/api';
import { toast } from '@/components/Toast';
import { DentalColors } from '@/constants/dental-tokens';
import { OdontoSubNav } from './OdontoSubNav';
import { PortalShareModal } from './PortalShareModal';
import { ConsentCollectModal } from './ConsentCollectModal';
import { DentalAiChat } from './DentalAiChat';
import { ImplantWorkflow } from './ImplantWorkflow';
import { OrthoWorkflow } from './OrthoWorkflow';
import { DocumentEmitter } from './DocumentEmitter';
import { VoiceEvolution } from './VoiceEvolution';
import { ExamRequestPanel } from './ExamRequestPanel';
import { WebcamCapture } from './WebcamCapture';
import {
  AnamneseTab, OdontogramaTab, PeriogramaTab,
  ProntuarioTab, ImagensTab, OrcamentosTab, CobrancasTab, FichasTab,
} from './PatientHubSubTabs';
import type { SubTab } from './sections';

export interface PatientLite {
  id: string;
  name: string;
  full_name?: string;
  phone?: string | null;
  phone_secondary?: string | null;
  email?: string | null;
  cpf?: string | null;
  birthday?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  postal_code?: string | null;
  street?: string | null;
  address_number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  allergies?: string | null;
  medical_history?: string | null;
  medications?: string | null;
  insurance_name?: string | null;
  notes?: string | null;
  is_patient?: boolean;
  created_at?: string;
  /** PR28: foto do paciente (capturada via webcam ou upload) */
  photo_url?: string | null;
}

interface Props {
  visible: boolean;
  patient: PatientLite | null;
  onClose: () => void;
  onEdit?: (patient: PatientLite) => void;
  initialTab?: string;
}

const HUB_TABS: SubTab[] = [
  { id: 'dados',       label: 'Dados',       component: () => null },
  { id: 'anamnese',    label: 'Anamnese',    component: () => null },
  { id: 'odontograma', label: 'Odontograma', component: () => null },
  { id: 'periograma',  label: 'Periograma',  component: () => null, badge: 'novo' },
  { id: 'prontuario',  label: 'Prontuario',  component: () => null },
  { id: 'imagens',     label: 'Imagens',     component: () => null },
  { id: 'orcamentos',  label: 'Orcamentos',  component: () => null },
  { id: 'cobrancas',   label: 'Cobrancas',   component: () => null },
  { id: 'fichas',      label: 'Fichas',      component: () => null },
  { id: 'implantes',   label: 'Implantes',   component: () => null },
  { id: 'ortodontia',  label: 'Ortodontia',  component: () => null },
];

function fmtBirth(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return "—"; }
}

function calcAge(iso?: string | null): number | null {
  if (!iso) return null;
  try {
    const birth = new Date(iso);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  } catch { return null; }
}

function fmtSince(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  } catch { return "—"; }
}

export function PatientHub({ visible, patient, onClose, onEdit, initialTab }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState(initialTab || 'dados');
  const [photoOverride, setPhotoOverride] = useState<string | null>(null);

  useEffect(() => {
    if (visible && initialTab) setActiveTab(initialTab);
    if (!visible) setPhotoOverride(null); // reset
  }, [visible, initialTab]);

  const [portalOpen, setPortalOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  const [kebabOpen, setKebabOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  // Persiste foto no backend (PATCH /companies/:cid/dental/patients/:id { photo_url }).
  // Se backend nao aceitar o campo, foto fica volatil ate refresh.
  const photoMut = useMutation({
    mutationFn: (photoUrl: string) =>
      request(`/companies/${cid}/dental/patients/${patient!.id}`, {
        method: "PATCH",
        body: { photo_url: photoUrl },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dental-patients", cid] });
    },
    onError: () => {
      // Silencioso: foto continua refletida visualmente via photoOverride state
    },
  });

  function handlePhotoCapture(dataUrl: string) {
    setPhotoOverride(dataUrl);
    photoMut.mutate(dataUrl);
  }

  if (!patient) return null;

  const initials = (patient.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const age = calcAge(patient.birth_date || patient.birthday);
  const genderLabel = patient.gender === "M" ? "Masculino" : patient.gender === "F" ? "Feminino" : patient.gender || "";
  const since = fmtSince(patient.created_at);
  const photoUrl = photoOverride || patient.photo_url;

  const renderTab = () => {
    switch (activeTab) {
      case 'dados':       return <DataTabV2 patient={patient} onEdit={() => onEdit?.(patient)} />;
      case 'anamnese':    return <AnamneseTab patient={patient} />;
      case 'odontograma': return <OdontogramaTab patient={patient} />;
      case 'periograma':  return <PeriogramaTab patient={patient} />;
      case 'prontuario':  return <ProntuarioTab patient={patient} onVoice={() => setVoiceOpen(true)} />;
      case 'imagens':     return <ImagensTab patient={patient} />;
      case 'orcamentos':  return <OrcamentosTab patient={patient} />;
      case 'cobrancas':   return <CobrancasTab patient={patient} />;
      case 'fichas':      return <FichasTab patient={patient} />;
      case 'implantes':   return <ImplantWorkflow patient={patient} />;
      case 'ortodontia':  return <OrthoWorkflow patient={patient} />;
      default:            return <DataTabV2 patient={patient} onEdit={() => onEdit?.(patient)} />;
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
        <View style={st.modal}>

          {/* Breadcrumb / close */}
          <View style={st.closeBar}>
            <Text style={st.breadcrumb}>
              <Text style={{ color: DentalColors.cyan, fontWeight: "600" }}>Pacientes</Text>
              {" · "}{patient.full_name || patient.name}
            </Text>
            <Pressable onPress={onClose} style={st.closeBtn}>
              <Text style={{ color: DentalColors.ink2, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>

          {/* HEADER MINIMALISTA */}
          <View style={st.header}>
            <View style={st.avatarWrap}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={st.avatar} />
              ) : (
                <View style={[st.avatar, { alignItems: "center", justifyContent: "center" }]}>
                  <Text style={st.avatarText}>{initials}</Text>
                </View>
              )}
              <Pressable onPress={() => setPhotoOpen(true)} style={st.photoBtn} {...(Platform.OS === "web" ? { title: "Tirar foto / atualizar" } : {})}>
                <Text style={{ color: "#fff", fontSize: 11 }}>📷</Text>
              </Pressable>
            </View>

            <View style={st.headerInfo}>
              <Text style={st.name} numberOfLines={1}>{patient.full_name || patient.name}</Text>
              <Text style={st.sub}>
                {age != null ? `${age} anos` : "Idade —"}
                {genderLabel ? ` · ${genderLabel}` : ""}
                {patient.created_at ? ` · Paciente desde ${since}` : ""}
              </Text>
              <View style={st.tags}>
                {patient.allergies && patient.allergies.trim() ? (
                  <View style={[st.tag, st.tagAlergia]}>
                    <Text style={[st.tagText, { color: DentalColors.red }]}>⚠ Alergia: {patient.allergies.split(",")[0].trim()}</Text>
                  </View>
                ) : null}
                {patient.medical_history && patient.medical_history.trim() ? (
                  <View style={[st.tag, st.tagCond]}>
                    <Text style={[st.tagText, { color: DentalColors.amber }]}>● {patient.medical_history.split(",")[0].trim()}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={st.actions}>
              {onEdit && (
                <Pressable onPress={() => onEdit(patient)} style={st.btnPrimary}>
                  <Text style={st.btnPrimaryText}>✏️ Editar</Text>
                </Pressable>
              )}
              <View style={{ position: "relative" }}>
                <Pressable onPress={() => setKebabOpen((v) => !v)} style={st.kebab}>
                  <Text style={{ color: DentalColors.ink2, fontSize: 18, lineHeight: 18 }}>⋯</Text>
                </Pressable>
                {kebabOpen && (
                  <View style={st.kebabMenu}>
                    <KebabItem icon="✨" label="IA Aura" onPress={() => { setKebabOpen(false); setAiOpen(true); }} />
                    <KebabItem icon="🔬" label="Solicitar exame" onPress={() => { setKebabOpen(false); setExamOpen(true); }} />
                    <KebabItem icon="🗒" label="Emitir documento" onPress={() => { setKebabOpen(false); setDocOpen(true); }} />
                    <KebabItem icon="📋" label="Coletar TCLE" onPress={() => { setKebabOpen(false); setConsentOpen(true); }} />
                    <KebabItem icon="🌐" label="Compartilhar portal" onPress={() => { setKebabOpen(false); setPortalOpen(true); }} />
                  </View>
                )}
              </View>
            </View>
          </View>

          <OdontoSubNav tabs={HUB_TABS} activeId={activeTab} onChange={setActiveTab} />
          <View style={{ flex: 1 }}>{renderTab()}</View>
        </View>
      </Modal>

      {/* Modais overlay */}
      <PortalShareModal visible={portalOpen} patientId={patient.id} patientName={patient.full_name||patient.name} patientPhone={patient.phone||undefined} onClose={() => setPortalOpen(false)} />
      <ConsentCollectModal visible={consentOpen} patientId={patient.id} patientName={patient.full_name||patient.name} patientPhone={patient.phone||undefined} onClose={() => setConsentOpen(false)} onSigned={() => { qc.invalidateQueries({ queryKey: ['dental-consent-docs', patient.id] }); }} />
      <DentalAiChat visible={aiOpen} onClose={() => setAiOpen(false)} initialPatientId={patient.id} initialPatientName={patient.full_name||patient.name} />
      <DocumentEmitter visible={docOpen} patient={patient} onClose={() => setDocOpen(false)} />
      <WebcamCapture
        visible={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onCapture={handlePhotoCapture}
        title="Foto do paciente"
        hint={`Atualize a foto de ${patient.full_name || patient.name}`}
        facing="user"
      />

      <Modal visible={voiceOpen} animationType="slide" onRequestClose={() => setVoiceOpen(false)} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
        <VoiceEvolution patient={patient} onClose={() => setVoiceOpen(false)} onSaved={() => { setVoiceOpen(false); qc.invalidateQueries({ queryKey: ['dental-prescriptions', patient.id] }); }} />
      </Modal>

      <Modal visible={examOpen} animationType="slide" onRequestClose={() => setExamOpen(false)} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
        <ExamRequestPanel patient={patient} onClose={() => setExamOpen(false)} onSaved={() => setExamOpen(false)} />
      </Modal>
    </>
  );
}

function KebabItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={st.kebabItem}>
      <Text style={{ width: 18, textAlign: "center", fontSize: 13 }}>{icon}</Text>
      <Text style={{ fontSize: 12, color: DentalColors.ink2 }}>{label}</Text>
    </Pressable>
  );
}

// ============================================================
// DataTabV2 — substitui o DataTab antigo (PatientHubSubTabs.DataTab).
// Layout 2 colunas: administrativo | clinico. Cards padronizados.
// ============================================================
function DataTabV2({ patient, onEdit }: { patient: PatientLite; onEdit?: () => void }) {
  const fullAddress = [patient.street, patient.address_number, patient.complement].filter(Boolean).join(", ");
  return (
    <ScrollView style={{ flex: 1, backgroundColor: DentalColors.bg }} contentContainerStyle={st.contentScroll}>
      <View style={st.grid2}>

        {/* COL 1: administrativo */}
        <View style={{ flex: 1.2, gap: 14, minWidth: 280 }}>
          <Card title="👤 IDENTIFICAÇÃO" actionLabel={onEdit ? "Editar" : undefined} onAction={onEdit}>
            <Field label="Nome completo" value={patient.full_name || patient.name} />
            <Field label="Nascimento" value={patient.birth_date ? `${fmtBirth(patient.birth_date)} · ${calcAge(patient.birth_date)} anos` : null} />
            <Field label="Genero" value={patient.gender === "M" ? "Masculino" : patient.gender === "F" ? "Feminino" : patient.gender} />
            <Field label="CPF" value={patient.cpf} last />
          </Card>

          <Card title="📞 CONTATO">
            <Field label="Telefone principal" value={patient.phone} />
            <Field label="Telefone secundario" value={patient.phone_secondary} />
            <Field label="E-mail" value={patient.email} last />
          </Card>

          <Card title="🏠 ENDEREÇO">
            <Field label="CEP" value={patient.postal_code} />
            <Field label="Logradouro" value={fullAddress} />
            <Field label="Bairro" value={patient.neighborhood} />
            <Field label="Cidade / UF" value={[patient.city, patient.state].filter(Boolean).join(" / ")} last />
          </Card>

          {patient.insurance_name ? (
            <Card title="💳 CONVÊNIO">
              <Field label="Operadora / Plano" value={patient.insurance_name} last />
            </Card>
          ) : null}
        </View>

        {/* COL 2: clinico */}
        <View style={{ flex: 1, gap: 14, minWidth: 280 }}>
          <Card title="📊 RESUMO CLÍNICO" accent="cyan">
            <SummaryRow icon="📅" label="Próximo retorno" value={"Sem retorno agendado"} muted />
            <SummaryRow icon="⏱" label="Última visita" value={patient.created_at ? "Ver historico abaixo" : "—"} muted />
            <SummaryRow icon="🦷" label="Plano de tratamento" value={"Acesse aba Orçamentos"} muted />
          </Card>

          {patient.notes && patient.notes.trim() ? (
            <Card title="📝 OBSERVAÇÕES" accent="amber">
              <Text style={{ fontSize: 12, color: DentalColors.ink2, lineHeight: 18 }}>{patient.notes}</Text>
            </Card>
          ) : null}

          {patient.allergies || patient.medical_history || patient.medications ? (
            <Card title="⚠ ANAMNESE RESUMIDA" accent="amber">
              {patient.allergies ? <Field label="Alergias" value={patient.allergies} valueStyle={{ color: DentalColors.red }} /> : null}
              {patient.medical_history ? <Field label="Condicoes" value={patient.medical_history} valueStyle={{ color: DentalColors.amber }} /> : null}
              {patient.medications ? <Field label="Medicamentos" value={patient.medications} last /> : null}
            </Card>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

function Card({ title, children, accent, actionLabel, onAction }: { title: string; children: any; accent?: "cyan" | "amber" | "violet"; actionLabel?: string; onAction?: () => void }) {
  const accentColor = accent === "amber" ? DentalColors.amber : accent === "violet" ? DentalColors.violet : DentalColors.cyan;
  const titleColor = accent === "amber" ? DentalColors.amber : accent === "violet" ? DentalColors.violet : DentalColors.cyan;
  return (
    <View style={[st.card, accent && { borderLeftWidth: 3, borderLeftColor: accentColor }]}>
      <View style={st.cardHead}>
        <Text style={[st.cardTitle, { color: titleColor }]}>{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction}>
            <Text style={st.cardAction}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Field({ label, value, valueStyle, last }: { label: string; value?: string | null; valueStyle?: any; last?: boolean }) {
  const isEmpty = !value || (typeof value === "string" && !value.trim());
  return (
    <View style={[st.field, last && { borderBottomWidth: 0 }]}>
      <Text style={st.fieldLbl}>{label}</Text>
      <Text style={[st.fieldVal, isEmpty && st.fieldEmpty, valueStyle]}>
        {isEmpty ? "—" : value}
      </Text>
    </View>
  );
}

function SummaryRow({ icon, label, value, muted }: { icon: string; label: string; value: string; muted?: boolean }) {
  return (
    <View style={st.summaryRow}>
      <View style={st.summaryIco}><Text style={{ fontSize: 13 }}>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={st.summaryLbl}>{label}</Text>
        <Text style={[st.summaryVal, muted && { color: DentalColors.ink2, fontWeight: "500" }]}>{value}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  modal: { flex: 1, backgroundColor: DentalColors.bg },

  closeBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 32, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: DentalColors.border, backgroundColor: "rgba(0,0,0,0.4)" },
  breadcrumb: { fontSize: 12, color: DentalColors.ink3, fontWeight: "500" },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: DentalColors.surface, borderWidth: 1, borderColor: DentalColors.border, alignItems: "center", justifyContent: "center" },

  header: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 32, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: DentalColors.border, flexWrap: "wrap" },
  avatarWrap: { position: "relative" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: DentalColors.cyan, borderWidth: 2, borderColor: DentalColors.cyanBorder },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 20 },
  photoBtn: { position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: DentalColors.cyan, borderWidth: 2, borderColor: DentalColors.bg, alignItems: "center", justifyContent: "center" },

  headerInfo: { flex: 1, minWidth: 200 },
  name: { fontSize: 20, fontWeight: "700", color: DentalColors.ink, letterSpacing: -0.3 },
  sub: { fontSize: 12, color: DentalColors.ink3, marginTop: 2 },
  tags: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  tag: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 6, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  tagAlergia: { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.30)" },
  tagCond: { backgroundColor: "rgba(251,191,36,0.10)", borderColor: "rgba(251,191,36,0.25)" },
  tagText: { fontSize: 11, fontWeight: "600" },

  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  btnPrimary: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 9, backgroundColor: DentalColors.cyan, borderWidth: 1, borderColor: DentalColors.cyan },
  btnPrimaryText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  kebab: { width: 36, height: 36, borderRadius: 9, backgroundColor: DentalColors.surface, borderWidth: 1, borderColor: DentalColors.border, alignItems: "center", justifyContent: "center" },
  kebabMenu: { position: "absolute", top: 44, right: 0, backgroundColor: DentalColors.bg2, borderWidth: 1, borderColor: DentalColors.border, borderRadius: 10, padding: 4, minWidth: 200, zIndex: 100, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  kebabItem: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 7 },

  contentScroll: { padding: 24 },
  grid2: { flexDirection: "row", gap: 16, flexWrap: "wrap" },

  card: { backgroundColor: DentalColors.surface, borderWidth: 1, borderColor: DentalColors.border, borderRadius: 14, padding: 18 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "700" },
  cardAction: { fontSize: 11, color: DentalColors.ink3, fontWeight: "500" },

  field: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: DentalColors.border, gap: 12 },
  fieldLbl: { fontSize: 12, color: DentalColors.ink3 },
  fieldVal: { fontSize: 12, color: DentalColors.ink, fontWeight: "600", textAlign: "right", flexShrink: 1 },
  fieldEmpty: { color: DentalColors.ink3, fontStyle: "italic", fontWeight: "400" },

  summaryRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: DentalColors.border },
  summaryIco: { width: 28, height: 28, borderRadius: 8, backgroundColor: DentalColors.cyanDim, alignItems: "center", justifyContent: "center" },
  summaryLbl: { fontSize: 10, color: DentalColors.ink3, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: "600" },
  summaryVal: { fontSize: 12, color: DentalColors.ink, fontWeight: "600", marginTop: 1 },
});

export default PatientHub;
