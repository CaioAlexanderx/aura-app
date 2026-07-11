// ============================================================
// Detalhe do Dojô — Aura Karatê (federação) · Shoji
// Dados reais via GET /federation/{id}/dojos/{dojoId}.
//
// Navegação: esta é a página de DETALHE full-page (destino do row-tap da lista).
// O botão "Editar" (header) abre o modal de ficha para edição rápida.
// IA/Nav P1: o botão "Ver praticantes" leva à lista já filtrada por este
//   dojô (/karate/praticantes?dojo_id=<id> — a lista lê o param dojo_id).
//
// Export (round-trip com o import): o botão "Exportar" abre um modal que baixa
//   os dados atuais do dojô no MESMO formato da Importação (abas Academias/
//   Alunos/Histórico) para o dojô editar e reimportar. Ver DojoExportModal.
//
// Gestão da federação (fix/karate-dojo-edit-delete-ui): a federação pode
//   SUSPENDER/REATIVAR e EXCLUIR o dojô daqui, além de EDITAR/ESTORNAR
//   anuidades lançadas. Exclusão segue o contrato HAS_HISTORY do backend:
//   sem histórico → hard delete; com histórico → escolha entre Desativar
//   (soft, is_active:false) e Excluir definitivamente (cascade). Confirmações
//   destrutivas via window.confirm / modal in-app — NUNCA Alert.alert com
//   botões (no-op em RN-Web).
//
// Endereço estruturado: o detalhe exibe os campos address_* (Logradouro,
//   Número, COMPLEMENTO, Bairro, Cidade/UF, CEP) — os mesmos da ficha (modal)
//   e da NF-e. O Complemento é vital para envio de certificados/carteirinhas.
//   Se o registro ainda não tem campos estruturados, cai no `address` legado.
//
// Nav P2 (7.3): ações de link público no header — "Ranking público" (abre)
//   e "Copiar link do ranking". O link relevante é a página pública do RANKING
//   da federação no microsite (/karate/[slug]/ranking servido em
//   {slug}.getaura.com.br/ranking), onde os atletas deste dojô aparecem.
//   O slug vem de getFederationIdentity (fallback: slug do host atual).
//
// DJ2: card Cadastro exibe "Sensei responsável" (sensei_practitioner_name ou
//   sensei_name) em vez do CPF. CPF removido da exibição.
//
// DJ4: cada anuidade não paga ganha botão "Registrar pagamento" (modal pequeno:
//   data + forma + valor opcional → payAnnuity). Botão geral "Lançar pagamento"
//   no topo da seção → modal (competência + valor + data + forma →
//   registerAnnuityPayment). Convive com Editar/Estornar já existentes.
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ScrollView, View, Text, StyleSheet, ViewStyle, TextStyle, Alert, Linking,
  Modal, Pressable, TouchableOpacity, TextInput, ActivityIndicator, Animated, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP, KarateType as T } from "@/constants/karateTheme";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { Badge } from "@/components/karate/Badge";
import { BeltBadge } from "@/components/karate/BeltBadge";
import {
  ShojiBackground, PageHead, SectionHead, Card, KV, ShojiBadge, BeltTag, ShojiButton, Mono, Body, Eyebrow, H1, KpiBand, BarRow,
} from "@/components/karate/shoji";
import { Icon } from "@/components/Icon";
import DojoFichaModal from "@/components/karate/DojoFichaModal";
import DojoExportModal from "@/components/karate/DojoExportModal";
import GerirEquipeTecnicaModal from "@/components/karate/GerirEquipeTecnicaModal";
import RedistribuirPraticantesModal from "@/components/karate/RedistribuirPraticantesModal";
import InactivateChoiceDialog from "@/components/karate/InactivateChoiceDialog";
import RosterValidationBanner from "@/components/karate/RosterValidationBanner";
import { usePrefersReducedMotion } from "@/components/karate/anim/useReducedMotion";
import { ModalPop } from "@/components/anim/ModalPop";
import { karateApi, DojoDetail, AffiliationModel, HasHistoryError, HasHistoryCounts, DojoMemberStanding, RosterValidation } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { canTransfer } from "@/components/karate/praticante-detalhe/helpers";
import { DocumentosSection } from "@/components/karate/DocumentosSection";
import { copyToClipboard } from "@/utils/clipboard";

const MODEL_LABEL: Record<AffiliationModel, string> = { annual: "Anual", biannual: "Semestral", quarterly: "Trimestral" };
const ROLE_LABEL: Record<string, string> = { instructor: "Instrutor", arbiter: "Árbitro", examiner: "Examinador", sensei: "Sensei", senpai: "Senpai", assistant: "Auxiliar" };
// Item 2 (menu de overflow do header): mesmo padrão hover-só-web + fallback
// touch usado em InactivateChoiceDialog/RedistribuirPraticantesModal.
const MENU_IS_WEB = Platform.OS === "web";
const OVERFLOW_MENU_WIDTH = 264;

type OverflowMenuItem =
  | { type: "action"; key: string; label: string; icon: string; onPress: () => void; destructive?: boolean; disabled?: boolean }
  | { type: "divider"; key: string };
const fmtDate = (iso: string | null) => { if (!iso) return null; const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }); };
const fmtMoney = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Máscara leve de CEP só para exibição (não altera o dado).
const fmtCep = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const d = String(v).replace(/\D/g, "");
  if (d.length === 8) return d.replace(/(\d{5})(\d{3})/, "$1-$2");
  return String(v);
};

// "Logradouro, Número" numa linha só (componível com os demais KVs).
const fmtStreetLine = (street?: string | null, number?: string | null): string | null => {
  const s = (street || "").trim();
  const n = (number || "").trim();
  if (s && n) return `${s}, ${n}`;
  return s || n || null;
};

const fmtCityLine = (city?: string | null, state?: string | null): string | null => {
  const c = (city || "").trim();
  const u = (state || "").trim();
  if (c && u) return `${c} · ${u}`;
  return c || u || null;
};

// Rótulos PT-BR para os counts do HAS_HISTORY (back manda chaves canônicas).
const COUNT_LABEL: Record<string, string> = {
  practitioners: "praticantes",
  annuities: "anuidades",
  transactions: "transações",
  belt_history: "histórico de faixas",
  transfers: "transferências",
  connections: "conexões",
};

