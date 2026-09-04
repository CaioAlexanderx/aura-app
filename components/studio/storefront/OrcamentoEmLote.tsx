// ============================================================
// components/studio/storefront/OrcamentoEmLote.tsx
//
// O orçamento em lote, público. Dois passos, como o do painel.
//
// O wizard do painel foi reduzido de 5 passos para 2 em 2026 (QA #10):
// os passos 3 a 5 eram preço pré-preenchido, dois campos opcionais e uma
// releitura. Este nasce com a lição aprendida.
//
// Passo 1 — evento, peça e a lista de nomes coladas
// Passo 2 — contato e prazo, com o preço já calculado ao lado
//
// O preço vem do servidor a cada mudança (`bulk-quote`), nunca de conta
// local: o desconto por quantidade é regra de dinheiro e mora em
// services/studioLote.js, lido também pelo painel.
//
// O evento nasce RASCUNHO (decisão 2). A tela diz isso com todas as
// letras — sem isso a pessoa acha que fechou negócio e fica esperando.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Pressable, TextInput, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import { Texto, useTipografia } from "./TipografiaVitrine";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { Fonts } from "@/constants/fonts";
import { Etiqueta } from "./HomeDaVitrine";
import {
  nomesDaLista, nomesIgnorados, proximoDegrau, pendenciaDoLote, dinheiro,
  type CotacaoDoLote,
} from "./loteDaVitrine";
import type { StorePayload, StudioStoreProduct } from "./types";

import { enderecoDaApi } from "./enderecoDaApi";

const API_BASE = enderecoDaApi();

const LARGURA_MAX = 980;

