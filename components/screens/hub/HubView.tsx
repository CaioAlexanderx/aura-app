// ============================================================
// Hub Social — container: lista de conversas + thread.
// Desktop (IS_WIDE): duas colunas. Mobile: lista ↔ thread (voltar).
// Polling de 15s na lista (MVP; websocket fica pra v2).
//
// Estados especiais, nesta ordem:
//   - visão consolidada multi-CNPJ (company null) → escolher loja
//   - schema_pending → migration não aplicada no ambiente (estado vazio)
//   - Aurinha desligada → o inbox abre igual (a equipe lê e responde);
//     "Ativar a Aurinha" fica como ação secundária, só para dono/admin
//     (o PUT /hub/settings recusa membro), e abre o card de ativação.
// ============================================================
import { useEffect, useState } from "react";
import { View, ScrollView, Pressable, Switch, ActivityIndicator, TextInput } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { EmptyState } from "@/components/EmptyState";
import { hubApi, type HubConversation, type HubStatus } from "@/services/hubApi";
import { CHANNEL_META, CATEGORY_META, shortTime, nomeDoContato, conversaAbertaAte, quemAtende } from "./types";
import { ThreadView } from "./ThreadView";
import { tourTarget } from "@/utils/tourTarget";
import { PainelCliente } from "./PainelCliente";
import { K, Tx, Ico, Avatar, Pilula, Ponto, superficie, web, SANS } from "./conversasUi";

type StatusFilter = "todas" | HubStatus;

