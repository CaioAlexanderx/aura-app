// ============================================================
// Hub Social — thread de uma conversa.
// Bolhas (cliente à esquerda, loja à direita) com o autor de cada fala
// (rotuloDoAutor: cliente, equipe ou Aurinha — o eco do celular é equipe),
// cards de sugestão pendente (Aprovar/Editar/Rejeitar — modo aprovação
// do piloto), correção de triagem, transições de estado e composer com
// indicador da janela de 24h da Meta.
// Toque, não hover: toda ação é botão visível (regra do app p/ touch).
// ============================================================
import { useRef, useState } from "react";
import { View, ScrollView, Pressable, TextInput, Image, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { formatarTelefone } from "@/utils/telefone";
import { hubApi, type HubCategory } from "@/services/hubApi";
import { CHANNEL_META, STATUS_META, CATEGORY_META, CATEGORIES, windowHoursLeft, conversaAbertaAte, shortTime, nomeDoContato, rotuloDoAutor, quemAtende } from "./types";
import { EnvioRapido } from "./EnvioRapido";
import { useMidiaConversa } from "./MidiaConversa";
import { BolhaDeMidia, textoDaBolha } from "./BolhaDeMidia";
import { EtiquetasConversa } from "./EtiquetasConversa";
import { FaixaEhEla, useClienteDaConversa, mesAno, reais } from "./ClienteConversa";
import { PainelCliente } from "./PainelCliente";
import { CartaoOrcamento, CartaoPix, CartaoLinkLoja, CARTAO_TIPOS } from "./CartoesDaThread";
import { tourTarget } from "@/utils/tourTarget";
import { K, Tx, Meta, Ico, Avatar, Pilula, Ponto, BotaoPrincipal, BotaoRedondo, Barra, Fio, superficie, web, WEB, SANS } from "./conversasUi";
import { ConversaFechada } from "./ConversaFechada";

export function ThreadView({ companyId, convId, onBack, aurinhaLigada = true, podeConfigurar = false }: {
  companyId: string; convId: string; onBack?: () => void;
  /** Dono ou admin: pode pedir à Meta os modelos de convite que faltam. */
  podeConfigurar?: boolean;
  /** Aurinha desligada: a equipe atende sozinha — sem "IA atendendo" nem "Devolver à Aurinha". */
  aurinhaLigada?: boolean;
}) {
  const qc = useQueryClient();
  const meuId = (useAuthStore() as any)?.user?.id as string | undefined;
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  // Celular (artboard "Celular"): lista e thread, cabeçalho enxuto e barra de envio compacta.
  const compacto = !IS_WIDE;
  const [detalhes, setDetalhes] = useState(false);
  const [folhaEtiqueta, setFolhaEtiqueta] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["hub-thread", companyId, convId],
    queryFn: () => hubApi.messages(companyId, convId),
    refetchInterval: 10000,
  });
  const conv = data?.conversation;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hub-thread", companyId, convId] });
    qc.invalidateQueries({ queryKey: ["hub-conversations", companyId] });
  };

  const mAction = useMutation({
    mutationFn: async (action: () => Promise<any>) => action(),
    onSuccess: invalidate,
    onError: (e: any) => setFeedback(e?.message || "Não foi possível concluir a ação."),
  });

  const mReply = useMutation({
    mutationFn: async (text: string) => {
      // Responder assume a conversa: a Aurinha para de sugerir enquanto
      // você estiver no comando (backend descarta sugestões antigas no envio).
      if (conv && (conv.status === "ia" || conv.status === "precisa_humano")) {
        await hubApi.assume(companyId, convId);
      }
      return hubApi.reply(companyId, convId, text);
    },
    onSuccess: () => { setDraft(""); setFeedback(null); invalidate(); },
    onError: (e: any) => {
      const code = e?.data?.code;
      setFeedback(code === "JANELA_FECHADA"
        ? "Janela de 24h fechada — a Meta só aceita resposta até 24h após a última mensagem do cliente."
        : (e?.message || "Não foi possível enviar."));
    },
  });

  // Celular: "72 avisos" no cabeçalho. Sem o saldo no servidor, o número não aparece.
  const { data: saldo } = useQuery({
    queryKey: ["hub-saldo-avisos", companyId],
    queryFn: () => hubApi.saldoAvisos(companyId),
    enabled: compacto,
    staleTime: 60000,
    retry: false,
  });

  // URL da mídia estável por mensagem: o servidor reassina de tempos em tempos e a
  // thread relê a cada 10 s; trocar o src no meio faria o áudio parar e a foto piscar.
  // Mantém a primeira URL vista por até 25 min (a assinatura vale pelo menos 30).
  const urlsDeMidia = useRef(new Map<string, { url: string; em: number }>());
  const urlEstavel = (id: string, url: string) => {
    const guardada = urlsDeMidia.current.get(id);
    if (guardada && Date.now() - guardada.em < 25 * 60 * 1000) return guardada.url;
    urlsDeMidia.current.set(id, { url, em: Date.now() });
    return url;
  };

  // Cadastro ligado e crediário: alimentam o subtítulo do cabeçalho (WhatsApp).
  const { cliente: ligado, livre } = useClienteDaConversa(companyId, convId, conv?.channel === "whatsapp");

  // Foto e áudio (hook antes do return antecipado: a ordem dos hooks não muda).
  const midia = useMidiaConversa({ companyId, convId, onSent: invalidate, onError: (m) => setFeedback(m) });

  if (isLoading || !data || !conv) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 300 }}><ActivityIndicator color={K.acc} /></View>;
  }

  const ch = CHANNEL_META[conv.channel];
  const comando = quemAtende(conv, meuId, aurinhaLigada);
  const hoursLeft = windowHoursLeft(conv.last_inbound_at);
  const whatsapp = conv.channel === "whatsapp";
  // WhatsApp com a conversa aberta: tudo que sai é grátis (mensagem de sessão).
  const abertaAte = whatsapp ? conversaAbertaAte(conv.last_inbound_at) : null;
  // WhatsApp com a conversa FECHADA: fala primeiro só com convite pronto (gasta 1 aviso).
  const fechada = whatsapp && !abertaAte;
  const nomeCurto = (conv.customer_name || "").trim().split(/\s+/)[0] || "o cliente";
  // Trava do saldo desligada (ativo:false): não há limite a mostrar.
  const avisos = saldo?.ativo === false ? undefined : saldo?.saldos?.avisos;
  const nomeTela = nomeDoContato(conv);

  // Subtítulo do mockup: "Cliente desde mar/2025 · Crediário com R$ 320 livres".
  let sub: string = ch.label;
  if (whatsapp) {
    if (ligado) {
      sub = [ligado.since ? `Cliente desde ${mesAno(ligado.since)}` : "Cliente cadastrado", livre != null ? `Crediário com ${reais(livre)} livres` : ""].filter(Boolean).join(" · ");
    } else {
      sub = conv.customer_name ? (formatarTelefone(conv.external_id) || ch.label) : ch.label;
    }
  }
  if (conv.handoff_reason) sub += ` · ${conv.handoff_reason}`;

  const statusPill = comando ? (
    <View testID="hub-thread-status" style={[superficie.seca(999), { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 36, paddingHorizontal: 14 }]}>
      <Ponto cor={comando.cor} />
      <Tx style={{ fontSize: 13, fontWeight: "600", lineHeight: 18, color: comando.cor }}>{comando.rotulo}</Tx>
    </View>
  ) : null;

  // Assumir / Devolver / Resolver: pílulas secundárias. No desktop ficam no cabeçalho, à direita do
  // relógio "Conversa aberta"; no celular, numa linha curta abaixo do cabeçalho.
  const botoesEstado = (
    <>
      {(conv.status === "ia" || conv.status === "precisa_humano") && (
        <Pilula pequena onPress={() => mAction.mutate(() => hubApi.assume(companyId, convId))}>Assumir conversa</Pilula>
      )}
      {conv.status === "humano" && aurinhaLigada && (
        <Pilula testID="hub-devolver-aurinha" pequena onPress={() => mAction.mutate(() => hubApi.returnToAi(companyId, convId))}>Devolver à Aurinha</Pilula>
      )}
      {conv.status !== "resolvida" && (
        <Pilula pequena onPress={() => mAction.mutate(() => hubApi.resolve(companyId, convId))}>Resolver</Pilula>
      )}
    </>
  );
  const larguraBolha: any = compacto ? "82%" : (WEB ? "min(440px, 78%)" : "78%");

  // ── Cabeçalho ──
  const cabecalho = compacto ? (
    <View style={[superficie.vidro(24), { marginTop: 12, marginHorizontal: 12, paddingVertical: 8, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 10, zIndex: 2 }]}>
      {onBack && (
        <Pressable onPress={onBack} accessibilityLabel="Voltar para a lista" accessibilityRole="button"
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ico nome="voltar" size={22} cor={K.ink} traco={2} />
        </Pressable>
      )}
      <Avatar nome={nomeTela} chave={conv.external_id} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", lineHeight: 22 }}>{nomeTela}</Tx>
        {abertaAte
          ? <Tx testID="hub-janela-aberta" {...tourTarget("wa.janela")} numberOfLines={1} style={{ fontSize: 12, color: K.ok, lineHeight: 16 }}>{`Aberta até ${abertaAte}`}</Tx>
          : <Tx numberOfLines={1} style={{ fontSize: 12, color: K.ink2, lineHeight: 16 }}>{sub}</Tx>}
      </View>
      {whatsapp && avisos && (
        <View testID="hub-thread-avisos-bloco" style={{ alignItems: "flex-end", gap: 4, paddingRight: 6 }}>
          <Barra pct={avisos.total ? avisos.restante / avisos.total : 0} altura={5} largura={58} />
          <Tx testID="hub-thread-avisos" style={{ fontSize: 12, color: K.ink2, lineHeight: 16 }}>{`${avisos.restante} avisos`}</Tx>
        </View>
      )}
    </View>
  ) : (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 18, paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: K.linha }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0, flexShrink: 1 }}>
        <Avatar nome={nomeTela} chave={conv.external_id} size={46} />
        <View style={{ minWidth: 0, flexShrink: 1 }}>
          <Tx numberOfLines={1} style={{ fontSize: 17, fontWeight: "700", lineHeight: 24 }}>{nomeTela}</Tx>
          <Tx numberOfLines={1} style={{ fontSize: 13, color: K.ink2, lineHeight: 18 }}>{sub}</Tx>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, minWidth: 0, maxWidth: "100%" }}>
        {abertaAte && (
          <View testID="hub-janela-aberta" {...tourTarget("wa.janela")} style={[superficie.seca(999), { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36, paddingHorizontal: 14 }]}>
            <Ico nome="relogio" size={16} cor={K.ok} traco={2} />
            <Tx style={{ fontSize: 13, lineHeight: 18 }}>
              <Tx style={{ fontSize: 13, fontWeight: "700", color: K.ok, lineHeight: 18 }}>Conversa aberta</Tx>
              {` até ${abertaAte} · responder não gasta mensagens`}
            </Tx>
          </View>
        )}
        {botoesEstado}
        {statusPill}
      </View>
    </View>
  );

  const acoes = compacto ? (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center", paddingVertical: 10, paddingHorizontal: 14 }}>
      {statusPill}
      {botoesEstado}
    </View>
  ) : null;
  // ── Mensagens ──
  const mensagens = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: compacto ? 9 : 10, paddingVertical: compacto ? 16 : 20, paddingHorizontal: compacto ? 14 : 22, minHeight: compacto ? 0 : 360 }}>
      {whatsapp && <FaixaEhEla companyId={companyId} convId={convId} onChanged={invalidate} onError={(m) => setFeedback(m)} />}
      <View style={{ gap: compacto ? 9 : 10, opacity: fechada ? 0.55 : 1 }}>
        {data.messages.map((m) => {
          const mine = m.direction === "outbound";
          const author = rotuloDoAutor(m, conv);
          const produto = m.tipo === "produto" && !!m.image_url;
          const cartao = !!m.tipo && CARTAO_TIPOS.includes(m.tipo);
          const audio = m.media?.kind === "audio";
          return (
            <View key={m.id} style={{ flexDirection: "row", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <View testID={`hub-msg-${m.id}`}
                style={[{
                  maxWidth: larguraBolha, paddingTop: produto ? 8 : 10, paddingHorizontal: produto ? 8 : 14, paddingBottom: 8, borderRadius: 20, borderWidth: 1,
                  borderBottomLeftRadius: mine ? 20 : 6, borderBottomRightRadius: mine ? 6 : 20,
                  borderColor: mine ? K.bolhaOutBorda : K.bolhaInBorda, backgroundColor: mine ? K.bolhaOutFb : K.bolhaInFb,
                }, produto ? { width: 280 } : null, cartao ? { width: 300, paddingTop: m.tipo === "link_loja" ? 8 : 14, paddingHorizontal: m.tipo === "link_loja" ? 8 : 16 } : null, audio ? { width: 300 } : null, web({ backgroundImage: mine ? K.bolhaOut : K.bolhaIn })]}>
                {produto && (
                  <Image testID={`hub-msg-foto-${m.id}`} source={{ uri: m.image_url! }} style={{ width: "100%", height: 150, borderRadius: 14, backgroundColor: K.trilho, marginBottom: 6 }} resizeMode="cover" />
                )}
                {m.media?.url ? <BolhaDeMidia testID={`hub-msg-midia-${m.id}`} media={{ ...m.media, url: urlEstavel(m.id, m.media.url) }} /> : null}
                {m.tipo === "orcamento" && <CartaoOrcamento content={m.content} cartao={m.cartao} />}
                {m.tipo === "pix" && <CartaoPix content={m.content} cartao={m.cartao} />}
                {m.tipo === "link_loja" && <CartaoLinkLoja content={m.content} cartao={m.cartao} />}
                {!cartao && textoDaBolha(m) != null && (
                  <Tx style={{ fontSize: 15, lineHeight: 22, paddingHorizontal: produto ? 6 : 0 }}>{textoDaBolha(m)}</Tx>
                )}
                {/* Rodapé da bolha: "Lorena · 10:14 · lida". */}
                <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 4, paddingHorizontal: produto ? 6 : 0 }}>
                  {author && <Tx testID={`hub-msg-autor-${m.id}`} style={{ fontSize: 12, color: K.ink3, lineHeight: 16 }}>{author}</Tx>}
                  <Tx style={{ fontSize: 12, color: K.ink3, lineHeight: 16 }}>
                    {`${author ? " · " : ""}${shortTime(m.created_at)}${mine && m.status ? ` · ${m.status}` : ""}`}
                  </Tx>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Sugestões aguardando aprovação */}
      {data.pending_approvals.map((p) => (
        <View key={p.id} style={[superficie.seca(20), { alignSelf: "flex-end", maxWidth: "84%", padding: 12, gap: 8, borderStyle: "dashed", borderWidth: 1.5, borderColor: "rgba(196,181,253,.55)" }]}>
          <Tx style={{ fontSize: 12, fontWeight: "700", color: K.acc, lineHeight: 16 }}>✦ Resposta sugerida pela Aurinha — aguardando aprovação</Tx>
          {editingId === p.id ? (
            <TextInput style={{ borderWidth: 1, borderColor: K.dryBorda, borderRadius: 14, padding: 10, fontSize: 15, color: K.ink, minHeight: 70, textAlignVertical: "top", fontFamily: SANS }}
              value={editText} onChangeText={setEditText} multiline placeholderTextColor={K.ink3} />
          ) : (
            <Tx style={{ fontSize: 15, lineHeight: 22 }}>{p.edited_body || p.text_body}</Tx>
          )}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {editingId === p.id ? (
              <>
                <Pilula pequena on onPress={() => { mAction.mutate(() => hubApi.approve(companyId, p.id, editText.trim())); setEditingId(null); }}>Enviar editada</Pilula>
                <Pilula pequena onPress={() => setEditingId(null)}>Cancelar</Pilula>
              </>
            ) : (
              <>
                <Pilula pequena on onPress={() => mAction.mutate(() => hubApi.approve(companyId, p.id))}>Aprovar e enviar</Pilula>
                <Pilula pequena onPress={() => { setEditingId(p.id); setEditText(p.text_body); }}>Editar</Pilula>
                <Pilula pequena onPress={() => mAction.mutate(() => hubApi.reject(companyId, p.id))} textoStyle={{ color: K.red }}>Rejeitar</Pilula>
              </>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // ── Escrever ──
  const placeholder = conv.status === "ia"
    ? "Digitar aqui assume a conversa…"
    : whatsapp && (conv.customer_name || ligado) ? `Escreva para ${nomeCurto === "o cliente" ? "o cliente" : `a ${nomeCurto}`}…` : "Escreva uma mensagem…";
  const podeEnviar = !!draft.trim() && !mReply.isPending;
  // Celular: "+" redondo à esquerda do campo reabre a gaveta (como o de anexar do WhatsApp).
  const linhaEscrever = (abrirGaveta?: () => void) => (
    <View style={{ flexDirection: "row", gap: compacto ? 8 : 10, alignItems: "center" }}>
      {compacto && abrirGaveta && (
        <BotaoRedondo testID="hub-envio-barra" dataSet={tourTarget("wa.acoes").dataSet} size={44} acessLabel={`Mandar para ${nomeCurto}`} onPress={abrirGaveta}>
          <Ico nome="mais" size={20} cor={K.acc} traco={2} />
        </BotaoRedondo>
      )}
      <View style={[superficie.seca(999), { flex: 1, minWidth: 0, minHeight: compacto ? 46 : 52, paddingHorizontal: 18, justifyContent: "center" }]}>
        <TextInput accessibilityLabel="Mensagem" value={draft} onChangeText={setDraft} placeholder={placeholder} placeholderTextColor={K.ink3}
          onSubmitEditing={() => draft.trim() && mReply.mutate(draft.trim())}
          style={[{ fontSize: 15, color: K.ink, fontFamily: SANS, minWidth: 0 }, web({ outlineStyle: "none" })]} />
      </View>
      {!compacto && abertaAte && midia.audio("redondo")}
      <BotaoPrincipal disabled={!podeEnviar} onPress={() => mReply.mutate(draft.trim())}>{mReply.isPending ? "..." : "Enviar"}</BotaoPrincipal>
    </View>
  );

  const folhaEtiquetas = !compacto && folhaEtiqueta ? (
    <EtiquetasConversa variante="folha" companyId={companyId} convId={convId} aplicadas={conv.labels || []} onFechar={() => setFolhaEtiqueta(false)}
      onChanged={invalidate} onError={(m) => setFeedback(m)} />
  ) : null;

  const rodape = (
    <View style={{ position: "relative", gap: 12, paddingTop: compacto ? 6 : 14, paddingHorizontal: compacto ? 14 : 18, paddingBottom: compacto ? 14 : 18, borderTopWidth: compacto ? 0 : 1, borderTopColor: K.linha, zIndex: 2 }}>
      {feedback && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Tx style={{ fontSize: 13, color: K.warn, flex: 1, lineHeight: 18 }}>{feedback}</Tx>
        </View>
      )}
      {abertaAte && (
        <EnvioRapido companyId={companyId} convId={convId} onSent={invalidate} compacto={compacto} nome={nomeCurto}
          onError={(msg) => setFeedback(msg)} midia={midia}
          etiquetaOn={compacto ? detalhes : folhaEtiqueta}
          onEtiqueta={() => (compacto ? setDetalhes((v) => !v) : setFolhaEtiqueta((v) => !v))}
          painelEtiqueta={folhaEtiquetas}>
          {linhaEscrever}
        </EnvioRapido>
      )}
      {fechada && (
        <ConversaFechada companyId={companyId} convId={convId} nome={nomeCurto} podeConfigurar={podeConfigurar}
          onSent={invalidate} onError={(msg) => setFeedback(msg)} />
      )}
      {!fechada && !abertaAte && linhaEscrever()}
      {!abertaAte && !fechada && (
        <Tx style={{ fontSize: 12, color: K.ink3, lineHeight: 16 }}>
          {hoursLeft != null
            ? `Janela de resposta: ${Math.floor(hoursLeft)} h restantes`
            : "Janela de 24h fechada — aguarde o cliente escrever de novo"}
        </Tx>
      )}
    </View>
  );

  const detalhesBloco = whatsapp && compacto ? (
    <View style={{ paddingHorizontal: 14 }}>
      <Pressable testID="hub-detalhes-toggle" onPress={() => setDetalhes((v) => !v)} style={{ minHeight: 40, justifyContent: "center" }}>
        <Tx style={{ fontSize: 13, fontWeight: "700", color: K.acc, lineHeight: 18 }}>
          {detalhes ? "Esconder cliente e etiquetas" : `Cliente e etiquetas${(conv.labels || []).length ? ` · ${(conv.labels || []).length}` : ""}`}
        </Tx>
      </Pressable>
      {detalhes && <PainelCliente companyId={companyId} convId={convId} embutido />}
    </View>
  ) : null;

  return (
    <View testID="hub-thread-regiao" accessibilityLabel="Conversa" {...({ role: "region", tabIndex: -1, dataSet: { waFoco: "1" } } as any)}
      style={compacto ? { flex: 1 } : [superficie.vidro(30), { flex: 1, minHeight: 560, position: "relative" }]}>
      {!compacto && <Fio />}
      {cabecalho}
      {acoes}
      {detalhesBloco}
      {mensagens}
      {rodape}
    </View>
  );
}
