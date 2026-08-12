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
//   SUSPENDER/REATIVAR e REMOVER o dojô daqui, além de EDITAR/ESTORNAR
//   anuidades lançadas.
//
// 11/08/2026 (compliance, back#485/PR#486): DELETE /federation/:id/dojos/:dojoId
//   NUNCA MAIS apaga nada — o backend responde desativando (is_active:false)
//   e preservando praticantes, graduações e histórico (retenção de 60 dias
//   pelos termos de uso). O antigo contrato HAS_HISTORY (409 com escolha entre
//   Desativar/Excluir definitivamente/cascade) SAIU: a rota agora só desativa,
//   é sempre reversível (PATCH is_active:true — mesmo botão "Reativar dojô"
//   do menu) e nunca mais devolve 409 para este endpoint. Confirmações
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
// F6 (26/07/2026): a seção Anuidades deixou de ser uma implementação
//   PARALELA (3 modais locais, API legada payAnnuity/registerAnnuityPayment,
//   fonte data.annuity_history) e passou a reusar OS MESMOS componentes da
//   aba Anuidades do hub financeiro — AnnuityReceivableRow (render de linha
//   compartilhado, extraído de AnnuitiesTable.tsx) + AnnuityReceiveModal
//   (baixa livre/FIFO) + AnnuityStatementModal (extrato) +
//   LancarAnuidadeDojoModal (lançar/editar). Dados vêm de
//   listDojoAnnuities(dojo_id=<este dojô>) — nunca mais annuity_history.
//   O antigo atalho "Lançar pagamento" (criava um período JÁ PAGO fora do
//   fluxo) saiu — ver comentário perto de chargeAnnuityOpen abaixo.
// ============================================================
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  ScrollView, View, Text, StyleSheet, ViewStyle, TextStyle, Alert, Linking,
  Modal, Pressable, TouchableOpacity, Animated, Platform, Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP, KarateType as T } from "@/constants/karateTheme";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { Badge } from "@/components/karate/Badge";
import { BeltBadge } from "@/components/karate/BeltBadge";
import {
  ShojiBackground, PageHead, SectionHead, Card, KV, ShojiBadge, BeltTag, ShojiButton, Body, Eyebrow, H1, KpiBand, BarRow, Chip,
} from "@/components/karate/shoji";
import { Icon } from "@/components/Icon";
import DojoFichaModal from "@/components/karate/DojoFichaModal";
import PraticanteFichaModal from "@/components/karate/PraticanteFichaModal";
import { RegistrarGraduacaoModal } from "@/components/karate/praticante-detalhe/RegistrarGraduacaoModal";
import DojoExportModal from "@/components/karate/DojoExportModal";
import DojoPortalLinkCard from "@/components/karate/DojoPortalLinkCard";
import GerirEquipeTecnicaModal from "@/components/karate/GerirEquipeTecnicaModal";
import RedistribuirPraticantesModal from "@/components/karate/RedistribuirPraticantesModal";
import InactivateChoiceDialog from "@/components/karate/InactivateChoiceDialog";
import RosterValidationBanner from "@/components/karate/RosterValidationBanner";
import { usePrefersReducedMotion } from "@/components/karate/anim/useReducedMotion";
import { ModalPop } from "@/components/anim/ModalPop";
import {
  karateApi, DojoDetail, DojoMemberStanding, DojoRosterSummary,
  RosterStatusFilter, RosterValidation, RosterEvent, DojoAnnuity, AnnuityReceiveResult, AnnuityStatus,
  AnnuityPaymentMethod,
} from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { canTransfer } from "@/components/karate/praticante-detalhe/helpers";
import { DocumentosSection } from "@/components/karate/DocumentosSection";
import { copyToClipboard } from "@/utils/clipboard";
import { maskPhone } from "@/utils/masks";
// F6 (26/07/2026) — anuidade do dojô vira RECEBÍVEL de verdade dentro da
// própria página, reusando EXATAMENTE os componentes canônicos da aba
// Anuidades do hub financeiro (AnnuitiesTable.tsx): mesmo render de linha
// (AnnuityReceivableRow, badge/trilha/saldo corretos — mata o bug do badge
// "Inativo" fixo que o card local antigo tinha) e os mesmos 3 modais de
// ação (Receber, Extrato, Lançar/Editar). Nenhuma 2ª implementação
// paralela — ver CLAUDE.md e o diagnóstico que motivou esta mudança.
import {
  AnnuityReceivableRow, AnnuityRowVM, toRowVM, fmtMoney, PLAN_LABEL,
} from "@/components/karate/AnnuityReceivableRow";
import { AnnuityReceiveModal } from "@/components/karate/AnnuityReceiveModal";
import { AnnuityStatementModal } from "@/components/karate/AnnuityStatementModal";
import { LancarAnuidadeDojoModal } from "@/components/karate/LancarAnuidadeDojoModal";
import { PixPaymentModal } from "@/components/karate/PixPaymentModal";
import { SendEmailBatchModal, EmailBatchTarget } from "@/components/karate/SendEmailBatchModal";
import { WhatsAppChargeModal, WhatsAppChargeTarget } from "@/components/karate/WhatsAppChargeModal";

// G2 (migration 226) — plano de anuidade REAL do dojô. "Modelo"
// (affiliation_model) foi removido de TODA superfície de leitura em
// 13/07/2026: era decorativo/legado, nunca lido por rota de cobrança, e
// chegava a contradizer esta mesma tela ("MODELO: Anual" ao lado de
// "PLANO DE ANUIDADE: Não definido"). karate_annuity_plan é a fonte única.
const ANNUITY_PLAN_LABEL: Record<string, string> = { anual: "Anual", semestral: "Semestral", trimestral: "Trimestral" };
const annuityPlanLabel = (plan: string | null | undefined): string =>
  plan ? (ANNUITY_PLAN_LABEL[plan] ?? plan) : "Não definido";
const ROLE_LABEL: Record<string, string> = { instructor: "Instrutor", arbiter: "Árbitro", examiner: "Examinador", sensei: "Sensei", senpai: "Senpai", assistant: "Auxiliar" };
// Item 2 (menu de overflow do header): mesmo padrão hover-só-web + fallback
// touch usado em InactivateChoiceDialog/RedistribuirPraticantesModal.
const MENU_IS_WEB = Platform.OS === "web";
const OVERFLOW_MENU_WIDTH = 264;
// Roster paginado no servidor (11/07/2026): 25 praticantes por página.
const ROSTER_PAGE_SIZE = 50;

type OverflowMenuItem =
  | { type: "action"; key: string; label: string; icon: string; onPress: () => void; destructive?: boolean; disabled?: boolean }
  | { type: "divider"; key: string };
const fmtDate = (iso: string | null) => { if (!iso) return null; const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }); };

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

