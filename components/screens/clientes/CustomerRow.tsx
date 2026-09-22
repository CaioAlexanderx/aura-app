import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { toast } from "@/components/Toast";
import type { Customer } from "./types";
import { fmt } from "./types";
import {
  classificarCliente, SEGMENTOS, type ContextoDaBase, type TokenCor,
} from "./segmentos";
import { diasSemComprar } from "./diasSemComprar";
import { pluralize } from "@/utils/plural";
import {
  hasUsablePhone, buildGreetingWaLink, buildReviewRequestWaLink, openExternalUrl,
} from "./customerActions";
import { ReceberPagamentoModal } from "./ReceberPagamentoModal";
import { HistoricoComprasModal } from "./HistoricoComprasModal";
import { readMatconSettings } from "@/constants/matcon";
import { MarcarProfissionalModal } from "@/components/matcon/MarcarProfissionalModal";
import { TRADE_LABELS, type Professional, type ProfessionalTrade } from "@/services/matconApi";

// Resolve o TokenCor (indireção de ./segmentos.ts — módulo puro, sem
// import de react-native) pra cor real. O laranja de "Devendo" nunca
// entrou em constants/colors.ts (já era um literal aqui antes da Fase 1).
const TOKEN_CORES: Record<TokenCor, string> = {
  violetD: Colors.violetD, violet3: Colors.violet3,
  greenD: Colors.greenD, green: Colors.green,
  amberD: Colors.amberD, amber: Colors.amber,
  redD: Colors.redD, red: Colors.red,
  bg4: Colors.bg4, ink3: Colors.ink3,
  laranjaBg: "rgba(251,146,60,0.18)", laranjaFg: "#f97316",
};

function Tag({ tag, cor, motivo }: { tag: string; cor: { bVar: TokenCor; fVar: TokenCor }; motivo: string }) {
  return (
    <View
      style={{ borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: TOKEN_CORES[cor.bVar] }}
      accessibilityLabel={motivo}
    >
      <Text style={{ fontSize: 9, fontWeight: "600", color: TOKEN_CORES[cor.fVar], letterSpacing: 0.3 }}>{tag}</Text>
    </View>
  );
}

function Stars({ r }: { r: number | null }) {
  if (r == null) return <Text style={{ fontSize: 10, color: Colors.ink3 }}>Sem avaliação</Text>;
  return <View style={{ flexDirection: "row", gap: 2 }}>{[1, 2, 3, 4, 5].map(i => <Text key={i} style={{ fontSize: 12, color: i <= r ? Colors.amber : Colors.ink3 }}>*</Text>)}</View>;
}

