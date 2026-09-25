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
import { createElement, useEffect, useMemo, useState } from "react";
import { View, Pressable, TextInput, ScrollView, ActivityIndicator, Linking, Platform, useWindowDimensions } from "react-native";
import { Texto, Numero, useTipografia } from "./TipografiaVitrine";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { Etiqueta } from "./HomeDaVitrine";
import { BarraDeCookies } from "./ConsentimentoDaVitrine";
import {
  nomesDaLista, nomesIgnorados, proximoDegrau, pendenciaDoLote, dinheiro, fraseDoPrazo,
  dataMinimaDoLote, dataDoLoteLegivel, codigoDoOrcamento, mensagemDoOrcamento,
  type CotacaoDoLote,
} from "./loteDaVitrine";
import { maskPhone, maskDateBr, brDateToIso } from "@/utils/masks";
import { numeroWhatsApp } from "./AncoraWhatsApp";
import { Icon } from "@/components/Icon";
import { VERDE_WHATSAPP, BORDA_DE_CAMPO, FUNDO_APAGADO, Nota } from "./ui/Formulario";
import { tintaSobre } from "./theme";
import { useTipografia as useTipo, estiloNumero } from "./TipografiaVitrine";
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
  // Fase 2: `codigo` é o número do orçamento que o servidor devolve (B6,
  // "L-3F9A2C"). Sem ele a tela NÃO inventa número — antes ela mostrava o
  // nome do evento no lugar.
  const [pronto, setPronto] = useState<{ codigo: string | null; total: number; unit: number; pct: number; prazo: number | null } | null>(null);

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
  // O botao principal trava por uma regra so: o `disabled` e o estado que
  // o leitor de tela anuncia saem daqui.
  const botaoTravado = passo === 1 ? !podeAvancar : !!pendencia || enviando;

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
          // "AAAA-MM-DD" do seletor (ou o "DD/MM/AAAA" digitado no nativo,
          // convertido): o servidor aceita os dois (services/dataDoLote.js).
          delivery_deadline: (/^\d{4}-\d{2}-\d{2}$/.test(prazo) ? prazo : brDateToIso(prazo)) || null,
          notes: obs.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Não foi possível registrar agora.");
      setPronto({
        codigo: codigoDoOrcamento(j),
        total: Number(j.pricing?.total_amount) || cotacao?.total_amount || 0,
        unit: Number(j.pricing?.unit_price) || (cotacao ? cotacao.total_amount / Math.max(1, cotacao.qty) : 0),
        pct: Number(j.pricing?.discount_pct) || cotacao?.discount_pct || 0,
        prazo: cotacao?.prazo_dias ?? null,
      });
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

  // ── Orçamento registrado (Fase 2, Tela 9 · "Orçamento enviado") ──
  if (pronto) {
    const loja = store.site.name;
    const primeiro = contato.trim().split(/\s+/)[0] || "";
    const num = numeroWhatsApp((store.site as any)?.whatsapp);
    const recado = mensagemDoOrcamento({
      codigo: pronto.codigo, evento, pecas: nomes.length, produto: produto?.name, total: pronto.total, nomeDaLoja: loja,
    });
    const passos = [
      `A ${loja} confere os ${nomes.length} ${nomes.length === 1 ? "nome" : "nomes"} e o prazo.`,
      pronto.codigo
        ? `Você recebe no WhatsApp o orçamento #${pronto.codigo} com a prova da arte.`
        : "Você recebe no WhatsApp o orçamento com a prova da arte.",
      "Aprova e paga o sinal pelo link. Precisa de nota com CNPJ? É lá que você informa.",
    ];
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 48 }}>
          <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: 16 }} testID="orcamento-enviado">
            {pronto.codigo ? (
              <View style={{ alignSelf: "flex-start", backgroundColor: FUNDO_APAGADO, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Numero style={{ fontSize: 12.5, letterSpacing: 1, color: T.ink }}>Orçamento #{pronto.codigo}</Numero>
              </View>
            ) : (
              <Etiqueta cor={tema.marcaTexto}>Orçamento em lote registrado</Etiqueta>
            )}
            <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 30, lineHeight: 35, color: T.ink }}>
              {loja} recebeu sua lista{primeiro ? `, ${primeiro}` : ""}.
            </Texto>
            <Texto style={{ fontSize: 15, lineHeight: 22, color: T.ink2 }}>
              {nomes.length} {produto?.name || (nomes.length === 1 ? "peça" : "peças")} para "{evento.trim()}", com estimativa de{" "}
              <Texto style={{ fontWeight: "700", color: T.ink }}>{dinheiro(pronto.total)}</Texto>
              {pronto.unit > 0 ? ` (${dinheiro(pronto.unit)} cada)` : ""}
              {pronto.prazo ? ` e pronto em ${pronto.prazo} ${pronto.prazo === 1 ? "dia útil" : "dias úteis"} depois da aprovação` : ""}.
            </Texto>
            <Nota tom="info" icone="info">
              {`Isso é um orçamento, ainda não é um pedido fechado. A ${loja} confere a lista e confirma o preço e o prazo.`}
            </Nota>
            <View style={{ backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 18, gap: 12 }}>
              <Numero style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: T.ink3 }}>O que acontece agora</Numero>
              {passos.map((t, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: FUNDO_APAGADO, alignItems: "center", justifyContent: "center" }}>
                    <Numero style={{ fontSize: 12.5, fontWeight: "700", color: T.ink }}>{i + 1}</Numero>
                  </View>
                  <Texto style={{ flex: 1, fontSize: 14, lineHeight: 20, color: T.ink2 }}>{t}</Texto>
                </View>
              ))}
            </View>
            {num ? (
              <Pressable
                onPress={() => Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(recado)}`)}
                accessibilityRole="link"
                style={{ minHeight: 48, borderRadius: 12, backgroundColor: VERDE_WHATSAPP, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}
              >
                <Icon name="whatsapp" size={17} color={tintaSobre(VERDE_WHATSAPP)} />
                <Texto style={{ color: tintaSobre(VERDE_WHATSAPP), fontSize: 15, fontWeight: "700", textAlign: "center" }}>
                  {pronto.codigo ? `Mandar o #${pronto.codigo} no WhatsApp da ${loja}` : `Avisar a ${loja} no WhatsApp`}
                </Texto>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onVoltar}
              accessibilityRole="button"
              style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: BORDA_DE_CAMPO, backgroundColor: T.card, alignItems: "center", justifyContent: "center" }}
            >
              <Texto style={{ color: T.ink, fontWeight: "700", fontSize: 15 }}>Voltar para a loja</Texto>
            </Pressable>
          </View>
        </ScrollView>
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
            <Numero style={{ fontSize: 18, color: T.ink }}>
              {dinheiro(cotacao.total_amount)}
            </Numero>
          </View>
          {degrau ? (
            <Texto style={{ fontSize: 11.5, color: tema.marcaTexto, lineHeight: 16 }}>
              Faltam {degrau.faltam} {degrau.faltam === 1 ? "nome" : "nomes"} para{" "}
              {dinheiro(degrau.precoUn)} cada ({degrau.pct}% off).
            </Texto>
          ) : null}
          {/* O prazo é da LOJISTA, por faixa de tiragem. Sem ele, a frase
              diz que ela informa — que é verdade — em vez de um número
              que ninguém prometeu. */}
          <Texto style={{ fontSize: 11.5, color: T.ink3, lineHeight: 16 }}>
            {fraseDoPrazo(cotacao.prazo_dias)}
          </Texto>
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
        <Numero style={{ fontSize: 10.5, letterSpacing: 1.4,
                        textTransform: "uppercase", color: T.ink3, marginLeft: "auto" }}>
          Empresas e eventos
        </Numero>
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
                            <Numero style={{ fontSize: 11, color: T.ink3 }}>
                              {dinheiro(Number(p.price))}
                            </Numero>
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
                      value={telefone} onChangeText={(t) => setTelefone(maskPhone(t))}
                      placeholder="(12) 99999-9999" placeholderTextColor={T.ink4}
                      keyboardType="phone-pad" inputMode="tel"
                      accessibilityLabel="WhatsApp com DDD" style={campo}
                    />
                  </Bloco>

                  <Bloco titulo="Para quando?" T={T} nota="opcional">
                    <SeletorDeData
                      valor={prazo} onMudar={setPrazo}
                      minimo={dataMinimaDoLote(cotacao?.prazo_dias ?? null)}
                      estilo={campo}
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

                {/* O estado acessivel repetia a regra do `disabled` sem o
                    `enviando`: durante o envio o botao estava travado e o
                    leitor de tela o anunciava como ativo. Uma conta so. */}
                <Pressable
                  onPress={() => (passo === 1 ? setPasso(2) : enviar())}
                  disabled={botaoTravado}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: botaoTravado, busy: enviando }}
                  style={{
                    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
                    backgroundColor: !botaoTravado ? tema.marcaFill : T.border,
                  }}
                >
                  <Texto style={{
                    fontSize: 14.5, fontWeight: "800",
                    color: !botaoTravado ? tema.sobreMarca : T.ink3,
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
      <BarraDeCookies />
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
          <Numero style={{ fontSize: 10.5, color: T.ink3 }}>{nota}</Numero>
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
      <Numero style={{ fontSize: 12.5, color: destaque || T.ink }}>{valor}</Numero>
    </View>
  );
}

