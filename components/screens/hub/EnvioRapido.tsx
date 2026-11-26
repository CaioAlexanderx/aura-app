// ============================================================
// Hub — envio rápido na conversa ABERTA do WhatsApp.
// Produto (foto, nome e preço), orçamento, Pix e link da loja. Tudo é
// mensagem de sessão: não gasta aviso nem novidade. Quem decide a janela
// é o servidor; a tela só mostra os botões enquanto a conversa está aberta.
// O app manda ids; o texto é montado no servidor a partir do cadastro.
// Painel aberto no próprio lugar (sem modal): funciona igual no celular.
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Image, ScrollView, ActivityIndicator } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { fmt } from "@/constants/helpers";
import { hubApi, type HubEnvioTipo } from "@/services/hubApi";

type Painel = null | "produto" | "orcamento" | "pix";

const ATALHOS: { key: HubEnvioTipo; label: string }[] = [
  { key: "produto", label: "Produto" },
  { key: "orcamento", label: "Orçamento" },
  { key: "pix", label: "Pix" },
  { key: "link_loja", label: "Link da loja" },
];

export function EnvioRapido({ companyId, convId, onSent, onError, extras, painelExtra }: {
  companyId: string; convId: string;
  onSent: () => void;
  onError: (mensagem: string) => void;
  /** Botões a mais na mesma linha (foto, áudio, etiqueta). */
  extras?: React.ReactNode;
  /** Painel dos botões extras (gravação, prévia da foto), abaixo da linha de atalhos. */
  painelExtra?: React.ReactNode;
}) {
  const [painel, setPainel] = useState<Painel>(null);
  const [busca, setBusca] = useState("");
  const [valor, setValor] = useState("");

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
    if (key === "link_loja") { mSend.mutate({ type: "link_loja" }); return; }
    setPainel((p) => (p === key ? null : (key as Painel)));
  };

  const valorNum = Number(String(valor).replace(/\./g, "").replace(",", "."));
  const valorOk = valor.trim() !== "" && Number.isFinite(valorNum) && valorNum > 0;

  return (
    <View testID="hub-envio-rapido" style={s.wrap}>
      <View style={s.atalhos}>
        {ATALHOS.map((a) => (
          <Pressable key={a.key} testID={`hub-envio-${a.key}`} onPress={() => escolher(a.key)} disabled={mSend.isPending}
            style={[s.atalho, painel === a.key && s.atalhoOn, mSend.isPending && { opacity: 0.6 }]}>
            <Text style={[s.atalhoText, painel === a.key && s.atalhoTextOn]}>{a.label}</Text>
          </Pressable>
        ))}
        {extras}
      </View>

      {painelExtra}

      {painel === "produto" && (
        <View testID="hub-envio-painel-produto" style={s.painel}>
          <TextInput style={s.busca} value={busca} onChangeText={setBusca}
            placeholder="Buscar produto pelo nome" placeholderTextColor={Colors.ink3} />
          {buscando && !catalogo && <ActivityIndicator color={Colors.violet3} />}
          <ScrollView style={s.lista} keyboardShouldPersistTaps="handled">
            {(catalogo?.products || []).map((p) => (
              <Pressable key={p.id} testID={`hub-produto-${p.id}`} style={s.item}
                onPress={() => mSend.mutate({ type: "produto", product_id: p.id })}>
                {p.image_url
                  ? <Image source={{ uri: p.image_url }} style={s.foto} />
                  : <View style={[s.foto, s.semFoto]}><Text style={s.semFotoText}>sem foto</Text></View>}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.itemNome} numberOfLines={1}>{p.name}</Text>
                  <Text style={s.itemSub}>{fmt(p.price)}</Text>
                </View>
                <Text style={s.mandar}>Mandar</Text>
              </Pressable>
            ))}
            {catalogo && catalogo.products.length === 0 && (
              <Text style={s.vazio}>Nenhum produto encontrado.</Text>
            )}
          </ScrollView>
        </View>
      )}

      {painel === "orcamento" && (
        <View testID="hub-envio-painel-orcamento" style={s.painel}>
          <Text style={s.titulo}>Orçamentos deste cliente</Text>
          {carregandoOrc && <ActivityIndicator color={Colors.violet3} />}
          {(orcs?.quotes || []).map((q) => (
            <Pressable key={q.id} testID={`hub-orcamento-${q.id}`} style={s.item}
              onPress={() => mSend.mutate({ type: "orcamento", quote_id: q.id })}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.itemNome}>{fmt(Number(q.total))}</Text>
                <Text style={s.itemSub}>
                  {q.expires_at ? `vale até ${new Date(q.expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : "sem validade"}
                </Text>
              </View>
              <Text style={s.mandar}>Mandar</Text>
            </Pressable>
          ))}
          {orcs && orcs.quotes.length === 0 && (
            <Text style={s.vazio}>
              Nenhum orçamento enviado para este cliente. Envie o orçamento por Personalizados e ele aparece aqui.
            </Text>
          )}
        </View>
      )}

      {painel === "pix" && (
        <View testID="hub-envio-painel-pix" style={s.painel}>
          <Text style={s.titulo}>Quanto o cliente vai pagar?</Text>
          <View style={s.linha}>
            <TextInput testID="hub-pix-valor" style={[s.busca, { flex: 1 }]} value={valor} onChangeText={setValor}
              keyboardType="decimal-pad" placeholder="Valor em reais (opcional)" placeholderTextColor={Colors.ink3} />
            <Pressable testID="hub-pix-mandar" style={[s.botao, (mSend.isPending || (valor.trim() !== "" && !valorOk)) && { opacity: 0.5 }]}
              disabled={mSend.isPending || (valor.trim() !== "" && !valorOk)}
              onPress={() => mSend.mutate(valorOk ? { type: "pix", amount: valorNum } : { type: "pix" })}>
              <Text style={s.botaoText}>{valorOk ? `Mandar Pix de ${fmt(valorNum)}` : "Mandar chave Pix"}</Text>
            </Pressable>
          </View>
          <Text style={s.dica}>Vai o código "copia e cola" da chave cadastrada no canal digital da loja.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 8, gap: 8 },
  atalhos: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  atalho: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.bg3 },
  atalhoOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  atalhoText: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  atalhoTextOn: { color: "#fff" },
  painel: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 10, gap: 8, backgroundColor: Colors.bg3 },
  titulo: { fontSize: 12.5, fontWeight: "800", color: Colors.ink },
  busca: { borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg2 },
  lista: { maxHeight: 220 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: Colors.border },
  foto: { width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.bg4 },
  semFoto: { alignItems: "center", justifyContent: "center" },
  semFotoText: { fontSize: 8, color: Colors.ink3 },
  itemNome: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  itemSub: { fontSize: 11.5, color: Colors.ink3, marginTop: 1 },
  mandar: { fontSize: 12, fontWeight: "800", color: Colors.violet3 },
  vazio: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  linha: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  botao: { backgroundColor: Colors.violet, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  botaoText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
  dica: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
});
