// ============================================================
// components/studio/storefront/ProductList.tsx
// Stage="list": hero da loja + grid de produtos + CartBar.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Platform, Image, useWindowDimensions } from "react-native";
import type { StorefrontState } from "./useStorefront";
import { T } from "./types";
import { ProductCard } from "./ProductCard";
import { fotosDoProduto, fotosDoGrupo } from "./CarrosselFoto";
import { CartBar } from "./Cart";
import { PoweredByAura } from "./ui/PoweredByAura";
import { precoMinimo } from "./categoryGrouping";
import { StoreNav } from "./StoreNav";
import { montarMenu, cabemNaBarra, type ItemMenu } from "./storeNavModel";

export function ProductList({ sf }: { sf: StorefrontState }) {
  if (!sf.store) return null;
  const { store } = sf;
  const accent = store.site.accent_color || T.accent;
  const primary = store.site.primary_color || T.primary;

  // ── Navegação por categoria ───────────────────────────────
  // A vitrine não tinha nenhuma: o cliente rolava a lista inteira ou
  // desistia. Com 3 categorias isso passa; com as 28 da Finesse, não.
  const { width } = useWindowDimensions();
  const [ativa, setAtiva] = useState<ItemMenu | null>(null);

  // ── Grade ─────────────────────────────────────────────────
  // A foto e o que vende. Antes era miniatura de 72px numa lista de
  // linhas — menor que o proprio botao. Agora ocupa a largura do cartao.
  const GAP = 14;
  const LARGURA_MAX = 980;
  const colunas = width < 560 ? 2 : width < 900 ? 3 : 4;
  const larguraUtil = Math.min(width, LARGURA_MAX) - 28; // padding do scroll
  const larguraCartao = Math.floor((larguraUtil - GAP * (colunas - 1)) / colunas);

  const menu = useMemo(
    () => montarMenu(store.categories, store.products, cabemNaBarra(width)),
    [store.categories, store.products, width],
  );

  // Filtra as ENTRADAS já agrupadas, não os produtos crus: assim o cartão
  // "Canecas · 8 modelos" continua sendo um cartão só dentro do filtro.
  const entradas = useMemo(() => {
    if (!ativa) return sf.vitrine;
    const ids = new Set<string>();
    const empilhar = (i: ItemMenu) => { ids.add(i.id); i.filhas.forEach(empilhar); };
    empilhar(ativa);
    return sf.vitrine.filter((e) =>
      e.kind === "category"
        ? ids.has(e.category.id)
        : !!(e.product as any).category_id && ids.has((e.product as any).category_id),
    );
  }, [sf.vitrine, ativa]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Hero */}
      <View
        style={[
          { padding: 24, paddingBottom: 28, backgroundColor: primary },
          Platform.OS === "web"
            ? (store.site.cover_url
                ? ({
                    // cover do lojista com overlay do gradiente da marca por cima
                    // (legibilidade do texto branco). Visual final no DESIGN-32.
                    backgroundImage:
                      "linear-gradient(135deg, " + primary + "E6, " + accent + "CC), url(" +
                      store.site.cover_url + ")",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  } as any)
                : ({ background: "linear-gradient(135deg, " + primary + ", " + accent + ")" } as any))
            : {},
        ]}
      >
        {store.site.logo_url ? (
          <Image
            source={{ uri: store.site.logo_url }}
            style={{
              width: 56, height: 56, borderRadius: 12, marginBottom: 10,
              backgroundColor: "rgba(255,255,255,0.15)",
            }}
            resizeMode="contain"
            accessibilityLabel={store.site.name}
          />
        ) : null}
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Aura Studio · Personalizados
        </Text>
        <View
          style={{
            alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5,
            backgroundColor: "rgba(255,255,255,0.18)",
            paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: 999, marginTop: 8,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10 }}>●</Text>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" }}>
            Loja oficial · Arte personalizada
          </Text>
        </View>
        <Text style={{ color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 10, letterSpacing: -0.5 }}>
          {store.site.name}
        </Text>
        {store.site.tagline ? (
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 6 }}>{store.site.tagline}</Text>
        ) : null}
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 10 }}>
          Prazo de produção: ~{store.sla.total_estimate_days}{" "}
          {store.sla.total_estimate_days === 1 ? "dia útil" : "dias úteis"}
        </Text>
      </View>

      <StoreNav menu={menu} ativa={ativa} onSelect={setAtiva} primary={primary} />

      {/* Grade de produtos */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 14, gap: 10, paddingBottom: sf.cart.length > 0 ? 150 : 60,
          width: "100%", maxWidth: 980, alignSelf: "center",
        }}
      >
        {store.products.length === 0 ? (
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 36 }}>🎨</Text>
            <Text style={{ color: T.ink, fontWeight: "700", marginTop: 12, textAlign: "center" }}>
              Esta loja ainda não tem produtos personalizáveis publicados.
            </Text>
            <Text style={{ color: T.ink3, fontSize: 12, marginTop: 6, textAlign: "center" }}>
              Volte em breve!
            </Text>
          </View>
        ) : (
          // S1 — a vitrine itera ENTRADAS, não produtos: categoria com 2+
          // modelos vira um cartão só. As 9 canecas da Sheid deixam de
          // ocupar 9 linhas quase idênticas.
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
                  onPress={() => sf.openConfigure(p)}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      <CartBar sf={sf} accent={accent} />
      <PoweredByAura />
    </View>
  );
}
