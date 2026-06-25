// ============================================================
// Ficha do Praticante — Aura Karâtê
//
// Tabs: Cadastro | Trajetória | Certif./Exames | Carteirinha | Transferência | Documentos
// Wired: GET /federation/{id}/practitioners/{practitionerId}
// Track C (Fase 2): aba "Certif./Exames" mostra a nova faixa após aprovacão
//   e o status/URL do certificado com botão "Solicitar emissão".
// Track D (Fase 3): aba "Carteirinha" emite/renova + renderiza o cartão.
// Track N: aba "Transferência" mostra o histórico imutável + botão transferir
//   (gated por papel: federation_admin / federation_staff).
// DECISÃO FPKT #3: certificado sob demanda via karateApi.issueCertificate.
//
// Navegação: esta é a página de DETALHE full-page (destino do row-tap da lista).
// O botão "Editar" (header) abre o modal de ficha para edição rápida.
//
// Padronização de CTAs (Shoji): as ações das abas de detalhe ("Registrar
//   graduação", "Transferir para outro dojô") são CTAs primários em sumi
//   (escuro), em tamanho normal e alinhados à direita — não mais faixas
//   vermelhas full-width. O vermelhão (primary) fica reservado a ações
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
//
// Edição/Exclusão (federação manda em tudo):
//   - Header: "Excluir praticante" ao lado de "Editar". Sem histórico → confirma
//     e exclui (volta à lista). Com histórico (HasHistoryError) → modal in-app
//     com os counts oferecendo Desativar (is_active:false) / Excluir
//     definitivamente (cascade, confirmação forte) / Cancelar.
//   - Trajetória: cada graduação ganha Editar (faixa + data) e Excluir; a faixa
//     atual recalcula sozinha no backend (view) após o refetch.
//   - Transferência: cada registro ganha Editar (motivo + data) e Excluir.
//   ARMADILHA: Alert.alert com botões é NO-OP no React Native Web. Confirmações
//   usam window.confirm / window.alert; a escolha tripla do delete usa modal
//   in-app. Ícones dos NOVOS controles via <Icon> (components/Icon.tsx).
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Alert, Platform,
  StyleSheet, ViewStyle, TextStyle, ActivityIndicator,
  Modal, TextInput, Pressable,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

