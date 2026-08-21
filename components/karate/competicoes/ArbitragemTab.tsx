// ============================================================
// AURA KARATÊ — Workspace do campeonato: ARBITRAGEM e TERMOS (P1/298)
//
// Duas seções numa aba (as duas "listas humanas" do evento):
//
//  1) ESCALA — o que a "DISTRIBUIÇÃO DE ÁRBITROS & MESÁRIOS" faz em
//     papel: convoca do cadastro da federação, o oficial confirma, é
//     escalado num koto (com o chefe/shuchin marcado) e tem presença
//     registrada; ausência não justificada abre campo de multa.
//  2) TERMOS — status do termo de responsabilidade por atleta inscrito
//     ("sem termo, não participa"), com contador e registro de aceite
//     na mesa (atleta ou responsável, para menores).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, TextInput, ScrollView,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateRadius as R } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { toast } from "@/components/Toast";
import {
  karateCompetitionP1Api, Official, EventOfficial, OfficialStatus, OfficialRole,
  CompetitionArea, WaiverStatus, WaiverItem,
  OFFICIAL_STATUS_LABEL, OFFICIAL_ROLE_LABEL,
} from "@/services/karateCompetitionP1Api";

const STATUS_TONE: Record<OfficialStatus, { bg: string; fg: string }> = {
  summoned: { bg: C.glassHi, fg: C.ink3 },
  confirmed: { bg: "#e8f2ec", fg: "#2e7d4f" },
  declined: { bg: "#f9e9e6", fg: "#b3372a" },
  present: { bg: "#e8f2ec", fg: "#2e7d4f" },
  absent: { bg: "#f9e9e6", fg: "#b3372a" },
};

