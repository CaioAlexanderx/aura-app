// ============================================================
// Hub — envio rápido na conversa ABERTA do WhatsApp.
// Produto (foto, nome e preço), orçamento, Pix e link da loja. Tudo é
// mensagem de sessão: não gasta aviso nem novidade. Quem decide a janela
// é o servidor; a tela só mostra os botões enquanto a conversa está aberta.
// O app manda ids; o texto é montado no servidor a partir do cadastro.
//
// Visual do mockup (Main.dc.html / Celular.dc.html):
//   - desktop: barra de pílulas com ícone (Produto, Orçamento, Pix, Link da
//     loja, Foto, Etiqueta) e o painel abrindo como folha de vidro sólido logo
//     acima da barra ("Toque para mandar", "Quanto a Ana vai pagar?" ...);
//   - celular: a barra vira "Mandar para a Ana · tudo grátis agora"; tocar
//     abre a folha de baixo com os atalhos em círculos de 58 px.
// Painel aberto no próprio lugar (sem modal de tela cheia); a folha do celular
// usa WebPortal porque o z-index:0 do RNW prende position:fixed dentro do shell.
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from "react";
import { View, Pressable, TextInput, Image, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fmt } from "@/constants/helpers";
import { hubApi, type HubEnvioTipo } from "@/services/hubApi";
import { WebPortal } from "@/components/WebPortal";
import { tourTarget } from "@/utils/tourTarget";
import { useWaGuias } from "@/stores/waGuias";
import { K, Tx, Meta, fundoGaveta, Ico, Pilula, superficie, web, anima, EM_TESTE, ICONES, SANS } from "./conversasUi";
import { useOrcamentoNovo } from "./useOrcamentoNovo";
import { ProdutoGradePainel } from "./ProdutoGradePainel";
import { aoTeclarNoPainel, focarPrimeiro } from "./teclado";

/**
 * "189,90" e "1.189,90" (pt-BR) e também "10.50" (ponto como decimal, vindo de
 * teclado ou colagem). Com vírgula, o ponto é milhar; sem vírgula, um único
 * ponto seguido de 1 ou 2 dígitos é decimal ("10.50" = 10,50, nunca 1.050).
 * NaN se não for número.
 */
export function parseValorBR(bruto: string): number {
  const t = String(bruto || "").trim().replace(/^R\$\s*/i, "").replace(/\s+/g, "");
  if (!t || /[^0-9.,]/.test(t)) return NaN;
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  const pontos = (t.match(/\./g) || []).length;
  if (pontos === 1 && /\.\d{1,2}$/.test(t)) return Number(t);
  return Number(t.replace(/\./g, ""));
}

type Painel = null | "produto" | "orcamento" | "pix";

const ATALHOS: { key: HubEnvioTipo; label: string; icone: keyof typeof ICONES }[] = [
  { key: "produto", label: "Produto", icone: "produto" },
  { key: "orcamento", label: "Orçamento", icone: "orcamento" },
  { key: "pix", label: "Pix", icone: "pix" },
  { key: "link_loja", label: "Link da loja", icone: "link" },
];

/** Variante de cada botão: pílula na barra do desktop, círculo com rótulo na folha do celular. */
export type VarianteAtalho = "pilula" | "acao" | "redondo";

