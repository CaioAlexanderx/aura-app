// ============================================================
// AURA. — Canal Digital · Aba Entrega (Fase 5 + polish 20/05/2026)
// Configura retirada e entrega:
//  • Retirada: endereço + ETA livre
//  • Entrega: modo de cobrança (flat | distance), CEP origem,
//    faixas por km (até 3), frete grátis acima de, ETA livre
//  • Horário de funcionamento (seg–dom)
//  • Preview do checkout do cliente
// Backend (PR paralelo) faz geocoding via BrasilAPI quando
// origin_zip é salvo. Frontend só envia o CEP em dígitos.
//
// Polish 20/05/2026:
//  • Inputs com prefixo R$ ganham borderRight separando prefixo
//    do valor + max-width 220 (cabe placeholder sem truncar)
//  • Modo de cobrança vira 2 mode-cards com descrição
//  • Separadores horizontais entre sub-seções
//  • CEP geolocalizado mostra badge verde de sucesso
//  • Empty state das faixas com CTA proeminente
//  • Frete grátis em sub-card destacado
//  • Mobile (<480px): mode-grid stack 1 coluna
// ============================================================
import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, Switch, ActivityIndicator, Dimensions,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { IS_WIDE, Field, cs } from "./shared";

// Narrow mode: phones estreitas (<480px) precisam stack do mode-grid
const NARROW = Dimensions.get("window").width < 480;

// ============================================================
// Tipos & defaults
// ============================================================
type PricingMode = "flat" | "distance";

type DistanceTier = { max_km: number; fee: number };

type BusinessHourDay = { open: string; close: string; closed?: boolean };

type BusinessHours = {
  seg: BusinessHourDay;
  ter: BusinessHourDay;
  qua: BusinessHourDay;
  qui: BusinessHourDay;
  sex: BusinessHourDay;
  sab: BusinessHourDay;
  dom: BusinessHourDay;
};

const DAYS: Array<{ key: keyof BusinessHours; label: string }> = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

const DEFAULT_HOURS: BusinessHours = {
  seg: { open: "09:00", close: "18:00", closed: false },
  ter: { open: "09:00", close: "18:00", closed: false },
  qua: { open: "09:00", close: "18:00", closed: false },
  qui: { open: "09:00", close: "18:00", closed: false },
  sex: { open: "09:00", close: "18:00", closed: false },
  sab: { open: "09:00", close: "13:00", closed: false },
  dom: { open: "", close: "", closed: true },
};

// ============================================================
// Normalizadores defensivos
// ============================================================
function normalizeHours(input: any): BusinessHours {
  if (!input || typeof input !== "object") return DEFAULT_HOURS;
  const out: any = {};
  for (const { key } of DAYS) {
    const d = input[key];
    if (d && typeof d === "object") {
      out[key] = {
        open: typeof d.open === "string" ? d.open : "",
        close: typeof d.close === "string" ? d.close : "",
        closed: !!d.closed || (!d.open && !d.close),
      };
    } else {
      out[key] = { open: "", close: "", closed: true };
    }
  }
  return out as BusinessHours;
}

function normalizeTiers(input: any): DistanceTier[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, 3)
    .map((t: any) => ({
      max_km: Number.isFinite(parseFloat(t?.max_km)) ? parseFloat(t.max_km) : 0,
      fee: Number.isFinite(parseFloat(t?.fee)) ? parseFloat(t.fee) : 0,
    }))
    .filter((t) => t.max_km > 0 || t.fee >= 0);
}

// ============================================================
// Helpers de parse/format
// ============================================================
function parseMoney(v: string): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return n.toFixed(2).replace(".", ",");
}

