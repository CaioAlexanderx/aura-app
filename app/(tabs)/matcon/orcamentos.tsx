// ============================================================
// AURA. — Matcon: esteira de Orçamentos (M1)
//
// 22/09/2026. Não é uma lista: é uma ESTEIRA, como o Laboratório da Ótica
// (app/(tabs)/otica/index.tsx, o molde de código desta tela). O dono abre
// de manhã para saber "quantos orçamentos estão vencendo e quanto dinheiro
// tem parado ali" — por isso cada estação mostra a contagem E o dinheiro
// (docs/matcon-faseamento-po-ux.md §3/M1 e §4b regra 2).
//
// "Esteira" é nome NOSSO (código, mockup, docs). Na tela o lojista nunca
// lê essa palavra: é "orçamentos", "carregando", "virar pedido"
// (revisão de texto de 22/09/2026 — §4b regra 4, zero jargão).
//
// Mockup aprovado: docs/mockups/matcon-modulo.html#orcamentos.
// Esteira, card e estado vazio vêm de components/matcon/EsteiraMatcon.tsx
// (compartilhados com /matcon/entregas); as contas de vencimento, de
// components/matcon/quotesUtil.ts.
//
// Decisões desta tela:
//   · Chave de módulo PRÓPRIA `matcon.orcamentos` (regra 3 do CLAUDE.md),
//     já cadastrada em hooks/useVisibleModules.ts.
//   · Gate do toggle: sem pdv_settings.matcon_enabled a tela é só o
//     mesmo recado curto de /matcon/config. O backend já bloqueia a
//     escrita; aqui a tela nem se oferece.
//   · Multi-CNPJ (armadilha 2): orçamento é de UMA loja (estoque, preço,
//     numeração), então <RequireCompanyScope> força escolher a empresa
//     antes de renderizar, como o Caixa e a NF-e fazem.
//   · Regra 7: ações sempre visíveis no card, sem hover.
//   · Vencendo é marcado por forma + texto ("▲ vence amanhã"), nunca só
//     por cor.
//
// QA 23/09/2026 (a rota ainda respondia 404 em produção):
//   · Sem tentativas por cima do client (RETRY_DA_TELA): nada de 10 s
//     girando. "Carregando…" só enquanto carrega; falhou → <EsteiraErro>
//     com "Tentar de novo" — o erro nunca vira "Nenhum orçamento ainda".
//   · O estado vazio nomeia o botão que existe de verdade no Caixa:
//     "Orçamento" (ele imprime E guarda o orçamento aqui).
//   · Contrato (docs/CONTRACT_MATCON.md §M1): orçamento que venceu vira
//     `expired`, não `lost`. "Perdidos" é só o que o cliente recusou; o
//     vencido ganha "Refazer com preço de hoje" em vez de "Virar pedido".
//     O resumo `approved` não tem período no contrato — o subtítulo não
//     promete "este mês".
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
import { matconApi, type Quote, type QuoteStatus } from "@/services/matconApi";
import { readMatconSettings, type MatconSettings } from "@/constants/matcon";
import { chaveDoOrcamento } from "@/hooks/useOrcamentoNoCaixa";
import { openWhatsApp } from "@/utils/whatsapp";
import { EsteiraMatcon, EsteiraCard, EsteiraVazia, EsteiraVaziaDestaque, EsteiraErro, type EsteiraEstacao } from "@/components/matcon/EsteiraMatcon";
import { RETRY_DA_TELA, fraseDoErroDeCarga, textoDoErro } from "@/components/matcon/erroMatcon";
import { diasAteVencer, estaVencendo, fmtDiaMes, rotuloVencimento, rotuloAutoria, seloVencimento } from "@/components/matcon/quotesUtil";

// Mesmo endereço público do orçamento do Studio (app/orcamento/[token].tsx).
// No web preferimos a origem real, para o link funcionar em preview/local.
const APP_ORIGIN = "https://app.getaura.com.br";

function urlPublica(token: string): string {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return `${window.location.origin}/orcamento/${token}`;
  }
  return `${APP_ORIGIN}/orcamento/${token}`;
}

