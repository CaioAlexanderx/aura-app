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
  Modal, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateFonts as F, KarateRadius as R } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { ModalPop } from "@/components/karate/anim/ModalPop";
import { toast } from "@/components/Toast";
import { copyToClipboard } from "@/utils/clipboard";
import {
  karateCompetitionP1Api, Official, EventOfficial, OfficialStatus, OfficialRole,
  CompetitionArea, WaiverStatus, WaiverItem,
  OFFICIAL_STATUS_LABEL, OFFICIAL_ROLE_LABEL,
} from "@/services/karateCompetitionP1Api";

// URL pública da mesa do mesário (Hub P2.1) — a rota /mesa vive fora do
// shell autenticado e lê o token pela query (?t=).
const MESA_BASE_URL = "https://app.getaura.com.br/mesa";

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
  // P2.1 — link da mesa (acesso do mesário fora do shell) por convocação.
  const [mesaRow, setMesaRow] = useState<EventOfficial | null>(null);

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

                {/* P2.1 — link da mesa: acesso do mesário fora do shell */}
                <TouchableOpacity
                  style={[s.mesaChip, row.mesa_token_active && s.mesaChipOn]}
                  onPress={() => setMesaRow(row)}
                  accessibilityRole="button"
                  accessibilityLabel={row.mesa_token_active ? `Gerenciar o link da mesa de ${row.name}` : `Gerar link da mesa para ${row.name}`}
                >
                  <Icon name="link" size={12} color={row.mesa_token_active ? "#2e7d4f" : C.ink3} />
                  <Text style={[s.mesaChipTxt, row.mesa_token_active && s.mesaChipTxtOn]}>
                    {row.mesa_token_active ? "Mesa ativa" : "Link da mesa"}
                  </Text>
                </TouchableOpacity>

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

      {/* P2.1 — modal do link da mesa */}
      {mesaRow && (
        <MesaLinkModal
          federationId={federationId}
          competitionId={competitionId}
          row={mesaRow}
          onClose={() => setMesaRow(null)}
          onChanged={load}
        />
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// P2.1 — MODAL DO LINK DA MESA (acesso do mesário fora do shell)
//
// Fluxos:
//   sem link ativo → explica o que o link dá e gera (POST mesa-token);
//   emitido        → mostra o LINK COMPLETO uma única vez (copiar);
//   link ativo     → gerenciar: gerar novo (rotaciona) ou revogar.
//
// O escopo do acesso segue o koto ATUAL da convocação — trocar o
// mesário de koto NÃO exige novo link (o backend relê a cada request).
// ════════════════════════════════════════════════════════════
function fmtIssuedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso); // timestamptz completo — Date é seguro aqui
  if (isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function MesaLinkModal({
  federationId, competitionId, row, onClose, onChanged,
}: {
  federationId: string;
  competitionId: string;
  row: EventOfficial;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  // Token emitido NESTA abertura do modal — única chance de ver o link.
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // O flag da listagem pode ficar defasado após emitir/revogar aqui dentro.
  const [active, setActive] = useState(!!row.mesa_token_active);

  const issue = async () => {
    if (active) {
      const ok = await confirmAsync({
        title: "Gerar um novo link?",
        message: `${row.name} já tem um link de mesa ativo. Gerar um novo SUBSTITUI o anterior — o link antigo para de funcionar na hora.`,
        confirmLabel: "Gerar novo link",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const out = await karateCompetitionP1Api.issueMesaToken(federationId, competitionId, row.id);
      setIssuedUrl(`${MESA_BASE_URL}?t=${out.token}`);
      setActive(true);
      setCopied(false);
      await onChanged();
    } catch (e: any) {
      if (e?.data?.code === "SCHEMA_PENDING") {
        toast.error("Link da mesa ainda indisponível — atualização do servidor pendente (migration 302).");
      } else {
        toast.error(e?.message || "Não foi possível gerar o link da mesa.");
      }
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    const ok = await confirmAsync({
      title: "Revogar o acesso da mesa?",
      message: `${row.name} perde o acesso à mesa imediatamente. Para devolver o acesso será preciso gerar (e enviar) um novo link.`,
      confirmLabel: "Revogar acesso",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await karateCompetitionP1Api.revokeMesaToken(federationId, competitionId, row.id);
      toast.success("Acesso da mesa revogado.");
      setActive(false);
      setIssuedUrl(null);
      await onChanged();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível revogar o link.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!issuedUrl) return;
    const ok = await copyToClipboard(issuedUrl);
    if (ok) { setCopied(true); toast.success("Link copiado — envie ao mesário."); }
    else toast.error("Não foi possível copiar — selecione o link e copie manualmente.");
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={s.mesaOverlay}>
        <ModalPop visible style={s.mesaCard}>
          <View style={s.mesaHead}>
            <View style={s.mesaSeal}>
              <Icon name="link" size={18} color="#fdf8f2" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.mesaTitle}>Link da mesa</Text>
              <Text style={s.mesaSub} numberOfLines={1}>{row.name} · {OFFICIAL_ROLE_LABEL[row.role]}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="x" size={17} color={C.ink3} />
            </TouchableOpacity>
          </View>

          {issuedUrl ? (
            <>
              {/* ── Link emitido — mostrado UMA única vez ── */}
              <View style={s.mesaWarnBox}>
                <Icon name="alert" size={14} color="#7a5724" />
                <Text style={s.mesaWarnTxt}>
                  Este link aparece <Text style={{ fontWeight: "800" }}>uma única vez</Text>. Copie e envie ao mesário agora — ao fechar, ele não poderá ser recuperado (só gerando outro).
                </Text>
              </View>
              <View style={s.mesaUrlBox}>
                <Text style={s.mesaUrlTxt} selectable numberOfLines={3}>{issuedUrl}</Text>
              </View>
              <KarateButton
                label={copied ? "Link copiado" : "Copiar link"}
                variant="sumi" size="lg"
                onPress={copy}
              />
              <Text style={s.mesaHint}>
                O acesso é escopado ao koto atual da convocação: se você mover {row.name.split(" ")[0]} de koto, o MESMO link passa a operar o koto novo — sem reenviar nada.
              </Text>
              <KarateButton label="Concluído" variant="ghost" size="md" onPress={onClose} />
            </>
          ) : active ? (
            <>
              {/* ── Link ativo — gerenciar ── */}
              <View style={s.mesaActiveBox}>
                <Icon name="check_circle" size={15} color="#2e7d4f" />
                <Text style={s.mesaActiveTxt}>
                  Link ativo{fmtIssuedAt(row.mesa_token_created_at) ? ` — emitido em ${fmtIssuedAt(row.mesa_token_created_at)}` : ""}.
                  Por segurança o link não pode ser exibido de novo.
                </Text>
              </View>
              <Text style={s.mesaHint}>
                Perdeu o link? Gere um novo (o atual para de funcionar). Encerrou a participação? Revogue o acesso.
              </Text>
              <KarateButton
                label={busy ? "Gerando..." : "Gerar novo link (substitui o atual)"}
                variant="sumi" size="md" loading={busy} disabled={busy}
                onPress={issue}
              />
              <KarateButton
                label="Revogar acesso"
                variant="primary" size="md" disabled={busy}
                onPress={revoke}
              />
            </>
          ) : (
            <>
              {/* ── Sem link — explicar e gerar ── */}
              <Text style={s.mesaBody}>
                O link da mesa dá acesso à operação do koto <Text style={{ fontWeight: "700" }}>sem conta Aura</Text>: chamada
                das lutas, vencedor e decisão, notas de kata, cronômetro e fechamento de resultado — sempre limitado às
                categorias do koto em que {row.name.split(" ")[0]} estiver alocado agora.
              </Text>
              <View style={s.mesaWarnBox}>
                <Icon name="info" size={14} color={C.ink2} />
                <Text style={s.mesaWarnTxt}>
                  O link será mostrado uma única vez após a geração. Você pode revogá-lo a qualquer momento.
                </Text>
              </View>
              <KarateButton
                label={busy ? "Gerando..." : "Gerar link da mesa"}
                variant="sumi" size="lg" loading={busy} disabled={busy}
                onPress={issue}
              />
              <KarateButton label="Cancelar" variant="ghost" size="md" onPress={onClose} />
            </>
          )}
        </ModalPop>
      </View>
    </Modal>
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

  // P2.1 — link da mesa
  mesaChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, borderColor: C.border2, backgroundColor: C.glassHi, paddingHorizontal: 9, paddingVertical: 4 } as ViewStyle,
  mesaChipOn: { backgroundColor: "#e8f2ec", borderColor: "#2e7d4f" } as ViewStyle,
  mesaChipTxt: { fontSize: 10.5, fontWeight: "700", color: C.ink3 } as TextStyle,
  mesaChipTxtOn: { color: "#2e7d4f" } as TextStyle,

  mesaOverlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  mesaCard: { width: "100%", maxWidth: 460, backgroundColor: "#fdf8f2", borderRadius: 16, padding: 20, gap: 12 } as ViewStyle,
  mesaHead: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  mesaSeal: { width: 38, height: 38, borderRadius: 999, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" } as ViewStyle,
  mesaTitle: { fontFamily: F.heading, fontSize: 19, fontWeight: "600", color: C.ink } as TextStyle,
  mesaSub: { fontSize: 12, color: C.ink3, marginTop: 1 } as TextStyle,
  mesaBody: { fontSize: 13, color: C.ink2, lineHeight: 19 } as TextStyle,
  mesaWarnBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(156,111,46,0.10)", borderWidth: 1, borderColor: "rgba(156,111,46,0.28)", borderRadius: R.md, padding: 11 } as ViewStyle,
  mesaWarnTxt: { flex: 1, fontSize: 12.5, color: "#7a5724", lineHeight: 18 } as TextStyle,
  mesaActiveBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#e8f2ec", borderWidth: 1, borderColor: "rgba(46,125,79,0.3)", borderRadius: R.md, padding: 11 } as ViewStyle,
  mesaActiveTxt: { flex: 1, fontSize: 12.5, color: "#2e7d4f", lineHeight: 18 } as TextStyle,
  mesaUrlBox: { backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border2, borderRadius: R.md, padding: 12 } as ViewStyle,
  mesaUrlTxt: { fontFamily: F.mono, fontSize: 12.5, color: C.ink, lineHeight: 19 } as TextStyle,
  mesaHint: { fontSize: 11.5, color: C.ink3, lineHeight: 17 } as TextStyle,
});
