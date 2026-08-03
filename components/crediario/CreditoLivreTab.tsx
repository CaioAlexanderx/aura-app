// ============================================================
// AURA. — Crediário · aba "Crédito livre" (Fase 2)
//
// Clientes que já compraram no fiado e hoje estão zerados. Todo o resto
// do módulo é construído em cima de balance > 0 — no instante em que o
// cliente quita, ele some da tela. Esta aba é o outro lado disso.
//
// Não confundir com Reativação (plano Expansão): lá o corte é dias desde
// a última VENDA, então quem acabou de quitar aparece como "ativo" e é
// justamente excluído. Públicos quase disjuntos.
//
// Fase 2 = listar + ver. O botão de WhatsApp abre a conversa com uma
// mensagem simples; o modal de cupom (clone do BirthdayCouponModal) e o
// log de contato entram na Fase 3.
// ============================================================
import { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { creditLeadsApi, leadReason, relativeDays } from "@/services/creditLeadsApi";
import type { CreditLead, LeadWindow, LeadSegment } from "@/services/creditLeadsApi";
import { normalizeBrPhone } from "@/services/messaging";

const IS_WEB = Platform.OS === "web";

const WINDOWS: Array<{ key: LeadWindow; label: string }> = [
  { key: "3", label: "3 meses" },
  { key: "6", label: "6 meses" },
  { key: "12", label: "12 meses" },
  { key: "all", label: "Tudo" },
];

const fmt = (n: number) =>
  "R$ " + (Number(n) || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const fmtShort = (n: number) => {
  const v = Number(n) || 0;
  return v >= 1000 ? "R$ " + (v / 1000).toFixed(1).replace(".", ",") + "k" : fmt(v);
};

const fmtDayMonth = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
    });
  } catch { return "—"; }
};

type Props = {
  /** Em modo consolidado não há company.id — a tela avisa em vez de
   *  renderizar lista vazia, que seria lida como "não tenho leads". */
  companyId?: string | null;
  consolidated?: boolean;
  onOpenCustomer?: (c: { id: string; name: string }) => void;
};