export function CustomerRow({
  c, expanded, onToggle, onDelete, onEdit,
  isSelected, onSelect,
  showCompanyBadge,
  contexto,
}: {
  c: Customer;
  expanded: boolean;
  onToggle: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (c: Customer) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  // MULTICNPJ Onda 2.3: mostra badge da loja onde foi cadastrado.
  // FE passa true so quando companyCount > 1 (multi-CNPJ ativo).
  showCompanyBadge?: boolean;
  // Fase 1 (C1.2): limiar de VIP relativo à base inteira — quem chama
  // (app/(tabs)/clientes.tsx) calcula uma vez com contextoDaBase(customers)
  // e passa pra cada linha. Sem ele, ninguém vira VIP (ver getStatus).
  contexto?: ContextoDaBase;
}) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  const { segmento, motivo } = classificarCliente(c, contexto);
  const tagInfo = SEGMENTOS[segmento];
  const diasUltimaCompra = diasSemComprar(c.lastPurchase);
  const ultimaCompraLabel = diasUltimaCompra == null
    ? "ainda não comprou"
    : diasUltimaCompra === 0
    ? "última compra hoje"
    : `última compra há ${pluralize(diasUltimaCompra, "dia")}`;
  const { settings: pdvSettings } = usePdvSettings();
  const oticaEnabled = pdvSettings.otica_enabled === true;
  // 22/09/2026 (Matcon M3): "Marcar como profissional" e a linha
  // "Profissional · ..." só existem com o clube ligado — matcon_club_enabled
  // desliga só o clube sem desligar o resto do Matcon (docs/CONTRACT_MATCON.md).
  const matcon = readMatconSettings(pdvSettings);
  const matconClubOn = matcon.matcon_enabled && matcon.matcon_club_enabled;
  const [showMarcarProfissional, setShowMarcarProfissional] = useState(false);
  const showBadge = showCompanyBadge && c.company_name;
  const hasCredit = (c.creditBalance || 0) > 0;
  const qc = useQueryClient();
  const { company } = useAuthStore();

  // Crediario e vendas sao por (cliente, empresa) — usar a empresa onde o
  // cliente foi cadastrado (multi-CNPJ: e onde o saldo/historico existem),
  // nao a current da sessao.
  const targetCompanyId = c.company_id || company?.id || "";
  const storeName = company?.name || "nossa loja";
  const phoneOk = hasUsablePhone(c.phone);

  const [showPagamento, setShowPagamento] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);

  function handleSendWhatsapp() {
    const url = buildGreetingWaLink(c.phone, c.name, storeName);
    if (!url) { toast.error("Telefone do cliente inválido"); return; }
    openExternalUrl(url);
  }

  function handleRequestReview() {
    // Sem endpoint manual de avaliação alimentável a partir da lista de
    // clientes (companiesApi.requestReview exige sale_id — ver nota em
    // customerActions.ts). Fallback: wa.me, mesmo padrão do WhatsApp acima.
    const url = buildReviewRequestWaLink(c.phone, c.name, storeName);
    if (!url) { toast.error("Telefone do cliente inválido"); return; }
    openExternalUrl(url);
  }

  function handlePaymentSuccess(newBalance: number) {
    toast.success(`Pagamento registrado. Novo saldo: ${fmt(newBalance)}`);
    // Invalida lista de clientes (tem credit_balance) + saldos de credit
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["credit-balances"] });
  }

  function handleProfessionalMarked(_p: Professional) {
    // MarcarProfissionalModal já mostra o toast de sucesso; aqui só
    // invalidamos pra ficha reler `c.professional` (GET /customers, M3).
    qc.invalidateQueries({ queryKey: ["customers"] });
    setShowMarcarProfissional(false);
  }

  return (
    <View>
      <Pressable
        onPress={() => onSelect ? onSelect(c.id) : onToggle()}
        onHoverIn={w ? () => sH(true) : undefined}
        onHoverOut={w ? () => sH(false) : undefined}
        style={[s.row, h && { backgroundColor: Colors.bg4 }, isSelected && { backgroundColor: Colors.violetD }, w && { transition: "background-color 0.15s ease" } as any]}
      >
        {onSelect && (
          <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
            {isSelected && <Text style={s.checkmark}>✓</Text>}
          </View>
        )}
        <View style={s.left}>
          <View style={s.avatar}><Text style={s.avatarText}>{c.name.charAt(0)}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>{c.name}</Text>
            <View style={s.metaRow}>
              <Text style={s.meta} numberOfLines={1}>
                {ultimaCompraLabel}{c.instagram ? " / " + c.instagram : ""}
              </Text>
              {showBadge && (
                <View style={s.companyBadge}>
                  <Text style={s.companyBadgeText} numberOfLines={1}>{c.company_name}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {!onSelect && (
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Text style={s.spent}>{fmt(c.totalSpent)}</Text>
            {hasCredit && (
              <View style={s.openBadge}>
                <Text style={s.openBadgeText}>Em aberto: {fmt(c.creditBalance)}</Text>
              </View>
            )}
            <Tag tag={tagInfo.rotulo} cor={tagInfo.cor} motivo={motivo} />
          </View>
        )}
      </Pressable>
      {expanded && !onSelect && (
        <View style={s.detail}>
          <View style={s.detailGrid}>
            {[["E-mail", c.email], ["Telefone", c.phone], ["Aniversário", c.birthday], ["Instagram", c.instagram || "---"], ["Primeira visita", c.firstVisit], ["Última compra", c.lastPurchase], ["Total gasto", fmt(c.totalSpent)], ["Visitas", String(c.visits)]].map(([l, v]) =>
              <View key={l} style={s.detailItem}><Text style={s.detailLabel}>{l}</Text><Text style={[s.detailValue, l === "Total gasto" && { color: Colors.green }, l === "Instagram" && { color: Colors.violet3 }]}>{v}</Text></View>
            )}
            <View style={s.detailItem}><Text style={s.detailLabel}>Avaliação</Text><Stars r={c.rating} /></View>
            {/* MULTICNPJ Onda 2.3: empresa onde foi cadastrado (so se multi-CNPJ) */}
            {showBadge && (
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Cadastrado em</Text>
                <Text style={[s.detailValue, { color: Colors.violet3 }]} numberOfLines={1}>{c.company_name}</Text>
              </View>
            )}
            {/* Crediario: saldo em aberto */}
            {hasCredit && (
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Saldo em aberto</Text>
                <Text style={[s.detailValue, { color: "#f97316" }]}>{fmt(c.creditBalance)}</Text>
              </View>
            )}
          </View>
          {/* 22/09/2026 — Matcon M3: `c.professional` vem do GET
              /companies/:id/customers com o clube ligado (docs/CONTRACT_MATCON.md,
              "Venda indicada") — sem chamada extra. referrals_count é opcional
              hoje (contrato só promete id/trade/points_balance); some do texto
              quando o backend ainda não manda. */}
          {c.professional && (
            <View style={s.professionalLine} testID={`cliente-profissional-${c.id}`}>
              <Text style={s.professionalText}>
                <Text style={s.professionalStrong}>Profissional</Text>
                {" · " + (TRADE_LABELS[c.professional.trade as ProfessionalTrade] || c.professional.trade)}
                {" · " + c.professional.points_balance.toLocaleString("pt-BR") + " pontos"}
                {typeof c.professional.referrals_count === "number"
                  ? " · " + c.professional.referrals_count + (c.professional.referrals_count === 1 ? " indicação" : " indicações")
                  : ""}
              </Text>
            </View>
          )}
          {c.notes ? <Text style={s.notes}>{c.notes}</Text> : null}
          <View style={s.detailTags}><Text style={s.detailTagsLabel}>Status</Text><View style={{ flexDirection: "row", gap: 6 }}><Tag tag={tagInfo.rotulo} cor={tagInfo.cor} motivo={motivo} /></View></View>
          <View style={s.actions}>
            {hasCredit && (
              <Pressable
                onPress={() => setShowPagamento(true)}
                style={s.receiveBtn}
                testID={`cliente-receber-pagamento-${c.id}`}
              >
                <Text style={s.receiveText}>Receber pagamento</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleSendWhatsapp}
              disabled={!phoneOk}
              style={[s.actionBtn, !phoneOk && s.actionBtnDisabled]}
              testID={`cliente-wa-${c.id}`}
            >
              <Text style={[s.actionText, !phoneOk && s.actionTextDisabled]}>Enviar WhatsApp</Text>
              {!phoneOk && <Text style={s.actionHint}>sem telefone</Text>}
            </Pressable>
            <Pressable
              onPress={handleRequestReview}
              disabled={!phoneOk}
              style={[s.actionBtn, !phoneOk && s.actionBtnDisabled]}
              testID={`cliente-avaliacao-${c.id}`}
            >
              <Text style={[s.actionText, !phoneOk && s.actionTextDisabled]}>Pedir avaliação</Text>
              {!phoneOk && <Text style={s.actionHint}>sem telefone</Text>}
            </Pressable>
            <Pressable
              onPress={() => setShowHistorico(true)}
              style={s.actionBtn}
              testID={`cliente-historico-${c.id}`}
            >
              <Text style={s.actionText}>Ver histórico</Text>
            </Pressable>
            {/* 15/09/2026 — Ótica: a receita é do cliente, então a porta de
                entrada dela fica na ficha. Só aparece com o módulo ligado. */}
            {oticaEnabled && (
              <Pressable onPress={() => router.push(("/otica/receitas?customer_id=" + c.id) as any)} style={s.actionBtn} testID={`cliente-receitas-${c.id}`}>
                <Text style={s.actionText}>Receitas (ótica)</Text>
              </Pressable>
            )}
            {/* 22/09/2026 — Matcon M3: profissional é um cliente marcado, não
                um segundo cadastro. Some quando já é profissional (a linha
                abaixo já mostra o status; marcar de novo não faz sentido). */}
            {matconClubOn && !c.professional && (
              <Pressable onPress={() => setShowMarcarProfissional(true)} style={s.actionBtn} testID={`cliente-marcar-profissional-${c.id}`}>
                <Text style={s.actionText}>Marcar como profissional</Text>
              </Pressable>
            )}
            {onEdit && <Pressable onPress={() => onEdit(c)} style={s.editBtn}><Text style={s.editText}>Editar cliente</Text></Pressable>}
            {onDelete && <Pressable onPress={() => onDelete(c.id)} style={s.deleteBtn}><Text style={s.deleteText}>Excluir cliente</Text></Pressable>}
          </View>
          {hasCredit && (
            <ReceberPagamentoModal
              visible={showPagamento}
              onClose={() => setShowPagamento(false)}
              companyId={targetCompanyId}
              customerId={c.id}
              customerName={c.name}
              balance={c.creditBalance}
              onSuccess={handlePaymentSuccess}
            />
          )}
          <HistoricoComprasModal
            visible={showHistorico}
            onClose={() => setShowHistorico(false)}
            companyId={targetCompanyId}
            customerId={c.id}
            customerName={c.name}
          />
          {matconClubOn && (
            <MarcarProfissionalModal
              visible={showMarcarProfissional}
              onClose={() => setShowMarcarProfissional(false)}
              onMarked={handleProfessionalMarked}
              presetCustomer={{ id: c.id, name: c.name, phone: c.phone }}
            />
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, marginRight: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4 },
  checkboxSelected: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  checkmark: { fontSize: 13, color: "#fff", fontWeight: "700", lineHeight: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  avatarText: { fontSize: 14, fontWeight: "700", color: Colors.violet3 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  meta: { fontSize: 11, color: Colors.ink3, flexShrink: 1 },
  // MULTICNPJ Onda 2.3: badge da loja
  companyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
    maxWidth: 160,
  },
  companyBadgeText: {
    fontSize: 9.5,
    color: Colors.violet3,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  spent: { fontSize: 13, color: Colors.green, fontWeight: "700" },
  // Crediario: badge laranja "Em aberto: R$ X"
  openBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "rgba(251,146,60,0.14)",
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.4)",
  },
  openBadgeText: {
    fontSize: 10,
    color: "#f97316",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  detail: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 16, marginHorizontal: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  detailItem: { width: "30%", minWidth: 100, paddingVertical: 6, gap: 3 },
  detailLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  // Matcon M3 — linha "Profissional · ofício · N pontos · M indicações"
  professionalLine: {
    marginTop: 10, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  professionalText: { fontSize: 11.5, color: Colors.ink2 },
  professionalStrong: { fontWeight: "700", color: Colors.violet3 },
  notes: { fontSize: 11, color: Colors.ink3, fontStyle: "italic", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  detailTags: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, gap: 6 },
  detailTagsLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, flexWrap: "wrap" },
  actionBtn: { backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  actionText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  // Botão desabilitado (ex.: sem telefone p/ WhatsApp) — hint sempre visível,
  // nunca dependente de hover (armadilha 7 do CLAUDE.md: touch não tem hover).
  actionBtnDisabled: { opacity: 0.5 },
  actionTextDisabled: { color: Colors.ink3 },
  actionHint: { fontSize: 9, color: Colors.ink3, marginTop: 1 },
  // Botao "Receber pagamento" — destaque laranja, mesmo tom do badge
  receiveBtn: {
    backgroundColor: "rgba(251,146,60,0.16)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.5)",
  },
  receiveText: { fontSize: 11, color: "#f97316", fontWeight: "700" },
  editBtn: { backgroundColor: Colors.amberD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.amber + "33" },
  editText: { fontSize: 11, color: Colors.amber, fontWeight: "600" },
  deleteBtn: { backgroundColor: Colors.redD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.red + "33" },
  deleteText: { fontSize: 11, color: Colors.red, fontWeight: "600" },
});

export default CustomerRow;