// ── Confirmação/feedback cross-plataforma ──────────────────────
// ARMADILHA: no React Native Web o Alert.alert COM BOTÕES é um no-op (o
// onPress nunca dispara). Para confirmar/avisar usamos window.confirm /
// window.alert na web (e Alert.alert só em nativo, onde funciona).
function webConfirm(message: string): boolean {
  if (Platform.OS === "web" && typeof window !== "undefined") return window.confirm(message);
  return true; // nativo: o caller usa Alert.alert próprio quando necessário
}
function webNotify(title: string, message?: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
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

const TABS = ["Cadastro", "Trajetória", "Certif./Exames", "Carteirinha", "Transferência", "Documentos"] as const;
type Tab = typeof TABS[number];

function CadastroTab({ p }: { p: PractitionerDetail }) {
  function Row({ icon, label, val }: { icon: string; label: string; val: string | null }) {
    if (!val) return null;
    return (
      <View style={tabStyles.infoRow}>
        <Ionicons name={icon as any} size={14} color={KarateColors.ink3} />
        <Text style={tabStyles.infoLabel}>{label}</Text>
        <Text style={tabStyles.infoVal}>{val}</Text>
      </View>
    );
  }

  // Endereço (B): hoje existe no banco/modal mas não era exibido aqui.
  // Os campos vêm flat no detalhe (street/number/.../zip_code), como o modal
  // de edição lê. Linha única + 2ª linha bairro/cidade/UF. Campos ausentes são
  // neutros (não renderizamos — sem "—" feio), conforme padrão do app.
  const pa: any = p;
  const line1Parts = [pa.street, pa.number].filter(Boolean).join(", ");
  const line1 = [line1Parts, pa.complement].filter(Boolean).join(" — ");
  const line2 = [pa.neighborhood, pa.city, pa.state].filter(Boolean).join(" · ");
  const cep = formatCepDisplay(pa.zip_code);
  const hasAddress = !!(line1 || line2 || cep);

  return (
    <View style={tabStyles.tab}>
      <Row icon="person-outline"   label="Nome"         val={p.full_name} />
      <Row icon="id-card-outline"  label="CPF"          val={formatCpfDisplay(p.cpf)} />
      <Row icon="document-outline" label="RG"           val={p.rg ?? null} />
      <Row icon="calendar-outline" label="Nascimento"   val={p.birth_date ? formatIsoToBr(p.birth_date) : null} />
      <Row icon="mail-outline"     label="E-mail"       val={p.email ?? null} />
      <Row icon="call-outline"     label="Telefone"     val={formatPhoneDisplay(p.phone)} />
      <Row icon="ribbon-outline"   label="Registro"     val={p.karate_registration_number} />

      {/* Endereço (só leitura — edição é pelo modal). Campos vazios ocultos. */}
      {hasAddress && (
        <View style={tabStyles.addressBlock}>
          <View style={tabStyles.addressHead}>
            <Ionicons name="location-outline" size={14} color={KarateColors.ink3} />
            <Text style={tabStyles.addressTitle}>Endereço</Text>
          </View>
          {cep ?    <Text style={tabStyles.addressLine}>CEP {cep}</Text> : null}
          {line1 ?  <Text style={tabStyles.addressLine}>{line1}</Text> : null}
          {line2 ?  <Text style={tabStyles.addressLine}>{line2}</Text> : null}
        </View>
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

  // Excluir graduação: a faixa atual é derivada por view → recalcula no refetch.
  async function handleDelete(entry: BeltHistoryEntry) {
    if (!webConfirm("Excluir esta graduação? A faixa atual será recalculada.")) return;
    setBusyId(entry.id);
    try {
      await karateApi.deleteGraduation(federationId, practitionerId, entry.id);
      onChanged();
    } catch (e: any) {
      webNotify("Não foi possível excluir", e?.message || "Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  // Fix C4: só mostra "Desde:" quando a data é conhecida (≠ sentinela 1900).
  const currentSinceUnknown = currentBelt ? isUnknownBeltDate(currentBelt.current_since) : true;

  return (
    <View style={tabStyles.tab}>
      {AddButton}

      {/* Faixa atual (derivada do histórico) — Track C */}
      {currentBelt && (
        <View style={tabStyles.currentBeltBanner}>
          <Ionicons name="ribbon" size={16} color={KarateColors.primary} />
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
          subtitle={allowed ? "Use “Registrar graduação” para adicionar a primeira faixa." : undefined}
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
                      ? <ActivityIndicator size="small" color={KarateColors.danger} />
                      : <Icon name="trash" size={15} color={KarateColors.danger} />}
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

// Track A (fix 23/06): registrar uma graduação manual (faixa + data) no
// histórico do praticante. karate_belt_history é append-only — isto é o
// "editar trajetória": adiciona uma faixa, nunca altera registros antigos.
// A faixa atual é derivada automaticamente (view karate_current_belt).
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
  const [dateBr, setDateBr] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // reset ao abrir
  useEffect(() => {
    if (visible) { setBeltKey(null); setDateBr(""); setLegacy(false); setErr(null); setSaving(false); }
  }, [visible]);

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
        belt_name: KarateBelts[beltKey].label,
        belt_schema: legacy ? "legacy" : "fpkt_shotokan",
        graduated_at: dateIso || undefined, // sem data → backend usa hoje
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
              <Ionicons name="close" size={20} color={KarateColors.ink3} />
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
                    onPress={() => setBeltKey(opt.key)}
                    activeOpacity={0.7}
                    style={[gradStyles.beltChip, { backgroundColor: KarateBelts[opt.key].color }, active && gradStyles.beltChipActive]}
                  >
                    <Text style={[gradStyles.beltChipTxt, { color: KarateBelts[opt.key].textColor }]}>{opt.label}</Text>
                    {active && <Ionicons name="checkmark-circle" size={14} color={KarateBelts[opt.key].textColor} />}
                  </TouchableOpacity>
                );
              })}
            </View>

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
                {legacy && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={gradStyles.legacyTxt}>Registro histórico (sistema legado)</Text>
            </TouchableOpacity>

            {err ? (
              <View style={gradStyles.errBox}>
                <Ionicons name="alert-circle" size={15} color={KarateColors.primary} />
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

// Editar uma graduação existente (C): faixa (belt_level/belt_name) + data.
// PATCH via karateApi.updateGraduation. A faixa atual recalcula no refetch.
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
  const [dateBr, setDateBr] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // pré-preenche ao abrir a partir do registro selecionado
  useEffect(() => {
    if (!entry) return;
    const match = (Object.keys(KarateBelts) as BeltKey[]).find(
      (k) => k === entry.belt_level || KarateBelts[k].label === entry.belt_name
    ) ?? null;
    setBeltKey(match);
    setDateBr(isUnknownBeltDate(entry.graduated_at) ? "" : (formatIsoToBr(entry.graduated_at) || ""));
    setErr(null); setSaving(false);
  }, [entry]);

  const dateComplete = dateBr.length === 10;
  const dateIso = parseBrDate(dateBr);
  const dateBad = dateComplete && dateIso === null;

  async function handleSave() {
    if (!entry) return;
    if (!beltKey) { setErr("Selecione a faixa."); return; }
    if (dateBad) { setErr("Data inválida. Use dd/mm/aaaa ou deixe em branco."); return; }
    setErr(null); setSaving(true);
    try {
      await karateApi.updateGraduation(federationId, practitionerId, entry.id, {
        belt_level: beltKey,
        belt_name: KarateBelts[beltKey].label,
        graduated_at: dateIso || undefined,
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
              <Ionicons name="close" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={gradStyles.hint}>
              Corrige a faixa e/ou a data deste registro do histórico. A faixa atual é recalculada automaticamente.
            </Text>

            <Text style={gradStyles.label}>Faixa</Text>
            <View style={gradStyles.beltGrid}>
              {BELT_OPTIONS.map((opt) => {
                const active = beltKey === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setBeltKey(opt.key)}
                    activeOpacity={0.7}
                    style={[gradStyles.beltChip, { backgroundColor: KarateBelts[opt.key].color }, active && gradStyles.beltChipActive]}
                  >
                    <Text style={[gradStyles.beltChipTxt, { color: KarateBelts[opt.key].textColor }]}>{opt.label}</Text>
                    {active && <Ionicons name="checkmark-circle" size={14} color={KarateBelts[opt.key].textColor} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={gradStyles.label}>Data da graduação · dd/mm/aaaa <Text style={gradStyles.labelHint}>(vazio = mantém atual)</Text></Text>
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
                <Ionicons name="alert-circle" size={15} color={KarateColors.primary} />
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

// Track N: aba de transferências — histórico imutável + ação de transferir
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

  // Excluir registro de transferência: NÃO move o praticante de volta —
  // só remove a linha do histórico (decisão de produto).
  async function handleDelete(t: TransferRecord) {
    if (!webConfirm("Excluir este registro de transferência? Isso NÃO move o praticante de volta — use uma nova transferência para isso.")) return;
    setBusyId(t.id);
    try {
      await karateApi.deleteTransfer(federationId, practitioner.id, t.id);
      load();
    } catch (e: any) {
      webNotify("Não foi possível excluir", e?.message || "Tente novamente.");
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
            Histórico de transferências do praticante.
          </Text>
          {transfers.map((t) => (
            <View key={t.id} style={tabStyles.transferCard}>
              <View style={tabStyles.transferRow}>
                <Text style={tabStyles.transferDojo} numberOfLines={1}>{t.origin_dojo_name || "Sem dojô"}</Text>
                <Ionicons name="arrow-forward" size={15} color={KarateColors.primary} />
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
                        ? <ActivityIndicator size="small" color={KarateColors.danger} />
                        : <Icon name="trash" size={15} color={KarateColors.danger} />}
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

// Editar uma transferência registrada (D): motivo + data → updateTransfer.
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
    setDateBr(formatIsoToBr(transfer.transferred_at) || "");
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
              <Ionicons name="close" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={gradStyles.hint}>
              Ajusta o motivo e a data deste registro de transferência. Não move o praticante de dojô.
            </Text>

            <Text style={gradStyles.label}>Data da transferência · dd/mm/aaaa</Text>
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

            <Text style={gradStyles.label}>Motivo <Text style={gradStyles.labelHint}>(opcional)</Text></Text>
            <TextInput
              style={[gradStyles.input, { minHeight: 64, textAlignVertical: "top" }]}
              value={reason}
              onChangeText={setReason}
              placeholder="Ex.: mudança de cidade"
              placeholderTextColor={KarateColors.ink4}
              multiline
              accessibilityLabel="Motivo da transferência"
            />

            {err ? (
              <View style={gradStyles.errBox}>
                <Ionicons name="alert-circle" size={15} color={KarateColors.primary} />
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

// Modal de exclusão com histórico (A): escolha tripla in-app a partir dos
// counts do HasHistoryError. Desativar (primário, soft) / Excluir
// definitivamente (destrutivo, cascade) / Cancelar.
function ExcluirComHistoricoModal({
  counts, name, busy, onDesativar, onExcluir, onClose,
}: {
  counts: Record<string, number> | null;
  name: string;
  busy: boolean;
  onDesativar: () => void;
  onExcluir: () => void;
  onClose: () => void;
}) {
  const visible = !!counts;
  const c = counts || {};
  const rows: Array<{ label: string; n: number }> = [
    { label: "Graduações", n: c.graduations ?? 0 },
    { label: "Transferências", n: c.transfers ?? 0 },
    { label: "Carteirinhas", n: c.cards ?? 0 },
  ];
  if ((c.transactions ?? 0) > 0) rows.push({ label: "Lançamentos financeiros", n: c.transactions });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={gradStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />
        <View style={gradStyles.card}>
          <View style={gradStyles.head}>
            <Text style={gradStyles.title}>Excluir praticante</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} disabled={busy}>
              <Ionicons name="close" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={gradStyles.hint}>
              <Text style={{ fontWeight: "700", color: KarateColors.ink }}>{name}</Text> possui histórico
              vinculado. Você pode <Text style={{ fontWeight: "700" }}>Desativar</Text> (mantém o histórico,
              tira da contagem de ativos) ou <Text style={{ fontWeight: "700", color: KarateColors.danger }}>Excluir
              definitivamente</Text> (remove o praticante e todo o histórico em cascata — não há volta).
            </Text>

            <View style={delStyles.countsBox}>
              {rows.map((r) => (
                <View key={r.label} style={delStyles.countRow}>
                  <Text style={delStyles.countLabel}>{r.label}</Text>
                  <Text style={delStyles.countNum}>{r.n}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={delStyles.footerCol}>
            <KarateButton
              label="Desativar praticante"
              variant="sumi"
              size="md"
              loading={busy}
              onPress={onDesativar}
              style={{ width: "100%" }}
            />
            <KarateButton
              label="Excluir definitivamente"
              variant="primary"
              size="md"
              disabled={busy}
              onPress={onExcluir}
              style={{ width: "100%" }}
            />
            <TouchableOpacity onPress={onClose} style={delStyles.cancelBtn} disabled={busy}>
              <Text style={delStyles.cancelTxt}>Cancelar</Text>
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
  // Exclusão: counts do HasHistoryError (null = modal fechado) + flag de busy
  const [historyCounts, setHistoryCounts] = useState<Record<string, number> | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(() => {
    if (!practitionerId) return;
    setError(false);
    karateApi.getPractitioner(federationId, practitionerId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [federationId, practitionerId]);

  useEffect(() => { reload(); }, [reload]);

  // A) Excluir praticante — fluxo idêntico ao do dojô.
  const goToList = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/karate/praticantes");
  }, []);

  const handleExcluir = useCallback(async () => {
    if (!practitionerId || !data) return;
    // Sem cascade: tenta o hard delete. Sem histórico → confirma e volta.
    if (!webConfirm(`Excluir o praticante ${data.full_name}?`)) return;
    setDeleting(true);
    try {
      await karateApi.deletePractitioner(federationId, practitionerId);
      setDeleting(false);
      webNotify("Praticante excluído");
      goToList();
    } catch (e: any) {
      setDeleting(false);
      if (e instanceof HasHistoryError) {
        // Com histórico → abre a escolha tripla in-app.
        setHistoryCounts(e.counts || {});
      } else {
        webNotify("Não foi possível excluir", e?.message || "Tente novamente.");
      }
    }
  }, [federationId, practitionerId, data, goToList]);

  // Desativar (soft) — usa o update de praticante existente (is_active:false).
  const handleDesativar = useCallback(async () => {
    if (!practitionerId) return;
    setDeleting(true);
    try {
      await karateApi.updatePractitioner(federationId, practitionerId, { is_active: false });
      setDeleting(false);
      setHistoryCounts(null);
      webNotify("Praticante desativado", "Mantido no histórico, fora da contagem de ativos.");
      reload();
    } catch (e: any) {
      setDeleting(false);
      webNotify("Não foi possível desativar", e?.message || "Tente novamente.");
    }
  }, [federationId, practitionerId, reload]);

  // Excluir definitivamente (cascade) — confirmação FORTE via window.confirm.
  const handleHardDelete = useCallback(async () => {
    if (!practitionerId || !data) return;
    if (!webConfirm(
      `EXCLUSÃO DEFINITIVA\n\nIsto remove ${data.full_name} e TODO o histórico (graduações, transferências, carteirinhas) em cascata. Esta ação não pode ser desfeita.\n\nConfirmar?`
    )) return;
    setDeleting(true);
    try {
      await karateApi.deletePractitioner(federationId, practitionerId, { cascade: true });
      setDeleting(false);
      setHistoryCounts(null);
      webNotify("Praticante excluído definitivamente");
      goToList();
    } catch (e: any) {
      setDeleting(false);
      webNotify("Não foi possível excluir", e?.message || "Tente novamente.");
    }
  }, [federationId, practitionerId, data, goToList]);

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
            <Ionicons name="person" size={24} color={KarateColors.ink3} />
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
            <View style={styles.headerBtns}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setEditOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Editar praticante"
              >
                <Icon name="edit" size={15} color={KarateColors.primary} />
                <Text style={styles.editBtnText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleExcluir}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Excluir praticante"
              >
                {deleting && !historyCounts
                  ? <ActivityIndicator size="small" color={KarateColors.danger} />
                  : <Icon name="trash" size={15} color={KarateColors.danger} />}
                <Text style={styles.deleteBtnText}>Excluir</Text>
              </TouchableOpacity>
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

      {/* Modal de exclusão com histórico (escolha tripla) */}
      <ExcluirComHistoricoModal
        counts={historyCounts}
        name={data.full_name}
        busy={deleting}
        onDesativar={handleDesativar}
        onExcluir={handleHardDelete}
        onClose={() => { if (!deleting) setHistoryCounts(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  headerCard: { backgroundColor: "#fff", padding: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  headerRow:  { flexDirection: "row", alignItems: "flex-start", gap: 12 } as ViewStyle,
  headerActions: { alignItems: "flex-end", gap: 8 } as ViewStyle,
  headerBtns: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  editBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine } as ViewStyle,
  editBtnText: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  deleteBtn:  { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.dangerSoft, borderWidth: 1, borderColor: KarateColors.danger } as ViewStyle,
  deleteBtnText: { fontSize: 12, fontWeight: "700", color: KarateColors.danger } as TextStyle,
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
  // Ações da aba (CTA primário sumi em tamanho normal, alinhado à direita).
  tabActions:       { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 8 } as ViewStyle,
  infoRow:          { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  infoLabel:        { fontSize: 12, color: KarateColors.ink3, width: 88 } as TextStyle,
  infoVal:          { fontSize: 13, color: KarateColors.ink, flex: 1 } as TextStyle,
  rolesRow:         { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 } as ViewStyle,
  roleChip:         { paddingVertical: 3, paddingHorizontal: 10, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine } as ViewStyle,
  roleChipText:     { fontSize: 11, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  // Endereço (B): bloco só leitura na aba Cadastro.
  addressBlock:     { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: KarateColors.border, gap: 3 } as ViewStyle,
  addressHead:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 } as ViewStyle,
  addressTitle:     { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  addressLine:      { fontSize: 13, color: KarateColors.ink, marginLeft: 22 } as TextStyle,
  // Ações por item (Editar/Excluir) na trajetória e nas transferências.
  itemActions:      { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  iconBtn:          { width: 32, height: 32, borderRadius: KarateRadius.sm, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: KarateColors.border2, backgroundColor: KarateColors.glassHi } as ViewStyle,
  iconBtnDanger:    { borderColor: KarateColors.danger, backgroundColor: KarateColors.dangerSoft } as ViewStyle,
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

// Estilos do modal de exclusão com histórico
const delStyles = StyleSheet.create({
  countsBox:  { backgroundColor: KarateColors.glassHi, borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, overflow: "hidden" } as ViewStyle,
  countRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: KarateColors.border } as ViewStyle,
  countLabel: { fontSize: 13, color: KarateColors.ink2 } as TextStyle,
  countNum:   { fontSize: 14, fontWeight: "800", color: KarateColors.ink, fontFamily: KarateFonts.mono } as TextStyle,
  footerCol:  { gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  cancelBtn:  { alignItems: "center", paddingVertical: 8 } as ViewStyle,
  cancelTxt:  { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
});

// Estilos do modal de registro/edição de graduação (Shoji)
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