// Máscara de data dd/mm/aaaa para os modais de anuidade.
const onlyD = (v: string) => (v || "").replace(/\D/g, "");
function maskDate(v: string) {
  const d = onlyD(v).slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "$1/$2");
  return d;
}
function brToISO(v: string): string | null {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null;
  return `${yyyy}-${mm}-${dd}`;
}
function isoToBr(v: string | null | undefined): string {
  if (!v) return "";
  const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
function todayBr(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${now.getFullYear()}`;
}

// Tipo defensivo: a entrada do annuity_history PODE trazer o id da anuidade
// (annuity_history_id / id). Sem id não dá para editar/estornar; nesse caso
// as ações simplesmente não aparecem para aquela linha.
type AnnuityRow = DojoDetail["annuity_history"][number] & {
  annuity_history_id?: string | null;
  id?: string | null;
  due_date?: string | null;
};
const annuityId = (a: AnnuityRow): string | null => a.annuity_history_id || a.id || null;

type PaymentMethod = "pix" | "dinheiro" | "transferencia" | "outro";
const PM_LABELS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];

export default function DojoDetailScreen() {
  const { dojoId } = useLocalSearchParams<{ dojoId: string }>();
  const router = useRouter();
  const { federationId, karateRole } = useKarateFederation();
  // Fase 2: mesmo gate de papel usado no praticante (canTransfer) — só
  // federation_admin/federation_staff podem anexar/excluir documentos do dojô.
  // As demais ações desta tela (editar/excluir/suspender dojô) já assumem que
  // só a federação chega aqui; não havia uma variável canEdit/allowed préexistente
  // nesta tela, então reaproveitamos o mesmo helper de papel do praticante.
  const canManage = canTransfer(karateRole);
  const reducedMotion = usePrefersReducedMotion();
  const [data, setData] = useState<DojoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Modal de edição (reusa a ficha de cadastro com o id atual)
  const [editOpen, setEditOpen] = useState(false);
  // Modal de exportação (round-trip com o import)
  const [exportOpen, setExportOpen] = useState(false);
  // F9: modal de gestão da equipe técnica (papéis is_arbiter/is_instructor/is_examiner/is_assistant)
  const [teamOpen, setTeamOpen] = useState(false);

  // Item 2: menu de overflow do header (kebab). Ancorado no botão via
  // measureInWindow — mesmo padrão de Modal transparent já usado nos demais
  // diálogos desta tela, só que posicionado perto do gatilho em vez de
  // centralizado.
  const kebabRef = useRef<any>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowPos, setOverflowPos] = useState<{ top: number; left: number } | null>(null);
  const openOverflowMenu = useCallback(() => {
    const node = kebabRef.current;
    if (node && typeof node.measureInWindow === "function") {
      node.measureInWindow((x: number, y: number, width: number, height: number) => {
        setOverflowPos({ top: y + height + 6, left: Math.max(8, x + width - OVERFLOW_MENU_WIDTH) });
        setOverflowOpen(true);
      });
    } else {
      setOverflowPos({ top: 96, left: 24 });
      setOverflowOpen(true);
    }
  }, []);

  // Cascata de inativação: diálogo de escolha (Inativar todos vs. Redistribuir)
  // ao acionar "Suspender", e o modal de tabela editável do Redistribuir.
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [redistribOpen, setRedistribOpen] = useState(false);

  // Gestão da federação: estado das ações destrutivas / de ciclo de vida.
  const [busy, setBusy] = useState(false);
  const [histModal, setHistModal] = useState<HasHistoryCounts | null>(null);
  const [annuityEdit, setAnnuityEdit] = useState<AnnuityRow | null>(null);

  // DJ4: modal "Registrar pagamento" (anuidade existente não paga)
  const [payModal, setPayModal] = useState<AnnuityRow | null>(null);
  // DJ4: modal "Lançar pagamento" (período novo já pago)
  const [registerModal, setRegisterModal] = useState(false);

  // Toast inline — padrão das fichas Shoji.
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    toastAnim.setValue(0);
    Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
    }, 2600);
  }, [toastAnim]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const load = useCallback(() => {
    if (!dojoId) return;
    setLoading(true); setError(false);
    karateApi.getDojo(federationId, dojoId).then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  }, [federationId, dojoId]);
  useEffect(() => { load(); }, [load]);

  // Fase 4 — Roster do dojô (2 badges: status + financeiro). Busca própria
  // (independente do GET de detalhe) via VIEW karate_member_standing.
  const [roster, setRoster] = useState<DojoMemberStanding[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState(false);
  const loadRoster = useCallback(() => {
    if (!dojoId) return;
    setRosterLoading(true); setRosterError(false);
    karateApi.getDojoMembersStanding(federationId, dojoId)
      .then((rows) => setRoster(rows || []))
      .catch(() => setRosterError(true))
      .finally(() => setRosterLoading(false));
  }, [federationId, dojoId]);
  useEffect(() => { loadRoster(); }, [loadRoster]);

  // Validação de quadro — GET roster-validation para o banner no topo do
  // detalhe (pending/validated). Falha silenciosa: o banner simplesmente
  // não aparece se o endpoint não responder (nada quebra na tela).
  const [rosterValidation, setRosterValidation] = useState<RosterValidation | null>(null);
  const [requestingRoster, setRequestingRoster] = useState(false);
  const loadRosterValidation = useCallback(() => {
    if (!dojoId) return;
    karateApi.getRosterValidation(federationId, dojoId)
      .then(setRosterValidation)
      .catch(() => setRosterValidation(null));
  }, [federationId, dojoId]);
  useEffect(() => { loadRosterValidation(); }, [loadRosterValidation]);

  // Botão "Solicitar atualização cadastral" — independente da inativação do
  // dojô. Gera/renova o link público e marca a validação como pendente.
  const requestRosterUpdate = useCallback(async () => {
    if (!dojoId || requestingRoster) return;
    setRequestingRoster(true);
    try {
      const res = await karateApi.requestRosterUpdate(federationId, dojoId);
      setRosterValidation({
        status: res.status || "pending",
        requested_at: res.requested_at || new Date().toISOString(),
        validated_at: null,
        validated_by: null,
        url: res.url,
      });
      showToast("Solicitação enviada — link gerado");
    } catch (e: any) {
      Alert.alert("Não foi possível solicitar", e?.message || "Tente novamente.");
    } finally {
      setRequestingRoster(false);
    }
  }, [dojoId, federationId, requestingRoster, showToast]);

  const copyRosterLink = useCallback(async () => {
    if (!rosterValidation?.url) return;
    const ok = await copyToClipboard(rosterValidation.url);
    showToast(ok ? "Link copiado" : "Não foi possível copiar o link");
  }, [rosterValidation, showToast]);

  // Abre o wa.me com o link pré-preenchido — o envio em si é manual (o
  // usuário confirma dentro do WhatsApp), nunca automático.
  const shareRosterLinkWhatsApp = useCallback(() => {
    if (!rosterValidation?.url) return;
    const link = `https://wa.me/?text=${encodeURIComponent(rosterValidation.url)}`;
    Linking.openURL(link).catch(() =>
      Alert.alert("Não foi possível abrir", "Copie o link e envie manualmente.")
    );
  }, [rosterValidation]);

  // ── Suspender / Reativar ─────────────────────────────────────────
  // b1: o backend agora manda status "inactive" (baseado em is_active) em vez
  // de "suspended". Aceitamos os dois valores aqui por compatibilidade
  // retroativa, e is_active tem precedência quando presente.
  const isSuspended = data
    ? (data.is_active !== undefined ? !data.is_active : (data.status === "inactive"))
    : false;
  // Reativar: fluxo direto (a cascata de restauração dos praticantes já é
  // do backend). Suspender agora passa pelo diálogo de escolha abaixo
  // (Inativar todos vs. Redistribuir) em vez de ir direto ao PATCH.
  const reactivateDojo = useCallback(async () => {
    if (!data || busy) return;
    if (!(await confirmAsync({ title: "Reativar dojô?", message: `Deseja reativar o dojô "${data.name}"? Os praticantes inativados na cascata anterior serão restaurados.`, confirmLabel: "Reativar", destructive: false }))) return;
    setBusy(true);
    try {
      await karateApi.updateDojo(federationId, dojoId!, { is_active: true });
      showToast("Dojô reativado");
      load(); loadRoster();
    } catch (e: any) {
      Alert.alert("Não foi possível", e?.message || "Falha ao reativar o dojô.");
    } finally { setBusy(false); }
  }, [data, busy, federationId, dojoId, load, loadRoster, showToast]);

  // Diálogo de escolha "Inativar todos" vs. "Redistribuir" — acionado pelo
  // botão "Suspender" quando o dojô está ativo. O próprio diálogo já mostra
  // a contagem de praticantes ativos, servindo como a confirmação explícita
  // exigida para ações irreversíveis.
  const onSuspendPress = useCallback(() => {
    if (!data || busy) return;
    if (isSuspended) { reactivateDojo(); return; }
    setChoiceOpen(true);
  }, [data, busy, isSuspended, reactivateDojo]);

  // Opção "Inativar todos os N praticantes" do diálogo de escolha — segue o
  // PATCH is_active:false de sempre; a cascata do backend inativa o quadro.
  const inactivateAllAndSuspend = useCallback(async () => {
    if (!data || busy) return;
    setBusy(true);
    try {
      await karateApi.updateDojo(federationId, dojoId!, { is_active: false });
      setChoiceOpen(false);
      showToast("Dojô e praticantes inativados");
      load(); loadRoster();
    } catch (e: any) {
      Alert.alert("Não foi possível", e?.message || "Falha ao suspender o dojô.");
    } finally { setBusy(false); }
  }, [data, busy, federationId, dojoId, load, loadRoster, showToast]);

  // Sucesso do modal de redistribuição — recarrega dojô + roster e fecha os
  // dois modais (o próprio Redistribuir e o diálogo de escolha, se ainda aberto).
  const onRedistributeSuccess = useCallback(() => {
    setRedistribOpen(false);
    setChoiceOpen(false);
    load(); loadRoster();
  }, [load, loadRoster]);

  // ── Excluir dojô ─────────────────────────────────────────────────
  const deleteDojo = useCallback(async () => {
    if (!data || busy) return;
    if (!(await confirmAsync({ title: "Excluir dojô?", message: `Excluir o dojô "${data.name}"? Esta ação não pode ser desfeita.`, confirmLabel: "Excluir", destructive: true }))) return;
    setBusy(true);
    try {
      await karateApi.deleteDojo(federationId, dojoId!);
      showToast("Dojô excluído");
      setTimeout(() => router.replace("/karate/dojos" as any), 320);
    } catch (e: any) {
      if (e instanceof HasHistoryError) {
        setHistModal(e.counts || {});
      } else {
        Alert.alert("Não foi possível excluir", e?.message || "Tente novamente.");
      }
    } finally { setBusy(false); }
  }, [data, busy, federationId, dojoId, router, showToast]);

  const desativarFromModal = useCallback(async () => {
    if (!dojoId || busy) return;
    setBusy(true);
    try {
      await karateApi.updateDojo(federationId, dojoId, { is_active: false });
      setHistModal(null);
      showToast("Dojô desativado");
      load();
    } catch (e: any) {
      Alert.alert("Não foi possível desativar", e?.message || "Tente novamente.");
    } finally { setBusy(false); }
  }, [dojoId, busy, federationId, load, showToast]);

  const excluirDefinitivo = useCallback(async () => {
    if (!data || !dojoId || busy) return;
    if (!(await confirmAsync({
      title: "Excluir definitivamente?",
      message: `EXCLUSÃO DEFINITIVA do dojô "${data.name}" e de TODO o histórico vinculado ` +
        `(praticantes, anuidades, transações, faixas, transferências, conexões).\n\n` +
        `Esta ação é IRREVERSÍVEL. Confirmar?`,
      confirmLabel: "Excluir definitivamente",
      destructive: true,
    }))) return;
    setBusy(true);
    try {
      await karateApi.deleteDojo(federationId, dojoId, { cascade: true });
      setHistModal(null);
      showToast("Dojô e histórico excluídos");
      setTimeout(() => router.replace("/karate/dojos" as any), 320);
    } catch (e: any) {
      Alert.alert("Não foi possível excluir", e?.message || "Tente novamente.");
    } finally { setBusy(false); }
  }, [data, dojoId, busy, federationId, router, showToast]);

  if (loading) return <ShojiBackground><View style={styles.content}>{[1, 2, 3, 4].map((k) => <Skeleton key={k} height={24} style={{ marginBottom: 12 }} />)}</View></ShojiBackground>;
  if (error || !data) return <ShojiBackground><KarateErrorState onRetry={load} /></ShojiBackground>;

  // Endereço estruturado.
  const streetLine = fmtStreetLine(data.address_street, data.address_number);
  const cityLine = fmtCityLine(data.address_city, data.address_state);
  const cepLine = fmtCep(data.address_zip);
  const hasStructuredAddress = !!(streetLine || data.address_complement || data.address_neighborhood || cityLine || cepLine);

  // DJ2: nome do sensei responsável (praticante vinculado tem precedência).
  const senseiDisplay = (data as any).sensei_practitioner_name || (data as any).sensei_name || null;
  const senseiIsPractitioner = !!(data as any).sensei_practitioner_id;

  // Fase 4 — contadores do roster (topo da seção Praticantes).
  const rosterActiveCount = roster.filter((m) => m.is_active).length;

  // Fase 5 — quebra Total/Ativos/Inativos + faixas-pretas (total e % com
  // anuidade da federação em dia). Tudo derivado client-side do MESMO roster
  // já buscado acima (VIEW karate_member_standing) — sem 2ª chamada e com a
  // MESMA fonte que os badges por linha logo abaixo. `rosterHasData` guarda
  // contra mostrar contagem/percentual falso enquanto carrega ou se o
  // standing falhar (degrade para "—", nunca um número inventado).
  const rosterHasData = !rosterLoading && !rosterError;
  const rosterTotal = roster.length;
  const rosterInactiveCount = rosterTotal - rosterActiveCount;
  const blackBelts = roster.filter((m) => m.is_black_belt);
  const blackBeltTotal = blackBelts.length;
  const blackBeltPaidCount = blackBelts.filter((m) => m.financeiro === "em_dia").length;
  const blackBeltOverdueCount = blackBelts.filter((m) => m.financeiro === "atrasado").length;
  // Uma casa decimal só quando necessário (22% em vez de 22,0%; 22,1% quando não é redondo).
  const fmtPctSmart = (v: number) => {
    const rounded = Math.round(v * 1000) / 10; // fração 0..1 → %, 1 casa
    return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1).replace(".", ",")}%`;
  };
  const blackBeltPaidLabel = blackBeltTotal > 0
    ? `${fmtPctSmart(blackBeltPaidCount / blackBeltTotal)} com anuidade paga (${blackBeltPaidCount} de ${blackBeltTotal})`
    : "—";

  // b6: voltar para a lista de dojôs. router.back() quando há histórico de
  // navegação (ex.: veio da lista); fallback para a rota da lista quando a
  // tela foi aberta direto (deep link / refresh).
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.push("/karate/dojos" as any);
  };

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Voltar para dojôs">
          <Icon name="chevron-back" size={16} color={C.ink2} />
          <Text style={styles.backBtnTxt}>Dojôs</Text>
        </TouchableOpacity>

        <View style={styles.head}>
          <View style={{ flex: 1, minWidth: 240 }}>
            <Eyebrow>Detalhe · {data.fpkt_affiliation_id}</Eyebrow>
            <H1 dot style={{ marginTop: 12 }}>{data.name}</H1>
            <Body muted style={{ marginTop: 12 }}>{data.region || "—"} · {MODEL_LABEL[data.affiliation_model] ?? "—"}</Body>
          </View>
          <View style={styles.headActions}>
            <ShojiBadge dojoStatus={data.status} />
            <View style={styles.headBtns}>
              {/* Item 2 (overflow do header): só os primários ficam soltos —
                  Ver praticantes + Editar. O resto (Exportar, Solicitar
                  atualização cadastral, Suspender, Excluir dojô) foi para o
                  menu kebab abaixo, MESMOS handlers/estados de antes. */}
              <ShojiButton
                label="Ver praticantes"
                icon="people-outline"
                variant="ghost"
                onPress={() => router.push(("/karate/praticantes?dojo_id=" + encodeURIComponent(dojoId!)) as any)}
              />
              <ShojiButton label="Editar" icon="create-outline" variant="ghost" onPress={() => setEditOpen(true)} />

              <TouchableOpacity
                ref={kebabRef}
                style={styles.kebabBtn}
                onPress={openOverflowMenu}
                accessibilityRole="button"
                accessibilityLabel="Mais ações"
              >
                <Icon name="ellipsis-vertical" size={16} color={C.ink} />
              </TouchableOpacity>

              <HeaderOverflowMenu
                visible={overflowOpen}
                position={overflowPos}
                onClose={() => setOverflowOpen(false)}
                items={[
                  { type: "action", key: "export", label: "Exportar", icon: "download-outline", onPress: () => setExportOpen(true) },
                  {
                    type: "action", key: "roster",
                    label: requestingRoster ? "Solicitando..." : "Solicitar atualização cadastral",
                    icon: "refresh", onPress: requestRosterUpdate, disabled: requestingRoster,
                  },
                  { type: "divider", key: "div-danger" },
                  {
                    type: "action", key: "suspend",
                    label: isSuspended ? "Reativar dojô" : "Suspender dojô",
                    icon: "power", onPress: onSuspendPress, disabled: busy,
                    // Só entra vermelho quando a ação é destrutiva (suspender);
                    // reativar continua neutro.
                    destructive: !isSuspended,
                  },
                  {
                    type: "action", key: "delete", label: "Excluir dojô", icon: "trash",
                    onPress: deleteDojo, disabled: busy, destructive: true,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Banner de estado da validação do quadro — GET roster-validation.
            pending: link + copiar/whatsapp (com pulse no "Copiar link").
            validated: nota discreta com check em scale-in. Componente
            extraído — ver components/karate/RosterValidationBanner.tsx. */}
        {rosterValidation?.status === "pending" || rosterValidation?.status === "validated" ? (
          <RosterValidationBanner
            status={rosterValidation.status}
            requestedAtLabel={fmtDate(rosterValidation.requested_at)}
            validatedAtLabel={fmtDate(rosterValidation.validated_at)}
            validatedBy={rosterValidation.validated_by}
            url={rosterValidation.url}
            onCopyLink={copyRosterLink}
            onShareWhatsApp={shareRosterLinkWhatsApp}
          />
        ) : null}

        {/* DJ2: card Cadastro — "Sensei responsável" em vez de "CPF do sensei" */}
        <Card style={{ marginTop: SP[6] }}>
          <SectionHead title="Cadastro" />
          <KV k="Nome do dojô" v={data.name} />
          <KV k="Código FPKT" v={data.fpkt_affiliation_id} />
          <KV k="CNPJ" v={data.cnpj} />
          <View style={styles.senseiRow}>
            <KV k="Sensei responsável" v={senseiDisplay} />
            {senseiIsPractitioner && senseiDisplay ? (
              <View style={styles.senseiChip}>
                <Icon name="person" size={11} color={C.ink2} />
                <Text style={styles.senseiChipTxt}>praticante vinculado</Text>
              </View>
            ) : null}
          </View>
          <KV k="Telefone" v={data.phone} />
          <KV k="E-mail" v={data.email} />
          <KV k="Região" v={data.region} />
          <KV k="Fundação" v={data.dojo_founded_year ? String(data.dojo_founded_year) : null} />
          <KV k="Filiação desde" v={fmtDate(data.affiliation_since)} />
          <KV k="Modelo" v={MODEL_LABEL[data.affiliation_model] ?? null} />
          {/* Fase 5 / DJ-seg: fonte coerente com a seção Praticantes abaixo — usa a
              contagem do standing (MESMO estado já buscado por getDojoMembersStanding,
              sem 2ª chamada) quando disponível; cai para o campo do GET /dojo enquanto
              o roster carrega ou se ele falhar — nunca mostra ativos/inativos "chutados". */}
          {rosterHasData ? (
            <View style={styles.praticantesRow}>
              <Text style={styles.praticantesKey}>Praticantes</Text>
              <View style={styles.praticantesValCol}>
                <Text style={styles.praticantesValNum}>{rosterTotal}</Text>
                {rosterTotal > 0 ? (
                  <Text style={styles.praticantesSeg}>
                    <Text style={styles.praticantesSegOk}>{rosterActiveCount} ativo{rosterActiveCount === 1 ? "" : "s"}</Text>
                    <Text style={styles.praticantesSegDot}> · </Text>
                    <Text style={styles.praticantesSegMuted}>{rosterInactiveCount} inativo{rosterInactiveCount === 1 ? "" : "s"}</Text>
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <KV k="Praticantes" v={String(data.practitioner_count)} />
          )}
        </Card>

        {/* Endereço — estruturado ou texto legado */}
        <Card style={{ marginTop: SP[6] }}>
          <SectionHead title="Endereço" sub="Usado no envio de certificados e carteirinhas" />
          {hasStructuredAddress ? (
            <>
              <KV k="Logradouro" v={streetLine} />
              <KV k="Complemento" v={data.address_complement} />
              <KV k="Bairro" v={data.address_neighborhood} />
              <KV k="Cidade / UF" v={cityLine} />
              <KV k="CEP" v={cepLine} />
            </>
          ) : data.address ? (
            <KV k="Endereço" v={data.address} />
          ) : (
            <Body muted>Endereço não informado.</Body>
          )}
        </Card>

        <Card style={{ marginTop: SP[6] }}>
          <SectionHead
            title="Equipe técnica"
            sub="Sensei responsável + corpo de auxiliares"
            actions={<ShojiButton label="Gerir equipe" icon="settings-outline" variant="ghost" onPress={() => setTeamOpen(true)} />}
          />
          {data.technical_team.length === 0 ? <Body muted>Nenhum membro técnico cadastrado.</Body>
            : data.technical_team.map((m, i) => (
              <View key={m.practitioner_id} style={[styles.teamRow, i === data.technical_team.length - 1 && styles.noBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{m.name}</Text>
                  <Body muted style={{ fontSize: 11.5, marginTop: 2 }}>{m.roles.map((r) => ROLE_LABEL[r] ?? r).join(" · ") || "Membro"}</Body>
                </View>
                <BeltTag level={m.belt_level} />
              </View>
            ))}
        </Card>

        {/* Fase 4/5 — Roster do dojô: praticantes com 2 badges (status + financeiro),
            quebra Total/Ativos/Inativos e faixas-pretas com % de anuidade em dia. */}
        <Card style={{ marginTop: SP[6] }}>
          <SectionHead
            title="Praticantes"
            sub={rosterHasData ? `${rosterTotal} cadastrado${rosterTotal === 1 ? "" : "s"}` : undefined}
          />
          {rosterLoading ? (
            <View>
              {[1, 2, 3].map((k) => <Skeleton key={k} height={40} style={{ marginBottom: 8 }} />)}
            </View>
          ) : rosterError ? (
            <KarateErrorState
              title="Não foi possível carregar os praticantes"
              message="Verifique sua conexão e tente novamente."
              onRetry={loadRoster}
            />
          ) : roster.length === 0 ? (
            <KarateEmptyState
              icon="people-outline"
              title="Nenhum praticante neste dojô"
              subtitle="Praticantes cadastrados neste dojô aparecerão aqui, com status e situação financeira."
            />
          ) : (
            <>
              {/* Fase 5: Total / Ativos / Inativos — mesma fonte (roster) dos badges por linha. */}
              <KpiBand
                items={[
                  { label: "Total", value: rosterTotal },
                  { label: "Ativos", value: rosterActiveCount },
                  { label: "Inativos", value: rosterInactiveCount },
                ]}
                style={{ marginBottom: SP[5] }}
              />

              {/* Fase 5: faixas-pretas — total do dojô + % com a anuidade da
                  federação em dia (financeiro === 'em_dia'). "—" quando não há
                  faixa-preta cadastrada (evita divisão por zero e % falso). */}
              <View style={styles.blackBeltBlock}>
                <Text style={styles.blackBeltLine} numberOfLines={1}>
                  Faixas-pretas: {blackBeltTotal} · {blackBeltPaidLabel}
                </Text>
                {blackBeltTotal > 0 ? (
                  <View style={{ marginTop: 8 }}>
                    <BarRow label="Anuidade em dia" value={blackBeltPaidCount} max={blackBeltTotal} color={P.ok} />
                    <BarRow label="Atrasado" value={blackBeltOverdueCount} max={blackBeltTotal} color={P.danger} />
                  </View>
                ) : null}
              </View>

              {roster.map((m, i) => (
              <View key={m.student_id} style={[styles.rosterRow, i === roster.length - 1 && styles.noBorder]}>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Text style={styles.rosterName}>{m.full_name}</Text>
                  <Body muted style={{ fontSize: 11.5, marginTop: 2 }}>
                    {m.karate_registration_number || "Sem matrícula"}
                  </Body>
                </View>
                {m.belt_level ? <BeltBadge beltLevel={m.belt_level} beltName={m.belt_name || undefined} /> : null}
                <View style={styles.rosterBadges}>
                  <Badge status={m.is_active ? "ok" : "neutral"} label={m.is_active ? "Ativo" : "Inativo"} />
                  {m.is_black_belt && m.financeiro === "em_dia" ? (
                    <Badge status="ok" label="Em dia" />
                  ) : null}
                  {m.is_black_belt && m.financeiro === "atrasado" ? (
                    <Badge status="danger" label="Atrasado" />
                  ) : null}
                </View>
              </View>
              ))}
            </>
          )}
        </Card>

        {/* Fase 2: seção Documentos (anexos) — mesmo gate de edição das ações da federação */}
        <Card style={{ marginTop: SP[6] }}>
          <SectionHead title="Documentos" sub="Anexos do dojô (contratos, comprovantes, etc.)" />
          <DocumentosSection
            federationId={federationId}
            ownerType="dojos"
            ownerId={dojoId!}
            canEdit={canManage}
          />
        </Card>

        {/* DJ4: seção Anuidades com "Lançar pagamento" no topo */}
        <Card style={{ marginTop: SP[6] }}>
          <View style={styles.annuityHead}>
            <SectionHead title="Anuidades" sub="Editar ou registrar pagamentos" />
            <TouchableOpacity
              style={styles.launchBtn}
              onPress={() => setRegisterModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Lançar pagamento de anuidade"
            >
              <Icon name="add" size={13} color={C.ink} />
              <Text style={styles.launchBtnTxt}>Lançar pagamento</Text>
            </TouchableOpacity>
          </View>
          {data.annuity_history.length === 0 ? <Body muted>Nenhuma anuidade registrada.</Body>
            : (data.annuity_history as AnnuityRow[]).map((a, i) => {
              const id = annuityId(a);
              const canActUnpaid = !a.paid_at;
              return (
                <View key={id || i} style={[styles.annRow, i === data.annuity_history.length - 1 && styles.noBorder]}>
                  <Mono style={{ fontSize: 14, color: C.ink, width: 56 }}>{a.reference_period}</Mono>
                  <View style={{ flex: 1 }}>
                    {a.paid_at ? <Text style={styles.paid}>Pago em {fmtDate(a.paid_at)}</Text> : <Text style={styles.due}>Em aberto</Text>}
                  </View>
                  <Mono style={{ fontSize: 13.5, color: C.ink2 }}>{fmtMoney(a.amount)}</Mono>
                  <ShojiBadge dojoStatus={a.status} />
                  {id ? (
                    <View style={styles.annActions}>
                      {/* DJ4: Registrar pagamento — só se não pago */}
                      {canActUnpaid ? (
                        <TouchableOpacity
                          style={[styles.annBtn, styles.annBtnPay]}
                          disabled={busy}
                          onPress={() => setPayModal(a)}
                          accessibilityLabel="Registrar pagamento"
                        >
                          <Icon name="checkmark" size={13} color={P.ok ?? "#2d8a4e"} />
                        </TouchableOpacity>
                      ) : null}
                      {/* Editar — só se não pago */}
                      {canActUnpaid ? (
                        <TouchableOpacity style={styles.annBtn} disabled={busy} onPress={() => setAnnuityEdit(a)} accessibilityLabel="Editar anuidade">
                          <Icon name="edit" size={13} color={C.ink} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
        </Card>
      </ScrollView>

      {/* Modal de edição da ficha */}
      <DojoFichaModal
        federationId={federationId}
        visible={editOpen}
        dojoId={dojoId!}
        onClose={() => setEditOpen(false)}
        onSaved={() => load()}
      />

      {/* Modal de exportação */}
      <DojoExportModal
        federationId={federationId}
        visible={exportOpen}
        dojoId={dojoId!}
        dojoName={data.name}
        fpktId={data.fpkt_affiliation_id}
        onClose={() => setExportOpen(false)}
      />

      {/* F9: Modal de gestão da equipe técnica (papéis is_arbiter/is_instructor/is_examiner/is_assistant) */}
      <GerirEquipeTecnicaModal
        visible={teamOpen}
        onClose={() => setTeamOpen(false)}
        federationId={federationId}
        dojoId={dojoId!}
        dojoName={data.name}
        currentTeamIds={data.technical_team.map((m) => m.practitioner_id)}
        onSaved={() => { load(); }}
      />

      {/* Diálogo de escolha ao inativar o dojô: Inativar todos vs. Redistribuir.
          A contagem de praticantes ativos (rosterActiveCount) já serve como a
          confirmação explícita exigida para ações irreversíveis. Componente
          extraído — ver components/karate/InactivateChoiceDialog.tsx (dois
          tiles grandes com hover-lift + entrada scale-in). */}
      <InactivateChoiceDialog
        visible={choiceOpen}
        onClose={() => !busy && setChoiceOpen(false)}
        busy={busy}
        dojoName={data.name}
        activeCount={rosterActiveCount}
        hasChoice={rosterHasData && rosterActiveCount > 0}
        onInactivateAll={inactivateAllAndSuspend}
        onRedistribute={() => { setChoiceOpen(false); setRedistribOpen(true); }}
        reducedMotion={reducedMotion}
      />

      {/* Redistribuir: tabela editável — uma linha por praticante ativo, com
          seletor Destino (Inativar por padrão, ou → outro dojô). Confirma
          via POST redistribute (decisions + inactivate_dojo:true). */}
      <RedistribuirPraticantesModal
        visible={redistribOpen}
        onClose={() => setRedistribOpen(false)}
        federationId={federationId}
        dojoId={dojoId!}
        dojoName={data.name}
        practitioners={roster.filter((m) => m.is_active)}
        onSuccess={onRedistributeSuccess}
      />

      {/* Modal HAS_HISTORY */}
      <Modal visible={!!histModal} transparent animationType="fade" onRequestClose={() => setHistModal(null)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && setHistModal(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>空  FPKT · Exclusão de dojô</Text>
            <Text style={styles.modalTitle}>Este dojô tem histórico<Text style={{ color: P.red }}>.</Text></Text>
            <Text style={styles.modalBody}>
              Não dá para excluir direto porque há registros vinculados. Você pode
              desativar (mantém os dados, some das listas ativas) ou excluir tudo
              em cascata — irreversível.
            </Text>

            {histModal ? (
              <View style={styles.countsBox}>
                {Object.entries(histModal)
                  .filter(([, n]) => Number(n) > 0)
                  .map(([k, n]) => (
                    <View key={k} style={styles.countRow}>
                      <Mono style={styles.countNum}>{String(n)}</Mono>
                      <Text style={styles.countLbl}>{COUNT_LABEL[k] || k}</Text>
                    </View>
                  ))}
                {Object.values(histModal).every((n) => Number(n) === 0) ? (
                  <Text style={styles.countLbl}>Registros vinculados encontrados.</Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.primaryBtn, busy && styles.btnDisabled]} disabled={busy} onPress={desativarFromModal}>
                {busy ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={styles.primaryBtnTxt}>Desativar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerBtnWide, busy && styles.btnDisabled]} disabled={busy} onPress={excluirDefinitivo}>
                <Icon name="trash" size={14} color="#fdf8f2" />
                <Text style={styles.dangerBtnTxt}>Excluir definitivamente</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} disabled={busy} onPress={() => setHistModal(null)}>
                <Text style={styles.ghostBtnTxt}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de edição de anuidade (valor / vencimento / competência) */}
      <AnnuityEditModal
        visible={!!annuityEdit}
        row={annuityEdit}
        busy={busy}
        onClose={() => setAnnuityEdit(null)}
        onSave={async (payload) => {
          const id = annuityEdit ? annuityId(annuityEdit) : null;
          if (!id) return;
          setBusy(true);
          try {
            await karateApi.updateAnnuity(federationId, dojoId!, id, payload);
            setAnnuityEdit(null);
            showToast("Anuidade atualizada");
            load();
          } catch (e: any) {
            Alert.alert("Não foi possível salvar", e?.message || "Tente novamente.");
          } finally { setBusy(false); }
        }}
      />

      {/* DJ4: Modal "Registrar pagamento" — baixa manual de cobrança existente */}
      <PayAnnuityModal
        visible={!!payModal}
        row={payModal}
        busy={busy}
        onClose={() => setPayModal(null)}
        onSave={async (payload) => {
          const id = payModal ? annuityId(payModal) : null;
          if (!id) return;
          setBusy(true);
          try {
            await karateApi.payAnnuity(federationId, dojoId!, id, payload);
            setPayModal(null);
            showToast("Pagamento registrado");
            load();
          } catch (e: any) {
            Alert.alert("Não foi possível registrar", e?.message || "Tente novamente.");
          } finally { setBusy(false); }
        }}
      />

      {/* DJ4: Modal "Lançar pagamento" — período já pago sem cobrança prévia */}
      <RegisterPaymentModal
        visible={registerModal}
        busy={busy}
        onClose={() => setRegisterModal(false)}
        onSave={async (payload) => {
          setBusy(true);
          try {
            await karateApi.registerAnnuityPayment(federationId, dojoId!, payload);
            setRegisterModal(false);
            showToast("Pagamento lançado");
            load();
          } catch (e: any) {
            Alert.alert("Não foi possível lançar", e?.message || "Tente novamente.");
          } finally { setBusy(false); }
        }}
      />

      {/* Toast inline */}
      {toast ? (
        <Animated.View pointerEvents="none" style={[styles.toast, {
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }]}>
          <Icon name="check" size={16} color="#bfe3c4" />
          <Text style={styles.toastTxt}>{toast}</Text>
        </Animated.View>
      ) : null}
    </ShojiBackground>
  );
}

// ── Modal de edição de anuidade (valor / vencimento / competência) ─────
function AnnuityEditModal({ visible, row, busy, onClose, onSave }: {
  visible: boolean;
  row: AnnuityRow | null;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: { amount?: number; due_date?: string; reference_period?: string }) => void;
}) {
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [ref, setRef] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !row) return;
    setErr(null);
    setAmount(row.amount != null ? String(row.amount).replace(".", ",") : "");
    setDue(isoToBr(row.due_date));
    setRef(row.reference_period || "");
  }, [visible, row]);

  function submit() {
    setErr(null);
    const payload: { amount?: number; due_date?: string; reference_period?: string } = {};
    if (amount.trim()) {
      const n = Number(amount.replace(/\./g, "").replace(",", "."));
      if (!isFinite(n) || n <= 0) { setErr("Valor inválido."); return; }
      payload.amount = n;
    }
    if (due.trim()) {
      const iso = brToISO(due);
      if (!iso) { setErr("Vencimento inválido (dd/mm/aaaa)."); return; }
      payload.due_date = iso;
    }
    if (ref.trim()) payload.reference_period = ref.trim();
    if (Object.keys(payload).length === 0) { setErr("Nada para alterar."); return; }
    onSave(payload);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && onClose()} />
        <View style={styles.modalCard}>
          <Text style={styles.modalEyebrow}>空  FPKT · Editar anuidade</Text>
          <Text style={styles.modalTitle}>{row?.reference_period || "Anuidade"}<Text style={{ color: P.red }}>.</Text></Text>

          <Text style={styles.fieldLbl}>Valor (R$)</Text>
          <TextInput style={[styles.input, styles.mono]} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="500,00" placeholderTextColor={P.ink4} accessibilityLabel="Valor" />

          <Text style={styles.fieldLbl}>Vencimento</Text>
          <TextInput style={[styles.input, styles.mono]} value={due} onChangeText={(v) => setDue(maskDate(v))} keyboardType="numeric" placeholder="dd/mm/aaaa" placeholderTextColor={P.ink4} maxLength={10} accessibilityLabel="Vencimento" />

          <Text style={styles.fieldLbl}>Competência</Text>
          <TextInput style={styles.input} value={ref} onChangeText={setRef} placeholder="Ex.: 2026" placeholderTextColor={P.ink4} accessibilityLabel="Competência" />

          {err ? <Text style={styles.errTxt}>{err}</Text> : null}

          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.primaryBtn, busy && styles.btnDisabled]} disabled={busy} onPress={submit}>
              {busy ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={styles.primaryBtnTxt}>Salvar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} disabled={busy} onPress={onClose}>
              <Text style={styles.ghostBtnTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── DJ4: Modal "Registrar pagamento" — baixa manual de cobrança existente ──
function PayAnnuityModal({ visible, row, busy, onClose, onSave }: {
  visible: boolean;
  row: AnnuityRow | null;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: { paid_at?: string; payment_method?: PaymentMethod; amount?: number }) => void;
}) {
  const [paidAt, setPaidAt] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    setPaidAt(todayBr());
    setMethod("pix");
    setAmount(row?.amount != null ? String(row.amount).replace(".", ",") : "");
  }, [visible, row]);

  function submit() {
    setErr(null);
    const payload: { paid_at?: string; payment_method?: PaymentMethod; amount?: number } = {};
    if (paidAt.trim()) {
      const iso = brToISO(paidAt);
      if (!iso) { setErr("Data inválida (dd/mm/aaaa)."); return; }
      payload.paid_at = iso;
    }
    payload.payment_method = method;
    if (amount.trim()) {
      const n = Number(amount.replace(/\./g, "").replace(",", "."));
      if (!isFinite(n) || n <= 0) { setErr("Valor inválido."); return; }
      payload.amount = n;
    }
    onSave(payload);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && onClose()} />
        <View style={styles.modalCard}>
          <Text style={styles.modalEyebrow}>空  FPKT · Registrar pagamento</Text>
          <Text style={styles.modalTitle}>{row?.reference_period || "Anuidade"}<Text style={{ color: P.red }}>.</Text></Text>

          <Text style={styles.fieldLbl}>Data do pagamento</Text>
          <TextInput style={[styles.input, styles.mono]} value={paidAt} onChangeText={(v) => setPaidAt(maskDate(v))} keyboardType="numeric" placeholder="dd/mm/aaaa" placeholderTextColor={P.ink4} maxLength={10} accessibilityLabel="Data do pagamento" />

          <Text style={styles.fieldLbl}>Forma de pagamento</Text>
          <View style={styles.pmChips}>
            {PM_LABELS.map((pm) => (
              <TouchableOpacity
                key={pm.value}
                style={[styles.pmChip, method === pm.value && styles.pmChipActive]}
                onPress={() => setMethod(pm.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: method === pm.value }}
              >
                <Text style={[styles.pmChipTxt, method === pm.value && styles.pmChipTxtActive]}>{pm.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLbl}>Valor recebido (R$) <Text style={styles.fieldOptional}>opcional</Text></Text>
          <TextInput style={[styles.input, styles.mono]} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="500,00" placeholderTextColor={P.ink4} accessibilityLabel="Valor" />

          {err ? <Text style={styles.errTxt}>{err}</Text> : null}

          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.primaryBtn, busy && styles.btnDisabled]} disabled={busy} onPress={submit}>
              {busy ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={styles.primaryBtnTxt}>Confirmar pagamento</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} disabled={busy} onPress={onClose}>
              <Text style={styles.ghostBtnTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── DJ4: Modal "Lançar pagamento" — período já pago sem cobrança prévia ────
function RegisterPaymentModal({ visible, busy, onClose, onSave }: {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: { reference_period: string; amount: number; paid_at?: string; payment_method?: PaymentMethod }) => void;
}) {
  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    setPeriod("");
    setAmount("");
    setPaidAt(todayBr());
    setMethod("pix");
  }, [visible]);

  function submit() {
    setErr(null);
    if (!period.trim()) { setErr("Informe a competência (ex.: 2026)."); return; }
    const n = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!amount.trim() || !isFinite(n) || n <= 0) { setErr("Informe o valor."); return; }
    const payload: { reference_period: string; amount: number; paid_at?: string; payment_method?: PaymentMethod } = {
      reference_period: period.trim(),
      amount: n,
      payment_method: method,
    };
    if (paidAt.trim()) {
      const iso = brToISO(paidAt);
      if (!iso) { setErr("Data inválida (dd/mm/aaaa)."); return; }
      payload.paid_at = iso;
    }
    onSave(payload);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && onClose()} />
        <View style={styles.modalCard}>
          <Text style={styles.modalEyebrow}>空  FPKT · Lançar pagamento</Text>
          <Text style={styles.modalTitle}>Período já pago<Text style={{ color: P.red }}>.</Text></Text>
          <Text style={styles.modalBody}>
            Use para registrar um pagamento recebido via PIX estática quando não havia cobrança prévia no sistema.
          </Text>

          <Text style={styles.fieldLbl}>Competência <Text style={styles.fieldRequired}>*</Text></Text>
          <TextInput style={styles.input} value={period} onChangeText={setPeriod} placeholder="Ex.: 2026" placeholderTextColor={P.ink4} accessibilityLabel="Competência" />

          <Text style={styles.fieldLbl}>Valor (R$) <Text style={styles.fieldRequired}>*</Text></Text>
          <TextInput style={[styles.input, styles.mono]} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="500,00" placeholderTextColor={P.ink4} accessibilityLabel="Valor" />

          <Text style={styles.fieldLbl}>Data do pagamento</Text>
          <TextInput style={[styles.input, styles.mono]} value={paidAt} onChangeText={(v) => setPaidAt(maskDate(v))} keyboardType="numeric" placeholder="dd/mm/aaaa" placeholderTextColor={P.ink4} maxLength={10} accessibilityLabel="Data do pagamento" />

          <Text style={styles.fieldLbl}>Forma de pagamento</Text>
          <View style={styles.pmChips}>
            {PM_LABELS.map((pm) => (
              <TouchableOpacity
                key={pm.value}
                style={[styles.pmChip, method === pm.value && styles.pmChipActive]}
                onPress={() => setMethod(pm.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: method === pm.value }}
              >
                <Text style={[styles.pmChipTxt, method === pm.value && styles.pmChipTxtActive]}>{pm.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {err ? <Text style={styles.errTxt}>{err}</Text> : null}

          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.primaryBtn, busy && styles.btnDisabled]} disabled={busy} onPress={submit}>
              {busy ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={styles.primaryBtnTxt}>Lançar pagamento</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} disabled={busy} onPress={onClose}>
              <Text style={styles.ghostBtnTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Item 2: menu de overflow do header (kebab) ─────────────────────────
// Popover ancorado no botão via measureInWindow, dentro de um Modal
// transparent (mesmo primitivo dos demais diálogos desta tela — funciona
// igual em web/nativo) para capturar o clique-fora e fechar. Reaproveita o
// ModalPop (scale+fade) já usado em InactivateChoiceDialog/Destino. Nenhum
// handler muda de comportamento — só reorganiza a apresentação.
function HeaderOverflowMenu({
  visible, position, onClose, items,
}: {
  visible: boolean;
  position: { top: number; left: number } | null;
  onClose: () => void;
  items: OverflowMenuItem[];
}) {
  if (!position) return null;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Fechar menu de ações"
      />
      <ModalPop
        visible={visible}
        duration={140}
        style={[overflowStyles.menu, { top: position.top, left: position.left }]}
      >
        <View accessibilityRole="menu">
          {items.map((it) =>
            it.type === "divider" ? (
              <View key={it.key} style={overflowStyles.divider} />
            ) : (
              <OverflowMenuRow
                key={it.key}
                item={it}
                onSelect={() => { onClose(); it.onPress(); }}
              />
            )
          )}
        </View>
      </ModalPop>
    </Modal>
  );
}

function OverflowMenuRow({ item, onSelect }: {
  item: Extract<OverflowMenuItem, { type: "action" }>;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const tone = item.destructive ? P.red : C.ink;
  return (
    <Pressable
      onPress={item.disabled ? undefined : onSelect}
      disabled={item.disabled}
      onHoverIn={MENU_IS_WEB ? () => setHovered(true) : undefined}
      onHoverOut={MENU_IS_WEB ? () => setHovered(false) : undefined}
      accessibilityRole="menuitem"
      accessibilityLabel={item.label}
      accessibilityState={{ disabled: !!item.disabled }}
      style={[
        overflowStyles.item,
        hovered && !item.disabled && (item.destructive ? overflowStyles.itemHoverDanger : overflowStyles.itemHover),
        item.disabled && overflowStyles.itemDisabled,
      ]}
    >
      <Icon name={item.icon as any} size={15} color={item.disabled ? P.ink4 : tone} />
      <Text style={[overflowStyles.itemTxt, { color: item.disabled ? P.ink4 : tone }]}>{item.label}</Text>
    </Pressable>
  );
}

const overflowStyles = StyleSheet.create({
  menu: {
    position: "absolute",
    width: OVERFLOW_MENU_WIDTH,
    backgroundColor: P.paper,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: P.line2,
    paddingVertical: 6,
    ...(Platform.OS === "web" ? ({ boxShadow: "0 1px 2px rgba(43,38,32,0.06), 0 18px 40px -20px rgba(43,38,32,0.45)" } as any) : null),
  } as ViewStyle,
  divider: { height: 1, backgroundColor: P.line, marginVertical: 6, marginHorizontal: 8 } as ViewStyle,
  item: {
    flexDirection: "row", alignItems: "center", gap: 10,
    minHeight: 40, paddingVertical: 9, paddingHorizontal: 14,
  } as ViewStyle,
  itemHover: { backgroundColor: P.glass2 } as ViewStyle,
  itemHoverDanger: { backgroundColor: P.redWash } as ViewStyle,
  itemDisabled: { opacity: 0.5 } as ViewStyle,
  itemTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600" } as TextStyle,
});

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 48, paddingBottom: 72, maxWidth: 920, width: "100%", alignSelf: "center" } as ViewStyle,
  // b6: botão de voltar Shoji (icon + texto), acima do head.
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 18, paddingVertical: 4, paddingRight: 8 } as ViewStyle,
  backBtnTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink2 } as TextStyle,
  head: { flexDirection: "row", alignItems: "flex-start", gap: 16, flexWrap: "wrap" } as ViewStyle,
  headActions: { alignItems: "flex-end", gap: 10 } as ViewStyle,
  headBtns: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" } as ViewStyle,
  teamRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  noBorder: { borderBottomWidth: 0 } as ViewStyle,
  teamName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  rosterRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  rosterName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  rosterBadges: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  // Fase 5 — bloco de resumo das faixas-pretas (texto + BarRow em dia/atrasado).
  blackBeltBlock: { paddingVertical: 4, marginBottom: SP[5], borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: SP[5] } as ViewStyle,
  blackBeltLine: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink } as TextStyle,
  annRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  paid: { fontFamily: F.body, fontSize: 11.5, color: C.ok } as TextStyle,
  due: { fontFamily: F.body, fontSize: 11.5, color: C.alert } as TextStyle,

  // Banner de validação do quadro (pending) — icon + título + link/ações.
  validationRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  validationTitle: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink } as TextStyle,
  validationLinkRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 } as ViewStyle,
  validationLink: { fontFamily: F.mono, fontSize: 12, color: C.ink2, flexShrink: 1, minWidth: 120, maxWidth: 320 } as TextStyle,
  validationBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2 } as ViewStyle,
  validationBtnTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink } as TextStyle,

  // DJ2: chip "praticante vinculado" ao lado do sensei
  senseiRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" } as ViewStyle,
  senseiChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line2, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginTop: 2 } as ViewStyle,
  senseiChipTxt: { fontFamily: F.body, fontSize: 10.5, color: C.ink2 } as TextStyle,

  // DJ-seg: linha "Praticantes" do card Cadastro com segmentação ativos/inativos
  // (mesma fonte do roster usado na seção Praticantes abaixo — sem 2ª chamada).
  // Réplica visual do KV compartilhado (kvRow/kvKey/kvVal em shoji/index.tsx) com
  // uma 2ª linha discreta para não poluir a lista de KVs do card.
  praticantesRow: { flexDirection: "row", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line, gap: 16 } as ViewStyle,
  praticantesKey: { width: 140, fontFamily: F.body, fontSize: T.xs, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600" } as TextStyle,
  praticantesValCol: { flex: 1 } as ViewStyle,
  praticantesValNum: { fontFamily: F.body, fontSize: T.body, color: C.ink } as TextStyle,
  praticantesSeg: { fontFamily: F.body, fontSize: 11.5, marginTop: 2 } as TextStyle,
  praticantesSegOk: { color: C.ok, fontWeight: "600" } as TextStyle,
  praticantesSegMuted: { color: C.ink3, fontWeight: "600" } as TextStyle,
  praticantesSegDot: { color: C.ink4 } as TextStyle,

  // DJ4: cabeçalho da seção anuidades com botão "Lançar pagamento"
  annuityHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 } as ViewStyle,
  launchBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2 } as ViewStyle,
  launchBtnTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: C.ink } as TextStyle,

  // Ações de anuidade (linha)
  annActions: { flexDirection: "row", gap: 6, marginLeft: 4 } as ViewStyle,
  annBtn: { width: 30, height: 30, borderRadius: R.sm, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  annBtnPay: { borderColor: "#b7e0c2", backgroundColor: "#f0faf2" } as ViewStyle,

  // Chips de forma de pagamento
  pmChips: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 } as ViewStyle,
  pmChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2 } as ViewStyle,
  pmChipActive: { borderColor: P.ink, backgroundColor: P.ink } as ViewStyle,
  pmChipTxt: { fontFamily: F.body, fontSize: 13, color: C.ink } as TextStyle,
  pmChipTxtActive: { color: "#fdf8f2" } as TextStyle,

  // Campo labels
  fieldOptional: { fontWeight: "400", color: P.ink3, fontFamily: F.body } as TextStyle,
  fieldRequired: { color: P.red, fontFamily: F.body } as TextStyle,

  // Botão kebab do header (Item 2 — abre o menu de overflow)
  kebabBtn: { width: 38, height: 38, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  // dangerBtnTxt segue usado no modal HAS_HISTORY ("Excluir definitivamente").
  dangerBtnTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
  btnDisabled: { opacity: 0.5 } as ViewStyle,

  // Modais in-app
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 16 } as ViewStyle,
  modalCard: { backgroundColor: P.paper, borderRadius: R.xl, borderWidth: 1, borderColor: P.line2, padding: 22, width: "100%", maxWidth: 460 } as ViewStyle,
  modalEyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  modalTitle: { fontFamily: F.heading, fontSize: 24, color: P.ink, marginTop: 4 } as TextStyle,
  modalBody: { fontFamily: F.body, fontSize: 13, color: P.ink2, marginTop: 8, lineHeight: 19 } as TextStyle,

  countsBox: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 } as ViewStyle,
  countRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: P.paper3, borderWidth: 1, borderColor: P.line, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 } as ViewStyle,
  countNum: { fontFamily: F.mono, fontSize: 14, color: P.red, fontWeight: "700" } as TextStyle,
  countLbl: { fontFamily: F.body, fontSize: 12.5, color: P.ink2 } as TextStyle,

  modalActions: { gap: 10, marginTop: 20 } as ViewStyle,
  primaryBtn: { paddingVertical: 12, borderRadius: R.md, backgroundColor: P.ink, alignItems: "center" } as ViewStyle,
  primaryBtnTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
  dangerBtnWide: { flexDirection: "row", gap: 8, paddingVertical: 12, borderRadius: R.md, backgroundColor: P.red, alignItems: "center", justifyContent: "center" } as ViewStyle,
  ghostBtn: { paddingVertical: 11, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, alignItems: "center" } as ViewStyle,
  ghostBtnTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,

  // Campos dos modais de anuidade
  fieldLbl: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginTop: 12, marginBottom: 5 } as TextStyle,
  input: { fontFamily: F.body, fontSize: 14, color: P.ink, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 11 } as TextStyle,
  mono: { fontFamily: F.mono, letterSpacing: 0.5 } as TextStyle,
  errTxt: { fontFamily: F.body, fontSize: 12.5, color: P.red2, marginTop: 12 } as TextStyle,

  // Toast inline
  toast: { position: "absolute", left: 20, right: 20, bottom: 24, alignSelf: "center", maxWidth: 460, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 12, paddingHorizontal: 16 } as ViewStyle,
  toastTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: "#fdf8f2", flex: 1 } as TextStyle,
});
