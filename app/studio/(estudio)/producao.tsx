// ============================================================
// AURA STUDIO · KDS de Produção (Fase 4 + UX overhaul 25/05 + Marketplaces S-0)
//
// 6 colunas: Aguardando personalização → Aguardando arte → Aprovado → Em produção → Pronto → Entregue
//
// Marketplaces S-0 (25/05/2026): awaiting_customization é a 1ª coluna (âmbar
// via StudioSemantic). Pedidos vindos de ML/Shopee chegam aqui (vertical='studio',
// customization_collected_at IS NULL). Lojista coleta a personalização e
// avança pra pending_art.
//
// Item #3 do follow-up: empty state celebratório quando fila vazia.
//
// Fase 3 (26/05/2026): loading + empty states migrados pra StudioLoading
// e StudioEmpty (componentes globais Studio).
//
// 26/05/2026 (residual UX overhaul): tokens dinamicos via useStudioTokens()
// + StudioPageHeader padronizado + AnimatedKpiCounter no colCount (pulsa
// quando pedido muda de coluna).
//
// 30/05/2026 (P1 Camada 1): advance() agora trata 409 deposit_required.
// Quando backend retorna 409, reverte o optimistic update e exibe Alert
// de confirmação. Ao confirmar, reenvia com force:true.
//
// 05/06/2026 (M2 DnD): drag-and-drop via useStudioKanbanDnD (web-only).
// Botões de avanço mantidos como fallback (mobile/native).
//
// fix(build): KanbanColumn sub-component extraído pra que useDropZoneRef
// seja chamado no top-level de um componente (não dentro de .map()).
// O genérico <StudioProductionStatus> dentro do .map() fazia o Babel
// interpretar o angle bracket como JSX e lançar SyntaxError.
// ============================================================
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Modal, Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { confirmAlert } from "@/utils/webAlert";
import { Icon } from "@/components/Icon";
import { useStudioTokens, useStudioSemantic } from "@/contexts/StudioThemeMode";
import { StudioScreen } from "@/components/studio/StudioScreen";
import type { StudioPalette } from "@/constants/studio-tokens";
import type { StudioSemanticPalette } from "@/constants/studio-semantic";
import { studioApi, type StudioOrder, type StudioProductionStatus, type MarketplaceOrderStudio } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { ApprovalRequestModal } from "@/components/studio/ApprovalRequestModal";
import { CollectCustomizationModal } from "@/components/studio/CollectCustomizationModal";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { AnimatedKpiCounter } from "@/components/studio/AnimatedKpiCounter";
import { useCobrarSaldo } from "@/components/studio/useCobrarSaldo";
import { useRegistrarPagamento } from "@/components/studio/useRegistrarPagamento";
import { RegistrarPagamentoSheet } from "@/components/studio/RegistrarPagamentoSheet";
import { resumoDaSemana, colunaGargalo, riscoDoCard } from "@/components/studio/fluxoDoQuadro";
import {
  useStudioKanbanDnD,
  useDraggableCardRef,
  useDropZoneRef,
} from "@/components/studio/kanban/useStudioKanbanDnD";

type Column = {
  key: StudioProductionStatus;
  label: string;
  icon: string;
  color: string;
  bg: string;
  nextLabel: string;
};

// Cores das colunas vêm de StudioSemantic (fonte única de cor de estado,
// theme-aware, AA). Mata o magenta-pra-estado das colunas awaiting/in_production.
function buildColumns(sem: StudioSemanticPalette): Column[] {
  return [
    // S-0: 1ª coluna pra pedidos de marketplace (ML/Shopee) sem personalização coletada.
    { key: "awaiting_customization", label: "Aguardando personalização", icon: "message-circle", color: sem.waiting.base,    bg: sem.waiting.soft,    nextLabel: "Coletar e enviar pra arte" },
    { key: "pending_art",   label: "Aguardando arte",  icon: "alert-circle", color: sem.art.base,        bg: sem.art.soft,        nextLabel: "Marcar como aprovado" },
    { key: "approved",      label: "Aprovado",         icon: "check",        color: sem.approved.base,   bg: sem.approved.soft,   nextLabel: "Iniciar produção" },
    { key: "in_production", label: "Em produção",      icon: "clock",        color: sem.production.base, bg: sem.production.soft, nextLabel: "Marcar como pronto" },
    { key: "ready",         label: "Pronto",           icon: "package",      color: sem.ready.base,      bg: sem.ready.soft,      nextLabel: "Marcar como entregue" },
    { key: "delivered",     label: "Entregue",         icon: "check-circle", color: sem.delivered.base,  bg: sem.delivered.soft,  nextLabel: "" },
    // FIX (bug #16 QA): pedidos cancelled não tinham NENHUMA coluna — o
    // loop de agrupamento (byStatus) descartava silenciosamente porque só
    // conhecia as chaves das colunas construídas aqui. Coluna própria dá
    // visibilidade sem exigir ação (NEXT_STATUS[cancelled] já é null).
    { key: "cancelled",     label: "Cancelados",       icon: "x-circle",     color: sem.danger.base,     bg: sem.danger.soft,     nextLabel: "" },
  ];
}

