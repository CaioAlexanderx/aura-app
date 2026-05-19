import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA Food — hooks unificados de cardápio + ficha técnica.
//
// Backend (food.js + foodReports.js) já entrega:
//   GET /food/menu                       → { menu, categories, items[] }
//   GET /food/recipes/summary            → todos itens com margin_pct
//   GET /food/items/:iid/recipe          → ficha com total_cost + margin_pct + margin_alert
//   POST /food/menu                      → upsert (slug unique)
//   POST /food/categories                → cria categoria
//   PATCH /food/categories/:cid          → atualiza categoria
//   POST /food/items                     → cria item
//   PATCH /food/items/:iid               → atualiza item
//   DELETE /food/items/:iid              → soft delete (is_active=false)
//   POST /food/items/:iid/recipe         → adiciona ingrediente (recalcula cost_price)
//   PUT /food/items/:iid/recipe/:rid     → atualiza ingrediente
//   DELETE /food/items/:iid/recipe/:rid  → remove ingrediente
//
// Invalidação: mutations de category/item/recipe invalidam menu e
// recipes-summary; mutations de recipe também invalidam recipe(itemId).
// ============================================================

export type FoodMenu = {
  id: string;
  company_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  is_active: boolean;
  accepts_online_orders: boolean;
  min_order_amount: number | null;
  always_available?: boolean;
};

export type FoodCategory = {
  id: string;
  menu_id: string;
  company_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type FoodItemVariation = {
  id: string;
  item_id: string;
  name: string;
  price_delta: number;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
};

export type FoodAddon = {
  id: string;
  company_id: string;
  item_id: string | null;
  name: string;
  price: number;
  max_qty: number;
  is_active: boolean;
};

export type FoodItem = {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  cost_price: number | null;
  photo_url: string | null;
  is_active: boolean;
  is_available: boolean;
  preparation_time_min: number | null;
  serves: number;
  sort_order: number;
  tags: string[] | null;
  variations?: FoodItemVariation[];
  addons?: FoodAddon[];
};

export type FoodMenuResponse = {
  menu: FoodMenu | null;
  categories: FoodCategory[];
  items: FoodItem[];
};

export type FoodRecipeIngredient = {
  id: string;
  item_id: string;
  ingredient_name: string;
  unit: string;
  quantity: number;
  unit_cost: number;
  product_id: string | null;
  product_name?: string | null;
  stock_unit_cost?: number | null;
  notes: string | null;
};

export type FoodRecipeDetail = {
  item_id: string;
  item_name: string;
  sale_price: number;
  total_cost: number;
  margin_pct: number | null;
  margin_alert: boolean;
  ingredients: FoodRecipeIngredient[];
};

export type FoodRecipeSummary = {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  margin_pct: number | null;
  ingredient_count: number;
};

function buildPath(companyId: string, suffix: string) {
  return "/companies/" + companyId + "/food" + suffix;
}

// ============================================================
// Queries
// ============================================================
export function useFoodMenu() {
  const { company, token } = useAuthStore();
  return useQuery<FoodMenuResponse>({
    queryKey: ["food-menu", company?.id],
    queryFn: () => request<FoodMenuResponse>(buildPath(company!.id, "/menu")),
    enabled: !!token && !!company?.id,
    staleTime: 30_000,
  });
}

export function useFoodRecipesSummary() {
  const { company, token } = useAuthStore();
  return useQuery<FoodRecipeSummary[]>({
    queryKey: ["food-recipes-summary", company?.id],
    queryFn: () => request<FoodRecipeSummary[]>(buildPath(company!.id, "/recipes/summary")),
    enabled: !!token && !!company?.id,
    staleTime: 30_000,
  });
}

export function useFoodRecipe(itemId: string | null) {
  const { company, token } = useAuthStore();
  return useQuery<FoodRecipeDetail>({
    queryKey: ["food-recipe", company?.id, itemId],
    queryFn: () => request<FoodRecipeDetail>(buildPath(company!.id, "/items/" + itemId + "/recipe")),
    enabled: !!token && !!company?.id && !!itemId,
    staleTime: 10_000,
  });
}

// ============================================================
// Mutations — shared invalidator
// ============================================================
function useInvalidateFoodMenu() {
  const qc = useQueryClient();
  const { company } = useAuthStore();
  return () => {
    qc.invalidateQueries({ queryKey: ["food-menu", company?.id] });
    qc.invalidateQueries({ queryKey: ["food-recipes-summary", company?.id] });
  };
}

// Menu (upsert via POST /menu)
export function useUpsertMenuMutation() {
  const { company } = useAuthStore();
  const invalidate = useInvalidateFoodMenu();
  return useMutation({
    mutationFn: (body: { name?: string; slug?: string; description?: string; accepts_online_orders?: boolean; min_order_amount?: number }) =>
      request<FoodMenu>(buildPath(company!.id, "/menu"), { method: "POST", body }),
    onSuccess: invalidate,
  });
}

// Categories
export function useCreateCategoryMutation() {
  const { company } = useAuthStore();
  const invalidate = useInvalidateFoodMenu();
  return useMutation({
    mutationFn: (body: { menu_id: string; name: string; sort_order?: number }) =>
      request<FoodCategory>(buildPath(company!.id, "/categories"), { method: "POST", body }),
    onSuccess: invalidate,
  });
}
export function useUpdateCategoryMutation() {
  const { company } = useAuthStore();
  const invalidate = useInvalidateFoodMenu();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; sort_order?: number; is_active?: boolean }) =>
      request<FoodCategory>(buildPath(company!.id, "/categories/" + id), { method: "PATCH", body }),
    onSuccess: invalidate,
  });
}