export function CreditoLivreTab({ companyId, consolidated, onOpenCustomer }: Props) {
  const [months, setMonths] = useState<LeadWindow>("6");
  // Segmento: a fila util e a de quem ainda NAO foi contatado. Quem ja
  // foi vai pro segmento proprio em vez de disputar o topo da lista --
  // o score nao sabe de contato, entao os contatados ficariam no topo
  // permanentemente conforme a base cresce.
  const [segment, setSegment] = useState<LeadSegment>("pending");
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const debounceRef = useRef<any>(null);

  // Mesmo debounce da carteira (300ms) — consistência de comportamento.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQ(searchInput.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const enabled = !!companyId && !consolidated;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["credit-leads", companyId, months, segment, searchQ],
    queryFn: () => creditLeadsApi.list(companyId!, { months, segment, q: searchQ || undefined }),
    enabled,
    staleTime: 120_000,
    retry: 1,
  });

  const leads = data?.leads || [];
  const pendingCount = data?.pending_count;
  const contactedCount = data?.contacted_count;

  // ── Consolidado: o crédito é por CNPJ ──
  if (consolidated || !companyId) {
    return (
      <View style={s.warn}>
        <Icon name="alert" size={15} color={Colors.amber} />
        <View style={{ flex: 1 }}>
          <Text style={s.warnTitle}>Crédito livre é por empresa</Text>
          <Text style={s.warnText}>
            O crediário é calculado por CNPJ. Escolha uma empresa específica no seletor para ver os leads.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={s.sub}>
        Clientes que já compraram no fiado e hoje não devem nada. Têm limite livre e histórico de
        pagamento — são os mais prováveis de voltar a comprar.
      </Text>

      {/* ── Segmento: fila útil × já contatados ── */}
      <View style={s.segmentRow}>
        {([
          { key: "pending" as LeadSegment, label: "A contatar", count: pendingCount },
          { key: "done" as LeadSegment, label: "Já contatados", count: contactedCount },
        ]).map((sg) => {
          const on = segment === sg.key;
          return (
            <Pressable
              key={sg.key}
              onPress={() => setSegment(sg.key)}
              style={[s.segTab, on && s.segTabOn, IS_WEB && ({ transition: "all 0.15s" } as any)]}
            >
              <Text style={[s.segTabText, on && s.segTabTextOn]}>{sg.label}</Text>
              {sg.count != null && (
                <View style={[s.segCount, on && s.segCountOn]}>
                  <Text style={[s.segCountText, on && s.segCountTextOn]}>{sg.count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ── Filtros ── */}
      <View style={s.filterRow}>
        <View style={{ gap: 6 }}>
          <Text style={s.filterLabel}>Zerou nos últimos</Text>
          <View style={s.seg}>
            {WINDOWS.map((w) => {
              const on = months === w.key;
              return (
                <Pressable
                  key={w.key}
                  onPress={() => setMonths(w.key)}
                  style={[s.segBtn, on && s.segBtnOn, IS_WEB && ({ transition: "all 0.15s" } as any)]}
                >
                  <Text style={[s.segText, on && s.segTextOn]}>{w.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.searchWrap}>
          <Icon name="search" size={13} color={Colors.ink3} />
          <TextInput
            style={s.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Buscar cliente..."
            placeholderTextColor={Colors.ink3}
          />
          {searchInput.length > 0 && (
            <Pressable onPress={() => setSearchInput("")} style={s.clearBtn}>
              <Icon name="x" size={11} color={Colors.ink3} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading && (
        <View style={s.center}>
          <ActivityIndicator color={Colors.violet3} />
          <Text style={s.centerText}>Carregando leads...</Text>
        </View>
      )}

      {isError && !isLoading && (
        <View style={s.center}>
          <Text style={s.centerText}>Não foi possível carregar os leads.</Text>
          <Pressable onPress={() => refetch()} style={s.retryBtn}>
            <Text style={s.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && !isError && leads.length === 0 && (
        <View style={s.empty}>
          <Icon name="users" size={34} color={Colors.amber} />
          <Text style={s.emptyTitle}>
            {searchQ
              ? "Nenhum cliente encontrado"
              : segment === "done"
                ? "Você ainda não contatou ninguém"
                : months === "all"
                  ? "Ninguém quitou o carnê ainda"
                  : `Ninguém zerou nos últimos ${months} meses`}
          </Text>
          <Text style={s.emptyText}>
            {searchQ
              ? "Tente outro nome ou limpe a busca."
              : segment === "done"
                ? "Quem você chamar no WhatsApp aparece aqui, para você não repetir o contato sem querer."
                : months === "all"
                  ? "Quando um cliente terminar de pagar, ele aparece aqui como oportunidade de venda."
                  : "Quando um cliente termina de pagar o carnê, ele aparece aqui. Experimente ampliar a janela."}
          </Text>
        </View>
      )}

      {!isLoading && !isError && leads.length > 0 && (
        <>
          <View style={s.list}>
            {leads.map((lead, idx) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                position={idx + 1}
                onOpen={() => onOpenCustomer?.({ id: lead.id, name: lead.name })}
              />
            ))}
          </View>
          <Text style={s.footerCount}>
            {leads.length} cliente{leads.length !== 1 ? "s" : ""} com crédito livre
            {(data?.without_phone || 0) > 0 ? ` · ${data!.without_phone} sem telefone` : ""}
          </Text>
        </>
      )}
    </View>
  );
}

// ── Linha do lead ─────────────────────────────────────────
function LeadRow({ lead, position, onOpen }: { lead: CreditLead; position: number; onOpen: () => void }) {
  const reason = leadReason(lead);
  const phoneOk = !!normalizeBrPhone(lead.phone || "");
  const isTop = position <= 3;

  function openWhatsApp() {
    // Abre a conversa VAZIA, de proposito. O app nao redige a mensagem:
    // a lista mistura quem pagou em dia com quem atrasou, e um texto unico
    // que soa atencioso pra um soa como cobranca disfarcada pro outro.
    // Quem conhece o cliente e o lojista -- ele escreve.
    const digits = normalizeBrPhone(lead.phone || "");
    if (!digits) return;
    const url = `https://wa.me/${digits}`;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const w = window.open(url, "_blank");
      if (!w) window.location.href = url;
    }
  }

  return (
    <View style={s.row}>
      <View style={[s.rank, isTop && s.rankTop]}>
        <Text style={[s.rankText, isTop && s.rankTextTop]}>{position}</Text>
      </View>

      <Pressable style={s.rowMid} onPress={onOpen}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{lead.name}</Text>
          {lead.last_contact_at && (
            <View style={[s.badge, s.badgeGreen]}>
              <Text style={[s.badgeText, { color: Colors.green }]}>
                Contatado {fmtDayMonth(lead.last_contact_at)}
              </Text>
            </View>
          )}
          {lead.owes_elsewhere && (
            <View style={[s.badge, s.badgeAmber]}>
              <Text style={[s.badgeText, { color: Colors.amber }]}>Deve em outra loja</Text>
            </View>
          )}
          {!phoneOk && (
            <View style={[s.badge, s.badgeMute]}>
              <Text style={[s.badgeText, { color: Colors.ink3 }]}>Sem telefone</Text>
            </View>
          )}
        </View>
        <Text
          style={[
            s.why,
            reason.tone === "good" ? { color: Colors.green } : reason.tone === "warn" ? { color: Colors.amber } : null,
          ]}
          numberOfLines={1}
        >
          {reason.text}
        </Text>
      </Pressable>

      <View style={s.colVal}>
        <Text style={s.val}>{fmtShort(lead.total_debited)}</Text>
        <Text style={s.valSub}>já comprou</Text>
      </View>

      <View style={s.colWhen}>
        <Text style={s.when}>{fmtDayMonth(lead.zeroed_since)}</Text>
        <Text style={s.whenSub}>{relativeDays(lead.days_since_activity)}</Text>
      </View>

      <Pressable
        onPress={openWhatsApp}
        disabled={!phoneOk}
        style={[s.waBtn, !phoneOk && { opacity: 0.4 }]}
        accessibilityLabel={`Abrir WhatsApp de ${lead.name}`}
      >
        <Icon name="whatsapp" size={15} color="#fff" />
      </Pressable>
    </View>
  );
}

export default CreditoLivreTab;

const s = StyleSheet.create({
  sub: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginBottom: 16, maxWidth: 640 },

  // Segmento (fila util x ja contatados)
  segmentRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  segTab: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  segTabOn: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  segTabText: { fontSize: 12.5, color: Colors.ink3, fontWeight: "500" },
  segTabTextOn: { color: Colors.violet3, fontWeight: "700" },
  segCount: { backgroundColor: Colors.bg4, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  segCountOn: { backgroundColor: "rgba(124,58,237,0.28)" },
  segCountText: { fontSize: 10.5, color: Colors.ink3, fontWeight: "700" },
  segCountTextOn: { color: Colors.violet4 },

  filterRow: { flexDirection: "row", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 },
  filterLabel: { fontSize: 9.5, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  seg: { flexDirection: "row", backgroundColor: Colors.bg3, borderRadius: 10, padding: 3, gap: 3, borderWidth: 1, borderColor: Colors.border },
  segBtn: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 8 },
  segBtnOn: { backgroundColor: Colors.violet },
  segText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  segTextOn: { color: "#fff", fontWeight: "700" },

  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg4,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: 200, maxWidth: 300,
  },
  searchInput: { flex: 1, fontSize: 12, color: Colors.ink, paddingVertical: 4 },
  clearBtn: { width: 22, height: 22, borderRadius: 5, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },

  list: { backgroundColor: Colors.bg3, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rank: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4 },
  rankTop: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  rankText: { fontSize: 12, fontWeight: "800", color: Colors.ink3 },
  rankTextTop: { color: Colors.violet3 },

  rowMid: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  name: { fontSize: 13.5, fontWeight: "600", color: Colors.ink, flexShrink: 1 },
  why: { fontSize: 10.5, color: Colors.ink3, marginTop: 3 },

  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  badgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase" },
  badgeGreen: { backgroundColor: Colors.greenD, borderColor: "rgba(52,211,153,0.30)" },
  badgeAmber: { backgroundColor: Colors.amberD, borderColor: "rgba(251,191,36,0.34)" },
  badgeMute: { backgroundColor: Colors.bg4, borderColor: Colors.border },

  colVal: { width: 96, alignItems: "flex-end" },
  val: { fontSize: 13.5, fontWeight: "700", color: Colors.green },
  valSub: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  colWhen: { width: 84, alignItems: "flex-end" },
  when: { fontSize: 12, color: Colors.ink2 },
  whenSub: { fontSize: 10, color: Colors.ink3, marginTop: 2 },

  waBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },

  footerCount: { fontSize: 11, color: Colors.ink3, textAlign: "center", marginTop: 12, fontStyle: "italic" },

  center: { paddingVertical: 48, alignItems: "center", gap: 10 },
  centerText: { fontSize: 12.5, color: Colors.ink3 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  retryText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },

  empty: { backgroundColor: Colors.bg3, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingVertical: 44, paddingHorizontal: 24, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  emptyText: { fontSize: 12.5, color: Colors.ink3, textAlign: "center", maxWidth: 400, lineHeight: 18 },

  warn: {
    flexDirection: "row", gap: 9, alignItems: "flex-start",
    backgroundColor: Colors.amberD, borderWidth: 1, borderColor: "rgba(251,191,36,0.34)",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  warnTitle: { fontSize: 12.5, fontWeight: "700", color: Colors.amber },
  warnText: { fontSize: 11.5, color: Colors.amber, opacity: 0.9, marginTop: 2, lineHeight: 16 },
});
