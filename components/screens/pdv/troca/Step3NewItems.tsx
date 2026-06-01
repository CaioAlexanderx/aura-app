// ============================================================
// AURA. — PDV · Troca v3 · Step 3 — DESTINO DO CRÉDITO
//
// 24/05/2026 — Reescrito do zero pra v3.
// Mockup: Aura/mockup_troca_v3.html (tela 3)
//
// FRICÇÃO ATACADA: operador não sabia diferença entre "trocar produto"
// vs "devolver dinheiro" vs "deixar como crédito".
//
// Princípios v3:
//   • 3 cards grandes de destino (Levar outro produto / Crédito / Dinheiro)
//   • Default = "Levar outro produto" — caminho mais comum no varejo
//   • Scanner sempre visível e em foco quando "Levar outro produto"
//   • Side card com saldo financeiro vivo (crédito ↘ carrinho ↘ diferença)
//
// 01/06/2026 — Seleção de TAMANHO/variante no item novo.
//   Antes: o item novo entrava SEM variant_id (preço/estoque do pai), a
//   baixa caía no estoque do produto-pai e o operador não via estoque por
//   tamanho — escolher um tamanho zerado falhava no submit ("Estoque
//   insuficiente"). Agora:
//     • Produto com has_variants abre o VariantPickerModal (mesmo do PDV)
//       com estoque por tamanho; tamanho 0 fica "Esgotado" e não-clicável
//       (blockOutOfStock).
//     • Scanner resolve barcode de variante via pdvApi.scan → adiciona o
//       tamanho certo direto (com variant_id + preço efetivo).
//     • A NewEntry agora carrega variant_id, então a troca baixa o estoque
//       da variante correta. Espelha hooks/usePdvState + useCart do PDV.
// ============================================================
import { useState, useMemo, useEffect, useRef } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Platform, useWindowDimensions,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { VariantPickerModal, type VariantChoice } from "@/components/VariantPickerModal";
import { useAuthStore } from "@/stores/auth";
import { pdvApi } from "@/services/pdvApi";
import type { NewEntry } from "./types";
import { fmtBRL } from "./types";

// Le o estoque disponivel do produto de forma tolerante a shape.
// Definido no escopo do modulo (nunca injetar funcao dentro de .map()).
function readStock(p: any): number {
  return Number(p?.stock_qty ?? p?.stock ?? p?.available_stock ?? 0);
}

type Props = {
  products: any[];
  newEntries: NewEntry[];
  onChangeEntries: (next: NewEntry[]) => void;
  returnedValue: number;
  newValue: number;
  netAmount: number;
};

type Dest = "outro" | "credito" | "dinheiro";