/** Atalho em círculo de 58 px com o rótulo embaixo (.act do Celular.dc.html). */
export function AtalhoAcao({ icone, label, onPress, testID, on, destaque, disabled, alvo }: {
  icone: keyof typeof ICONES; label: string; onPress: () => void; testID?: string; on?: boolean; destaque?: boolean; disabled?: boolean; alvo?: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} {...(alvo ? tourTarget(alvo) : {})}
      style={{ width: "25%", alignItems: "center", gap: 8, paddingVertical: 6, opacity: disabled ? 0.55 : 1 }}>
      <View style={[{
        width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", borderWidth: 1,
        borderColor: destaque || on ? "rgba(236,228,255,.7)" : "rgba(255,255,255,.16)",
        backgroundColor: destaque || on ? "#7c3aed" : K.ibBg,
      }, web({ backgroundImage: destaque || on ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : K.dry, boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)" })]}>
        <Ico nome={icone} size={22} cor={destaque || on ? "#fff" : K.ink} traco={destaque ? 1.9 : 1.8} />
      </View>
      <Tx style={{ fontSize: 13, fontWeight: "600", lineHeight: 17, textAlign: "center" }}>{label}</Tx>
    </Pressable>
  );
}

/** Folha de vidro sólido do mockup: flutua acima da barra no desktop; no celular fica no fluxo. */
export function Folha({ label, testID, flutua, children, gap = 6, padding = 14, onFechar, gatilho, largura = 420, raio = 24 }: {
  label: string; testID?: string; flutua: boolean; children: ReactNode; gap?: number; padding?: number;
  /** Esc fecha o painel. */
  onFechar?: () => void;
  /** testID do botão que abriu: o foco volta para ele ao fechar. */
  gatilho?: string;
  largura?: number; raio?: number;
}) {
  const an = anima("abre", 0.38);
  const ref = useRef<any>(null);
  // Aberto o painel, o foco entra nele (campo de busca ou primeira opção). As opções de alguns painéis
  // (Pix com orçamento, produtos) chegam depois do servidor: tenta a cada render até achar a primeira.
  // Nos primeiros 3 s, se o foco saiu do painel (o campo some quando as opções chegam), volta para a primeira opção.
  const abriuEm = useRef(Date.now());
  useEffect(() => {
    try {
      const raiz = ref.current;
      if (!raiz?.querySelector || typeof document === "undefined") return;
      if (Date.now() - abriuEm.current > 3000) return;
      const ativo: any = document.activeElement;
      if (raiz.contains?.(ativo) && (ativo?.getAttribute?.("data-opcao") || ativo?.tagName === "INPUT")) return; // já está numa opção ou digitando
      const alvo = raiz.querySelector('[data-opcao="1"]') || raiz.querySelector("input");
      if (alvo && document.activeElement !== alvo) alvo.focus?.();
    } catch { /* sem DOM */ }
  });
  return (
    <View ref={ref} testID={testID} accessibilityLabel={label} {...({ role: "dialog", onKeyDown: (e: any) => aoTeclarNoPainel(e, onFechar, gatilho) } as any)} {...({ dataSet: { ...an.dataSet, waFoco: "1" } } as any)}
      style={[superficie.solida(raio), { padding, gap },
        flutua ? { position: "absolute", left: 18, bottom: "100%" as any, marginBottom: 10, width: "100%", maxWidth: largura, zIndex: 3, transformOrigin: "bottom left" } : null, an.style]}>
      {children}
    </View>
  );
}

export function EnvioRapido({ companyId, convId, onSent, onError, midia, compacto = false, nome, onEtiqueta, etiquetaOn, painelEtiqueta, children }: {
  companyId: string; convId: string;
  onSent: () => void;
  onError: (mensagem: string) => void;
  /** Foto, áudio e o painel de gravação/prévia (useMidiaConversa). */
  midia: { foto: (v: VarianteAtalho) => ReactNode; audio: (v: VarianteAtalho) => ReactNode; painel: ReactNode; folha: (flutua: boolean) => ReactNode };
  /** Celular: barra "Mandar para a Ana" + folha de baixo com os atalhos. */
  compacto?: boolean;
  nome?: string;
  onEtiqueta: () => void;
  etiquetaOn: boolean;
  /** Folha das etiquetas (aberta pelo botão Etiqueta). */
  painelEtiqueta?: ReactNode;
  /** A linha de escrever (campo, microfone, Enviar), logo abaixo dos atalhos. No celular recebe a função que abre a gaveta (o "+"). */
  children?: ReactNode | ((abrirGaveta: () => void) => ReactNode);
}) {
  const [painel, setPainel] = useState<Painel>(null);
  // Celular: como no artboard, a gaveta "Mandar na conversa" já nasce aberta; toque no fundo ou na alça fecha.
  const [folhaAberta, setFolhaAberta] = useState(compacto);
  const [outroValor, setOutroValor] = useState(false);
  const orcamentoNovo = useOrcamentoNovo();
  const [busca, setBusca] = useState("");
  /** Produto escolhido na busca: abre o painel de fotos e tamanhos. */
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const primeiro = nome || "o cliente";

  const mSend = useMutation({
    mutationFn: (body: Parameters<typeof hubApi.send>[2]) => hubApi.send(companyId, convId, body),
    onSuccess: async (_r, body) => {
      setPainel(null); setBusca(""); setValor(""); setOutroValor(false); setEscolhido(null);
      // Mandar o Pix aplica a etiqueta "Esperando Pix" (cria na loja se ainda não existir). A "Pago" automática fica para depois.
      if (body.type === "pix") {
        try {
          const { labels } = await hubApi.etiquetas(companyId);
          let alvo = (labels || []).find((l) => l.name.trim().toLowerCase() === "esperando pix");
          if (!alvo) alvo = (await hubApi.criarEtiqueta(companyId, { name: "Esperando Pix", color: "#f59e0b" })).label;
          await hubApi.aplicarEtiqueta(companyId, convId, alvo.id);
        } catch { /* o Pix já saiu; a etiqueta é só o lembrete */ }
      }
      // O guia 3 do WhatsApp espera por isto: o produto saiu de verdade na conversa.
      if (body.type === "produto") useWaGuias.getState().sinalizarProdutoEnviado();
      onSent();
    },
    onError: (e: any) => onError(e?.message || "Não foi possível enviar."),
  });

  const { data: catalogo, isFetching: buscando } = useQuery({
    queryKey: ["hub-catalogo", companyId, busca.trim()],
    queryFn: () => hubApi.catalogo(companyId, busca.trim()),
    enabled: painel === "produto",
    staleTime: 30000,
  });
  const { data: orcs, isLoading: carregandoOrc } = useQuery({
    queryKey: ["hub-orcamentos", companyId, convId],
    queryFn: () => hubApi.orcamentos(companyId, convId),
    enabled: painel === "orcamento" || painel === "pix",
  });

  const escolher = (key: HubEnvioTipo) => {
    if (mSend.isPending) return;
    setFolhaAberta(false);
    setEscolhido(null);
    if (key === "link_loja") { mSend.mutate({ type: "link_loja" }); return; }
    setPainel((p) => (p === key ? null : (key as Painel)));
  };

  const valorNum = parseValorBR(valor);
  const valorOk = valor.trim() !== "" && Number.isFinite(valorNum) && valorNum > 0;

  const campoBusca = {
    flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: K.dryBorda,
    backgroundColor: K.dryFb, fontFamily: SANS, fontSize: 14, color: K.ink,
  } as const;

  const linhaProduto = { flexDirection: "row", alignItems: "center", gap: 12, padding: 8, borderRadius: 18, borderWidth: 1, borderColor: "transparent" } as const;

  const paineis = (
    <>
      {painel === "produto" && escolhido && (
        <Folha label="Mandar produto" testID="hub-envio-painel-produto" flutua={!compacto} gap={16} padding={22} largura={560} raio={30}
          onFechar={() => setPainel(null)} gatilho={compacto ? "hub-envio-barra" : "hub-envio-produto"}>
          <ProdutoGradePainel companyId={companyId} convId={convId} productId={escolhido}
            onTrocar={() => setEscolhido(null)}
            onSent={() => { setPainel(null); setEscolhido(null); setBusca(""); onSent(); }}
            onError={onError}
            onSemGrade={() => mSend.mutate({ type: "produto", product_id: escolhido })} compacto={compacto} />
        </Folha>
      )}

      {painel === "produto" && !escolhido && (
        <Folha label="Mandar produto" testID="hub-envio-painel-produto" flutua={!compacto} onFechar={() => setPainel(null)} gatilho={compacto ? "hub-envio-barra" : "hub-envio-produto"}>
          <Meta style={{ paddingHorizontal: 6, paddingTop: 4, paddingBottom: 6 }}>Toque para mandar</Meta>
          <TextInput testID="hub-envio-busca" style={campoBusca} value={busca} onChangeText={setBusca}
            placeholder="Buscar produto pelo nome" placeholderTextColor={K.ink3} />
          {buscando && !catalogo && <ActivityIndicator color={K.acc} />}
          <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
            {(catalogo?.products || []).map((p) => (
              <Pressable key={p.id} testID={`hub-produto-${p.id}`} accessibilityRole="button" {...({ dataSet: { opcao: "1" } } as any)} style={[linhaProduto, web({ cursor: "pointer" })]}
                onPress={() => setEscolhido(p.id)}>
                {p.image_url
                  ? <Image source={{ uri: p.image_url }} style={{ width: 54, height: 54, borderRadius: 14, backgroundColor: K.trilho }} />
                  : <View style={{ width: 54, height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: K.trilho }}><Tx style={{ fontSize: 9, color: K.ink3, lineHeight: 12 }}>sem foto</Tx></View>}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx numberOfLines={1} style={{ fontWeight: "700" }}>{p.name}</Tx>
                  <Tx style={{ fontSize: 13, color: K.ink2, lineHeight: 18 }}>{fmt(p.price)}</Tx>
                </View>
              </Pressable>
            ))}
            {catalogo && catalogo.products.length === 0 && (
              <Tx style={{ fontSize: 13, color: K.ink2, padding: 8 }}>Nenhum produto encontrado.</Tx>
            )}
          </ScrollView>
        </Folha>
      )}

      {painel === "orcamento" && (
        <Folha label="Mandar orçamento" testID="hub-envio-painel-orcamento" flutua={!compacto} gap={8} onFechar={() => setPainel(null)} gatilho={compacto ? "hub-envio-barra" : "hub-envio-orcamento"}>
          <Meta style={{ paddingHorizontal: 6, paddingVertical: 4 }}>{`Orçamentos d${primeiro === "o cliente" ? "o cliente" : `a ${primeiro}`}`}</Meta>
          <View style={{ gap: 6 }}>
            {carregandoOrc && <ActivityIndicator color={K.acc} />}
            {(orcs?.quotes || []).map((q) => (
              <Pressable key={q.id} testID={`hub-orcamento-${q.id}`} accessibilityRole="button" {...({ dataSet: { opcao: "1" } } as any)} style={[linhaProduto, { padding: 10 }, web({ cursor: "pointer" })]}
                onPress={() => mSend.mutate({ type: "orcamento", quote_id: q.id })}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx style={{ fontWeight: "700" }}>{fmt(Number(q.total))}</Tx>
                  <Tx style={{ fontSize: 13, color: K.ink2, lineHeight: 18 }}>
                    {q.expires_at ? `vale até ${new Date(q.expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : "sem validade"}
                  </Tx>
                </View>
              </Pressable>
            ))}
            {orcs && orcs.quotes.length === 0 && (
              <Tx style={{ fontSize: 13, color: K.ink2, paddingHorizontal: 6 }}>
                Nenhum orçamento enviado para este cliente. Envie o orçamento por Personalizados e ele aparece aqui.
              </Tx>
            )}
            {orcamentoNovo && (
              <Pressable testID="hub-orcamento-novo" accessibilityRole="button" {...({ dataSet: { opcao: "1" } } as any)} onPress={() => router.push(orcamentoNovo as any)} style={{ minHeight: 44, justifyContent: "center", paddingLeft: 10 }}>
                <Tx style={{ fontSize: 14, fontWeight: "600", color: K.acc, lineHeight: 18 }}>Fazer um orçamento novo</Tx>
              </Pressable>
            )}
          </View>
        </Folha>
      )}

      {painel === "pix" && (() => {
        // Opções do artboard: orçamento inteiro e sinal de 50% (quando há orçamento), "Outro valor".
        // Pedido não entra: a tela ainda não lê pedidos do cliente.
        const q0 = (orcs?.quotes || [])[0];
        const totalQ = q0 ? Number(q0.total) : NaN;
        const opcoes = Number.isFinite(totalQ) && totalQ > 0
          ? [{ valor: totalQ, rotulo: "orçamento inteiro" }, { valor: Math.round(totalQ * 50) / 100, rotulo: "sinal de 50%" }]
          : [];
        const mostrarCampo = outroValor || opcoes.length === 0;
        return (
          <Folha label="Mandar Pix" testID="hub-envio-painel-pix" flutua={!compacto} gap={10} padding={16} onFechar={() => setPainel(null)} gatilho={compacto ? "hub-envio-barra" : "hub-envio-pix"}>
            <Meta>{`Quanto ${primeiro === "o cliente" ? "o cliente" : `a ${primeiro}`} vai pagar?`}</Meta>
            {opcoes.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {opcoes.map((o) => (
                  <Pilula key={o.rotulo} testID={`hub-pix-opcao-${o.rotulo.includes("50") ? "sinal" : "inteiro"}`} disabled={mSend.isPending} dados={{ opcao: "1" }}
                    style={{ flexDirection: "column", alignItems: "flex-start", gap: 0, minHeight: 58, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20 }}
                    onPress={() => mSend.mutate({ type: "pix", amount: o.valor })}>
                    <Tx style={{ fontSize: 16, fontWeight: "700", lineHeight: 22 }}>{fmt(o.valor)}</Tx>
                    <Tx style={{ fontSize: 12, fontWeight: "500", color: K.ink2, lineHeight: 16 }}>{o.rotulo}</Tx>
                  </Pilula>
                ))}
                <Pilula testID="hub-pix-outro" dados={{ opcao: "1" }} on={outroValor} style={{ minHeight: 58, borderRadius: 20 }} onPress={() => setOutroValor((v) => !v)}>Outro valor</Pilula>
              </View>
            )}
            {mostrarCampo && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <TextInput testID="hub-pix-valor" style={[campoBusca, { minHeight: 52, borderRadius: 20, minWidth: 180 }]} value={valor} onChangeText={setValor}
                  keyboardType="decimal-pad" placeholder="Valor em reais (opcional)" placeholderTextColor={K.ink3} />
                <Pilula testID="hub-pix-mandar" dados={{ opcao: "1" }} on style={{ minHeight: 52, borderRadius: 20, paddingHorizontal: 18 }}
                  disabled={mSend.isPending || (valor.trim() !== "" && !valorOk)}
                  onPress={() => mSend.mutate(valorOk ? { type: "pix", amount: valorNum } : { type: "pix" })}>
                  {valorOk ? `Mandar Pix de ${fmt(valorNum)}` : "Mandar chave Pix"}
                </Pilula>
              </View>
            )}
            <Tx style={{ fontSize: 13, color: K.ink3, lineHeight: 18 }}>Vai o código "copia e cola" da chave cadastrada no canal digital da loja. Ao mandar, a conversa ganha a etiqueta "Esperando Pix".</Tx>
          </Folha>
        );
      })()}

      {midia.folha(!compacto)}      {painelEtiqueta}
    </>
  );

  // ── Celular: barra + folha de baixo ──
  if (compacto) {
    const grade = (
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 10 }}>
        {midia.audio("acao")}
        {ATALHOS.map((a) => (
          <AtalhoAcao key={a.key} testID={`hub-envio-${a.key}`} icone={a.icone} label={a.label} on={painel === a.key} disabled={mSend.isPending} onPress={() => escolher(a.key)} />
        ))}
        {midia.foto("acao")}
        <AtalhoAcao testID="hub-envio-etiqueta" icone="etiqueta" label="Etiqueta" on={etiquetaOn} onPress={() => { setFolhaAberta(false); onEtiqueta(); }} />
      </View>
    );
    const cabecalhoFolha = (
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Tx style={{ fontSize: 18, fontWeight: "800", letterSpacing: -0.36 }}>
          {`Mandar para ${primeiro}`}<Tx style={{ color: K.acc2, fontSize: 18, fontWeight: "800" }}>.</Tx>
        </Tx>
        <Tx style={{ fontSize: 12, color: K.ok, lineHeight: 16 }}>tudo grátis agora</Tx>
      </View>
    );
    return (
      <View testID="hub-envio-rapido" style={{ gap: 8 }}>
        {paineis}
        {midia.painel}
        {typeof children === "function" ? children(() => setFolhaAberta(true)) : children}
        {/* Fechada, a grade fica montada e escondida (os atalhos seguem no lugar); aberta, vira a folha de baixo. */}
        {!folhaAberta && <View style={{ display: "none" }}>{cabecalhoFolha}{grade}</View>}
        {EM_TESTE ? (folhaAberta ? (<>
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
            <Pressable testID="hub-envio-fundo" accessibilityLabel="Fechar" onPress={() => setFolhaAberta(false)}
              style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: K.scrim }]} />
            <View role="dialog" accessibilityLabel="Mandar na conversa"
              style={[{
                position: "absolute", left: 0, right: 0, bottom: 0,
                paddingTop: 10, paddingHorizontal: 18, paddingBottom: 22, gap: 16, borderTopLeftRadius: 30, borderTopRightRadius: 30,
                ...fundoGaveta(), borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.18)",
              }, web({ boxShadow: "0 -24px 60px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.3)" })]}>
              <Pressable onPress={() => setFolhaAberta(false)} accessibilityLabel="Fechar" style={{ alignSelf: "center", paddingVertical: 4 }}>
                <View style={{ width: 40, height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,.25)" }} />
              </Pressable>
              {cabecalhoFolha}
              {grade}
            </View>
          </View>
</>) : null) : (<WebPortal active={folhaAberta}>
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
            <Pressable testID="hub-envio-fundo" accessibilityLabel="Fechar" onPress={() => setFolhaAberta(false)}
              style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: K.scrim }]} />
            <View role="dialog" accessibilityLabel="Mandar na conversa"
              style={[{
                position: "absolute", left: 0, right: 0, bottom: 0,
                paddingTop: 10, paddingHorizontal: 18, paddingBottom: 22, gap: 16, borderTopLeftRadius: 30, borderTopRightRadius: 30,
                ...fundoGaveta(), borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.18)",
              }, web({ boxShadow: "0 -24px 60px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.3)" })]}>
              <Pressable onPress={() => setFolhaAberta(false)} accessibilityLabel="Fechar" style={{ alignSelf: "center", paddingVertical: 4 }}>
                <View style={{ width: 40, height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,.25)" }} />
              </Pressable>
              {cabecalhoFolha}
              {grade}
            </View>
          </View>
</WebPortal>)}
      </View>
    );
  }

  // ── Desktop: barra de pílulas + folha flutuante ──
  return (
    <View testID="hub-envio-rapido" style={{ gap: 12, position: "relative" }}>
      {paineis}
      <View accessibilityRole="toolbar" accessibilityLabel="Mandar na conversa" {...tourTarget("wa.acoes")} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {ATALHOS.map((a) => (
          <Pilula key={a.key} testID={`hub-envio-${a.key}`} on={painel === a.key} disabled={mSend.isPending} onPress={() => escolher(a.key)}>
            <Ico nome={a.icone} cor={painel === a.key ? K.pillOnInk : K.ink} />
            <Tx style={{ fontSize: 14, fontWeight: "600", lineHeight: 18, color: painel === a.key ? K.pillOnInk : K.ink }}>{a.label}</Tx>
          </Pilula>
        ))}
        {midia.foto("pilula")}
        <Pilula testID="hub-envio-etiqueta" on={etiquetaOn} onPress={onEtiqueta}>
          <Ico nome="etiqueta" cor={etiquetaOn ? K.pillOnInk : K.ink} />
          <Tx style={{ fontSize: 14, fontWeight: "600", lineHeight: 18, color: etiquetaOn ? K.pillOnInk : K.ink }}>Etiqueta</Tx>
        </Pilula>
      </View>
      {midia.painel}
      {typeof children === "function" ? children(() => {}) : children}
    </View>
  );
}