// Items
export function useCreateItemMutation() {
  const { company } = useAuthStore();
  const invalidate = useInvalidateFoodMenu();
  return useMutation({
    mutationFn: (body: Partial<FoodItem>) =>
      request<FoodItem>(buildPath(company!.id, "/items"), { method: "POST", body }),
    onSuccess: invalidate,
  });
}
export function useUpdateItemMutation() {
  const { company } = useAuthStore();
  const invalidate = useInvalidateFoodMenu();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<FoodItem> & { id: string }) =>
      request<FoodItem>(buildPath(company!.id, "/items/" + id), { method: "PATCH", body }),
    onSuccess: invalidate,
  });
}
export function useDeleteItemMutation() {
  const { company } = useAuthStore();
  const invalidate = useInvalidateFoodMenu();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ ok: boolean }>(buildPath(company!.id, "/items/" + id), { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

// Recipe / Ficha técnica
export function useAddIngredientMutation(itemId: string) {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const invalidate = useInvalidateFoodMenu();
  return useMutation({
    mutationFn: (body: Partial<FoodRecipeIngredient>) =>
      request<FoodRecipeIngredient>(buildPath(company!.id, "/items/" + itemId + "/recipe"), { method: "POST", body }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["food-recipe", company?.id, itemId] });
    },
  });
}
export function useUpdateIngredientMutation(itemId: string) {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const invalidate = useInvalidateFoodMenu();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<FoodRecipeIngredient> & { id: string }) =>
      request<FoodRecipeIngredient>(buildPath(company!.id, "/items/" + itemId + "/recipe/" + id), { method: "PUT", body }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["food-recipe", company?.id, itemId] });
    },
  });
}
export function useDeleteIngredientMutation(itemId: string) {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const invalidate = useInvalidateFoodMenu();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ ok: boolean }>(buildPath(company!.id, "/items/" + itemId + "/recipe/" + id), { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["food-recipe", company?.id, itemId] });
    },
  });
}

// ============================================================
// Helpers
// ============================================================

/** Mapeia margem (%) para nível semáforo */
export function getMarginLevel(marginPct: number | null | undefined): "green" | "amber" | "red" | "gray" {
  if (marginPct == null || isNaN(Number(marginPct))) return "gray";
  const m = Number(marginPct);
  if (m >= 40) return "green";
  if (m >= 20) return "amber";
  return "red";
}
