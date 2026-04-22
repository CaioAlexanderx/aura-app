// ============================================================
// AURA. — AccessCodesCard (Gestao Aura / Painel)
// Card completo pra criacao e gestao de codigos de acesso.
// Permite equipe Aura:
// - Criar codigo manual (BETA03, CLIENTE-LORENA, etc)
// - Escolher tipo (trial/promo/manual), plano, trial_days,
//   discount_pct, max_uses, expires_at
// - Listar codigos existentes com filtros (tipo/ativos/busca)
// - Copiar codigo pra clipboard
// - Ativar/desativar
// ============================================================
import { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { adminApi, AccessCodeRow, CreateAccessCodeBody } from "@/services/api";

var isWeb = Platform.OS === "web";

// ── Helpers ───────────────────────────────────────────────────
var CODE_REGEX = /^[A-Z0-9-]{3,20}$/;

function copyToClipboard(text: string) {
  if (isWeb && typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).then(
      function() { toast.success("Codigo copiado: " + text); },
      function() { toast.error("Nao foi possivel copiar"); }
    );
  } else {
    toast.info("Codigo: " + text);
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  var d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function typeBadgeColors(type: string): { bg: string; text: string } {
  switch (type) {
    case "trial":    return { bg: Colors.violetD,  text: Colors.violet3 };
    case "promo":    return { bg: Colors.amberD,   text: Colors.amber };
    case "manual":   return { bg: Colors.greenD,   text: Colors.green };
    case "referral": return { bg: Colors.bg4,      text: Colors.ink3 };
    default:         return { bg: Colors.bg4,      text: Colors.ink3 };
  }
}

// ── Componente ────────────────────────────────────────────────
export function AccessCodesCard() {
  var qc = useQueryClient();
  var [expanded, setExpanded] = useState(false);
  var [filterType, setFilterType] = useState<string>(""); // "" = todos
  var [filterActive, setFilterActive] = useState<string>(""); // "" | "true" | "false"
  var [search, setSearch] = useState("");

  // Form state
  var [formCode, setFormCode] = useState("");
  var [formType, setFormType] = useState<"trial" | "promo" | "manual">("trial");
  var [formPlan, setFormPlan] = useState<"essencial" | "negocio" | "expansao" | "personalizado">("negocio");
  var [formTrialDays, setFormTrialDays] = useState("30");
  var [formDiscount, setFormDiscount] = useState("0");
  var [formMaxUses, setFormMaxUses] = useState("1");
  var [formExpires, setFormExpires] = useState(""); // YYYY-MM-DD

  // Derived validation
  var codeNormalized = formCode.toUpperCase().trim();
  var codeValid = CODE_REGEX.test(codeNormalized);
  var codeError = formCode && !codeValid ? "Use 3-20 caracteres: A-Z, 0-9 ou hifen" : "";

  // Query: lista de codigos
  var { data, isLoading } = useQuery({
    queryKey: ["admin-access-codes", filterType, filterActive],
    queryFn: function() {
      return adminApi.accessCodes.list({
        type: filterType || undefined,
        is_active: filterActive === "" ? undefined : filterActive === "true",
        limit: 100,
      });
    },
    staleTime: 30_000,
  });

  // Filtro client-side por busca (evita round-trip enquanto digita)
  var filteredCodes = useMemo(function() {
    if (!data?.codes) return [];
    if (!search.trim()) return data.codes;
    var term = search.toUpperCase().trim();
    return data.codes.filter(function(c) { return c.code.includes(term); });
  }, [data?.codes, search]);

  // Mutation: create
  var createMutation = useMutation({
    mutationFn: function(body: CreateAccessCodeBody) { return adminApi.accessCodes.create(body); },
    onSuccess: function(result) {
      toast.success("Codigo " + result.code.code + " criado");
      qc.invalidateQueries({ queryKey: ["admin-access-codes"] });
      // Reset form
      setFormCode("");
      setFormTrialDays("30");
      setFormDiscount("0");
      setFormMaxUses("1");
      setFormExpires("");
    },
    onError: function(err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao criar codigo");
    },
  });

  // Mutation: toggle
  var toggleMutation = useMutation({
    mutationFn: function(args: { id: string; is_active: boolean }) {
      return adminApi.accessCodes.toggle(args.id, args.is_active);
    },
    onSuccess: function(result) {
      toast.success(result.code.is_active ? "Codigo ativado" : "Codigo desativado");
      qc.invalidateQueries({ queryKey: ["admin-access-codes"] });
    },
    onError: function() { toast.error("Erro ao alterar status"); },
  });

  function handleCreate() {
    if (!codeValid) {
      toast.error("Codigo invalido");
      return;
    }
    var trialDays = parseInt(formTrialDays, 10) || 0;
    var discount = parseInt(formDiscount, 10) || 0;
    var maxUses = parseInt(formMaxUses, 10) || 1;
    if (maxUses < 1) { toast.error("Max usos deve ser >= 1"); return; }

    var body: CreateAccessCodeBody = {
      code: codeNormalized,
      type: formType,
      plan: formPlan,
      trial_days: trialDays,
      discount_pct: discount,
      max_uses: maxUses,
    };
    if (formExpires) {
      // YYYY-MM-DD fim do dia UTC
      body.expires_at = new Date(formExpires + "T23:59:59Z").toISOString();
    }
    createMutation.mutate(body);
  }

  function Chip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
    var bg = active ? (color || Colors.violet3) : Colors.bg4;
    var fg = active ? "#fff" : Colors.ink3;
    return (
      <Pressable onPress={onPress} style={[s.chip, { backgroundColor: bg }]}>
        <Text style={[s.chipText, { color: fg }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={s.card}>
      {/* Header clicavel pra expandir */}
      <Pressable onPress={function() { setExpanded(!expanded); }} style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.iconBadge}>
            <Icon name="key" size={14} color={Colors.violet3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Codigos de acesso</Text>
            <Text style={s.subtitle}>
              {data ? data.codes.length + " codigo" + (data.codes.length !== 1 ? "s" : "") : "Carregando..."}
              {" · "}
              Crie trials, promocoes e acessos personalizados
            </Text>
          </View>
        </View>
        <Icon name={expanded ? "chevron_up" : "chevron_down"} size={16} color={Colors.ink3} />
      </Pressable>

      {expanded && (
        <>
          {/* ── FORM ───────────────────────────────── */}
          <View style={s.formSection}>
            <Text style={s.sectionLabel}>Criar novo codigo</Text>

            {/* Linha 1: code + type */}
            <View style={s.row}>
              <View style={{ flex: 2 }}>
                <Text style={s.fieldLabel}>Codigo</Text>
                <TextInput
                  value={formCode}
                  onChangeText={function(t) { setFormCode(t.toUpperCase()); }}
                  placeholder="Ex: BETA03, CLIENTE-LORENA"
                  placeholderTextColor={Colors.ink3}
                  autoCapitalize="characters"
                  style={[s.input, codeError && s.inputError]}
                  maxLength={20}
                />
                {codeError ? <Text style={s.errorHint}>{codeError}</Text> : <Text style={s.hint}>3-20 chars: A-Z, 0-9, hifen</Text>}
              </View>
              <View style={{ flex: 1.2 }}>
                <Text style={s.fieldLabel}>Tipo</Text>
                <View style={s.chipRow}>
                  <Chip label="Trial" active={formType === "trial"} onPress={function() { setFormType("trial"); }} />
                  <Chip label="Promo" active={formType === "promo"} onPress={function() { setFormType("promo"); }} color={Colors.amber} />
                  <Chip label="Manual" active={formType === "manual"} onPress={function() { setFormType("manual"); }} color={Colors.green} />
                </View>
              </View>
            </View>

            {/* Linha 2: plano + trial days + discount */}
            <View style={s.row}>
              <View style={{ flex: 2 }}>
                <Text style={s.fieldLabel}>Plano de acesso</Text>
                <View style={s.chipRow}>
                  <Chip label="Essencial" active={formPlan === "essencial"} onPress={function() { setFormPlan("essencial"); }} />
                  <Chip label="Negocio" active={formPlan === "negocio"} onPress={function() { setFormPlan("negocio"); }} />
                  <Chip label="Expansao" active={formPlan === "expansao"} onPress={function() { setFormPlan("expansao"); }} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Dias gratis</Text>
                <TextInput
                  value={formTrialDays}
                  onChangeText={setFormTrialDays}
                  keyboardType="numeric"
                  placeholder="30"
                  placeholderTextColor={Colors.ink3}
                  style={s.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Desconto %</Text>
                <TextInput
                  value={formDiscount}
                  onChangeText={setFormDiscount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.ink3}
                  style={s.input}
                />
              </View>
            </View>

            {/* Linha 3: max uses + expires */}
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Max usos</Text>
                <TextInput
                  value={formMaxUses}
                  onChangeText={setFormMaxUses}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={Colors.ink3}
                  style={s.input}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={s.fieldLabel}>Expira em (opcional)</Text>
                <TextInput
                  value={formExpires}
                  onChangeText={setFormExpires}
                  placeholder="YYYY-MM-DD (vazio = sem expiracao)"
                  placeholderTextColor={Colors.ink3}
                  style={s.input}
                />
              </View>
              <View style={{ flex: 1, justifyContent: "flex-end" }}>
                <Pressable
                  onPress={handleCreate}
                  disabled={!codeValid || createMutation.isPending}
                  style={[s.createBtn, (!codeValid || createMutation.isPending) && s.createBtnDisabled]}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Icon name="plus" size={12} color="#fff" />
                      <Text style={s.createBtnText}>Criar</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>

          {/* ── FILTROS + LISTA ─────────────────────── */}
          <View style={s.listSection}>
            <View style={s.filtersRow}>
              <TextInput
                value={search}
                onChangeText={function(t) { setSearch(t.toUpperCase()); }}
                placeholder="Buscar por codigo..."
                placeholderTextColor={Colors.ink3}
                style={[s.input, { flex: 2 }]}
              />
              <View style={[s.chipRow, { flex: 2 }]}>
                <Chip label="Todos" active={filterType === ""} onPress={function() { setFilterType(""); }} />
                <Chip label="Trial" active={filterType === "trial"} onPress={function() { setFilterType("trial"); }} />
                <Chip label="Promo" active={filterType === "promo"} onPress={function() { setFilterType("promo"); }} color={Colors.amber} />
                <Chip label="Manual" active={filterType === "manual"} onPress={function() { setFilterType("manual"); }} color={Colors.green} />
                <Chip label="Indic" active={filterType === "referral"} onPress={function() { setFilterType("referral"); }} />
              </View>
              <View style={[s.chipRow, { flex: 1 }]}>
                <Chip label="Todos" active={filterActive === ""} onPress={function() { setFilterActive(""); }} />
                <Chip label="Ativos" active={filterActive === "true"} onPress={function() { setFilterActive("true"); }} color={Colors.green} />
                <Chip label="Inativos" active={filterActive === "false"} onPress={function() { setFilterActive("false"); }} color={Colors.red} />
              </View>
            </View>

            {isLoading && <ActivityIndicator color={Colors.violet3} style={{ marginTop: 16 }} />}
            {!isLoading && filteredCodes.length === 0 && (
              <View style={s.emptyState}>
                <Text style={s.emptyText}>Nenhum codigo encontrado com esses filtros.</Text>
              </View>
            )}

            {filteredCodes.map(function(c) {
              var tb = typeBadgeColors(c.type);
              var expired = c.expires_at && new Date(c.expires_at) < new Date();
              var usesPct = c.max_uses > 0 ? Math.min((c.uses / c.max_uses) * 100, 100) : 0;
              var usesFull = c.uses >= c.max_uses;

              return (
                <View key={c.id} style={[s.codeRow, !c.is_active && s.codeRowInactive]}>
                  {/* Codigo + tipo */}
                  <View style={{ flex: 1.8, gap: 4 }}>
                    <Pressable onPress={function() { copyToClipboard(c.code); }} style={s.codeNameWrap}>
                      <Text style={s.codeName}>{c.code}</Text>
                      <Icon name="copy" size={11} color={Colors.ink3} />
                    </Pressable>
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <View style={[s.typeBadge, { backgroundColor: tb.bg }]}>
                        <Text style={[s.typeBadgeText, { color: tb.text }]}>{c.type}</Text>
                      </View>
                      <Text style={s.codePlan}>{c.plan}</Text>
                    </View>
                  </View>

                  {/* Beneficio */}
                  <View style={{ flex: 1.2 }}>
                    {c.trial_days > 0 && <Text style={s.codeBenefit}>{c.trial_days}d gratis</Text>}
                    {c.discount_pct > 0 && <Text style={s.codeBenefit}>{c.discount_pct}% off</Text>}
                    {c.trial_days === 0 && c.discount_pct === 0 && <Text style={s.codeBenefitMuted}>sem beneficio</Text>}
                  </View>

                  {/* Usos */}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.codeUses, usesFull && { color: Colors.red }]}>
                      {c.uses} / {c.max_uses}
                    </Text>
                    <View style={s.usesBar}>
                      <View style={[s.usesFill, { width: usesPct + "%", backgroundColor: usesFull ? Colors.red : Colors.violet3 }]} />
                    </View>
                  </View>

                  {/* Expira */}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.codeExpiry, expired && { color: Colors.red }]}>
                      {expired ? "expirado" : formatDate(c.expires_at)}
                    </Text>
                  </View>

                  {/* Toggle */}
                  <Pressable
                    onPress={function() { toggleMutation.mutate({ id: c.id, is_active: !c.is_active }); }}
                    disabled={toggleMutation.isPending}
                    style={[s.toggleBtn, c.is_active ? s.toggleBtnOn : s.toggleBtnOff]}
                  >
                    <Text style={[s.toggleText, c.is_active ? { color: Colors.green } : { color: Colors.ink3 }]}>
                      {c.is_active ? "Ativo" : "Inativo"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  iconBadge: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.violetD,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border2,
  },
  title: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  subtitle: { fontSize: 11, color: Colors.ink3, marginTop: 2 },

  formSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: "700", color: Colors.ink3,
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 4,
  },
  row: { flexDirection: "row", gap: 10 },
  fieldLabel: { fontSize: 10, color: Colors.ink3, marginBottom: 4, fontWeight: "600" },
  input: {
    backgroundColor: Colors.bg4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: Colors.ink,
    minHeight: 36,
  },
  inputError: { borderColor: Colors.red },
  hint: { fontSize: 9, color: Colors.ink3, marginTop: 2 },
  errorHint: { fontSize: 9, color: Colors.red, marginTop: 2 },

  chipRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 6, minWidth: 48, alignItems: "center",
  },
  chipText: { fontSize: 10, fontWeight: "700" },

  createBtn: {
    backgroundColor: Colors.violet,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 36,
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  listSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  filtersRow: { flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 },

  emptyState: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 12, color: Colors.ink3 },

  codeRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: Colors.bg4,
    borderWidth: 1, borderColor: Colors.border,
  },
  codeRowInactive: { opacity: 0.55 },
  codeNameWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  codeName: {
    fontSize: 13, fontWeight: "800", color: Colors.ink,
    fontFamily: isWeb ? ("SFMono-Regular, Menlo, monospace" as any) : undefined,
    letterSpacing: 0.3,
  },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  codePlan: { fontSize: 10, color: Colors.ink3, textTransform: "capitalize" },

  codeBenefit: { fontSize: 11, color: Colors.ink, fontWeight: "600" },
  codeBenefitMuted: { fontSize: 11, color: Colors.ink3, fontStyle: "italic" },

  codeUses: { fontSize: 11, color: Colors.ink, fontWeight: "600" },
  usesBar: {
    height: 3, marginTop: 3, borderRadius: 2,
    backgroundColor: Colors.border, overflow: "hidden",
  },
  usesFill: { height: 3, borderRadius: 2 },

  codeExpiry: { fontSize: 10, color: Colors.ink3 },

  toggleBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1,
    minWidth: 64, alignItems: "center",
  },
  toggleBtnOn:  { backgroundColor: Colors.greenD, borderColor: Colors.green + "44" },
  toggleBtnOff: { backgroundColor: Colors.bg3,    borderColor: Colors.border },
  toggleText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
});

export default AccessCodesCard;