const NEXT_STATUS: Record<StudioProductionStatus, StudioProductionStatus | null> = {
  awaiting_customization: "pending_art",
  pending_art:   "approved",
  approved:      "in_production",
  in_production: "ready",
  ready:         "delivered",
  delivered:     null,
  cancelled:     null,
};

// FIX (bug #20 QA): "shopee" hardcoded hex fora dos tokens Studio.
function buildPlatformLabels(t: StudioPalette): Record<string, { label: string; bg: string; fg: string }> {
  return {
    mercado_livre: { label: "Mercado Livre", bg: t.warningSoft, fg: t.warningInk },
    shopee:        { label: "Shopee",        bg: t.dangerSoft,  fg: t.dangerInk },
  };
}

function fmtSla(createdAt: string): { txt: string; tone: "fresh" | "warm" | "late" } {
  const d = new Date(createdAt);
  const hours = (Date.now() - d.getTime()) / 3600000;
  if (hours < 24)  return { txt: `${Math.round(hours)}h atrás`,            tone: "fresh" };
  if (hours < 72)  return { txt: `${Math.round(hours / 24)}d atrás`,       tone: "warm" };
  return                   { txt: `${Math.round(hours / 24)}d (urgente)`,  tone: "late" };
}

// K1 (18/08/2026) — dias até a data prometida. Compara em UTC a partir das
// partes da string: 'YYYY-MM-DD' é data pura, e passar por new Date() a
// leria como UTC, voltando um dia no fuso de São Paulo.
function diasAte(iso: string): number {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return NaN;
  const n = new Date();
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000,
  );
}

// A urgência vem da PROMESSA, não da idade do pedido. Um pedido de 3 dias
// pode estar tranquilo (entrega semana que vem) ou estourando (era pra
// ontem) — a idade não distingue os dois, então o vermelho estava medindo a
// coisa errada. Sem prazo combinado, cai na idade: comportamento de sempre.
function fmtPrazo(
  promised: string | null | undefined,
  createdAt: string,
): { txt: string; tone: "fresh" | "warm" | "late" } {
  if (!promised) return fmtSla(createdAt);
  const dias = diasAte(promised);
  if (isNaN(dias)) return fmtSla(createdAt);
  if (dias < 0)   return { txt: `atrasou ${Math.abs(dias)}d`,          tone: "late" };
  if (dias === 0) return { txt: "entrega hoje",                        tone: "late" };
  if (dias === 1) return { txt: "entrega amanhã",                      tone: "warm" };
  if (dias <= 3)  return { txt: `entrega ${fmtDueShort(promised)}`,    tone: "warm" };
  return            { txt: `entrega ${fmtDueShort(promised)}`,         tone: "fresh" };
}

// Vencimento vem como 'YYYY-MM-DD' (date puro) — construir Date a partir
// disso interpreta como UTC e volta um dia no fuso de São Paulo.
function fmtDueShort(iso?: string | null) {
  if (!iso) return "";
  const [, m, d] = String(iso).slice(0, 10).split("-");
  return d && m ? `${d}/${m}` : String(iso);
}