export function Step3NewItems({
  products, newEntries, onChangeEntries,
  returnedValue, newValue, netAmount,
}: Props) {
  const { company } = useAuthStore();
  const [dest, setDest] = useState<Dest>("outro");
  const [query, setQuery] = useState("");
  const [scanBuffer, setScanBuffer] = useState("");
  const [pendingProduct, setPendingProduct] = useState<any | null>(null);
  const scanRef = useRef<TextInput | null>(null);
  const { width } = useWindowDimensions();
  const isWide = width > 880;

  useEffect(() => {
    if (dest === "outro" && scanRef.current) {
      const t = setTimeout(() => scanRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [dest]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(products) ? products : [];
    if (!q) return list.slice(0, 12);
    return list.filter((p) => {
      const name = String(p.name || p.title || "").toLowerCase();
      const barcode = String(p.barcode || p.sku || "").toLowerCase();
      return name.includes(q) || barcode.includes(q);
    }).slice(0, 50);
  }, [products, query]);

  // Insere/incrementa uma entrada no carrinho da troca. Dedup por
  // (product_id, variant_id) pra tamanhos diferentes do mesmo produto
  // contarem como linhas separadas.
  function pushEntry(args: {
    product_id: string;
    variant_id?: string | null;
    unit_price: number;
    name: string;
    via?: NewEntry["addedVia"];
  }) {
    const vid = args.variant_id || null;
    const idx = newEntries.findIndex(
      (e) => e.product_id === args.product_id && (e.variant_id || null) === vid
    );
    if (idx >= 0) {
      const next = [...newEntries];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
      onChangeEntries(next);
    } else {
      onChangeEntries([
        ...newEntries,
        {
          product_id: args.product_id,
          variant_id: vid,
          quantity: 1,
          unit_price: Number(args.unit_price || 0),
          product_name_snapshot: args.name,
          addedVia: args.via || "search",
        },
      ]);
    }
  }

  // Toque no catalogo / produto bipado: se tem variantes, abre o seletor
  // de tamanho; senao entra direto.
  function addProduct(p: any, via: "search" | "barcode" = "search") {
    if (p?.has_variants) {
      setPendingProduct(p);
      return;
    }
    pushEntry({
      product_id: p.id,
      unit_price: Number(p.price ?? p.unit_price ?? 0),
      name: p.name || p.title || "Produto",
      via,
    });
  }

  function handleVariantSelected(variant: VariantChoice) {
    const p = pendingProduct;
    if (!p) return;
    const base = p.name || p.title || "Produto";
    const label = (variant.label || "").trim();
    pushEntry({
      product_id: p.id,
      variant_id: variant.id || null, // id "" = vender o pai (sem variante)
      unit_price: Number(variant.price ?? p.price ?? 0),
      name: label ? `${base} (${label})` : base,
      via: "search",
    });
    setPendingProduct(null);
  }

  function setQty(idx: number, qty: number) {
    if (qty < 1) {
      onChangeEntries(newEntries.filter((_, i) => i !== idx));
      return;
    }
    const next = [...newEntries];
    next[idx] = { ...next[idx], quantity: qty };
    onChangeEntries(next);
  }

  function removeEntry(idx: number) {
    onChangeEntries(newEntries.filter((_, i) => i !== idx));
  }

  async function handleScanSubmit() {
    const code = scanBuffer.trim();
    if (!code) return;
    const list = Array.isArray(products) ? products : [];

    // 1) Lookup local: barcode/sku do pai OU barcode de variante conhecido.
    const localParent = list.find((p) =>
      String(p.barcode || "").trim() === code ||
      String(p.sku || "").trim() === code
    );
    const localByVariant = !localParent
      ? list.find((p) => Array.isArray(p.variant_barcodes) && p.variant_barcodes.includes(code))
      : null;

    // 2) Se acertou o barcode do pai e nao tem variantes, entra direto.
    if (localParent && !localParent.has_variants) {
      addProduct(localParent, "barcode");
      toast.success(`✓ ${localParent.name || localParent.title}`);
      setScanBuffer("");
      return;
    }

    // 3) Backend resolve barcode de variante -> tamanho exato (com variant_id).
    if (company?.id) {
      try {
        const res = await pdvApi.scan(company.id, code);
        if (res?.match === "exact" && res.source === "variant_barcode" && res.product && res.variant_id) {
          const parent = list.find((p) => p.id === res.product.id);
          const suffix = (res.product as any).sku_suffix || "Variante";
          const pname = parent?.name || (res.product as any).name || "Produto";
          const price = res.effective_price || parent?.price || (res.product as any).price || 0;
          pushEntry({
            product_id: res.product.id,
            variant_id: res.variant_id,
            unit_price: Number(price),
            name: `${pname} (${suffix})`,
            via: "barcode",
          });
          toast.success(`✓ ${pname} · ${suffix}`);
          setScanBuffer("");
          return;
        }
        if (res?.match === "exact" && res.product) {
          const full = list.find((p) => p.id === res.product.id);
          if (full) {
            addProduct(full, "barcode"); // abre seletor se has_variants
            if (!full.has_variants) toast.success(`✓ ${full.name || full.title}`);
            setScanBuffer("");
            return;
          }
          pushEntry({
            product_id: res.product.id,
            unit_price: Number(res.effective_price || (res.product as any).price || 0),
            name: (res.product as any).name || "Produto",
            via: "barcode",
          });
          toast.success(`✓ ${(res.product as any).name || "Produto"}`);
          setScanBuffer("");
          return;
        }
      } catch {
        // cai no fallback abaixo
      }
    }

    // 4) Pai com variantes mas sem resolver no backend: abre o seletor.
    if (localParent && localParent.has_variants) {
      addProduct(localParent, "barcode");
      setScanBuffer("");
      return;
    }
    if (localByVariant) {
      addProduct(localByVariant, "barcode");
      setScanBuffer("");
      return;
    }

    toast.error("Código não encontrado");
  }

  return (
    <>
    <View style={isWide ? s.gridWide : undefined}>
      <View style={isWide ? { flex: 1, minWidth: 0 } : undefined}>
        <Text style={s.question}>O que o cliente vai fazer com o crédito?</Text>

        <View style={s.destGrid}>
          <DestCard
            icon="shopping-bag"
            title="Levar outro produto"
            sub="Bipe ou escolha do estoque"
            active={dest === "outro"}
            onPress={() => setDest("outro")}
          />
          <DestCard
            icon="credit-card"
            title="Crédito na conta"
            sub="Cliente usa depois"
            active={dest === "credito"}
            onPress={() => {
              setDest("credito");
              if (newEntries.length > 0) onChangeEntries([]);
            }}
          />
          <DestCard
            icon="dollar-sign"
            title="Devolver em dinheiro"
            sub="Pix, dinheiro ou estorno"
            active={dest === "dinheiro"}
            onPress={() => {
              setDest("dinheiro");
              if (newEntries.length > 0) onChangeEntries([]);
            }}
          />
        </View>

        {dest === "outro" && (
          <View>
            <View style={s.scanner}>
              <Icon name="barcode" size={20} color="#a78bfa" />
              <TextInput
                ref={scanRef}
                value={scanBuffer}
                onChangeText={setScanBuffer}
                onSubmitEditing={handleScanSubmit}
                placeholder="Bipe o código de barras…"
                placeholderTextColor={Colors.ink3}
                style={s.scannerInput}
                returnKeyType="search"
              />
              {scanBuffer.length > 0 && (
                <Pressable onPress={handleScanSubmit} style={s.scanSubmit}>
                  <Text style={s.scanSubmitTxt}>Adicionar</Text>
                </Pressable>
              )}
            </View>

            <View style={s.searchWrap}>
              <Icon name="search" size={16} color={Colors.ink3} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ou pesquise pelo nome do produto…"
                placeholderTextColor={Colors.ink3}
                style={s.searchInput}
              />
            </View>

            {filtered.length > 0 && (
              <View style={s.catalogSection}>
                <Text style={s.sectionLabel}>
                  {query ? "Resultados" : "Mais vendidos"}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingRight: 12 }}
                >
                  {filtered.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => addProduct(p)}
                      style={s.catCard}
                    >
                      <View style={s.catThumb}>
                        <Icon name="package" size={20} color="#a78bfa" />
                      </View>
                      <Text style={s.catName} numberOfLines={2}>{p.name || p.title || "—"}</Text>
                      <Text style={s.catPrice}>{fmtBRL(Number(p.price ?? p.unit_price ?? 0))}</Text>
                      <Text
                        style={[
                          s.catStock,
                          readStock(p) <= 0 && s.catStockOut,
                          readStock(p) > 0 && readStock(p) <= 5 && s.catStockLow,
                        ]}
                        numberOfLines={1}
                      >
                        {readStock(p) <= 0
                          ? "Sem estoque"
                          : `${readStock(p)} ${p.has_variants ? "no total" : "em estoque"}`}
                      </Text>
                      {p.has_variants && (
                        <View style={s.varPill}>
                          <Text style={s.varPillTxt}>Escolher tamanho</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={s.cartSection}>
              <View style={s.cartHead}>
                <Text style={s.sectionLabel}>Carrinho da troca</Text>
                <Text style={s.cartCount}>
                  {newEntries.length} {newEntries.length === 1 ? "item" : "itens"}
                </Text>
              </View>

              {newEntries.length === 0 && (
                <View style={s.emptyCart}>
                  <Icon name="shopping-bag" size={24} color={Colors.ink3} />
                  <Text style={s.emptyCartTxt}>Bipe ou escolha um produto pra começar</Text>
                </View>
              )}

              {newEntries.map((e, idx) => (
                <View key={`${e.product_id}-${e.variant_id || "base"}-${idx}`} style={s.cartRow}>
                  <View style={s.cartThumb}>
                    <Icon name="package" size={14} color="#a78bfa" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.cartName} numberOfLines={1}>
                      {e.product_name_snapshot}
                      {e.addedVia === "barcode" && (
                        <Text style={s.bipedBadge}>  ✓ Bipado</Text>
                      )}
                    </Text>
                    <Text style={s.cartPrice}>
                      {fmtBRL(e.unit_price)} × {e.quantity} = {fmtBRL(e.unit_price * e.quantity)}
                    </Text>
                  </View>
                  <View style={s.qty}>
                    <Pressable onPress={() => setQty(idx, e.quantity - 1)} style={s.qtyBtn}>
                      <Text style={s.qtyTxt}>−</Text>
                    </Pressable>
                    <Text style={s.qtyVal}>{e.quantity}</Text>
                    <Pressable onPress={() => setQty(idx, e.quantity + 1)} style={s.qtyBtn}>
                      <Text style={s.qtyTxt}>+</Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={() => removeEntry(idx)} style={s.removeBtn}>
                    <Icon name="x" size={12} color="#fca5a5" />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {dest === "credito" && (
          <View style={s.altBox}>
            <Icon name="credit-card" size={32} color="#a78bfa" />
            <Text style={s.altTitle}>Crédito vai pra conta do cliente</Text>
            <Text style={s.altSub}>
              O valor de {fmtBRL(returnedValue)} fica disponível na ficha do cliente. Ele usa quando quiser, sem prazo de vencimento.
            </Text>
            <View style={s.altNote}>
              <Icon name="info" size={12} color="#93c5fd" />
              <Text style={s.altNoteTxt}>
                Cliente cadastrado é obrigatório pro crédito. Se ele não tem cadastro, ofereça "devolver em dinheiro".
              </Text>
            </View>
          </View>
        )}

        {dest === "dinheiro" && (
          <View style={s.altBox}>
            <Icon name="dollar-sign" size={32} color="#10b981" />
            <Text style={s.altTitle}>Devolução em dinheiro</Text>
            <Text style={s.altSub}>
              Valor de {fmtBRL(returnedValue)} sai do caixa e volta pro cliente. Escolha a forma na próxima tela.
            </Text>
          </View>
        )}
      </View>

      <View style={isWide ? s.sideRail : { marginTop: 18 }}>
        <View style={s.creditCard}>
          <Text style={s.creditLabel}>CRÉDITO DISPONÍVEL</Text>
          <Text style={s.creditValue}>{fmtBRL(returnedValue)}</Text>
          <Text style={s.creditMeta}>Da venda original</Text>
          <View style={s.creditDivider} />
          <View style={s.creditRow}>
            <Text style={s.creditRowLabel}>Carrinho</Text>
            <Text style={s.creditRowValue}>{fmtBRL(newValue)}</Text>
          </View>
          <View style={s.creditRow}>
            <Text style={s.creditRowLabel}>− Crédito</Text>
            <Text style={s.creditRowValue}>− {fmtBRL(returnedValue)}</Text>
          </View>
          <View style={[s.creditRow, s.creditBalance]}>
            {netAmount > 0 ? (
              <>
                <Text style={[s.creditBalanceLabel, { color: "#fef3c7" }]}>Cliente paga</Text>
                <Text style={[s.creditBalanceValue, { color: "#fde68a" }]}>{fmtBRL(netAmount)}</Text>
              </>
            ) : netAmount < 0 ? (
              <>
                <Text style={[s.creditBalanceLabel, { color: "#a7f3d0" }]}>Loja devolve</Text>
                <Text style={[s.creditBalanceValue, { color: "#bbf7d0" }]}>{fmtBRL(-netAmount)}</Text>
              </>
            ) : (
              <>
                <Text style={[s.creditBalanceLabel, { color: "#e9d5ff" }]}>Sem diferença</Text>
                <Text style={[s.creditBalanceValue, { color: "#e9d5ff" }]}>{fmtBRL(0)}</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </View>

    <VariantPickerModal
      visible={!!pendingProduct}
      product={pendingProduct ? {
        id: pendingProduct.id,
        name: pendingProduct.name || pendingProduct.title || "Produto",
        price: Number(pendingProduct.price ?? pendingProduct.unit_price ?? 0),
        color: pendingProduct.color,
        size: pendingProduct.size,
        stock: readStock(pendingProduct),
      } : null}
      blockOutOfStock
      onSelect={handleVariantSelected}
      onClose={() => setPendingProduct(null)}
    />
    </>
  );
}

function DestCard({
  icon, title, sub, active, onPress,
}: {
  icon: string; title: string; sub: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.destCard, active && s.destCardActive]}>
      <View style={[s.destIcon, active && s.destIconActive]}>
        <Icon name={icon as any} size={22} color={active ? "#fff" : "#a78bfa"} />
      </View>
      <Text style={s.destTitle}>{title}</Text>
      <Text style={s.destSub}>{sub}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  gridWide: { flexDirection: "row", gap: 18, alignItems: "flex-start" },
  sideRail: { width: 280, flexShrink: 0 },
  question: { fontSize: 13, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  destGrid: { flexDirection: "row", gap: 10, marginBottom: 18 },
  destCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12, padding: 14,
    alignItems: "center", gap: 8,
  },
  destCardActive: {
    backgroundColor: "rgba(124,58,237,0.14)",
    borderColor: Colors.violet,
  },
  destIcon: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: "rgba(124,58,237,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  destIconActive: { backgroundColor: Colors.violet },
  destTitle: { color: Colors.ink, fontSize: 13.5, fontWeight: "700", textAlign: "center" },
  destSub: { color: Colors.ink3, fontSize: 11.5, textAlign: "center" },
  scanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(124,58,237,0.08)",
    borderWidth: 2, borderColor: "rgba(124,58,237,0.3)", borderStyle: Platform.OS === "web" ? ("dashed" as any) : "solid",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  scannerInput: { flex: 1, color: Colors.ink, fontSize: 15, fontWeight: "500" },
  scanSubmit: {
    backgroundColor: Colors.violet,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
  },
  scanSubmitTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 10,
  },
  searchInput: { flex: 1, color: Colors.ink, fontSize: 13.5 },
  catalogSection: { marginTop: 16 },
  sectionLabel: {
    fontSize: 11, color: Colors.ink3, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
  },
  catCard: {
    width: 130,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10, padding: 10,
  },
  catThumb: {
    width: "100%", aspectRatio: 1.2, borderRadius: 8,
    backgroundColor: "rgba(124,58,237,0.1)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  catName: { color: Colors.ink, fontSize: 12, fontWeight: "600", minHeight: 32 },
  catPrice: { color: "#a78bfa", fontSize: 12.5, fontWeight: "700", marginTop: 4 },
  catStock: { color: Colors.ink3, fontSize: 11, fontWeight: "600", marginTop: 3 },
  catStockLow: { color: "#fbbf24" },
  catStockOut: { color: "#f87171" },
  varPill: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    marginTop: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    backgroundColor: "rgba(124,58,237,0.18)",
    borderWidth: 1, borderColor: "rgba(167,139,250,0.25)",
  },
  varPillTxt: { color: "#a78bfa", fontSize: 10, fontWeight: "700" },
  cartSection: { marginTop: 18 },
  cartHead: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 10,
  },
  cartCount: { fontSize: 11.5, color: Colors.ink3, fontWeight: "600" },
  emptyCart: {
    alignItems: "center", paddingVertical: 22, gap: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 10, borderStyle: Platform.OS === "web" ? ("dashed" as any) : "solid",
  },
  emptyCartTxt: { color: Colors.ink3, fontSize: 12.5 },
  cartRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  cartThumb: {
    width: 32, height: 32, borderRadius: 7,
    backgroundColor: "rgba(124,58,237,0.12)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  cartName: { color: Colors.ink, fontSize: 13.5, fontWeight: "600" },
  bipedBadge: { color: "#10b981", fontSize: 11, fontWeight: "700" },
  cartPrice: { color: Colors.ink3, fontSize: 11.5, marginTop: 2 },
  qty: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 7, overflow: "hidden",
  },
  qtyBtn: {
    width: 26, height: 26, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  qtyTxt: { color: Colors.ink, fontSize: 14, fontWeight: "700" },
  qtyVal: { color: Colors.ink, fontSize: 12.5, fontWeight: "700", minWidth: 28, textAlign: "center" },
  removeBtn: {
    width: 26, height: 26, borderRadius: 6,
    backgroundColor: "rgba(239,68,68,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  altBox: {
    alignItems: "center", paddingVertical: 28, gap: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12, paddingHorizontal: 18,
  },
  altTitle: { color: Colors.ink, fontSize: 16, fontWeight: "700" },
  altSub: { color: Colors.ink2, fontSize: 13, textAlign: "center", maxWidth: 380 },
  altNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(37,99,235,0.12)",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    marginTop: 8,
  },
  altNoteTxt: { color: "#93c5fd", fontSize: 11.5, maxWidth: 360 },
  creditCard: {
    backgroundColor: "rgba(124,58,237,0.18)",
    borderWidth: 1, borderColor: "rgba(167,139,250,0.35)",
    borderRadius: 14, padding: 16,
  },
  creditLabel: { color: "#c4b5fd", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8 },
  creditValue: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: -0.4, marginTop: 4 },
  creditMeta: { color: "#a78bfa", fontSize: 11.5, marginTop: 2 },
  creditDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 12 },
  creditRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  creditRowLabel: { color: "#ddd6fe", fontSize: 12.5 },
  creditRowValue: { color: "#fff", fontSize: 12.5, fontWeight: "600" },
  creditBalance: {
    marginTop: 8, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)",
  },
  creditBalanceLabel: { fontSize: 13, fontWeight: "700" },
  creditBalanceValue: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
});

export default Step3NewItems;
