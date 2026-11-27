// ============================================================
// Hub — conversa FECHADA do WhatsApp (artboard "Fechada").
//
// Um dia depois da última mensagem do cliente a conversa fecha. Para falar
// primeiro a loja usa um convite pronto (modelo UTILITY aprovado), e cada
// convite gasta 1 dos avisos do mês. Quem decide o limite é o servidor: a
// tela só mostra e nunca contorna.
//
//   Estado 1 · ainda há avisos: escolher o convite, ver a prévia (só os
//     trechos marcados mudam), "Usa 1 aviso · ficam N de M", Mandar convite.
//   Estado 2 · avisos esgotados: "Copiar meu link" (wa.me do número da loja)
//     e "Adicionar N avisos por R$ X", que só gera a cobrança — o pacote soma
//     depois do pagamento confirmado e a Aura nunca compra sozinha.
//
// Palavras da tela: convite, aviso, "conversa fechada" (nada de template,
// UTILITY ou janela de 24 h).
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Pressable, TextInput, Linking, ActivityIndicator } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { K, Tx, Meta, MONO, Ico, Pilula, BotaoPrincipal, superficie, web, SANS } from "./conversasUi";
import { hubApi, type HubConvite, type HubConvites } from "@/services/hubApi";
import { tourTarget } from "@/utils/tourTarget";
import { tratarSetas } from "./teclado";
import { copyToClipboard } from "@/utils/clipboard";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "dezembro" a partir de "2026-12-01"; "" se inválido. */
export function mesPorExtenso(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-/.exec(iso || "");
  return m ? MESES[Number(m[2]) - 1] || "" : "";
}

/** "novembro" de "2026-11". */
function mesDoSaldo(mes: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes || "");
  return m ? MESES[Number(m[2]) - 1] || "" : "";
}

export function reaisDeCentavos(centavos: number): string {
  const r = centavos / 100;
  return `R$ ${Number.isInteger(r) ? r : r.toFixed(2).replace(".", ",")}`;
}