export function OrcamentoEmLote({
  store, slug, onVoltar,
}: {
  store: StorePayload;
  slug: string;
  onVoltar: () => void;
}) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  const tipo = useTipografia();
  const { width } = useWindowDimensions();
  const larga = width >= 900;

  const [passo, setPasso] = useState<1 | 2>(1);
  const [evento, setEvento] = useState("");
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [lista, setLista] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [prazo, setPrazo] = useState("");
  const [obs, setObs] = useState("");

  const [cotacao, setCotacao] = useState<CotacaoDoLote | null>(null);
  const [cotando, setCotando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{ numero: string; total: number } | null>(null);

  const nomes = useMemo(() => nomesDaLista(lista), [lista]);
  const sobrando = useMemo(() => nomesIgnorados(lista), [lista]);
  const produto = useMemo(
    () => (store.products || []).find((p) => p.id === produtoId) || null,
    [store.products, produtoId],
  );

  // Só peça com personalização entra: orçar em lote uma folha de
  // sublimação avulsa não é o que esta tela resolve.
  const pecas = useMemo(
    () => (store.products || []).filter((p) => p.customization_config),
    [store.products],
  );

  // A cotação vem do servidor, com respiro: a pessoa cola 80 nomes de
  // uma vez e depois digita. Uma chamada por tecla seria 80 chamadas.
  useEffect(() => {
    if (!produtoId || nomes.length === 0) { setCotacao(null); return; }
    let vivo = true;
    setCotando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/storefront/${slug}/studio/bulk-quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: produtoId, qty: nomes.length }),
        });
        const j = await r.json();
        if (vivo && r.ok) setCotacao(j);
      } catch {
        // Cotação é conforto, não bloqueio: sem ela a pessoa ainda
        // consegue pedir o orçamento e a lojista responde.
      } finally {
        if (vivo) setCotando(false);
      }
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [produtoId, nomes.length, slug]);

  const degrau = proximoDegrau(cotacao);
  const pendencia = pendenciaDoLote({ evento, produtoId, nomes, contato, telefone });
  const podeAvancar = !!(evento.trim().length >= 2 && produtoId && nomes.length > 0);

  async function enviar() {
    if (pendencia) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`${API_BASE}/storefront/${slug}/studio/bulk-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: produtoId,
          event_name: evento.trim(),
          customer_name: contato.trim(),
          customer_phone: telefone,
          names: nomes,
          delivery_deadline: prazo.trim() || null,
          notes: obs.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Não foi possível registrar agora.");
      setPronto({ numero: j.event?.event_name || evento, total: j.pricing?.total_amount || 0 });
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setEnviando(false);
    }
  }

  const campo = {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: T.ink,
  } as const;

  // ── Pedido registrado ───────────────────────────────────────
  if (pronto) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, padding: 22, justifyContent: "center" }}>
        <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", gap: 12 }}>
          <Etiqueta cor={tema.marcaTexto}>Pedido em lote registrado</Etiqueta>
          <Texto style={{ fontFamily: tipo.display, fontSize: 30, lineHeight: 35, color: T.ink }}>
            {store.site.name} recebeu sua lista.
          </Texto>
          {/* A tela diz o que É: rascunho esperando a lojista. Sem isso a
              pessoa acha que fechou negócio e fica esperando a peça. */}
          <Texto style={{ fontSize: 14.5, lineHeight: 21, color: T.ink2 }}>
            São {nomes.length} {nomes.length === 1 ? "peça" : "peças"} com estimativa de{" "}
            {dinheiro(pronto.total)}. Isso é um orçamento, ainda não é um pedido fechado:
            a loja confere a lista, confirma o prazo e responde no seu WhatsApp.
          </Texto>
          <Pressable
            onPress={onVoltar}
            accessibilityRole="button"
            style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: tema.marcaFill,
                     paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 }}
          >
            <Texto style={{ color: tema.sobreMarca, fontWeight: "700", fontSize: 14 }}>
              Voltar para a loja
            </Texto>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Resumo lateral ──────────────────────────────────────────
  const resumo = (
    <View style={{
      backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border,
      padding: 18, gap: 10, width: larga ? 320 : "100%",
    }}>
      <Etiqueta>Prévia do lote</Etiqueta>
      {produto ? (
        <Texto style={{ fontSize: 14, fontWeight: "700", color: T.ink }}>{produto.name}</Texto>
      ) : (
        <Texto style={{ fontSize: 13, color: T.ink3 }}>Escolha a peça para ver o preço.</Texto>
      )}

      {cotacao && cotacao.qty > 0 ? (
        <View style={{ gap: 6 }}>
          <Linha rotulo={`${cotacao.qty} × ${dinheiro(cotacao.unit_price)}`}
                 valor={dinheiro(cotacao.qty * cotacao.unit_price)} T={T} />
          {cotacao.discount_pct > 0 ? (
            <Linha rotulo={`Desconto por volume (${cotacao.discount_pct}%)`}
                   valor={"− " + dinheiro(cotacao.savings)} T={T} destaque={T.green} />
          ) : null}
          <View style={{ height: 1, backgroundColor: T.border, marginVertical: 4 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Texto style={{ fontSize: 13, fontWeight: "700", color: T.ink }}>Total do lote</Texto>
            <Texto style={{ fontFamily: Fonts.mono, fontSize: 18, color: T.ink }}>
              {dinheiro(cotacao.total_amount)}
            </Texto>
          </View>
          {degrau ? (
            <Texto style={{ fontSize: 11.5, color: tema.marcaTexto, lineHeight: 16 }}>
              Faltam {degrau.faltam} {degrau.faltam === 1 ? "nome" : "nomes"} para{" "}
              {dinheiro(degrau.precoUn)} cada ({degrau.pct}% off).
            </Texto>
          ) : null}
        </View>
      ) : cotando ? (
        <ActivityIndicator color={tema.marcaTexto} />
      ) : null}

      <Texto style={{ fontSize: 11, color: T.ink3, lineHeight: 16, marginTop: 4 }}>
        Cada pessoa recebe um mockup próprio para aprovar. Os nomes entram exatamente
        como você colou.
      </Texto>
    </View>
  );

  // ── Formulário ──────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: T.card,
      }}>
        <Pressable onPress={onVoltar} accessibilityRole="button" accessibilityLabel="Voltar para a loja">
          <Texto style={{ fontSize: 13, color: T.ink2 }}>‹ Voltar para a loja</Texto>
        </Pressable>
        <Texto style={{ fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 1.4,
                        textTransform: "uppercase", color: T.ink3, marginLeft: "auto" }}>
          Empresas e eventos
        </Texto>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }}>
        <View style={{ width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center", gap: 18 }}>
          <View style={{ gap: 8 }}>
            <Etiqueta cor={tema.marcaTexto}>Pedido em lote · preço na hora</Etiqueta>
            <Texto style={{ fontFamily: tipo.display, fontSize: larga ? 38 : 29,
                            lineHeight: larga ? 43 : 34, color: T.ink, maxWidth: 620 }}>
              Um nome em cada peça. Um preço para o lote.
            </Texto>
            <Texto style={{ fontSize: 14, lineHeight: 20, color: T.ink2, maxWidth: 560 }}>
              Cole a lista de convidados ou de colaboradores. Cada linha vira uma peça
              personalizada e o desconto por quantidade cai sozinho.
            </Texto>
          </View>

          <View style={{ flexDirection: "row", gap: 6 }}>
            {[1, 2].map((n) => (
              <View key={n} style={{
                flex: 1, height: 3, borderRadius: 2,
                backgroundColor: n <= passo ? tema.marcaFill : T.border,
              }} />
            ))}
          </View>

          <View style={{ flexDirection: larga ? "row" : "column", gap: 20, alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 16, width: larga ? undefined : "100%" }}>
              {passo === 1 ? (
                <>
                  <Bloco titulo="De qual evento estamos falando?" T={T}>
                    <TextInput
                      value={evento} onChangeText={setEvento}
                      placeholder="Ex: Casamento Marília & João"
                      placeholderTextColor={T.ink4}
                      accessibilityLabel="Nome do evento"
                      style={campo}
                    />
                  </Bloco>

                  <Bloco titulo="Qual peça?" T={T}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {pecas.map((p: StudioStoreProduct) => {
                        const sel = p.id === produtoId;
                        return (
                          <Pressable
                            key={p.id}
                            onPress={() => setProdutoId(p.id)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: sel }}
                            // maxWidth: "Caneca Imperial com Alça e Borda Cromado
                            // Dourada 400ml" saía pela borda direita do celular,
                            // cortada no meio (visto em 04/09/2026).
                            style={{
                              paddingVertical: 10, paddingHorizontal: 13, borderRadius: 12,
                              borderWidth: 1, borderColor: sel ? tema.marcaFill : T.border,
                              backgroundColor: sel ? tema.marcaWash : T.card, gap: 2,
                              maxWidth: "100%",
                            }}
                          >
                            <Texto numberOfLines={2} style={{ fontSize: 13, fontWeight: "600", color: T.ink }}>
                              {p.name}
                            </Texto>
                            <Texto style={{ fontFamily: Fonts.mono, fontSize: 11, color: T.ink3 }}>
                              {dinheiro(Number(p.price))}
                            </Texto>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Bloco>

                  <Bloco titulo="Quem vai receber? Um nome por linha." T={T}
                         nota={nomes.length ? `${nomes.length} ${nomes.length === 1 ? "pessoa" : "pessoas"}` : undefined}>
                    <TextInput
                      value={lista} onChangeText={setLista}
                      multiline numberOfLines={8}
                      placeholder={"Marília\nJoão\nAna Paula"}
                      placeholderTextColor={T.ink4}
                      accessibilityLabel="Lista de nomes"
                      style={[campo, { minHeight: 150, textAlignVertical: "top" }]}
                    />
                    {sobrando > 0 ? (
                      <Texto style={{ fontSize: 11.5, color: T.amber }}>
                        A lista tem {sobrando} {sobrando === 1 ? "nome" : "nomes"} além do limite
                        de 200 por pedido. Fale com a loja para dividir em dois lotes.
                      </Texto>
                    ) : null}
                  </Bloco>
                </>
              ) : (
                <>
                  <Bloco titulo="Como a loja fala com você" T={T}>
                    <TextInput
                      value={contato} onChangeText={setContato}
                      placeholder="Seu nome" placeholderTextColor={T.ink4}
                      accessibilityLabel="Seu nome" style={campo}
                    />
                    <TextInput
                      value={telefone} onChangeText={setTelefone}
                      placeholder="WhatsApp com DDD" placeholderTextColor={T.ink4}
                      keyboardType="phone-pad"
                      accessibilityLabel="WhatsApp com DDD" style={campo}
                    />
                  </Bloco>

                  <Bloco titulo="Para quando?" T={T} nota="opcional">
                    <TextInput
                      value={prazo} onChangeText={setPrazo}
                      placeholder="Ex: 12/10/2026" placeholderTextColor={T.ink4}
                      accessibilityLabel="Data de entrega desejada" style={campo}
                    />
                  </Bloco>

                  <Bloco titulo="Alguma observação?" T={T} nota="opcional">
                    <TextInput
                      value={obs} onChangeText={setObs}
                      multiline numberOfLines={3}
                      placeholder="Cor, arte, detalhes da entrega..."
                      placeholderTextColor={T.ink4}
                      accessibilityLabel="Observações"
                      style={[campo, { minHeight: 80, textAlignVertical: "top" }]}
                    />
                  </Bloco>
                </>
              )}

              {erro ? (
                <Texto style={{ fontSize: 12.5, color: T.red }}>{erro}</Texto>
              ) : null}

              {!larga ? resumo : null}

              <View style={{ flexDirection: "row", gap: 10 }}>
                {passo === 2 ? (
                  <Pressable
                    onPress={() => setPasso(1)}
                    accessibilityRole="button"
                    style={{ paddingVertical: 13, paddingHorizontal: 18, borderRadius: 12,
                             borderWidth: 1, borderColor: T.border }}
                  >
                    <Texto style={{ color: T.ink2, fontWeight: "700", fontSize: 14 }}>Voltar</Texto>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => (passo === 1 ? setPasso(2) : enviar())}
                  disabled={passo === 1 ? !podeAvancar : !!pendencia || enviando}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: passo === 1 ? !podeAvancar : !!pendencia }}
                  style={{
                    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
                    backgroundColor: (passo === 1 ? podeAvancar : !pendencia && !enviando)
                      ? tema.marcaFill : T.border,
                  }}
                >
                  <Texto style={{
                    fontSize: 14.5, fontWeight: "800",
                    color: (passo === 1 ? podeAvancar : !pendencia && !enviando)
                      ? tema.sobreMarca : T.ink4,
                  }}>
                    {passo === 1 ? "Continuar" : enviando ? "Enviando..." : "Pedir orçamento"}
                  </Texto>
                </Pressable>
              </View>

              {passo === 2 && pendencia ? (
                <Texto style={{ fontSize: 12, color: T.amber }}>{pendencia}</Texto>
              ) : null}
            </View>

            {/* No desktop o resumo é a coluna da direita; no celular ele
                vinha DEPOIS do botão, e a pessoa tocava "Continuar" sem ter
                visto o preço que a tela promete "na hora". */}
            {larga ? resumo : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Bloco({
  titulo, nota, children, T,
}: { titulo: string; nota?: string; children: React.ReactNode; T: any }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Texto style={{ fontSize: 13.5, fontWeight: "700", color: T.ink }}>{titulo}</Texto>
        {nota ? (
          <Texto style={{ fontFamily: Fonts.mono, fontSize: 10.5, color: T.ink3 }}>{nota}</Texto>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Linha({ rotulo, valor, T, destaque }: { rotulo: string; valor: string; T: any; destaque?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
      <Texto style={{ fontSize: 12.5, color: T.ink2 }}>{rotulo}</Texto>
      <Texto style={{ fontFamily: Fonts.mono, fontSize: 12.5, color: destaque || T.ink }}>{valor}</Texto>
    </View>
  );
}