export function ArbitragemTab({ federationId, competitionId }: { federationId: string; competitionId: string }) {
  const [section, setSection] = useState<"escala" | "termos">("escala");
  return (
    <View style={{ gap: 12 }}>
      <View style={s.sectionTabs}>
        {([["escala", "Arbitragem"], ["termos", "Termos"]] as [typeof section, string][]).map(([key, label]) => (
          <TouchableOpacity key={key} style={[s.sectionTab, section === key && s.sectionTabOn]} onPress={() => setSection(key)}>
            <Text style={[s.sectionTabTxt, section === key && s.sectionTabTxtOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {section === "escala"
        ? <EscalaSection federationId={federationId} competitionId={competitionId} />
        : <TermosSection federationId={federationId} competitionId={competitionId} />}
    </View>
  );
}

// ── 1) Escala ───────────────────────────────────────────────
function EscalaSection({ federationId, competitionId }: { federationId: string; competitionId: string }) {
  const [roster, setRoster] = useState<Official[] | null>(null);
  const [scale, setScale] = useState<EventOfficial[]>([]);
  const [areas, setAreas] = useState<CompetitionArea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newCred, setNewCred] = useState<"A" | "B" | "C" | "D" | "">("");
  const [newRole, setNewRole] = useState<OfficialRole>("arbitro");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [r, sc, ar] = await Promise.all([
        karateCompetitionP1Api.listOfficials(federationId),
        karateCompetitionP1Api.listEventOfficials(federationId, competitionId),
        karateCompetitionP1Api.listAreas(federationId, competitionId),
      ]);
      setRoster(r); setScale(sc); setAreas(ar);
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar a arbitragem.");
      setRoster([]);
    }
  }, [federationId, competitionId]);

  useEffect(() => { load(); }, [load]);

  const summonedIds = useMemo(() => new Set(scale.map((x) => x.official_id)), [scale]);
  const available = useMemo(() => (roster || []).filter((o) => !summonedIds.has(o.id)), [roster, summonedIds]);

  const createOfficial = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await karateCompetitionP1Api.createOfficial(federationId, {
        name, role: newRole, credential: newCred || null,
      } as any);
      setNewName(""); setNewCred("");
      toast.success("Oficial cadastrado.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível cadastrar.");
    } finally {
      setCreating(false);
    }
  };

  const summon = async (officialId: string) => {
    try {
      await karateCompetitionP1Api.summonOfficials(federationId, competitionId, [officialId]);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível convocar.");
    }
  };

  const patchRow = async (row: EventOfficial, patch: Parameters<typeof karateCompetitionP1Api.updateEventOfficial>[3]) => {
    setBusyRow(row.id);
    try {
      await karateCompetitionP1Api.updateEventOfficial(federationId, competitionId, row.id, patch);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível atualizar.");
    } finally {
      setBusyRow(null);
    }
  };

  const removeRow = async (row: EventOfficial) => {
    const ok = await confirmAsync({
      title: "Remover da escala?", message: `${row.name} sai da convocação deste evento.`,
      confirmLabel: "Remover", destructive: true,
    });
    if (!ok) return;
    try {
      await karateCompetitionP1Api.removeEventOfficial(federationId, competitionId, row.id);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível remover.");
    }
  };

  if (roster === null && !error) return <ActivityIndicator style={{ marginTop: 24 }} color={C.primary} />;
  if (error) return <KarateErrorState message={error} onRetry={load} />;

  const byArea = new Map<string, EventOfficial[]>();
  for (const row of scale) {
    const key = row.area_id || "__sem_area__";
    if (!byArea.has(key)) byArea.set(key, []);
    byArea.get(key)!.push(row);
  }
  const confirmed = scale.filter((x) => x.status === "confirmed" || x.status === "present").length;

  return (
    <View style={{ gap: 12 }}>
      <Text style={s.hint}>
        {scale.length} convocado{scale.length === 1 ? "" : "s"} · {confirmed} confirmado{confirmed === 1 ? "" : "s"}
        {areas.length ? ` · ${areas.length} área${areas.length === 1 ? "" : "s"}` : " · crie as áreas na aba Kotos para escalar"}
      </Text>

      {/* Escala por área */}
      {scale.length === 0 ? (
        <KarateEmptyState
          icon="users" title="Ninguém convocado ainda"
          subtitle="Convoque árbitros e mesários do cadastro da federação (abaixo)."
          style={{ paddingVertical: 20 }}
        />
      ) : (
        [...byArea.entries()].map(([areaKey, rows]) => (
          <View key={areaKey} style={s.areaBlock}>
            <Text style={s.areaTitle}>
              {areaKey === "__sem_area__" ? "Sem área definida" : (rows[0].area_name || "Área")}
              <Text style={s.areaCount}> · {rows.length}</Text>
            </Text>
            {rows.map((row) => (
              <View key={row.id} style={s.row}>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={s.rowName} numberOfLines={1}>{row.name}</Text>
                    {row.credential ? <View style={s.credChip}><Text style={s.credTxt}>{row.credential}</Text></View> : null}
                    {row.is_chief ? <View style={s.chiefChip}><Text style={s.chiefTxt}>SHUCHIN</Text></View> : null}
                  </View>
                  <Text style={s.rowMeta} numberOfLines={1}>
                    {OFFICIAL_ROLE_LABEL[row.role]}{row.dojo_name ? ` · ${row.dojo_name}` : ""}
                    {row.penalty_amount ? ` · multa R$ ${row.penalty_amount.toFixed(2).replace(".", ",")}` : ""}
                  </Text>
                </View>

                <View style={s.statusRow}>
                  {(["confirmed", "present", "absent"] as OfficialStatus[]).map((st) => {
                    const on = row.status === st;
                    const tone = STATUS_TONE[st];
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[s.statusChip, on && { backgroundColor: tone.bg, borderColor: tone.fg }]}
                        onPress={() => patchRow(row, {
                          status: st,
                          // Ausência do regulamento JKA: R$100 (árbitro).
                          ...(st === "absent" && !row.penalty_amount ? { penalty_amount: 100 } : {}),
                        })}
                        disabled={busyRow === row.id}
                      >
                        <Text style={[s.statusTxt, on && { color: tone.fg, fontWeight: "700" }]}>
                          {OFFICIAL_STATUS_LABEL[st]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {areas.length > 0 && (
                  <View style={s.areaPicker}>
                    {areas.map((a) => (
                      <TouchableOpacity
                        key={a.id}
                        style={[s.areaChip, row.area_id === a.id && s.areaChipOn]}
                        onPress={() => patchRow(row, { area_id: row.area_id === a.id ? null : a.id })}
                        disabled={busyRow === row.id}
                      >
                        <Text style={[s.areaChipTxt, row.area_id === a.id && s.areaChipTxtOn]}>{a.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity onPress={() => patchRow(row, { is_chief: !row.is_chief })} hitSlop={6} disabled={busyRow === row.id}>
                  <Icon name="star" size={15} color={row.is_chief ? C.primary : C.ink4} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeRow(row)} hitSlop={6}>
                  <Icon name="x" size={15} color={C.ink3} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))
      )}

      {/* Cadastro + convocação */}
      <View style={s.rosterBox}>
        <Text style={s.areaTitle}>Cadastro da federação</Text>
        <View style={s.newRow}>
          <TextInput
            style={s.newInput} value={newName} onChangeText={setNewName}
            placeholder="Nome do árbitro/mesário" placeholderTextColor={C.ink4}
          />
          <View style={{ flexDirection: "row", gap: 4 }}>
            {(["arbitro", "mesario", "staff"] as OfficialRole[]).map((r) => (
              <TouchableOpacity key={r} style={[s.miniChip, newRole === r && s.miniChipOn]} onPress={() => setNewRole(r)}>
                <Text style={[s.miniChipTxt, newRole === r && s.miniChipTxtOn]}>{OFFICIAL_ROLE_LABEL[r]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {newRole === "arbitro" && (
            <View style={{ flexDirection: "row", gap: 4 }}>
              {(["A", "B", "C", "D"] as const).map((cr) => (
                <TouchableOpacity key={cr} style={[s.credPick, newCred === cr && s.credPickOn]} onPress={() => setNewCred(newCred === cr ? "" : cr)}>
                  <Text style={[s.credPickTxt, newCred === cr && s.credPickTxtOn]}>{cr}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <KarateButton label={creating ? "..." : "Cadastrar"} variant="secondary" size="sm" onPress={createOfficial} disabled={creating || !newName.trim()} />
        </View>

        {available.length === 0 ? (
          <Text style={s.hint}>Todos os cadastrados já estão convocados.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
            {available.map((o) => (
              <TouchableOpacity key={o.id} style={s.availChip} onPress={() => summon(o.id)}>
                <Icon name="plus" size={12} color={C.primary} />
                <Text style={s.availTxt} numberOfLines={1}>
                  {o.name}{o.credential ? ` (${o.credential})` : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ── 2) Termos ───────────────────────────────────────────────
function TermosSection({ federationId, competitionId }: { federationId: string; competitionId: string }) {
  const [data, setData] = useState<WaiverStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<WaiverItem | null>(null);
  const [byName, setByName] = useState("");
  const [byRole, setByRole] = useState<"athlete" | "guardian">("athlete");
  const [byDoc, setByDoc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await karateCompetitionP1Api.getWaivers(federationId, competitionId));
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar os termos.");
    }
  }, [federationId, competitionId]);

  useEffect(() => { load(); }, [load]);

  const register = async () => {
    if (!openFor || !byName.trim()) return;
    setSaving(true);
    try {
      await karateCompetitionP1Api.registerWaiver(federationId, competitionId, {
        practitioner_id: openFor.practitioner_id,
        accepted_by_role: byRole,
        accepted_by_name: byName.trim(),
        accepted_by_doc: byDoc.trim() || undefined,
      });
      toast.success("Termo registrado.");
      setOpenFor(null); setByName(""); setByDoc("");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível registrar o termo.");
    } finally {
      setSaving(false);
    }
  };

  if (data === null && !error) return <ActivityIndicator style={{ marginTop: 24 }} color={C.primary} />;
  if (error) return <KarateErrorState message={error} onRetry={load} />;
  if (!data) return null;

  if (data.schema_pending) {
    return <Text style={s.hint}>Termos indisponíveis — migração pendente no servidor.</Text>;
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={s.waiverHead}>
        <Text style={s.waiverCount}>
          {data.accepted} de {data.total} aceitos
        </Text>
        {data.pending > 0 ? (
          <Text style={s.waiverPending}>{data.pending} pendente{data.pending === 1 ? "" : "s"}</Text>
        ) : (
          <Text style={s.waiverOk}>Delegações completas 🎉</Text>
        )}
      </View>

      {data.items.length === 0 ? (
        <KarateEmptyState
          icon="file_text" title="Sem inscritos ainda"
          subtitle="Os termos aparecem conforme as delegações inscrevem atletas."
          style={{ paddingVertical: 20 }}
        />
      ) : (
        data.items.map((it) => (
          <View key={it.practitioner_id} style={s.waiverRow}>
            <Icon
              name={it.accepted ? "check_circle" : "clock"}
              size={15}
              color={it.accepted ? "#2e7d4f" : C.ink3}
            />
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={s.rowName} numberOfLines={1}>{it.practitioner_name}</Text>
              <Text style={s.rowMeta} numberOfLines={1}>
                {it.dojo_name || "—"}
                {it.accepted && it.accepted_by_name
                  ? ` · assinado por ${it.accepted_by_name}${it.accepted_by_role === "guardian" ? " (responsável)" : ""}`
                  : ""}
              </Text>
            </View>
            {!it.accepted && (
              <KarateButton
                label={openFor?.practitioner_id === it.practitioner_id ? "Cancelar" : "Registrar"}
                variant="secondary" size="sm"
                onPress={() => {
                  const isOpen = openFor?.practitioner_id === it.practitioner_id;
                  setOpenFor(isOpen ? null : it);
                  setByName(isOpen ? "" : it.practitioner_name);
                  setByRole("athlete");
                }}
              />
            )}
            {openFor?.practitioner_id === it.practitioner_id && (
              <View style={s.waiverForm}>
                <View style={{ flexDirection: "row", gap: 5 }}>
                  {([["athlete", "O atleta"], ["guardian", "Responsável"]] as const).map(([role, label]) => (
                    <TouchableOpacity key={role} style={[s.miniChip, byRole === role && s.miniChipOn]} onPress={() => setByRole(role)}>
                      <Text style={[s.miniChipTxt, byRole === role && s.miniChipTxtOn]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={s.newInput} value={byName} onChangeText={setByName} placeholder="Nome de quem assinou" placeholderTextColor={C.ink4} />
                <TextInput style={s.newInput} value={byDoc} onChangeText={setByDoc} placeholder="RG/CPF (opcional)" placeholderTextColor={C.ink4} />
                <KarateButton label={saving ? "..." : "Confirmar aceite"} variant="sumi" size="sm" onPress={register} disabled={saving || !byName.trim()} />
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sectionTabs: { flexDirection: "row", gap: 6 } as ViewStyle,
  sectionTab: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 14, paddingVertical: 6 } as ViewStyle,
  sectionTabOn: { backgroundColor: C.primarySoft, borderColor: C.primaryLine } as ViewStyle,
  sectionTabTxt: { fontSize: 12.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  sectionTabTxtOn: { color: C.primary, fontWeight: "700" } as TextStyle,
  hint: { fontSize: 12, color: C.ink3 } as TextStyle,
  areaBlock: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 12, gap: 8 } as ViewStyle,
  areaTitle: { fontSize: 12.5, fontWeight: "800", color: C.ink } as TextStyle,
  areaCount: { fontWeight: "500", color: C.ink3 } as TextStyle,
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 } as ViewStyle,
  rowName: { fontSize: 13, fontWeight: "700", color: C.ink } as TextStyle,
  rowMeta: { fontSize: 11, color: C.ink3, marginTop: 1 } as TextStyle,
  credChip: { borderRadius: 4, backgroundColor: C.primary, paddingHorizontal: 5, paddingVertical: 1 } as ViewStyle,
  credTxt: { fontSize: 10, fontWeight: "800", color: "#fdf8f2" } as TextStyle,
  chiefChip: { borderRadius: 999, backgroundColor: "#f7efdd", borderWidth: 1, borderColor: "#e8d9b5", paddingHorizontal: 7, paddingVertical: 1 } as ViewStyle,
  chiefTxt: { fontSize: 9, fontWeight: "800", color: "#a8730f" } as TextStyle,
  statusRow: { flexDirection: "row", gap: 4 } as ViewStyle,
  statusChip: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 9, paddingVertical: 3 } as ViewStyle,
  statusTxt: { fontSize: 11, color: C.ink3 } as TextStyle,
  areaPicker: { flexDirection: "row", gap: 4, flexWrap: "wrap" } as ViewStyle,
  areaChip: { borderRadius: R.sm, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.glassHi } as ViewStyle,
  areaChipOn: { backgroundColor: C.primarySoft, borderColor: C.primaryLine } as ViewStyle,
  areaChipTxt: { fontSize: 10.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  areaChipTxtOn: { color: C.primary, fontWeight: "700" } as TextStyle,
  rosterBox: { backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 12, gap: 8 } as ViewStyle,
  newRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" } as ViewStyle,
  newInput: { minWidth: 170, flex: 1, fontSize: 13, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.surface } as TextStyle,
  miniChip: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: C.surface } as ViewStyle,
  miniChipOn: { backgroundColor: C.primarySoft, borderColor: C.primaryLine } as ViewStyle,
  miniChipTxt: { fontSize: 11, fontWeight: "600", color: C.ink3 } as TextStyle,
  miniChipTxtOn: { color: C.primary, fontWeight: "700" } as TextStyle,
  credPick: { width: 28, height: 28, borderRadius: R.sm, borderWidth: 1, borderColor: C.border2, alignItems: "center", justifyContent: "center", backgroundColor: C.surface } as ViewStyle,
  credPickOn: { backgroundColor: C.primary, borderColor: C.primary } as ViewStyle,
  credPickTxt: { fontSize: 12, fontWeight: "700", color: C.ink3 } as TextStyle,
  credPickTxtOn: { color: "#fdf8f2" } as TextStyle,
  availChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, borderColor: C.primaryLine, backgroundColor: C.primarySoft, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 220 } as ViewStyle,
  availTxt: { fontSize: 11.5, fontWeight: "700", color: C.primary } as TextStyle,
  waiverHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 } as ViewStyle,
  waiverCount: { fontSize: 13, fontWeight: "800", color: C.ink } as TextStyle,
  waiverPending: { fontSize: 12, fontWeight: "700", color: C.primary } as TextStyle,
  waiverOk: { fontSize: 12, fontWeight: "700", color: "#2e7d4f" } as TextStyle,
  waiverRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, padding: 10 } as ViewStyle,
  waiverForm: { width: "100%", gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 } as ViewStyle,
});