function ConversationRow({ conv, selected, onPress, aurinhaLigada }: {
  conv: HubConversation; selected: boolean; onPress: () => void; aurinhaLigada: boolean;
}) {
  const ch = CHANNEL_META[conv.channel];
  const meuId = (useAuthStore() as any)?.user?.id as string | undefined;
  const comando = quemAtende(conv, meuId, aurinhaLigada, true);
  const cat = conv.category ? CATEGORY_META[conv.category] : null;
  const name = nomeDoContato(conv);
  const fechada = conv.channel === "whatsapp" && !conversaAbertaAte(conv.last_inbound_at);
  const tag = { flexDirection: "row", alignItems: "center", gap: 6, height: 24, paddingHorizontal: 10, borderRadius: 999, backgroundColor: K.tag } as const;
  const tagTx = { fontSize: 12, fontWeight: "600", lineHeight: 16, color: K.ink2 } as const;
  return (
    <Pressable testID={`hub-conv-${conv.id}`} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
      style={[{ flexDirection: "row", gap: 12, alignItems: "center", padding: 12, borderRadius: 18, borderWidth: 1, borderColor: selected ? K.convSelBorda : "transparent", backgroundColor: selected ? K.convSel : "transparent" },
        web({ cursor: "pointer" })]}>
      <View>
        <Avatar nome={name} chave={conv.external_id} size={42} />
        <View style={{ position: "absolute", right: -3, bottom: -3, width: 18, height: 18, borderRadius: 6, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: K.bg, backgroundColor: ch.color }}>
          <Tx style={{ fontSize: 8, fontWeight: "800", color: "#fff", lineHeight: 10 }}>{ch.short}</Tx>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Tx numberOfLines={1} style={{ fontWeight: "700", flexShrink: 1, lineHeight: 22 }}>{name}</Tx>
          <Tx style={{ fontSize: 12, color: K.ink3, lineHeight: 22 }}>{shortTime(conv.last_message_at)}</Tx>
        </View>
        <Tx numberOfLines={1} style={{ fontSize: 13, color: K.ink2, lineHeight: 18 }}>{conv.last_message_preview || "—"}</Tx>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          {comando && <View style={tag}><Ponto cor={comando.cor} /><Tx style={tagTx}>{comando.rotulo}</Tx></View>}
          {cat && <View style={tag}><Ponto cor={cat.color} /><Tx style={tagTx}>{cat.label}</Tx></View>}
          {(conv.labels || []).map((l) => (
            <View key={l.id} style={tag}><Ponto cor={l.color} /><Tx style={tagTx}>{l.name}</Tx></View>
          ))}
          {conv.pending_approvals > 0 && (
            <View style={[tag, { backgroundColor: K.tagOn }]}><Tx style={[tagTx, { color: K.pillOnInk }]}>{`${conv.pending_approvals} p/ aprovar`}</Tx></View>
          )}
          {fechada && <View style={tag}><Tx style={[tagTx, { color: K.ink3 }]}>Conversa fechada</Tx></View>}
        </View>
      </View>
    </Pressable>
  );
}
export function HubView({ onConversaAberta }: { /** Avisa a tela quando há conversa aberta (no celular o cabeçalho da tela some). */ onConversaAberta?: (aberta: boolean) => void } = {}) {
  const { company } = useAuthStore();
  const papel: string = (company as any)?.member_role || "owner";
  const podeConfigurar = papel === "owner" || papel === "admin";
  const companyId = company?.id as string | undefined;
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conviteAberto, setConviteAberto] = useState(false);
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  useEffect(() => { onConversaAberta?.(!!selectedId); }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: settings } = useQuery({
    queryKey: ["hub-settings", companyId],
    queryFn: () => hubApi.settings(companyId!),
    enabled: !!companyId,
    staleTime: 30000,
  });

  const enabled = !!settings?.enabled;

  const { data, isLoading } = useQuery({
    queryKey: ["hub-conversations", companyId, statusFilter, etiquetaFiltro],
    queryFn: () => hubApi.conversations(companyId!,
      statusFilter === "todas" && !etiquetaFiltro
        ? undefined
        : { ...(statusFilter === "todas" ? {} : { status: statusFilter }), ...(etiquetaFiltro ? { label: etiquetaFiltro } : {}) }),
    // Aurinha desligada não esconde o inbox: a equipe atende sozinha.
    enabled: !!companyId && !settings?.schema_pending,
    refetchInterval: 15000,
  });

  const { data: etiquetas } = useQuery({
    queryKey: ["hub-etiquetas", companyId],
    queryFn: () => hubApi.etiquetas(companyId!),
    enabled: !!companyId && !settings?.schema_pending,
    staleTime: 30000,
  });

  const mSettings = useMutation({
    mutationFn: (patch: { enabled?: boolean; approval_mode?: boolean }) => hubApi.saveSettings(companyId!, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hub-settings", companyId] }),
  });

  // Visão consolidada multi-CNPJ: atendimento é por loja.
  if (!companyId) {
    return (
      <EmptyState icon="users" iconColor={Colors.violet3}
        title="Escolha uma loja"
        subtitle="O atendimento do hub social é por loja. Saia da visão consolidada e selecione a empresa para ver as conversas." />
    );
  }

  if (settings?.schema_pending) {
    return (
      <EmptyState icon="alert" iconColor={Colors.amber}
        title="Hub quase pronto"
        subtitle="O servidor ainda está sendo atualizado para o hub social. Tente novamente em alguns minutos." />
    );
  }

  // Convite para ligar a Aurinha (secundário, nunca no lugar do inbox).
  const convite = settings && !enabled && podeConfigurar && conviteAberto ? (
      <View testID="hub-convite-aurinha" style={[superficie.seca(24), { gap: 12, padding: 18 }]}>
        <Tx style={{ fontSize: 18, fontWeight: "800", lineHeight: 24 }}>Conheça a Aurinha 💜</Tx>
        <Tx style={{ fontSize: 14, color: K.ink2, lineHeight: 21 }}>
          A Aurinha responde as mensagens do Instagram da sua loja com seus produtos, preços e estoque reais —
          24 horas por dia. Reclamações, trocas e pedidos de desconto ela passa para você, com o contexto pronto.
        </Tx>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Tx style={{ fontSize: 14, fontWeight: "600", flex: 1 }}>Modo aprovação (recomendado no começo)</Tx>
          <Switch value={settings.approval_mode}
            onValueChange={(v) => mSettings.mutate({ approval_mode: v })}
            trackColor={{ true: "#7c3aed", false: K.trilho }} />
        </View>
        <Tx style={{ fontSize: 13, color: K.ink3, lineHeight: 18 }}>
          Com o modo aprovação ligado, a Aurinha só sugere — cada resposta espera o seu toque antes de ir para o cliente.
        </Tx>
        <Pilula on disabled={mSettings.isPending} onPress={() => mSettings.mutate({ enabled: true })} style={{ alignSelf: "flex-start" }}>
          {mSettings.isPending ? "Ativando…" : "Ativar a Aurinha"}
        </Pilula>
      </View>
  ) : null;

  const todas = data?.conversations || [];
  // Busca na lista já carregada: nome, telefone ou prévia da última mensagem.
  const termo = busca.trim().toLowerCase();
  const conversations = termo
    ? todas.filter((c) => `${nomeDoContato(c)} ${c.external_id} ${c.last_message_preview || ""}`.toLowerCase().includes(termo))
    : todas;
  const needsHuman = (data?.counts || [])
    .filter((c) => c.status === "precisa_humano")
    .reduce((acc, c) => acc + c.n, 0);

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "precisa_humano", label: needsHuman > 0 ? `Precisa de você · ${needsHuman}` : "Precisa de você" },
    ...(enabled ? [{ key: "ia" as StatusFilter, label: "IA atendendo" }] : []),
    { key: "humano", label: "Com você" },
    { key: "resolvida", label: "Resolvidas" },
  ];

  const list = (
    <View {...tourTarget("wa.lista")} style={IS_WIDE ? { flexGrow: 1, flexShrink: 1, flexBasis: 300, maxWidth: 340, minWidth: 0, gap: 12 } : { flex: 1, gap: 12 }}>
      <View style={[superficie.seca(999), { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 16 }]}>
        <Ico nome="busca" size={18} cor={K.ink3} />
        <TextInput testID="hub-busca" accessibilityLabel="Buscar conversa" value={busca} onChangeText={setBusca}
          placeholder="Buscar nome, telefone ou produto" placeholderTextColor={K.ink3} autoCapitalize="none"
          style={[{ flex: 1, minWidth: 0, fontSize: 14, color: K.ink, fontFamily: SANS }, web({ outlineStyle: "none" })]} />
      </View>
      {settings && !enabled && podeConfigurar && (
        <Pressable testID="hub-ativar-aurinha" onPress={() => setConviteAberto((v) => !v)} accessibilityRole="button"
          style={{ alignSelf: "flex-end", minHeight: 28, justifyContent: "center", marginBottom: -6 }}>
          <Tx style={{ fontSize: 13, fontWeight: "600", color: K.acc, lineHeight: 18 }}>Ativar a Aurinha</Tx>
        </Pressable>
      )}
      {/* Estados numa linha só; se faltar largura, a linha rola de lado. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
        {FILTERS.map((f) => (
          <Pilula key={f.key} pequena on={statusFilter === f.key} onPress={() => setStatusFilter(f.key)}
            style={f.key === "precisa_humano" && needsHuman > 0 && statusFilter !== f.key ? { borderColor: "rgba(252,211,77,.55)" } : undefined}>
            {f.label}
          </Pilula>
        ))}
      </ScrollView>
      {(etiquetas?.labels || []).length > 0 && (
        <ScrollView testID="hub-filtro-etiquetas" horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
          {(etiquetas?.labels || []).map((l) => {
            const on = etiquetaFiltro === l.id;
            return (
              <Pilula key={l.id} testID={`hub-filtro-etiqueta-${l.id}`} pequena on={on} onPress={() => setEtiquetaFiltro(on ? null : l.id)}>
                <Ponto cor={l.color} />
                <Tx style={{ fontSize: 13, fontWeight: "600", lineHeight: 18, color: on ? K.pillOnInk : K.ink }}>{l.name}</Tx>
              </Pilula>
            );
          })}
        </ScrollView>
      )}
      {convite}
      {isLoading && <View style={{ alignItems: "center", paddingVertical: 30 }}><ActivityIndicator color={K.acc} /></View>}
      {!isLoading && todas.length === 0 && (
        <EmptyState icon="star" iconColor={Colors.violet3}
          title="Nenhuma conversa ainda"
          subtitle={enabled ? "Quando alguém mandar mensagem no Instagram da loja, a conversa aparece aqui — e a Aurinha já começa a atender." : ""} />
      )}
      {!isLoading && todas.length > 0 && conversations.length === 0 && (
        <Tx style={{ fontSize: 14, color: K.ink2, paddingHorizontal: 6 }}>Nenhuma conversa encontrada para essa busca.</Tx>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 4 }}>
        {conversations.map((c) => (
          <ConversationRow key={c.id} conv={c} selected={c.id === selectedId} onPress={() => setSelectedId(c.id)} aurinhaLigada={enabled} />
        ))}
      </ScrollView>
    </View>
  );

  const selecionada = todas.find((c) => c.id === selectedId);

  if (IS_WIDE) {
    return (
      <View testID="hub-conversas" style={{ flexDirection: "row", flexWrap: "wrap", gap: 20, alignItems: "stretch", minHeight: 640, flex: 1 }}>
        {list}
        <View style={{ flexGrow: 999, flexShrink: 1, flexBasis: 560, minWidth: 0, minHeight: 560 }}>
          {selectedId
            ? <ThreadView key={selectedId} companyId={companyId} convId={selectedId} aurinhaLigada={enabled} podeConfigurar={podeConfigurar} />
            : (
              <View style={[superficie.vidro(30), { flex: 1, minHeight: 560, justifyContent: "center" }]}>
                <EmptyState icon="users" iconColor={Colors.violet3} title="Selecione uma conversa" subtitle="Escolha uma conversa na lista para ver a thread." />
              </View>
            )}
        </View>
        {selectedId && (!selecionada || selecionada.channel === "whatsapp") && (
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 260, maxWidth: 300, minWidth: 0, alignSelf: "flex-start" }}>
            <PainelCliente key={selectedId} companyId={companyId} convId={selectedId} />
          </View>
        )}
      </View>
    );
  }

  // Mobile: lista OU thread
  return selectedId
    ? <ThreadView key={selectedId} companyId={companyId} convId={selectedId} onBack={() => setSelectedId(null)} aurinhaLigada={enabled} podeConfigurar={podeConfigurar} />
    : list;
}