// dd/mm/aaaa <- YYYY-MM-DD — ainda usado por RosterUpdatesSection
// (fmtEventValue, birth_date). A máscara/parse inversos (maskDate/
// brToISO/todayBr) saíram daqui — eram só dos 3 modais locais de
// anuidade removidos na F6 (ver AnnuityReceiveModal/DateInput.tsx, que
// já têm o próprio par maskBrDate/parseBrDate).
function isoToBr(v: string | null | undefined): string {
  if (!v) return "";
  const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// F6 — annuity_history / AnnuityRow (tipo local) e annuityId() saíram
// daqui: a seção de Anuidades agora busca DojoAnnuity[] via
// listDojoAnnuities(dojo_id=...) — o mesmo shape/rota da aba Anuidades do
// hub financeiro — em vez do array legado data.annuity_history (fonte
// paralela e desatualizada, com o bug do badge "Inativo" fixo).

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
  // Ficha do PRATICANTE (nome clicavel no roster) - mesmo padrao de estado
  // usado em app/karate/(federation)/praticantes/index.tsx ({ open, id }),
  // reaproveitando o MESMO PraticanteFichaModal (modo edicao). onSaved chama
  // loadRoster() - o mesmo refetch que o toggle de status ja usa.
  const [practitionerFicha, setPractitionerFicha] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  // Faixa clicável no roster (pedido do Caio, 23/07/2026) — gêmeo do nome
  // clicável (22/07/2026). Abre o MESMO RegistrarGraduacaoModal usado na aba
  // Trajetória da ficha do praticante (TrajetoriaTab), reaproveitado aqui.
  // Fonte única de estado (armadilha nº2 deste produto): só este id controla
  // qual praticante está graduando; onDone chama loadRoster() — o MESMO
  // refetch que o nome-clicável e o toggle de status já usam — nunca um
  // patch otimista de faixa (a faixa é derivada da view karate_current_belt,
  // não escrita direto pelo front).
  const [graduandoId, setGraduandoId] = useState<string | null>(null);
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

  // ── F6 — Anuidades do dojô como recebível (fonte: listDojoAnnuities com
  // dojo_id, mesmo shape da aba Anuidades do hub financeiro) ──────────────
  // Cada open* fecha qualquer OUTRO modal transiente antes de abrir o seu —
  // mesma disciplina de AnnuitiesTable.tsx (nunca dois <Modal> montados ao
  // mesmo tempo, armadilha Modal-dentro-de-Modal no RN Web).
  const [annuities, setAnnuities] = useState<AnnuityRowVM[]>([]);
  const [annuitiesLoading, setAnnuitiesLoading] = useState(true);
  const [annuitiesError, setAnnuitiesError] = useState(false);
  const [expandedAnnuityKey, setExpandedAnnuityKey] = useState<string | null>(null);
  const [voidAnnuityKey, setVoidAnnuityKey] = useState<string | null>(null);
  const [voidingAnnuity, setVoidingAnnuity] = useState(false);
  const [receiveAnnuityKey, setReceiveAnnuityKey] = useState<string | null>(null);
  const [statementAnnuityKey, setStatementAnnuityKey] = useState<string | null>(null);
  const [editAnnuityKey, setEditAnnuityKey] = useState<string | null>(null);
  const [chargeAnnuityOpen, setChargeAnnuityOpen] = useState(false);
  const [pixAnnuityTarget, setPixAnnuityTarget] = useState<{ installmentId: string; amount: number; label: string } | null>(null);
  const [emailAnnuityTargets, setEmailAnnuityTargets] = useState<EmailBatchTarget[] | null>(null);
  const [waAnnuityTarget, setWaAnnuityTarget] = useState<WhatsAppChargeTarget | null>(null);

  // Toast inline — padrão das fichas Shoji. Item 3 (toggle ativo/inativo do
  // roster): ganhou um 2º parâmetro opcional `undo` (mesmo formato do toast
  // com Desfazer já usado em app/karate/roster-update/[token].tsx) — todo
  // showToast(msg) existente continua funcionando sem alterações.
  const [toast, setToast] = useState<{ message: string; undoLabel?: string; onUndo?: () => void } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, undo?: { label: string; onUndo: () => void }) => {
    setToast({ message: msg, undoLabel: undo?.label, onUndo: undo?.onUndo });
    toastAnim.setValue(0);
    Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
    }, undo ? 4000 : 2600);
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
  //
  // PAGINAÇÃO NO SERVIDOR (11/07/2026): dojôs grandes (um deles com ~400
  // praticantes) baixavam e renderizavam o quadro inteiro de uma vez — a
  // página ficava gigantesca e lenta. Agora a tela pede UMA página por vez
  // (LIMIT/OFFSET no backend) e recebe, junto, o `summary` com as contagens do
  // quadro inteiro (total/ativos/inativos + faixas-pretas), para que os KPIs
  // continuem corretos sem a lista completa em memória.
  const [roster, setRoster] = useState<DojoMemberStanding[]>([]);
  const [rosterSummary, setRosterSummary] = useState<DojoRosterSummary | null>(null);
  const [rosterSliceTotal, setRosterSliceTotal] = useState(0); // total do recorte (aba atual)
  const [rosterTab, setRosterTab] = useState<RosterStatusFilter>("all");
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState(false);

  const fetchRoster = useCallback((tab: RosterStatusFilter, page: number) => {
    if (!dojoId) return;
    setRosterLoading(true); setRosterError(false);
    karateApi.getDojoMembersStanding(federationId, dojoId, { status: tab, page, pageSize: ROSTER_PAGE_SIZE })
      .then((res) => {
        setRoster(res.data || []);
        setRosterSliceTotal(res.total ?? 0);
        setRosterSummary(res.summary ?? null);
      })
      .catch(() => setRosterError(true))
      .finally(() => setRosterLoading(false));
  }, [federationId, dojoId]);

  // Recarrega a página ATUAL (usado depois de mutações: suspender, redistribuir…).
  const loadRoster = useCallback(() => { fetchRoster(rosterTab, rosterPage); }, [fetchRoster, rosterTab, rosterPage]);
  useEffect(() => { fetchRoster(rosterTab, rosterPage); }, [fetchRoster, rosterTab, rosterPage]);

  // Trocar de aba sempre volta para a página 1 (senão a página 3 de "Ativos"
  // pode não existir em "Inativos" e a lista viria vazia sem explicação).
  const changeRosterTab = useCallback((tab: RosterStatusFilter) => {
    setRosterTab(tab);
    setRosterPage(1);
  }, []);

  // ── Toggle ativo/inativo por praticante (pedido do Caio, 21/07/2026) ────
  // Fonte única: a mutação escreve DIRETO no `roster` que a UI já lê (linha
  // ~854, roster.map) — é a mesma lista, não uma cópia paralela. Essa é a
  // armadilha nº1 deste produto (mutação numa lista, UI lendo outra → clique
  // vira no-op silencioso; já mordeu 2×), então NUNCA introduzir um segundo
  // estado para o status otimista.
  //
  // Corrida (item 5): PATCHes do MESMO praticante são serializados por
  // student_id em `rosterChainRef` — o próximo só sai depois que o anterior
  // terminar (sucesso ou falha), então nunca um PATCH lento sobrescreve um
  // valor mais novo na resposta do servidor. `rosterDesiredRef` guarda qual
  // é o ÚLTIMO valor que o usuário pediu para aquele id; se um PATCH falha
  // mas o usuário já trocou de novo enquanto ele estava em voo, o revert
  // NÃO mexe na UI (senão apagaria uma mudança mais recente) — só desfaz
  // visualmente quando a falha ainda é a última palavra sobre aquele id.
  // Sem retry automático (retry:0): cada PATCH sai uma única vez.
  const rosterChainRef = useRef<Record<string, Promise<void>>>({});
  const rosterDesiredRef = useRef<Record<string, boolean>>({});

  // Contadores do summary (Ativos/Inativos) acompanham a mudança otimista —
  // decisão do Caio (item 4): o item some da aba só no próximo reload, mas os
  // contadores nunca podem mentir enquanto isso, então sobem/descem junto.
  const applyRosterActiveDelta = useCallback((activeDelta: number) => {
    setRosterSummary((prev) => (prev ? {
      ...prev,
      active: Math.max(0, prev.active + activeDelta),
      inactive: Math.max(0, prev.inactive - activeDelta),
    } : prev));
  }, []);

  const setRosterItemActive = useCallback((studentId: string, active: boolean) => {
    setRoster((prev) => prev.map((m) => (m.student_id === studentId ? { ...m, is_active: active } : m)));
  }, []);

  // Aplica UMA mudança de status (otimista + PATCH serializado). Devolve
  // se deu certo — quem chama decide o toast (sucesso com Desfazer, ou erro).
  const applyRosterStatusChange = useCallback((studentId: string, nextActive: boolean): Promise<boolean> => {
    const prevActive = !nextActive;
    rosterDesiredRef.current[studentId] = nextActive;
    setRosterItemActive(studentId, nextActive);
    applyRosterActiveDelta(nextActive ? 1 : -1);

    const run = async (): Promise<boolean> => {
      try {
        await karateApi.updatePractitioner(federationId, studentId, { is_active: nextActive });
        return true;
      } catch {
        // Só desfaz visualmente se nenhum clique mais novo já mudou o alvo
        // deste praticante enquanto este PATCH estava em voo.
        if (rosterDesiredRef.current[studentId] === nextActive) {
          setRosterItemActive(studentId, prevActive);
          applyRosterActiveDelta(prevActive ? 1 : -1);
          rosterDesiredRef.current[studentId] = prevActive;
        }
        return false;
      }
    };

    const chained = (rosterChainRef.current[studentId] || Promise.resolve()).then(run, run);
    rosterChainRef.current[studentId] = chained.then(() => undefined);
    return chained;
  }, [federationId, applyRosterActiveDelta, setRosterItemActive]);

  // Handler do switch na linha do roster — troca na hora, sem diálogo
  // (decisão do Caio: reversível/baixo risco, precisa ser rápido pra trocar
  // vários seguidos). Gate: mesmo `canManage` (canTransfer) já usado nas
  // demais ações de praticante desta tela — não afrouxar.
  const handleToggleRosterActive = useCallback((m: DojoMemberStanding) => {
    if (!canManage) return;
    const nextActive = !m.is_active;
    const name = m.full_name;
    applyRosterStatusChange(m.student_id, nextActive).then((ok) => {
      if (ok) {
        showToast(`${name} ${nextActive ? "ativado" : "inativado"}`, {
          label: "Desfazer",
          onUndo: () => { applyRosterStatusChange(m.student_id, !nextActive); },
        });
      } else {
        showToast(`Não foi possível atualizar ${name}. Tente de novo.`);
      }
    });
  }, [canManage, applyRosterStatusChange, showToast]);

  // Abre a ficha do praticante em modo EDICAO a partir do nome no roster
  // (pedido do Caio, 22/07/2026). Mesmo padrao do botao "Editar" da pagina
  // cheia do praticante (app/karate/(federation)/praticantes/[practitionerId].tsx,
  // ~L208): la o botao Editar fica visivel para QUALQUER papel que acesse a
  // tela (so Inativar/Excluir sao restritos a canManage/canTransfer) - aqui
  // seguimos a MESMA regua, nao a do switch de status (que e uma acao
  // administrativa propria desta tela). Nome e switch sao Pressables IRMAOS
  // na linha do roster (ver roster.map abaixo), nunca aninhados - um toque
  // no nome nunca dispara o switch, e vice-versa.
  const openPractitionerFicha = useCallback((studentId: string) => {
    setPractitionerFicha({ open: true, id: studentId });
  }, []);

  // Abre o modal de graduação a partir da faixa clicável no roster (pedido
  // do Caio, 23/07/2026) — gêmeo do nome clicável acima. Gate: MESMO
  // `canManage` (canTransfer) que protege "Registrar graduação" na aba
  // Trajetória (TrajetoriaTab, allowed = canTransfer(karateRole)) — graduação
  // é mais sensível que abrir a ficha (nome), por isso segue a régua mais
  // restrita (canManage), não a régua aberta do nome-clicável.
  const openGraduacao = useCallback((studentId: string) => {
    if (!canManage) return;
    setGraduandoId(studentId);
  }, [canManage]);

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
        self_service_url: res.self_service_url || null,
        last_accessed_at: null,
      });
      showToast("Solicitação enviada — link gerado");
    } catch (e: any) {
      Alert.alert("Não foi possível solicitar", e?.message || "Tente novamente.");
    } finally {
      setRequestingRoster(false);
    }
  }, [dojoId, federationId, requestingRoster, showToast]);

  // Item 1 (revisão Atualização Cadastral, 15/07/2026): "X" no banner pra
  // revogar o link quando a federação não quiser mais que o dojô acesse.
  // Expira os DOIS tokens (backend) — aqui só limpamos o estado local pro
  // banner sumir (mesmo efeito visual de um dojô que nunca solicitou).
  const [revokingRoster, setRevokingRoster] = useState(false);
  const revokeRosterLink = useCallback(async () => {
    if (!dojoId || revokingRoster) return;
    setRevokingRoster(true);
    try {
      await karateApi.revokeRosterUpdate(federationId, dojoId);
      setRosterValidation(null);
      showToast("Link revogado");
    } catch (e: any) {
      Alert.alert("Não foi possível revogar", e?.message || "Tente novamente.");
    } finally {
      setRevokingRoster(false);
    }
  }, [dojoId, federationId, revokingRoster, showToast]);

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

  // Link de auto-atendimento do PRÓPRIO praticante (G1 item 7) — mesmo
  // padrão de copiar/whatsapp do link do sensei acima, token separado.
  const copySelfServiceLink = useCallback(async () => {
    if (!rosterValidation?.self_service_url) return;
    const ok = await copyToClipboard(rosterValidation.self_service_url);
    showToast(ok ? "Link copiado" : "Não foi possível copiar o link");
  }, [rosterValidation, showToast]);

  const shareSelfServiceLinkWhatsApp = useCallback(() => {
    if (!rosterValidation?.self_service_url) return;
    const link = `https://wa.me/?text=${encodeURIComponent(rosterValidation.self_service_url)}`;
    Linking.openURL(link).catch(() =>
      Alert.alert("Não foi possível abrir", "Copie o link e envie manualmente.")
    );
  }, [rosterValidation]);

  // ── F6 — Anuidades do dojô como recebível ────────────────────────────
  // Busca própria (independente do GET de detalhe): listDojoAnnuities com
  // dojo_id filtra a MESMA rota/shape que a aba Anuidades do hub financeiro
  // usa (GET /financial/annuities/dojos), sem passar `year` — mostra o
  // histórico inteiro do dojô (paridade com o antigo data.annuity_history
  // que esta seção substitui). pageSize generoso: um único dojô não deve
  // ter mais que um punhado de anuidades lançadas ao longo dos anos.
  const loadAnnuities = useCallback(() => {
    if (!dojoId) return;
    setAnnuitiesLoading(true); setAnnuitiesError(false);
    karateApi.listDojoAnnuities(federationId, { dojo_id: dojoId, pageSize: 100 })
      .then((res) => setAnnuities(res.data.map((it) => toRowVM("dojo", it))))
      .catch(() => setAnnuitiesError(true))
      .finally(() => setAnnuitiesLoading(false));
  }, [federationId, dojoId]);
  useEffect(() => { loadAnnuities(); }, [loadAnnuities]);

  // Identificador estável de linha PARA ESTA TELA: ao contrário do hub (uma
  // linha por dojô, `key`=dojo_id é único), aqui um único dojô pode aparecer
  // em VÁRIAS linhas (uma por temporada/competência já lançada) — todas com
  // o MESMO dojo_id. `annuityId` (annuity_history_id) é o identificador real
  // de cada lançamento; referencePeriod é o fallback só para o caso raro de
  // uma linha sem id (nunca deveria acontecer, mas evita colisão em runtime).
  const annuityKey = useCallback((vm: AnnuityRowVM): string => vm.rowId || vm.referencePeriod, []);

  // Mini-KPIs do dojô (Previsto/Recebido/Saldo/Atrasado) — GET .../summary
  // NÃO aceita dojo_id (só a listagem aceita), então os KPIs são DERIVADOS
  // desta MESMA lista filtrada, com a fórmula IDÊNTICA à do summary (pra
  // nunca divergir do hub): previsto = Σ total; recebido = Σ paid_total;
  // saldo = Σ (amount - amount_paid) sobre parcelas não pagas; atrasado =
  // idem, restrito a due_date <= hoje.
  const annuityKpis = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    let previsto = 0, recebido = 0, saldo = 0, atrasado = 0;
    for (const vm of annuities) {
      previsto += vm.total;
      recebido += vm.paidTotal;
      for (const inst of vm.installments) {
        if (inst.status === "paid") continue;
        const open = Math.max(0, (Number(inst.amount) || 0) - (Number(inst.amount_paid) || 0));
        saldo += open;
        if (inst.due_date && inst.due_date <= todayIso) atrasado += open;
      }
    }
    return { previsto, recebido, saldo, atrasado };
  }, [annuities]);

  // Cada open* fecha qualquer OUTRO modal transiente antes de abrir o seu —
  // nunca dois <Modal> montados ao mesmo tempo (RN Web renderiza o 2º atrás
  // do 1º, vira no-op silencioso; já mordeu este produto várias vezes).
  const closeAllAnnuityModals = useCallback(() => {
    setReceiveAnnuityKey(null);
    setStatementAnnuityKey(null);
    setEditAnnuityKey(null);
    setChargeAnnuityOpen(false);
    setVoidAnnuityKey(null);
    setPixAnnuityTarget(null);
    setEmailAnnuityTargets(null);
  }, []);
  // Extrato é visualização (com raras edições inline dentro do próprio
  // AnnuityStatementModal) — fica aberto pra qualquer papel que acesse esta
  // tela, mesmo padrão de "ver" vs. "mudar" já usado no roster (nome
  // clicável abre a ficha pra qualquer um; graduação exige canManage).
  const openStatementAnnuity = useCallback((key: string) => { closeAllAnnuityModals(); setStatementAnnuityKey(key); }, [closeAllAnnuityModals]);
  // Receber/Editar/Lançar mudam dinheiro ou o lançamento — mesmo gate
  // canManage das demais ações administrativas desta tela.
  const openReceiveAnnuity = useCallback((key: string) => { if (!canManage) return; closeAllAnnuityModals(); setReceiveAnnuityKey(key); }, [canManage, closeAllAnnuityModals]);
  const openEditAnnuity = useCallback((key: string) => { if (!canManage) return; closeAllAnnuityModals(); setEditAnnuityKey(key); }, [canManage, closeAllAnnuityModals]);
  const openChargeAnnuity = useCallback(() => { if (!canManage) return; closeAllAnnuityModals(); setChargeAnnuityOpen(true); }, [canManage, closeAllAnnuityModals]);
  const requestVoidAnnuity = useCallback((key: string) => { if (!canManage) return; closeAllAnnuityModals(); setVoidAnnuityKey(key); }, [canManage, closeAllAnnuityModals]);

  // Sucesso de qualquer ação (receber, editar/remover baixa, editar/lançar
  // anuidade) termina em REFETCH REAL da lista do dojô + dos KPIs (nunca
  // patch otimista de dinheiro) — mesma disciplina de AnnuitiesTable.tsx.
  const onAnnuityMutated = useCallback(() => { loadAnnuities(); }, [loadAnnuities]);

  const handleReceiveAnnuitySuccess = useCallback((_result: AnnuityReceiveResult) => {
    setReceiveAnnuityKey(null);
    onAnnuityMutated();
  }, [onAnnuityMutated]);

  const handlePayInstallment = useCallback(async (instId: string, method: AnnuityPaymentMethod) => {
    if (!canManage) { Alert.alert("Sem permissão", "Você não pode registrar pagamentos aqui."); throw new Error("forbidden"); }
    try {
      await karateApi.payInstallment(federationId, instId, { payment_method: method });
      showToast("Pagamento registrado");
      onAnnuityMutated();
    } catch (e: any) {
      Alert.alert("Não foi possível registrar", e?.message || "Tente novamente.");
      throw e;
    }
  }, [federationId, onAnnuityMutated, showToast, canManage]);

  const handleEditInstallment = useCallback(async (instId: string, body: { amount?: number; due_date?: string }) => {
    if (!canManage) { Alert.alert("Sem permissão", "Você não pode editar parcelas aqui."); throw new Error("forbidden"); }
    try {
      await karateApi.updateInstallment(federationId, instId, body);
      showToast("Parcela atualizada");
      onAnnuityMutated();
    } catch (e: any) {
      Alert.alert("Não foi possível editar", e?.message || "Tente novamente.");
      throw e;
    }
  }, [federationId, onAnnuityMutated, showToast, canManage]);

  const handleVoidAnnuity = useCallback(async () => {
    if (!voidAnnuityKey) return;
    const vm = annuities.find((i) => annuityKey(i) === voidAnnuityKey);
    if (!vm || !vm.rowId) { setVoidAnnuityKey(null); return; }
    setVoidingAnnuity(true);
    try {
      await karateApi.voidAnnuityGeneric(federationId, vm.rowId);
      showToast("Cobrança removida");
      setVoidAnnuityKey(null);
      onAnnuityMutated();
    } catch (e: any) {
      Alert.alert("Não foi possível remover", e?.message || "Tente novamente.");
    } finally {
      setVoidingAnnuity(false);
    }
  }, [voidAnnuityKey, annuities, annuityKey, federationId, onAnnuityMutated, showToast]);

  const openEmailForInstallment = useCallback((vm: AnnuityRowVM, instId: string) => {
    const inst = vm.installments.find((i) => i.id === instId);
    if (!inst) return;
    closeAllAnnuityModals();
    setEmailAnnuityTargets([{
      key: `${vm.key}-${inst.id}`,
      instId: inst.id,
      name: vm.name,
      whatsapp: vm.whatsapp,
      amount: inst.amount,
      referencePeriod: vm.referencePeriod,
      dueDate: inst.due_date,
      status: vm.status as AnnuityStatus,
    }]);
  }, [closeAllAnnuityModals]);

  const receiveAnnuityVm = annuities.find((i) => annuityKey(i) === receiveAnnuityKey) || null;
  const statementAnnuityVm = annuities.find((i) => annuityKey(i) === statementAnnuityKey) || null;
  const editAnnuityVm = annuities.find((i) => annuityKey(i) === editAnnuityKey) || null;
  // Shape DojoAnnuity mínimo pra alimentar LancarAnuidadeDojoModal
  // (mode="edit") a partir da própria linha já carregada (sem fetch extra) —
  // mesmo padrão de AnnuitiesTable.tsx (editAnnuityVm lá).
  const editAnnuityDojoShape: DojoAnnuity | null = editAnnuityVm ? {
    dojo_id: editAnnuityVm.key,
    dojo_name: editAnnuityVm.name,
    reference_period: editAnnuityVm.referencePeriod,
    amount: editAnnuityVm.amount,
    due_date: editAnnuityVm.dueDate || "",
    paid_at: null,
    status: editAnnuityVm.status as AnnuityStatus,
    plan: editAnnuityVm.plan,
    installments: editAnnuityVm.installments,
    paid_total: editAnnuityVm.paidTotal,
    total: editAnnuityVm.total,
  } : null;

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

  // Com o roster paginado, a lista da tela é só UMA página — mas o modal de
  // Redistribuição precisa de TODOS os praticantes ativos (decide um a um).
  // Buscamos a lista completa (all=1&status=active) sob demanda, só quando o
  // usuário escolhe "Redistribuir".
  const [redistribList, setRedistribList] = useState<DojoMemberStanding[]>([]);
  const [redistribLoading, setRedistribLoading] = useState(false);
  const openRedistribute = useCallback(async () => {
    if (!dojoId) return;
    setRedistribLoading(true);
    try {
      const rows = await karateApi.getDojoMembersStandingAll(federationId, dojoId, "active");
      setRedistribList(rows);
      setChoiceOpen(false);
      // Dois <Modal> distintos: fecha o diálogo de escolha e só no próximo tick
      // abre o Redistribuir (RN-Web: modal aberto sobre modal ainda no ar fica
      // atrás / vira no-op).
      setTimeout(() => setRedistribOpen(true), 0);
    } catch (e: any) {
      Alert.alert("Não foi possível carregar os praticantes", e?.message || "Tente novamente.");
    } finally {
      setRedistribLoading(false);
    }
  }, [federationId, dojoId]);

  // ── Remover (desativar) dojô ───────────────────────────────────────
  // 11/08/2026 (compliance, back#485/PR#486): DELETE /federation/:id/dojos/:dojoId
  // não apaga mais nada — desativa (is_active:false), preserva praticantes,
  // graduações e histórico (retenção de 60 dias) e é reversível pelo mesmo
  // "Reativar dojô" do menu (PATCH is_active:true). O antigo 409 HAS_HISTORY
  // e o caminho "Excluir definitivamente" (cascade) SAÍRAM — o backend aceita
  // e ignora ?cascade=true (cascade_ignored:true), então este front nem
  // manda mais o parâmetro.
  const deleteDojo = useCallback(async () => {
    if (!data || busy) return;
    if (!(await confirmAsync({
      title: "Remover dojô?",
      message: `O dojô "${data.name}" será desativado: sai das listagens ativas, mas nada é apagado — praticantes, graduações e histórico continuam no Aura. É reversível a qualquer momento em "Reativar dojô".`,
      confirmLabel: "Desativar",
      destructive: true,
    }))) return;
    setBusy(true);
    try {
      const res = await karateApi.deleteDojo(federationId, dojoId!);
      showToast(res?.already_inactive ? "Este dojô já estava desativado" : "Dojô desativado. Nenhum dado foi apagado.");
      setTimeout(() => router.replace("/karate/dojos" as any), 320);
    } catch (e: any) {
      Alert.alert("Não foi possível desativar", e?.message || "Tente novamente.");
    } finally { setBusy(false); }
  }, [data, busy, federationId, dojoId, router, showToast]);

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

  // Fase 4/5 — contadores do roster (topo da seção Praticantes) + faixas-pretas.
  //
  // Com o roster paginado, estes números NÃO podem mais ser derivados da lista
  // em memória (ela é só uma página): vêm do `summary` que o backend agrega no
  // banco sobre o quadro INTEIRO do dojô. `rosterHasData` continua guardando
  // contra mostrar contagem/percentual falso enquanto carrega ou se o standing
  // falhar (degrade para "—", nunca um número inventado).
  const rosterHasData = !rosterError && !!rosterSummary;
  const rosterTotal = rosterSummary?.total ?? 0;
  const rosterActiveCount = rosterSummary?.active ?? 0;
  const rosterInactiveCount = rosterSummary?.inactive ?? 0;
  const blackBeltTotal = rosterSummary?.black_belt_total ?? 0;
  const blackBeltPaidCount = rosterSummary?.black_belt_paid ?? 0;
  const blackBeltOverdueCount = rosterSummary?.black_belt_overdue ?? 0;

  // Paginação do recorte (aba) atual.
  const rosterPageCount = Math.max(1, Math.ceil(rosterSliceTotal / ROSTER_PAGE_SIZE));
  const rosterRangeStart = rosterSliceTotal === 0 ? 0 : (rosterPage - 1) * ROSTER_PAGE_SIZE + 1;
  const rosterRangeEnd = Math.min(rosterPage * ROSTER_PAGE_SIZE, rosterSliceTotal);
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
            <Body muted style={{ marginTop: 12 }}>{data.region || "—"} · {annuityPlanLabel(data.karate_annuity_plan)}</Body>
          </View>
          <View style={styles.headActions}>
            <ShojiBadge dojoStatus={data.status} />
            <View style={styles.headBtns}>
              {/* Item 2 (overflow do header): só os primários ficam soltos —
                  Ver praticantes + Editar. O resto (Exportar, Solicitar
                  atualização cadastral, Suspender, Remover dojô) foi para o
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
                    type: "action", key: "delete", label: "Remover dojô", icon: "trash",
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
            selfServiceUrl={rosterValidation.self_service_url}
            onCopySelfServiceLink={copySelfServiceLink}
            onShareSelfServiceWhatsApp={shareSelfServiceLinkWhatsApp}
            onRevoke={revokeRosterLink}
            revoking={revokingRoster}
          />
        ) : null}

        {/* Item 8 (revisão Atualização Cadastral, 15/07/2026): a federação só
            via "atualizações concluídas", nunca O QUE o sensei mudou. Seção
            compacta com o histórico de karate_dojo_roster_events (antes/
            depois por campo). */}
        {dojoId ? <RosterUpdatesSection federationId={federationId} dojoId={dojoId} /> : null}

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
          <KV k="Telefone" v={data.phone ? maskPhone(data.phone) : null} />
          <KV k="Celular" v={data.phone_mobile ? maskPhone(data.phone_mobile) : null} />
          <KV k="E-mail" v={data.email} />
          <KV k="Região" v={data.region} />
          <KV k="Fundação" v={data.dojo_founded_year ? String(data.dojo_founded_year) : null} />
          <KV k="Filiação desde" v={fmtDate(data.affiliation_since)} />
          {/* "Modelo" (affiliation_model) removido — decorativo/legado, nunca
              lido por rota de cobrança (ver comentário acima). Plano de
              anuidade é a fonte única, com estado honesto "Não definido"
              (nunca inventa "Anual" para dojô sem plano configurado). */}
          <KV k="Plano de anuidade" v={annuityPlanLabel(data.karate_annuity_plan)} />
          {/* Fase 5 / DJ-seg: fonte coerente com a seção Praticantes abaixo — usa o
              `summary` do roster paginado (contagens agregadas no banco, mesma chamada
              da lista, sem 2ª ida) quando disponível; cai para o campo do GET /dojo
              enquanto carrega ou se falhar — nunca mostra ativos/inativos "chutados". */}
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
            quebra Total/Ativos/Inativos e faixas-pretas com % de anuidade em dia.
            PAGINADO NO SERVIDOR (25/página): a lista abaixo é só a página atual;
            os KPIs vêm do summary agregado no banco (quadro inteiro). */}
        <Card style={{ marginTop: SP[6] }}>
          <SectionHead
            title="Praticantes"
            sub={rosterHasData ? `${rosterTotal} cadastrado${rosterTotal === 1 ? "" : "s"}` : undefined}
          />
          {rosterError ? (
            <KarateErrorState
              title="Não foi possível carregar os praticantes"
              message="Verifique sua conexão e tente novamente."
              onRetry={loadRoster}
            />
          ) : !rosterSummary ? (
            /* Primeira carga: ainda não sabemos nem as contagens. */
            <View>
              {[1, 2, 3].map((k) => <Skeleton key={k} height={40} style={{ marginBottom: 8 }} />)}
            </View>
          ) : rosterTotal === 0 ? (
            <KarateEmptyState
              icon="people-outline"
              title="Nenhum praticante neste dojô"
              subtitle="Praticantes cadastrados neste dojô aparecerão aqui, com status e situação financeira."
            />
          ) : (
            <>
              {/* Fase 5: Total / Ativos / Inativos — agregados do quadro inteiro (summary). */}
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

              {/* Abas do quadro — o filtro roda no BACKEND (status=), não é
                  .filter() sobre a página. Trocar de aba volta para a página 1. */}
              <View style={styles.rosterTabs}>
                <Chip label={`Todos (${rosterTotal})`} active={rosterTab === "all"} onPress={() => changeRosterTab("all")} />
                <Chip label={`Ativos (${rosterActiveCount})`} active={rosterTab === "active"} onPress={() => changeRosterTab("active")} />
                <Chip label={`Inativos (${rosterInactiveCount})`} active={rosterTab === "inactive"} onPress={() => changeRosterTab("inactive")} />
              </View>

              {rosterLoading ? (
                <View style={{ marginTop: SP[4] }}>
                  {[1, 2, 3, 4, 5].map((k) => <Skeleton key={k} height={40} style={{ marginBottom: 8 }} />)}
                </View>
              ) : roster.length === 0 ? (
                <Body muted style={{ marginTop: SP[4] }}>
                  {rosterTab === "active" ? "Nenhum praticante ativo neste dojô." : "Nenhum praticante inativo neste dojô."}
                </Body>
              ) : (
                roster.map((m, i) => (
                  <View key={m.student_id} style={[styles.rosterRow, i === roster.length - 1 && styles.noBorder]}>
                    {/* Nome clicável (pedido do Caio, 22/07/2026) — abre a ficha em modo
                        edição. Pressable IRMãO do bloco de status/switch abaixo (nunca
                        aninhado nele), então o toque no nome nunca alcança o Switch e
                        vice-versa — são alvos de toque totalmente distintos na linha. */}
                    <Pressable
                      onPress={() => openPractitionerFicha(m.student_id)}
                      style={({ pressed }) => [{ flex: 1, minWidth: 160 }, pressed && styles.rosterNamePressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir ficha de ${m.full_name}`}
                      hitSlop={4}
                    >
                      <Text style={styles.rosterName}>{m.full_name}</Text>
                      <Body muted style={{ fontSize: 11.5, marginTop: 2 }}>
                        {m.karate_registration_number || "Sem matrícula"}
                      </Body>
                    </Pressable>
                    {/* Faixa clicável (pedido do Caio, 23/07/2026) — abre o modal de
                        graduação. Pressable IRMÃO do nome e do bloco de status/switch
                        (nunca aninhado neles): tocar na faixa não alcança o nome nem o
                        Switch, e vice-versa — três alvos de toque distintos na mesma
                        linha. Só é clicável para quem pode graduar (canManage); sem essa
                        permissão a faixa continua um BeltBadge estático, como hoje. */}
                    {m.belt_level ? (
                      canManage ? (
                        <Pressable
                          onPress={() => openGraduacao(m.student_id)}
                          style={({ pressed }) => [pressed && styles.rosterNamePressed]}
                          accessibilityRole="button"
                          accessibilityLabel={`Registrar graduação de ${m.full_name}`}
                          hitSlop={4}
                        >
                          <BeltBadge beltLevel={m.belt_level} beltName={m.belt_name || undefined} />
                        </Pressable>
                      ) : (
                        <BeltBadge beltLevel={m.belt_level} beltName={m.belt_name || undefined} />
                      )
                    ) : null}
                    <View style={styles.rosterBadges}>
                      {canManage ? (
                        <View style={styles.rosterStatusToggle}>
                          <Text style={[styles.rosterStatusLabel, !m.is_active && styles.rosterStatusLabelOff]}>
                            {m.is_active ? "Ativo" : "Inativo"}
                          </Text>
                          <Switch
                            value={m.is_active}
                            onValueChange={() => handleToggleRosterActive(m)}
                            trackColor={{ false: C.border2, true: C.primarySoft }}
                            thumbColor={m.is_active ? C.primary : "#fff"}
                            accessibilityRole="switch"
                            accessibilityLabel={`Status de ${m.full_name}`}
                            accessibilityHint={m.is_active ? "Ativado. Toque para inativar." : "Inativado. Toque para ativar."}
                          />
                        </View>
                      ) : (
                        <Badge status={m.is_active ? "ok" : "neutral"} label={m.is_active ? "Ativo" : "Inativo"} />
                      )}
                      {m.is_black_belt && m.financeiro === "em_dia" ? (
                        <Badge status="ok" label="Em dia" />
                      ) : null}
                      {m.is_black_belt && m.financeiro === "atrasado" ? (
                        <Badge status="danger" label="Atrasado" />
                      ) : null}
                    </View>
                  </View>
                ))
              )}

              {/* Pager — só aparece quando o recorte não cabe numa página. */}
              {rosterSliceTotal > ROSTER_PAGE_SIZE ? (
                <View style={styles.pagerRow}>
                  <Text style={styles.pagerInfo}>
                    {rosterRangeStart}–{rosterRangeEnd} de {rosterSliceTotal} · página {rosterPage} de {rosterPageCount}
                  </Text>
                  <View style={styles.pagerBtns}>
                    <TouchableOpacity
                      style={[styles.pagerBtn, (rosterPage <= 1 || rosterLoading) && styles.pagerBtnOff]}
                      disabled={rosterPage <= 1 || rosterLoading}
                      onPress={() => setRosterPage((p) => Math.max(1, p - 1))}
                      accessibilityRole="button"
                      accessibilityLabel="Página anterior"
                    >
                      <Icon name="chevron-back" size={13} color={C.ink} />
                      <Text style={styles.pagerBtnTxt}>Anterior</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pagerBtn, (rosterPage >= rosterPageCount || rosterLoading) && styles.pagerBtnOff]}
                      disabled={rosterPage >= rosterPageCount || rosterLoading}
                      onPress={() => setRosterPage((p) => Math.min(rosterPageCount, p + 1))}
                      accessibilityRole="button"
                      accessibilityLabel="Próxima página"
                    >
                      <Text style={styles.pagerBtnTxt}>Próxima</Text>
                      <Icon name="chevron-forward" size={13} color={C.ink} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
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

        {/* F0 (Canal B): link fixo do Portal do Dojô sem Aura — gerar, copiar (uma vez) e revogar */}
        <DojoPortalLinkCard federationId={federationId} dojoId={dojoId!} />

        {/* F6 (26/07/2026) — Anuidades do dojô como recebível DE VERDADE,
            reusando os MESMOS componentes da aba Anuidades do hub financeiro
            (AnnuityReceivableRow + AnnuityReceiveModal/AnnuityStatementModal/
            LancarAnuidadeDojoModal) — nunca uma 2ª implementação paralela.
            Substitui o card local antigo (3 modais próprios, API legada
            payAnnuity/registerAnnuityPayment, fonte data.annuity_history e o
            bug do badge "Inativo" fixo via ShojiBadge dojoStatus=a.status). */}
        <Card style={{ marginTop: SP[6] }}>
          <View style={styles.annuityHead}>
            <SectionHead title="Anuidades" sub="Recebível do dojô — devido, recebido e saldo" />
            {canManage ? (
              <TouchableOpacity
                style={styles.launchBtn}
                onPress={openChargeAnnuity}
                accessibilityRole="button"
                accessibilityLabel="Lançar anuidade"
              >
                <Icon name="add" size={13} color={C.ink} />
                <Text style={styles.launchBtnTxt}>Lançar anuidade</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {annuitiesError ? (
            <KarateErrorState
              title="Não foi possível carregar as anuidades"
              message="Verifique sua conexão e tente novamente."
              onRetry={loadAnnuities}
            />
          ) : annuitiesLoading ? (
            <View>
              {[1, 2].map((k) => <Skeleton key={k} height={40} style={{ marginBottom: 8 }} />)}
            </View>
          ) : (
            <>
              {annuities.length > 0 ? (
                <KpiBand
                  items={[
                    { label: "Previsto", value: fmtMoney(annuityKpis.previsto) },
                    { label: "Recebido", value: fmtMoney(annuityKpis.recebido) },
                    { label: "Saldo", value: fmtMoney(annuityKpis.saldo) },
                  ]}
                  style={{ marginBottom: SP[5] }}
                />
              ) : null}

              {annuities.length === 0 ? (
                <KarateEmptyState
                  icon="receipt-outline"
                  title="Nenhuma anuidade lançada"
                  subtitle={canManage ? "Lance a anuidade da temporada para começar a receber deste dojô." : "Nenhuma anuidade registrada para este dojô ainda."}
                />
              ) : (
                annuities.map((vm) => {
                  const key = annuityKey(vm);
                  return (
                    <AnnuityReceivableRow
                      key={key}
                      vm={vm}
                      seg="dojo"
                      wide
                      federationId={federationId}
                      selected={false}
                      selectable={false}
                      expanded={expandedAnnuityKey === key}
                      onToggleSelect={() => {}}
                      onToggleExpand={() => setExpandedAnnuityKey((k) => (k === key ? null : key))}
                      onPay={handlePayInstallment}
                      onPix={(instId, amount, label) => {
                        if (!canManage) return;
                        closeAllAnnuityModals();
                        setPixAnnuityTarget({ installmentId: instId, amount, label: `${vm.name} — ${label}` });
                      }}
                      onEdit={handleEditInstallment}
                      onSendEmail={(instId) => openEmailForInstallment(vm, instId)}
                      onVoid={() => requestVoidAnnuity(key)}
                      onLaunch={openChargeAnnuity}
                      voidConfirming={voidAnnuityKey === key}
                      onVoidConfirm={handleVoidAnnuity}
                      onVoidCancel={() => setVoidAnnuityKey(null)}
                      voiding={voidingAnnuity}
                      onReceive={() => openReceiveAnnuity(key)}
                      onStatement={() => openStatementAnnuity(key)}
                      onEditAnnuity={() => openEditAnnuity(key)}
                    />
                  );
                })
              )}
            </>
          )}
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

      {/* Ficha do PRATICANTE (nome clicável no roster, 22/07/2026) — abre o
          MESMO PraticanteFichaModal usado em praticantes/index.tsx e em
          praticantes/[practitionerId].tsx, sempre em modo edição (id vindo
          do roster). Top-level <Modal>, irmão dos demais desta tela — nunca
          aninhado dentro de outro <Modal> (RN Web renderiza atrás e fica
          invisível; já mordeu este produto 5×). onSaved recarrega a página
          ATUAL do roster (mesmo refetch que o toggle de status já usa), então
          nome/faixa/matrícula voltam atualizados sem reload manual. */}
      <PraticanteFichaModal
        federationId={federationId}
        visible={practitionerFicha.open}
        practitionerId={practitionerFicha.id}
        onClose={() => setPractitionerFicha({ open: false, id: null })}
        onSaved={() => loadRoster()}
      />

      {/* Graduação (faixa clicável no roster, 23/07/2026) — MESMO
          RegistrarGraduacaoModal usado na aba Trajetória da ficha do
          praticante (TrajetoriaTab), reaproveitado aqui. Top-level <Modal>,
          irmão dos demais desta tela (ficha do praticante, ficha do dojô
          etc.) — nunca aninhado (RN Web renderiza atrás e fica invisível;
          já mordeu este produto 5×). Fecha sozinho (graduandoId volta a
          null) antes de recarregar, então nunca fica sobreposto ao de
          ficha. onDone recarrega a página ATUAL do roster (mesmo refetch
          que nome/switch já usam) — a faixa nova vem da view
          karate_current_belt (derivada, append-only), sem patch otimista. */}
      <RegistrarGraduacaoModal
        visible={graduandoId != null}
        onClose={() => setGraduandoId(null)}
        federationId={federationId}
        practitionerId={graduandoId ?? ""}
        onDone={() => { setGraduandoId(null); loadRoster(); }}
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
        busy={busy || redistribLoading}
        dojoName={data.name}
        activeCount={rosterActiveCount}
        hasChoice={rosterHasData && rosterActiveCount > 0}
        onInactivateAll={inactivateAllAndSuspend}
        // fix/karate-excluir-dojo: mesmo cuidado do menu kebab — fecha o
        // diálogo de escolha e só no próximo tick abre o Redistribuir (2
        // <Modal> distintos; sem o adiamento o novo modal pode abrir com o
        // anterior ainda no ar, mesmo risco de ficar atrás/invisível).
        onRedistribute={openRedistribute}
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
        practitioners={redistribList}
        onSuccess={onRedistributeSuccess}
      />

      {/* F6 — os 3 modais canônicos do recebível, TOP-LEVEL (irmãos dos
          demais desta tela, nunca aninhados — RN Web renderiza o 2º <Modal>
          atrás do 1º e vira no-op silencioso). Mesmo padrão "fecha um antes
          de abrir outro" que AnnuitiesTable.tsx já usa (closeAllAnnuityModals
          acima). Toda ação termina em refetch real (onAnnuityMutated /
          loadAnnuities), nunca patch otimista de dinheiro. */}
      {receiveAnnuityVm && receiveAnnuityVm.rowId && (
        <AnnuityReceiveModal
          visible={!!receiveAnnuityVm}
          federationId={federationId}
          annuityId={receiveAnnuityVm.rowId}
          name={receiveAnnuityVm.name}
          code={receiveAnnuityVm.code}
          planLabel={receiveAnnuityVm.plan ? PLAN_LABEL[receiveAnnuityVm.plan] : null}
          referencePeriod={receiveAnnuityVm.referencePeriod}
          dueTotal={receiveAnnuityVm.total}
          paidTotal={receiveAnnuityVm.paidTotal}
          installments={receiveAnnuityVm.installments}
          onClose={() => setReceiveAnnuityKey(null)}
          onSuccess={handleReceiveAnnuitySuccess}
        />
      )}

      {statementAnnuityVm && statementAnnuityVm.rowId && (
        <AnnuityStatementModal
          visible={!!statementAnnuityVm}
          federationId={federationId}
          annuityId={statementAnnuityVm.rowId}
          name={statementAnnuityVm.name}
          onClose={() => setStatementAnnuityKey(null)}
          onMutated={onAnnuityMutated}
        />
      )}

      {editAnnuityVm && editAnnuityVm.rowId && (
        <LancarAnuidadeDojoModal
          visible={!!editAnnuityVm}
          mode="edit"
          federationId={federationId}
          dojoId={dojoId!}
          dojoName={editAnnuityVm.name}
          annuityId={editAnnuityVm.rowId}
          annuity={editAnnuityDojoShape}
          onClose={() => setEditAnnuityKey(null)}
          onDone={() => { setEditAnnuityKey(null); onAnnuityMutated(); }}
        />
      )}

      {/* Lançar cobrança nova (temporada sem anuidade ainda) — regressão a
          vigiar: o antigo "Lançar pagamento" desta tela criava um período JÁ
          PAGO (baixa fora do fluxo). Esse atalho saiu — quem precisar
          registrar um pagamento retroativo já quitado agora faz em 2 passos:
          lançar a cobrança aqui (charge) e, em seguida, dar baixa nela
          (Receber). Não é regressão silenciosa: documentado no PR. */}
      {chargeAnnuityOpen && (
        <LancarAnuidadeDojoModal
          visible={chargeAnnuityOpen}
          mode="charge"
          federationId={federationId}
          dojoId={dojoId!}
          dojoName={data.name}
          onClose={() => setChargeAnnuityOpen(false)}
          onDone={() => { setChargeAnnuityOpen(false); onAnnuityMutated(); }}
        />
      )}

      {pixAnnuityTarget && (
        <PixPaymentModal
          visible={!!pixAnnuityTarget}
          federationId={federationId}
          target={{ installmentId: pixAnnuityTarget.installmentId }}
          amount={pixAnnuityTarget.amount}
          description={`Anuidade — ${pixAnnuityTarget.label}`}
          isAdmin
          onSuccess={() => { setPixAnnuityTarget(null); onAnnuityMutated(); }}
          onClose={() => setPixAnnuityTarget(null)}
        />
      )}

      {emailAnnuityTargets && (
        <SendEmailBatchModal
          visible={!!emailAnnuityTargets}
          federationId={federationId}
          targets={emailAnnuityTargets}
          noPendingCount={0}
          onClose={() => setEmailAnnuityTargets(null)}
          onDone={() => { setEmailAnnuityTargets(null); onAnnuityMutated(); }}
          onOpenWhatsApp={(t) => { setEmailAnnuityTargets(null); setWaAnnuityTarget(t); }}
        />
      )}

      {waAnnuityTarget && (
        <WhatsAppChargeModal
          visible={!!waAnnuityTarget}
          federationId={federationId}
          target={waAnnuityTarget}
          onClose={() => setWaAnnuityTarget(null)}
        />
      )}

      {/* Toast inline — pointerEvents box-none: o retangulo do toast não
          intercepta toques fora do texto/botão, mas o botão Desfazer (quando
          presente) precisa continuar clicável. */}
      {toast ? (
        <Animated.View pointerEvents="box-none" style={[styles.toast, {
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }]}>
          <Icon name="check" size={16} color="#bfe3c4" />
          <Text style={styles.toastTxt}>{toast.message}</Text>
          {toast.onUndo ? (
            <Pressable
              onPress={() => {
                const undo = toast.onUndo;
                if (toastTimer.current) clearTimeout(toastTimer.current);
                setToast(null);
                undo?.();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={toast.undoLabel || "Desfazer"}
            >
              <Text style={styles.toastUndo}>{toast.undoLabel || "Desfazer"}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </ShojiBackground>
  );
}

// ── Item 8 (revisão Atualização Cadastral, 15/07/2026) ──────────────────
// "O que foi atualizado" — antes a federação só via que o quadro tinha
// sido "concluído", nunca O QUE o sensei mudou (campo, de que valor para
// qual, quando). Consome GET .../roster-events (karateRosterValidation.js),
// que achata karate_dojo_roster_events.affected[] numa lista pronta.
// Rótulos de campo espelham MISSING_LABEL de app/karate/roster-update/[token].tsx
// (mesmos nomes que o sensei vê no portal).
const ROSTER_EVENT_FIELD_LABEL: Record<string, string> = {
  phone: "Telefone", email: "E-mail", birth_date: "Nascimento", cpf: "CPF", rg: "RG",
  street: "Rua", number: "Número", complement: "Complemento", neighborhood: "Bairro",
  city: "Cidade", state: "UF", zip_code: "CEP", is_active: "Situação",
};
const ROSTER_EVENT_TITLE: Record<string, string> = {
  practitioner_updated: "Dados atualizados",
  practitioner_reactivated: "Reativado",
  practitioner_inactivated: "Marcado como \"não treina mais\"",
  validated: "Quadro confirmado",
  practitioner_request_created: "Solicitou praticante novo",
  roster_imported: "Planilha importada",
  validation_requested: "Atualização solicitada pela federação",
  roster_link_revoked: "Link revogado pela federação",
};

function fmtEventValue(v: string | boolean | null | undefined): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (typeof v === "boolean") return v ? "ativo" : "inativo";
  // birth_date vem como YYYY-MM-DD — mesma exibição BR do resto da tela.
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return isoToBr(v);
  return v;
}

function RosterUpdatesSection({ federationId, dojoId }: { federationId: string; dojoId: string }) {
  const [events, setEvents] = useState<RosterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    karateApi.getRosterEvents(federationId, dojoId, 50)
      .then((res) => { if (alive) setEvents(res.data || []); })
      .catch(() => { if (alive) setEvents([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [federationId, dojoId]);

  // Achata affected[] de cada evento numa linha "o que mudou" — eventos
  // sem `changes` (ex.: solicitação de praticante, quadro confirmado)
  // ainda aparecem, só sem o detalhe campo-a-campo.
  const rows = events.flatMap((ev) =>
    (ev.affected && ev.affected.length ? ev.affected : [{}]).map((aff, idx) => ({
      key: `${ev.id}:${idx}`,
      title: ROSTER_EVENT_TITLE[ev.event] || ev.event,
      studentName: aff.student_name || aff.full_name || null,
      changes: aff.changes || [],
      createdAt: ev.created_at,
    }))
  );

  if (loading) return null;
  if (rows.length === 0) return null;

  const visibleRows = expanded ? rows : rows.slice(0, 5);

  return (
    <Card style={{ marginTop: SP[6] }}>
      <SectionHead title="Atualizações cadastrais recentes" />
      {visibleRows.map((r) => (
        <View key={r.key} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: C.ink }}>
              {r.studentName || "Praticante"} — {r.title}
            </Text>
            <Text style={{ fontFamily: F.body, fontSize: 11, color: C.ink3 }}>{fmtDate(r.createdAt)}</Text>
          </View>
          {r.changes.length > 0 && (
            <View style={{ marginTop: 4, gap: 2 }}>
              {r.changes.map((c, i) => (
                <Text key={i} style={{ fontFamily: F.body, fontSize: 11.5, color: C.ink2 }}>
                  {ROSTER_EVENT_FIELD_LABEL[c.field] || c.field}: {fmtEventValue(c.from)} → {fmtEventValue(c.to)}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
      {rows.length > 5 && (
        <Pressable onPress={() => setExpanded((e) => !e)} accessibilityRole="button" accessibilityLabel={expanded ? "Ver menos" : "Ver mais"} style={{ paddingTop: 10 }}>
          <Text style={{ fontFamily: F.body, fontSize: 12, fontWeight: "700", color: P.red }}>
            {expanded ? "Ver menos" : `Ver mais (${rows.length - 5})`}
          </Text>
        </Pressable>
      )}
    </Card>
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
                // fix/karate-excluir-dojo: fecha o menu e SÓ DEPOIS dispara a ação
                // (setTimeout 0) — o menu kebab também é um <Modal>
                // (visible={visible} acima), e várias ações daqui abrem
                // outro <Modal>/confirmAsync (Exportar, Suspender/Reativar,
                // Remover dojô). Mesmo onClose() e it.onPress() rodando no
                // mesmo handler síncrono, o desmonte do <Modal> do menu
                // acontece via efeito/animação um tick depois do setState —
                // sem o adiamento, o novo diálogo pode abrir enquanto o
                // menu ainda está no ar e sair escondido atrás dele.
                onSelect={() => { onClose(); setTimeout(() => it.onPress(), 0); }}
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
  // Feedback visual do nome clicavel no roster (22/07/2026): leve opacidade
  // ao pressionar (mobile) / :active no web — nada de hover-reveal (quebra
  // em touch); o alvo ja e sempre visivel, so confirma o toque.
  rosterNamePressed: { opacity: 0.6 } as ViewStyle,
  rosterBadges: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  // Toggle ativo/inativo do roster (21/07/2026) — label + Switch, no lugar
  // do Badge estático para quem pode editar (canManage).
  rosterStatusToggle: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  rosterStatusLabel: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ok } as TextStyle,
  rosterStatusLabelOff: { color: C.ink3 } as TextStyle,
  // Fase 5 — bloco de resumo das faixas-pretas (texto + BarRow em dia/atrasado).
  blackBeltBlock: { paddingVertical: 4, marginBottom: SP[5], borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: SP[5] } as ViewStyle,
  blackBeltLine: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink } as TextStyle,
  // Roster paginado (11/07/2026) — abas (Todos/Ativos/Inativos) + pager.
  rosterTabs: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: SP[2] } as ViewStyle,
  pagerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, paddingTop: SP[4] } as ViewStyle,
  pagerInfo: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,
  pagerBtns: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  pagerBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface } as ViewStyle,
  pagerBtnOff: { opacity: 0.4 } as ViewStyle,
  pagerBtnTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink } as TextStyle,

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

  // Cabeçalho da seção Anuidades (F6) — título + botão "Lançar anuidade".
  annuityHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 } as ViewStyle,
  launchBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2 } as ViewStyle,
  launchBtnTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: C.ink } as TextStyle,

  // Botão kebab do header (Item 2 — abre o menu de overflow)
  kebabBtn: { width: 38, height: 38, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  // dangerBtnTxt/backdrop/modalCard/countsBox/etc. abaixo ficaram sem uso
  // depois da remoção do modal HAS_HISTORY (11/08/2026, back#485/PR#486) —
  // mantidos como estilos órfãos por ora (sem custo em runtime; reaproveitar
  // em outro modal futuro é natural).
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

  // (mesma família visual do errBox de RedistribuirPraticantesModal.tsx).
  errBoxInline: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.redWash, borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11, marginTop: 14 } as ViewStyle,
  errTxtInline: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  // Toast inline
  toast: { position: "absolute", left: 20, right: 20, bottom: 24, alignSelf: "center", maxWidth: 460, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 12, paddingHorizontal: 16 } as ViewStyle,
  toastTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: "#fdf8f2", flex: 1 } as TextStyle,
  toastUndo: { fontFamily: F.body, fontSize: 13, fontWeight: "800", color: "#f4d9a0" } as TextStyle,
});
