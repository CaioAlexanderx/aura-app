// ============================================================
// AURA. — Matcon: esteira de Entregas (M1)
//
// 22/09/2026. Igual a /matcon/orcamentos (mesmo molde de código, mesma
// EsteiraMatcon/EsteiraCard/EsteiraVazia): o dono abre de manhã pra saber
// "quanto material tá parado esperando caminhão" e "quem ainda não
// recebeu tudo" — por isso a estação mostra a contagem E o dinheiro
// (docs/matcon-faseamento-po-ux.md §3/M1 e §4b regra 2).
//
// "Esteira" é nome NOSSO; na tela o lojista lê "entregas" (revisão de
// texto de 22/09/2026 — §4b regra 4, zero jargão). O campo "quem
// entregou" também parou de explicar decisão de produto no placeholder.
//
// Mockup aprovado: docs/mockups/matcon-modulo.html#entregas.
// Esteira, card e estado vazio vêm de components/matcon/EsteiraMatcon.tsx
// (compartilhados com /matcon/orcamentos); as contas de progresso e de
// agrupamento por dia, de components/matcon/deliveriesUtil.ts.
//
// Decisões desta tela:
//   · Chave de módulo PRÓPRIA `matcon.entregas` (regra 3 do CLAUDE.md),
//     já cadastrada em hooks/useVisibleModules.ts e no NAV
//     (app/(tabs)/_layout.tsx).
//   · Gate do toggle: igual a /matcon/orcamentos — sem
//     pdv_settings.matcon_enabled a tela é só o mesmo recado curto.
//   · Multi-CNPJ (armadilha 2): entrega é de UMA loja (estoque, pedido),
//     então <RequireCompanyScope> força escolher a empresa antes de
//     renderizar.
//   · Duas dimensões de filtro, do jeito que a API já modela
//     (services/matconApi.ts DeliveryListFilters): os CHIPS filtram por
//     `day` (Hoje/Amanhã/Com saldo a entregar/Atrasadas — decisão
//     22/09/2026); tocar numa estação do rail filtra por `stage`
//     (alterna: tocar de novo limpa). As duas chegam juntas na mesma
//     query.
//   · "Quem entregou" é campo livre (decisão 22/09/2026 do faseamento:
//     sem cadastro de motorista) — salva no blur, sem travar a tela
//     inteira com spinner.
//   · "Entrega parcial" (só com stage "out") abre um ResponsiveSheet com
//     uma linha por item; confirmar chama splitDelivery, que fecha esta
//     entrega e cria a próxima com o saldo — é por isso que o mesmo
//     pedido pode aparecer em dois dias diferentes.
//   · Regra 7: ações sempre visíveis no card, sem hover.
//   · "Nova entrega" fica de fora de propósito — a entrega nasce da
//     venda (conversão de orçamento ou finalização no Caixa).
//
// QA 23/09/2026 (a rota ainda respondia 404 em produção):
//   · Sem tentativas por cima do client (RETRY_DA_TELA). "Carregando…" só
//     enquanto carrega; falhou → <EsteiraErro> com "Tentar de novo" — o
//     erro nunca vira "Nenhuma entrega hoje".
//   · O estado vazio explica de onde a entrega nasce: da venda feita a
//     partir de um orçamento, ou do botão "Criar entrega" no detalhe da
//     venda (components/screens/vendas/SaleDetailModal.tsx, POST
//     .../deliveries do contrato).
//   · `?dia=pending` na URL abre direto em "Com saldo a entregar" — é o
//     destino do selo "saldo a entregar" do detalhe da venda.
//   · "NF-e" virou "nota fiscal" no card (texto sem sigla).
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ScreenHero } from "@/components/ScreenHero";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import {
  matconApi, type Delivery, type DeliveryItem, type DeliveryStage, type DeliveryListFilters,
} from "@/services/matconApi";
import { readMatconSettings, type MatconSettings } from "@/constants/matcon";
import { parseQtyInput, fmtQty } from "@/utils/matconUnits";
import {
  EsteiraMatcon, EsteiraCard, EsteiraVazia, EsteiraVaziaDestaque, EsteiraErro, type EsteiraEstacao,
} from "@/components/matcon/EsteiraMatcon";
import { RETRY_DA_TELA, fraseDoErroDeCarga, textoDoErro } from "@/components/matcon/erroMatcon";
import {
  agruparPorDia, progressoDoItem, rotuloProgresso, seloSaldo, proximaEtapa, seloEstacao,
} from "@/components/matcon/deliveriesUtil";
import { EmitirNfeEntregaSheet } from "@/components/matcon/EmitirNfeEntregaSheet";
import { STATUS_MAP, openDanfe, openDanfeTermica } from "@/components/screens/nfe/shared";

