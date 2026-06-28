// ============================================================
// Ficha do Praticante — Aura Karatê
//
// Tabs: Cadastro | Trajetória | Certif./Exames | Carteirinha | Transferência | Documentos
// Wired: GET /federation/{id}/practitioners/{practitionerId}
// Track C (Fase 2): aba "Certif./Exames" mostra a nova faixa após aprovação
//   e o status/URL do certificado com botão "Solicitar emissão".
// Track D (Fase 3): aba "Carteirinha" emite/renova + renderiza o cartão.
// Track N: aba "Transferência" mostra o histórico imutável + botão transferir
//   (gated por papel: federation_admin / federation_staff).
// DECISÃO FPKT #3: certificado sob demanda via karateApi.issueCertificate.
//
// Navegação: esta é a página de DETALHE full-page (destino do row-tap da lista).
// O botão "Editar" (header) abre o modal de ficha para edição rápida.
//
// Edição/Exclusão (fix/karate-practitioner-edit-delete-ui):
//   A federação pode editar e excluir tudo do praticante.
//   - Header: "Excluir praticante" → sem histórico = window.confirm + volta à
//     lista; com histórico (HasHistoryError) = modal in-app com counts
//     oferecendo Desativar (soft, is_active:false) ou Excluir definitivamente
//     (cascata, confirmação forte).
//   - Trajetória: cada graduação ganha Editar (modal) e Excluir; a faixa atual
//     recalcula sozinha no backend (view karate_current_belt) → refetch.
//   - Transferência: cada registro ganha Editar (motivo+data) e Excluir.
//   ARMADILHA: Alert.alert com botões é NO-OP no RN-Web → confirmação via
//     window.confirm / modal in-app. Todos os ícones usam <Icon> (SVG inline);
//     @expo/vector-icons foi removido deste arquivo (fix/karate-trajetoria-graduacao).
//
// Padronização de CTAs (Shoji): as ações das abas de detalhe ("Registrar
//   graduação", "Transferir para outro dojô") são CTAs primários em sumi
//   (escuro), em tamanho normal e alinhados à direita — não mais faixas
//   vermelhas full-width. O vermelho (primary) fica reservado a ações
//   destrutivas/críticas.
//
// Fix C4 (23/06): o backfill de faixas sem data conhecida usa a data-sentinela
//   BELT_DATE_UNKNOWN ('1900-01-01'). Tratamos essa data como DESCONHECIDA:
//   não renderizamos o "Desde:" nem a data do registro histórico — a faixa
//   continua aparecendo, só sem uma data que não significa nada.
//
// F4.3: CPF e telefone são formatados SÓ na exibição (máscaras BR). Não muda
//   o dado salvo; se o valor não tiver dígitos suficientes (dado ruim da
//   planilha), exibe como veio.
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Alert, Platform,
  StyleSheet, ViewStyle, TextStyle, ActivityIndicator,
  Modal, TextInput, Pressable, Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { BeltBadge } from "@/components/karate/BeltBadge";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState as EmptyState } from "@/components/karate/EmptyState";