export function ConversaFechada({ companyId, convId, nome, podeConfigurar, onSent, onError }: {
  companyId: string; convId: string;
  /** Primeiro nome do cliente (ou "o cliente"). */
  nome: string;
  /** Dono ou admin: pode pedir à Meta os modelos que faltam. */
  podeConfigurar: boolean;
  onSent: () => void;
  onError: (m: string) => void;
}) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [esgotadoAgora, setEsgotadoAgora] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const { data, isLoading, refetch } = useQuery<HubConvites>({
    queryKey: ["hub-convites", companyId, convId],
    queryFn: () => hubApi.convites(companyId, convId),
  });

  const prontos = useMemo(() => (data?.convites || []).filter((c) => c.pronto), [data]);
  // O primeiro convite pronto já vem escolhido.
  useEffect(() => {
    if (!escolhido && prontos.length) setEscolhido(prontos[0].key);
  }, [prontos, escolhido]);
  const convite: HubConvite | undefined = (data?.convites || []).find((c) => c.key === escolhido && c.pronto);

  const mEnviar = useMutation({
    mutationFn: () => hubApi.mandarConvite(companyId, convId, { key: convite!.key, campos: valores }),
    onSuccess: () => {
      setAviso(`Convite enviado. Quando ${nome} responder, a conversa abre de novo por um dia e o resto não gasta nada.`);
      setValores({});
      refetch();
      onSent();
    },
    onError: (e: any) => {
      if (e?.code === "SALDO_ESGOTADO" || e?.data?.code === "SALDO_ESGOTADO") { setEsgotadoAgora(true); refetch(); return; }
      onError(e?.message || "Não foi possível enviar o convite.");
    },
  });

  const mPreparar = useMutation({
    mutationFn: () => hubApi.prepararConvites(companyId),
    onSuccess: () => {
      setAviso("Pedi os convites ao WhatsApp. Quando ele aprovar, eles aparecem aqui.");
      refetch();
    },
    onError: (e: any) => onError(e?.message || "Não foi possível pedir os convites."),
  });

  const mPacote = useMutation({
    mutationFn: () => hubApi.pedirPacoteDeAvisos(companyId),
    onSuccess: (r) => {
      if (r?.payment_url) { void Linking.openURL(r.payment_url); setAviso("Abri o pagamento. Os avisos entram assim que ele for confirmado."); }
      else setAviso("Recebi o seu pedido. A equipe da Aura ativa o pacote e avisa pelo sino.");
    },
    onError: (e: any) => onError(e?.message || "Não foi possível gerar o pagamento."),
  });

  if (isLoading || !data) return <View style={{ alignItems: "center", paddingVertical: 16 }}><ActivityIndicator color={K.acc} /></View>;

  // Saldo com a trava desligada (ativo:false): não há contagem a mostrar nem limite a anunciar.
  const saldo = data.saldo && data.saldo.ativo === false ? null : data.saldo;
  const esgotado = esgotadoAgora || !!saldo?.esgotado;
  const Nome = `${nome[0].toUpperCase()}${nome.slice(1)}`;

  const avisoFim = aviso ? (
    <Tx testID="hub-fechada-aviso" style={{ fontSize: 14, color: K.ok, lineHeight: 20 }}>{aviso}</Tx>
  ) : null;

  // ── Estado 2 · avisos esgotados ──
  if (esgotado) {
    const mes = mesDoSaldo(saldo?.mes);
    const volta = mesPorExtenso(saldo?.renova_em);
    const pacote = saldo?.pacote;
    return (
      <View testID="hub-fechada-esgotado" {...tourTarget("wa.convite")} style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(252,211,77,.35)", backgroundColor: "rgba(252,211,77,.12)" }}>
            <Ico nome="cadeado" size={20} cor={K.warn} traco={1.9} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Tx style={{ fontSize: 17, fontWeight: "700", lineHeight: 24 }}>
              {saldo && saldo.total ? `Os ${saldo.total} avisos de ${mes || "este mês"} acabaram.` : "Os avisos acabaram."}
            </Tx>
            <Tx style={{ fontSize: 14, color: K.ink2, lineHeight: 20 }}>
              {volta ? `Convites voltam em 1º de ${volta}. ` : "Esses avisos não renovam sozinhos. "}
              Nada sai além do que a loja contratou, nem por engano.
            </Tx>
          </View>
        </View>
        <View accessibilityRole="image" accessibilityLabel={saldo ? `${saldo.total} de ${saldo.total} avisos usados` : "Avisos usados"}
          style={{ height: 8, borderRadius: 999, backgroundColor: K.trilho }} />
        <View style={[superficie.seca(22), { padding: 16, gap: 12 }]}>
          <Tx style={{ fontSize: 15, lineHeight: 22 }}>
            {`${Nome} pode te chamar quando quiser, `}<Tx style={{ fontSize: 15, fontWeight: "700", lineHeight: 22 }}>sem custo</Tx>
            . Mande o seu link do WhatsApp no Instagram ou deixe o QR no balcão:
          </Tx>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
            {data.meu_link && <Tx testID="hub-fechada-link" selectable style={{ fontFamily: MONO, fontSize: 14, color: K.acc, lineHeight: 20 }}>{data.meu_link.replace(/^https?:\/\//, "")}</Tx>}
            {data.meu_link && (
              <BotaoPrincipal testID="hub-fechada-copiar" icone="copiar"
                onPress={async () => { setLinkCopiado(await copyToClipboard(data.meu_link!)); }}>
                {linkCopiado ? "Link copiado" : "Copiar meu link"}
              </BotaoPrincipal>
            )}
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 14, rowGap: 6 }}>
          {pacote && (
            <Pressable testID="hub-fechada-pacote" disabled={mPacote.isPending} style={[{ minHeight: 44, justifyContent: "center", opacity: mPacote.isPending ? 0.6 : 1 }, web({ cursor: "pointer" })]}
              onPress={() => mPacote.mutate()}>
              <Tx style={{ fontSize: 14, fontWeight: "600", color: K.acc, lineHeight: 18 }}>{mPacote.isPending ? "Gerando…" : `Adicionar ${pacote.qty} avisos por ${reaisDeCentavos(pacote.preco_centavos)}`}</Tx>
            </Pressable>
          )}
          <Tx style={{ fontSize: 13, color: K.ink3, lineHeight: 18 }}>Só passam a valer depois do pagamento. A Aura nunca compra sozinha.</Tx>
        </View>
        {avisoFim}
        <View style={[superficie.seca(24), { paddingVertical: 16, paddingHorizontal: 20, gap: 10 }]}>
          <Meta>Com os avisos esgotados</Meta>
          <Tx style={{ fontSize: 14, color: K.ink2, lineHeight: 20 }}>Cobranças do crediário passam para o botão "Cobrar pelo meu WhatsApp", de graça, um toque por cliente.</Tx>
          <Tx style={{ fontSize: 14, color: K.ink2, lineHeight: 20 }}>Aniversário e Venda+ seguem: usam as novidades, que são outro saldo.</Tx>
          <Tx style={{ fontSize: 14, color: K.ink2, lineHeight: 20 }}>Conversas abertas continuam sem custo.</Tx>
        </View>
      </View>
    );
  }

  // ── Sem nenhum convite pronto ──
  if (!prontos.length) {
    const nenhumCriado = data.convites.every((c) => c.estado === "NAO_CRIADO");
    return (
      <View testID="hub-fechada-sem-convite" {...tourTarget("wa.convite")} style={{ gap: 12 }}>
        <Tx style={{ fontSize: 15, fontWeight: "600" }}>A conversa com {nome} está fechada.</Tx>
        <Tx style={{ fontSize: 14, color: K.ink2, lineHeight: 20 }}>
          {!data.conectado
            ? "Conecte o WhatsApp da loja para mandar convites."
            : nenhumCriado
              ? "Para falar primeiro, a loja usa convites prontos que o WhatsApp precisa aprovar antes."
              : "Os convites estão em aprovação no WhatsApp. Quando ele aprovar, eles aparecem aqui."}
        </Tx>
        {data.conectado && nenhumCriado && podeConfigurar && (
          <BotaoPrincipal testID="hub-fechada-preparar" disabled={mPreparar.isPending} onPress={() => mPreparar.mutate()} style={{ alignSelf: "flex-start" }}>
            {mPreparar.isPending ? "Pedindo…" : "Pedir os convites ao WhatsApp"}
          </BotaoPrincipal>
        )}
        {data.conectado && nenhumCriado && !podeConfigurar && (
          <Tx style={{ fontSize: 13, color: K.ink3, lineHeight: 18 }}>Peça ao dono ou a um admin da loja para liberar os convites.</Tx>
        )}
        {avisoFim}
        {data.meu_link && <Tx style={{ fontSize: 13, color: K.ink3, lineHeight: 18 }}>{`${Nome} também pode te chamar a qualquer momento, sem custo: ${data.meu_link.replace(/^https?:\/\//, "")}`}</Tx>}
      </View>
    );
  }

  // ── Estado 1 · ainda há avisos ──
  const campos = convite?.campos || [];
  const valorDe = (k: string, auto: boolean) => (auto ? data.auto[k as "nome" | "loja"] : valores[k]) || "";
  const faltando = campos.some((f) => !f.auto && !(valores[f.key] || "").trim());
  const ficam = saldo ? Math.max(saldo.restante - 1, 0) : null;
  const slot: any = { backgroundColor: "rgba(196,181,253,.22)", fontWeight: "700", ...web({ boxShadow: "inset 0 -1.5px 0 #c4b5fd", paddingLeft: 4, paddingRight: 4, borderRadius: 6 }) };

  return (
    <View testID="hub-fechada" {...tourTarget("wa.convite")} style={{ gap: 14 }}>
      <Tx style={{ fontSize: 15, fontWeight: "600" }}>Para falar com {nome}, escolha o convite:</Tx>
      <View accessibilityRole="radiogroup" accessibilityLabel="Convite" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
        {...({ dataSet: { waFoco: "1" }, onKeyDown: (e: any) => tratarSetas(e, { selector: '[role="radio"]:not([aria-disabled="true"])', seleciona: true, circular: true, horizontal: true }) } as any)}>
        {data.convites.map((c) => (
          <Pilula key={c.key} testID={`hub-convite-${c.key}`} role="radio" semTab={!(escolhido === c.key && c.pronto)} disabled={!c.pronto} on={escolhido === c.key && c.pronto}
            onPress={() => { setEscolhido(c.key); setAviso(null); }}
            style={!c.pronto ? { opacity: 0.45 } : undefined}>
            {`${c.titulo}${!c.pronto ? " · em aprovação" : ""}`}
          </Pilula>
        ))}
      </View>

      {convite && (
        <>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <View testID="hub-convite-previa" style={[{
              maxWidth: "100%", paddingTop: 10, paddingHorizontal: 14, paddingBottom: 8, borderRadius: 20, borderBottomRightRadius: 6,
              borderWidth: 1, borderColor: K.bolhaOutBorda, backgroundColor: K.bolhaOutFb,
            }, web({ backgroundImage: K.bolhaOut })]}>
              <Tx style={{ fontSize: 15, lineHeight: 22 }}>
                {convite.partes.map((p, i) => {
                  if (typeof p === "string") return <Tx key={i} style={{ fontSize: 15, lineHeight: 22 }}>{p}</Tx>;
                  const f = campos.find((x) => x.key === p.campo);
                  const v = valorDe(p.campo, !!f?.auto);
                  return f?.auto
                    ? <Tx key={i} style={{ fontSize: 15, lineHeight: 22 }}>{v}</Tx>
                    : <Tx key={i} style={[{ fontSize: 15, lineHeight: 22 }, slot]}>{v || `[${f?.rotulo || p.campo}]`}</Tx>;
                })}
              </Tx>
              <Tx style={{ fontSize: 12, color: K.ink3, textAlign: "right", marginTop: 3, lineHeight: 16 }}>prévia · você muda só os trechos marcados</Tx>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {campos.filter((f) => !f.auto).map((f) => (
              <View key={f.key} style={{ flexGrow: 1, minWidth: 180, gap: 4 }}>
                <Meta style={{ fontSize: 11 }}>{f.rotulo}</Meta>
                <TextInput testID={`hub-convite-campo-${f.key}`} value={valores[f.key] || ""} maxLength={f.max}
                  onChangeText={(t) => setValores((v) => ({ ...v, [f.key]: t }))}
                  placeholder={f.exemplo} placeholderTextColor={K.ink3}
                  style={[superficie.seca(999), { minHeight: 44, paddingHorizontal: 16, fontSize: 14, color: K.ink, fontFamily: SANS }] as any} />
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <View style={{ gap: 6, minWidth: 220 }}>
          <Tx testID="hub-fechada-custo" style={{ fontSize: 14, lineHeight: 20 }}>
            <Tx style={{ fontSize: 14, fontWeight: "700", lineHeight: 20 }}>Usa 1 aviso</Tx>
            {saldo && ficam != null ? ` · ficam ${ficam} de ${saldo.total}` : ""}
          </Tx>
          {saldo && saldo.total > 0 && (
            <View style={{ height: 8, borderRadius: 999, backgroundColor: K.trilho, overflow: "hidden" }}>
              <View style={[{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(saldo.restante / saldo.total) * 100}%`, borderRadius: 999, backgroundColor: "#a78bfa" },
                web({ backgroundImage: "linear-gradient(90deg,#a78bfa,#f3efff)" })]} />
              <View style={{ position: "absolute", left: `${(Math.max(saldo.restante - 1, 0) / saldo.total) * 100}%`, top: 0, bottom: 0, width: `${Math.max(100 / saldo.total, 1.6)}%`, backgroundColor: "#fff" }} />
            </View>
          )}
        </View>
        <BotaoPrincipal testID="hub-fechada-mandar" disabled={!convite || faltando || mEnviar.isPending} onPress={() => mEnviar.mutate()}>
          {mEnviar.isPending ? "Mandando…" : "Mandar convite"}
        </BotaoPrincipal>
      </View>
      <Tx style={{ fontSize: 13, color: K.ink3, lineHeight: 18 }}>Quando {nome} responder, a conversa abre de novo por um dia e o resto não gasta nada.</Tx>
      {avisoFim}
    </View>
  );
}