const fmtMoney = (n: number | string | null | undefined) =>
  `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Dinheiro da esteira e da linha-resumo: sem centavos, que é o que se lê de longe. */
const fmtMoneyCurto = (n: number | string | null | undefined) =>
  `R$ ${Math.round(Number(n || 0)).toLocaleString("pt-BR")}`;

/**
 * A linha-resumo do topo (QA 23/09/2026): com um orçamento de R$ 979,90 ela
 * dizia "R$ 980" e o card logo abaixo "R$ 979,90" — parecia conta errada.
 * Abaixo de R$ 10 mil vai com centavos, igual ao card; acima disso o
 * arredondado lê melhor e ninguém confunde com o card.
 */
const fmtMoneyResumo = (n: number | string | null | undefined) =>
  Math.abs(Number(n || 0)) < 10_000 ? fmtMoney(n) : fmtMoneyCurto(n);

function primeiroNome(nome: string | null | undefined): string {
  const t = (nome || "").trim();
  return t ? t.split(/\s+/)[0] : "";
}

type Filtro = "vencendo" | "abertos" | "aprovados" | "perdidos" | "todos";

const CHIPS: { key: Filtro; label: string }[] = [
  { key: "vencendo", label: "Vencendo" },
  { key: "abertos", label: "Abertos" },
  { key: "aprovados", label: "Aprovados" },
  { key: "perdidos", label: "Perdidos" },
  { key: "todos", label: "Todos" },
];

/** O filtro da tela vira o `status` que o backend entende. */
function statusDoFiltro(f: Filtro): QuoteStatus | "all" {
  if (f === "aprovados") return "approved";
  if (f === "perdidos") return "lost";
  if (f === "todos") return "all";
  return "open"; // abertos e vencendo saem do mesmo status; vencendo filtra aqui
}

export default function MatconOrcamentosRoute() {
  // Multi-CNPJ: no modo consolidado o picker aparece antes da esteira.
  return (
    <RequireCompanyScope context="matcon" actionLabel="ver os orçamentos">
      <MatconOrcamentosScreen />
    </RequireCompanyScope>
  );
}

function MatconOrcamentosScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const { settings } = usePdvSettings();
  const matcon = useMemo(() => readMatconSettings(settings as Partial<MatconSettings>), [settings]);
  const enabled = matcon.matcon_enabled;
  const warnDays = matcon.matcon_quote_warn_days;

  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const [busca, setBusca] = useState("");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const status = statusDoFiltro(filtro);
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["matcon-quotes", company?.id, status, q],
    queryFn: () => matconApi.listQuotes(company!.id, { status, q: q || undefined, limit: 200 }),
    enabled: !!company?.id && enabled,
    staleTime: 30_000,
    retry: RETRY_DA_TELA,
  });
  // Falhou e não há nada guardado para mostrar: bloco de erro, não lista vazia.
  const falhou = isError && !data;

  const resumo = data?.summary;

  const quotes = useMemo(() => {
    const todos = (data?.quotes || []) as Quote[];
    const lista = filtro === "vencendo"
      ? todos.filter((quote) => estaVencendo(quote.valid_until, warnDays))
      : todos;
    // Quem vence antes aparece antes; sem validade, o mais novo primeiro.
    return [...lista].sort((a, b) => {
      const da = diasAteVencer(a.valid_until);
      const db = diasAteVencer(b.valid_until);
      if (da !== null && db !== null && da !== db) return da - db;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [data, filtro, warnDays]);

  const estacoes: EsteiraEstacao[] = [
    { key: "abertos", label: "Abertos", count: resumo ? resumo.open.count : null, money: resumo ? fmtMoneyCurto(resumo.open.total) : null, tone: "violet", active: filtro === "abertos", onPress: () => setFiltro("abertos") },
    { key: "vencendo", label: `Vencendo em ${warnDays} ${warnDays === 1 ? "dia" : "dias"}`, count: resumo ? resumo.expiring.count : null, money: resumo ? fmtMoneyCurto(resumo.expiring.total) : null, tone: "amber", active: filtro === "vencendo", onPress: () => setFiltro("vencendo") },
    { key: "aprovados", label: "Aprovados", count: resumo ? resumo.approved.count : null, money: resumo ? fmtMoneyCurto(resumo.approved.total) : null, tone: "green", active: filtro === "aprovados", onPress: () => setFiltro("aprovados") },
    { key: "perdidos", label: "Perdidos", count: resumo ? resumo.lost.count : null, money: resumo ? fmtMoneyCurto(resumo.lost.total) : null, tone: "muted", active: filtro === "perdidos", onPress: () => setFiltro("perdidos") },
  ];

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["matcon-quotes"] });
  }

  // ── Ações do card ─────────────────────────────────────────
  // O wa.me abre SÍNCRONO no toque (utils/whatsapp.ts): esperar o
  // markQuoteSent antes de abrir faria o navegador bloquear o pop-up.
  async function enviarNoWhatsApp(quote: Quote) {
    if (!company?.id || busyId) return;
    const url = urlPublica(quote.public_token);
    const nome = primeiroNome(quote.customer_name);
    const ola = nome ? `Oi, ${nome}! ` : "";
    const texto = quote.sent_at
      ? `${ola}Passando pra saber do orçamento #${quote.number} — ele vale até ${fmtDiaMes(quote.valid_until)}: ${url}`
      : `${ola}Segue o seu orçamento #${quote.number}: ${url}`;

    if (!openWhatsApp(quote.customer_phone, texto)) {
      // Sem telefone no cadastro: abre o WhatsApp sem destinatário e a
      // pessoa escolhe o contato — melhor que travar o envio.
      if (typeof window !== "undefined" && typeof window.open === "function") {
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
      }
    }

    setBusyId(quote.id);
    try {
      await matconApi.markQuoteSent(company.id, quote.id);
      invalidate();
      toast.success(`Orçamento #${quote.number} marcado como enviado`);
    } catch (e: any) {
      toast.error(textoDoErro(e, "O WhatsApp abriu, mas não consegui marcar o orçamento como enviado. Tente de novo em instantes."));
    } finally {
      setBusyId(null);
    }
  }

  async function converterEmPedido(quote: Quote) {
    if (!company?.id || busyId) return;
    setBusyId(quote.id);
    try {
      const res = await matconApi.convertQuote(company.id, quote.id);
      invalidate();
      // QA 23/09/2026: sem aviso aqui — quem avisa é o Caixa, uma vez só,
      // quando o carrinho já está montado ("Orçamento #1 no carrinho — 2
      // itens", hooks/useOrcamentoNoCaixa.ts). O orçamento convertido fica
      // no cache na mesma chave que o Caixa lê, então lá ele nem precisa
      // buscar de novo; quem manda continua sendo o `quote` da URL.
      qc.setQueryData(chaveDoOrcamento(company.id, quote.id), { quote: res.quote });
      router.push(`/pdv?quote=${quote.id}` as any);
    } catch (e: any) {
      toast.error(textoDoErro(e, "Não consegui virar o orçamento em pedido. Tente de novo em instantes."));
    } finally {
      setBusyId(null);
    }
  }

  async function refazerComPrecoDeHoje(quote: Quote) {
    if (!company?.id || busyId) return;
    setBusyId(quote.id);
    try {
      const res = await matconApi.createQuote(company.id, {
        customer_id: quote.customer_id,
        customer_name: quote.customer_name,
        customer_phone: quote.customer_phone,
        seller_id: quote.seller_id,
        items: quote.items,
        discount: quote.discount,
        notes: quote.notes,
        reference: quote.reference,
      });
      invalidate();
      setFiltro("abertos");
      toast.success(`Orçamento #${res.quote.number} aberto a partir do #${quote.number} — confira os preços antes de enviar`);
    } catch (e: any) {
      toast.error(textoDoErro(e, "Não consegui refazer o orçamento. Tente de novo em instantes."));
    } finally {
      setBusyId(null);
    }
  }

  // ── Tela ──────────────────────────────────────────────────
  if (!enabled) {
    return (
      <ScrollView style={st.screen} contentContainerStyle={st.content}>
        <ScreenHero eyebrow="Matcon" title="Orçamentos" />
        <View style={st.gate} testID="matcon-orcamentos-desligado">
          <View style={st.gateIcon}><Icon name="lock" size={20} color={Colors.violet3} /></View>
          <Text style={st.gateTitle}>Ligue &quot;Materiais de construção&quot; em Configurações › Caixa</Text>
          <Text style={st.gateDesc}>Os orçamentos só aparecem para lojas com o módulo ligado.</Text>
          <Pressable onPress={() => router.push("/configuracoes" as any)} style={st.gateBtn} testID="matcon-orcamentos-ir-config">
            <Text style={st.gateBtnText}>Abrir Configurações</Text>
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
        title="Orçamentos"
        live={!!resumo}
        subtitle={
          !resumo ? (falhou ? "Não consegui carregar os orçamentos agora." : isLoading ? "Carregando…" : undefined) : (
            <Text>
              {fmtMoneyResumo(resumo.open.total)} em orçamentos abertos ·{" "}
              <Text style={{ color: resumo.expiring.count > 0 ? Colors.amber : Colors.ink3, fontWeight: resumo.expiring.count > 0 ? "700" : "400" }}>
                {fmtMoneyResumo(resumo.expiring.total)} {resumo.expiring.count === 1 ? "vence" : "vencem"} em até {warnDays} {warnDays === 1 ? "dia" : "dias"}
              </Text>
              {" "}· {resumo.approved.count} {resumo.approved.count === 1 ? "aprovado" : "aprovados"}
            </Text>
          )
        }
        actions={
          <>
            <Pressable onPress={() => router.push("/matcon/entregas" as any)} style={st.ghostBtn} testID="matcon-ir-entregas">
              <Icon name="truck" size={14} color={Colors.ink} />
              <Text style={st.ghostBtnText}>Entregas</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/pdv" as any)} style={st.newBtn} testID="matcon-novo-orcamento">
              <Icon name="plus" size={14} color="#fff" />
              <Text style={st.newBtnText}>Novo orçamento</Text>
            </Pressable>
          </>
        }
      />

      <EsteiraMatcon stations={estacoes} testID="matcon-esteira-orcamentos" />

      <View style={st.searchBox}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput
          style={st.searchInput}
          value={busca}
          onChangeText={setBusca}
          onSubmitEditing={() => setQ(busca.trim())}
          placeholder="Número do orçamento, cliente ou obra"
          placeholderTextColor={Colors.ink3}
          returnKeyType="search"
          testID="matcon-busca"
        />
        {!!q && (
          <Pressable onPress={() => { setBusca(""); setQ(""); }} accessibilityLabel="Limpar busca">
            <Icon name="x" size={14} color={Colors.ink3} />
          </Pressable>
        )}
      </View>

      <View style={st.chips}>
        {CHIPS.map((c) => (
          <Pressable key={c.key} onPress={() => setFiltro(c.key)} style={[st.chip, filtro === c.key && st.chipOn]} testID={`matcon-chip-${c.key}`}>
            <Text style={[st.chipText, filtro === c.key && st.chipTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={st.loadingBox} testID="matcon-orcamentos-carregando"><ActivityIndicator color={Colors.violet3} /></View>
      ) : falhou ? (
        <EsteiraErro
          testID="matcon-orcamentos-erro"
          titulo="Não consegui carregar os orçamentos."
          frase={fraseDoErroDeCarga(error)}
          onTentarDeNovo={() => { refetch(); }}
          tentando={isFetching}
        />
      ) : !data ? null : quotes.length === 0 ? (
        <EsteiraVazia
          testID="matcon-orcamentos-vazio"
          titulo={q ? "Nada encontrado." : filtro === "vencendo" ? "Nenhum orçamento vencendo." : filtro === "aprovados" ? "Nenhum orçamento aprovado ainda." : filtro === "perdidos" ? "Nenhum orçamento perdido." : "Nenhum orçamento ainda."}
          frase={
            q ? "Confira o número do orçamento, ou tente pelo nome do cliente ou pela obra."
              : filtro === "vencendo" ? `Nenhum orçamento vence nos próximos ${warnDays} ${warnDays === 1 ? "dia" : "dias"} — quando algum entrar nessa conta, ele aparece aqui.`
                : filtro === "aprovados" ? <Text>Quando o cliente aprovar pelo link, o card pula para <EsteiraVaziaDestaque>Aprovados</EsteiraVaziaDestaque> sozinho.</Text>
                  : filtro === "perdidos" ? "Orçamento que o cliente recusou cai aqui — dá para refazer com o preço de hoje."
                    : <Text>Monte o carrinho no Caixa e toque em <EsteiraVaziaDestaque>Orçamento</EsteiraVaziaDestaque>. Ele é impresso e fica guardado aqui, em Abertos.</Text>
          }
          acao={
            !q && filtro !== "aprovados" && filtro !== "perdidos" ? (
              <Pressable onPress={() => router.push("/pdv" as any)} style={st.newBtn} testID="matcon-vazio-ir-caixa">
                <Icon name="plus" size={14} color="#fff" />
                <Text style={st.newBtnText}>Novo orçamento</Text>
              </Pressable>
            ) : undefined
          }
        />
      ) : (
        <View style={{ gap: 8 }} testID="matcon-lista-orcamentos">
          {quotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              warnDays={warnDays}
              busy={busyId === quote.id}
              onWhats={() => enviarNoWhatsApp(quote)}
              onConverter={() => converterEmPedido(quote)}
              onRefazer={() => refazerComPrecoDeHoje(quote)}
            />
          ))}
          {isFetching && <ActivityIndicator color={Colors.violet3} size="small" />}
        </View>
      )}
    </ScrollView>
  );
}

function QuoteCard({ quote, warnDays, busy, onWhats, onConverter, onRefazer }: {
  quote: Quote;
  warnDays: number;
  busy: boolean;
  onWhats: () => void;
  onConverter: () => void;
  onRefazer: () => void;
}) {
  const perdido = quote.status === "lost";
  const vencido = quote.status === "expired";
  const aprovado = quote.status === "approved";
  const aberto = quote.status === "open";
  const vencendo = aberto && estaVencendo(quote.valid_until, warnDays);
  const convertido = !!quote.converted_sale_id;

  const selo = perdido ? "Perdido"
    : aprovado ? "Aprovado"
      : vencendo ? seloVencimento(quote.valid_until)
        : quote.status === "expired" ? "Venceu" : "Aberto";
  const corSelo = perdido ? Colors.ink3 : aprovado ? Colors.green : vencendo || quote.status === "expired" ? Colors.amber : Colors.violet3;

  const nItens = quote.items ? quote.items.length : 0;
  const meta = [`#${String(quote.number).padStart(4, "0")}`, `${nItens} ${nItens === 1 ? "item" : "itens"}`, quote.reference || ""].filter(Boolean).join(" · ");
  const autoria = rotuloAutoria(quote.seller_name, quote.created_at);
  const vencimento = rotuloVencimento(quote.valid_until, { warnDays });
  const linhaPrazo = [vencimento, autoria].filter(Boolean).join(" · ");

  return (
    <EsteiraCard
      testID={`matcon-orcamento-${quote.number}`}
      tone={vencendo ? "amber" : undefined}
      dim={perdido || vencido}
      right={
        <>
          <View style={[st.badge, { borderColor: corSelo }]}>
            <Text style={[st.badgeText, { color: corSelo }]}>{selo}</Text>
          </View>
          <Text style={st.total}>{fmtMoney(quote.total)}</Text>
        </>
      }
      actions={
        busy ? <ActivityIndicator size="small" color={Colors.violet3} /> : (
          <>
            {aberto && (
              <Pressable onPress={onWhats} style={[st.miniBtn, st.miniBtnWa]} testID={`matcon-whats-${quote.number}`}>
                <Icon name="whatsapp" size={13} color={Colors.green} />
                <Text style={[st.miniBtnText, { color: Colors.green }]}>{quote.sent_at ? "Cobrar no WhatsApp" : "Enviar no WhatsApp"}</Text>
              </Pressable>
            )}
            {(aberto || aprovado) && !convertido && (
              <Pressable onPress={onConverter} style={[st.miniBtn, st.miniBtnPrimary]} testID={`matcon-converter-${quote.number}`}>
                <Text style={[st.miniBtnText, { color: "#fff" }]}>Virar pedido</Text>
              </Pressable>
            )}
            {(perdido || vencido) && (
              <Pressable onPress={onRefazer} style={st.miniBtn} testID={`matcon-refazer-${quote.number}`}>
                <Text style={st.miniBtnText}>Refazer com preço de hoje</Text>
              </Pressable>
            )}
          </>
        )
      }
    >
      <Text style={st.cliente}>{quote.customer_name || "Cliente do balcão"}</Text>
      <Text style={st.meta} numberOfLines={2}>{meta}</Text>
      {!!linhaPrazo && (
        // Vencendo por FORMA + TEXTO: o "▲" e a palavra "vence" contam a
        // história mesmo para quem não distingue a cor âmbar.
        <Text style={[st.meta, vencendo && st.metaAlerta, (perdido || vencido) && st.metaPerdido]} numberOfLines={2}>
          {vencendo ? "▲ " : ""}{linhaPrazo}
        </Text>
      )}
      {convertido && <Text style={st.metaOk}>já virou pedido</Text>}
    </EsteiraCard>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 980, alignSelf: "center", width: "100%" },

  ghostBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  ghostBtnText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  newBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },

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

  cliente: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  meta: { fontSize: 12, color: Colors.ink3, marginTop: 3, lineHeight: 17 },
  metaAlerta: { color: Colors.amber, fontWeight: "600" },
  metaPerdido: { color: Colors.ink3 },
  metaOk: { fontSize: 11, color: Colors.green, marginTop: 3, fontWeight: "600" },

  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  total: { fontFamily: Fonts.mono, fontSize: 17, color: Colors.ink },

  miniBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  miniBtnPrimary: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  miniBtnWa: { borderColor: Colors.green + "73", backgroundColor: Colors.bg3 },
  miniBtnText: { fontSize: 12, fontWeight: "700", color: Colors.ink },
});
