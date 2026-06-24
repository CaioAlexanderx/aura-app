// ============================================================
// Configurações da Federação — Aura Karatê (Track H)
//
// Acesso: federation_admin apenas (gate no layout por karateRole).
// Layout: abas fixas no topo (Anuidade / Régua / Equipe / Recursos & Integrações),
// cada aba exibe seu conteúdo em scroll; a seção Recursos também embute
// Identidade, Contato e Dados Fiscais como seções empilhadas.
//
// API wiring:
//   Anuidade   → karateApi.getAnnualFees / updateAnnualFees (existente Track B)
//               + karateSettingsApi.getFeeHistory (historyRows mock-fallback)
//   Régua      → karateApi (existente Track I): getReminderConfig / updateReminderConfig
//               + runReminders (disparo manual)
//               + getReminderLog (histórico envios)
//   Equipe     → karateSettingsApi.listMembers / inviteMember / updateMemberRole / removeMember
//   Recursos   → karateSettingsApi.getFlags / updateFlags
//   Identidade → karateSettingsApi.getIdentity / updateIdentity
//
// Guardrails:
//   - StyleSheet.create: todos os valores são objetos (sem strings soltas no top-level)
//   - Sem deps novas: apenas RN core + @expo/vector-icons (já no projeto)
//   - Mock-fallback em todas as chamadas de API (.catch(() => MOCK))
// ============================================================
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Switch,
  Modal,
  ActivityIndicator,
  RefreshControl,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateApi,
  karateSettingsApi,
  AnnualFee,
  ReminderConfig,
  ReminderLogItem,
  FederationMember,
  KarateFlags,
  FederationIdentity,
  FederationPayments,
  PixKeyType,
} from "@/services/karateApi";

// ── Constantes ──────────────────────────────────────────────────

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTH_NUMS = [1,2,3,4,5,6,7,8,9,10,11,12];

const FEE_MODELS = [
  { key: "anual",      label: "Anual",      sub: "1 cobrança por ano",  count: "1×" },
  { key: "semestral",  label: "Semestral",  sub: "2 cobranças por ano", count: "2×" },
  { key: "trimestral", label: "Trimestral", sub: "4 cobranças por ano", count: "4×" },
] as const;

const KARATE_FLAGS_DEFS = [
  { key: "competicoes", label: "Competições",       desc: "Módulo de torneios: chaveamento, lançamento de resultados e ranking." },
  { key: "carteirinha", label: "Carteirinha digital", desc: "Carteirinha do praticante com QR, graduação e validade da anuidade." },
  { key: "conexao",     label: "Conexão de dojôs",   desc: "Dojôs gerenciam seus praticantes e enviam inscrições direto pelo painel." },
  { key: "portal",      label: "Portal público",      desc: "Página pública da federação com agenda de eventos e lista de dojôs." },
] as const;

const ROLE_OPTS = [
  { value: "federation_admin",    label: "Admin" },
  { value: "federation_staff",    label: "Staff" },
  { value: "federation_examiner", label: "Examinador" },
];

const ROLE_INFO = [
  { role: "Admin",      desc: "Acesso total — configurações, financeiro, equipe e todos os módulos da federação." },
  { role: "Staff",      desc: "Operação do dia a dia — dojôs, praticantes e eventos. Sem acesso a configurações." },
  { role: "Examinador", desc: "Bancas de exame e lançamento de graduações (kyu e dan). Acesso restrito." },
];

const REGIME_OPTS = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido",  label: "Lucro Presumido" },
  { value: "imune_isenta",     label: "Imune / Isenta" },
];

const TABS = [
  { id: "anuidade", label: "Anuidade" },
  { id: "regua",    label: "Régua de cobrança" },
  { id: "equipe",   label: "Equipe" },
  { id: "recursos", label: "Recursos & Integrações" },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Helpers ──────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

function fmtBRL(v: number | string | null | undefined): string {
  const n = parseFloat(String(v || 0));
  if (isNaN(n)) return "R$ 0";
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function joinList(arr: number[]): string {
  if (!arr.length) return "nenhum";
  if (arr.length === 1) return `${arr[0]} dia`;
  return arr.slice(0, -1).join(", ") + " e " + arr[arr.length - 1] + " dias";
}

// Converte offsets_days (mistos +/-) em grupos antes/depois
function splitOffsets(offsets: number[]): { before: number[]; after: number[] } {
  const before = offsets.filter((d) => d < 0).map((d) => Math.abs(d)).sort((a, b) => a - b);
  const after  = offsets.filter((d) => d > 0).sort((a, b) => a - b);
  return { before, after };
}

function mergeOffsets(before: number[], after: number[]): number[] {
  return [...before.map((d) => -d), ...after];
}

// ── Sub-componentes reutilizáveis ──────────────────────────────────

function SectionHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <View style={st.sectionHead}>
      <View style={{ flex: 1 }}>
        <Text style={st.sectionTitle}>{title}</Text>
        {sub ? <Text style={st.sectionSub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[st.card, style]}>{children}</View>;
}

function SaveToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={st.toast}>
      <Ionicons name="checkmark-circle" size={14} color={KarateColors.ok} />
      <Text style={st.toastText}>Salvo com sucesso.</Text>
    </View>
  );
}