const fmtMoney = (n: number | string | null | undefined) =>
  `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Dinheiro da esteira e da linha-resumo: sem centavos, que é o que se lê de longe. */
const fmtMoneyCurto = (n: number | string | null | undefined) =>
  `R$ ${Math.round(Number(n || 0)).toLocaleString("pt-BR")}`;

type DiaFiltro = "today" | "tomorrow" | "pending" | "late";

function diaDaUrl(v: unknown): DiaFiltro {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "tomorrow" || s === "pending" || s === "late" ? s : "today";
}

const CHIPS: { key: DiaFiltro; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "tomorrow", label: "Amanhã" },
  { key: "pending", label: "Com saldo a entregar" },
  { key: "late", label: "Atrasadas" },
];

// Placeholder do campo livre "quem entregou": só o que o vendedor precisa
// saber pra preencher. A decisão de não ter cadastro de motorista fica no
// comentário do topo, não na tela.
const QUEM_ENTREGOU_PLACEHOLDER = "Nome de quem levou";

export default function MatconEntregasRoute() {
  // Multi-CNPJ: no modo consolidado o picker aparece antes da esteira.
  return (
    <RequireCompanyScope context="matcon" actionLabel="ver as entregas">
      <MatconEntregasScreen />
    </RequireCompanyScope>
  );
}

function MatconEntregasScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const { settings } = usePdvSettings();
  const matcon = useMemo(() => readMatconSettings(settings as Partial<MatconSettings>), [settings]);
  const enabled = matcon.matcon_enabled;

  const params = useLocalSearchParams<{ dia?: string }>();
  const [dia, setDia] = useState<DiaFiltro>(() => diaDaUrl(params?.dia));
  const [stage, setStage] = useState<DeliveryStage | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [parcialDe, setParcialDe] = useState<Delivery | null>(null);
  // Matcon M2 (fiscal do Simples): sheet "Emitir NF-e" — montada só quando
  // o vendedor toca no botão (ver comentário no topo de
  // EmitirNfeEntregaSheet.tsx sobre por que não fica sempre montada).
  const [emitirDe, setEmitirDe] = useState<Delivery | null>(null);
  const [danfeBusyId, setDanfeBusyId] = useState<string | null>(null);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["matcon-deliveries", company?.id, dia, stage],
    queryFn: () =>
      matconApi.listDeliveries(company!.id, {
        day: dia,
        stage: stage === "all" ? undefined : stage,
        limit: 200,
      } as DeliveryListFilters),
    enabled: !!company?.id && enabled,
    staleTime: 15_000,
    retry: RETRY_DA_TELA,
  });
  // Falhou e não há nada guardado para mostrar: bloco de erro, não lista vazia.
  const falhou = isError && !data;

  const resumo = data?.summary;
  const grupos = useMemo(() => agruparPorDia(data?.deliveries || []), [data]);

  const estacoes: EsteiraEstacao[] = [
    { key: "separating", label: "Separando", count: resumo ? resumo.separating.count : null, money: resumo ? fmtMoneyCurto(resumo.separating.total) : null, tone: "violet", active: stage === "separating", onPress: () => alternarEstacao("separating") },
    { key: "ready", label: "Pronto", count: resumo ? resumo.ready.count : null, money: resumo ? fmtMoneyCurto(resumo.ready.total) : null, tone: "violet", active: stage === "ready", onPress: () => alternarEstacao("ready") },
    { key: "out", label: "Saiu para entrega", count: resumo ? resumo.out.count : null, money: resumo ? fmtMoneyCurto(resumo.out.total) : null, tone: "amber", active: stage === "out", onPress: () => alternarEstacao("out") },
    { key: "delivered", label: "Entregue hoje", count: resumo ? resumo.delivered_today.count : null, money: resumo ? fmtMoneyCurto(resumo.delivered_today.total) : null, tone: "green", active: stage === "delivered", onPress: () => alternarEstacao("delivered") },
  ];

  function alternarEstacao(s: DeliveryStage) {
    setStage((prev) => (prev === s ? "all" : s));
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["matcon-deliveries"] });
  }

  // ── Ações do card ─────────────────────────────────────────
  async function avancarEtapa(delivery: Delivery) {
    if (!company?.id || busyId) return;
    const proxima = proximaEtapa(delivery.stage);
    if (!proxima) return;
    setBusyId(delivery.id);
    try {
      await matconApi.updateDelivery(company.id, delivery.id, { stage: proxima.stage });
      invalidate();
    } catch (e: any) {
      toast.error(textoDoErro(e, "Não consegui mudar a etapa da entrega. Tente de novo em instantes."));
    } finally {
      setBusyId(null);
    }
  }

  async function salvarQuemEntregou(delivery: Delivery, texto: string) {
    if (!company?.id) return;
    const valor = texto.trim();
    if (valor === (delivery.delivered_by || "")) return;
    try {
      await matconApi.updateDelivery(company.id, delivery.id, { delivered_by: valor || null });
      invalidate();
    } catch (e: any) {
      toast.error(textoDoErro(e, "Não consegui salvar quem entregou. Tente de novo em instantes."));
    }
  }

  async function verDanfe(delivery: Delivery) {
    if (!company?.id || danfeBusyId) return;
    if (delivery.danfe_url) {
      openDanfe(delivery.danfe_url);
      return;
    }
    if (!delivery.nfe_emission_id) return;
    setDanfeBusyId(delivery.id);
    try {
      await openDanfeTermica(company.id, delivery.nfe_emission_id);
    } catch (e: any) {
      toast.error(textoDoErro(e, "Não consegui abrir a nota fiscal. Tente de novo em instantes."));
    } finally {
      setDanfeBusyId(null);
    }
  }

  async function confirmarParcial(delivery: Delivery, itens: Array<{ sale_item_id: string; quantity: number }>, deliveredBy: string) {
    if (!company?.id) return;
    setBusyId(delivery.id);
    try {
      await matconApi.splitDelivery(company.id, delivery.id, {
        items: itens,
        delivered_by: deliveredBy.trim() || undefined,
      });
      setParcialDe(null);
      invalidate();
      toast.success("Entrega registrada. A próxima já está criada com o saldo.");
    } catch (e: any) {
      toast.error(textoDoErro(e, "Não consegui registrar a entrega parcial. Tente de novo em instantes."));
    } finally {
      setBusyId(null);
    }
  }

  // ── Tela ──────────────────────────────────────────────────
  if (!enabled) {
    return (
      <ScrollView style={st.screen} contentContainerStyle={st.content}>
        <ScreenHero eyebrow="Matcon" title="Entregas" />
        <View style={st.gate} testID="matcon-entregas-desligado">
          <View style={st.gateIcon}><Icon name="lock" size={20} color={Colors.violet3} /></View>
          <Text style={st.gateTitle}>Ligue &quot;Materiais de construção&quot; em Configurações › Caixa</Text>
          <Text style={st.gateDesc}>As entregas só aparecem para lojas com o módulo ligado.</Text>
          <Pressable onPress={() => router.push("/configuracoes" as any)} style={st.gateBtn} testID="matcon-entregas-ir-config">
            <Text style={st.gateBtnText}>Abrir Configurações</Text>
            <Icon name="chevron_right" size={14} color="#fff" />
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const materialParado = resumo ? resumo.separating.total + resumo.ready.total + resumo.out.total : 0;
  const pedidosComSaldo = resumo ? resumo.pending_orders : 0;

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <ScreenHero
        eyebrow="Matcon"
        title="Entregas"
        live={!!resumo}
        subtitle={
          !resumo ? (falhou ? "Não consegui carregar as entregas agora." : isLoading ? "Carregando…" : undefined) : (
            <Text>
              {fmtMoneyCurto(materialParado)} em material vendido esperando caminhão ·{" "}
              <Text style={{ color: pedidosComSaldo > 0 ? Colors.amber : Colors.ink3, fontWeight: pedidosComSaldo > 0 ? "700" : "400" }}>
                {pedidosComSaldo} {pedidosComSaldo === 1 ? "pedido" : "pedidos"} com saldo a entregar
              </Text>
            </Text>
          )
        }
        actions={
          <Pressable onPress={() => router.push("/matcon/orcamentos" as any)} style={st.ghostBtn} testID="matcon-ir-orcamentos">
            <Icon name="clipboard" size={14} color={Colors.ink} />
            <Text style={st.ghostBtnText}>Orçamentos</Text>
          </Pressable>
        }
      />

      <EsteiraMatcon stations={estacoes} testID="matcon-esteira-entregas" />

      <View style={st.chips}>
        {CHIPS.map((c) => (
          <Pressable key={c.key} onPress={() => setDia(c.key)} style={[st.chip, dia === c.key && st.chipOn]} testID={`matcon-chip-${c.key}`}>
            <Text style={[st.chipText, dia === c.key && st.chipTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={st.loadingBox} testID="matcon-entregas-carregando"><ActivityIndicator color={Colors.violet3} /></View>
      ) : falhou ? (
        <EsteiraErro
          testID="matcon-entregas-erro"
          titulo="Não consegui carregar as entregas."
          frase={fraseDoErroDeCarga(error)}
          onTentarDeNovo={() => { refetch(); }}
          tentando={isFetching}
        />
      ) : !data ? null : grupos.length === 0 ? (
        <EsteiraVazia
          testID="matcon-entregas-vazio"
          titulo={
            dia === "today" ? "Nenhuma entrega hoje."
              : dia === "tomorrow" ? "Nenhuma entrega amanhã."
                : dia === "pending" ? "Nenhum pedido com saldo a entregar."
                  : "Nenhuma entrega atrasada."
          }
          frase={
            dia === "today" ? (
              <Text>A entrega nasce da venda: quando a venda sai de um orçamento que virou pedido, ou quando você toca em <EsteiraVaziaDestaque>Criar entrega</EsteiraVaziaDestaque> no detalhe da venda, em Vendas. Ela aparece aqui, em <EsteiraVaziaDestaque>Separando</EsteiraVaziaDestaque>.</Text>
            ) : dia === "tomorrow" ? "Quando uma entrega for marcada para amanhã, ela aparece aqui."
              : dia === "pending" ? "Toda entrega dividida em duas viagens aparece aqui até fechar o saldo."
                : "Tudo o que estava marcado para antes de hoje já saiu."
          }
          acao={
            <Pressable onPress={() => router.push("/matcon/orcamentos" as any)} style={st.newBtn} testID="matcon-vazio-ir-orcamentos">
              <Icon name="clipboard" size={14} color="#fff" />
              <Text style={st.newBtnText}>Ver orçamentos</Text>
            </Pressable>
          }
        />
      ) : (
        <View style={{ gap: 4 }} testID="matcon-lista-entregas">
          {grupos.map((grupo) => (
            <View key={grupo.diaISO}>
              <Text style={st.diaRotulo}>{grupo.rotulo}</Text>
              <View style={{ gap: 8, marginBottom: 18 }}>
                {grupo.entregas.map((delivery) => (
                  <DeliveryCard
                    key={delivery.id}
                    delivery={delivery}
                    busy={busyId === delivery.id}
                    danfeBusy={danfeBusyId === delivery.id}
                    onAvancar={() => avancarEtapa(delivery)}
                    onParcial={() => setParcialDe(delivery)}
                    onSalvarQuemEntregou={(texto) => salvarQuemEntregou(delivery, texto)}
                    onEmitirNfe={() => setEmitirDe(delivery)}
                    onVerDanfe={() => verDanfe(delivery)}
                  />
                ))}
              </View>
            </View>
          ))}
          {isFetching && <ActivityIndicator color={Colors.violet3} size="small" />}
        </View>
      )}

      <EntregaParcialSheet
        delivery={parcialDe}
        busy={!!parcialDe && busyId === parcialDe.id}
        onClose={() => setParcialDe(null)}
        onConfirm={confirmarParcial}
      />

      {emitirDe && company?.id && (
        <EmitirNfeEntregaSheet
          delivery={emitirDe}
          companyId={company.id}
          onClose={() => setEmitirDe(null)}
        />
      )}
    </ScrollView>
  );
}

// ── Card de entrega ───────────────────────────────────────────
function DeliveryCard({ delivery, busy, danfeBusy, onAvancar, onParcial, onSalvarQuemEntregou, onEmitirNfe, onVerDanfe }: {
  delivery: Delivery;
  busy: boolean;
  danfeBusy: boolean;
  onAvancar: () => void;
  onParcial: () => void;
  onSalvarQuemEntregou: (texto: string) => void;
  onEmitirNfe: () => void;
  onVerDanfe: () => void;
}) {
  const entregue = delivery.stage === "delivered";
  const proxima = proximaEtapa(delivery.stage);
  const selo = seloEstacao(delivery);
  const corSelo = delivery.stage === "out" ? Colors.amber : delivery.stage === "delivered" ? Colors.green : Colors.violet3;
  const segundaViagem = delivery.sequence > 1;

  // Matcon M2 (fiscal do Simples): "Emitir NF-e" só existe em Pronto/Saiu —
  // material que nem foi conferido não vira nota. Nota recusada mostra o
  // motivo em português e o mesmo botão vira "Tentar de novo".
  const emStagePermitido = delivery.stage === "ready" || delivery.stage === "out";
  const temNota = !!delivery.nfe_emission_id;
  const notaAutorizada = delivery.nfe_status === "autorizada";
  const notaFalhou = delivery.nfe_status === "rejeitada" || delivery.nfe_status === "erro";
  const podeEmitirNfe = emStagePermitido && (!temNota || notaFalhou);
  const corNota = notaAutorizada ? Colors.green : notaFalhou ? Colors.red : Colors.violet3;
  const statusNotaLabel = delivery.nfe_status
    ? (STATUS_MAP[delivery.nfe_status]?.label || delivery.nfe_status).toUpperCase()
    : "PROCESSANDO";

  // sale_number não está no contrato das entregas (só em matconApi.ts):
  // sem ele, "Pedido" sozinho em vez de "Pedido #—".
  const rotuloPedido = delivery.sale_number != null ? `Pedido #${delivery.sale_number}` : "Pedido";
  const meta = [
    rotuloPedido,
    delivery.address || "",
    delivery.customer_phone || "",
  ].filter(Boolean).join(" · ");

  const linhaSequencia = segundaViagem
    ? [rotuloPedido, `${delivery.sequence}ª entrega`, "criada sozinha com o que faltou"].join(" · ")
    : meta;

  return (
    <EsteiraCard
      testID={`matcon-entrega-${delivery.id}`}
      tone={delivery.stage === "out" ? "amber" : undefined}
      dim={entregue}
      right={
        <>
          <View style={[st.badge, { borderColor: corSelo }]}>
            <Text style={[st.badgeText, { color: corSelo }]}>{selo}</Text>
          </View>
          <Text style={st.total}>{segundaViagem ? "já pago" : fmtMoney(delivery.total)}</Text>
        </>
      }
      actions={
        busy ? <ActivityIndicator size="small" color={Colors.violet3} /> : (
          <>
            {delivery.stage === "out" && (
              <Pressable onPress={onParcial} style={st.miniBtn} testID={`matcon-parcial-${delivery.id}`}>
                <Text style={st.miniBtnText}>Entrega parcial</Text>
              </Pressable>
            )}
            {temNota && notaAutorizada && (
              danfeBusy ? <ActivityIndicator size="small" color={Colors.violet3} /> : (
                <Pressable onPress={onVerDanfe} style={st.miniBtn} testID={`matcon-ver-danfe-${delivery.id}`}>
                  <Icon name="file_text" size={13} color={Colors.ink} />
                  <Text style={st.miniBtnText}>Ver nota</Text>
                </Pressable>
              )
            )}
            {podeEmitirNfe && (
              <Pressable onPress={onEmitirNfe} style={[st.miniBtn, st.miniBtnPrimary]} testID={`matcon-emitir-nfe-${delivery.id}`}>
                <Icon name="file_text" size={13} color="#fff" />
                <Text style={[st.miniBtnText, { color: "#fff" }]}>{notaFalhou ? "Tentar de novo" : "Emitir nota fiscal"}</Text>
              </Pressable>
            )}
            {!!proxima && (
              <Pressable onPress={onAvancar} style={[st.miniBtn, st.miniBtnPrimary]} testID={`matcon-avancar-${delivery.id}`}>
                <Text style={[st.miniBtnText, { color: "#fff" }]}>{proxima.label}</Text>
              </Pressable>
            )}
          </>
        )
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <Text style={st.cliente}>{delivery.customer_name || "Cliente do balcão"}</Text>
        {segundaViagem && (
          <View style={[st.badge, { borderColor: Colors.violet3 }]}>
            <Text style={[st.badgeText, { color: Colors.violet3 }]}>SALDO A ENTREGAR</Text>
          </View>
        )}
        {temNota && (
          <View style={[st.badge, { borderColor: corNota }]} testID={`matcon-selo-nfe-${delivery.id}`}>
            <Text style={[st.badgeText, { color: corNota }]}>
              {delivery.nfe_number != null ? `NOTA FISCAL #${delivery.nfe_number}` : "NOTA FISCAL"} · {statusNotaLabel}
            </Text>
          </View>
        )}
      </View>
      {notaFalhou && (
        <Text style={[st.meta, { color: Colors.red, marginTop: 2 }]}>
          A nota fiscal foi recusada — toque em &quot;Tentar de novo&quot; para emitir outra vez.
        </Text>
      )}
      <Text style={st.meta} numberOfLines={2}>{linhaSequencia}</Text>

      <View style={{ marginTop: 8, gap: 6 }}>
        {(delivery.items || []).map((item) => (
          <ItemProgresso key={item.sale_item_id} item={item} stage={delivery.stage} />
        ))}
      </View>

      <QuemEntregou key={delivery.id} valorInicial={delivery.delivered_by || ""} onSalvar={onSalvarQuemEntregou} />
    </EsteiraCard>
  );
}