function maskZip(v: string): string {
  const digits = (v || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return digits.slice(0, 5) + "-" + digits.slice(5);
}

function zipDigits(v: string): string {
  return (v || "").replace(/\D/g, "").slice(0, 8);
}

function maskTime(v: string): string {
  const digits = (v || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ":" + digits.slice(2);
}

function isValidTime(v: string): boolean {
  if (!v) return true; // vazio = fechado, ok
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

// ============================================================
// Componente principal
// ============================================================
type Props = {
  config: any;
  saveConfig: (data: any) => Promise<any>;
  isSaving: boolean;
};

export function TabEntrega({ config, saveConfig, isSaving }: Props) {
  // --- State ----------------------------------------------------
  const [pickupEnabled, setPickupEnabled] = useState(config.pickup_enabled !== false);
  const [deliveryEnabled, setDeliveryEnabled] = useState(!!config.delivery_enabled);

  const [pickupAddress, setPickupAddress] = useState<string>(config.pickup_address || "");
  const [pickupEtaText, setPickupEtaText] = useState<string>(config.pickup_eta_text || "");
  const [deliveryEtaText, setDeliveryEtaText] = useState<string>(config.delivery_eta_text || "");

  const [pricingMode, setPricingMode] = useState<PricingMode>(
    config.delivery_pricing_mode === "distance" ? "distance" : "flat"
  );

  const [deliveryFeeText, setDeliveryFeeText] = useState<string>(
    fmtMoney(config.delivery_fee)
  );

  const [originZipMasked, setOriginZipMasked] = useState<string>(maskZip(config.origin_zip || ""));

  const [tiers, setTiers] = useState<DistanceTier[]>(normalizeTiers(config.delivery_distance_tiers));

  const [freeAboveText, setFreeAboveText] = useState<string>(
    config.delivery_free_above_amount != null ? fmtMoney(config.delivery_free_above_amount) : ""
  );

  const [businessHours, setBusinessHours] = useState<BusinessHours>(
    normalizeHours(config.business_hours)
  );

  // --- Sync com config externo ---------------------------------
  useEffect(() => { setPickupEnabled(config.pickup_enabled !== false); }, [config.pickup_enabled]);
  useEffect(() => { setDeliveryEnabled(!!config.delivery_enabled); }, [config.delivery_enabled]);
  useEffect(() => { setPickupAddress(config.pickup_address || ""); }, [config.pickup_address]);
  useEffect(() => { setPickupEtaText(config.pickup_eta_text || ""); }, [config.pickup_eta_text]);
  useEffect(() => { setDeliveryEtaText(config.delivery_eta_text || ""); }, [config.delivery_eta_text]);
  useEffect(() => {
    setPricingMode(config.delivery_pricing_mode === "distance" ? "distance" : "flat");
  }, [config.delivery_pricing_mode]);
  useEffect(() => { setDeliveryFeeText(fmtMoney(config.delivery_fee)); }, [config.delivery_fee]);
  useEffect(() => { setOriginZipMasked(maskZip(config.origin_zip || "")); }, [config.origin_zip]);
  useEffect(() => {
    setTiers(normalizeTiers(config.delivery_distance_tiers));
  }, [JSON.stringify(config.delivery_distance_tiers)]);
  useEffect(() => {
    setFreeAboveText(config.delivery_free_above_amount != null ? fmtMoney(config.delivery_free_above_amount) : "");
  }, [config.delivery_free_above_amount]);
  useEffect(() => {
    setBusinessHours(normalizeHours(config.business_hours));
  }, [JSON.stringify(config.business_hours)]);

  // --- Save debounce 800ms -------------------------------------
  const saveTimer = useRef<any>(null);
  function scheduleSave(patch: Record<string, any>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveConfig(patch);
      } catch (err: any) {
        toast.error(err?.message || "Erro ao salvar entrega");
      }
    }, 800);
  }

  // --- Handlers de toggles -------------------------------------
  function handlePickupToggle(v: boolean) {
    setPickupEnabled(v);
    scheduleSave({ pickup_enabled: v });
  }
  function handleDeliveryToggle(v: boolean) {
    setDeliveryEnabled(v);
    scheduleSave({ delivery_enabled: v });
  }

  // --- Handlers de campos texto livres -------------------------
  function handlePickupAddress(v: string) {
    setPickupAddress(v);
    scheduleSave({ pickup_address: v });
  }
  function handlePickupEta(v: string) {
    setPickupEtaText(v);
    scheduleSave({ pickup_eta_text: v });
  }
  function handleDeliveryEta(v: string) {
    setDeliveryEtaText(v);
    scheduleSave({ delivery_eta_text: v });
  }

  // --- Modo de cobrança ---------------------------------------
  function handlePricingMode(v: PricingMode) {
    setPricingMode(v);
    scheduleSave({ delivery_pricing_mode: v });
  }

  // --- Taxa única ---------------------------------------------
  function handleDeliveryFee(v: string) {
    setDeliveryFeeText(v);
    scheduleSave({ delivery_fee: parseMoney(v) });
  }

  // --- CEP origem ---------------------------------------------
  function handleOriginZip(v: string) {
    const masked = maskZip(v);
    setOriginZipMasked(masked);
    const digits = zipDigits(masked);
    // Só persiste quando vazio ou 8 dígitos (válido)
    if (digits.length === 0 || digits.length === 8) {
      scheduleSave({ origin_zip: digits });
    }
  }

  // --- Frete grátis acima --------------------------------------
  function handleFreeAbove(v: string) {
    setFreeAboveText(v);
    if (!v || v.trim() === "") {
      scheduleSave({ delivery_free_above_amount: null });
    } else {
      scheduleSave({ delivery_free_above_amount: parseMoney(v) });
    }
  }

  // --- Tiers --------------------------------------------------
  function persistTiers(next: DistanceTier[]) {
    // Ordena por max_km asc e filtra inválidos antes de salvar
    const cleaned = next
      .map((t) => ({
        max_km: Number.isFinite(parseFloat(String(t.max_km))) ? parseFloat(String(t.max_km)) : 0,
        fee: Number.isFinite(parseFloat(String(t.fee))) ? parseFloat(String(t.fee)) : 0,
      }))
      .filter((t) => t.max_km > 0 && t.fee >= 0)
      .sort((a, b) => a.max_km - b.max_km);
    scheduleSave({ delivery_distance_tiers: cleaned });
  }

  function addTier() {
    if (tiers.length >= 3) {
      toast.info("Máximo de 3 faixas");
      return;
    }
    // Sugere max_km um pouco acima da última faixa
    const last = tiers[tiers.length - 1];
    const suggestedKm = last ? last.max_km + 5 : 5;
    const next: DistanceTier[] = [...tiers, { max_km: suggestedKm, fee: 0 }];
    setTiers(next);
    persistTiers(next);
  }

  function removeTier(idx: number) {
    const next = tiers.filter((_, i) => i !== idx);
    setTiers(next);
    persistTiers(next);
  }

  function updateTier(idx: number, patch: Partial<DistanceTier>) {
    const next = tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    setTiers(next);
    persistTiers(next);
  }

  // --- Horário ------------------------------------------------
  function updateHourDay(key: keyof BusinessHours, patch: Partial<BusinessHourDay>) {
    const nextDay: BusinessHourDay = { ...businessHours[key], ...patch };
    const isClosed = !nextDay.open && !nextDay.close;
    nextDay.closed = isClosed;
    const next: BusinessHours = { ...businessHours, [key]: nextDay };
    setBusinessHours(next);
    // Valida HH:MM antes de salvar — se inválido, deixa o usuário corrigir
    const allValid = DAYS.every(({ key: k }) => {
      const d = next[k];
      return isValidTime(d.open) && isValidTime(d.close);
    });
    if (allValid) {
      scheduleSave({ business_hours: next });
    }
  }

  // --- Estado derivado: geocoding ------------------------------
  const originZipDigits = zipDigits(originZipMasked);
  const hasGeocode =
    pricingMode === "distance" &&
    originZipDigits.length === 8 &&
    config.origin_lat != null &&
    config.origin_lng != null;
  const geocodeFailed =
    pricingMode === "distance" &&
    originZipDigits.length === 8 &&
    (config.origin_lat == null || config.origin_lng == null);

  // --- Preview do checkout -------------------------------------
  const previewFlatPrice =
    pricingMode === "flat"
      ? parseMoney(deliveryFeeText)
      : tiers.length > 0
        ? tiers[0].fee
        : 0;
  const previewTierLabel =
    pricingMode === "distance" && tiers.length > 0
      ? `Até ${tiers[0].max_km} km`
      : "";

  // ============================================================
  // Render
  // ============================================================
  return (
    <View>
      <View style={s.tabIntro}>
        <Icon name="info" size={14} color={Colors.violet3} />
        <Text style={s.tabIntroText}>
          Configure como o cliente recebe o pedido: retirada, entrega ou ambos. Tudo aparece direto no checkout da sua loja.
        </Text>
      </View>

      {/* Cards grid */}
      <View style={IS_WIDE ? s.gridWide : s.gridStack}>
        {/* ---------------- Card 1: Retirada ---------------- */}
        <View style={[cs.card, IS_WIDE && s.gridCell]}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>
              <Text style={s.emoji}>🏬</Text> Retirada no local
            </Text>
            <Switch
              value={pickupEnabled}
              onValueChange={handlePickupToggle}
              trackColor={{ false: Colors.border, true: Colors.violet }}
              thumbColor="#fff"
            />
          </View>

          {pickupEnabled ? (
            <View style={{ marginTop: 6 }}>
              <Field
                label="Endereço de retirada"
                value={pickupAddress}
                onChange={handlePickupAddress}
                placeholder="Ex: Rua das Flores, 123 — Centro, Jacareí/SP"
                multiline
              />
              <Text style={s.helper}>
                Aparece pro cliente no checkout depois que ele escolhe "Retirar". Pode ser diferente do endereço do negócio.
              </Text>

              <View style={s.sectionSep} />

              <Field
                label="Tempo para ficar pronto"
                value={pickupEtaText}
                onChange={handlePickupEta}
                placeholder="Ex: Em até 1 hora após confirmação"
              />
              <Text style={s.helper}>
                Texto livre. Ex: "Em 30 min", "No mesmo dia", "Em 1 dia útil".
              </Text>
            </View>
          ) : (
            <Text style={s.disabledHint}>
              Cliente não verá opção de retirar na loja.
            </Text>
          )}
        </View>

        {/* ---------------- Card 2: Entrega ---------------- */}
        <View style={[cs.card, IS_WIDE && s.gridCell]}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>
              <Text style={s.emoji}>🛵</Text> Entrega a domicílio
            </Text>
            <Switch
              value={deliveryEnabled}
              onValueChange={handleDeliveryToggle}
              trackColor={{ false: Colors.border, true: Colors.violet }}
              thumbColor="#fff"
            />
          </View>

          {deliveryEnabled ? (
            <View style={{ marginTop: 6 }}>
              {/* --- Modo de cobrança (mode-cards com descrição) --- */}
              <Text style={cs.fieldLabel}>Modo de cobrança</Text>
              <View style={NARROW ? s.modeGridStack : s.modeGrid}>
                <Pressable
                  style={[s.modeCard, pricingMode === "flat" && s.modeCardActive]}
                  onPress={() => handlePricingMode("flat")}
                >
                  <Text style={[s.modeCardName, pricingMode === "flat" && s.modeCardNameActive]}>
                    Taxa única
                  </Text>
                  <Text style={s.modeCardDesc}>
                    Mesmo valor pra qualquer endereço
                  </Text>
                </Pressable>
                <Pressable
                  style={[s.modeCard, pricingMode === "distance" && s.modeCardActive]}
                  onPress={() => handlePricingMode("distance")}
                >
                  <Text style={[s.modeCardName, pricingMode === "distance" && s.modeCardNameActive]}>
                    Por distância
                  </Text>
                  <Text style={s.modeCardDesc}>
                    Valor varia com km do cliente
                  </Text>
                </Pressable>
              </View>

              {/* --- Flat --- */}
              {pricingMode === "flat" && (
                <>
                  <View style={s.sectionSep} />
                  <Text style={cs.fieldLabel}>Taxa de entrega</Text>
                  <View style={s.inlineInput}>
                    <View style={s.inlinePrefixWrap}>
                      <Text style={s.inlinePrefix}>R$</Text>
                    </View>
                    <TextInput
                      style={s.inlineField}
                      value={deliveryFeeText}
                      onChangeText={handleDeliveryFee}
                      placeholder="0,00"
                      placeholderTextColor={Colors.ink3}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Text style={s.helper}>
                    Mesmo valor pra qualquer endereço dentro da área que você atende.
                  </Text>
                </>
              )}

              {/* --- Distance --- */}
              {pricingMode === "distance" && (
                <>
                  <View style={s.sectionSep} />
                  <Text style={cs.fieldLabel}>CEP de origem</Text>
                  <View style={[s.inlineInput, { maxWidth: 200 }]}>
                    <TextInput
                      style={[s.inlineField, { paddingLeft: 4 }]}
                      value={originZipMasked}
                      onChangeText={handleOriginZip}
                      placeholder="00000-000"
                      placeholderTextColor={Colors.ink3}
                      keyboardType="numeric"
                      maxLength={9}
                    />
                  </View>
                  <Text style={s.helper}>
                    A distância é calculada em km entre esse CEP e o CEP do cliente.
                  </Text>

                  {hasGeocode && (
                    <View style={s.geoOkBadge}>
                      <Icon name="check" size={12} color={Colors.green} />
                      <Text style={s.geoOkText}>CEP geolocalizado</Text>
                    </View>
                  )}

                  {geocodeFailed && (
                    <View style={s.warnBox}>
                      <Icon name="alert" size={14} color={Colors.amber} />
                      <Text style={s.warnText}>
                        Esse CEP não foi geolocalizado. A cobrança vai cair em taxa única pra todos os pedidos. Tente outro CEP próximo.
                      </Text>
                    </View>
                  )}

                  <View style={s.sectionSep} />

                  <Text style={cs.fieldLabel}>
                    Faixas de cobrança por distância
                  </Text>

                  {tiers.length === 0 ? (
                    <View style={s.tierEmpty}>
                      <Text style={s.tierEmptyEmoji}>📏</Text>
                      <Text style={s.tierEmptyTitle}>Nenhuma faixa configurada</Text>
                      <Text style={s.tierEmptyHint}>
                        Defina até 3 faixas por distância. Ex: "Até 5 km = R$ 10 · Até 10 km = R$ 18 · Até 20 km = R$ 28".
                      </Text>
                      <Pressable style={s.tierEmptyCta} onPress={addTier}>
                        <Icon name="plus" size={14} color={Colors.violet3} />
                        <Text style={s.tierEmptyCtaText}>Adicionar primeira faixa</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      {tiers.map((t, idx) => (
                        <View key={idx} style={s.tierRow}>
                          <View style={s.tierField}>
                            <TextInput
                              style={s.tierInput}
                              value={String(t.max_km || "")}
                              onChangeText={(v) => {
                                const num = parseFloat(String(v).replace(",", "."));
                                updateTier(idx, { max_km: Number.isFinite(num) ? num : 0 });
                              }}
                              placeholder="0"
                              placeholderTextColor={Colors.ink3}
                              keyboardType="decimal-pad"
                            />
                            <Text style={s.tierUnit}>km</Text>
                          </View>
                          <View style={s.tierField}>
                            <View style={s.inlinePrefixWrapSm}>
                              <Text style={s.tierPrefix}>R$</Text>
                            </View>
                            <TextInput
                              style={s.tierInput}
                              value={fmtMoney(t.fee)}
                              onChangeText={(v) => {
                                updateTier(idx, { fee: parseMoney(v) });
                              }}
                              placeholder="0,00"
                              placeholderTextColor={Colors.ink3}
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <Pressable
                            onPress={() => removeTier(idx)}
                            style={s.tierRemove}
                            accessibilityLabel="Remover faixa"
                          >
                            <Icon name="x" size={14} color={Colors.ink3} />
                          </Pressable>
                        </View>
                      ))}

                      {tiers.length < 3 && (
                        <Pressable style={s.addTierBtn} onPress={addTier}>
                          <Icon name="plus" size={14} color={Colors.violet3} />
                          <Text style={s.addTierText}>Adicionar faixa ({tiers.length}/3)</Text>
                        </Pressable>
                      )}

                      <Text style={s.helper}>
                        Exemplo: {tiers
                          .map((t) => `Até ${t.max_km} km = R$${fmtMoney(t.fee)}`)
                          .join(" · ")}.
                      </Text>
                    </>
                  )}
                </>
              )}

              <View style={s.sectionSep} />

              {/* --- Frete grátis (sub-card destacado) --- */}
              <View style={s.freteBlock}>
                <View style={s.freteBlockHead}>
                  <Text style={s.freteBlockEmoji}>💸</Text>
                  <Text style={s.freteBlockTitle}>Frete grátis acima de</Text>
                </View>
                <View style={s.inlineInput}>
                  <View style={s.inlinePrefixWrap}>
                    <Text style={s.inlinePrefix}>R$</Text>
                  </View>
                  <TextInput
                    style={s.inlineField}
                    value={freeAboveText}
                    onChangeText={handleFreeAbove}
                    placeholder="0,00"
                    placeholderTextColor={Colors.ink3}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={s.helper}>
                  Opcional. Cliente que comprar acima desse valor não paga frete.
                </Text>
              </View>

              <View style={s.sectionSep} />

              {/* --- ETA --- */}
              <Field
                label="Tempo estimado de entrega"
                value={deliveryEtaText}
                onChange={handleDeliveryEta}
                placeholder="Ex: Em até 2h corridas"
              />
              <Text style={s.helper}>
                Texto livre. Ex: "Em 2-4 horas", "No mesmo dia", "1-3 dias úteis".
              </Text>
            </View>
          ) : (
            <Text style={s.disabledHint}>
              Cliente não verá opção de entrega a domicílio.
            </Text>
          )}
        </View>
      </View>

      {/* ---------------- Card 3: Horário (full width) ---------------- */}
      <View style={[cs.card, { marginTop: 4 }]}>
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>
            <Text style={s.emoji}>🕒</Text> Horário de funcionamento
          </Text>
          <Text style={s.cardHeadHint}>
            Cliente vê "Aberta / Fechada" no topo da loja
          </Text>
        </View>
        <Text style={s.helper}>
          Use o mesmo horário pra retirada e entrega — ou deixe um dia em branco pra marcar como fechado.
        </Text>

        <View style={{ marginTop: 10 }}>
          {DAYS.map(({ key, label }) => {
            const day = businessHours[key];
            const isClosed = !day.open && !day.close;
            return (
              <View key={key} style={s.hourRow}>
                <Text style={s.hourLabel}>{label}</Text>
                <View style={s.hourFieldGroup}>
                  <Text style={s.hourSmall}>Abre</Text>
                  <TextInput
                    style={[
                      s.hourInput,
                      day.open && !isValidTime(day.open) && s.hourInputError,
                    ]}
                    value={day.open}
                    onChangeText={(v) => updateHourDay(key, { open: maskTime(v) })}
                    placeholder="—"
                    placeholderTextColor={Colors.ink3}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
                <View style={s.hourFieldGroup}>
                  <Text style={s.hourSmall}>Fecha</Text>
                  <TextInput
                    style={[
                      s.hourInput,
                      day.close && !isValidTime(day.close) && s.hourInputError,
                    ]}
                    value={day.close}
                    onChangeText={(v) => updateHourDay(key, { close: maskTime(v) })}
                    placeholder="—"
                    placeholderTextColor={Colors.ink3}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
                <View style={s.hourStatus}>
                  <View
                    style={[
                      s.hourDot,
                      { backgroundColor: isClosed ? Colors.red : Colors.green },
                    ]}
                  />
                  <Text
                    style={[
                      s.hourStatusText,
                      { color: isClosed ? Colors.red : Colors.green },
                    ]}
                  >
                    {isClosed ? "Fechada" : "Aberta"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* ---------------- Preview do checkout ---------------- */}
      {(pickupEnabled || deliveryEnabled) && (
        <View style={s.previewCard}>
          <Text style={s.previewLabel}>Como aparece no checkout do cliente</Text>

          {pickupEnabled && (
            <View style={s.previewRow}>
              <View style={s.previewIcon}>
                <Text style={{ fontSize: 18 }}>🏬</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.previewTitle}>Retirar na loja</Text>
                <Text style={s.previewSub} numberOfLines={2}>
                  {pickupAddress
                    ? pickupAddress
                    : "Endereço aparece aqui"}
                  {pickupEtaText ? ` · ${pickupEtaText}` : ""}
                </Text>
              </View>
              <Text style={s.previewPrice}>Grátis</Text>
            </View>
          )}

          {deliveryEnabled && (
            <View style={[s.previewRow, pickupEnabled && { marginTop: 8 }]}>
              <View style={s.previewIcon}>
                <Text style={{ fontSize: 18 }}>🛵</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.previewTitle}>Entrega a domicílio</Text>
                <Text style={s.previewSub} numberOfLines={2}>
                  {previewTierLabel ? `${previewTierLabel}` : "Cobertura conforme distância"}
                  {deliveryEtaText ? ` · ${deliveryEtaText}` : ""}
                </Text>
              </View>
              <Text style={s.previewPrice}>
                {previewFlatPrice > 0 ? `R$ ${fmtMoney(previewFlatPrice)}` : "—"}
              </Text>
            </View>
          )}
        </View>
      )}

      {isSaving && (
        <View style={s.savingPill}>
          <ActivityIndicator size="small" color={Colors.violet} />
          <Text style={s.savingText}>Salvando…</Text>
        </View>
      )}
    </View>
  );
}

// ============================================================
// Estilos
// ============================================================
const s = StyleSheet.create({
  tabIntro: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.violetD,
    borderLeftWidth: 3, borderLeftColor: Colors.violet,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, marginBottom: 12,
  },
  tabIntroText: { flex: 1, fontSize: 12, color: Colors.violet3, lineHeight: 17 },

  gridWide: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  gridStack: { flexDirection: "column" },
  gridCell: { flex: 1, marginBottom: 0 },

  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, flex: 1 },
  cardHeadHint: { fontSize: 10, color: Colors.ink3, fontWeight: "500", textAlign: "right", flex: 1 },
  emoji: { fontSize: 16 },

  // Helper text — espaçamento natural abaixo do input (era marginTop:-8, colava)
  helper: { fontSize: 11, color: Colors.ink3, lineHeight: 15, marginTop: 4, marginBottom: 0 },
  disabledHint: {
    fontSize: 12, color: Colors.ink3, fontStyle: "italic",
    paddingVertical: 6,
  },

  // Separadores entre sub-seções dentro do mesmo card
  sectionSep: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },

  // Inputs com prefixo/sufixo inline (R$, km) — POLISH: max-width 220, height 44, borderRight no prefix
  inlineInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bg4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 44,
    maxWidth: 220,
  },
  inlinePrefixWrap: {
    paddingRight: 10,
    marginRight: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    height: 22,
    justifyContent: "center",
  },
  inlinePrefix: {
    fontSize: 13, color: Colors.ink3, fontWeight: "700",
  },
  inlineField: {
    flex: 1,
    fontSize: 14, color: Colors.ink,
    paddingVertical: 0,
    height: "100%",
    fontWeight: "500",
  },

  // Mode-cards (Modo de cobrança) — substitui ChipToggle
  modeGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  modeGridStack: {
    flexDirection: "column",
    gap: 8,
    marginTop: 8,
  },
  modeCard: {
    flex: 1,
    backgroundColor: Colors.bg4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  modeCardActive: {
    backgroundColor: Colors.violetD,
    borderColor: Colors.violet,
  },
  modeCardName: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: 3,
  },
  modeCardNameActive: { color: Colors.violet3 },
  modeCardDesc: {
    fontSize: 11,
    color: Colors.ink3,
    lineHeight: 15,
  },

  // Geocode success badge
  geoOkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: Colors.greenD,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  geoOkText: {
    fontSize: 10,
    color: Colors.green,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // Warning âmbar (CEP não geolocalizado)
  warnBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.amberD,
    borderLeftWidth: 3, borderLeftColor: Colors.amber,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, marginTop: 10,
  },
  warnText: { flex: 1, fontSize: 11, color: Colors.amber, lineHeight: 15 },

  // Empty state das faixas
  tierEmpty: {
    backgroundColor: Colors.bg4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 6,
  },
  tierEmptyEmoji: { fontSize: 24, marginBottom: 6 },
  tierEmptyTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: 4,
  },
  tierEmptyHint: {
    fontSize: 11,
    color: Colors.ink3,
    lineHeight: 15,
    textAlign: "center",
    maxWidth: 360,
    marginBottom: 12,
  },
  tierEmptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  tierEmptyCtaText: {
    fontSize: 12,
    color: Colors.violet3,
    fontWeight: "700",
  },

  // Tiers (filled)
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  tierField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bg4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    height: 40,
  },
  inlinePrefixWrapSm: {
    paddingRight: 8,
    marginRight: 8,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    height: 18,
    justifyContent: "center",
  },
  tierInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.ink,
    paddingVertical: 0,
    height: "100%",
    fontWeight: "500",
  },
  tierUnit: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginLeft: 6 },
  tierPrefix: { fontSize: 13, color: Colors.ink3, fontWeight: "700" },
  tierRemove: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.bg4,
    borderWidth: 1, borderColor: Colors.border,
  },
  addTierBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.bg4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    marginTop: 10,
    marginBottom: 6,
  },
  addTierText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },

  // Frete grátis em sub-card destacado
  freteBlock: {
    backgroundColor: Colors.bg4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  freteBlockHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  freteBlockEmoji: { fontSize: 16 },
  freteBlockTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.ink2,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // Horário
  hourRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hourLabel: {
    width: 40,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.ink,
  },
  hourFieldGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  hourSmall: {
    fontSize: 10,
    color: Colors.ink3,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  hourInput: {
    flex: 1,
    minWidth: 60,
    maxWidth: 80,
    backgroundColor: Colors.bg4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.ink,
    textAlign: "center",
  },
  hourInputError: { borderColor: Colors.red },
  hourStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    width: 70,
    justifyContent: "flex-end",
  },
  hourDot: { width: 8, height: 8, borderRadius: 4 },
  hourStatusText: { fontSize: 11, fontWeight: "700" },

  // Preview
  previewCard: {
    backgroundColor: Colors.bg4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginTop: 12,
  },
  previewLabel: {
    fontSize: 11,
    color: Colors.ink3,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.bg3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  previewIcon: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: Colors.violetD,
    alignItems: "center", justifyContent: "center",
  },
  previewTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  previewSub: { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 15 },
  previewPrice: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },

  savingPill: {
    position: "absolute",
    bottom: 16, left: 16,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.violetD,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border,
  },
  savingText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});