/**
 * "Para quando?" com o seletor de data do aparelho (Fase 2, Tela 9). Era
 * texto livre, e "semana que vem" chegava à lojista como data.
 *
 * No navegador é o `<input type="date">` nativo — o calendário que o
 * celular já sabe mostrar —, com a data mínima tirada do prazo da faixa
 * (dias úteis). Fora do navegador, o campo com máscara DD/MM/AAAA.
 */
function SeletorDeData({
  valor, onMudar, minimo, estilo,
}: { valor: string; onMudar: (v: string) => void; minimo: string; estilo: any }) {
  const T = usePaletaDaVitrine();
  const par = useTipo();
  if (Platform.OS === "web") {
    return (
      <View style={{ gap: 6 }}>
        {createElement("input", {
          type: "date",
          value: valor,
          min: minimo,
          "aria-label": "Data de entrega desejada",
          onChange: (e: any) => onMudar(String(e?.target?.value || "")),
          style: {
            ...estilo,
            fontFamily: estiloNumero(par).fontFamily,
            minHeight: 46, boxSizing: "border-box", width: "100%",
            borderStyle: "solid", outline: "none",
          },
        })}
        <Texto style={{ fontSize: 12, color: T.ink3 }}>
          {valor ? `Entrega até ${dataDoLoteLegivel(valor)}. ` : ""}A partir de {dataDoLoteLegivel(minimo)}, pelo prazo desta quantidade.
        </Texto>
      </View>
    );
  }
  return (
    <TextInput
      value={valor} onChangeText={(t) => onMudar(maskDateBr(t))}
      placeholder={dataDoLoteLegivel(minimo)} placeholderTextColor={T.ink4}
      keyboardType="number-pad"
      accessibilityLabel="Data de entrega desejada" style={estilo}
    />
  );
}