function ItemProgresso({ item, stage }: { item: DeliveryItem; stage: DeliveryStage }) {
  const p = progressoDoItem(item, stage);
  const rotulo = rotuloProgresso(item, stage);
  const saldo = seloSaldo(item, stage);
  const pct = p.total > 0 ? Math.min(100, Math.max(0, (p.entregue / p.total) * 100)) : 0;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Text style={st.itemNome} numberOfLines={1}>{item.name}</Text>
        <Text style={st.itemQtd}>{rotulo}</Text>
        {!!saldo && (
          <View style={[st.badge, st.badgeSaldo]}>
            <Text style={[st.badgeText, { color: Colors.amber }]}>{saldo}</Text>
          </View>
        )}
      </View>
      <View style={st.barTrack}>
        <View style={[st.barFill, { width: `${pct}%`, backgroundColor: p.completo ? Colors.green : Colors.violet }]} />
      </View>
    </View>
  );
}

function QuemEntregou({ valorInicial, onSalvar }: { valorInicial: string; onSalvar: (texto: string) => void }) {
  const [texto, setTexto] = useState(valorInicial);
  return (
    <View style={st.quemBox}>
      <Text style={st.quemLabel}>Quem entregou</Text>
      <TextInput
        style={st.quemInput}
        value={texto}
        onChangeText={setTexto}
        onBlur={() => onSalvar(texto)}
        placeholder={QUEM_ENTREGOU_PLACEHOLDER}
        placeholderTextColor={Colors.ink3}
        testID="matcon-quem-entregou"
      />
    </View>
  );
}

