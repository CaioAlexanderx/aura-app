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
import { useState, type ReactNode } from "react";
import { View, Pressable, TextInput, Image, ScrollView, ActivityIndicator } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fmt } from "@/constants/helpers";
import { hubApi, type HubEnvioTipo } from "@/services/hubApi";
import { WebPortal } from "@/components/WebPortal";
import { tourTarget } from "@/utils/tourTarget";
import { K, Tx, Meta, Ico, Pilula, superficie, web, ICONES } from "./waVisual";

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
function Folha({ label, testID, flutua, children, gap = 6, padding = 14 }: { label: string; testID?: string; flutua: boolean; children: ReactNode; gap?: number; padding?: number }) {
  return (
    <View testID={testID} accessibilityLabel={label}
      style={[superficie.solida(24), { padding, gap },
        flutua ? { position: "absolute", left: 18, bottom: "100%" as any, marginBottom: 10, width: "100%", maxWidth: 420, zIndex: 3 } : null]}>
      {children}
    </View>
  );
}

export function EnvioRapido({ companyId, convId, onSent, onError, midia, compacto = false, nome, onEtiqueta, etiquetaOn, painelEtiqueta, children }: {
  companyId: string; convId: string;
  onSent: () => void;
  onError: (mensagem: string) => void;
  /** Foto, áudio e o painel de gravação/prévia (useMidiaConversa). */
  midia: { foto: (v: VarianteAtalho) => ReactNode; audio: (v: VarianteAtalho) => ReactNode; painel: ReactNode };
  /** Celular: barra "Mandar para a Ana" + folha de baixo com os atalhos. */
  compacto?: boolean;
  nome?: string;
  onEtiqueta: () => void;
  etiquetaOn: boolean;
  /** Folha das etiquetas (aberta pelo botão Etiqueta). */
  painelEtiqueta?: ReactNode;
  /** A linha de escrever (campo, microfone, Enviar), logo abaixo dos atalhos. */
  children?: ReactNode;
}) {
  const [painel, setPainel] = useState<Painel>(null);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const [valor, setValor] = useState("");
  const primeiro = nome || "o cliente";

  const mSend = useMutation({
    mutationFn: (body: Parameters<typeof hubApi.send>[2]) => hubApi.send(companyId, convId, body),
    onSuccess: () => { setPainel(null); setBusca(""); setValor(""); onSent(); },
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
    enabled: painel === "orcamento",
  });

  const escolher = (key: HubEnvioTipo) => {
    if (mSend.isPending) return;
    setFolhaAberta(false);
    if (key === "link_loja") { mSend.mutate({ type: "link_loja" }); return; }
    setPainel((p) => (p === key ? null : (key as Painel)));
  };

  const valorNum = parseValorBR(valor);
  const valorOk = valor.trim() !== "" && Number.isFinite(valorNum) && valorNum > 0;

  const campoBusca = {
    flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: K.dryBorda,
    backgroundColor: K.dryFb, fontFamily: "inherit", fontSize: 14, color: K.ink,
  } as const;

  const linhaProduto = { flexDirection: "row", alignItems: "center", gap: 12, padding: 8, borderRadius: 18, borderWidth: 1, borderColor: "transparent" } as const;

  const paineis = (
    <>
      {painel === "produto" && (
        <Folha label="Mandar produto" testID="hub-envio-painel-produto" flutua={!compacto}>
          <Meta style={{ paddingHorizontal: 6, paddingTop: 4, paddingBottom: 6 }}>Toque para mandar</Meta>
          <TextInput testID="hub-envio-busca" style={campoBusca} value={busca} onChangeText={setBusca}
            placeholder="Buscar produto pelo nome" placeholderTextColor={K.ink3} />
          {buscando && !catalogo && <ActivityIndicator color={K.acc} />}
          <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
            {(catalogo?.products || []).map((p) => (
              <Pressable key={p.id} testID={`hub-produto-${p.id}`} style={[linhaProduto, web({ cursor: "pointer" })]}
                onPress={() => mSend.mutate({ type: "produto", product_id: p.id })}>
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
        <Folha label="Mandar orçamento" testID="hub-envio-painel-orcamento" flutua={!compacto} gap={8}>
          <Meta style={{ paddingHorizontal: 6, paddingVertical: 4 }}>{`Orçamentos d${primeiro === "o cliente" ? "o cliente" : `a ${primeiro}`}`}</Meta>
          <View style={{ gap: 6 }}>
            {carregandoOrc && <ActivityIndicator color={K.acc} />}
            {(orcs?.quotes || []).map((q) => (
              <Pressable key={q.id} testID={`hub-orcamento-${q.id}`} style={[linhaProduto, { padding: 10 }, web({ cursor: "pointer" })]}
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
          </View>
        </Folha>
      )}

      {painel === "pix" && (
        <Folha label="Mandar Pix" testID="hub-envio-painel-pix" flutua={!compacto} gap={10} padding={16}>
          <Meta>{`Quanto ${primeiro === "o cliente" ? "o cliente" : `a ${primeiro}`} vai pagar?`}</Meta>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <TextInput testID="hub-pix-valor" style={[campoBusca, { minHeight: 58, borderRadius: 20, minWidth: 180 }]} value={valor} onChangeText={setValor}
              keyboardType="decimal-pad" placeholder="Valor em reais (opcional)" placeholderTextColor={K.ink3} />
            <Pilula testID="hub-pix-mandar" on style={{ minHeight: 58, borderRadius: 20, paddingHorizontal: 18 }}
              disabled={mSend.isPending || (valor.trim() !== "" && !valorOk)}
              onPress={() => mSend.mutate(valorOk ? { type: "pix", amount: valorNum } : { type: "pix" })}>
              {valorOk ? `Mandar Pix de ${fmt(valorNum)}` : "Mandar chave Pix"}
            </Pilula>
          </View>
          <Tx style={{ fontSize: 13, color: K.ink3, lineHeight: 18 }}>Vai o código "copia e cola" da chave cadastrada no canal digital da loja.</Tx>
        </Folha>
      )}

      {painelEtiqueta}
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
        <Pressable testID="hub-envio-barra" {...tourTarget("wa.acoes")} onPress={() => setFolhaAberta(true)} accessibilityRole="button" accessibilityLabel={`Mandar para ${primeiro}`}
          style={[superficie.seca(999), { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingHorizontal: 16 }, web({ cursor: "pointer" })]}>
          <Ico nome="mais" size={18} cor={K.acc} traco={2} />
          <Tx style={{ flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 18 }}>{`Mandar para ${primeiro}`}</Tx>
          <Tx style={{ fontSize: 12, color: K.ok, lineHeight: 16 }}>tudo grátis agora</Tx>
        </Pressable>
        {children}
        {/* Fechada, a grade fica montada e escondida (os atalhos seguem no lugar); aberta, vira a folha de baixo. */}
        {!folhaAberta && <View style={{ display: "none" }}>{cabecalhoFolha}{grade}</View>}
        <WebPortal active={folhaAberta}>
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
            <Pressable testID="hub-envio-fundo" accessibilityLabel="Fechar" onPress={() => setFolhaAberta(false)}
              style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: K.scrim }]} />
            <View role="dialog" accessibilityLabel="Mandar na conversa"
              style={[{
                position: "absolute", left: 0, right: 0, bottom: 0,
                paddingTop: 10, paddingHorizontal: 18, paddingBottom: 22, gap: 16, borderTopLeftRadius: 30, borderTopRightRadius: 30,
                backgroundColor: K.sheetMobile, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.18)",
              }, web({ boxShadow: "0 -24px 60px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.3)" })]}>
              <Pressable onPress={() => setFolhaAberta(false)} accessibilityLabel="Fechar" style={{ alignSelf: "center", paddingVertical: 4 }}>
                <View style={{ width: 40, height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,.25)" }} />
              </Pressable>
              {cabecalhoFolha}
              {grade}
            </View>
          </View>
        </WebPortal>
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
      {children}
    </View>
  );
}
