// ============================================================
// Ficha de produção do pedido — A5, para imprimir (05/09/2026)
//
// Decisão do Caio (rodada 2 do QA "O dia da Marina"): a lojista
// produzia olhando o celular, e a personalização ficava a três toques de
// distância enquanto a mão estava na prensa. A ficha vai pra bancada
// junto com a peça: o que estampar, onde, em que cor, com a arte em
// tamanho legível e o link para baixar o arquivo original.
//
// É uma página do painel (precisa de login), com um único botão fora da
// impressão. Sem tema escuro aqui de propósito: papel é branco.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, Platform, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { studioApi, type StudioOrderDetail, type CustomizationConfig, type CustomizationField } from "@/services/studioApi";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import { rotuloDaChave, valorDaChave } from "@/components/studio/customizationConfig";
import { versoAtivo } from "@/components/studio/storefront/versoDoPedido";
import { labelStudioStatus } from "@/constants/studio-status";
import { baixarArquivo, nomeDoArquivo } from "@/components/studio/baixarArquivo";
import { toast } from "@/components/Toast";

const PAPEL = "#FFFFFF";
const TINTA = "#151515";
const TINTA2 = "#4A4A4A";
const TINTA3 = "#7A7A7A";
const LINHA = "#D9D9D9";

/** Estilo de impressão: A5, sem margens do navegador, botão fora do papel. */
const CSS_DE_IMPRESSAO = `
@page { size: A5 portrait; margin: 10mm; }
@media print {
  #ficha-nao-imprime { display: none !important; }
  body { background: #fff !important; }
}
`;

function ehUrlDeArquivo(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v) && /\.(png|jpe?g|webp|gif|pdf|svg)(\?|#|$)/i.test(v);
}

function ehCorHex(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v);
}