// ── Entrega parcial ────────────────────────────────────────────
function EntregaParcialSheet({ delivery, busy, onClose, onConfirm }: {
  delivery: Delivery | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (delivery: Delivery, itens: Array<{ sale_item_id: string; quantity: number }>, deliveredBy: string) => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [deliveredBy, setDeliveredBy] = useState("");

  // Reabre com os valores default = o que estava planejado para esta
  // entrega (`quantity`), pronto para o vendedor confirmar ou corrigir.
  const chaveAtual = delivery?.id || "";
  const [chaveCarregada, setChaveCarregada] = useState("");
  if (delivery && chaveAtual !== chaveCarregada) {
    const iniciais: Record<string, string> = {};
    (delivery.items || []).forEach((it) => { iniciais[it.sale_item_id] = fmtQty(it.quantity); });
    setValores(iniciais);
    setDeliveredBy(delivery.delivered_by || "");
    setChaveCarregada(chaveAtual);
  }

  function confirmar() {
    if (!delivery) return;
    const itens: Array<{ sale_item_id: string; quantity: number }> = [];
    for (const item of delivery.items || []) {
      const raw = valores[item.sale_item_id] ?? "";
      if (raw.trim() === "") continue;
      const qty = parseQtyInput(raw);
      const max = Math.max(0, item.sold_quantity - item.delivered_before);
      if (qty === null) {
        toast.error(`"${item.name}": quantidade inválida`);
        return;
      }
      if (qty > max + 1e-9) {
        toast.error(`"${item.name}": o máximo é ${fmtQty(max)}`);
        return;
      }
      itens.push({ sale_item_id: item.sale_item_id, quantity: qty });
    }
    if (itens.length === 0) {
      toast.error("Informe quanto foi entregue de pelo menos um item");
      return;
    }
    onConfirm(delivery, itens, deliveredBy);
  }

  return (
    <ResponsiveSheet visible={!!delivery} onClose={onClose} maxWidth={480}>
      <>
        <View style={st.sheetHeader}>
          <View>
            <Text style={st.sheetTitle}>Entrega parcial</Text>
            <Text style={st.sheetSub}>Registre o que foi entregue agora — o resto vira a próxima entrega</Text>
          </View>
          <Pressable onPress={onClose} style={st.sheetClose} testID="matcon-parcial-fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        <ScrollView style={st.sheetBody} keyboardShouldPersistTaps="handled">
          {(delivery?.items || []).map((item) => {
            const max = Math.max(0, item.sold_quantity - item.delivered_before);
            return (
              <View key={item.sale_item_id} style={st.sheetItemRow}>
                <Text style={st.sheetItemNome} numberOfLines={2}>{item.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={st.sheetItemTexto}>foi</Text>
                  <TextInput
                    style={st.sheetItemInput}
                    value={valores[item.sale_item_id] ?? ""}
                    onChangeText={(v) => setValores((prev) => ({ ...prev, [item.sale_item_id]: v }))}
                    keyboardType="decimal-pad"
                    testID={`matcon-parcial-qtd-${item.sale_item_id}`}
                  />
                  <Text style={st.sheetItemTexto}>de {fmtQty(max)} {item.unit || ""}</Text>
                </View>
              </View>
            );
          })}

          <Text style={st.quemLabel}>Quem entregou</Text>
          <TextInput
            style={st.quemInput}
            value={deliveredBy}
            onChangeText={setDeliveredBy}
            placeholder={QUEM_ENTREGOU_PLACEHOLDER}
            placeholderTextColor={Colors.ink3}
          />

          <Pressable
            onPress={busy ? undefined : confirmar}
            style={[st.sheetConfirm, busy && { opacity: 0.6 }]}
            disabled={busy}
            testID="matcon-parcial-confirmar"
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Icon name="check" size={14} color="#fff" />
                <Text style={st.sheetConfirmText}>Confirmar entrega parcial</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </>
    </ResponsiveSheet>
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

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },

  loadingBox: { paddingVertical: 40, alignItems: "center" },

  diaRotulo: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: Colors.ink3, textTransform: "uppercase", marginBottom: 8, marginTop: 4 },

  cliente: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  meta: { fontSize: 12, color: Colors.ink3, marginTop: 3, lineHeight: 17 },

  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeSaldo: { borderColor: Colors.amber + "73", backgroundColor: Colors.bg4 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  total: { fontFamily: Fonts.mono, fontSize: 17, color: Colors.ink },

  itemNome: { fontSize: 12.5, color: Colors.ink, fontWeight: "600", flexShrink: 1, minWidth: 0 },
  itemQtd: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.ink2 },
  barTrack: { height: 5, borderRadius: 999, backgroundColor: Colors.bg4, marginTop: 4, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 999 },

  quemBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  quemLabel: { fontSize: 10, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.4 },
  quemInput: { flex: 1, fontSize: 12.5, color: Colors.ink, paddingVertical: 2 },

  miniBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  miniBtnPrimary: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  miniBtnText: { fontSize: 12, fontWeight: "700", color: Colors.ink },

  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  sheetSub: { fontSize: 12, color: Colors.ink3, marginTop: 2, maxWidth: 320 },
  sheetClose: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg2 },
  sheetBody: { paddingHorizontal: 18, paddingVertical: 14 },
  sheetItemRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border2, gap: 6 },
  sheetItemNome: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  sheetItemTexto: { fontSize: 12.5, color: Colors.ink2 },
  sheetItemInput: { width: 64, textAlign: "center", fontSize: 13, fontWeight: "700", color: Colors.ink, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingVertical: 6 },
  sheetConfirm: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 13, marginTop: 16, marginBottom: 6 },
  sheetConfirmText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