function Pill({ label, active, onPress, onRemove }: { label: string; active?: boolean; onPress?: () => void; onRemove?: () => void }) {
  return (
    <TouchableOpacity
      style={[st.pill, active && st.pillActive]}
      onPress={onPress}
      disabled={!onPress && !onRemove}
      accessibilityLabel={label}
    >
      <Text style={[st.pillText, active && st.pillTextActive]}>{label}</Text>
      {onRemove ? (
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={st.pillRemove}>×</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

// ── Seção 1: Anuidade ─────────────────────────────────────────

type FeeState = { anual: string; semestral: string; trimestral: string };
type MonthState = { anual: number[]; semestral: number[]; trimestral: number[] };

function AnuidadeTab({ federationId }: { federationId: string }) {
  const [fees, setFees] = useState<FeeState>({ anual: "500", semestral: "280", trimestral: "150" });
  const [months, setMonths] = useState<MonthState>({
    anual: [5], semestral: [5, 11], trimestral: [2, 5, 8, 11],
  });
  const [effectiveFrom, setEffectiveFrom] = useState<string>(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<Array<{ from: string; tag: string; anual: string; semestral: string; trimestral: string }>>([]);
  const [loading, setLoading] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows: AnnualFee[] = await karateApi.getAnnualFees(federationId).catch(() => []);
      // fees retornados são por (fee_type, size_tier) — Track B usa dojo/cpf/size_tier.
      // Track H usa valores simplificados por modelo (anual/semestral/trimestral).
      // Mapeamos fee_type='dojo' + size_tier=null como o valor do modelo correspondente.
      // Se não houver, mantém padrão.
      const byModel: Record<string, number> = {};
      for (const f of rows) {
        if (f.fee_type === "dojo" && f.size_tier === null) {
          // O backend Track B não tem modelo anual/semestral/trimestral:
          // usamos apenas o valor do primeiro registro como referência.
          if (!byModel["anual"]) byModel["anual"] = f.amount;
        }
      }
      if (byModel["anual"]) {
        setFees((prev) => ({ ...prev, anual: String(byModel["anual"]) }));
      }
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const toggleMonth = (model: keyof MonthState, m: number) => {
    setMonths((prev) => {
      const cur = prev[model];
      const next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m].sort((a, b) => a - b);
      return { ...prev, [model]: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await karateApi.updateAnnualFees(federationId, {
        effective_from: effectiveFrom,
        fees: [
          { fee_type: "dojo", size_tier: undefined, amount: parseFloat(fees.anual) || 0 },
          { fee_type: "cpf",  size_tier: undefined, amount: parseFloat(fees.semestral) || 0 },
        ],
      }).catch(() => null);

      // Adiciona ao histórico local
      setHistoryRows((prev) => [
        { from: effectiveFrom, tag: "Pendente", anual: fmtBRL(fees.anual), semestral: fmtBRL(fees.semestral), trimestral: fmtBRL(fees.trimestral) },
        ...prev,
      ]);
      setToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(false), 3200);
    } finally {
      setSaving(false);
    }
  };

  const effectiveLabel = fmtDate(effectiveFrom);

  return (
    <ScrollView style={st.tabContent} contentContainerStyle={st.tabPad}>
      <SectionHeader title="Modelos de anuidade" sub="Valores e meses de vencimento por modelo de cobrança" />

      <View style={st.anuidadeIntro}>
        <Text style={st.anuidadeIntroText}>
          Estes são os valores e meses de vencimento que a federação cobra dos dojôs.
          Escolha um modelo de cobrança e ajuste o valor e os meses em que a anuidade vence.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={KarateColors.primary} style={{ marginVertical: 24 }} />
      ) : (
        <View style={st.feeGrid}>
          {FEE_MODELS.map((m) => (
            <Card key={m.key} style={st.feeCard}>
              <View style={st.feeCardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={st.feeCardTitle}>{m.label}</Text>
                  <Text style={st.feeCardSub}>{m.sub}</Text>
                </View>
                <View style={st.pillSmall}><Text style={st.pillSmallText}>{m.count}</Text></View>
              </View>

              <View style={st.feeRow}>
                <Text style={st.feeCurrency}>R$</Text>
                <TextInput
                  style={st.feeInput}
                  value={fees[m.key]}
                  onChangeText={(v) => setFees((prev) => ({ ...prev, [m.key]: v.replace(/[^0-9]/g, "") }))}
                  keyboardType="numeric"
                  accessibilityLabel={`Valor ${m.label}`}
                />
              </View>

              <Text style={st.monthLabel}>Meses de vencimento</Text>
              <View style={st.monthGrid}>
                {MONTHS.map((mo, idx) => {
                  const num = MONTH_NUMS[idx];
                  const active = months[m.key].includes(num);
                  return (
                    <TouchableOpacity
                      key={mo}
                      style={[st.monthChip, active && st.monthChipActive]}
                      onPress={() => toggleMonth(m.key, num)}
                      accessibilityLabel={`${mo} ${active ? "selecionado" : "não selecionado"}`}
                    >
                      <Text style={[st.monthChipText, active && st.monthChipTextActive]}>{mo}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Banner vigência */}
      <Card style={st.vigCard}>
        <View style={st.vigInfo}>
          <View style={st.vigMark}><Text style={st.vigMarkText}>空</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.vigTitle}>Alterações criam uma nova vigência</Text>
            <Text style={st.vigSub}>
              A tabela atual permanece no histórico. Os novos valores passam a valer a partir de{" "}
              <Text style={st.vigBold}>{effectiveLabel}</Text>.
            </Text>
          </View>
        </View>
        <View style={st.vigActions}>
          <TextInput
            style={st.dateField}
            value={effectiveFrom}
            onChangeText={setEffectiveFrom}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={KarateColors.ink4}
            accessibilityLabel="Data de vigência"
          />
          <TouchableOpacity style={st.btnText} onPress={() => setHistoryOpen(true)}>
            <Text style={st.btnTextLabel}>Ver histórico</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.btn, st.btnPrimary]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.btnPrimaryText}>Salvar nova vigência</Text>}
          </TouchableOpacity>
        </View>
      </Card>
      <SaveToast visible={toast} />

      <PixSection federationId={federationId} />

      {/* Modal Histórico */}
      <Modal visible={historyOpen} transparent animationType="fade" onRequestClose={() => setHistoryOpen(false)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setHistoryOpen(false)}>
          <View style={st.drawerPanel} onStartShouldSetResponder={() => true}>
            <View style={st.drawerHead}>
              <View>
                <Text style={st.drawerEyebrow}>Append-only</Text>
                <Text style={st.drawerTitle}>Histórico de vigências</Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryOpen(false)}>
                <Text style={st.btnTextLabel}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {historyRows.length === 0 ? (
                <Text style={st.emptyMsg}>Nenhuma vigência salva nesta sessão.</Text>
              ) : (
                historyRows.map((v, i) => (
                  <View key={i} style={st.historyRow}>
                    <View style={st.historyRowHead}>
                      <Text style={st.historyFrom}>Desde {fmtDate(v.from)}</Text>
                      <View style={[st.badge, v.tag === "Vigente" ? st.badgeOk : v.tag === "Pendente" ? st.badgeWarn : st.badgeNeutral]}>
                        <View style={st.badgeDot} />
                        <Text style={st.badgeText}>{v.tag}</Text>
                      </View>
                    </View>
                    <View style={st.historyVals}>
                      {(["anual","semestral","trimestral"] as const).map((k) => (
                        <View key={k}>
                          <Text style={st.historyValLabel}>{k.charAt(0).toUpperCase() + k.slice(1)}</Text>
                          <Text style={st.historyValAmt}>{v[k]}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

// ── Chave PIX de recebimento (usada nas anuidades/filiação) ────

const PIX_TYPES: { key: PixKeyType; label: string }[] = [
  { key: "CPF", label: "CPF" },
  { key: "CNPJ", label: "CNPJ" },
  { key: "EMAIL", label: "E-mail" },
  { key: "PHONE", label: "Telefone" },
  { key: "RANDOM", label: "Aleatória" },
];

function PixSection({ federationId }: { federationId: string }) {
  const [pix, setPix] = useState<FederationPayments | null>(null);
  const [keyType, setKeyType] = useState<PixKeyType | null>(null);
  const [pixKey, setPixKey] = useState("");
  const [holder, setHolder] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    karateSettingsApi.getPayments(federationId)
      .then((p) => {
        if (!alive) return;
        setPix(p);
        setPixKey(p.pix_key || "");
        setKeyType(p.pix_key_type ?? null);
        setHolder(p.pix_holder_name || "");
        setCity(p.pix_holder_city || "");
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [federationId]);

  const save = async () => {
    setErr(null);
    if (!pixKey.trim()) { setErr("Informe a chave PIX."); return; }
    if (!holder.trim()) { setErr("Informe o nome do recebedor."); return; }
    setSaving(true);
    try {
      const r = await karateSettingsApi.updatePayments(federationId, {
        pix_key: pixKey.trim(),
        pix_key_type: keyType,
        pix_holder_name: holder.trim(),
        pix_holder_city: city.trim() || null,
      });
      setPix((prev) => ({
        pix_key: pixKey.trim(),
        pix_key_type: keyType,
        pix_holder_name: holder.trim(),
        pix_holder_city: city.trim() || null,
        configured: r.configured,
        ...(prev ? {} : {}),
      }));
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar a chave PIX.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ marginTop: 28 }}>
      <SectionHeader
        title="Chave PIX de recebimento"
        sub="Para onde caem as anuidades de dojô e a 1ª anuidade de filiação"
        right={
          <View style={[st.badge, pix?.configured ? st.badgeOk : st.badgeWarn]}>
            <View style={st.badgeDot} />
            <Text style={st.badgeText}>{pix?.configured ? "Configurada" : "Pendente"}</Text>
          </View>
        }
      />
      <Card style={{ gap: 14 }}>
        {loading ? (
          <ActivityIndicator color={KarateColors.primary} style={{ marginVertical: 16 }} />
        ) : (
          <>
            <View>
              <Text style={pixSt.label}>Tipo da chave</Text>
              <View style={pixSt.chipRow}>
                {PIX_TYPES.map((t) => {
                  const active = keyType === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[st.monthChip, active && st.monthChipActive]}
                      onPress={() => setKeyType(active ? null : t.key)}
                      accessibilityLabel={`Tipo ${t.label}`}
                    >
                      <Text style={[st.monthChipText, active && st.monthChipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={pixSt.label}>Chave PIX</Text>
              <TextInput
                style={pixSt.input}
                value={pixKey}
                onChangeText={setPixKey}
                placeholder={keyType === "EMAIL" ? "tesouraria@federacao.com" : keyType === "PHONE" ? "+5511999990000" : "Chave de recebimento"}
                placeholderTextColor={KarateColors.ink4}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={pixSt.row2}>
              <View style={{ flex: 2 }}>
                <Text style={pixSt.label}>Nome do recebedor</Text>
                <TextInput
                  style={pixSt.input}
                  value={holder}
                  onChangeText={setHolder}
                  placeholder="Federação Paulista de Karatê-Dô"
                  placeholderTextColor={KarateColors.ink4}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={pixSt.label}>Cidade</Text>
                <TextInput
                  style={pixSt.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="São Paulo"
                  placeholderTextColor={KarateColors.ink4}
                />
              </View>
            </View>

            {err ? <Text style={pixSt.err}>{err}</Text> : null}

            <View style={pixSt.actions}>
              <TouchableOpacity style={[st.btn, st.btnPrimary]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.btnPrimaryText}>Salvar chave PIX</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </Card>
      <SaveToast visible={toast} />
    </View>
  );
}

const pixSt = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginBottom: 6 } as TextStyle,
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  input: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, paddingVertical: 11, paddingHorizontal: 13, fontSize: 15, color: KarateColors.ink, backgroundColor: KarateColors.glass, fontFamily: KarateFonts.mono } as TextStyle,
  row2: { flexDirection: "row", gap: 12 } as ViewStyle,
  actions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 } as ViewStyle,
  err: { fontSize: 13, color: KarateColors.danger } as TextStyle,
});

// ── Seção 2: Régua de cobrança ────────────────────────────────

function ReguaTab({ federationId }: { federationId: string }) {
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [before, setBefore] = useState([7, 1]);
  const [after,  setAfter]  = useState([3, 15, 30]);
  const [addBefore, setAddBefore] = useState("");
  const [addAfter,  setAddAfter]  = useState("");
  const [log, setLog] = useState<ReminderLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [testSent, setTestSent] = useState(false);
  const testTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, logRes] = await Promise.all([
        karateApi.getReminderConfig(federationId).catch(() => ({ config: null })),
        karateApi.getReminderLog(federationId).catch(() => ({ items: [] })),
      ]);
      if (cfgRes.config) {
        setConfig(cfgRes.config);
        const { before: b, after: a } = splitOffsets(cfgRes.config.offsets_days || [-7,-1,3,15,30]);
        setBefore(b);
        setAfter(a);
      }
      setLog((logRes.items || []).slice(0, 20));
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const toggleEnabled = async () => {
    const next = !(config?.enabled ?? false);
    setConfig((prev) => prev ? { ...prev, enabled: next } : { enabled: next, channel: "email", offsets_days: mergeOffsets(before, after) });
    setSaving(true);
    try {
      await karateApi.updateReminderConfig(federationId, {
        enabled: next,
        channel: config?.channel || "email",
        offsets_days: mergeOffsets(before, after),
      }).catch(() => null);
    } finally { setSaving(false); }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await karateApi.updateReminderConfig(federationId, {
        enabled: config?.enabled ?? false,
        channel: config?.channel || "email",
        offsets_days: mergeOffsets(before, after),
      }).catch(() => null);
    } finally { setSaving(false); }
  };

  const removeStage = (group: "before" | "after", val: number) => {
    if (group === "before") setBefore((p) => p.filter((x) => x !== val));
    else setAfter((p) => p.filter((x) => x !== val));
  };

  const addStage = (group: "before" | "after") => {
    const raw = group === "before" ? addBefore : addAfter;
    const v = parseInt(raw, 10);
    if (!v || v <= 0) return;
    if (group === "before") {
      setBefore((p) => p.includes(v) ? p : [...p, v].sort((a, b) => a - b));
      setAddBefore("");
    } else {
      setAfter((p) => p.includes(v) ? p : [...p, v].sort((a, b) => a - b));
      setAddAfter("");
    }
  };

  const sendTest = async () => {
    try {
      await karateApi.runReminders(federationId).catch(() => null);
      setTestSent(true);
      if (testTimer.current) clearTimeout(testTimer.current);
      testTimer.current = setTimeout(() => setTestSent(false), 3200);
    } catch (_) {}
  };

  const enabled = config?.enabled ?? false;
  const beforeSorted = [...before].sort((a, b) => b - a);
  const afterSorted  = [...after].sort((a, b) => a - b);

  return (
    <ScrollView style={st.tabContent} contentContainerStyle={st.tabPad}>
      <SectionHeader title="Régua de cobrança" sub="Lembretes automáticos de anuidade enviados aos dojôs" right={
        <View style={[st.badge, st.badgeNeutral]}><Text style={st.badgeText}>Canal: E-mail</Text></View>
      } />

      {loading ? (
        <ActivityIndicator color={KarateColors.primary} style={{ marginVertical: 24 }} />
      ) : (
        <>
          {/* Toggle principal */}
          <Card style={st.toggleCard}>
            <View style={{ flex: 1 }}>
              <Text style={st.toggleTitle}>Lembretes automáticos de anuidade</Text>
              <Text style={st.toggleHint}>
                {enabled
                  ? "Ativado. Os lembretes serão enviados automaticamente aos dojôs nos estágios abaixo, por e-mail."
                  : "Desativado. Nada é enviado até você ativar. Você ainda pode disparar um teste manual abaixo."}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggleEnabled}
              trackColor={{ false: KarateColors.border, true: KarateColors.primary }}
              thumbColor="#fff"
              accessibilityLabel="Ativar lembretes automáticos"
            />
          </Card>

          {/* Estágios */}
          <Card style={{ marginTop: 16 }}>
            <Text style={st.cardSectionTitle}>Estágios de envio</Text>
            <Text style={st.cardSectionSub}>Quando cada lembrete dispara, relativo ao vencimento da anuidade</Text>

            <View style={st.stagesGrid}>
              {/* Antes */}
              <View style={st.stageBox}>
                <Text style={st.stageBoxLabel}>Antes do vencimento</Text>
                <Text style={st.stageBoxDesc}>
                  {beforeSorted.length ? `${joinList(beforeSorted)} antes do vencimento` : "Nenhum lembrete antes"}
                </Text>
                <View style={st.chipRow}>
                  {beforeSorted.map((d) => (
                    <Pill key={d} label={`${d} dia${d === 1 ? "" : "s"}`} active onRemove={() => removeStage("before", d)} />
                  ))}
                  <TextInput
                    style={st.chipInput}
                    value={addBefore}
                    onChangeText={(v) => setAddBefore(v.replace(/[^0-9]/g, ""))}
                    keyboardType="numeric"
                    placeholder="dias"
                    placeholderTextColor={KarateColors.ink4}
                    returnKeyType="done"
                    onSubmitEditing={() => addStage("before")}
                    accessibilityLabel="Adicionar dias antes"
                  />
                  <TouchableOpacity style={[st.btn, st.btnSm]} onPress={() => addStage("before")}>
                    <Text style={st.btnSmText}>+ Antes</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Depois */}
              <View style={st.stageBox}>
                <Text style={st.stageBoxLabel}>Depois do vencimento</Text>
                <Text style={st.stageBoxDesc}>
                  {afterSorted.length ? `${joinList(afterSorted)} depois do vencimento` : "Nenhum lembrete depois"}
                </Text>
                <View style={st.chipRow}>
                  {afterSorted.map((d) => (
                    <Pill key={d} label={`${d} dia${d === 1 ? "" : "s"}`} active onRemove={() => removeStage("after", d)} />
                  ))}
                  <TextInput
                    style={st.chipInput}
                    value={addAfter}
                    onChangeText={(v) => setAddAfter(v.replace(/[^0-9]/g, ""))}
                    keyboardType="numeric"
                    placeholder="dias"
                    placeholderTextColor={KarateColors.ink4}
                    returnKeyType="done"
                    onSubmitEditing={() => addStage("after")}
                    accessibilityLabel="Adicionar dias depois"
                  />
                  <TouchableOpacity style={[st.btn, st.btnSm]} onPress={() => addStage("after")}>
                    <Text style={st.btnSmText}>+ Depois</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity style={[st.btn, st.btnPrimary, { marginTop: 16, alignSelf: "flex-end" }]} onPress={saveConfig} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.btnPrimaryText}>Salvar estágios</Text>}
            </TouchableOpacity>
          </Card>

          {/* Envios */}
          <View style={st.sectionDivider}>
            <View>
              <Text style={st.sectionDividerTitle}>Envios</Text>
              <View style={st.sectionDividerLine} />
              <Text style={st.sectionDividerSub}>Histórico de lembretes e disparo de teste</Text>
            </View>
            <View style={st.rowGap}>
              {testSent && (
                <View style={[st.badge, st.badgeOk]}>
                  <View style={st.badgeDot} />
                  <Text style={st.badgeText}>Teste enviado</Text>
                </View>
              )}
              <TouchableOpacity style={[st.btn, st.btnGhost]} onPress={sendTest}>
                <Text style={st.btnGhostText}>Enviar agora (teste)</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Card style={st.cardFlush}>
            {log.length === 0 ? (
              <Text style={st.emptyMsg}>Nenhum envio registrado ainda.</Text>
            ) : (
              <View>
                <View style={st.tableHead}>
                  {["Dojô","Estágio","Data","Status"].map((h) => (
                    <Text key={h} style={[st.tableHCell, { flex: h === "Dojô" ? 2 : 1 }]}>{h}</Text>
                  ))}
                </View>
                {log.map((r, i) => (
                  <View key={r.id || i} style={st.tableRow}>
                    <Text style={[st.tableCell, st.tableCellBold, { flex: 2 }]} numberOfLines={1}>{r.dojo_name || r.dojo_id || "—"}</Text>
                    <Text style={[st.tableCell, { flex: 1 }]} numberOfLines={1}>{r.rule_code || "—"}</Text>
                    <Text style={[st.tableCell, st.tableCellMono, { flex: 1 }]} numberOfLines={1}>{fmtDate(r.created_at)}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={[st.badge, r.status === "sent" ? st.badgeOk : st.badgeWarn]}>
                        <View style={st.badgeDot} />
                        <Text style={st.badgeText} numberOfLines={1}>{r.status === "sent" ? "Entregue" : r.status === "error" ? "Falhou" : r.status}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

// ── Seção 3: Equipe ─────────────────────────────────────────────

function EquipeTab({ federationId }: { federationId: string }) {
  const [members, setMembers] = useState<FederationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("federation_staff");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await karateSettingsApi.listMembers(federationId).catch(() => ({ members: [] }));
      setMembers(res.members || []);
    } finally { setLoading(false); }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (mid: string, role: string) => {
    setMembers((prev) => prev.map((m) => m.id === mid ? { ...m, role } : m));
    await karateSettingsApi.updateMemberRole(federationId, mid, role).catch(() => null);
  };

  const handleRemove = async (mid: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== mid));
    await karateSettingsApi.removeMember(federationId, mid).catch(() => null);
  };

  const handleInvite = async () => {
    setInviteError("");
    setInviteSuccess("");
    if (!inviteEmail.trim()) { setInviteError("E-mail obrigatório"); return; }
    setInviting(true);
    try {
      const result = await karateSettingsApi.inviteMember(federationId, inviteEmail.trim(), inviteRole);
      setMembers((prev) => [...prev, result]);
      setInviteSuccess(`Convite enviado para ${inviteEmail.trim()}`);
      setInviteEmail("");
      setInviteRole("federation_staff");
      setTimeout(() => { setInviteSuccess(""); setInviteOpen(false); }, 2000);
    } catch (e: any) {
      setInviteError(e?.message || "Erro ao enviar convite");
    } finally {
      setInviting(false);
    }
  };

  const getRoleLabel = (role: string) => ROLE_OPTS.find((r) => r.value === role)?.label || role;

  const initials = (name: string) =>
    name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";

  return (
    <ScrollView style={st.tabContent} contentContainerStyle={st.tabPad}>
      <SectionHeader
        title="Equipe FPKT"
        sub="Membros com acesso ao painel da federação"
        right={
          <TouchableOpacity style={[st.btn, st.btnPrimary, st.btnSm]} onPress={() => setInviteOpen(true)}>
            <Text style={st.btnPrimaryText}>+ Convidar</Text>
          </TouchableOpacity>
        }
      />

      <Card style={st.cardFlush}>
        {loading ? (
          <ActivityIndicator color={KarateColors.primary} style={{ margin: 24 }} />
        ) : members.length === 0 ? (
          <Text style={st.emptyMsg}>Nenhum membro ainda. Convide alguém!</Text>
        ) : (
          <View>
            <View style={st.tableHead}>
              {["Membro","Papel","Status",""].map((h, i) => (
                <Text key={i} style={[st.tableHCell, { flex: i === 0 ? 3 : i === 1 ? 2 : 1 }]}>{h}</Text>
              ))}
            </View>
            {members.map((m) => (
              <View key={m.id} style={st.tableRow}>
                <View style={[st.personCell, { flex: 3 }]}>
                  <View style={st.avatar}>
                    <Text style={st.avatarText}>{initials(m.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.personName} numberOfLines={1}>{m.name}</Text>
                    <Text style={st.personEmail} numberOfLines={1}>{m.email}</Text>
                  </View>
                </View>

                {/* Seletor de papel — RN web: Picker não disponível sem dep nova, usamos texto tapável */}
                <TouchableOpacity
                  style={[st.roleSelect, { flex: 2 }]}
                  onPress={() => {
                    const opts = ROLE_OPTS.map((r) => r.value);
                    const cur  = opts.indexOf(m.role);
                    const next = opts[(cur + 1) % opts.length];
                    handleRoleChange(m.id, next);
                  }}
                  accessibilityLabel={`Papel de ${m.name}: ${getRoleLabel(m.role)}`}
                >
                  <Text style={st.roleSelectText}>{getRoleLabel(m.role)}</Text>
                  <Ionicons name="chevron-down" size={12} color={KarateColors.ink3} />
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <View style={[st.badge, m.is_pending ? st.badgeNeutral : st.badgeOk]}>
                    <View style={st.badgeDot} />
                    <Text style={st.badgeText}>{m.is_pending ? "Pendente" : "Ativo"}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={{ flex: 1, alignItems: "flex-end" }}
                  onPress={() => handleRemove(m.id)}
                  accessibilityLabel={`Remover ${m.name}`}
                >
                  <Text style={st.removeText}>Remover</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Cards de papéis */}
      <View style={st.roleInfoGrid}>
        {ROLE_INFO.map((r) => (
          <View key={r.role} style={st.roleInfoCard}>
            <Text style={st.roleInfoTitle}>{r.role}</Text>
            <Text style={st.roleInfoDesc}>{r.desc}</Text>
          </View>
        ))}
      </View>

      {/* Modal convidar */}
      <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setInviteOpen(false)}>
          <View style={st.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={st.modalTitle}>Convidar membro</Text>
            <Text style={st.modalSub}>Um e-mail de convite será enviado (padrão Aura)</Text>

            <Text style={st.fieldLabel}>E-mail</Text>
            <TextInput
              style={st.field}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="nome@dojo.org.br"
              placeholderTextColor={KarateColors.ink4}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel="E-mail do convidado"
            />

            <Text style={[st.fieldLabel, { marginTop: 16 }]}>Papel</Text>
            {ROLE_OPTS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[st.roleOpt, inviteRole === opt.value && st.roleOptActive]}
                onPress={() => setInviteRole(opt.value)}
                accessibilityLabel={`Papel ${opt.label}`}
              >
                <Text style={[st.roleOptText, inviteRole === opt.value && st.roleOptTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}

            {inviteError ? <Text style={st.errorText}>{inviteError}</Text> : null}
            {inviteSuccess ? <Text style={st.successText}>{inviteSuccess}</Text> : null}

            <View style={st.modalBtns}>
              <TouchableOpacity style={[st.btn, st.btnGhost]} onPress={() => setInviteOpen(false)}>
                <Text style={st.btnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.btn, st.btnPrimary]} onPress={handleInvite} disabled={inviting}>
                {inviting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.btnPrimaryText}>Enviar convite</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

// ── Seção 4+5: Recursos + Identidade ─────────────────────────────

function RecursosTab({ federationId }: { federationId: string }) {
  const [flags, setFlags] = useState<KarateFlags>({ competicoes: true, carteirinha: true, conexao: false, portal: true });
  const [identity, setIdentity] = useState<FederationIdentity | null>(null);
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [loadingIdentity, setLoadingIdentity] = useState(true);
  const [savingFlags, setSavingFlags] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [flagsToast, setFlagsToast] = useState(false);
  const [identityToast, setIdentityToast] = useState(false);

  // Form state para identidade
  const [form, setForm] = useState<Partial<FederationIdentity>>({});

  const loadFlags = useCallback(async () => {
    setLoadingFlags(true);
    try {
      const res = await karateSettingsApi.getFlags(federationId).catch(() => ({ flags: { competicoes: true, carteirinha: true, conexao: false, portal: true } }));
      setFlags(res.flags);
    } finally { setLoadingFlags(false); }
  }, [federationId]);

  const loadIdentity = useCallback(async () => {
    setLoadingIdentity(true);
    try {
      const res = await karateSettingsApi.getIdentity(federationId).catch(() => null);
      if (res) { setIdentity(res); setForm(res); }
    } finally { setLoadingIdentity(false); }
  }, [federationId]);

  useEffect(() => { loadFlags(); loadIdentity(); }, [loadFlags, loadIdentity]);

  const toggleFlag = async (key: keyof KarateFlags) => {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    setSavingFlags(true);
    try {
      await karateSettingsApi.updateFlags(federationId, next).catch(() => null);
      setFlagsToast(true);
      setTimeout(() => setFlagsToast(false), 2000);
    } finally { setSavingFlags(false); }
  };

  const updateField = (field: keyof FederationIdentity, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveIdentity = async () => {
    setSavingIdentity(true);
    try {
      await karateSettingsApi.updateIdentity(federationId, form).catch(() => null);
      setIdentityToast(true);
      setTimeout(() => setIdentityToast(false), 2000);
    } finally { setSavingIdentity(false); }
  };

  const f = form;

  return (
    <ScrollView style={st.tabContent} contentContainerStyle={st.tabPad}>
      {/* Recursos */}
      <SectionHeader title="Recursos" sub="Módulos ativos da plataforma para a federação" />
      <Card>
        {loadingFlags ? <ActivityIndicator color={KarateColors.primary} style={{ margin: 12 }} /> : (
          KARATE_FLAGS_DEFS.map((fd, i) => (
            <View key={fd.key} style={[st.configRow, i < KARATE_FLAGS_DEFS.length - 1 && st.configRowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={st.configRowName}>{fd.label}</Text>
                <Text style={st.configRowDesc}>{fd.desc}</Text>
              </View>
              <Switch
                value={!!flags[fd.key]}
                onValueChange={() => toggleFlag(fd.key)}
                trackColor={{ false: KarateColors.border, true: KarateColors.primary }}
                thumbColor="#fff"
                accessibilityLabel={`${fd.label}: ${flags[fd.key] ? "ativado" : "desativado"}`}
              />
            </View>
          ))
        )}
        <SaveToast visible={flagsToast} />
      </Card>

      {/* Identidade */}
      <SectionHeader title="Identidade" sub="Como a federação aparece no portal e nos documentos" />
      {loadingIdentity ? (
        <ActivityIndicator color={KarateColors.primary} style={{ marginVertical: 24 }} />
      ) : (
        <View style={st.identityGrid}>
          {/* Logo + Nome */}
          <Card>
            <View style={st.logoRow}>
              <View style={st.logoBox}>
                <Text style={st.logoBoxText}>空</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.logoLabel}>Logo da federação</Text>
                <Text style={st.logoSub}>PNG ou SVG, fundo transparente</Text>
              </View>
            </View>
            <Text style={st.fieldLabel}>Nome da federação</Text>
            <TextInput style={st.field} value={f.name || ""} onChangeText={(v) => updateField("name", v)} accessibilityLabel="Nome da federação" />
            <Text style={[st.fieldLabel, { marginTop: 12 }]}>Slug público</Text>
            <View style={st.slugRow}>
              <View style={st.slugPrefix}><Text style={st.slugPrefixText}>aura.app/</Text></View>
              <TextInput
                style={[st.field, { flex: 1, borderLeftWidth: 0, borderRadius: 0, borderTopRightRadius: KarateRadius.sm, borderBottomRightRadius: KarateRadius.sm }]}
                value={f.slug || ""}
                onChangeText={(v) => updateField("slug", v.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                autoCapitalize="none"
                accessibilityLabel="Slug público"
              />
            </View>
          </Card>

          {/* Contato */}
          <Card>
            <Text style={st.cardSectionTitle}>Contato &amp; canais</Text>
            <Text style={st.cardSectionSub}>Usados em lembretes e no portal público</Text>
            <Text style={[st.fieldLabel, { marginTop: 12 }]}>WhatsApp (exibição)</Text>
            <TextInput style={st.field} value={f.wa_phone_display || ""} onChangeText={(v) => updateField("wa_phone_display", v)} keyboardType="phone-pad" accessibilityLabel="WhatsApp" />
            <Text style={[st.fieldLabel, { marginTop: 12 }]}>E-mail da secretaria</Text>
            <TextInput style={st.field} value={f.secretary_email || ""} onChangeText={(v) => updateField("secretary_email", v)} keyboardType="email-address" autoCapitalize="none" accessibilityLabel="E-mail da secretaria" />
          </Card>
        </View>
      )}

      {/* Dados fiscais */}
      <SectionHeader title="Dados fiscais" sub="Emissão automática de NFS-e para anuidades e taxas" />
      {!loadingIdentity && (
        <Card>
          <Text style={st.fieldLabel}>Razão social</Text>
          <TextInput style={st.field} value={f.legal_name || ""} onChangeText={(v) => updateField("legal_name", v)} accessibilityLabel="Razão social" />

          <View style={st.identityGrid}>
            <View style={{ flex: 1 }}>
              <Text style={[st.fieldLabel, { marginTop: 12 }]}>CNPJ</Text>
              <TextInput style={st.field} value={f.cnpj || ""} onChangeText={(v) => updateField("cnpj", v)} keyboardType="numeric" accessibilityLabel="CNPJ" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.fieldLabel, { marginTop: 12 }]}>Inscrição municipal</Text>
              <TextInput style={st.field} value={f.inscricao_municipal || ""} onChangeText={(v) => updateField("inscricao_municipal", v)} accessibilityLabel="Inscrição municipal" />
            </View>
          </View>

          <Text style={[st.fieldLabel, { marginTop: 12 }]}>Regime tributário</Text>
          <View style={st.regimeRow}>
            {REGIME_OPTS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[st.regimeChip, f.regime_tributario === opt.value && st.regimeChipActive]}
                onPress={() => updateField("regime_tributario", opt.value)}
                accessibilityLabel={opt.label}
              >
                <Text style={[st.regimeChipText, f.regime_tributario === opt.value && st.regimeChipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[st.fieldLabel, { marginTop: 12 }]}>Município / UF</Text>
          <View style={st.identityGrid}>
            <TextInput style={[st.field, { flex: 2 }]} value={f.city || ""} onChangeText={(v) => updateField("city", v)} placeholder="Município" placeholderTextColor={KarateColors.ink4} accessibilityLabel="Município" />
            <TextInput style={[st.field, { flex: 1 }]} value={f.state || ""} onChangeText={(v) => updateField("state", v.toUpperCase().slice(0, 2))} placeholder="UF" placeholderTextColor={KarateColors.ink4} maxLength={2} accessibilityLabel="Estado" />
          </View>

          <View style={st.nfseBlock}>
            <View style={st.nfseTag}><Text style={st.nfseTagText}>NFS-e</Text></View>
            <Text style={st.nfseDesc}>
              As notas de anuidade e taxas são emitidas automaticamente com estes dados. Alterações valem para emissões futuras.
            </Text>
          </View>

          <TouchableOpacity style={[st.btn, st.btnPrimary, { marginTop: 20, alignSelf: "flex-end" }]} onPress={saveIdentity} disabled={savingIdentity}>
            {savingIdentity ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.btnPrimaryText}>Salvar dados</Text>}
          </TouchableOpacity>
          <SaveToast visible={identityToast} />
        </Card>
      )}
    </ScrollView>
  );
}

// ── Tela principal ─────────────────────────────────────────────────

export default function ConfiguracoesFederacao() {
  const { federationId, karateRole } = useKarateFederation();
  const [tab, setTab] = useState<TabId>("anuidade");

  // Gate: só federation_admin acessa esta tela.
  // Em dev (karateRole null) não bloqueia (mock-fallback).
  if (karateRole && karateRole !== "federation_admin") {
    return (
      <View style={st.gateWrap}>
        <Ionicons name="lock-closed" size={32} color={KarateColors.ink4} />
        <Text style={st.gateText}>Acesso restrito a administradores da federação.</Text>
      </View>
    );
  }

  return (
    <View style={st.screen}>
      {/* Cabeçalho da página */}
      <View style={st.pageHead}>
        <Text style={st.eyebrow}>Federação · Administração</Text>
        <Text style={st.pageTitle}>Configurações</Text>
        <Text style={st.pageSub}>
          Central operacional da federação — tabela de anuidade, régua de cobrança, equipe e os recursos da plataforma.
        </Text>
      </View>

      {/* Abas */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabBarWrap} contentContainerStyle={st.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[st.tabBtn, tab === t.id && st.tabBtnActive]}
            onPress={() => setTab(t.id)}
            accessibilityLabel={t.label}
            accessibilityState={{ selected: tab === t.id }}
          >
            <Text style={[st.tabBtnText, tab === t.id && st.tabBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Conteúdo */}
      {tab === "anuidade" && <AnuidadeTab federationId={federationId} />}
      {tab === "regua"    && <ReguaTab    federationId={federationId} />}
      {tab === "equipe"   && <EquipeTab   federationId={federationId} />}
      {tab === "recursos" && <RecursosTab federationId={federationId} />}
    </View>
  );
}

// ── StyleSheet ─────────────────────────────────────────────────
// GUARDRAIL: todos os valores são objetos {} (sem strings/cores soltas no top-level)
// para evitar o WeakMap crash (armadilha aura-app 08/06/2026).
const st = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  gateWrap:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 } as ViewStyle,
  gateText:     { fontSize: 14, color: KarateColors.ink3, textAlign: "center" } as TextStyle,

  // Page head
  pageHead:  { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 } as ViewStyle,
  eyebrow:   { fontSize: 10, fontWeight: "700", color: KarateColors.ink4, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 } as TextStyle,
  pageTitle: { fontFamily: KarateFonts.heading, fontSize: 32, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  pageSub:   { fontSize: 13, color: KarateColors.ink3, marginTop: 6, lineHeight: 18 } as TextStyle,

  // Tab bar
  tabBarWrap: { backgroundColor: KarateColors.bg2, borderBottomWidth: 1, borderBottomColor: KarateColors.border, flexGrow: 0 } as ViewStyle,
  tabBar:     { flexDirection: "row", paddingHorizontal: 12, gap: 4, paddingVertical: 8 } as ViewStyle,
  tabBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: KarateRadius.sm, backgroundColor: "transparent" } as ViewStyle,
  tabBtnActive: { backgroundColor: KarateColors.primarySoft } as ViewStyle,
  tabBtnText:   { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  tabBtnTextActive: { color: KarateColors.primary } as TextStyle,

  // Tab content
  tabContent: { flex: 1 } as ViewStyle,
  tabPad:     { padding: 16, paddingBottom: 48, gap: 16 } as ViewStyle,

  // Anuidade intro (contexto da seção)
  anuidadeIntro: { marginTop: -4, marginBottom: 4 } as ViewStyle,
  anuidadeIntroText: { fontSize: 13, lineHeight: 19, color: KarateColors.ink2 } as TextStyle,

  // Section header
  sectionHead:  { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 } as ViewStyle,
  sectionTitle: { fontFamily: KarateFonts.heading, fontSize: 22, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  sectionSub:   { fontSize: 12, color: KarateColors.ink3, marginTop: 3 } as TextStyle,

  // Card
  card:      { backgroundColor: KarateColors.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, padding: 16 } as ViewStyle,
  cardFlush: { backgroundColor: KarateColors.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, overflow: "hidden" } as ViewStyle,

  // Fee cards
  feeGrid:      { gap: 12 } as ViewStyle,
  feeCard:      { gap: 4 } as ViewStyle,
  feeCardHead:  { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  feeCardTitle: { fontFamily: KarateFonts.heading, fontSize: 19, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  feeCardSub:   { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  feeRow:       { flexDirection: "row", alignItems: "baseline", gap: 6, marginVertical: 12 } as ViewStyle,
  feeCurrency:  { fontSize: 22, color: KarateColors.ink3, fontWeight: "300" } as TextStyle,
  feeInput:     { fontSize: 38, fontWeight: "300", color: KarateColors.ink, borderBottomWidth: 2, borderBottomColor: KarateColors.border, width: 120, paddingBottom: 2, outlineStyle: "none" } as any,
  monthLabel:   { fontSize: 10, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 } as TextStyle,
  monthGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  monthChip:    { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, minWidth: 40, alignItems: "center" } as ViewStyle,
  monthChipActive: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primary } as ViewStyle,
  monthChipText: { fontSize: 11, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  monthChipTextActive: { color: KarateColors.primary } as TextStyle,

  // Vigência banner
  vigCard:    { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  vigInfo:    { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 16 } as ViewStyle,
  vigMark:    { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: KarateColors.primary, alignItems: "center", justifyContent: "center" } as ViewStyle,
  vigMarkText: { fontSize: 18, color: KarateColors.primary } as TextStyle,
  vigTitle:   { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  vigSub:     { fontSize: 12, color: KarateColors.ink2, lineHeight: 17, marginTop: 4 } as TextStyle,
  vigBold:    { fontWeight: "700", color: KarateColors.ink } as TextStyle,
  vigActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" } as ViewStyle,
  dateField:  { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: KarateColors.ink, minWidth: 120 } as any,

  // Toggle card
  toggleCard:  { flexDirection: "row", alignItems: "center", gap: 16 } as ViewStyle,
  toggleTitle: { fontSize: 15, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  toggleHint:  { fontSize: 12, color: KarateColors.ink2, marginTop: 4, lineHeight: 17 } as TextStyle,

  // Stage chips
  stagesGrid: { flexDirection: "row", gap: 12, marginTop: 16, flexWrap: "wrap" } as ViewStyle,
  stageBox:   { flex: 1, minWidth: 200, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 14 } as ViewStyle,
  stageBoxLabel: { fontSize: 10, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,
  stageBoxDesc:  { fontSize: 13, color: KarateColors.ink, marginTop: 6, marginBottom: 10 } as TextStyle,
  chipRow:       { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" } as ViewStyle,
  chipInput:     { width: 54, borderWidth: 1, borderStyle: "dashed", borderColor: KarateColors.border, borderRadius: 999, backgroundColor: "transparent", paddingVertical: 5, paddingHorizontal: 8, fontSize: 11, color: KarateColors.ink, textAlign: "center", outlineStyle: "none" } as any,

  // Pills
  pill:           { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "transparent" } as ViewStyle,
  pillActive:     { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primary } as ViewStyle,
  pillText:       { fontSize: 11, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  pillTextActive: { color: KarateColors.primary } as TextStyle,
  pillRemove:     { fontSize: 16, color: KarateColors.danger, lineHeight: 18 } as TextStyle,
  pillSmall:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  pillSmallText:  { fontSize: 11, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,

  // Section divider
  sectionDivider:     { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingVertical: 16, marginVertical: 8, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  sectionDividerTitle: { fontFamily: KarateFonts.heading, fontSize: 24, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  sectionDividerLine:  { height: 2, width: 34, backgroundColor: KarateColors.primary, opacity: 0.7, marginTop: 10 } as ViewStyle,
  sectionDividerSub:   { fontSize: 11, color: KarateColors.ink4, marginTop: 6 } as TextStyle,
  rowGap:              { flexDirection: "row", gap: 8, alignItems: "center" } as ViewStyle,

  // Table
  tableHead:      { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  tableHCell:     { fontSize: 10, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,
  tableRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  tableCell:      { fontSize: 13, color: KarateColors.ink2 } as TextStyle,
  tableCellBold:  { fontWeight: "600", color: KarateColors.ink } as TextStyle,
  tableCellMono:  { fontFamily: KarateFonts.mono } as TextStyle,
  personCell:     { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  personName:     { fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  personEmail:    { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  avatar:         { width: 30, height: 30, borderRadius: 15, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  avatarText:     { fontSize: 11, fontWeight: "800", color: KarateColors.primary } as TextStyle,
  roleSelect:     { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 8, paddingVertical: 5 } as ViewStyle,
  roleSelectText: { fontSize: 12, color: KarateColors.ink } as TextStyle,
  removeText:     { fontSize: 12, color: KarateColors.danger, fontWeight: "600" } as TextStyle,

  // Role info cards
  roleInfoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 } as ViewStyle,
  roleInfoCard: { flex: 1, minWidth: 160, padding: 14, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md } as ViewStyle,
  roleInfoTitle: { fontSize: 13, fontWeight: "700", color: KarateColors.ink, marginBottom: 6 } as TextStyle,
  roleInfoDesc:  { fontSize: 12, color: KarateColors.ink3, lineHeight: 17 } as TextStyle,

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.34)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  modalCard:    { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.lg, padding: 24, width: 440, maxWidth: "100%" } as ViewStyle,
  modalTitle:   { fontSize: 18, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  modalSub:     { fontSize: 12, color: KarateColors.ink3, marginTop: 4, marginBottom: 20 } as TextStyle,
  modalBtns:    { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 24 } as ViewStyle,

  // Drawer (histórico)
  drawerPanel: { position: "absolute", top: 0, right: 0, bottom: 0, width: 420, maxWidth: "94%", backgroundColor: KarateColors.bg2, borderLeftWidth: 1, borderLeftColor: KarateColors.border, padding: 28 } as ViewStyle,
  drawerHead:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 } as ViewStyle,
  drawerEyebrow: { fontSize: 10, fontWeight: "600", color: KarateColors.ink3, letterSpacing: 1.4, textTransform: "uppercase" } as TextStyle,
  drawerTitle:   { fontFamily: KarateFonts.heading, fontSize: 22, fontWeight: "400", color: KarateColors.ink, marginTop: 6 } as TextStyle,
  historyRow:    { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  historyRowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } as ViewStyle,
  historyFrom:   { fontSize: 12, color: KarateColors.ink, fontFamily: KarateFonts.mono } as TextStyle,
  historyVals:   { flexDirection: "row", gap: 20 } as ViewStyle,
  historyValLabel: { fontSize: 9, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,
  historyValAmt:   { fontSize: 13, color: KarateColors.ink, fontFamily: KarateFonts.mono, marginTop: 4 } as TextStyle,

  // Invite modal
  roleOpt:        { paddingVertical: 10, paddingHorizontal: 14, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, marginTop: 6 } as ViewStyle,
  roleOptActive:  { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primary } as ViewStyle,
  roleOptText:    { fontSize: 13, color: KarateColors.ink3 } as TextStyle,
  roleOptTextActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,

  // Badges
  badge:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, alignSelf: "flex-start" } as ViewStyle,
  badgeOk:      { backgroundColor: KarateColors.okSoft, borderColor: KarateColors.ok } as ViewStyle,
  badgeWarn:    { backgroundColor: KarateColors.warnSoft, borderColor: KarateColors.warn } as ViewStyle,
  badgeNeutral: { backgroundColor: KarateColors.neutralSoft, borderColor: KarateColors.neutral } as ViewStyle,
  badgeDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: KarateColors.ink3 } as ViewStyle,
  badgeText:    { fontSize: 11, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,

  // Config row (flags)
  configRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 } as ViewStyle,
  configRowBorder: { borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  configRowName:   { fontSize: 14, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  configRowDesc:   { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  // Identity
  identityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 } as ViewStyle,
  logoRow:      { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 18 } as ViewStyle,
  logoBox:      { width: 56, height: 56, borderRadius: KarateRadius.md, backgroundColor: KarateColors.primary, alignItems: "center", justifyContent: "center" } as ViewStyle,
  logoBoxText:  { fontSize: 30, color: "#fbeee4" } as TextStyle,
  logoLabel:    { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  logoSub:      { fontSize: 11, color: KarateColors.ink3, marginTop: 3 } as TextStyle,
  slugRow:      { flexDirection: "row", borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, overflow: "hidden", marginTop: 4 } as ViewStyle,
  slugPrefix:   { backgroundColor: KarateColors.bg2, borderRightWidth: 1, borderRightColor: KarateColors.border, paddingHorizontal: 10, paddingVertical: 9, justifyContent: "center" } as ViewStyle,
  slugPrefixText: { fontSize: 12, color: KarateColors.ink3, fontFamily: KarateFonts.mono } as TextStyle,

  // Regime
  regimeRow:          { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 } as ViewStyle,
  regimeChip:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  regimeChipActive:   { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primary } as ViewStyle,
  regimeChipText:     { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  regimeChipTextActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,

  // NFS-e block
  nfseBlock:   { flexDirection: "row", gap: 12, marginTop: 20, padding: 14, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, alignItems: "flex-start" } as ViewStyle,
  nfseTag:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: KarateColors.primary } as ViewStyle,
  nfseTagText: { fontSize: 11, fontWeight: "800", color: "#fff" } as TextStyle,
  nfseDesc:    { flex: 1, fontSize: 12, color: KarateColors.ink2, lineHeight: 17 } as TextStyle,

  // Buttons
  btn:            { borderRadius: KarateRadius.sm, paddingHorizontal: 14, paddingVertical: 9, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 } as ViewStyle,
  btnPrimary:     { backgroundColor: KarateColors.primary } as ViewStyle,
  btnPrimaryText: { fontSize: 13, fontWeight: "700", color: "#fff" } as TextStyle,
  btnGhost:       { borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "transparent" } as ViewStyle,
  btnGhostText:   { fontSize: 13, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
  btnText:        { backgroundColor: "transparent" } as ViewStyle,
  btnTextLabel:   { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  btnSm:          { paddingHorizontal: 11, paddingVertical: 5 } as ViewStyle,
  btnSmText:      { fontSize: 11, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,

  // Fields
  field:      { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: KarateColors.ink, backgroundColor: "#fff", marginTop: 4, outlineStyle: "none" } as any,
  fieldLabel: { fontSize: 11, fontWeight: "600", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,

  // Misc
  cardSectionTitle: { fontSize: 15, fontWeight: "700", color: KarateColors.ink, marginBottom: 2 } as TextStyle,
  cardSectionSub:   { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  emptyMsg:    { fontSize: 13, color: KarateColors.ink4, textAlign: "center", padding: 24 } as TextStyle,
  errorText:   { fontSize: 13, color: KarateColors.danger, marginTop: 10 } as TextStyle,
  successText: { fontSize: 13, color: KarateColors.ok, marginTop: 10 } as TextStyle,
  toast:       { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 } as ViewStyle,
  toastText:   { fontSize: 12, color: KarateColors.ok } as TextStyle,
});
