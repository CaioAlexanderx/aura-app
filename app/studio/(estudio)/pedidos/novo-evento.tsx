// ============================================================
// AURA STUDIO · Novo pedido pra evento (rota dedicada)
//
// Item #12 da análise UX/UI: wizard evento estava preso ao botão
// do hub. Vira rota própria pra ficar bookmarkável e abrir em tela
// cheia (melhor pra entrada de grandes listas de pessoas).
//
// Reaproveita BulkOrderWizard. Quando o wizard fecha (sucesso ou
// cancel), navega de volta pro hub /studio/pedidos.
//
// Fase 1b: container via StudioScreen (reading), tema dinâmico.
//
// FIX (bug #2 QA): a tela quebrava ao abrir — passava `asPage`/`onDone`,
// mas BulkOrderWizard espera `{onClose, onSaved, products}` e faz
// `products.map(...)` sem checar undefined → TypeError. Carrega os
// produtos personalizáveis (mesmo endpoint usado em pedidos.tsx) e
// passa as props corretas.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { BulkOrderWizard } from "@/components/studio/BulkOrderWizard";
import { StudioBreadcrumb } from "@/components/studio/StudioBreadcrumb";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";

export default function NovoEvento() {
  const router = useRouter();
  const { company } = useAuthStore();
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: number }>>([]);

  // Mesmo endpoint/filtro usado em pedidos.tsx (openBulkWizard) — produtos
  // personalizáveis pra listar no passo 1 do wizard.
  const loadProducts = useCallback(async () => {
    if (!company?.id) return;
    setLoadingProducts(true);
    try {
      const r = await request<any>(
        "/companies/" + company.id + "/products?limit=500",
        { method: "GET", retry: 1, timeout: 10000 }
      );
      const raw: any[] = Array.isArray(r) ? r : (r?.products || []);
      const list = raw
        .filter((p: any) => p.is_personalizable)
        .map((p: any) => ({ id: p.id, name: p.name, price: parseFloat(p.price) || 0 }));
      setProducts(list);
    } catch (e: any) {
      // Mesmo se falhar, deixa o wizard abrir com lista vazia — lojista
      // pode cadastrar produto manualmente depois.
      setProducts([]);
      console.warn("[studio/pedidos/novo-evento] Falha ao carregar produtos:", e?.message);
    } finally {
      setLoadingProducts(false);
    }
  }, [company?.id]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  return (
    <StudioScreen variant="reading" scroll={false}>
      <StudioBreadcrumb
        items={[
          { label: "Estúdio", href: "/studio" },
          { label: "Pedidos", href: "/studio/pedidos" },
          { label: "Novo pedido pra evento" },
        ]}
      />
      <View style={{ flex: 1, marginTop: 8 }}>
        {loadingProducts ? (
          <StudioLoading variant="skeleton-list" rows={4} />
        ) : (
          <BulkOrderWizard
            products={products}
            onClose={() => router.push("/studio/pedidos" as any)}
            onSaved={() => router.push("/studio/pedidos" as any)}
          />
        )}
      </View>
    </StudioScreen>
  );
}
