// ============================================================
// components/studio/storefront/home/NavegacaoDaVitrine.tsx
//
// A navegação da vitrine nova (Fase 5, mockup 05 telas 1, 4 e 5):
//   - o cabeçalho preso: celular com menu · nome · busca · sacola;
//     desktop com nome · campo de busca (lista caindo embaixo dele) ·
//     "Orçamento em lote" · sacola. A barra de categorias fica presa
//     JUNTO (hoje só a busca prende: ProductList.tsx:133-137);
//   - a gaveta do menu no celular: categorias com contagem, filhas em
//     sanfona, orçamento em lote, WhatsApp e o endereço embaixo;
//   - a busca em camada cheia no celular, resultado a cada letra;
//   - toda âncora de categoria (barra, gaveta, busca, rodapé, banner)
//     abre a PÁGINA da categoria (`/<slug>/c/<categoria>`), já no topo —
//     acaba o filtro que mudava fora da vista (ProductList.tsx:340-373).
//
// Camadas absolutas sobre a área da loja, não `Modal`: o Modal do
// react-native-web vai para um portal fora do tema e da tipografia da
// vitrine (mesma razão de SacolaEmGaveta.tsx).
// ============================================================
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Image, Linking, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import type { StorefrontState } from "../useStorefront";
import type { StoreCategory, StudioStoreProduct } from "../types";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero, useTipografia } from "../TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { wash } from "../theme";
import { dinheiro } from "../moeda";
import { pecasNaSacola } from "../precoDaSacola";
import { numeroWhatsApp } from "../AncoraWhatsApp";
import { useReduzirMovimento } from "../movimento";
import { abrirASacola } from "../produto/CabecalhoDaLoja";
import { BotaoIcone, Rotulo, borda2, sombraWeb, transicao, usePulso } from "../produto/kitDaPagina";
import {
  alvoDaCategoria, buscarNaVitrine, menuDaLoja, mensagemDaBuscaVazia, sugestoesDeBusca,
  trechosDestacados, type DestinoDaVitrine, type ItemDoMenu,
} from "./regrasDaHome";

// ── Ações de navegação ───────────────────────────────────────

/**
 * Abre a categoria: a página dela (2+ peças) ou a peça direto (uma só).
 * É o destino de TODA âncora de categoria da vitrine nova.
 */
export function abrirCategoria(sf: StorefrontState, categoria: StoreCategory | null | undefined): boolean {
  const alvo = alvoDaCategoria(categoria, sf.store as any);
  if (!alvo) return false;
  if (alvo.tipo === "grupo") sf.abrirGrupo(alvo.categoria, alvo.produtos);
  else sf.openConfigure(alvo.produto);
  return true;
}