// ── DraggableCard (sub-componente que consome o ref do hook) ─────────────────
// Separado para poder chamar useDraggableCardRef como hook (regra dos hooks:
// não pode ser chamado dentro de .map() diretamente).
function DraggableCard({
  o, col, t, s, dnd, NEXT_STATUS: NEXT, PLATFORM_LABELS, onAdvance, onApproval, onCollect,
  onCobrar, cobrandoId, onRegistrarPagamento, registrandoId, router,
}: {
  o: StudioOrder;
  col: Column;
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
  dnd: ReturnType<typeof useStudioKanbanDnD>;
  NEXT_STATUS: Record<StudioProductionStatus, StudioProductionStatus | null>;
  PLATFORM_LABELS: Record<string, { label: string; bg: string; fg: string }>;
  onAdvance: (order: StudioOrder) => void;
  onApproval: (order: StudioOrder) => void;
  onCollect: (order: StudioOrder) => void;
  onCobrar: (order: StudioOrder) => void;
  cobrandoId: string | null;
  onRegistrarPagamento: (order: StudioOrder) => void;
  registrandoId: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  const cardRef = useDraggableCardRef(dnd.isWeb, o.id, dnd.onCardDragStart, dnd.onCardDragEnd);
  const sla = fmtPrazo(o.promised_date, o.created_at);
  // K4: risco não é só "o prazo está perto" — é prazo perto COM o trabalho
  // ainda no começo. Entrega amanhã já pronta não é risco, é entrega amanhã.
  const risco = riscoDoCard(o);
  // A imagem pode faltar (54% de cobertura hoje) e pode falhar ao carregar.
  // Os dois casos caem no mesmo lugar: o monograma, que sempre existe.
  const [imgFalhou, setImgFalhou] = useState(false);
  const capa = !imgFalhou ? (o.card_image_url || null) : null;
  const inicial = (o.customer_name || o.display_name || "?").trim().charAt(0).toUpperCase();
  const next = NEXT[col.key];
  const platformMeta = o.marketplace_platform ? PLATFORM_LABELS[o.marketplace_platform] : null;
  const isDragging = dnd.draggingId === o.id;

  return (
    <Pressable
      ref={cardRef}
      key={o.id}
      style={[s.card, isDragging && s.cardDragging]}
      onPress={() => router.push(`/studio/pedidos/${o.id}` as any)}
    >
      {dnd.isWeb && (
        <View style={s.dragHandle}>
          <Icon name="drag-handle" size={14} color={t.ink4} />
        </View>
      )}
      {/* K1: o produto é a imagem. Personalizado se vende pelo olho — um card
          só de texto é uma planilha em pé. Sem foto, o monograma segura a
          composição em vez de deixar um vão. */}
      {capa ? (
        <Image
          source={{ uri: capa }}
          style={s.capa}
          resizeMode="cover"
          onError={() => setImgFalhou(true)}
          accessibilityLabel={`Arte de ${o.customer_name || o.display_name || "encomenda"}`}
        />
      ) : (
        <View style={[s.capa, s.capaVazia]}>
          <Text style={s.capaInicial}>{inicial}</Text>
        </View>
      )}
      <View style={s.cardHead}>
        <Text style={s.cardId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
        <View style={[s.slaChip,
                      sla.tone === "warm"  ? { backgroundColor: t.warningSoft } :
                      sla.tone === "late"  ? { backgroundColor: t.dangerSoft } : null]}>
          <Text style={[s.slaTxt,
                        sla.tone === "warm" ? { color: t.warningInk } :
                        sla.tone === "late" ? { color: t.dangerInk } : null]}>
            {sla.txt}
          </Text>
        </View>
      </View>
      <Text style={s.cardName} numberOfLines={1}>
        {o.display_name || "Sem cadastro"}
      </Text>
      <Text style={s.cardMeta}>
        {/* FIX (bug #18 QA): "1 items" — item_count às vezes chega como string
            do backend (COUNT() do Postgres), então "=== 1" (comparação
            estrita) nunca batia e sempre caía no plural. Number() normaliza. */}
        {o.item_count} item{Number(o.item_count) === 1 ? "" : "s"} · R$ {Number(o.total_amount).toFixed(2)}
      </Text>
      {platformMeta && (
        <View style={[s.platformBadge, { backgroundColor: platformMeta.bg }]}>
          <Icon name="shopping-bag" size={10} color={platformMeta.fg} />
          <Text style={[s.platformBadgeTxt, { color: platformMeta.fg }]}>
            {platformMeta.label}
          </Text>
        </View>
      )}
      {o.pending_approval_url && (
        <View style={s.approvalBadge}>
          <Icon name="message-circle" size={10} color={t.infoInk} />
          <Text style={s.approvalBadgeTxt}>Aprovação enviada</Text>
        </View>
      )}
      {/* 17/08/2026 — saldo da encomenda fechada com sinal.
          Cobrança e produção são eixos INDEPENDENTES: cobrar não move o
          pedido de coluna, e o pedido anda de coluna com saldo em aberto. */}
      {o.balance_amount != null && (
        <View style={[s.balanceBadge, o.balance_status === "overdue" && { backgroundColor: t.dangerSoft }]}>
          <Icon name="dollar-sign" size={10} color={o.balance_status === "overdue" ? t.dangerInk : t.warningInk} />
          <Text style={[s.balanceBadgeTxt, o.balance_status === "overdue" && { color: t.dangerInk }]}>
            R$ {Number(o.balance_amount).toFixed(2)} · {o.balance_status === "overdue" ? "venceu" : "vence"} {fmtDueShort(o.balance_due_date)}
          </Text>
        </View>
      )}
      {risco === "apertado" && (
        <View style={s.riscoAviso}>
          <Icon name="alert-triangle" size={11} color={t.warningInk} />
          <Text style={s.riscoTxt}>Entrega chegando e ainda não foi pra produção</Text>
        </View>
      )}
      {/* 27/08/2026 — os dois lados do saldo, lado a lado: mandar a cobrança e
          registrar que entrou. Antes só existia o primeiro, e quem recebia o
          Pix não tinha onde dar baixa. "Recebi" fica à direita e em verde
          porque é o botão que ENCERRA o assunto. */}
      {/* balance_amount != null junto do id: o handler já desistia sem o
          valor, então sem esta condição o botão apareceria clicável e não
          faria nada. Mesmo critério do balanceBadge acima. */}
      {o.balance_installment_id && o.balance_amount != null && (
        <View style={s.saldoAcoes}>
          <Pressable
            style={[s.btnCobrar, { flex: 1 }]}
            disabled={cobrandoId === o.balance_installment_id}
            onPress={(e) => { e.stopPropagation && e.stopPropagation(); onCobrar(o); }}
            accessibilityRole="button"
            accessibilityLabel={`Cobrar saldo de ${o.customer_name || o.display_name || "cliente"} pelo WhatsApp`}
          >
            <Icon name="message-circle" size={12} color={t.primary} />
            <Text style={s.btnCobrarTxt}>
              {cobrandoId === o.balance_installment_id ? "Abrindo..." : "Cobrar saldo"}
            </Text>
          </Pressable>
          <Pressable
            style={[s.btnRecebi, { flex: 1 }]}
            disabled={registrandoId === o.balance_installment_id}
            onPress={(e) => { e.stopPropagation && e.stopPropagation(); onRegistrarPagamento(o); }}
            accessibilityRole="button"
            accessibilityLabel={`Registrar recebimento de ${o.customer_name || o.display_name || "cliente"}`}
          >
            <Icon name="check-circle" size={12} color={t.successInk} />
            <Text style={s.btnRecebiTxt}>Recebi</Text>
          </Pressable>
        </View>
      )}
      <View style={s.cardActions}>
        {col.key === "awaiting_customization" && (
          <Pressable
            style={[s.btnApproval, { backgroundColor: t.accent }]}
            onPress={(e) => { e.stopPropagation && e.stopPropagation(); onCollect(o); }}
          >
            <Icon name="message-circle" size={12} color="#fff" />
            <Text style={s.btnApprovalTxt}>Coletar personalização</Text>
          </Pressable>
        )}
        {col.key === "pending_art" && (
          <Pressable
            style={s.btnApproval}
            onPress={(e) => { e.stopPropagation && e.stopPropagation(); onApproval(o); }}
          >
            <Icon name="message-circle" size={12} color="#fff" />
            <Text style={s.btnApprovalTxt}>Solicitar aprovação</Text>
          </Pressable>
        )}
        {next && (
          <Pressable
            style={[s.btnAdvance, { backgroundColor: col.color }]}
            onPress={(e) => { e.stopPropagation && e.stopPropagation(); onAdvance(o); }}
          >
            <Text style={s.btnAdvanceTxt}>{col.nextLabel} →</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ── KanbanColumn ─────────────────────────────────────────────────────────────
// Sub-componente para cada coluna do kanban.
// useDropZoneRef é chamado aqui no top-level — nunca dentro de .map().
// O genérico é omitido na chamada (inferência de tipo) para evitar que o
// Babel interprete o angle-bracket como JSX em contexto de expressão.
function KanbanColumn({
  col, orders, t, s, dnd, PLATFORM_LABELS, onAdvance, onApproval, onCollect,
  onCobrar, cobrandoId, onRegistrarPagamento, registrandoId, ehGargalo, highlighted, router,
}: {
  col: Column;
  orders: StudioOrder[];
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
  dnd: ReturnType<typeof useStudioKanbanDnD>;
  PLATFORM_LABELS: Record<string, { label: string; bg: string; fg: string }>;
  onAdvance: (order: StudioOrder) => void;
  onApproval: (order: StudioOrder) => void;
  onCollect: (order: StudioOrder) => void;
  onCobrar: (order: StudioOrder) => void;
  cobrandoId: string | null;
  onRegistrarPagamento: (order: StudioOrder) => void;
  registrandoId: string | null;
  ehGargalo: boolean;
  highlighted?: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  // Hook chamado no top-level do componente — sem genérico explícito (inferido).
  const dropRef = useDropZoneRef(col.key as StudioProductionStatus, dnd.onDrop, dnd.onHoverChange);
  const isHovered = dnd.hoverStatus === col.key && dnd.draggingId !== null;

  return (
    <View
      ref={dropRef}
      style={[
        s.col,
        isHovered && { borderColor: col.color, borderWidth: 2, backgroundColor: col.bg },
        // Bug #9 QA: deep-link ?intent=approval destaca a coluna alvo.
        highlighted && { borderColor: col.color, borderWidth: 3 },
      ]}
    >
      <View style={[s.colHead, { backgroundColor: col.bg }]}>
        <View style={[s.colDot, { backgroundColor: col.color }]}>
          <Icon name={col.icon as any} size={12} color="#fff" />
        </View>
        <Text style={[s.colTitle, { color: col.color }]}>{col.label}</Text>
        <AnimatedKpiCounter
          value={orders.length}
          fontSize={12}
          color={t.ink2}
        />
      </View>
      {/* K4: a etapa que está segurando o fluxo. Sem número pra configurar e
          sem jargão — a frase diz o que fazer com a informação. */}
      {ehGargalo && (
        <View style={s.gargaloAviso}>
          <Icon name="alert-circle" size={12} color={t.warningInk} />
          <Text style={s.gargaloTxt}>A fila está parando aqui</Text>
        </View>
      )}
      <ScrollView style={s.colScroll} contentContainerStyle={{ padding: 10, gap: 10 }}>
        {orders.length === 0 ? (
          <Text style={s.colEmpty}>—</Text>
        ) : orders.map((o) => (
          <DraggableCard
            key={o.id}
            o={o}
            col={col}
            t={t}
            s={s}
            dnd={dnd}
            NEXT_STATUS={NEXT_STATUS}
            PLATFORM_LABELS={PLATFORM_LABELS}
            onAdvance={onAdvance}
            onApproval={onApproval}
            onCollect={onCollect}
            onCobrar={onCobrar}
            cobrandoId={cobrandoId}
            onRegistrarPagamento={onRegistrarPagamento}
            registrandoId={registrandoId}
            router={router}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function StudioProducao() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const sem = useStudioSemantic();
  const COLUMNS = useMemo(() => buildColumns(sem), [sem]);
  const PLATFORM_LABELS = useMemo(() => buildPlatformLabels(t), [t]);

  const { company } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<StudioOrder[]>([]);
  // FIX (bug #13 QA): erro engolido virava empty state mentiroso ("Fila
  // vazia" quando na verdade o fetch falhou). Estado dedicado + retry.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approvalFor, setApprovalFor] = useState<StudioOrder | null>(null);
  // FIX (bug #7 QA): coletar personalização direto no KDS em vez de navegar
  // pro detalhe do pedido (que não tem editor de customization).
  const [collectFor, setCollectFor] = useState<MarketplaceOrderStudio | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  // FIX (bug #9 QA): deep-link ?intent=approval — rola até e destaca a
  // coluna "Aguardando arte" (pending_art).
  const [highlightCol, setHighlightCol] = useState<StudioProductionStatus | null>(null);
  const boardScrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    // FIX (bug #14 QA): return antes do setLoading(false) deixava o
    // skeleton girando pra sempre quando company ainda não tinha carregado.
    if (!company?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await studioApi.listOrders(company.id, { days: 60, limit: 300 });
      setOrders(r.orders || []);
      setLoadError(null);
    } catch (e: any) {
      const msg = e?.message || "Erro ao carregar pedidos";
      toast.error(msg);
      setLoadError(msg);
    } finally { setLoading(false); }
  }, [company?.id]);

  // FIX (bug #15 QA): dados não recarregavam ao voltar pra tela (ex: avançar
  // status no detalhe do pedido e voltar pro kanban mostrava o card na
  // coluna antiga). useFocusEffect recarrega toda vez que a tela ganha foco
  // — cobre tanto o mount inicial quanto voltar de outra rota.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // FIX (bug #9 QA): consome ?intent=approval — rola até a coluna
  // "Aguardando arte" e destaca por alguns segundos. router.replace() tira o
  // param da URL pra não reaplicar em todo re-render (ex: depois de mover
  // um card, o componente re-renderiza e reaplicaria o scroll de novo).
  //
  // O timer do destaque mora numa ref, NÃO no cleanup do efeito: o próprio
  // router.replace() muda `params.intent`, o que re-dispara este efeito e
  // rodaria o cleanup — matando o timer antes dos 2.6s e deixando a coluna
  // destacada pra sempre. A ref sobrevive à re-execução; o unmount limpa.
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  useEffect(() => {
    if (params?.intent !== "approval" || loading) return;
    const idx = COLUMNS.findIndex((c) => c.key === "pending_art");
    if (idx >= 0) {
      const COL_WIDTH = 280, GAP = 14;
      boardScrollRef.current?.scrollTo({ x: idx * (COL_WIDTH + GAP), animated: true });
    }
    setHighlightCol("pending_art");
    router.replace("/studio/producao" as any);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightCol(null), 2600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.intent, loading]);

  // FIX (bug #7 QA): abre o CollectCustomizationModal direto no KDS.
  // O card do KDS só tem o StudioOrder (sem items/product_id), então busca
  // o MarketplaceOrderStudio completo via listMarketplaceOrders.
  //
  // O casamento é por `marketplace_order_id`, NÃO pelo `id` do pedido: na
  // lista unificada o `id` é da linha do pedido (que também cobre digital
  // e PDV) e o id do marketplace vem numa coluna à parte — casar pelo `id`
  // nunca acha nada e o botão morre em "não localizei o pedido".
  const openCollect = useCallback(async (order: StudioOrder) => {
    if (!company?.id || collectingId) return;
    const mktId = order.marketplace_order_id;
    if (!mktId) {
      toast.error("Esse pedido não veio de marketplace — a personalização é coletada no próprio pedido.");
      return;
    }
    setCollectingId(order.id);
    try {
      const r = await studioApi.listMarketplaceOrders(company.id, { pending_only: true, limit: 300 });
      const found = (r.orders || []).find((o) => o.id === mktId);
      if (found) {
        setCollectFor(found);
      } else {
        toast.error("Não foi possível localizar os dados desse pedido pra coletar a personalização.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar pedido");
    } finally {
      setCollectingId(null);
    }
  }, [company?.id, collectingId]);

  // ── moveTo: lógica central de mover um pedido para qualquer status ────────
  // Preserva o tratamento de 409 deposit_required (P1 Camada 1).
  // advance() chama moveTo(order, NEXT_STATUS[cur]) para manter compat.
  // onDrop() de DnD também chama moveTo(order, targetStatus).
  const moveTo = useCallback(async (
    order: StudioOrder,
    targetStatus: StudioProductionStatus,
    force?: boolean,
  ) => {
    if (!company?.id) return;
    const cur = (order.studio_production_status || "pending_art") as StudioProductionStatus;
    // Optimistic update
    setOrders((prev) => prev.map((o) =>
      o.id === order.id ? { ...o, studio_production_status: targetStatus } : o
    ));
    try {
      await studioApi.updateProductionStatus(company.id, order.id, targetStatus, force);
      const col = COLUMNS.find((c) => c.key === targetStatus);
      toast.success(`✨ Movido pra ${col?.label}`);
    } catch (e: any) {
      // P1: gate de sinal — backend retorna 409 deposit_required quando
      // require_deposit_for_production=true e sinal não está confirmado.
      if (
        (e?.status === 409 || e?.code === 409) &&
        (e?.data?.error === "deposit_required" || e?.error === "deposit_required")
      ) {
        // Reverte optimistic update antes de pedir confirmação
        setOrders((prev) => prev.map((o) =>
          o.id === order.id ? { ...o, studio_production_status: cur } : o
        ));
        // FIX (bug #4 QA): Alert.alert é no-op no react-native-web — o
        // onPress do botão "Iniciar mesmo assim" nunca disparava. confirmAlert
        // usa window.confirm no web e Alert.alert no nativo.
        confirmAlert(
          "Sinal não recebido",
          e?.data?.message || e?.message ||
            "O sinal deste pedido ainda não foi confirmado. Deseja iniciar a produção mesmo assim?",
          "Iniciar mesmo assim",
          () => moveTo(order, targetStatus, true),
          { destructive: true }
        );
        return;
      }
      toast.error(e?.message || "Erro ao atualizar");
      load();
    }
  }, [company?.id, COLUMNS, load]);

  // advance() = atalho para mover para o próximo status canônico
  const advance = useCallback((order: StudioOrder) => {
    const cur = (order.studio_production_status || "pending_art") as StudioProductionStatus;
    const next = NEXT_STATUS[cur];
    if (!next) return;
    moveTo(order, next);
  }, [moveTo]);

  // ── DnD setup ───────────────────────────────────────────────────────────
  // onDrop: recebe (orderId, toStatus) do drop zone e chama moveTo.
  // Política v1: permite drop em qualquer coluna — o gate 409 continua valendo.
  const onDrop = useCallback((orderId: string, toStatus: StudioProductionStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    moveTo(order, toStatus);
  }, [orders, moveTo]);

  const dnd = useStudioKanbanDnD(onDrop);

  // Cobrar o saldo da encomenda. Deliberadamente NÃO recarrega o board nem
  // mexe no status: a lojista só abriu o WhatsApp; o saldo continua em aberto
  // até o pagamento entrar de fato.
  const { cobrar, cobrandoId } = useCobrarSaldo(company?.id);
  const onCobrar = useCallback((o: StudioOrder) => {
    if (!o.balance_installment_id) return;
    cobrar({
      orderId: o.id,
      installmentId: o.balance_installment_id,
      phone: o.customer_phone,
      customerName: o.customer_name,
      dueDate: o.balance_due_date,
      status: o.balance_status,
    });
  }, [cobrar]);

  // 27/08/2026 — dar baixa no saldo. Ao contrário do cobrar, ESTE recarrega:
  // o dinheiro entrou, e o card tem que parar de dizer que deve. Continua sem
  // mexer no status de produção — receber e fabricar seguem eixos
  // independentes (encomenda quitada pode estar só na fila da arte).
  const baixa = useRegistrarPagamento(company?.id, { onSucesso: load });
  const onRegistrarPagamento = useCallback((o: StudioOrder) => {
    if (!o.balance_installment_id || o.balance_amount == null) return;
    baixa.abrir({
      orderId: o.id,
      installmentId: o.balance_installment_id,
      customerName: o.customer_name,
      amount: Number(o.balance_amount) || 0,
      dueDate: o.balance_due_date,
      status: o.balance_status,
    });
  }, [baixa]);

  const byStatus: Record<string, StudioOrder[]> = {};
  for (const col of COLUMNS) byStatus[col.key] = [];
  for (const o of orders) {
    const key = (o.studio_production_status || "pending_art") as StudioProductionStatus;
    if (byStatus[key]) byStatus[key].push(o);
  }

  // #3: detecta "fila completamente vazia exceto delivered/cancelled" — celebra.
  // Cancelled não conta como trabalho pendente nem impede a celebração.
  const activeCount = COLUMNS.filter((c) => c.key !== "delivered" && c.key !== "cancelled").reduce(
    (sum, c) => sum + byStatus[c.key].length, 0
  );
  const allCaughtUp = !loading && orders.length > 0 && activeCount === 0;

  // K4: leitura do fluxo. Tudo derivado do que já está na tela — nenhum
  // campo novo, nenhuma configuração, nenhuma chamada extra.
  const semana = useMemo(() => resumoDaSemana(orders), [orders]);
  // Cancelled fica fora da detecção de gargalo — pedido cancelado parado
  // ali não é fila emperrando, é só o fim da linha.
  const colunasAtivas = useMemo(() => COLUMNS.filter((c) => c.key !== "delivered" && c.key !== "cancelled").map((c) => c.key), [COLUMNS]);
  const gargalo = useMemo(() => colunaGargalo(byStatus, colunasAtivas), [byStatus, colunasAtivas]);

  return (
    <StudioScreen variant="board" scroll={false} padded={false}>
      <View style={s.headerWrap}>
        <StudioPageHeader
          eyebrow="FLUXO DE PRODUÇÃO"
          title="Fila de produção"
          // FIX (bug #18 QA): drag-and-drop é web-only (useStudioKanbanDnD),
          // então o copy não pode prometer "arraste" em mobile/nativo. Acento
          // de "botões" corrigido de quebra.
          subtitle={dnd.isWeb ? "Arraste os cards (ou use os botões) pra mover." : "Use os botões dos cards pra mover entre as etapas."}
          rightSlot={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {/* K2: um botão, nada pra configurar antes. */}
              <Pressable style={s.reloadBtn} onPress={() => router.push("/studio/vitrine" as any)}>
                <Icon name="layout-grid" size={14} color={t.ink2} />
                <Text style={s.reloadTxt}>Modo vitrine</Text>
              </Pressable>
              <Pressable style={s.reloadBtn} onPress={load} disabled={loading}>
                <Icon name="refresh-cw" size={14} color={t.ink2} />
                <Text style={s.reloadTxt}>{loading ? "Atualizando…" : "Atualizar"}</Text>
              </Pressable>
            </View>
          }
        />

      {/* K4: régua da semana. Só aparece quando há prazo pra falar — sem
          prazo combinado, o quadro fica igual ao que era. */}
      {(semana.total > 0 || semana.atrasadas > 0) && (
        <View style={s.reguaWrap}>
          <View style={s.regua}>
            <Icon name="calendar-outline" size={15} color={t.ink2} />
            <Text style={s.reguaTxt}>
              {semana.total > 0
                ? `${semana.total} ${semana.total === 1 ? "entrega" : "entregas"} até o fim da semana`
                : "Nenhuma entrega marcada para esta semana"}
              {semana.hoje > 0 ? ` · ${semana.hoje} hoje` : ""}
            </Text>
            {semana.atrasadas > 0 && (
              <View style={[s.reguaSelo, { backgroundColor: sem.danger.soft }]}>
                <Text style={[s.reguaSeloTxt, { color: sem.danger.base }]}>
                  {semana.atrasadas} {semana.atrasadas === 1 ? "atrasada" : "atrasadas"}
                </Text>
              </View>
            )}
            {semana.emRisco > semana.atrasadas && (
              <View style={[s.reguaSelo, { backgroundColor: sem.waiting.soft }]}>
                <Text style={[s.reguaSeloTxt, { color: sem.waiting.base }]}>
                  {semana.emRisco - semana.atrasadas} em cima da hora
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
      </View>

      {loading && orders.length === 0 ? (
        <StudioLoading variant="skeleton-grid" rows={3} />
      ) : loadError && orders.length === 0 ? (
        // FIX (bug #13 QA): erro de carregamento é distinto de fila vazia.
        <StudioEmpty
          tone="warning"
          icon="alert-circle"
          title="Não deu pra carregar a fila"
          desc={loadError}
          primaryCta={{ label: "Tentar de novo", onPress: load }}
        />
      ) : orders.length === 0 ? (
        // Empty state: fila vazia
        <StudioEmpty
          icon="package"
          title="Fila de produção vazia"
          desc="Quando entrar um pedido novo, ele aparece aqui automaticamente."
          primaryCta={{ label: "Ver pedidos do dia", onPress: () => router.push("/studio/pedidos" as any) }}
        />
      ) : allCaughtUp ? (
        // #3: tudo entregue → celebra
        <StudioEmpty
          emoji="🎉"
          title="Tudo entregue!"
          desc="Nenhum pedido na produção agora."
          tone="celebration"
          primaryCta={{ label: "Novo pedido", onPress: () => router.push("/studio/pedidos" as any) }}
        />
      ) : (
        <ScrollView ref={boardScrollRef} horizontal style={s.boardScroll} contentContainerStyle={s.board}>
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key}
              col={col}
              orders={byStatus[col.key]}
              t={t}
              s={s}
              dnd={dnd}
              PLATFORM_LABELS={PLATFORM_LABELS}
              onAdvance={advance}
              onApproval={setApprovalFor}
              onCollect={openCollect}
              onCobrar={onCobrar}
              cobrandoId={cobrandoId}
              onRegistrarPagamento={onRegistrarPagamento}
              registrandoId={baixa.registrandoId}
              ehGargalo={gargalo === col.key}
              highlighted={highlightCol === col.key}
              router={router}
            />
          ))}
        </ScrollView>
      )}

      <Modal
        visible={!!approvalFor}
        animationType="slide"
        onRequestClose={() => setApprovalFor(null)}
      >
        {approvalFor && (
          <ApprovalRequestModal
            order={approvalFor}
            onClose={() => setApprovalFor(null)}
            onSent={() => { setApprovalFor(null); load(); }}
          />
        )}
      </Modal>

      <Modal
        visible={!!collectFor}
        animationType="slide"
        onRequestClose={() => setCollectFor(null)}
      >
        {collectFor && (
          <CollectCustomizationModal
            order={collectFor}
            onClose={() => setCollectFor(null)}
            onSaved={() => { setCollectFor(null); load(); }}
          />
        )}
      </Modal>

      {/* Baixa do saldo — o sheet cuida do próprio visible via controller. */}
      <RegistrarPagamentoSheet controller={baixa} />
    </StudioScreen>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: t.bg },
    headerWrap: {
      paddingHorizontal: 28, paddingTop: 24, paddingBottom: 16,
    },
    reloadBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
      backgroundColor: t.paperCardElev, borderWidth: 1.5, borderColor: t.ink5,
    },
    reloadTxt: { fontSize: 12.5, color: t.ink2, fontWeight: "600" },

    boardScroll: { flex: 1 },
    board: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
    col: {
      width: 280,
      backgroundColor: t.paperCard,
      borderRadius: 16,
      borderWidth: 1, borderColor: t.ink5,
      overflow: "hidden",
      height: "100%",
    },
    colHead: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 14, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: t.ink5,
    },
    colDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    colTitle: { fontSize: 13, fontWeight: "800", flex: 1, letterSpacing: -0.1 },
    colScroll: { flex: 1, minHeight: 200 },
    colEmpty: { color: t.ink4, fontSize: 12, textAlign: "center", paddingVertical: 14 },

    card: {
      backgroundColor: t.paperCardElev,
      borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: t.ink5,
      gap: 6,
    },
    cardDragging: {
      opacity: 0.55,
    },
    dragHandle: {
      alignSelf: "center",
      marginBottom: 2,
    },
    // K1 — capa do card
    capa: {
      width: "100%", aspectRatio: 16 / 10, borderRadius: 8,
      marginBottom: 8, backgroundColor: t.bgSoft,
    },
    capaVazia: {
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: t.ink5,
    },
    capaInicial: { fontSize: 26, fontWeight: "800", color: t.ink4 },
    cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardId: { fontSize: 10.5, color: t.ink4, fontWeight: "700", letterSpacing: 0.5 },
    slaChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: t.bgSoft },
    slaTxt: { fontSize: 10.5, fontWeight: "700", color: t.ink3 },
    cardName: { fontSize: 13.5, fontWeight: "700", color: t.ink, marginTop: 2 },
    cardMeta: { fontSize: 11.5, color: t.ink3 },
    platformBadge: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
      alignSelf: "flex-start", marginTop: 4,
    },
    platformBadgeTxt: { fontSize: 10.5, fontWeight: "800" },
    approvalBadge: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: t.infoSoft,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
      alignSelf: "flex-start", marginTop: 4,
    },
    approvalBadgeTxt: { fontSize: 10.5, color: t.infoInk, fontWeight: "700" },
    // 18/08/2026 (K4) — leitura do fluxo
    reguaWrap:   { paddingHorizontal: 20, paddingBottom: 10 },
    regua: {
      flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap",
      backgroundColor: t.bgSoft, borderRadius: 10, borderWidth: 1, borderColor: t.ink5,
      paddingHorizontal: 14, paddingVertical: 10,
    },
    reguaTxt:    { fontSize: 13, color: t.ink2, fontWeight: "600", flexShrink: 1 },
    reguaSelo:   { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
    reguaSeloTxt:{ fontSize: 11.5, fontWeight: "800" },
    gargaloAviso: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 12, paddingVertical: 6, backgroundColor: t.warningSoft,
    },
    gargaloTxt:  { fontSize: 11, color: t.warningInk, fontWeight: "700" },
    riscoAviso: {
      flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
      marginTop: 6, paddingHorizontal: 7, paddingVertical: 3,
      borderRadius: 6, backgroundColor: t.warningSoft,
    },
    riscoTxt:    { fontSize: 10.5, color: t.warningInk, fontWeight: "700", flexShrink: 1 },
    // 17/08/2026 — saldo da encomenda
    balanceBadge: {
      flexDirection: "row", alignItems: "center", gap: 5,
      alignSelf: "flex-start", marginTop: 6,
      paddingHorizontal: 7, paddingVertical: 3,
      borderRadius: 6, backgroundColor: t.warningSoft,
    },
    balanceBadgeTxt: { fontSize: 10.5, color: t.warningInk, fontWeight: "700" },
    // 27/08/2026 — cobrar e dar baixa dividem a linha. O marginTop saiu do
    // botão e foi pro container: com ele nos dois filhos, o row desalinhava.
    saldoAcoes: { flexDirection: "row", gap: 6, marginTop: 6 },
    btnCobrar: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
      paddingVertical: 6, borderRadius: 8,
      borderWidth: 1, borderColor: t.primary,
    },
    btnCobrarTxt: { fontSize: 11.5, color: t.primary, fontWeight: "700" },
    btnRecebi: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
      paddingVertical: 6, borderRadius: 8,
      borderWidth: 1, borderColor: t.success, backgroundColor: t.successSoft,
    },
    btnRecebiTxt: { fontSize: 11.5, color: t.successInk, fontWeight: "700" },

    cardActions: { gap: 6, marginTop: 8 },
    btnApproval: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: t.success,
      paddingVertical: 8, borderRadius: 8,
    },
    btnApprovalTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
    btnAdvance: {
      paddingVertical: 8, borderRadius: 8,
      alignItems: "center",
    },
    btnAdvanceTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  });
}
