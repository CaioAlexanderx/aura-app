// ============================================================
// AURA. — Matcon: ranking do Clube do Profissional (M3)
//
// 22/09/2026. Não é um cadastro: é um RANKING DO MÊS, como as esteiras de
// Orçamentos e Entregas mostram dinheiro parado em vez de uma lista fria
// (docs/matcon-faseamento-po-ux.md §4b regra 2). O dono abre pra saber
// "quanto os profissionais trouxeram este mês e quem está com resgate
// parado" — por isso o hero mostra o dinheiro antes de qualquer nome.
//
// Mockup aprovado: docs/mockups/matcon-m3-clube-calculadora.html
// #profissionais. Molde de código: app/(tabs)/matcon/orcamentos.tsx
// (RequireCompanyScope, useQuery, EsteiraMatcon/EsteiraCard/EsteiraVazia).
//
// Decisões desta tela:
//   · Chave de módulo PRÓPRIA `matcon.profissionais` (regra 3 do
//     CLAUDE.md), já cadastrada em hooks/useVisibleModules.ts.
//   · Gate em DOIS níveis: sem matcon_enabled, o mesmo recado curto das
//     outras telas do Matcon; com o Matcon ligado mas o clube desligado
//     (matcon_club_enabled === false), um recado próprio apontando para
//     Matcon › Configurações — a tela não existe sem o clube.
//   · Multi-CNPJ (armadilha 2): profissional é vínculo de UM cliente com
//     UMA loja (pontos, cupom), então <RequireCompanyScope> força escolher
//     a empresa antes de renderizar, como Orçamentos e Entregas fazem.
//   · Regra 7: os botões do card ficam sempre visíveis, sem hover.
//   · A criação de profissional (marcar um cliente) mora na ficha do
//     cliente (MarcarProfissionalModal — outra frente em paralelo). Esta
//     tela só lista; por isso o estado vazio manda o dono pra lá, e não
//     para um botão "+ Profissional" aqui.
//   · A lista (GET .../professionals) não traz "últimas indicações" por
//     profissional — isso só existe no detalhe (getProfessional), que
//     custaria uma chamada por card. Por isso o card mostra o resumo do
//     mês, não a lista de vendas recentes do mockup.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ScreenHero } from "@/components/ScreenHero";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { matconApi, TRADE_LABELS, type Professional } from "@/services/matconApi";
import { readMatconSettings, type MatconSettings } from "@/constants/matcon";
import { openWhatsApp } from "@/utils/whatsapp";
import { EsteiraMatcon, EsteiraCard, EsteiraVazia, type EsteiraEstacao } from "@/components/matcon/EsteiraMatcon";
import {
  cupomPossivel, rotuloResumo, textoExtratoWhatsApp, textoChamarDeVolta, textoCupomGerado,
  diasSemCompra, ehNovo, fmtMoneyCurto, fmtPontos,
} from "@/components/matcon/profissionaisUtil";

type Filtro = "active" | "inactive_60d" | "new";

const CHIPS: { key: Filtro; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "inactive_60d", label: "Sem compra há 60 dias" },
  { key: "new", label: "Novos" },
];

export default function MatconProfissionaisRoute() {
  // Multi-CNPJ: no modo consolidado o picker aparece antes do ranking.
  return (
    <RequireCompanyScope context="matcon" actionLabel="ver os profissionais">
      <MatconProfissionaisScreen />
    </RequireCompanyScope>
  );
}

function MatconProfissionaisScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const { settings } = usePdvSettings();
  const matcon = useMemo(() => readMatconSettings(settings as Partial<MatconSettings>), [settings]);
  const nomeDaLoja = company?.name || "a loja";

  const [filtro, setFiltro] = useState<Filtro>("active");
  const [busca, setBusca] = useState("");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const clubOn = matcon.matcon_enabled && matcon.matcon_club_enabled;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["matcon-professionals", company?.id, filtro, q],
    queryFn: () => matconApi.listProfessionals(company!.id, { filter: filtro, q: q || undefined }),
    enabled: !!company?.id && clubOn,
    staleTime: 30_000,
  });

  const resumo = data?.summary;
  const profissionais = data?.professionals || [];

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["matcon-professionals"] });
  }

  const estacoes: EsteiraEstacao[] = resumo ? [
    { key: "vendido", label: "Vendido por indicação", count: null, money: fmtMoneyCurto(resumo.referred_total_month), tone: "violet" },
    { key: "ativos", label: "Profissionais ativos", count: resumo.active_count, money: null, tone: "violet" },
    { key: "resgates", label: "Resgates pendentes", count: resumo.pending_redeems, money: null, tone: resumo.pending_redeems > 0 ? "amber" : "violet" },
  ] : [];

  // ── Ações do card ─────────────────────────────────────────
  function avisarNoWhatsApp(p: Professional) {
    const texto = textoExtratoWhatsApp(p, matcon, nomeDaLoja);
    if (!openWhatsApp(p.customer_phone, texto)) {
      toast.error(`${p.customer_name} não tem telefone cadastrado`);
    }
  }

  function chamarDeVolta(p: Professional) {
    const texto = textoChamarDeVolta(p, matcon, nomeDaLoja);
    if (!openWhatsApp(p.customer_phone, texto)) {
      toast.error(`${p.customer_name} não tem telefone cadastrado`);
    }
  }

  // O código do cupom só existe depois da resposta do servidor — por isso
  // o WhatsApp só abre depois do await (diferente do wa.me síncrono das
  // outras esteiras, que já tem o texto pronto antes do toque).
  async function gerarCupomDeResgate(p: Professional) {
    if (!company?.id || busyId) return;
    setBusyId(p.id);
    try {
      const res = await matconApi.redeemProfessional(company.id, p.id);
      invalidate();
      toast.success(`Cupom ${res.coupon_code} gerado para ${p.customer_name}`);
      const texto = textoCupomGerado(p, res.coupon_code, matcon.matcon_coupon_value, nomeDaLoja);
      if (!openWhatsApp(p.customer_phone, texto)) {
        toast.error(`${p.customer_name} não tem telefone cadastrado — avise pelo código ${res.coupon_code}`);
      }
    } catch (e: any) {
      toast.error(e?.data?.error || "Não deu para gerar o cupom");
    } finally {
      setBusyId(null);
    }
  }

  // ── Tela ──────────────────────────────────────────────────
  if (!matcon.matcon_enabled) {
    return (
      <ScrollView style={st.screen} contentContainerStyle={st.content}>
        <ScreenHero eyebrow="Matcon" title="Profissionais" />
        <View style={st.gate} testID="matcon-profissionais-desligado">
          <View style={st.gateIcon}><Icon name="lock" size={20} color={Colors.violet3} /></View>
          <Text style={st.gateTitle}>Ligue &quot;Materiais de construção&quot; em Configurações › Caixa</Text>
          <Text style={st.gateDesc}>O ranking de profissionais só existe para lojas com o módulo ativo.</Text>
          <Pressable onPress={() => router.push("/configuracoes" as any)} style={st.gateBtn} testID="matcon-profissionais-ir-config">
            <Text style={st.gateBtnText}>Abrir Configurações</Text>
            <Icon name="chevron_right" size={14} color="#fff" />
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (!matcon.matcon_club_enabled) {
    return (
      <ScrollView style={st.screen} contentContainerStyle={st.content}>
        <ScreenHero eyebrow="Matcon" title="Profissionais" />
        <View style={st.gate} testID="matcon-profissionais-clube-desligado">
          <View style={st.gateIcon}><Icon name="users" size={20} color={Colors.violet3} /></View>
          <Text style={st.gateTitle}>Ligue o clube do profissional nas configurações do Matcon</Text>
          <Text style={st.gateDesc}>É a frase &quot;Tenho clube do profissional&quot;, em Matcon › Configurações — sem ela não há pontos nem ranking.</Text>
          <Pressable onPress={() => router.push("/matcon/config" as any)} style={st.gateBtn} testID="matcon-profissionais-ir-matcon-config">
            <Text style={st.gateBtnText}>Abrir configurações do Matcon</Text>
            <Icon name="chevron_right" size={14} color="#fff" />
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <ScreenHero
        eyebrow="Matcon"
        title="Profissionais"
        live
        subtitle={
          !resumo ? "Carregando o ranking…" : (
            <Text>
              {fmtMoneyCurto(resumo.referred_total_month)} vendidos por indicação este mês · {resumo.active_count} {resumo.active_count === 1 ? "profissional ativo" : "profissionais ativos"}
              {resumo.pending_redeems > 0 && (
                <Text style={{ color: Colors.amber, fontWeight: "700" }}> · {resumo.pending_redeems} {resumo.pending_redeems === 1 ? "resgate pendente" : "resgates pendentes"}</Text>
              )}
            </Text>
          )
        }
        actions={
          <Pressable onPress={() => router.push("/matcon/orcamentos" as any)} style={st.ghostBtn} testID="matcon-prof-ir-orcamentos">
            <Icon name="clipboard" size={14} color={Colors.ink} />
            <Text style={st.ghostBtnText}>Orçamentos</Text>
          </Pressable>
        }
      />

      {!!estacoes.length && <EsteiraMatcon stations={estacoes} testID="matcon-esteira-profissionais" />}

      <View style={st.searchBox}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput
          style={st.searchInput}
          value={busca}
          onChangeText={setBusca}
          onSubmitEditing={() => setQ(busca.trim())}
          placeholder="Nome, telefone ou ofício"
          placeholderTextColor={Colors.ink3}
          returnKeyType="search"
          testID="matcon-prof-busca"
        />
        {!!q && (
          <Pressable onPress={() => { setBusca(""); setQ(""); }} accessibilityLabel="Limpar busca">
            <Icon name="x" size={14} color={Colors.ink3} />
          </Pressable>
        )}
      </View>

      <View style={st.chips}>
        {CHIPS.map((c) => (
          <Pressable key={c.key} onPress={() => setFiltro(c.key)} style={[st.chip, filtro === c.key && st.chipOn]} testID={`matcon-prof-chip-${c.key}`}>
            <Text style={[st.chipText, filtro === c.key && st.chipTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={st.loadingBox}><ActivityIndicator color={Colors.violet3} /></View>
      ) : profissionais.length === 0 ? (
        <EsteiraVazia
          testID="matcon-profissionais-vazio"
          titulo={q ? "Nada encontrado." : "Nenhum profissional ainda."}
          frase={
            q ? "Confira o nome, o telefone ou o ofício, ou tente outra busca."
              : filtro === "inactive_60d" ? "Ninguém parado há 60 dias sem compra — sinal bom."
                : filtro === "new" ? "Ninguém marcado nos últimos 30 dias."
                  : "Marque um pedreiro como profissional na ficha dele e indique-o na próxima venda — ele aparece aqui."
          }
        />
      ) : (
        <View style={{ gap: 8 }} testID="matcon-lista-profissionais">
          {profissionais.map((p) => (
            <ProfessionalCard
              key={p.id}
              p={p}
              matcon={matcon}
              busy={busyId === p.id}
              onWhats={() => avisarNoWhatsApp(p)}
              onGerarCupom={() => gerarCupomDeResgate(p)}
              onChamarDeVolta={() => chamarDeVolta(p)}
            />
          ))}
          {isFetching && <ActivityIndicator color={Colors.violet3} size="small" />}
        </View>
      )}
    </ScrollView>
  );
}

function ProfessionalCard({ p, matcon, busy, onWhats, onGerarCupom, onChamarDeVolta }: {
  p: Professional;
  matcon: MatconSettings;
  busy: boolean;
  onWhats: () => void;
  onGerarCupom: () => void;
  onChamarDeVolta: () => void;
}) {
  const inativo = !p.active;
  const novo = !inativo && ehNovo(p.created_at);
  const dias = diasSemCompra(p.last_referral_at);
  const { valor: valorCupom, cupons } = cupomPossivel(p.points_balance, matcon.matcon_points_to_coupon, matcon.matcon_coupon_value);

  return (
    <EsteiraCard
      testID={`matcon-profissional-${p.id}`}
      tone={!inativo && cupons > 0 ? "amber" : undefined}
      dim={inativo}
      right={
        <Text style={st.pontos}>{fmtPontos(p.points_balance)} pts</Text>
      }
      actions={
        busy ? <ActivityIndicator size="small" color={Colors.violet3} /> : inativo ? (
          <Pressable onPress={onChamarDeVolta} style={[st.miniBtn, st.miniBtnWa]} testID={`matcon-chamar-${p.id}`}>
            <Icon name="whatsapp" size={13} color={Colors.green} />
            <Text style={[st.miniBtnText, { color: Colors.green }]}>Chamar de volta</Text>
          </Pressable>
        ) : (
          <>
            <Pressable onPress={onWhats} style={[st.miniBtn, st.miniBtnWa]} testID={`matcon-whats-${p.id}`}>
              <Icon name="whatsapp" size={13} color={Colors.green} />
              <Text style={[st.miniBtnText, { color: Colors.green }]}>Avisar no WhatsApp</Text>
            </Pressable>
            <Pressable onPress={onGerarCupom} style={[st.miniBtn, cupons > 0 && st.miniBtnPrimary]} testID={`matcon-cupom-${p.id}`}>
              <Icon name="percent" size={13} color={cupons > 0 ? "#fff" : Colors.ink} />
              <Text style={[st.miniBtnText, { color: cupons > 0 ? "#fff" : Colors.ink }]}>Gerar cupom de resgate</Text>
            </Pressable>
          </>
        )
      }
    >
      <Text style={st.nome} numberOfLines={1}>
        {p.customer_name}{" "}
        {novo && <Text style={[st.badge, st.badgeNovo]}>NOVO</Text>}
      </Text>
      <Text style={st.meta} numberOfLines={2}>{rotuloResumo(p)}</Text>
      {inativo && (
        <Text style={st.metaInativo} numberOfLines={2}>
          {p.referrals_count === 0 || dias === null
            ? "nenhuma compra indicada ainda"
            : `sem compra há ${dias} dias`}
          {valorCupom > 0 ? ` — tem ${fmtPontos(p.points_balance)} pontos parados, dá um cupom de ${fmtMoneyCurto(valorCupom)}` : ""}
        </Text>
      )}
    </EsteiraCard>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 980, alignSelf: "center", width: "100%" },

  ghostBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  ghostBtnText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },

  gate: { alignItems: "center", gap: 10, paddingVertical: 40, paddingHorizontal: 18 },
  gateIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  gateTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  gateDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 360, lineHeight: 17 },
  gateBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  gateBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: Colors.ink },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },

  loadingBox: { paddingVertical: 40, alignItems: "center" },

  nome: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  meta: { fontSize: 12, color: Colors.ink3, marginTop: 3, lineHeight: 17 },
  metaInativo: { fontSize: 12, color: Colors.ink3, marginTop: 3, lineHeight: 17, fontStyle: "italic" },

  badge: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, overflow: "hidden" },
  badgeNovo: { color: Colors.violet3, borderColor: Colors.violet },

  pontos: { fontFamily: Fonts.mono, fontSize: 17, color: Colors.ink },

  miniBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  miniBtnPrimary: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  miniBtnWa: { borderColor: Colors.green + "73", backgroundColor: Colors.bg3 },
  miniBtnText: { fontSize: 12, fontWeight: "700", color: Colors.ink },
});
