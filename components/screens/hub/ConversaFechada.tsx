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
import { View, Text, StyleSheet, Pressable, TextInput, Linking, ActivityIndicator } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { hubApi, type HubConvite, type HubConvites } from "@/services/hubApi";
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

  if (isLoading || !data) return <View style={s.centro}><ActivityIndicator color={Colors.violet3} /></View>;

  const saldo = data.saldo;
  const esgotado = esgotadoAgora || !!saldo?.esgotado;

  // ── Estado 2 · avisos esgotados ──
  if (esgotado) {
    const mes = mesDoSaldo(saldo?.mes);
    const volta = mesPorExtenso(saldo?.renova_em);
    const pacote = saldo?.pacote;
    return (
      <View testID="hub-fechada-esgotado" style={s.wrap}>
        <Text style={s.titulo}>
          {saldo && saldo.total ? `Os ${saldo.total} avisos de ${mes || "este mês"} acabaram.` : "Os avisos acabaram."}
        </Text>
        <Text style={s.texto}>
          {volta ? `Convites voltam em 1º de ${volta}. ` : "Esses avisos não renovam sozinhos. "}
          Nada sai além do que a loja contratou, nem por engano.
        </Text>
        <Text style={s.texto}>
          {`${nome[0].toUpperCase()}${nome.slice(1)} pode te chamar quando quiser, `}<Text style={s.forte}>sem custo</Text>
          . Mande o seu link do WhatsApp no Instagram ou deixe o QR no balcão:
        </Text>
        {data.meu_link && <Text testID="hub-fechada-link" style={s.link} selectable>{data.meu_link.replace(/^https?:\/\//, "")}</Text>}
        <View style={s.linha}>
          {data.meu_link && (
            <Pressable testID="hub-fechada-copiar" style={s.ghost}
              onPress={async () => { setLinkCopiado(await copyToClipboard(data.meu_link!)); }}>
              <Text style={s.ghostText}>{linkCopiado ? "Link copiado" : "Copiar meu link"}</Text>
            </Pressable>
          )}
          {pacote && (
            <Pressable testID="hub-fechada-pacote" disabled={mPacote.isPending} style={[s.botao, mPacote.isPending && { opacity: 0.6 }]}
              onPress={() => mPacote.mutate()}>
              <Text style={s.botaoText}>{mPacote.isPending ? "Gerando…" : `Adicionar ${pacote.qty} avisos por ${reaisDeCentavos(pacote.preco_centavos)}`}</Text>
            </Pressable>
          )}
        </View>
        <Text style={s.nota}>Só passam a valer depois do pagamento. A Aura nunca compra sozinha.</Text>
        {aviso && <Text testID="hub-fechada-aviso" style={s.aviso}>{aviso}</Text>}
        <View style={s.caixa}>
          <Text style={s.caixaTitulo}>Com os avisos esgotados</Text>
          <Text style={s.nota}>Cobranças do crediário passam para o botão "Cobrar pelo meu WhatsApp", de graça, um toque por cliente.</Text>
          <Text style={s.nota}>Aniversário e Venda+ seguem: usam as novidades, que são outro saldo.</Text>
          <Text style={s.nota}>Conversas abertas continuam sem custo.</Text>
        </View>
      </View>
    );
  }

  // ── Sem nenhum convite pronto ──
  if (!prontos.length) {
    const nenhumCriado = data.convites.every((c) => c.estado === "NAO_CRIADO");
    return (
      <View testID="hub-fechada-sem-convite" style={s.wrap}>
        <Text style={s.titulo}>A conversa com {nome} está fechada.</Text>
        <Text style={s.texto}>
          {!data.conectado
            ? "Conecte o WhatsApp da loja para mandar convites."
            : nenhumCriado
              ? "Para falar primeiro, a loja usa convites prontos que o WhatsApp precisa aprovar antes."
              : "Os convites estão em aprovação no WhatsApp. Quando ele aprovar, eles aparecem aqui."}
        </Text>
        {data.conectado && nenhumCriado && podeConfigurar && (
          <Pressable testID="hub-fechada-preparar" disabled={mPreparar.isPending} style={[s.botao, { alignSelf: "flex-start" }, mPreparar.isPending && { opacity: 0.6 }]}
            onPress={() => mPreparar.mutate()}>
            <Text style={s.botaoText}>{mPreparar.isPending ? "Pedindo…" : "Pedir os convites ao WhatsApp"}</Text>
          </Pressable>
        )}
        {data.conectado && nenhumCriado && !podeConfigurar && (
          <Text style={s.nota}>Peça ao dono ou a um admin da loja para liberar os convites.</Text>
        )}
        {aviso && <Text testID="hub-fechada-aviso" style={s.aviso}>{aviso}</Text>}
        {data.meu_link && <Text style={s.nota}>{`${nome[0].toUpperCase()}${nome.slice(1)} também pode te chamar a qualquer momento, sem custo: ${data.meu_link.replace(/^https?:\/\//, "")}`}</Text>}
      </View>
    );
  }

  // ── Estado 1 · ainda há avisos ──
  const campos = convite?.campos || [];
  const valorDe = (k: string, auto: boolean) => (auto ? data.auto[k as "nome" | "loja"] : valores[k]) || "";
  const faltando = campos.some((f) => !f.auto && !(valores[f.key] || "").trim());
  const ficam = saldo ? Math.max(saldo.restante - 1, 0) : null;

  return (
    <View testID="hub-fechada" style={s.wrap}>
      <Text style={s.titulo}>Para falar com {nome}, escolha o convite:</Text>
      <View style={s.chips}>
        {data.convites.map((c) => (
          <Pressable key={c.key} testID={`hub-convite-${c.key}`} disabled={!c.pronto}
            onPress={() => { setEscolhido(c.key); setAviso(null); }}
            style={[s.chip, escolhido === c.key && c.pronto && s.chipOn, !c.pronto && { opacity: 0.45 }]}>
            <Text style={[s.chipText, escolhido === c.key && c.pronto && { color: "#fff" }]}>
              {c.titulo}{!c.pronto ? " · em aprovação" : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {convite && (
        <>
          <View testID="hub-convite-previa" style={s.previa}>
            <Text style={s.previaTexto}>
              {convite.partes.map((p, i) => {
                if (typeof p === "string") return <Text key={i}>{p}</Text>;
                const f = campos.find((x) => x.key === p.campo);
                const v = valorDe(p.campo, !!f?.auto);
                return f?.auto
                  ? <Text key={i}>{v}</Text>
                  : <Text key={i} style={s.editavel}>{v || `[${f?.rotulo || p.campo}]`}</Text>;
              })}
            </Text>
            <Text style={s.previaLegenda}>prévia · você muda só os trechos marcados</Text>
          </View>
          <View style={s.campos}>
            {campos.filter((f) => !f.auto).map((f) => (
              <View key={f.key} style={s.campo}>
                <Text style={s.campoRotulo}>{f.rotulo}</Text>
                <TextInput testID={`hub-convite-campo-${f.key}`} style={s.input} value={valores[f.key] || ""} maxLength={f.max}
                  onChangeText={(t) => setValores((v) => ({ ...v, [f.key]: t }))}
                  placeholder={f.exemplo} placeholderTextColor={Colors.ink3} />
              </View>
            ))}
          </View>
        </>
      )}

      <View style={s.rodape}>
        <Text testID="hub-fechada-custo" style={s.custo}>
          <Text style={s.forte}>Usa 1 aviso</Text>
          {saldo && ficam != null ? ` · ficam ${ficam} de ${saldo.total}` : ""}
        </Text>
        <Pressable testID="hub-fechada-mandar" disabled={!convite || faltando || mEnviar.isPending}
          style={[s.botao, (!convite || faltando || mEnviar.isPending) && { opacity: 0.5 }]} onPress={() => mEnviar.mutate()}>
          <Text style={s.botaoText}>{mEnviar.isPending ? "Mandando…" : "Mandar convite"}</Text>
        </Pressable>
      </View>
      <Text style={s.nota}>Quando {nome} responder, a conversa abre de novo por um dia e o resto não gasta nada.</Text>
      {aviso && <Text testID="hub-fechada-aviso" style={s.aviso}>{aviso}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, gap: 8 },
  centro: { alignItems: "center", paddingVertical: 16 },
  titulo: { fontSize: 13.5, fontWeight: "800", color: Colors.ink },
  texto: { fontSize: 13, color: Colors.ink2, lineHeight: 19 },
  forte: { fontWeight: "800", color: Colors.ink },
  nota: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16 },
  aviso: { fontSize: 12.5, color: Colors.green, lineHeight: 18 },
  link: { fontSize: 14, fontWeight: "800", color: Colors.violet3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.bg3 },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipText: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  previa: { borderWidth: 1, borderColor: Colors.violet + "55", borderRadius: 12, padding: 12, backgroundColor: Colors.violet + "10", gap: 6 },
  previaTexto: { fontSize: 13.5, color: Colors.ink, lineHeight: 20 },
  editavel: { color: Colors.violet3, fontWeight: "800", backgroundColor: Colors.violet + "22" },
  previaLegenda: { fontSize: 10.5, color: Colors.ink3, letterSpacing: 0.3 },
  campos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  campo: { flexGrow: 1, minWidth: 160, gap: 3 },
  campoRotulo: { fontSize: 10.5, fontWeight: "800", color: Colors.ink3, letterSpacing: 0.3, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg3 },
  rodape: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  custo: { fontSize: 12.5, color: Colors.ink2 },
  linha: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  botao: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  botaoText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  ghost: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  ghostText: { color: Colors.ink2, fontSize: 13, fontWeight: "700" },
  caixa: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, gap: 4, backgroundColor: Colors.bg3 },
  caixaTitulo: { fontSize: 11, fontWeight: "800", color: Colors.ink3, letterSpacing: 0.4, textTransform: "uppercase" },
});
