// ============================================================
// components/studio/storefront/ProductList.tsx
// Stage="list": hero da loja + grid de produtos + CartBar.
// ============================================================
import { useMemo, useState } from "react";
import { View, Pressable, ScrollView, Platform, Image, TextInput, useWindowDimensions , Linking } from "react-native";
import type { StorefrontState } from "./useStorefront";
import { usePaletaDaVitrine } from "./TemaDaVitrine";
import { Fonts } from "@/constants/fonts";
import { ProductCard } from "./ProductCard";
import { fotosDoProduto, fotosDoGrupo } from "./CarrosselFoto";
import { casa } from "./buscaVitrine";
import { CartBar } from "./Cart";
import { precoMinimo } from "./categoryGrouping";
import { StoreNav } from "./StoreNav";
import { montarMenu, cabemNaBarra, type ItemMenu } from "./storeNavModel";
import { wash } from "./theme";

import { AncoraWhatsApp } from "./AncoraWhatsApp";
import { RodapeDaVitrine } from "./RodapeDaVitrine";
import { montarBlocosDaHome } from "./blocosDaHome";
import { seloDoProduto, chipsDoProduto, linhaDeEscada, pecaMaisPedida } from "./selosDoProduto";
import {
  FaixaDeAvisos, Hero, ComoFunciona, TiraDeCategorias,
  MaisPedidos, ArtesProntas, BlocoB2B, FaixaDeConfianca,
} from "./HomeDaVitrine";
import { ORDENS, ordenarEntradas, mostrarControles, colunasComDensidade, type OrdemVitrine } from "./ordenacaoVitrine";
import { Texto, useTipografia } from "./TipografiaVitrine";
export function ProductList({ sf }: { sf: StorefrontState }) {
  const T = usePaletaDaVitrine();
  if (!sf.store) return null;
  const { store } = sf;
  const accent = store.site.accent_color || T.accent;
  const primary = store.site.primary_color || T.primary;

  // ── Navegação por categoria ───────────────────────────────
  // A vitrine não tinha nenhuma: o cliente rolava a lista inteira ou
  // desistia. Com 3 categorias isso passa; com as 28 da Finesse, não.
  const { width } = useWindowDimensions();
  const [ativa, setAtiva] = useState<ItemMenu | null>(null);
  const [busca, setBusca] = useState("");
  // Ordem e densidade so aparecem em loja grande — ver LIMIAR_CONTROLES.
  const [ordem, setOrdem] = useState<OrdemVitrine>("destaque");
  const [denso, setDenso] = useState(false);

  // ── Grade ─────────────────────────────────────────────────
  // A foto e o que vende. Antes era miniatura de 72px numa lista de
  // linhas — menor que o proprio botao. Agora ocupa a largura do cartao.
  // Par tipografico da loja. A escolha ja existia no painel e so a loja
  // comum consumia; aqui a vitrine Studio passa a respeitar.
  // A tipografia vem do contexto: o provider ja resolveu a chave da
  // lojista no par do Studio. Chamar o resolvedor da loja comum aqui
  // era a fonte da vitrine divergindo da fonte do resto dela.
  const tipo = useTipografia();

  const GAP = 14;
  const LARGURA_MAX = 980;
  const telaLarga = width >= 720;
  // O minimal existe pra caber mais produto na tela — entao ele ganha
  // uma coluna a mais, senao seria so um cartao menor com o mesmo vazio
  // em volta.
  const estiloCartao = (((store.site as any).card_style || "editorial") as
    "editorial" | "minimal" | "image-heavy");
  const base = width < 560 ? 2 : width < 900 ? 3 : 4;
  const colunas = colunasComDensidade(estiloCartao === "minimal" ? base + 1 : base, denso);
  const larguraUtil = Math.min(width, LARGURA_MAX) - 28; // padding do scroll
  const larguraCartao = Math.floor((larguraUtil - GAP * (colunas - 1)) / colunas);

  // Os blocos da home: QUEM aparece e decisao de blocosDaHome.ts.
  const blocos = useMemo(() => montarBlocosDaHome(store), [store]);
  // A campea da loja e uma so: o selo "Mais pedido" nao pode aparecer
  // em quatro cartoes ao mesmo tempo.
  const campea = useMemo(() => pecaMaisPedida(store.products), [store.products]);

  const menu = useMemo(
    () => montarMenu(store.categories, store.products, cabemNaBarra(width)),
    [store.categories, store.products, width],
  );

  // Filtra as ENTRADAS já agrupadas, não os produtos crus: assim o cartão
  // "Canecas · 8 modelos" continua sendo um cartão só dentro do filtro.
  const entradas = useMemo(() => {
    let lista = sf.vitrine;

    if (ativa) {
      const ids = new Set<string>();
      const empilhar = (i: ItemMenu) => { ids.add(i.id); i.filhas.forEach(empilhar); };
      empilhar(ativa);
      lista = lista.filter((e) =>
        e.kind === "category"
          ? ids.has(e.category.id)
          : !!(e.product as any).category_id && ids.has((e.product as any).category_id),
      );
    }

    if (busca.trim()) {
      lista = lista.filter((e) =>
        e.kind === "category"
          // Um grupo aparece se o NOME dele casa ou se algum modelo casa —
          // procurar "polo" tem que achar a polo mesmo que ela esteja
          // dentro do cartao "Camisetas".
          ? casa(busca, e.category.name) ||
            e.products.some((p) => casa(busca, p.name, p.description))
          : casa(busca, e.product.name, e.product.description),
      );
    }

    // Ordena por ultimo: filtrar depois de ordenar daria o mesmo
    // resultado, mas ordenar a lista inteira pra descartar 90% e trabalho
    // jogado fora em loja de 500 itens.
    return ordenarEntradas(
      lista.map((e) => ({
        ...e,
        // Grupo usa o MENOR preco e a data do modelo mais recente: senao o
        // cartao "Camisetas · 3 modelos" afundaria em "Menor preço" so
        // porque o primeiro modelo dele e caro.
        nome: e.kind === "category" ? e.category.name : e.product.name,
        preco: e.kind === "category" ? precoMinimo(e.products) : Number(e.product.price),
        criadoEm: e.kind === "category"
          ? e.products.map((p: any) => p.created_at).sort().reverse()[0]
          : (e.product as any).created_at,
      })),
      ordem,
    ) as typeof lista;
  }, [sf.vitrine, ativa, busca, ordem]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* A home inteira rola. Antes so a grade rolava e o hero ficava
          preso no topo — com um hero editorial e sete blocos abaixo, isso
          deixaria metade da pagina inalcancavel no celular.
          A barra de busca e categorias fica grudenta (indice 3): e o
          controle que a pessoa procura quando ja esta no meio da grade. */}
      <ScrollView
        style={{ flex: 1 }}
        stickyHeaderIndices={[3]}
        contentContainerStyle={{ paddingBottom: sf.cart.length > 0 ? 150 : 60 }}
      >
        <FaixaDeAvisos avisos={blocos.avisos} />

        <Hero
          hero={blocos.hero}
          sla={store.sla.total_estimate_days}
          totalProdutos={store.products.length}
        />

        <ComoFunciona passos={blocos.comoFunciona} />

      {/* Busca — a vitrine nao tinha nenhuma. Com 3 produtos da pra rolar;
          com 30, ou com os 74 da Sheid, nao da. */}
      <View style={{ backgroundColor: T.card, paddingHorizontal: telaLarga ? 20 : 14, paddingTop: 12 }}>
        <View style={{ width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar na loja..."
            placeholderTextColor={T.ink4}
            accessibilityLabel="Buscar produtos na loja"
            style={{
              flex: 1, backgroundColor: T.bg, color: T.ink,
              paddingHorizontal: 14, paddingVertical: 10,
              borderRadius: 999, fontSize: 13.5,
              borderWidth: 1, borderColor: T.border,
            }}
          />
          {busca ? (
            <Pressable
              onPress={() => setBusca("")}
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
              style={{ paddingHorizontal: 12, paddingVertical: 9 }}
            >
              <Texto style={{ fontSize: 12.5, color: T.ink3, fontWeight: "700" }}>Limpar</Texto>
            </Pressable>
          ) : null}
        </View>
      </View>

      <StoreNav menu={menu} ativa={ativa} onSelect={setAtiva} primary={primary} />

      {/* Grade de produtos */}
      <View
        style={{
          padding: 14, gap: 10,
          width: "100%", maxWidth: 980, alignSelf: "center",
        }}
      >
        {/* Barra de controle — so em loja grande. Numa vitrine de 9 itens
            ela e mais alta que a propria vitrine, entao nao existe. */}
        {mostrarControles(entradas.length) ? (
          <View
            style={{
              flexDirection: "row", alignItems: "center", flexWrap: "wrap",
              gap: 8, paddingBottom: 4,
            }}
          >
            <Texto style={{ fontSize: 12, color: T.ink3, marginRight: "auto" }}>
              {entradas.length} itens
            </Texto>

            {ORDENS.map((o) => {
              const sel = o.chave === ordem;
              return (
                <Pressable
                  key={o.chave}
                  onPress={() => setOrdem(o.chave)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  style={{
                    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
                    borderWidth: 1,
                    borderColor: sel ? primary : T.border,
                    backgroundColor: sel ? wash(primary, 0.12) : "transparent",
                  }}
                >
                  <Texto style={{ fontSize: 12, fontWeight: sel ? "800" : "600", color: sel ? primary : T.ink2 }}>
                    {o.rotulo}
                  </Texto>
                </Pressable>
              );
            })}

            {/* Densidade so faz sentido onde cabe mais uma coluna. */}
            {telaLarga ? (
              <Pressable
                onPress={() => setDenso((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={denso ? "Ver cartões maiores" : "Ver mais produtos por linha"}
                style={{
                  paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
                  borderWidth: 1, borderColor: denso ? primary : T.border,
                  backgroundColor: denso ? wash(primary, 0.12) : "transparent",
                }}
              >
                <Texto style={{ fontSize: 12, fontWeight: "700", color: denso ? primary : T.ink2 }}>
                  {denso ? "Cartões maiores" : "Mais por linha"}
                </Texto>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {store.products.length === 0 ? (
          <View style={{ padding: 32, alignItems: "center" }}>
            <Texto style={{ fontSize: 36 }}>🎨</Texto>
            <Texto style={{ color: T.ink, fontWeight: "700", marginTop: 12, textAlign: "center" }}>
              Esta loja ainda não tem produtos personalizáveis publicados.
            </Texto>
            <Texto style={{ color: T.ink3, fontSize: 12, marginTop: 6, textAlign: "center" }}>
              Volte em breve!
            </Texto>
          </View>
        ) : (
          // S1 — a vitrine itera ENTRADAS, não produtos: categoria com 2+
          // modelos vira um cartão só. As 9 canecas da Sheid deixam de
          // ocupar 9 linhas quase idênticas.
          entradas.length === 0 ? (
            // Busca ou filtro sem resultado: em vez de uma grade em branco,
            // diz o que aconteceu e devolve o caminho de volta.
            <View style={{ paddingVertical: 48, alignItems: "center", gap: 10 }}>
              <Texto style={{ fontFamily: tipo.display, fontSize: 20, color: T.ink, textAlign: "center" }}>
                Nada encontrado por aqui
              </Texto>
              <Texto style={{ fontSize: 13, color: T.ink3, textAlign: "center", maxWidth: 320 }}>
                {busca.trim()
                  ? `Nenhum produto com "${busca.trim()}"${ativa ? ` em ${ativa.name}` : ""}.`
                  : "Esta categoria ainda não tem produtos publicados."}
              </Texto>
              <Pressable
                onPress={() => { setBusca(""); setAtiva(null); }}
                accessibilityRole="button"
                style={{
                  marginTop: 4, paddingHorizontal: 16, paddingVertical: 9,
                  borderRadius: 999, backgroundColor: primary,
                }}
              >
                <Texto style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Ver a loja toda</Texto>
              </Pressable>
            </View>
          ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
            {entradas.map((entry) => {
              // Categoria com 2+ modelos vira UM cartao — as 9 canecas da
              // Sheid nao ocupam 9 posicoes quase identicas na grade.
              if (entry.kind === "category") {
                const { category, products } = entry;
                return (
                  <ProductCard
                    key={"cat-" + category.id}
                    nome={category.name}
                    preco={precoMinimo(products)}
                    fotos={fotosDoGrupo(products)}
                    selo={`${products.length} modelos para escolher`}
                    largura={larguraCartao}
                    corDaLoja={primary}
                    fonteDisplay={tipo.display}
                    estilo={estiloCartao}
                    onPress={() => sf.openConfigure(products[0], products)}
                  />
                );
              }
              const p = entry.product;
              return (
                <ProductCard
                  key={p.id}
                  nome={p.name}
                  preco={Number(p.price)}
                  fotos={fotosDoProduto((p as any).gallery_urls, p.image_url)}
                  descricao={p.description}
                  largura={larguraCartao}
                  corDaLoja={primary}
                  fonteDisplay={tipo.display}
                  estilo={estiloCartao}
                  destaque={seloDoProduto(p, campea)}
                  chips={chipsDoProduto(p)}
                  escada={linhaDeEscada(p)}
                  onPress={() => sf.openConfigure(p)}
                />
              );
            })}
          </View>
          )
        )}

        {/* Como pagar e o que acontece se a peca nao servir. Vem DENTRO
            do scroll, depois dos produtos: e o fim da leitura, nao uma
            barra fixa competindo com o carrinho. O conteudo chega pronto
            do backend — ver o comentario do componente. */}
      </View>

        {/* Os blocos de baixo. Cada um devolve null quando a loja nao tem
            o que mostrar — ver blocosDaHome.ts. */}
        <TiraDeCategorias
          categorias={blocos.categorias}
          onEscolher={(slug) => {
            const item = menu.itens.find((i) => i.slug === slug);
            if (item) setAtiva(item);
          }}
        />

        <MaisPedidos
          produtos={blocos.maisPedidos}
          nomeDaLoja={store.site.name}
          onAbrir={(p) => sf.openConfigure(p)}
        />

        <ArtesProntas artes={blocos.artes} />

        {/* S6 — o bloco B2B abre o assistente publico. Ate a S5 ele
            levava ao WhatsApp, que era o caminho real enquanto o
            assistente nao existia. */}
        {blocos.mostrarB2B ? (
          <BlocoB2B onAbrir={() => sf.goTo("lote")} />
        ) : null}

        <FaixaDeConfianca numeros={blocos.confianca} />

        {/* O rodape de tres colunas engloba o institucional: quem e a
            loja, como ela atende, por onde navegar — e a assinatura. */}
        <RodapeDaVitrine
          store={store}
          onAbrirCategoria={(porta) => {
            const item = menu.itens.find((i) => i.slug === porta.slug);
            if (item) setAtiva(item);
          }}
        />
      </ScrollView>

      <AncoraWhatsApp
        numero={(store.site as any).whatsapp}
        nomeDaLoja={store.site.name}
        corDaLoja={primary}
        acimaDaBarra={sf.cart.length > 0}
      />
      <CartBar sf={sf} accent={accent} />
      {/* Sem a barra flutuante "Powered by Aura" nesta tela: o rodape
          assina a loja com a mesma frase, uma vez so, e no lugar onde
          se procura por isso. A barra tampava o fim da pagina. */}
    </View>
  );
}
