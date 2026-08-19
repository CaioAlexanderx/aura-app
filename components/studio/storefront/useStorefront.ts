// ============================================================
// components/studio/storefront/useStorefront.ts
// Fonte unica de estado do storefront publico Studio.
// CONTRATO CONGELADO -- Onda 0.
//
// API publica (contratos para Onda 1):
//
//   const sf = useStorefront(slug);
//
//   // Estado da loja
//   sf.store           -- StorePayload | null
//   sf.loading         -- boolean
//   sf.error           -- string | null
//   sf.setError        -- (msg: string | null) => void
//
//   // Navegacao
//   sf.stage           -- Stage
//   sf.goTo(stage)     -- navega entre stages
//
//   // Produto sendo configurado
//   sf.activeProduct   -- StudioStoreProduct | null
//   sf.editingValues   -- Record<fieldId, any>  (valores correntes dos fields)
//   sf.setFieldValue(fieldId, value) -- grava valor de um field
//   sf.editingQty      -- number
//   sf.setEditingQty   -- (n: number) => void
//   sf.editingAddBack  -- boolean  (cliente optou pelo verso)
//   sf.setEditingAddBack -- (b: boolean) => void
//   sf.configuringUnitPrice -- numero calculado (base + choices + verso)
//   sf.openConfigure(product) -- abre o configurador pra um produto
//   sf.editCartLine(line)     -- reabre o configurador pra editar linha
//   sf.commitConfigure()      -- valida + commita no carrinho + volta pra "list"
//
//   // Upload de imagem (campo type=image)
//   // Agente G (FieldImage) chama sf.uploadImage() e depois sf.setFieldValue()
//   sf.uploadImage(fieldId, file) -- Promise<void>
//     internamente: FileReader -> base64 -> POST /upload -> setFieldValue(fieldId, url)
//     estados: sf.uploadingFieldId (string|null), sf.uploadError (string|null)
//   sf.uploadingFieldId  -- string | null  (qual field esta em upload)
//   sf.uploadError       -- string | null
//   sf.clearUploadError  -- () => void
//
//   // Carrinho
//   sf.cart            -- CartLine[]
//   sf.cartSubtotal    -- number
//   sf.removeCartLine(lineId)
//
//   // Checkout
//   sf.customerName     sf.setCustomerName
//   sf.customerPhone    sf.setCustomerPhone
//   sf.customerEmail    sf.setCustomerEmail
//   sf.paymentMethod    sf.setPaymentMethod
//   sf.deliveryType     sf.setDeliveryType
//   sf.addressStreet    sf.setAddressStreet
//   sf.addressNumber    sf.setAddressNumber
//   sf.addressNeigh     sf.setAddressNeigh
//   sf.addressCity      sf.setAddressCity
//   sf.addressState     sf.setAddressState
//   sf.addressZip       sf.setAddressZip
//   sf.notes            sf.setNotes
//   sf.sending          -- boolean
//   sf.submitOrder()    -- async, chama POST /order e seta sentOrder + stage="sent"
//
//   // Confirmacao
//   sf.sentOrder        -- SentOrder | null
//   sf.resetToList()    -- volta pra lista apos "sent"
//
//   // Internos (prefixo _ -- nao usar fora dos sub-componentes de display)
//   sf._editingLineId   -- string | null  (para saber se e edicao ou novo)
//   sf._effectiveBackSelected(cfg, explicit) -- boolean
//   sf._lineUnitPrice(line) -- number
//   sf._lineTotal(line)     -- number
// ============================================================
import { useState, useEffect, useMemo } from "react";
import { Platform } from "react-native";
import { maskPhone } from "@/utils/masks";
import type {
  StorePayload, StudioStoreProduct, CartLine, Stage, SentOrder,
} from "./types";