export default function FichaDeProducao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { company } = useAuthStore();
  const [data, setData] = useState<StudioOrderDetail | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, CustomizationConfig | null>>({});

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById("aura-ficha-print-css")) return;
    const st = document.createElement("style");
    st.id = "aura-ficha-print-css";
    st.textContent = CSS_DE_IMPRESSAO;
    document.head.appendChild(st);
  }, []);

  useEffect(() => {
    if (!company?.id || !id) return;
    let vivo = true;
    studioApi.getOrder(company.id, String(id))
      .then((d) => { if (vivo) setData(d); })
      .catch((e: any) => { if (vivo) setErro(e?.message || "Não foi possível abrir o pedido."); });
    return () => { vivo = false; };
  }, [company?.id, id]);

  // Mesmo caminho do detalhe do pedido: a config do produto dá nome aos
  // campos crus e alimenta o preview.
  useEffect(() => {
    if (!company?.id || !data) return;
    const cid = company.id;
    const faltam = (data.items || []).filter((it) => it.customization && it.product_id && !(it.product_id in configs));
    if (!faltam.length) return;
    let vivo = true;
    Promise.all(faltam.map((it) =>
      studioApi.getCustomizationConfig(cid, it.product_id)
        .then((r) => [it.product_id, r.config] as const)
        .catch(() => [it.product_id, null] as const),
    )).then((pares) => {
      if (!vivo) return;
      setConfigs((prev) => { const n = { ...prev }; for (const [pid, cfg] of pares) n[pid] = cfg; return n; });
    });
    return () => { vivo = false; };
  }, [company?.id, data, configs]);

  const numero = useMemo(() => {
    const o: any = data?.order;
    return o?.order_number || (o?.id ? String(o.id).slice(0, 8).toUpperCase() : "");
  }, [data]);

  function imprimir() {
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.print === "function") window.print();
    else toast.error("A impressão está disponível na versão web.");
  }

  async function baixar(url: string, rotulo: string) {
    const r = await baixarArquivo(url, nomeDoArquivo(numero, rotulo, url));
    if (r === "aberto") toast.info("Abrimos a arte em outra aba. Salve por lá.");
  }

  if (erro) {
    return <View style={s.pagina}><Text style={s.erro}>{erro}</Text></View>;
  }
  if (!data) {
    return <View style={s.pagina}><Text style={s.mudo}>Carregando a ficha…</Text></View>;
  }

  const { order, items } = data;
  const criado = new Date(order.created_at);
  const nomeDaLoja = (company as any)?.trade_name || (company as any)?.legal_name || (company as any)?.name || "";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: PAPEL }} contentContainerStyle={s.pagina}>
      <View nativeID="ficha-nao-imprime" style={s.barra}>
        <Pressable onPress={() => router.back()} style={s.botaoGhost} accessibilityRole="button">
          <Text style={s.botaoGhostTxt}>← Voltar ao pedido</Text>
        </Pressable>
        <Pressable onPress={imprimir} style={s.botao} accessibilityRole="button" testID="btn-imprimir-ficha">
          <Text style={s.botaoTxt}>Imprimir (A5)</Text>
        </Pressable>
      </View>

      <View style={s.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{nomeDaLoja ? `${nomeDaLoja} · ` : ""}FICHA DE PRODUÇÃO</Text>
          <Text style={s.titulo}>Pedido {numero}</Text>
          <Text style={s.sub}>
            {criado.toLocaleDateString("pt-BR")} · {labelStudioStatus(order.studio_production_status || "pending_art")}
          </Text>
        </View>
        <View style={s.caixaCliente}>
          <Text style={s.rotulo}>CLIENTE</Text>
          <Text style={s.valorForte}>{order.customer_name || "—"}</Text>
          {order.customer_phone ? <Text style={s.valor}>{order.customer_phone}</Text> : null}
        </View>
      </View>

      {items.map((it, idx) => {
        const cfg = it.product_id ? configs[it.product_id] : null;
        const valores: Record<string, any> = it.customization || {};
        const porId: Record<string, CustomizationField> = {};
        for (const f of cfg?.fields || []) porId[f.id] = f;
        const temVerso = versoAtivo(cfg, valores.has_back_selected, valores);
        const entradas = Object.entries(valores).filter(([k]) => !k.startsWith("has_"));

        return (
          <View key={it.id} style={s.item}>
            <View style={s.itemCabecalho}>
              <Text style={s.itemNumero}>{String(idx + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.itemNome}>{it.product_name}</Text>
                <Text style={s.sub}>{it.quantity} unidade{it.quantity === 1 ? "" : "s"}</Text>
              </View>
            </View>

            {cfg ? (
              <View style={s.previews}>
                <View style={s.previewBloco}>
                  <PersonalizationPreview config={cfg} values={valores} size={220} showLabel={false} side="front" />
                  <Text style={s.legenda}>Frente</Text>
                </View>
                {temVerso ? (
                  <View style={s.previewBloco}>
                    <PersonalizationPreview config={cfg} values={valores} size={220} showLabel={false} side="back" />
                    <Text style={s.legenda}>Verso</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {entradas.length ? (
              <View style={s.tabela}>
                {entradas.map(([k, v]) => {
                  const rotulo = rotuloDaChave(k, porId);
                  const arquivo = ehUrlDeArquivo(v);
                  return (
                    <View key={k} style={s.linha}>
                      <Text style={s.linhaRotulo}>{rotulo}</Text>
                      <View style={s.linhaValor}>
                        {ehCorHex(v) ? <View style={[s.amostra, { backgroundColor: v }]} /> : null}
                        {arquivo ? (
                          <View style={{ gap: 6 }}>
                            {/\.pdf(\?|#|$)/i.test(v) ? null : (
                              <Image source={{ uri: v }} style={s.arte} resizeMode="contain" accessibilityLabel={rotulo} />
                            )}
                            <Pressable
                              nativeID="ficha-nao-imprime"
                              onPress={() => baixar(v, rotulo)}
                              style={s.botaoPequeno}
                              accessibilityRole="button"
                            >
                              <Text style={s.botaoPequenoTxt}>Baixar arte</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Text style={s.valor}>{valorDaChave(v)}</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={s.mudo}>Sem personalização neste item.</Text>
            )}
          </View>
        );
      })}

      {(order as any).notes ? (
        <View style={s.observacoes}>
          <Text style={s.rotulo}>OBSERVAÇÕES</Text>
          <Text style={s.valor}>{(order as any).notes}</Text>
        </View>
      ) : null}

      <Text style={s.rodape}>Impresso pelo Aura Studio · {new Date().toLocaleString("pt-BR")}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pagina: { backgroundColor: PAPEL, padding: 20, maxWidth: 560, width: "100%", alignSelf: "center", gap: 14 },
  barra: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 4 },
  botao: { backgroundColor: TINTA, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8 },
  botaoTxt: { color: PAPEL, fontWeight: "800", fontSize: 13 },
  botaoGhost: { paddingVertical: 9, paddingHorizontal: 4 },
  botaoGhostTxt: { color: TINTA2, fontWeight: "600", fontSize: 13 },
  botaoPequeno: { alignSelf: "flex-start", borderWidth: 1, borderColor: TINTA, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10 },
  botaoPequenoTxt: { color: TINTA, fontWeight: "700", fontSize: 11 },
  cabecalho: { flexDirection: "row", gap: 14, alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: TINTA, paddingBottom: 12 },
  eyebrow: { fontSize: 10, letterSpacing: 1, color: TINTA3, fontWeight: "700" },
  titulo: { fontSize: 24, fontWeight: "800", color: TINTA, marginTop: 2 },
  sub: { fontSize: 12, color: TINTA2, marginTop: 2 },
  caixaCliente: { borderWidth: 1, borderColor: LINHA, borderRadius: 8, padding: 10, minWidth: 160 },
  rotulo: { fontSize: 10, letterSpacing: 0.8, color: TINTA3, fontWeight: "700", marginBottom: 2 },
  valor: { fontSize: 13, color: TINTA, lineHeight: 18 },
  valorForte: { fontSize: 14, color: TINTA, fontWeight: "800" },
  item: { borderWidth: 1, borderColor: LINHA, borderRadius: 10, padding: 14, gap: 12 },
  itemCabecalho: { flexDirection: "row", gap: 10, alignItems: "center" },
  itemNumero: { fontSize: 22, fontWeight: "800", color: TINTA3, fontVariant: ["tabular-nums"] },
  itemNome: { fontSize: 16, fontWeight: "800", color: TINTA },
  previews: { flexDirection: "row", gap: 14, flexWrap: "wrap", justifyContent: "center" },
  previewBloco: { alignItems: "center", gap: 4 },
  legenda: { fontSize: 11, color: TINTA3, fontWeight: "700", letterSpacing: 0.6 },
  tabela: { borderTopWidth: 1, borderTopColor: LINHA },
  linha: { flexDirection: "row", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: LINHA },
  linhaRotulo: { width: 130, fontSize: 12, color: TINTA2, fontWeight: "700" },
  linhaValor: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  amostra: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: LINHA, marginTop: 1 },
  arte: { width: 220, height: 160, borderWidth: 1, borderColor: LINHA, borderRadius: 6, backgroundColor: "#FAFAFA" },
  observacoes: { borderWidth: 1, borderColor: LINHA, borderRadius: 8, padding: 10 },
  rodape: { fontSize: 10, color: TINTA3, textAlign: "center", marginTop: 6 },
  erro: { color: "#B00020", fontWeight: "700" },
  mudo: { color: TINTA3, fontSize: 12 },
});