/** O link do WhatsApp da loja com uma mensagem pronta. */
export function linkDoWhatsApp(numero: string | null | undefined, mensagem: string): string | null {
  const n = numeroWhatsApp(numero);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensagem)}` : null;
}

/**
 * Vai para um destino interno (botão do banner). `rolarPara` é da home:
 * a grade e os queridinhos estão na própria página.
 */
export function irParaDestino(
  sf: StorefrontState,
  destino: DestinoDaVitrine | null,
  rolarPara?: (onde: "grade" | "queridinhos") => void,
) {
  if (!destino) return;
  if (destino.tipo === "categoria") abrirCategoria(sf, destino.categoria);
  else if (destino.tipo === "lote") sf.goTo("lote");
  else if (destino.tipo === "externo") Linking.openURL(destino.url);
  else if (rolarPara) rolarPara(destino.tipo);
  else sf.goTo("list");
}

// ── Estado das camadas ───────────────────────────────────────

export type CamadasDaVitrine = {
  aberta: "gaveta" | "busca" | null;
  termo: string;
  setTermo: (t: string) => void;
  abrirGaveta: () => void;
  abrirBusca: (termo?: string) => void;
  fechar: () => void;
};

export function useCamadas(): CamadasDaVitrine {
  const [aberta, setAberta] = useState<"gaveta" | "busca" | null>(null);
  const [termo, setTermo] = useState("");
  // Esc fecha a camada aberta (e o que o foco do teclado espera).
  useEffect(() => {
    if (!aberta || Platform.OS !== "web" || typeof window === "undefined") return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberta(null); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta]);
  return useMemo(() => ({
    aberta, termo, setTermo,
    abrirGaveta: () => setAberta("gaveta"),
    abrirBusca: (t?: string) => { if (typeof t === "string") setTermo(t); setAberta("busca"); },
    fechar: () => setAberta(null),
  }), [aberta, termo]);
}

// ── Peças miúdas ─────────────────────────────────────────────

/** O nome da loja na serifada dela: a marca, que leva ao início. */
export function MarcaDaLoja({ sf, tamanho, onPress }: { sf: StorefrontState; tamanho: number; onPress?: () => void }) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  const nome = String((sf.store as any)?.site?.name || "");
  return (
    <Pressable
      onPress={onPress || (() => sf.goTo("list"))}
      accessibilityRole="link"
      accessibilityLabel={`${nome}, início`}
      style={{ minHeight: 44, justifyContent: "center", flexShrink: 1 }}
    >
      <Texto numberOfLines={1} style={{ fontFamily: tipo.display, fontSize: tamanho, lineHeight: tamanho * 1.15, color: t.marcaTexto, letterSpacing: -0.2 }}>
        {nome}
      </Texto>
    </Pressable>
  );
}

function Sacola({ sf }: { sf: StorefrontState }) {
  const t = useTemaDaVitrine();
  const n = pecasNaSacola(sf.cart);
  const antes = useRef(n);
  const [gatilho, setGatilho] = useState(0);
  useEffect(() => {
    if (n > antes.current) setGatilho((g) => g + 1);
    antes.current = n;
  }, [n]);
  const pulsa = usePulso(gatilho, 600);
  return (
    <View>
      <BotaoIcone icone="shopping_bag" rotulo={n ? `Abrir a sacola, ${n} ${n === 1 ? "peça" : "peças"}` : "Abrir a sacola"} onPress={() => abrirASacola(sf)} testID="botao-da-sacola" />
      {n > 0 ? (
        <View
          pointerEvents="none"
          testID="contador-da-sacola"
          style={[{
            position: "absolute", top: 6, right: 5, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9,
            backgroundColor: t.marcaFill, alignItems: "center", justifyContent: "center",
            transform: [{ scale: pulsa ? 1.35 : 1 }],
          }, transicao("transform", 300)]}
        >
          <Numero style={{ fontSize: 10.5, lineHeight: 18, fontWeight: "700", color: t.sobreMarca }}>{n}</Numero>
        </View>
      ) : null}
    </View>
  );
}

// ── A barra de categorias ────────────────────────────────────

function BarraDeCategorias({
  sf, itens, desktop, ativa,
}: {
  sf: StorefrontState;
  itens: ItemDoMenu[];
  desktop: boolean;
  ativa?: string | null;
}) {
  const t = useTemaDaVitrine();
  if (itens.length < 2) return null;
  const botoes = itens.map((i) => {
    const eAtiva = !!ativa && (ativa === String(i.categoria.slug || "") || ativa === String(i.categoria.id));
    return (
      <Pressable
        key={i.categoria.id}
        onPress={() => abrirCategoria(sf, i.categoria)}
        accessibilityRole="link"
        accessibilityState={{ selected: eAtiva }}
        accessibilityLabel={i.categoria.name}
        style={({ hovered }: any) => ({ height: 44, paddingHorizontal: 2, justifyContent: "center", opacity: hovered && !eAtiva ? 0.8 : 1 })}
      >
        <Texto numberOfLines={1} style={{ fontSize: 14, fontWeight: eAtiva ? "600" : "500", color: eAtiva ? t.ink : t.ink2 }}>
          {i.categoria.name}
        </Texto>
        {eAtiva ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, borderRadius: 2, backgroundColor: t.marcaTexto }} /> : null}
      </Pressable>
    );
  });
  return (
    <View accessibilityRole={"navigation" as any} accessibilityLabel="Categorias" style={{ borderTopWidth: 1, borderTopColor: t.border }}>
      {desktop ? (
        <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap", columnGap: 34 }}>{botoes}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 22, paddingHorizontal: 16 }}
          style={Platform.OS === "web" ? ({ maskImage: "linear-gradient(90deg,#000 88%,transparent)", WebkitMaskImage: "linear-gradient(90deg,#000 88%,transparent)" } as any) : undefined}
        >
          {botoes}
        </ScrollView>
      )}
    </View>
  );
}

// ── O cabeçalho ──────────────────────────────────────────────

/**
 * O cabeçalho preso com a barra de categorias. `solto` = a página ainda
 * não rolou: sem sombra (a sombra só depois de rolar, mockup tela 1).
 */
export function CabecalhoDaVitrine({
  sf, desktop, camadas, categoriaAtiva, rolou, onVerLoja,
}: {
  sf: StorefrontState;
  desktop: boolean;
  camadas: CamadasDaVitrine;
  categoriaAtiva?: string | null;
  rolou?: boolean;
  onVerLoja?: () => void;
}) {
  const t = useTemaDaVitrine();
  const store: any = sf.store;
  const itens = useMemo(() => menuDaLoja(store), [store]);
  const [focado, setFocado] = useState(false);
  const nome = String(store?.site?.name || "");
  const listaAberta = desktop && (focado || camadas.aberta === "busca") && !!camadas.termo.trim();

  return (
    <View
      testID="cabecalho-da-vitrine"
      style={[
        {
          backgroundColor: Platform.OS === "web" ? wash(t.bg, 0.94) : t.bg,
          borderBottomWidth: 1, borderBottomColor: t.border, zIndex: 20,
        },
        Platform.OS === "web" ? ({ backdropFilter: "saturate(1.3) blur(10px)", WebkitBackdropFilter: "saturate(1.3) blur(10px)" } as any) : null,
        rolou && Platform.OS === "web" ? ({ boxShadow: "0 10px 24px -18px rgba(26,23,20,.45)" } as any) : null,
        transicao("box-shadow"),
      ]}
    >
      {desktop ? (
        <View style={{ width: "100%", maxWidth: 1180, alignSelf: "center", height: 76, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 24, zIndex: 2 }}>
          <MarcaDaLoja sf={sf} tamanho={28} />
          <View style={{ flex: 1, maxWidth: 520, marginHorizontal: "auto" as any, zIndex: 3 }}>
            <View
              style={[
                { flexDirection: "row", alignItems: "center", gap: 10, height: 46, borderRadius: 999, borderWidth: 1, paddingLeft: 16, paddingRight: 6, backgroundColor: t.bg2, borderColor: focado ? t.marcaTexto : borda2(t) },
                focado && Platform.OS === "web" ? ({ boxShadow: `0 0 0 3px ${wash(t.marca, 0.14)}` } as any) : null,
              ]}
            >
              <Icon name="search" size={16} color={t.ink3} />
              <TextInput
                value={camadas.termo}
                onChangeText={camadas.setTermo}
                onFocus={() => setFocado(true)}
                onBlur={() => setTimeout(() => setFocado(false), 180)}
                placeholder={`Buscar na ${nome}`}
                placeholderTextColor={t.ink3}
                accessibilityLabel="Buscar produtos"
                style={[{ flex: 1, minWidth: 0, height: "100%", fontSize: 15, color: t.ink }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]}
              />
              {camadas.termo ? (
                <BotaoIcone icone="x" rotulo="Limpar a busca" tamanho={36} cor={t.ink3} onPress={() => camadas.setTermo("")} />
              ) : null}
            </View>
            {listaAberta ? (
              <View
                testID="busca-suspensa"
                style={[{ position: "absolute", left: 0, right: 0, top: 54, maxHeight: 520, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg2, paddingVertical: 8, zIndex: 40 }, sombraWeb(3)]}
              >
                <ScrollView style={{ maxHeight: 504 }} keyboardShouldPersistTaps="handled">
                  <ResultadosDaBusca sf={sf} termo={camadas.termo} onTermo={camadas.setTermo} onFechar={() => { setFocado(false); camadas.setTermo(""); camadas.fechar(); }} onVerLoja={onVerLoja} />
                </ScrollView>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Pressable
              onPress={() => sf.goTo("lote")}
              accessibilityRole="button"
              style={({ hovered }: any) => ({ height: 44, paddingHorizontal: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: hovered ? t.bg3 : "transparent" })}
            >
              <Icon name="users" size={16} color={t.ink2} />
              <Texto style={{ fontSize: 14, fontWeight: "500", color: t.ink2 }}>Orçamento em lote</Texto>
            </Pressable>
            <Sacola sf={sf} />
          </View>
        </View>
      ) : (
        <View style={{ height: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 2 }}>
          <BotaoIcone icone="menu" rotulo="Abrir o menu" onPress={camadas.abrirGaveta} testID="abrir-menu" />
          <View style={{ flex: 1, paddingLeft: 2 }}>
            <MarcaDaLoja sf={sf} tamanho={22} />
          </View>
          <BotaoIcone icone="search" rotulo="Buscar na loja" onPress={() => camadas.abrirBusca()} testID="abrir-busca" />
          <Sacola sf={sf} />
        </View>
      )}
      <BarraDeCategorias sf={sf} itens={itens} desktop={desktop} ativa={categoriaAtiva} />
    </View>
  );
}

// ── Resultados da busca (lista suspensa e camada cheia) ──────

function Miniatura({ produto }: { produto: StudioStoreProduct }) {
  const t = useTemaDaVitrine();
  return (
    <View style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", backgroundColor: t.bg3, borderWidth: 1, borderColor: t.border, alignItems: "center", justifyContent: "center" }}>
      {produto.image_url ? (
        <Image source={{ uri: produto.image_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Icon name="image" size={18} color={t.ink4} />
      )}
    </View>
  );
}

function NomeDestacado({ nome, termo }: { nome: string; termo: string }) {
  const t = useTemaDaVitrine();
  return (
    <Texto numberOfLines={1} style={{ fontSize: 14.5, color: t.ink }}>
      {trechosDestacados(nome, termo).map((p, i) => (
        p.marcado ? (
          <Texto
            key={i}
            style={[{ fontWeight: "700", color: t.ink }, Platform.OS === "web" ? ({ textDecorationLine: "underline", textDecorationColor: wash(t.marca, 0.45), textDecorationThickness: 2, textUnderlineOffset: 3 } as any) : { textDecorationLine: "underline" }]}
          >
            {p.texto}
          </Texto>
        ) : p.texto
      ))}
    </Texto>
  );
}

function Linha({ onPress, rotulo, children }: { onPress: () => void; rotulo: string; children: ReactNode }) {
  const t = useTemaDaVitrine();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ hovered, focused }: any) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8, minHeight: 56, backgroundColor: hovered || focused ? t.bg3 : "transparent" })}
    >
      {children}
    </Pressable>
  );
}

export function ResultadosDaBusca({
  sf, termo, onTermo, onFechar, onVerLoja,
}: {
  sf: StorefrontState;
  termo: string;
  onTermo: (t: string) => void;
  onFechar: () => void;
  onVerLoja?: () => void;
}) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  const store: any = sf.store;
  const q = termo.trim();
  const r = useMemo(() => buscarNaVitrine(q, store), [q, store]);
  const sugestoes = useMemo(() => sugestoesDeBusca(store), [store]);
  const nome = String(store?.site?.name || "");

  if (!q) {
    if (!sugestoes.length) return null;
    return (
      <View style={{ paddingBottom: 8 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}><Rotulo>Mais procurados na loja</Rotulo></View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 }}>
          {sugestoes.map((s) => (
            <Pressable
              key={s}
              onPress={() => onTermo(s)}
              accessibilityRole="button"
              style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: borda2(t), backgroundColor: t.bg2, justifyContent: "center" }}
            >
              <Texto style={{ fontSize: 13.5, color: t.ink }}>{s}</Texto>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (!r.pecas.length && !r.categorias.length) {
    const zap = linkDoWhatsApp(store?.site?.whatsapp, mensagemDaBuscaVazia(q, nome));
    return (
      <View testID="busca-nada-encontrado" style={{ paddingVertical: 36, paddingHorizontal: 24, alignItems: "center", gap: 10 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.bg3, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
          <Icon name="search" size={22} color={t.ink3} />
        </View>
        <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 21, lineHeight: 26, color: t.ink, textAlign: "center" }}>
          Nada encontrado para “{q}”
        </Texto>
        <Texto style={{ fontSize: 14, lineHeight: 21, color: t.ink2, textAlign: "center", maxWidth: 300 }}>
          {nome ? `A ${nome} faz sob encomenda.` : "A loja faz sob encomenda."} Se não está na loja, pergunte: muitas vezes dá para fazer.
        </Texto>
        <View style={{ width: "100%", maxWidth: 300, gap: 8, marginTop: 10 }}>
          <Pressable
            onPress={() => { onFechar(); if (onVerLoja) onVerLoja(); else sf.goTo("list"); }}
            accessibilityRole="button"
            style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: borda2(t), backgroundColor: t.bg2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Icon name="grid" size={16} color={t.ink} />
            <Texto style={{ fontSize: 15, fontWeight: "600", color: t.ink }}>Ver a loja toda</Texto>
          </Pressable>
          {zap ? (
            <Pressable
              onPress={() => Linking.openURL(zap)}
              accessibilityRole="link"
              style={{ minHeight: 48, borderRadius: 12, backgroundColor: t.marcaFill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Icon name="whatsapp" size={16} color={t.sobreMarca} />
              <Texto style={{ fontSize: 15, fontWeight: "600", color: t.sobreMarca }}>Pedir pelo WhatsApp</Texto>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View testID="resultados-da-busca" style={{ paddingBottom: 12 }}>
      {r.categorias.length ? (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}><Rotulo>Categoria</Rotulo></View>
          {r.categorias.map((c) => (
            <Linha key={c.categoria.id} rotulo={`${c.categoria.name}, ${c.casam} de ${c.total} modelos`} onPress={() => { onFechar(); abrirCategoria(sf, c.categoria); }}>
              <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: t.marcaWashForte, alignItems: "center", justifyContent: "center" }}>
                <Icon name="grid" size={18} color={t.marcaTexto} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Texto numberOfLines={1} style={{ fontSize: 14.5, color: t.ink }}>{c.categoria.name}</Texto>
                <Texto style={{ fontSize: 12.5, color: t.ink3 }}>{c.casam ? `${c.casam} de ${c.total} modelos` : `${c.total} modelos`}</Texto>
              </View>
              <Icon name="chevron_right" size={18} color={t.ink3} />
            </Linha>
          ))}
        </>
      ) : null}
      {r.pecas.length ? (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Rotulo>Peças</Rotulo>
            <Numero style={{ fontSize: 12, color: t.ink3 }}>{r.pecas.length} {r.pecas.length === 1 ? "peça" : "peças"}</Numero>
          </View>
          {r.pecas.map(({ produto, noNome, categoria }) => (
            <Linha key={produto.id} rotulo={`${produto.name}, ${dinheiro(Number(produto.price))}`} onPress={() => { onFechar(); sf.openConfigure(produto); }}>
              <Miniatura produto={produto} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <NomeDestacado nome={produto.name} termo={q} />
                <Texto numberOfLines={2} style={{ fontSize: 12.5, color: t.ink3 }}>
                  {noNome ? categoria || " " : `Na descrição: ${String(produto.description || "").trim().slice(0, 60)}`}
                </Texto>
              </View>
              <Numero style={{ fontSize: 13.5, fontWeight: "600", color: t.ink }}>{dinheiro(Number(produto.price))}</Numero>
            </Linha>
          ))}
        </>
      ) : null}
    </View>
  );
}

// ── As camadas do celular: gaveta e busca ────────────────────

/** O glifo do Instagram (o conjunto de ícones do app não tem). */
export function GlifoInstagram({ cor, tamanho = 16 }: { cor: string; tamanho?: number }) {
  const lado = tamanho * 0.86;
  return (
    <View style={{ width: tamanho, height: tamanho, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: lado, height: lado, borderRadius: lado * 0.3, borderWidth: 1.6, borderColor: cor, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: lado * 0.44, height: lado * 0.44, borderRadius: lado, borderWidth: 1.6, borderColor: cor }} />
      </View>
    </View>
  );
}

function LinhaDaGaveta({
  rotulo, onPress, total, icone, sub, destaque, expandida, testID,
}: {
  rotulo: string;
  onPress: () => void;
  total?: number;
  icone?: ReactNode;
  sub?: boolean;
  destaque?: boolean;
  expandida?: boolean;
  testID?: string;
}) {
  const t = useTemaDaVitrine();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={expandida === undefined ? undefined : { expanded: expandida }}
      style={({ hovered }: any) => ({
        minHeight: sub ? 46 : 50, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12,
        borderRadius: sub ? 0 : 12, borderTopRightRadius: 12, borderBottomRightRadius: 12,
        borderLeftWidth: sub ? 1 : 0, borderLeftColor: t.border,
        backgroundColor: hovered ? t.bg3 : "transparent",
      })}
    >
      {icone}
      <Texto style={{ flex: 1, fontSize: sub ? 15 : 16, fontWeight: destaque ? "600" : sub ? "400" : expandida ? "600" : "500", color: destaque ? t.marcaTexto : sub ? t.ink2 : t.ink }}>
        {rotulo}
      </Texto>
      {typeof total === "number" ? <Numero style={{ fontSize: 12, color: t.ink3 }}>{total}</Numero> : null}
      {expandida !== undefined ? (
        <View style={[{ transform: [{ rotate: expandida ? "180deg" : "0deg" }] }, transicao("transform")]}>
          <Icon name="chevron_down" size={16} color={t.ink3} />
        </View>
      ) : null}
    </Pressable>
  );
}

function Gaveta({ sf, camadas }: { sf: StorefrontState; camadas: CamadasDaVitrine }) {
  const t = useTemaDaVitrine();
  const reduzir = useReduzirMovimento();
  const store: any = sf.store;
  const itens = useMemo(() => menuDaLoja(store), [store]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [entrou, setEntrou] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setEntrou(true), 10);
    return () => clearTimeout(id);
  }, []);
  const site = store?.site || {};
  const zap = linkDoWhatsApp(site.whatsapp, `Olá! Vim pela loja ${site.name || ""} e queria tirar uma dúvida.`.replace("  ", " "));
  const insta = (site.redes || []).find((r: any) => r?.rede === "instagram");
  const ir = (f: () => void) => () => { camadas.fechar(); f(); };
  const mostrar = entrou || reduzir;

  return (
    <View testID="gaveta-do-menu" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 85 }}>
      <Pressable
        onPress={camadas.fechar}
        accessibilityRole="button"
        accessibilityLabel="Fechar o menu"
        style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(20,17,14,.42)", opacity: mostrar ? 1 : 0 }, reduzir ? null : transicao("opacity")]}
      />
      <View
        accessibilityViewIsModal
        accessibilityLabel="Menu da loja"
        style={[
          { position: "absolute", top: 0, bottom: 0, left: 0, width: "88%", maxWidth: 380, backgroundColor: t.bg, transform: [{ translateX: mostrar ? 0 : -400 }] },
          sombraWeb(3), reduzir ? null : transicao("transform", 260),
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 20, paddingRight: 8, minHeight: 60, borderBottomWidth: 1, borderBottomColor: t.border }}>
          <MarcaDaLoja sf={sf} tamanho={21} onPress={ir(() => sf.goTo("list"))} />
          <BotaoIcone icone="x" rotulo="Fechar o menu" onPress={camadas.fechar} />
        </View>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <Pressable
            onPress={() => camadas.abrirBusca()}
            accessibilityRole="search"
            accessibilityLabel="Buscar na loja"
            style={{ marginHorizontal: 16, marginTop: 14, marginBottom: 6, height: 46, borderRadius: 999, borderWidth: 1, borderColor: borda2(t), backgroundColor: t.bg2, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 }}
          >
            <Icon name="search" size={16} color={t.ink3} />
            <Texto style={{ fontSize: 15, color: t.ink3 }}>Buscar na loja</Texto>
          </Pressable>
          <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <LinhaDaGaveta rotulo="Início" onPress={ir(() => sf.goTo("list"))} />
            {itens.map((i) => {
              if (!i.filhas.length) {
                return <LinhaDaGaveta key={i.categoria.id} rotulo={i.categoria.name} total={i.total} onPress={ir(() => abrirCategoria(sf, i.categoria))} />;
              }
              const exp = aberta === i.categoria.id;
              return (
                <View key={i.categoria.id}>
                  <LinhaDaGaveta rotulo={i.categoria.name} total={i.total} expandida={exp} onPress={() => setAberta(exp ? null : i.categoria.id)} />
                  {exp ? (
                    <View style={{ paddingLeft: 12, marginBottom: 6 }}>
                      {i.filhas.map((f) => (
                        <LinhaDaGaveta key={f.categoria.id} sub rotulo={f.categoria.name} total={f.total} onPress={ir(() => abrirCategoria(sf, f.categoria))} />
                      ))}
                      <LinhaDaGaveta sub destaque rotulo={`Ver todas as ${i.categoria.name.toLowerCase()}`} onPress={ir(() => abrirCategoria(sf, i.categoria))} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
          <View style={{ height: 1, backgroundColor: t.border, marginHorizontal: 20, marginVertical: 8 }} />
          <View style={{ paddingHorizontal: 8, paddingBottom: 6 }}>
            <LinhaDaGaveta rotulo="Orçamento em lote" icone={<Icon name="users" size={16} color={t.ink3} />} onPress={ir(() => sf.goTo("lote"))} />
            {zap ? <LinhaDaGaveta rotulo="Falar no WhatsApp" icone={<Icon name="whatsapp" size={16} color={t.ink3} />} onPress={() => Linking.openURL(zap)} /> : null}
          </View>
          {site.endereco || site.horario_resumo || insta ? (
            <View style={{ marginTop: "auto" as any, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26, gap: 8, borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.bg3 }}>
              {site.endereco ? (
                <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                  <Icon name="location" size={15} color={t.ink3} />
                  <Texto style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: t.ink3 }}>{site.endereco}</Texto>
                </View>
              ) : null}
              {site.horario_resumo ? (
                <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                  <Icon name="clock" size={15} color={t.ink3} />
                  <Texto style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: t.ink3 }}>{site.horario_resumo}</Texto>
                </View>
              ) : null}
              {insta ? (
                <Pressable onPress={() => Linking.openURL(insta.url)} accessibilityRole="link" style={{ flexDirection: "row", gap: 8, alignItems: "center", minHeight: 32 }}>
                  <GlifoInstagram cor={t.ink3} tamanho={15} />
                  <Texto style={{ fontSize: 12.5, color: t.ink3 }}>@{insta.handle}</Texto>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function BuscaCheia({ sf, camadas, onVerLoja }: { sf: StorefrontState; camadas: CamadasDaVitrine; onVerLoja?: () => void }) {
  const t = useTemaDaVitrine();
  return (
    <View testID="busca-da-vitrine" accessibilityViewIsModal style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 86, backgroundColor: t.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 4, paddingRight: 12, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
        <BotaoIcone icone="chevron_left" rotulo="Fechar a busca" onPress={camadas.fechar} />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, height: 46, borderRadius: 999, borderWidth: 1, borderColor: t.marcaTexto, backgroundColor: t.bg2, paddingLeft: 16, paddingRight: 4 }}>
          <Icon name="search" size={16} color={t.ink3} />
          <TextInput
            autoFocus
            value={camadas.termo}
            onChangeText={camadas.setTermo}
            placeholder="Buscar na loja"
            placeholderTextColor={t.ink3}
            accessibilityLabel="Buscar produtos"
            returnKeyType="search"
            style={[{ flex: 1, minWidth: 0, height: "100%", fontSize: 15, color: t.ink }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]}
          />
          {camadas.termo ? <BotaoIcone icone="x" rotulo="Limpar a busca" tamanho={38} cor={t.ink3} onPress={() => camadas.setTermo("")} /> : null}
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <ResultadosDaBusca sf={sf} termo={camadas.termo} onTermo={camadas.setTermo} onFechar={() => { camadas.fechar(); camadas.setTermo(""); }} onVerLoja={onVerLoja} />
      </ScrollView>
    </View>
  );
}

/** As camadas abertas por cima da página (só no celular; no desktop a busca cai do campo). */
export function CamadasDaNavegacao({
  sf, camadas, desktop, onVerLoja,
}: {
  sf: StorefrontState;
  camadas: CamadasDaVitrine;
  desktop: boolean;
  onVerLoja?: () => void;
}) {
  if (desktop || !camadas.aberta) return null;
  return camadas.aberta === "gaveta" ? <Gaveta sf={sf} camadas={camadas} /> : <BuscaCheia sf={sf} camadas={camadas} onVerLoja={onVerLoja} />;
}