const API_BASE =
  (typeof process !== "undefined" && (process.env as any)?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

// --- Helpers de preco (identicos ao monolito) ---
function choicesDelta(
  cfg: StudioStoreProduct["customization_config"] | null | undefined,
  values: Record<string, any>
): number {
  if (!cfg?.fields) return 0;
  let delta = 0;
  for (const f of cfg.fields) {
    if (f.type !== "option" && f.type !== "color") continue;
    const choices = f.config?.choices;
    if (!Array.isArray(choices) || choices.length === 0) continue;
    const selected = values[f.id];
    if (selected == null) continue;
    const sels = Array.isArray(selected) ? selected : [selected];
    for (const s of sels) {
      const c = choices.find((ch: any) => ch.value === s || ch.label === s);
      if (c && typeof c.price_delta === "number" && !isNaN(c.price_delta)) {
        delta += c.price_delta;
      }
    }
  }
  return delta;
}

function effectiveBackSelected(
  cfg: StudioStoreProduct["customization_config"] | null | undefined,
  explicit: boolean | undefined
): boolean {
  if (!cfg || cfg.has_back !== true) return false;
  if (cfg.back_charge_enabled !== true) return true;
  return explicit === true;
}

// ── S0 (18/08/2026) — grupo de origem da arte ────────────────
// `image` e `template` preenchem o MESMO slot de arte: compose3dMug e
// compose2d leem `values.image || values.template`. A lojista pode marcar
// "Obrigatorio" nos dois no painel de personalizacao, e o resultado era
// uma condicao impossivel — foi o que travou a compra em sheid-mania,
// loja publicada (ver docs/F1_CONTEUDO_STUDIO.md no aura-backend, S0).
//
// Regra: se ao menos um campo do grupo for required, basta UM preenchido.
// Com uma unica origem no config, o comportamento e identico ao anterior.
//
// ESPELHO OBRIGATORIO de validateCustomizationValues em
// src/routes/studioStorefront.js (aura-backend). Se um lado mudar sem o
// outro, o item entra no carrinho e o pedido leva 400 no fechamento.
const ART_SOURCE_TYPES = new Set(["image", "template"]);

function isFilled(v: any): boolean {
  return !(v == null || (typeof v === "string" && !v.trim()));
}

function fieldSideOf(f: { side?: string } | any): "front" | "back" {
  return (f as any)?.side === "back" ? "back" : "front";
}

/**
 * Mensagem de erro do primeiro campo obrigatorio nao satisfeito, ou null.
 * Pura de proposito: e o que os testes exercitam, e o que precisa bater
 * com validateCustomizationValues do backend.
 */
export function validateRequiredFields(
  cfg: StudioStoreProduct["customization_config"] | null | undefined,
  values: Record<string, any>,
  backActive: boolean
): string | null {
  if (!cfg?.fields) return null;
  const aplicaveis = cfg.fields.filter(
    (f) => fieldSideOf(f) !== "back" || backActive
  );

  // "Crie minha arte pra mim": o cliente contratou a criacao e nao tem
  // arte pra enviar — dispensa o grupo de origem da arte.
  const arteContratada = aplicaveis.some(
    (f) =>
      (f.config as any)?.is_art_service === true && values[f.id] === "designer"
  );

  for (const side of ["front", "back"] as const) {
    const grupo = aplicaveis.filter(
      (f) => ART_SOURCE_TYPES.has(f.type) && fieldSideOf(f) === side
    );
    if (!grupo.some((f) => f.required)) continue;
    if (arteContratada) continue;
    if (grupo.some((f) => isFilled(values[f.id]))) continue;
    const opcoes = grupo.map((f) => `"${f.label}"`).join(" ou ");
    return `Envie sua arte em ${opcoes}`;
  }

  for (const f of aplicaveis) {
    if (!f.required) continue;
    if (ART_SOURCE_TYPES.has(f.type)) continue; // ja coberto pelo grupo
    if (!isFilled(values[f.id])) return `Preencha "${f.label}"`;
  }
  return null;
}

function backDelta(
  cfg: StudioStoreProduct["customization_config"] | null | undefined,
  explicit: boolean | undefined
): number {
  if (!cfg || cfg.has_back !== true) return 0;
  if (cfg.back_charge_enabled !== true) return 0;
  if (explicit !== true) return 0;
  const d = Number(cfg.back_price_delta);
  return isFinite(d) ? d : 0;
}

function lineUnitPrice(line: CartLine): number {
  return (
    Number(line.product.price) +
    choicesDelta(line.product.customization_config, line.values) +
    backDelta(line.product.customization_config, line.hasBackSelected)
  );
}

function lineTotal(line: CartLine): number {
  return lineUnitPrice(line) * line.qty;
}

// --- Hook ---
export function useStorefront(slug: string) {
  const [store, setStore] = useState<StorePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("list");
  const [activeProduct, setActiveProduct] = useState<StudioStoreProduct | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});
  const [editingQty, setEditingQty] = useState(1);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingAddBack, setEditingAddBack] = useState<boolean>(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);

  // Upload
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Checkout form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card" | "on_delivery" | null>(null);
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressNeigh, setAddressNeigh] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [notes, setNotes] = useState("");

  const [sending, setSending] = useState(false);
  const [sentOrder, setSentOrder] = useState<SentOrder | null>(null);

  // Carrega a loja
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(API_BASE + "/storefront/" + slug + "/studio/products")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStore(data as StorePayload);
        const pm = data.payment?.has_pix
          ? "pix"
          : data.payment?.has_card
          ? "card"
          : data.payment?.pay_on_delivery_enabled
          ? "on_delivery"
          : null;
        setPaymentMethod(pm);
      })
      .catch((e) => setError(e?.message || "Erro ao carregar loja"))
      .finally(() => setLoading(false));
  }, [slug]);

  // Hidrata o carrinho do localStorage (web) por slug -- refresh nao perde nada.
  // Segue o padrao aura-food-storefront-<slug> do Food.
  useEffect(() => {
    if (Platform.OS !== "web" || !slug || typeof window === "undefined") {
      setCartHydrated(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem("aura-studio-storefront-" + slug);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCart(parsed as CartLine[]);
      }
    } catch {}
    setCartHydrated(true);
  }, [slug]);

  // Persiste o carrinho a cada mudanca (so depois de hidratar, pra nao
  // sobrescrever o salvo com [] no primeiro render). submitOrder limpa o
  // cart via setCart([]) -> este effect grava [] -> storage zera. OK.
  useEffect(() => {
    if (Platform.OS !== "web" || !slug || !cartHydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem("aura-studio-storefront-" + slug, JSON.stringify(cart));
    } catch {}
  }, [cart, slug, cartHydrated]);

  const cartSubtotal = useMemo(
    () => cart.reduce((s, l) => s + lineTotal(l), 0),
    [cart]
  );

  const configuringUnitPrice = useMemo(() => {
    if (!activeProduct) return 0;
    return (
      Number(activeProduct.price) +
      choicesDelta(activeProduct.customization_config, editingValues) +
      backDelta(activeProduct.customization_config, editingAddBack)
    );
  }, [activeProduct, editingValues, editingAddBack]);

  function goTo(s: Stage) {
    setStage(s);
  }

  function setFieldValue(fieldId: string, value: any) {
    setEditingValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function openConfigure(product: StudioStoreProduct) {
    setActiveProduct(product);
    setEditingLineId(null);
    const initial: Record<string, any> = {};
    const cfg = product.customization_config;
    if (cfg?.fields) {
      for (const f of cfg.fields) {
        if (f.type === "color" && f.config.colors?.length) {
          initial[f.id] = f.config.colors[0];
        }
      }
    }
    setEditingValues(initial);
    setEditingQty(1);
    setEditingAddBack(false);
    setStage("configure");
  }

  function editCartLine(line: CartLine) {
    setActiveProduct(line.product);
    setEditingLineId(line.lineId);
    setEditingValues(line.values);
    setEditingQty(line.qty);
    setEditingAddBack(line.hasBackSelected === true);
    setStage("configure");
  }

  function commitConfigure() {
    if (!activeProduct) return;
    const cfg = activeProduct.customization_config;
    const backActive = effectiveBackSelected(cfg, editingAddBack);
    const faltou = validateRequiredFields(cfg, editingValues, backActive);
    if (faltou) {
      setError(faltou);
      return;
    }
    setError(null);
    let valuesToCommit = editingValues;
    if (cfg?.has_back === true && !backActive && cfg.fields) {
      const cleaned: Record<string, any> = { ...editingValues };
      for (const f of cfg.fields) {
        if ((f as any).side === "back") delete cleaned[f.id];
      }
      valuesToCommit = cleaned;
    }
    if (editingLineId) {
      setCart((prev) =>
        prev.map((l) =>
          l.lineId === editingLineId
            ? { ...l, qty: editingQty, values: valuesToCommit, hasBackSelected: editingAddBack }
            : l
        )
      );
    } else {
      const lineId = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 7);
      setCart((prev) => [
        ...prev,
        {
          lineId, product: activeProduct, qty: editingQty,
          values: valuesToCommit, hasBackSelected: editingAddBack,
        },
      ]);
    }
    setActiveProduct(null);
    setEditingLineId(null);
    setEditingAddBack(false);
    setStage("list");
  }

  function removeCartLine(lineId: string) {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  /**
   * uploadImage -- CONTRATO para Agente G (FieldImage)
   *
   * Chame com o fieldId e o File selecionado pelo picker.
   * O hook faz: FileReader -> base64 -> POST /upload -> setFieldValue(fieldId, url)
   * Estados expostos: uploadingFieldId, uploadError, clearUploadError
   *
   * O Agente G pode usar esta funcao OU reimplementar dentro do FieldImage
   * (que recebe `onChange` direto). Esta implementacao e o fallback/referencia.
   */
  async function uploadImage(fieldId: string, file: File, maxMb: number = 15): Promise<void> {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setUploadError("Aceitos: PNG, JPG, WEBP");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setUploadError(`Arquivo grande demais (max ${maxMb}MB)`);
      return;
    }
    setUploadingFieldId(fieldId);
    setUploadError(null);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(API_BASE + "/storefront/" + slug + "/studio/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_base64: dataUrl.split(",")[1],
          content_type: file.type,
          filename: file.name,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFieldValue(fieldId, data.url);
    } catch (e: any) {
      setUploadError(e?.message || "Erro no upload");
    } finally {
      setUploadingFieldId(null);
    }
  }

  async function submitOrder() {
    if (!customerName.trim() || !customerPhone.trim()) {
      setError("Nome e telefone obrigatorios");
      return;
    }
    if (cart.length === 0) {
      setError("Carrinho vazio");
      return;
    }
    if (deliveryType === "delivery" && !addressStreet.trim()) {
      setError("Informe o endereco de entrega");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const body = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || null,
        delivery_type: deliveryType,
        payment_method: paymentMethod || undefined,
        notes: notes.trim() || null,
        items: cart.map((l) => {
          const backActive = effectiveBackSelected(
            l.product.customization_config,
            l.hasBackSelected
          );
          let valuesOut: Record<string, any> = l.values;
          const cfg = l.product.customization_config;
          if (cfg?.has_back === true && !backActive && cfg.fields) {
            const cleaned: Record<string, any> = { ...l.values };
            for (const f of cfg.fields) {
              if ((f as any).side === "back") delete cleaned[f.id];
            }
            valuesOut = cleaned;
          }
          return {
            product_id: l.product.id,
            quantity: l.qty,
            customization: {
              ...valuesOut,
              has_back_selected: backActive,
            },
          };
        }),
        address_zip: addressZip.replace(/\D/g, "") || null,
        address_street: addressStreet.trim() || null,
        address_number: addressNumber.trim() || null,
        address_neighborhood: addressNeigh.trim() || null,
        address_city: addressCity.trim() || null,
        address_state: addressState.trim().toUpperCase() || null,
      };
      const res = await fetch(API_BASE + "/storefront/" + slug + "/studio/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSentOrder(data);
      setStage("sent");
      setCart([]);
      if (data.card?.init_point && Platform.OS === "web" && typeof window !== "undefined") {
        setTimeout(() => { window.location.href = data.card.init_point; }, 800);
      }
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar pedido");
    } finally {
      setSending(false);
    }
  }

  function resetToList() {
    setStage("list");
    setSentOrder(null);
  }

  return {
    // Loja
    store, loading, error, setError,
    // Navegacao
    stage, goTo,
    // Configurador
    activeProduct,
    editingValues, setFieldValue,
    editingQty, setEditingQty,
    editingAddBack, setEditingAddBack,
    configuringUnitPrice,
    openConfigure, editCartLine, commitConfigure,
    // Upload
    uploadImage, uploadingFieldId, uploadError,
    clearUploadError: () => setUploadError(null),
    // Carrinho
    cart, cartSubtotal, removeCartLine,
    // Checkout
    customerName, setCustomerName,
    customerPhone, setCustomerPhone: (v: string) => setCustomerPhone(maskPhone(v)),
    customerEmail, setCustomerEmail,
    paymentMethod, setPaymentMethod,
    deliveryType, setDeliveryType,
    addressStreet, setAddressStreet,
    addressNumber, setAddressNumber,
    addressNeigh, setAddressNeigh,
    addressCity, setAddressCity,
    addressState, setAddressState: (v: string) => setAddressState(v.toUpperCase().slice(0, 2)),
    addressZip, setAddressZip,
    notes, setNotes,
    sending, submitOrder,
    // Confirmacao
    sentOrder, resetToList,
    // Internos (prefixo _ -- sub-componentes de display apenas)
    _editingLineId: editingLineId,
    _effectiveBackSelected: effectiveBackSelected,
    _lineUnitPrice: lineUnitPrice,
    _lineTotal: lineTotal,
  };
}

export type StorefrontState = ReturnType<typeof useStorefront>;