import { KarateButton } from "@/components/karate/KarateButton";
import { CarteirinhaPanel } from "@/components/karate/CarteirinhaPanel";
import { TransferirPraticanteModal } from "@/components/karate/TransferirPraticanteModal";
import PraticanteFichaModal from "@/components/karate/PraticanteFichaModal";
import { karateApi, HasHistoryError, PractitionerDetail, AffiliationStatus, BeltHistoryEntry, Certificate, TransferRecord } from "@/services/karateApi";
import { formatIsoToBr, maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { KarateErrorState } from "@/components/karate/ErrorState";

// Papéis que podem transferir (federação admin/staff).
const TRANSFER_ROLES = ["federation_admin", "federation_staff"];
function canTransfer(role: string | null): boolean {
  return role == null || TRANSFER_ROLES.includes(role);
}

// Fix C4: data-sentinela usada pelo backfill para faixas sem data conhecida.
// Pode vir como '1900-01-01' (date) ou '1900-01-01T00:00:00...' (timestamp);
// comparamos pelos 10 primeiros chars (mais robusto que igualdade exata).
const BELT_DATE_UNKNOWN = "1900-01-01";
function isUnknownBeltDate(v: string | null | undefined): boolean {
  if (!v) return true;
  return String(v).slice(0, 10) === BELT_DATE_UNKNOWN;
}

// F4.3: máscaras só de EXIBIÇÃO (não alteram o dado salvo). Se o valor não
// tiver dígitos suficientes (dado ruim da planilha), exibe como veio.
function formatCpfDisplay(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = String(v).replace(/\D/g, "");
  if (d.length !== 11) return String(v); // dado incompleto/estranho: mostra cru
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
function formatPhoneDisplay(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = String(v).replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return String(v); // fora do padrão BR: mostra como veio
}
function formatCepDisplay(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = String(v).replace(/\D/g, "");
  if (d.length !== 8) return String(v);
  return d.replace(/(\d{5})(\d{3})/, "$1-$2");
}
// P8: idade em anos completos a partir de "YYYY-MM-DD". Parseamos como data
// local (new Date(year, month-1, day)) para evitar o shift UTC que acontece
// com new Date("YYYY-MM-DD") (ISO string = meia-noite UTC → pode virar dia
// anterior em fusos negativos).
function ageFromBirthDate(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const birth = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const mm = today.getMonth() - birth.getMonth();
  if (mm < 0 || (mm === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// Confirmação cross-plataforma. Na web o Alert.alert com botões é um no-op
// (o onPress nunca dispara) → usamos window.confirm. Em nativo, Alert.alert.
function webConfirm(message: string): boolean {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.confirm(message);
  }
  // Em nativo não há confirmação síncrona; assumimos confirmado e deixamos a
  // ação para os fluxos nativos (esta tela é web-first na federação).
  return true;
}
function webAlert(message: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") window.alert(message);
  else Alert.alert("Aviso", message);
}

const TABS = ["Cadastro", "Trajetória", "Certif./Exames", "Carteirinha", "Transferência", "Documentos"] as const;
type Tab = typeof TABS[number];

function CadastroTab({ p }: { p: PractitionerDetail }) {
  // Endereço vem da API (zip_code/street/number/complement/neighborhood/city/
  // state) mas não está declarado em PractitionerInput → lemos via `any`.
  const a = p as any;
  const hasAddress = !!(a.zip_code || a.street || a.number || a.complement || a.neighborhood || a.city || a.state);

  // Campos novos (27/06): photo, responsável, atividade — lemos via `any`.
  const photoUrl: string | null = a.photo_url ?? a.karate_photo_url ?? null;
  const guardianName: string | null = a.guardian_name ?? null;
  const guardianCpf: string | null = a.guardian_cpf ?? null;
  const guardianPhone: string | null = a.guardian_phone ?? null;
  const guardianRelationship: string | null = a.guardian_relationship ?? null;
  const hasGuardian = !!(guardianName || guardianCpf || guardianPhone || guardianRelationship);
  const lastExam: { date?: string | null; belt_name?: string | null; exam_name?: string | null; event_date?: string | null } | null = a.last_exam ?? null;
  const courseCountLastYear: number | null = (a.course_count_last_year != null) ? Number(a.course_count_last_year) : null;

  // Iniciais para o avatar placeholder (até 2 letras do nome completo).
  const initials = p.full_name
    ? p.full_name.trim().split(/\s+/).slice(0, 2).map((w: string) => w[0].toUpperCase()).join("")
    : null;

  // Formata data-only tz-safe (parse local dd/mm/yyyy, sem conversão UTC).
  function formatDateOnly(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function Row({ icon, label, val }: { icon: string; label: string; val: string | null }) {
    if (!val) return null;
    return (
      <View style={tabStyles.infoRow}>
        <Icon name={icon} size={14} color={KarateColors.ink3} />
        <Text style={tabStyles.infoLabel}>{label}</Text>
        <Text style={tabStyles.infoVal}>{val}</Text>
      </View>
    );
  }

  // Formata o label do último exame: "dd/mm/aaaa · exam_name / belt_name"
  const lastExamLabel: string | null = (() => {
    if (!lastExam) return null;
    const rawDate = lastExam.event_date ?? lastExam.date ?? null;
    const datePart = formatDateOnly(rawDate);
    const namePart = lastExam.exam_name ?? lastExam.belt_name ?? null;
    if (!datePart && !namePart) return null;
    if (datePart && namePart) return `${datePart} · ${namePart}`;
    return datePart ?? namePart;
  })();

  const courseLabel: string | null = courseCountLastYear == null
    ? null
    : courseCountLastYear === 0
      ? "Nenhum curso no último ano"
      : `${courseCountLastYear} ${courseCountLastYear === 1 ? "curso" : "cursos"}`;

  return (
    <View style={tabStyles.tab}>
      {/* ── Foto do praticante ── */}
      <View style={tabStyles.avatarBlock}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={tabStyles.avatarPhoto}
            accessibilityLabel={`Foto de ${p.full_name}`}
          />
        ) : (
          <View style={tabStyles.avatarPlaceholder}>
            {initials ? (
              <Text style={tabStyles.avatarInitials}>{initials}</Text>
            ) : (
              <Icon name="users" size={28} color={KarateColors.ink3} />
            )}
          </View>
        )}
      </View>

      <Row icon="person-outline"   label="Nome"         val={p.full_name} />
      <Row icon="id-card-outline"  label="CPF"          val={formatCpfDisplay(p.cpf)} />
      <Row icon="document-outline" label="RG"           val={p.rg ?? null} />
      <Row icon="calendar-outline" label="Nascimento"   val={(() => {
        if (!p.birth_date) return null;
        const dateBr = formatIsoToBr(p.birth_date);
        const age = ageFromBirthDate(p.birth_date);
        return age != null ? `${dateBr} · ${age} anos` : dateBr;
      })()} />
      <Row icon="mail-outline"     label="E-mail"       val={p.email ?? null} />
      <Row icon="call-outline"     label="Telefone"     val={formatPhoneDisplay(p.phone)} />
      <Row icon="ribbon-outline"   label="Registro"     val={p.karate_registration_number} />

      {/* ── Responsável (ocultado se nenhum campo presente) ── */}
      {hasGuardian && (
        <>
          <View style={tabStyles.sectionDivider} />
          <Text style={tabStyles.sectionLabel}>Responsável</Text>
          <Row icon="person-outline"   label="Nome"     val={guardianName} />
          <Row icon="id-card-outline"  label="CPF"      val={formatCpfDisplay(guardianCpf)} />
          <Row icon="call-outline"     label="Telefone" val={formatPhoneDisplay(guardianPhone)} />
          <Row icon="people-outline"   label="Vínculo"  val={guardianRelationship} />
        </>
      )}

      {/* Endereço (só-leitura; campos vazios são ocultados) */}
      {hasAddress && (
        <>
          <View style={tabStyles.sectionDivider} />
          <Text style={tabStyles.sectionLabel}>Endereço</Text>
          <Row icon="map-outline"      label="CEP"          val={formatCepDisplay(a.zip_code)} />
          <Row icon="home-outline"     label="Logradouro"   val={a.street ?? null} />
          <Row icon="navigate-outline" label="Número"       val={a.number ?? null} />
          <Row icon="business-outline" label="Complemento"  val={a.complement ?? null} />
          <Row icon="location-outline" label="Bairro"       val={a.neighborhood ?? null} />
          <Row icon="map-outline"      label="Cidade"       val={a.city ?? null} />
          <Row icon="flag-outline"     label="UF"           val={a.state ?? null} />
        </>
      )}

      {/* ── Atividade (último exame + cursos) ── */}
      {(lastExamLabel != null || courseLabel != null) && (
        <>
          <View style={tabStyles.sectionDivider} />
          <Text style={tabStyles.sectionLabel}>Atividade</Text>
          {lastExamLabel != null && (
            <Row icon="ribbon-outline"   label="Último exame"       val={lastExamLabel} />
          )}
          {courseLabel != null && (
            <Row icon="calendar-outline" label="Cursos / últ. ano"  val={courseLabel} />
          )}
        </>
      )}

      <View style={tabStyles.rolesRow}>
        {p.is_instructor && <View style={tabStyles.roleChip}><Text style={tabStyles.roleChipText}>Instrutor</Text></View>}
        {p.is_arbiter    && <View style={tabStyles.roleChip}><Text style={tabStyles.roleChipText}>Árbitro</Text></View>}
        {p.is_examiner   && <View style={tabStyles.roleChip}><Text style={tabStyles.roleChipText}>Examinador</Text></View>}
      </View>
    </View>
  );
}

function TrajetoriaTab({
  history, currentBelt, federationId, practitionerId, karateRole, onChanged,
}: {
  history: BeltHistoryEntry[];
  currentBelt: PractitionerDetail["current_belt"];
  federationId: string;
  practitionerId: string;
  karateRole: string | null;
  onChanged: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<BeltHistoryEntry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const allowed = canTransfer(karateRole); // mesmos papéis de escrita (admin/staff)

  // CTA primário em sumi, tamanho normal, alinhado à direita (ação da aba).
  const AddButton = allowed ? (
    <View style={tabStyles.tabActions}>
      <KarateButton
        label="Registrar graduação"
        variant="sumi"
        size="md"
        onPress={() => setModalOpen(true)}
      />
    </View>
  ) : null;

  // Fix C4: só mostra "Desde:" quando a data é conhecida (≠ sentinela 1900).
  const currentSinceUnknown = currentBelt ? isUnknownBeltDate(currentBelt.current_since) : true;

  async function handleDelete(entry: BeltHistoryEntry) {
    if (!webConfirm("Excluir esta graduação? A faixa atual será recalculada.")) return;
    setBusyId(entry.id);
    try {
      await karateApi.deleteGraduation(federationId, practitionerId, entry.id);
      onChanged();
    } catch (e: any) {
      webAlert(e?.message || "Não foi possível excluir a graduação.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={tabStyles.tab}>
      {AddButton}

      {/* Faixa atual (derivada do histórico) — Track C */}
      {currentBelt && (
        <View style={tabStyles.currentBeltBanner}>
          <Icon name="ribbon" size={16} color={KarateColors.primary} />
          <View style={tabStyles.currentBeltInfo}>
            <Text style={tabStyles.currentBeltLabel}>Faixa atual</Text>
            <BeltBadge beltLevel={currentBelt.belt_level} beltName={currentBelt.belt_name} />
            {!currentSinceUnknown && (
              <Text style={tabStyles.currentBeltSince}>Desde: {formatIsoToBr(currentBelt.current_since) || currentBelt.current_since}</Text>
            )}
          </View>
        </View>
      )}

      {history.length === 0 ? (
        <EmptyState
          icon="ribbon-outline"
          title="Sem histórico de faixas"
          subtitle={allowed ? "Use "Registrar graduação" para adicionar a primeira faixa." : undefined}
          style={{ paddingVertical: 32 }}
        />
      ) : (
        history.map((entry) => {
          // Fix C4: data-sentinela 1900 = data desconhecida (backfill).
          // Não renderizamos a data; mantemos o rótulo "Registro histórico".
          const dateUnknown = isUnknownBeltDate(entry.graduated_at);
          const dateLabel = dateUnknown
            ? null
            : (formatIsoToBr(entry.graduated_at) || new Date(entry.graduated_at).toLocaleDateString("pt-BR"));
          const isLegacy = entry.belt_schema === "legacy";
          const metaParts: string[] = [];
          if (dateLabel) metaParts.push(dateLabel);
          if (isLegacy) metaParts.push("Registro histórico");
          if (entry.exam_id) metaParts.push(`Exame: ${entry.exam_id}`);
          return (
            <View key={entry.id} style={tabStyles.beltEntry}>
              <View style={tabStyles.beltLine} />
              <View style={{ flex: 1, gap: 4 }}>
                <BeltBadge
                  beltLevel={entry.belt_level}
                  beltName={entry.belt_name}
                  isLegacy={entry.is_legacy}
                />
                {metaParts.length > 0 ? (
                  <Text style={tabStyles.beltDate}>{metaParts.join(" · ")}</Text>
                ) : (
                  <Text style={tabStyles.beltDate}>Data não informada</Text>
                )}
              </View>
              {allowed && (
                <View style={tabStyles.itemActions}>
                  <TouchableOpacity
                    style={tabStyles.iconBtn}
                    onPress={() => setEditEntry(entry)}
                    disabled={busyId === entry.id}
                    accessibilityRole="button"
                    accessibilityLabel="Editar graduação"
                  >
                    <Icon name="edit" size={15} color={KarateColors.ink2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[tabStyles.iconBtn, tabStyles.iconBtnDanger]}
                    onPress={() => handleDelete(entry)}
                    disabled={busyId === entry.id}
                    accessibilityRole="button"
                    accessibilityLabel="Excluir graduação"
                  >
                    {busyId === entry.id
                      ? <ActivityIndicator size="small" color={KarateColors.primary} />
                      : <Icon name="trash" size={15} color={KarateColors.primary} />}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })
      )}

      <RegistrarGraduacaoModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        federationId={federationId}
        practitionerId={practitionerId}
        onDone={() => { setModalOpen(false); onChanged(); }}
      />

      <EditarGraduacaoModal
        entry={editEntry}
        onClose={() => setEditEntry(null)}
        federationId={federationId}
        practitionerId={practitionerId}
        onDone={() => { setEditEntry(null); onChanged(); }}
      />
    </View>
  );
}

// Opções de faixa para a graduação manual (deriva do mapa canônico de cores).
const BELT_OPTIONS: Array<{ key: BeltKey; label: string }> = (Object.keys(KarateBelts) as BeltKey[])
  .map((k) => ({ key: k, label: KarateBelts[k].label }));

// Graus Dan (Preta): 1º a 10º
const DAN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Kyu por faixa (FPKT Shotokan): lista de kyus que a faixa pode representar.
// Ex.: Marrom pode ser 3kyu, 2kyu ou 1kyu.
const BELT_KYUS: Partial<Record<BeltKey, number[]>> = {
  branca:      [10, 9],
  amarela:     [8],
  laranja:     [7],
  verde:       [6],
  azul_claro:  [5],
  roxo:        [4],
  azul_escuro: [3],
  marrom:      [3, 2, 1],
};

/** Monta o belt_name legível para uma faixa + grau opcional. */
function buildBeltName(key: BeltKey, dan?: number, kyu?: number): string {
  const label = KarateBelts[key].label;
  if (key === "preta" && dan) return `${label} ${dan}°`;
  if (kyu) return `${label} ${kyu}°kyu`;
  return label;
}

// Track A (fix 23/06): registrar uma graduação manual (faixa + data) no
// histórico do praticante. A faixa atual é derivada automaticamente
// (view karate_current_belt).
function RegistrarGraduacaoModal({
  visible, onClose, federationId, practitionerId, onDone,
}: {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  practitionerId: string;
  onDone: () => void;
}) {
  const [beltKey, setBeltKey] = useState<BeltKey | null>(null);
  const [danDeg, setDanDeg] = useState<number | null>(null);
  const [kyuDeg, setKyuDeg] = useState<number | null>(null);
  const [dateBr, setDateBr] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // reset ao abrir
  useEffect(() => {
    if (visible) { setBeltKey(null); setDanDeg(null); setKyuDeg(null); setDateBr(""); setLegacy(false); setErr(null); setSaving(false); }
  }, [visible]);

  // Reset grau ao trocar faixa
  function handleBeltSelect(k: BeltKey) {
    setBeltKey(k);
    setDanDeg(null);
    setKyuDeg(null);
  }

  const dateComplete = dateBr.length === 10;
  const dateIso = parseBrDate(dateBr); // null se incompleto/ inválido
  const dateBad = dateComplete && dateIso === null;

  async function handleSave() {
    if (!beltKey) { setErr("Selecione a faixa."); return; }
    if (dateBad) { setErr("Data inválida. Use dd/mm/aaaa ou deixe em branco (usa hoje)."); return; }
    setErr(null); setSaving(true);
    try {
      await karateApi.addBeltGraduation(federationId, practitionerId, {
        belt_level: beltKey,
        belt_name: buildBeltName(beltKey, danDeg ?? undefined, kyuDeg ?? undefined),
        belt_schema: legacy ? "legacy" : "fpkt_shotokan",
        graduated_at: dateIso ?? undefined, // sem data → backend usa hoje
      });
      setSaving(false);
      onDone();
    } catch (e: any) {
      setSaving(false);
      setErr(e?.message || "Não foi possível registrar a graduação.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={gradStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={gradStyles.card}>
          <View style={gradStyles.head}>
            <Text style={gradStyles.title}>Registrar graduação</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={gradStyles.hint}>
              Adiciona uma faixa ao histórico (registro permanente). A faixa atual passa a ser a mais recente.
            </Text>

            <Text style={gradStyles.label}>Faixa</Text>
            <View style={gradStyles.beltGrid}>
              {BELT_OPTIONS.map((opt) => {
                const active = beltKey === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => handleBeltSelect(opt.key)}
                    activeOpacity={0.7}
                    style={[gradStyles.beltChip, { backgroundColor: KarateBelts[opt.key].color }, active && gradStyles.beltChipActive]}
                  >
                    <Text style={[gradStyles.beltChipTxt, { color: KarateBelts[opt.key].textColor }]}>{opt.label}</Text>
                    {active && <Icon name="check" size={14} color={KarateBelts[opt.key].textColor} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Sub-seletor: Dan para Preta / Kyu para as demais */}
            {beltKey === "preta" && (
              <>
                <Text style={gradStyles.label}>Grau Dan</Text>
                <View style={gradStyles.beltGrid}>
                  {DAN_OPTIONS.map((d) => {
                    const active = danDeg === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setDanDeg(active ? null : d)}
                        activeOpacity={0.7}
                        style={[gradStyles.beltChip, { backgroundColor: active ? KarateColors.ink : KarateColors.bg2 }, active && gradStyles.beltChipActive]}
                      >
                        <Text style={[gradStyles.beltChipTxt, { color: active ? "#fdf8f2" : KarateColors.ink2 }]}>{d}°</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            {beltKey && beltKey !== "preta" && (BELT_KYUS[beltKey]?.length ?? 0) > 1 && (
              <>
                <Text style={gradStyles.label}>Kyu</Text>
                <View style={gradStyles.beltGrid}>
                  {(BELT_KYUS[beltKey] ?? []).map((k) => {
                    const active = kyuDeg === k;
                    return (
                      <TouchableOpacity
                        key={k}
                        onPress={() => setKyuDeg(active ? null : k)}
                        activeOpacity={0.7}
                        style={[gradStyles.beltChip, { backgroundColor: active ? KarateColors.ink : KarateColors.bg2 }, active && gradStyles.beltChipActive]}
                      >
                        <Text style={[gradStyles.beltChipTxt, { color: active ? "#fdf8f2" : KarateColors.ink2 }]}>{k}°kyu</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={gradStyles.label}>Data da graduação · dd/mm/aaaa <Text style={gradStyles.labelHint}>(vazio = hoje)</Text></Text>
            <TextInput
              style={[gradStyles.input, dateBad && gradStyles.inputBad]}
              value={dateBr}
              onChangeText={(v) => setDateBr(maskBrDate(v))}
              keyboardType="numeric"
              placeholder="dd/mm/aaaa"
              placeholderTextColor={KarateColors.ink4}
              maxLength={10}
              accessibilityLabel="Data da graduação"
            />
            {dateBad ? <Text style={gradStyles.errInline}>Data inválida</Text> : null}

            <TouchableOpacity style={gradStyles.legacyRow} onPress={() => setLegacy((v) => !v)} activeOpacity={0.7}>
              <View style={[gradStyles.checkbox, legacy && gradStyles.checkboxOn]}>
                {legacy && <Icon name="check" size={13} color="#fff" />}
              </View>
              <Text style={gradStyles.legacyTxt}>Registro histórico (sistema legado)</Text>
            </TouchableOpacity>

            {err ? (
              <View style={gradStyles.errBox}>
                <Icon name="alert_circle" size={15} color={KarateColors.primary} />
                <Text style={gradStyles.errTxt}>{err}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={gradStyles.footer}>
            <TouchableOpacity onPress={onClose} style={gradStyles.btnGhost}>
              <Text style={gradStyles.btnGhostTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={[gradStyles.btnPrimary, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={gradStyles.btnPrimaryTxt}>Registrar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Edita uma graduação existente do histórico (faixa + data). A faixa atual é
// recalculada pelo backend (view) após salvar → a tela faz refetch.
function EditarGraduacaoModal({
  entry, onClose, federationId, practitionerId, onDone,
}: {
  entry: BeltHistoryEntry | null;
  onClose: () => void;
  federationId: string;
  practitionerId: string;
  onDone: () => void;
}) {
  const visible = !!entry;
  const [beltKey, setBeltKey] = useState<BeltKey | null>(null);
  const [danDeg, setDanDeg] = useState<number | null>(null);
  const [kyuDeg, setKyuDeg] = useState<number | null>(null);
  const [dateBr, setDateBr] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    // pré-seleciona a faixa se o belt_level casar com uma chave canônica
    const match = (Object.keys(KarateBelts) as BeltKey[]).find((k) => k === entry.belt_level);
    setBeltKey(match ?? null);
    // pré-seleciona Dan se o belt_name carregar o grau (ex.: "Preta 2°")
    const danMatch = entry.belt_name?.match(/(\d+)°/);
    setDanDeg(match === "preta" && danMatch ? parseInt(danMatch[1], 10) : null);
    // pré-seleciona kyu se o belt_name carregar (ex.: "Marrom 2°kyu")
    const kyuMatch = entry.belt_name?.match(/(\d+)°kyu/i);
    setKyuDeg(kyuMatch ? parseInt(kyuMatch[1], 10) : null);
    const known = !isUnknownBeltDate(entry.graduated_at);
    setDateBr(known ? (formatIsoToBr(entry.graduated_at) || "") : "");
    setErr(null); setSaving(false);
  }, [entry]);

  function handleBeltSelect(k: BeltKey) {
    setBeltKey(k);
    setDanDeg(null);
    setKyuDeg(null);
  }

  const dateComplete = dateBr.length === 10;
  const dateIso = parseBrDate(dateBr);
  const dateBad = dateComplete && dateIso === null;

  async function handleSave() {
    if (!entry) return;
    if (dateBad) { setErr("Data inválida. Use dd/mm/aaaa ou deixe em branco."); return; }
    setErr(null); setSaving(true);
    try {
      const resolvedKey = beltKey ?? (entry.belt_level as BeltKey);
      await karateApi.updateGraduation(federationId, practitionerId, entry.id, {
        belt_level: resolvedKey,
        belt_name: beltKey
          ? buildBeltName(beltKey, danDeg ?? undefined, kyuDeg ?? undefined)
          : entry.belt_name,
        ...(dateIso ? { graduated_at: dateIso } : {}),
      });
      setSaving(false);
      onDone();
    } catch (e: any) {
      setSaving(false);
      setErr(e?.message || "Não foi possível salvar a graduação.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={gradStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={gradStyles.card}>
          <View style={gradStyles.head}>
            <Text style={gradStyles.title}>Editar graduação</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={gradStyles.hint}>
              Ajuste a faixa ou a data deste registro. A faixa atual é recalculada automaticamente.
            </Text>

            <Text style={gradStyles.label}>Faixa</Text>
            <View style={gradStyles.beltGrid}>
              {BELT_OPTIONS.map((opt) => {
                const active = beltKey === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => handleBeltSelect(opt.key)}
                    activeOpacity={0.7}
                    style={[gradStyles.beltChip, { backgroundColor: KarateBelts[opt.key].color }, active && gradStyles.beltChipActive]}
                  >
                    <Text style={[gradStyles.beltChipTxt, { color: KarateBelts[opt.key].textColor }]}>{opt.label}</Text>
                    {active && <Icon name="check" size={14} color={KarateBelts[opt.key].textColor} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Sub-seletor: Dan para Preta / Kyu para as demais */}
            {beltKey === "preta" && (
              <>
                <Text style={gradStyles.label}>Grau Dan</Text>
                <View style={gradStyles.beltGrid}>
                  {DAN_OPTIONS.map((d) => {
                    const active = danDeg === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setDanDeg(active ? null : d)}
                        activeOpacity={0.7}
                        style={[gradStyles.beltChip, { backgroundColor: active ? KarateColors.ink : KarateColors.bg2 }, active && gradStyles.beltChipActive]}
                      >
                        <Text style={[gradStyles.beltChipTxt, { color: active ? "#fdf8f2" : KarateColors.ink2 }]}>{d}°</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            {beltKey && beltKey !== "preta" && (BELT_KYUS[beltKey]?.length ?? 0) > 1 && (
              <>
                <Text style={gradStyles.label}>Kyu</Text>
                <View style={gradStyles.beltGrid}>
                  {(BELT_KYUS[beltKey] ?? []).map((k) => {
                    const active = kyuDeg === k;
                    return (
                      <TouchableOpacity
                        key={k}
                        onPress={() => setKyuDeg(active ? null : k)}
                        activeOpacity={0.7}
                        style={[gradStyles.beltChip, { backgroundColor: active ? KarateColors.ink : KarateColors.bg2 }, active && gradStyles.beltChipActive]}
                      >
                        <Text style={[gradStyles.beltChipTxt, { color: active ? "#fdf8f2" : KarateColors.ink2 }]}>{k}°kyu</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={gradStyles.label}>Data da graduação · dd/mm/aaaa <Text style={gradStyles.labelHint}>(vazio = mantém)</Text></Text>
            <TextInput
              style={[gradStyles.input, dateBad && gradStyles.inputBad]}
              value={dateBr}
              onChangeText={(v) => setDateBr(maskBrDate(v))}
              keyboardType="numeric"
              placeholder="dd/mm/aaaa"
              placeholderTextColor={KarateColors.ink4}
              maxLength={10}
              accessibilityLabel="Data da graduação"
            />
            {dateBad ? <Text style={gradStyles.errInline}>Data inválida</Text> : null}

            {err ? (
              <View style={gradStyles.errBox}>
                <Icon name="alert_circle" size={15} color={KarateColors.primary} />
                <Text style={gradStyles.errTxt}>{err}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={gradStyles.footer}>
            <TouchableOpacity onPress={onClose} style={gradStyles.btnGhost}>
              <Text style={gradStyles.btnGhostTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={[gradStyles.btnPrimary, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={gradStyles.btnPrimaryTxt}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Track N: aba de transferências — histórico + ação de transferir/editar/excluir
function TransferenciaTab({
  federationId,
  practitioner,
  karateRole,
  onTransferred,
}: {
  federationId: string;
  practitioner: PractitionerDetail;
  karateRole: string | null;
  onTransferred: () => void;
}) {
  const [transfers, setTransfers] = useState<TransferRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTransfer, setEditTransfer] = useState<TransferRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    karateApi.listTransfers(federationId, practitioner.id)
      .then((res: any) => setTransfers(Array.isArray(res?.data) ? res.data : (res?.data ?? [])))
      .catch(() => setTransfers([]))
      .finally(() => setLoading(false));
  }, [federationId, practitioner.id]);

  useEffect(() => { load(); }, [load]);

  const handleDone = () => { load(); onTransferred(); };

  const allowed = canTransfer(karateRole);

  async function handleDelete(t: TransferRecord) {
    if (!webConfirm("Excluir este registro? Isso NÃO move o praticante de volta.")) return;
    setBusyId(t.id);
    try {
      await karateApi.deleteTransfer(federationId, practitioner.id, t.id);
      load();
    } catch (e: any) {
      webAlert(e?.message || "Não foi possível excluir a transferência.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={tabStyles.tab}>
      {allowed && (
        // CTA primário em sumi, tamanho normal, alinhado à direita (ação da aba).
        <View style={tabStyles.tabActions}>
          <KarateButton
            label="Transferir para outro dojô"
            variant="sumi"
            size="md"
            onPress={() => setModalOpen(true)}
          />
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 20 }} color={KarateColors.primary} />
      ) : !transfers || transfers.length === 0 ? (
        <EmptyState
          icon="swap-horizontal-outline"
          title="Sem transferências"
          subtitle="Este praticante nunca foi transferido de dojô."
          style={{ paddingVertical: 32 }}
        />
      ) : (
        <View style={{ gap: 10, marginTop: 4 }}>
          <Text style={tabStyles.transferHint}>
            Histórico de transferências entre dojôs.
          </Text>
          {transfers.map((t) => (
            <View key={t.id} style={tabStyles.transferCard}>
              <View style={tabStyles.transferRow}>
                <Text style={tabStyles.transferDojo} numberOfLines={1}>{t.origin_dojo_name || "Sem dojô"}</Text>
                <Icon name="arrow_right" size={15} color={KarateColors.primary} />
                <Text style={[tabStyles.transferDojo, { color: KarateColors.primary }]} numberOfLines={1}>
                  {t.destination_dojo_name || "—"}
                </Text>
                {allowed && (
                  <View style={tabStyles.itemActions}>
                    <TouchableOpacity
                      style={tabStyles.iconBtn}
                      onPress={() => setEditTransfer(t)}
                      disabled={busyId === t.id}
                      accessibilityRole="button"
                      accessibilityLabel="Editar transferência"
                    >
                      <Icon name="edit" size={15} color={KarateColors.ink2} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[tabStyles.iconBtn, tabStyles.iconBtnDanger]}
                      onPress={() => handleDelete(t)}
                      disabled={busyId === t.id}
                      accessibilityRole="button"
                      accessibilityLabel="Excluir transferência"
                    >
                      {busyId === t.id
                        ? <ActivityIndicator size="small" color={KarateColors.primary} />
                        : <Icon name="trash" size={15} color={KarateColors.primary} />}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <Text style={tabStyles.transferMeta}>
                {new Date(t.transferred_at).toLocaleDateString("pt-BR")}
                {t.initiated_by_name ? ` · por ${t.initiated_by_name}` : ""}
              </Text>
              {t.reason ? <Text style={tabStyles.transferReason}>{t.reason}</Text> : null}
            </View>
          ))}
        </View>
      )}

      <TransferirPraticanteModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        federationId={federationId}
        practitionerId={practitioner.id}
        practitionerName={practitioner.full_name}
        originDojoId={practitioner.dojo_id ?? null}
        originDojoName={transfers && transfers[0]?.destination_dojo_name ? transfers[0].destination_dojo_name : null}
        onDone={handleDone}
      />

      <EditarTransferenciaModal
        transfer={editTransfer}
        onClose={() => setEditTransfer(null)}
        federationId={federationId}
        practitionerId={practitioner.id}
        onDone={() => { setEditTransfer(null); load(); }}
      />
    </View>
  );
}

// Edita uma transferência registrada (motivo + data).
function EditarTransferenciaModal({
  transfer, onClose, federationId, practitionerId, onDone,
}: {
  transfer: TransferRecord | null;
  onClose: () => void;
  federationId: string;
  practitionerId: string;
  onDone: () => void;
}) {
  const visible = !!transfer;
  const [reason, setReason] = useState("");
  const [dateBr, setDateBr] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!transfer) return;
    setReason(transfer.reason || "");
    setDateBr(transfer.transferred_at ? (formatIsoToBr(transfer.transferred_at) || "") : "");
    setErr(null); setSaving(false);
  }, [transfer]);

  const dateComplete = dateBr.length === 10;
  const dateIso = parseBrDate(dateBr);
  const dateBad = dateComplete && dateIso === null;

  async function handleSave() {
    if (!transfer) return;
    if (dateBad) { setErr("Data inválida. Use dd/mm/aaaa ou deixe em branco."); return; }
    setErr(null); setSaving(true);
    try {
      await karateApi.updateTransfer(federationId, practitionerId, transfer.id, {
        reason: reason.trim() || undefined,
        transferred_at: dateIso || undefined,
      });
      setSaving(false);
      onDone();
    } catch (e: any) {
      setSaving(false);
      setErr(e?.message || "Não foi possível salvar a transferência.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={gradStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={gradStyles.card}>
          <View style={gradStyles.head}>
            <Text style={gradStyles.title}>Editar transferência</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={gradStyles.label}>Data da transferência · dd/mm/aaaa <Text style={gradStyles.labelHint}>(vazio = mantém)</Text></Text>
            <TextInput
              style={[gradStyles.input, dateBad && gradStyles.inputBad]}
              value={dateBr}
              onChangeText={(v) => setDateBr(maskBrDate(v))}
              keyboardType="numeric"
              placeholder="dd/mm/aaaa"
              placeholderTextColor={KarateColors.ink4}
              maxLength={10}
              accessibilityLabel="Data da transferência"
            />
            {dateBad ? <Text style={gradStyles.errInline}>Data inválida</Text> : null}

            <Text style={gradStyles.label}>Motivo</Text>
            <TextInput
              style={[gradStyles.input, { fontFamily: undefined, letterSpacing: undefined, minHeight: 64, textAlignVertical: "top" }]}
              value={reason}
              onChangeText={setReason}
              placeholder="Motivo da transferência (opcional)"
              placeholderTextColor={KarateColors.ink4}
              multiline
              accessibilityLabel="Motivo da transferência"
            />

            {err ? (
              <View style={gradStyles.errBox}>
                <Icon name="alert_circle" size={15} color={KarateColors.primary} />
                <Text style={gradStyles.errTxt}>{err}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={gradStyles.footer}>
            <TouchableOpacity onPress={onClose} style={gradStyles.btnGhost}>
              <Text style={gradStyles.btnGhostTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={[gradStyles.btnPrimary, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={gradStyles.btnPrimaryTxt}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Track C: aba de certificados
function CertificadosTab({
  federationId,
  practitionerId,
}: {
  federationId: string;
  practitionerId: string;
}) {
  const [certs, setCerts] = useState<Array<Certificate & { exam_title?: string }>>([]);
  const [issuingId, setIssuingId] = useState<string | null>(null);

  const certStatusLabel: Record<string, string> = {
    pending: "Pendente", generated: "Gerado", sent: "Enviado", error: "Erro",
  };
  const certStatusBadge: Record<string, "neutral" | "ok" | "warn" | "alert"> = {
    pending: "neutral", generated: "ok", sent: "ok", error: "alert",
  };

  // DECISÃO FPKT #3: emissão sob demanda
  const handleIssue = async (cert: Certificate) => {
    setIssuingId(cert.id);
    try {
      const updated = await karateApi.issueCertificate(federationId, cert.candidate_id);
      setCerts(prev => prev.map(c => c.candidate_id === cert.candidate_id
        ? { ...c, status: updated.status, pdf_url: updated.pdf_url, issued_at: updated.issued_at }
        : c
      ));
      Alert.alert("Solicitação enviada", `Status: ${updated.status}`);
    } catch (e: any) {
      Alert.alert("Não foi possível solicitar", e?.message ?? "Tente novamente.");
    } finally {
      setIssuingId(null);
    }
  };

  if (certs.length === 0) {
    return <EmptyState icon="document-text-outline" title="Nenhum certificado" subtitle="Certificados aparecem após aprovação em exame." style={{ paddingVertical: 32 }} />;
  }

  return (
    <View style={tabStyles.tab}>
      <Text style={tabStyles.certHint}>
        Certificados emitidos sob demanda (Decisão FPKT #3). Clique em "Solicitar emissão" para iniciar.
      </Text>
      {certs.map((cert) => (
        <View key={cert.id} style={tabStyles.certCard}>
          <View style={tabStyles.certHeader}>
            <View style={tabStyles.certInfo}>
              <Text style={tabStyles.certTitle}>{cert.exam_title ?? `Exame ${cert.exam_date}`}</Text>
              <Text style={tabStyles.certMeta}>Faixa: {cert.belt_level} · Data: {cert.exam_date}</Text>
            </View>
            <Badge
              status={certStatusBadge[cert.status]}
              label={certStatusLabel[cert.status]}
            />
          </View>
          {cert.issued_at && (
            <Text style={tabStyles.certMeta}>Emitido em: {cert.issued_at}</Text>
          )}
          {cert.pdf_url ? (
            <Text style={tabStyles.certUrl} numberOfLines={1}>{cert.pdf_url}</Text>
          ) : (
            <KarateButton
              label={issuingId === cert.id ? "Solicitando..." : "Solicitar emissão do certificado"}
              variant="secondary"
              size="sm"
              loading={issuingId === cert.id}
              onPress={() => handleIssue(cert)}
            />
          )}
        </View>
      ))}
    </View>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <EmptyState
      icon="construct-outline"
      title={`${label} — Em desenvolvimento`}
      subtitle="Esta aba será implementada em uma próxima fase."
      style={{ paddingVertical: 48 }}
    />
  );
}

// Modal in-app de exclusão quando o praticante tem histórico vinculado.
// Oferece Desativar (soft) | Excluir definitivamente (cascata) | Cancelar.
function ExcluirComHistoricoModal({
  visible, counts, busy, onDesativar, onExcluir, onClose,
}: {
  visible: boolean;
  counts: Record<string, number> | null;
  busy: "deactivate" | "delete" | null;
  onDesativar: () => void;
  onExcluir: () => void;
  onClose: () => void;
}) {
  const labels: Record<string, string> = {
    graduations: "graduações", transfers: "transferências",
    cards: "carteirinhas", transactions: "lançamentos financeiros",
  };
  const parts = Object.entries(counts || {})
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${labels[k] || k}`);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={gradStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />
        <View style={gradStyles.card}>
          <View style={gradStyles.head}>
            <Text style={gradStyles.title}>Excluir praticante</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} disabled={!!busy}>
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, gap: 14 }}>
            <Text style={gradStyles.hint}>
              Este praticante possui histórico vinculado{parts.length ? ` (${parts.join(", ")})` : ""}.
              Escolha como proceder.
            </Text>

            {/* Primário: Desativar (soft) */}
            <TouchableOpacity
              onPress={onDesativar}
              disabled={!!busy}
              style={[delStyles.optPrimary, busy && { opacity: 0.6 }]}
              accessibilityRole="button"
            >
              <Icon name="lock" size={16} color="#fdf8f2" />
              <View style={{ flex: 1 }}>
                <Text style={delStyles.optPrimaryTitle}>Desativar praticante</Text>
                <Text style={delStyles.optPrimarySub}>Preserva o histórico. Pode reativar depois.</Text>
              </View>
              {busy === "deactivate" ? <ActivityIndicator color="#fdf8f2" size="small" /> : null}
            </TouchableOpacity>

            {/* Destrutivo: Excluir definitivamente (cascata) */}
            <TouchableOpacity
              onPress={onExcluir}
              disabled={!!busy}
              style={[delStyles.optDanger, busy && { opacity: 0.6 }]}
              accessibilityRole="button"
            >
              <Icon name="trash" size={16} color={KarateColors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={delStyles.optDangerTitle}>Excluir definitivamente</Text>
                <Text style={delStyles.optDangerSub}>Remove o praticante e todo o histórico. Não pode ser desfeito.</Text>
              </View>
              {busy === "delete" ? <ActivityIndicator color={KarateColors.primary} size="small" /> : null}
            </TouchableOpacity>
          </View>

          <View style={gradStyles.footer}>
            <TouchableOpacity onPress={onClose} style={gradStyles.btnGhost} disabled={!!busy}>
              <Text style={gradStyles.btnGhostTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function FichaPraticanteScreen() {
  const { practitionerId } = useLocalSearchParams<{ practitionerId: string }>();
  const { federationId, karateRole } = useKarateFederation();
  const [data, setData] = useState<PractitionerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Cadastro");
  // Modal de edição (reusa a ficha de cadastro com o id atual)
  const [editOpen, setEditOpen] = useState(false);
  // Exclusão com histórico (modal in-app) + estado de busy
  const [hasHistory, setHasHistory] = useState<Record<string, number> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delBusy, setDelBusy] = useState<"deactivate" | "delete" | null>(null);

  const allowed = canTransfer(karateRole); // admin/staff podem excluir/editar

  const reload = useCallback(() => {
    if (!practitionerId) return;
    setError(false);
    karateApi.getPractitioner(federationId, practitionerId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [federationId, practitionerId]);

  useEffect(() => { reload(); }, [reload]);

  function goBackToList() {
    if (router.canGoBack()) router.back();
    else router.replace("/karate/praticantes" as any);
  }

  // Header "Excluir praticante": tenta hard delete; se HAS_HISTORY, abre modal.
  async function handleDeletePractitioner() {
    if (!practitionerId) return;
    if (!webConfirm("Excluir este praticante?")) return;
    setDeleting(true);
    try {
      await karateApi.deletePractitioner(federationId, practitionerId);
      goBackToList();
    } catch (e: any) {
      if (e instanceof HasHistoryError || e?.code === "HAS_HISTORY") {
        setHasHistory(e.counts || {});
      } else {
        webAlert(e?.message || "Não foi possível excluir o praticante.");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleDesativar() {
    if (!practitionerId) return;
    setDelBusy("deactivate");
    try {
      await karateApi.updatePractitioner(federationId, practitionerId, { is_active: false });
      setHasHistory(null);
      setDelBusy(null);
      reload();
    } catch (e: any) {
      setDelBusy(null);
      webAlert(e?.message || "Não foi possível desativar o praticante.");
    }
  }

  async function handleExcluirDefinitivo() {
    if (!practitionerId) return;
    if (!webConfirm("Excluir DEFINITIVAMENTE este praticante e TODO o seu histórico? Esta ação não pode ser desfeita.")) return;
    setDelBusy("delete");
    try {
      await karateApi.deletePractitioner(federationId, practitionerId, { cascade: true });
      setHasHistory(null);
      setDelBusy(null);
      goBackToList();
    } catch (e: any) {
      setDelBusy(null);
      webAlert(e?.message || "Não foi possível excluir o praticante.");
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, padding: 16, gap: 12 }}>
        {[1,2,3,4].map((k) => <Skeleton key={k} height={24} />)}
      </View>
    );
  }

  if (error || !data) return <KarateErrorState onRetry={reload} />;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Icon name="users" size={24} color={KarateColors.ink3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.regNum}>{data.karate_registration_number}</Text>
            <Text style={styles.fullName}>{data.full_name}</Text>
            {data.current_belt && (
              <BeltBadge
                beltLevel={data.current_belt.belt_level}
                beltName={data.current_belt.belt_name}
                style={{ marginTop: 6 }}
              />
            )}
          </View>
          <View style={styles.headerActions}>
            <Badge affiliationStatus={data.affiliation_status as AffiliationStatus} />
            <View style={styles.headerBtnRow}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setEditOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Editar praticante"
              >
                <Icon name="edit" size={15} color={KarateColors.primary} />
                <Text style={styles.editBtnText}>Editar</Text>
              </TouchableOpacity>
              {allowed && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={handleDeletePractitioner}
                  disabled={deleting}
                  accessibilityRole="button"
                  accessibilityLabel="Excluir praticante"
                >
                  {deleting
                    ? <ActivityIndicator size="small" color={KarateColors.primary} />
                    : <Icon name="trash" size={15} color={KarateColors.primary} />}
                  <Text style={styles.deleteBtnText}>Excluir</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
        {activeTab === "Cadastro"       && <CadastroTab p={data} />}
        {activeTab === "Trajetória"     && <TrajetoriaTab history={data.belt_history} currentBelt={data.current_belt} federationId={federationId} practitionerId={practitionerId!} karateRole={karateRole} onChanged={reload} />}
        {activeTab === "Certif./Exames" && <CertificadosTab federationId={federationId} practitionerId={practitionerId!} />}
        {activeTab === "Carteirinha"    && <CarteirinhaPanel federationId={federationId} practitionerId={practitionerId!} />}
        {activeTab === "Transferência"  && <TransferenciaTab federationId={federationId} practitioner={data} karateRole={karateRole} onTransferred={reload} />}
        {activeTab === "Documentos"     && <PlaceholderTab label="Documentos" />}
      </ScrollView>

      {/* Modal de edição da ficha (reusa o cadastro com o id atual) */}
      <PraticanteFichaModal
        federationId={federationId}
        visible={editOpen}
        practitionerId={practitionerId!}
        onClose={() => setEditOpen(false)}
        onSaved={() => reload()}
      />

      {/* Modal in-app: praticante com histórico (Desativar / Excluir definitivo) */}
      <ExcluirComHistoricoModal
        visible={hasHistory !== null}
        counts={hasHistory}
        busy={delBusy}
        onDesativar={handleDesativar}
        onExcluir={handleExcluirDefinitivo}
        onClose={() => { if (!delBusy) setHasHistory(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  headerCard: { backgroundColor: "#fff", padding: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  headerRow:  { flexDirection: "row", alignItems: "flex-start", gap: 12 } as ViewStyle,
  headerActions: { alignItems: "flex-end", gap: 8 } as ViewStyle,
  headerBtnRow: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  editBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine } as ViewStyle,
  editBtnText: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  deleteBtn:  { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine } as ViewStyle,
  deleteBtnText: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  avatar:     { width: 52, height: 52, borderRadius: 26, backgroundColor: KarateColors.bg2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  regNum:     { fontSize: 11, fontWeight: "800", color: KarateColors.primary, letterSpacing: 0.8, fontFamily: KarateFonts.mono } as TextStyle,
  fullName:   { fontFamily: KarateFonts.heading, fontSize: 20, fontWeight: "400", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  tabBar:     { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: "#fff" } as ViewStyle,
  tabBarContent: { flexDirection: "row", paddingHorizontal: 8 } as ViewStyle,
  tab:        { paddingVertical: 12, paddingHorizontal: 14 } as ViewStyle,
  tabActive:  { borderBottomWidth: 2, borderBottomColor: KarateColors.primary } as ViewStyle,
  tabLabel:   { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  tabLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  content:    { flex: 1 } as ViewStyle,
});

const tabStyles = StyleSheet.create({
  tab:              { padding: 16, gap: 10 } as ViewStyle,
  // Foto / avatar do praticante (topo da aba Cadastro)
  avatarBlock:      { alignItems: "center", paddingBottom: 8 } as ViewStyle,
  avatarPhoto:      { width: 88, height: 88, borderRadius: 44, backgroundColor: KarateColors.bg2 } as ViewStyle,
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: KarateColors.bg2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  avatarInitials:   { fontFamily: KarateFonts.heading, fontSize: 32, color: KarateColors.ink2 } as TextStyle,
  // Ações da aba (CTA primário sumi em tamanho normal, alinhado à direita).
  tabActions:       { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 8 } as ViewStyle,
  infoRow:          { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  infoLabel:        { fontSize: 12, color: KarateColors.ink3, width: 88 } as TextStyle,
  infoVal:          { fontSize: 13, color: KarateColors.ink, flex: 1 } as TextStyle,
  // Endereço (só-leitura)
  sectionDivider:   { height: 1, backgroundColor: KarateColors.border, marginVertical: 8 } as ViewStyle,
  sectionLabel:     { fontSize: 11, fontWeight: "800", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,
  rolesRow:         { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 } as ViewStyle,
  roleChip:         { paddingVertical: 3, paddingHorizontal: 10, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine } as ViewStyle,
  roleChipText:     { fontSize: 11, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  // Ações por item (Editar / Excluir) — usadas em Trajetória e Transferência.
  itemActions:      { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  iconBtn:          { width: 32, height: 32, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" } as ViewStyle,
  iconBtnDanger:    { borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  // Track C: nova faixa banner
  currentBeltBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: KarateColors.primarySoft, padding: 12,
    borderRadius: KarateRadius.md, marginBottom: 4,
  } as ViewStyle,
  currentBeltInfo:  { flex: 1, gap: 4 } as ViewStyle,
  currentBeltLabel: { fontSize: 11, fontWeight: "800", color: KarateColors.primary, textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,
  currentBeltSince: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  // Trajetória
  beltEntry:        { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 8 } as ViewStyle,
  beltLine:         { width: 3, borderRadius: 2, backgroundColor: KarateColors.border, alignSelf: "stretch", minHeight: 40 } as ViewStyle,
  beltDate:         { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  // Track N: transferências
  transferHint:     { fontSize: 12, color: KarateColors.ink3, marginBottom: 2 } as TextStyle,
  transferCard:     { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 6 } as ViewStyle,
  transferRow:      { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  transferDojo:     { flex: 1, fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  transferMeta:     { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  transferReason:   { fontSize: 12, color: KarateColors.ink2, fontStyle: "italic" } as TextStyle,
  // Certificados (Track C)
  certHint:         { fontSize: 12, color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  certCard:         { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8 } as ViewStyle,
  certHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  certInfo:         { flex: 1, gap: 2 } as ViewStyle,
  certTitle:        { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  certMeta:         { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  certUrl:          { fontSize: 11, color: KarateColors.primary } as TextStyle,
});

// Estilos do modal de registro de graduação (Shoji)
const gradStyles = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card:      { width: "100%", maxWidth: 520, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.xl, overflow: "hidden", borderWidth: 1, borderColor: KarateColors.border2, maxHeight: "92%" } as ViewStyle,
  head:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  title:     { fontFamily: KarateFonts.heading, fontSize: 18, color: KarateColors.ink } as TextStyle,
  hint:      { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  label:     { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: KarateColors.ink2, marginTop: 4 } as TextStyle,
  labelHint: { fontWeight: "500", color: KarateColors.ink4 } as TextStyle,
  beltGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  beltChip:  { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" } as ViewStyle,
  beltChipActive: { borderColor: KarateColors.ink, borderWidth: 2 } as ViewStyle,
  beltChipTxt: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 } as TextStyle,
  input:     { fontFamily: KarateFonts.mono, fontSize: 15, color: KarateColors.ink, backgroundColor: KarateColors.glassHi, borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, paddingHorizontal: 12, paddingVertical: 11, letterSpacing: 0.5 } as TextStyle,
  inputBad:  { borderColor: KarateColors.primary } as ViewStyle,
  errInline: { fontSize: 11, color: KarateColors.primary } as TextStyle,
  legacyRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 4 } as ViewStyle,
  checkbox:  { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: KarateColors.border2, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.glassHi } as ViewStyle,
  checkboxOn:{ backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  legacyTxt: { fontSize: 13, color: KarateColors.ink2, flex: 1 } as TextStyle,
  errBox:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine, borderRadius: 12, padding: 11 } as ViewStyle,
  errTxt:    { fontSize: 12.5, color: KarateColors.primary2, flex: 1 } as TextStyle,
  footer:    { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  btnGhost:  { paddingVertical: 11, paddingHorizontal: 18, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: KarateRadius.md, backgroundColor: KarateColors.ink, minWidth: 130, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
});

// Estilos das opções do modal de exclusão com histórico.
const delStyles = StyleSheet.create({
  optPrimary:      { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: KarateColors.ink, borderRadius: KarateRadius.md, padding: 14 } as ViewStyle,
  optPrimaryTitle: { fontSize: 14, fontWeight: "700", color: "#fdf8f2" } as TextStyle,
  optPrimarySub:   { fontSize: 12, color: "rgba(253,248,242,0.75)", marginTop: 2 } as TextStyle,
  optDanger:       { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine, borderRadius: KarateRadius.md, padding: 14 } as ViewStyle,
  optDangerTitle:  { fontSize: 14, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  optDangerSub:    { fontSize: 12, color: KarateColors.primary2, marginTop: 2 } as TextStyle,
});
