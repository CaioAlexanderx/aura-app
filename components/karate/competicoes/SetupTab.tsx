// ============================================================
// AURA KARATÊ — Workspace do campeonato: CONFIGURAR (divisões,
// precificação e publicações do ciclo)
//
// Três blocos, todos sobre a migration 294:
//   1) DIVISÕES — "Principal" / "Aspirantes" com as cotas por clube por
//      categoria (individuais e equipes). Excluir só sem categorias
//      vinculadas (o backend devolve 409 DIVISION_IN_USE).
//   2) PRECIFICAÇÃO — taxa única por atleta com bandas por idade (regra
//      JKA), equipes por prova/pacote, isenções por contrapartida.
//      Vazio = modo legado (fee por inscrição, comportamento atual).
//   3) CICLO — prazo de retificação + publicar/despublicar a conferência
//      de inscrições e as chaves no portal público (com link copiável).
// ============================================================
import React, { useCallback, useState } from "react";
import {
  View, Text, TouchableOpacity, TextInput, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateRadius as R } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { toast } from "@/components/Toast";
import { copyToClipboard } from "@/utils/clipboard";
import { buildMicrositeUrl } from "@/utils/microsite";
import { formatIsoToBr, maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import {
  karateCompetitionSetupApi, CompetitionDivision, PricingConfig,
} from "@/services/karateCompetitionSetupApi";
import { formatBRL } from "@/services/karateDelegationsApi";

interface Props {
  federationId: string;
  competitionId: string;
  /** Slug público da federação quando conhecido (fallback: federationId — o backend aceita UUID). */
  publicSlug?: string | null;
  divisions: CompetitionDivision[];
  pricing: PricingConfig;
  rectificationDeadline: string | null;
  conferencePublishedAt: string | null;
  bracketsPublishedAt: string | null;
  onChanged: () => void;
}

const toIntOrNull = (v: string): number | null => {
  const d = (v || "").replace(/\D/g, "");
  return d ? parseInt(d, 10) : null;
};
const moneyToNumber = (v: string): number | null => {
  const cents = (v || "").replace(/\D/g, "");
  return cents ? parseInt(cents, 10) / 100 : null;
};
const numberToMoney = (n: number | null | undefined): string =>
  n == null ? "" : `${Math.floor(n).toLocaleString("pt-BR")},${String(Math.round(n * 100) % 100).padStart(2, "0")}`;
const maskMoney = (v: string): string => {
  const cents = (v || "").replace(/\D/g, "").slice(0, 9);
  if (!cents) return "";
  const n = parseInt(cents, 10);
  return `${Math.floor(n / 100).toLocaleString("pt-BR")},${String(n % 100).padStart(2, "0")}`;
};

export function SetupTab({
  federationId, competitionId, publicSlug, divisions, pricing,
  rectificationDeadline, conferencePublishedAt, bracketsPublishedAt, onChanged,
}: Props) {
  return (
    <View style={{ gap: 14 }}>
      <DivisionsBlock federationId={federationId} competitionId={competitionId} divisions={divisions} onChanged={onChanged} />
      <PricingBlock federationId={federationId} competitionId={competitionId} pricing={pricing} onChanged={onChanged} />
      <CycleBlock
        federationId={federationId}
        competitionId={competitionId}
        publicSlug={publicSlug}
        rectificationDeadline={rectificationDeadline}
        conferencePublishedAt={conferencePublishedAt}
        bracketsPublishedAt={bracketsPublishedAt}
        onChanged={onChanged}
      />
    </View>
  );
}

// ── 1) Divisões ─────────────────────────────────────────────
function DivisionsBlock({ federationId, competitionId, divisions, onChanged }: {
  federationId: string; competitionId: string; divisions: CompetitionDivision[]; onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Edição local das cotas por divisão (id → valores em string).
  const [draft, setDraft] = useState<Record<string, { ind: string; team: string }>>({});

  const draftOf = (d: CompetitionDivision) => draft[d.id] ?? {
    ind: d.rules.max_individual_per_dojo_per_category != null ? String(d.rules.max_individual_per_dojo_per_category) : "",
    team: d.rules.max_teams_per_dojo_per_category != null ? String(d.rules.max_teams_per_dojo_per_category) : "",
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await karateCompetitionSetupApi.createDivision(federationId, competitionId, { name, sort_order: divisions.length });
      setNewName("");
      toast.success(`Divisão "${name}" criada.`);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível criar a divisão.");
    } finally {
      setBusy(false);
    }
  };

  const saveRules = async (d: CompetitionDivision) => {
    const cur = draftOf(d);
    setSavingId(d.id);
    try {
      await karateCompetitionSetupApi.updateDivision(federationId, competitionId, d.id, {
        rules: {
          ...d.rules,
          max_individual_per_dojo_per_category: toIntOrNull(cur.ind),
          max_teams_per_dojo_per_category: toIntOrNull(cur.team),
        },
      });
      toast.success("Cotas salvas.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar as cotas.");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (d: CompetitionDivision) => {
    if (d.category_count > 0) {
      toast.error(`"${d.name}" tem ${d.category_count} categoria(s) vinculada(s) — mova-as antes.`);
      return;
    }
    const ok = await confirmAsync({
      title: "Excluir divisão?", message: `Excluir "${d.name}"?`, confirmLabel: "Excluir", destructive: true,
    });
    if (!ok) return;
    try {
      await karateCompetitionSetupApi.deleteDivision(federationId, competitionId, d.id);
      toast.success("Divisão excluída.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível excluir.");
    }
  };

  return (
    <View style={s.block}>
      <Text style={s.blockTitle}>Divisões</Text>
      <Text style={s.blockHint}>
        Ex.: Principal e Aspirantes no mesmo evento — cada divisão com as próprias cotas por clube. As categorias são vinculadas à divisão na edição da categoria.
      </Text>

      {divisions.map((d) => {
        const cur = draftOf(d);
        return (
          <View key={d.id} style={s.divRow}>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={s.divName}>{d.name}</Text>
              <Text style={s.divMeta}>{d.category_count} categoria{d.category_count === 1 ? "" : "s"}</Text>
            </View>
            <View style={s.quotaField}>
              <Text style={s.quotaLabel}>Atletas/clube/prova</Text>
              <TextInput
                style={s.quotaInput}
                value={cur.ind}
                onChangeText={(v) => setDraft((p) => ({ ...p, [d.id]: { ...cur, ind: v.replace(/\D/g, "") } }))}
                placeholder="—" placeholderTextColor={C.ink4} keyboardType="numeric" maxLength={3}
              />
            </View>
            <View style={s.quotaField}>
              <Text style={s.quotaLabel}>Equipes/clube</Text>
              <TextInput
                style={s.quotaInput}
                value={cur.team}
                onChangeText={(v) => setDraft((p) => ({ ...p, [d.id]: { ...cur, team: v.replace(/\D/g, "") } }))}
                placeholder="—" placeholderTextColor={C.ink4} keyboardType="numeric" maxLength={2}
              />
            </View>
            <KarateButton label={savingId === d.id ? "..." : "Salvar"} variant="secondary" size="sm" onPress={() => saveRules(d)} disabled={savingId === d.id} />
            <TouchableOpacity onPress={() => remove(d)} hitSlop={8} accessibilityLabel={`Excluir divisão ${d.name}`}>
              <Icon name="trash" size={15} color={d.category_count > 0 ? C.ink4 : C.primary} />
            </TouchableOpacity>
          </View>
        );
      })}

      <View style={s.newDivRow}>
        <TextInput
          style={s.newDivInput}
          value={newName}
          onChangeText={setNewName}
          placeholder='Nova divisão (ex.: "Aspirantes")'
          placeholderTextColor={C.ink4}
        />
        <KarateButton label={busy ? "..." : "Adicionar"} variant="sumi" size="sm" onPress={create} disabled={busy || !newName.trim()} />
      </View>
    </View>
  );
}

// ── 2) Precificação ─────────────────────────────────────────
function PricingBlock({ federationId, competitionId, pricing, onChanged }: {
  federationId: string; competitionId: string; pricing: PricingConfig; onChanged: () => void;
}) {
  const hasConfig = !!(pricing.individual?.bands?.length);
  const [enabled, setEnabled] = useState(hasConfig);
  const [mode, setMode] = useState<"per_athlete" | "per_entry">(pricing.individual?.mode === "per_entry" ? "per_entry" : "per_athlete");
  const [bands, setBands] = useState<{ maxAge: string; amount: string }[]>(
    hasConfig
      ? pricing.individual!.bands.map((b) => ({ maxAge: b.max_age != null ? String(b.max_age) : "", amount: numberToMoney(b.amount) }))
      : [{ maxAge: "14", amount: "" }, { maxAge: "", amount: "" }]
  );
  const [perProva, setPerProva] = useState(numberToMoney(pricing.team?.per_prova ?? null));
  const [bundle, setBundle] = useState(numberToMoney(pricing.team?.bundle_both ?? null));
  const [perExemption, setPerExemption] = useState(pricing.exemptions?.officials_per_exemption != null ? String(pricing.exemptions.officials_per_exemption) : "");
  const [maxExemptions, setMaxExemptions] = useState(pricing.exemptions?.max_exemptions != null ? String(pricing.exemptions.max_exemptions) : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      let config: PricingConfig = {};
      if (enabled) {
        const parsedBands = bands
          .map((b) => ({ max_age: toIntOrNull(b.maxAge), amount: moneyToNumber(b.amount) }))
          .filter((b) => b.amount != null) as { max_age: number | null; amount: number }[];
        if (!parsedBands.length) {
          toast.error("Informe ao menos uma banda de preço individual.");
          setSaving(false);
          return;
        }
        config = {
          individual: { mode, bands: parsedBands },
        };
        const pp = moneyToNumber(perProva);
        const bb = moneyToNumber(bundle);
        if (pp != null || bb != null) config.team = { per_prova: pp, bundle_both: bb };
        const pe = toIntOrNull(perExemption);
        const me = toIntOrNull(maxExemptions);
        if (pe != null) config.exemptions = { officials_per_exemption: pe, max_exemptions: me ?? 0 };
      }
      await karateCompetitionSetupApi.updatePricing(federationId, competitionId, { pricing_config: config });
      toast.success(enabled ? "Precificação salva." : "Precificação desativada (modo legado).");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar a precificação.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.block}>
      <View style={s.blockHead}>
        <Text style={s.blockTitle}>Precificação da delegação</Text>
        <TouchableOpacity
          style={[s.toggle, enabled && s.toggleOn]}
          onPress={() => setEnabled((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
        >
          <Text style={[s.toggleTxt, enabled && s.toggleTxtOn]}>{enabled ? "Ativa" : "Modo legado"}</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.blockHint}>
        {enabled
          ? "Taxa por atleta com bandas de idade (na data do evento), equipes por prova e isenções por contrapartida de oficiais."
          : "Sem configuração, vale o modo legado: taxa da categoria (ou da competição) por inscrição."}
      </Text>

      {enabled && (
        <>
          <View style={s.modeRow}>
            {([["per_athlete", "Taxa única por atleta"], ["per_entry", "Por inscrição"]] as const).map(([value, label]) => (
              <TouchableOpacity key={value} style={[s.modeChip, mode === value && s.modeChipOn]} onPress={() => setMode(value)}>
                <Text style={[s.modeChipTxt, mode === value && s.modeChipTxtOn]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.subLabel}>Bandas por idade (avaliadas na ordem; deixe "até" vazio na última)</Text>
          {bands.map((b, i) => (
            <View key={i} style={s.bandRow}>
              <Text style={s.bandTxt}>até</Text>
              <TextInput
                style={s.bandAge} value={b.maxAge} keyboardType="numeric" maxLength={3}
                onChangeText={(v) => setBands((p) => p.map((x, j) => (j === i ? { ...x, maxAge: v.replace(/\D/g, "") } : x)))}
                placeholder="—" placeholderTextColor={C.ink4}
              />
              <Text style={s.bandTxt}>anos → R$</Text>
              <TextInput
                style={s.bandAmount} value={b.amount} keyboardType="numeric"
                onChangeText={(v) => setBands((p) => p.map((x, j) => (j === i ? { ...x, amount: maskMoney(v) } : x)))}
                placeholder="0,00" placeholderTextColor={C.ink4}
              />
              {bands.length > 1 && (
                <TouchableOpacity onPress={() => setBands((p) => p.filter((_, j) => j !== i))} hitSlop={8}>
                  <Icon name="x" size={14} color={C.ink3} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={s.addBand} onPress={() => setBands((p) => [...p, { maxAge: "", amount: "" }])}>
            <Icon name="plus" size={13} color={C.primary} />
            <Text style={s.addBandTxt}>Adicionar banda</Text>
          </TouchableOpacity>

          <Text style={s.subLabel}>Equipes</Text>
          <View style={s.pairRow}>
            <View style={s.pairField}>
              <Text style={s.quotaLabel}>Por prova (R$)</Text>
              <TextInput style={s.quotaInput} value={perProva} keyboardType="numeric" onChangeText={(v) => setPerProva(maskMoney(v))} placeholder="0,00" placeholderTextColor={C.ink4} />
            </View>
            <View style={s.pairField}>
              <Text style={s.quotaLabel}>Pacote 2 provas (R$)</Text>
              <TextInput style={s.quotaInput} value={bundle} keyboardType="numeric" onChangeText={(v) => setBundle(maskMoney(v))} placeholder="0,00" placeholderTextColor={C.ink4} />
            </View>
          </View>

          <Text style={s.subLabel}>Isenções por contrapartida</Text>
          <View style={s.pairRow}>
            <View style={s.pairField}>
              <Text style={s.quotaLabel}>A cada N oficiais</Text>
              <TextInput style={s.quotaInput} value={perExemption} keyboardType="numeric" maxLength={2} onChangeText={(v) => setPerExemption(v.replace(/\D/g, ""))} placeholder="2" placeholderTextColor={C.ink4} />
            </View>
            <View style={s.pairField}>
              <Text style={s.quotaLabel}>Máx. isenções/dojô</Text>
              <TextInput style={s.quotaInput} value={maxExemptions} keyboardType="numeric" maxLength={2} onChangeText={(v) => setMaxExemptions(v.replace(/\D/g, ""))} placeholder="3" placeholderTextColor={C.ink4} />
            </View>
          </View>
        </>
      )}

      <View style={{ alignItems: "flex-end" }}>
        <KarateButton label={saving ? "Salvando..." : "Salvar precificação"} variant="sumi" size="md" onPress={save} disabled={saving} />
      </View>
    </View>
  );
}

// ── 3) Ciclo: retificação + publicações ─────────────────────
function CycleBlock({
  federationId, competitionId, publicSlug, rectificationDeadline,
  conferencePublishedAt, bracketsPublishedAt, onChanged,
}: {
  federationId: string; competitionId: string; publicSlug?: string | null;
  rectificationDeadline: string | null; conferencePublishedAt: string | null;
  bracketsPublishedAt: string | null; onChanged: () => void;
}) {
  const [deadlineBr, setDeadlineBr] = useState(rectificationDeadline ? (formatIsoToBr(rectificationDeadline) || "") : "");
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [pubBusy, setPubBusy] = useState<"conf" | "chaves" | null>(null);

  const slug = publicSlug || federationId;
  const publicUrl = buildMicrositeUrl(slug, `/campeonato/${competitionId}`);

  const saveDeadline = async () => {
    const iso = deadlineBr.trim() ? parseBrDate(deadlineBr) : null;
    if (deadlineBr.trim() && !iso) {
      toast.error("Data inválida — use dd/mm/aaaa ou deixe vazio.");
      return;
    }
    setSavingDeadline(true);
    try {
      await karateCompetitionSetupApi.updatePricing(federationId, competitionId, { rectification_deadline: iso });
      toast.success("Prazo de retificação salvo.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar o prazo.");
    } finally {
      setSavingDeadline(false);
    }
  };

  const togglePublish = useCallback(async (kind: "conf" | "chaves") => {
    const isOn = kind === "conf" ? !!conferencePublishedAt : !!bracketsPublishedAt;
    if (isOn) {
      const ok = await confirmAsync({
        title: kind === "conf" ? "Despublicar conferência?" : "Despublicar chaves?",
        message: "A página pública deixa de existir até você publicar de novo (retificação é operação normal do ciclo).",
        confirmLabel: "Despublicar",
        destructive: true,
      });
      if (!ok) return;
    }
    setPubBusy(kind);
    try {
      if (kind === "conf") await karateCompetitionSetupApi.publishConference(federationId, competitionId, !isOn);
      else await karateCompetitionSetupApi.publishBrackets(federationId, competitionId, !isOn);
      toast.success(isOn ? "Despublicado." : "Publicado no portal.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível publicar.");
    } finally {
      setPubBusy(null);
    }
  }, [federationId, competitionId, conferencePublishedAt, bracketsPublishedAt, onChanged]);

  return (
    <View style={s.block}>
      <Text style={s.blockTitle}>Ciclo operacional</Text>

      <View style={s.cycleRow}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text style={s.quotaLabel}>Prazo de retificação das chaves (dd/mm/aaaa)</Text>
          <TextInput
            style={s.quotaInput}
            value={deadlineBr}
            onChangeText={(v) => setDeadlineBr(maskBrDate(v))}
            placeholder="dd/mm/aaaa" placeholderTextColor={C.ink4}
            keyboardType="numeric" maxLength={10}
          />
        </View>
        <KarateButton label={savingDeadline ? "..." : "Salvar"} variant="secondary" size="sm" onPress={saveDeadline} disabled={savingDeadline} />
      </View>

      <PublishRow
        label="Conferência de inscrições"
        hint="A lista pública que substitui o PDF por e-mail — os clubes conferem nome, categoria e faixa."
        publishedAt={conferencePublishedAt}
        busy={pubBusy === "conf"}
        onToggle={() => togglePublish("conf")}
      />
      <PublishRow
        label="Chaves no portal"
        hint="Cada atleta vê a própria chave no celular — substitui o PDF no WhatsApp."
        publishedAt={bracketsPublishedAt}
        busy={pubBusy === "chaves"}
        onToggle={() => togglePublish("chaves")}
      />

      <TouchableOpacity
        style={s.linkRow}
        onPress={async () => { await copyToClipboard(publicUrl); toast.success("Link público copiado."); }}
        accessibilityRole="button"
      >
        <Icon name="copy" size={14} color={C.primary} />
        <Text style={s.linkTxt} numberOfLines={1}>{publicUrl}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PublishRow({ label, hint, publishedAt, busy, onToggle }: {
  label: string; hint: string; publishedAt: string | null; busy: boolean; onToggle: () => void;
}) {
  const on = !!publishedAt;
  return (
    <View style={s.pubRow}>
      <View style={{ flex: 1, minWidth: 180 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={[s.pubDot, { backgroundColor: on ? "#2e7d4f" : C.ink4 }]} />
          <Text style={s.pubLabel}>{label}</Text>
        </View>
        <Text style={s.pubHint}>{hint}</Text>
      </View>
      <KarateButton
        label={busy ? "..." : on ? "Despublicar" : "Publicar"}
        variant={on ? "ghost" : "sumi"}
        size="sm"
        onPress={onToggle}
        disabled={busy}
      />
    </View>
  );
}

const s = StyleSheet.create({
  block: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10 } as ViewStyle,
  blockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  blockTitle: { fontSize: 14, fontWeight: "800", color: C.ink } as TextStyle,
  blockHint: { fontSize: 12, color: C.ink3 } as TextStyle,
  divRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, flexWrap: "wrap", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 } as ViewStyle,
  divName: { fontSize: 13.5, fontWeight: "700", color: C.ink } as TextStyle,
  divMeta: { fontSize: 11, color: C.ink3 } as TextStyle,
  quotaField: { width: 130 } as ViewStyle,
  quotaLabel: { fontSize: 10.5, fontWeight: "700", color: C.ink3, marginBottom: 3 } as TextStyle,
  quotaInput: { fontSize: 13.5, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.glassHi } as TextStyle,
  newDivRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 } as ViewStyle,
  newDivInput: { flex: 1, fontSize: 13.5, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.glassHi } as TextStyle,
  toggle: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 12, paddingVertical: 5 } as ViewStyle,
  toggleOn: { backgroundColor: C.primarySoft, borderColor: C.primaryLine } as ViewStyle,
  toggleTxt: { fontSize: 12, fontWeight: "700", color: C.ink3 } as TextStyle,
  toggleTxtOn: { color: C.primary } as TextStyle,
  modeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" } as ViewStyle,
  modeChip: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 12, paddingVertical: 6 } as ViewStyle,
  modeChipOn: { backgroundColor: C.primarySoft, borderColor: C.primaryLine } as ViewStyle,
  modeChipTxt: { fontSize: 12.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  modeChipTxtOn: { color: C.primary, fontWeight: "700" } as TextStyle,
  subLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase", color: C.ink3, marginTop: 4 } as TextStyle,
  bandRow: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  bandTxt: { fontSize: 13, color: C.ink2 } as TextStyle,
  bandAge: { width: 64, fontSize: 13.5, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.glassHi, textAlign: "center" } as TextStyle,
  bandAmount: { width: 110, fontSize: 13.5, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.glassHi, textAlign: "right" } as TextStyle,
  addBand: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" } as ViewStyle,
  addBandTxt: { fontSize: 12.5, fontWeight: "700", color: C.primary } as TextStyle,
  pairRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" } as ViewStyle,
  pairField: { width: 150 } as ViewStyle,
  cycleRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, flexWrap: "wrap" } as ViewStyle,
  pubRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 } as ViewStyle,
  pubDot: { width: 8, height: 8, borderRadius: 4 } as ViewStyle,
  pubLabel: { fontSize: 13.5, fontWeight: "700", color: C.ink } as TextStyle,
  pubHint: { fontSize: 11.5, color: C.ink3, marginTop: 2 } as TextStyle,
  linkRow: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 } as ViewStyle,
  linkTxt: { flex: 1, fontSize: 12, color: C.primary } as TextStyle,
});
