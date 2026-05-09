// ============================================================
// PatientsList — nova tela de pacientes (PR28).
//
// Substitui a UI antiga em PacientesTab. Visual alinhado ao
// shell odonto (mockup-pacientes-v1.html aprovado pelo user):
//
//  - Header: titulo + 2 acoes (Importar CSV / Novo paciente)
//  - Stats bar: 4 KPIs (Ativos/Total / Retornar / Aniversariantes / Convenios)
//  - Toolbar: search + filter pills + view toggle Grid/Lista
//  - Bulk bar: aparece quando ha selecao multipla
//  - Grid (cards com avatar + tags) ou Lista (tabela compacta)
//
// PR31 (2026-04-28): filtros agora sao server-side via query params
// (has_allergies, has_insurance, inactive_days). Backend PR30 ja
// retorna last_visit_at + next_appointment_at. Bulk actions e
// importar CSV continuam placeholders ate ter backend dedicado.
//
// #1  (2026-05-09): stats mostram ativos/total; filtro por plano
//     (cycling chip) + toggle Ativos/Todos — client-side.
// #14 (2026-05-09): codigo sequencial #NNN visivel em card e lista.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, StyleSheet, Modal, Image } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { DentalColors } from "@/constants/dental-tokens";
import type { PatientLite } from "@/components/verticals/odonto/PatientHub";

type ViewMode = "grid" | "list";

interface Props {
  onOpenPatient: (p: PatientLite) => void;
  onNewPatient: () => void;
}

interface BackendPatient {
  id: string;
  full_name?: string;
  name?: string;
  phone?: string | null;
  phone_secondary?: string | null;
  email?: string | null;
  cpf_cnpj?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  postal_code?: string | null;
  street?: string | null;
  address_number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  allergies?: string | null;
  medical_history?: string | null;
  medications?: string | null;
  insurance_name?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  created_at?: string;
  next_appointment_at?: string | null;
  last_visit_at?: string | null;
  is_vip?: boolean;
}

/** Considera paciente ativo se tem proximo agendamento OU visitou nos ultimos 180 dias. */
function isActive(p: BackendPatient): boolean {
  if (p.next_appointment_at) return true;
  if (!p.last_visit_at) return false;
  try {
    const cutoff = Date.now() - 180 * 86400000;
    return new Date(p.last_visit_at).getTime() > cutoff;
  } catch { return false; }
}

function isBirthdayWithin(birthDate: string | null | undefined, days = 7): boolean {
  if (!birthDate) return false;
  try {
    const birth = new Date(birthDate);
    const today = new Date();
    for (let i = 0; i <= days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getMonth() === birth.getMonth() && d.getDate() === birth.getDate()) return true;
    }
  } catch {}
  return false;
}

function daysBetween(iso?: string | null): number | null {
  if (!iso) return null;
  try {
    const dt = new Date(iso);
    const now = new Date();
    return Math.floor((now.getTime() - dt.getTime()) / 86400000);
  } catch { return null; }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return "—"; }
}

function patientToLite(p: BackendPatient): PatientLite {
  return {
    id: p.id,
    name: p.full_name || p.name || "Paciente",
    full_name: p.full_name,
    phone: p.phone,
    phone_secondary: p.phone_secondary,
    email: p.email,
    cpf: p.cpf_cnpj || p.cpf,
    birthday: p.birth_date,
    birth_date: p.birth_date,
    gender: p.gender,
    postal_code: p.postal_code,
    street: p.street,
    address_number: p.address_number,
    complement: p.complement,
    neighborhood: p.neighborhood,
    city: p.city,
    state: p.state,
    allergies: p.allergies,
    medical_history: p.medical_history,
    medications: p.medications,
    insurance_name: p.insurance_name,
    notes: p.notes,
    created_at: p.created_at,
    is_patient: true,
    photo_url: (p as any).photo_url || null,
  } as PatientLite;
}

export function PatientsList({ onOpenPatient, onNewPatient }: Props) {
  const cid = useAuthStore().company?.id;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  // Server-side filters (PR31)
  const [filterAlergias, setFilterAlergias] = useState(false);
  const [filterConvenio, setFilterConvenio] = useState(false);
  const [filterInactive, setFilterInactive] = useState(false);
  // Client-side filters (#1)
  const [filterPlano, setFilterPlano] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);

  // Debounce search 250ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // PR31: monta query string com filtros server-side
  const qs = useMemo(() => {
    const params: string[] = [`limit=100`];
    if (debouncedSearch) params.push(`search=${encodeURIComponent(debouncedSearch)}`);
    if (filterAlergias) params.push(`has_allergies=1`);
    if (filterConvenio) params.push(`has_insurance=1`);
    if (filterInactive) params.push(`inactive_days=100`);
    return params.join("&");
  }, [debouncedSearch, filterAlergias, filterConvenio, filterInactive]);

  const { data, isLoading } = useQuery({
    queryKey: ["dental-patients", cid, qs],
    queryFn: () => request(`/companies/${cid}/dental/patients?${qs}`),
    enabled: !!cid, staleTime: 30000,
  });

  const allPatients: BackendPatient[] = ((data as any)?.patients) || [];

  // Planos disponiveis para o cycling chip (#1)
  const availablePlans = useMemo(() => {
    const plans = new Set<string>();
    allPatients.forEach((p) => {
      if (p.insurance_name && p.insurance_name.trim()) {
        plans.add(p.insurance_name.trim());
      }
    });
    return Array.from(plans).sort();
  }, [allPatients]);

  // Cicla plano: null -> plano1 -> plano2 -> ... -> null
  function cyclePlan() {
    if (!filterPlano || availablePlans.length === 0) {
      setFilterPlano(availablePlans[0] || null);
    } else {
      const idx = availablePlans.indexOf(filterPlano);
      setFilterPlano(idx >= availablePlans.length - 1 ? null : availablePlans[idx + 1]);
    }
  }

  // Stats client-side (#1: agora distingue ativos/total)
  const stats = useMemo(() => {
    const total = allPatients.length;
    const active = allPatients.filter(isActive).length;
    const aniversariantes = allPatients.filter((p) => isBirthdayWithin(p.birth_date, 7)).length;
    const semRetorno = allPatients.filter((p) => !p.next_appointment_at).length;
    const comConvenio = allPatients.filter((p) => p.insurance_name && p.insurance_name.trim()).length;
    return { total, active, aniversariantes, semRetorno, comConvenio };
  }, [allPatients]);

  // Client-side: plano + active (#1)
  const filtered = useMemo(() => {
    let list = allPatients;
    if (filterPlano) {
      list = list.filter((p) => p.insurance_name?.trim() === filterPlano);
    }
    if (filterActive) {
      list = list.filter(isActive);
    }
    return list;
  }, [allPatients, filterPlano, filterActive]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }
  function selectAll() { setSelectedIds(new Set(filtered.map((p) => p.id))); }

  const selectedCount = selectedIds.size;

  function bulkAction(label: string) {
    toast.info(`${label} de ${selectedCount} pacientes - em breve`);
  }
  function notImplemented(label: string) {
    toast.info(`${label} - em breve`);
  }

  const anyFilterActive = filterAlergias || filterConvenio || filterInactive || !!filterPlano || filterActive;

  return (
    <View style={{ gap: 16 }}>
      {/* HEADER */}
      <View style={s.pageHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>OPERAÇÃO</Text>
          <Text style={s.h1}>Pacientes</Text>
          <Text style={s.sub}>
            {stats.active} ativos de {stats.total} total
            {anyFilterActive ? " (com filtros aplicados)" : ""}
            {stats.aniversariantes > 0 ? ` · ${stats.aniversariantes} aniversariantes nesta semana` : ""}
          </Text>
        </View>
        <View style={s.headActions}>
          <Pressable onPress={() => setImportOpen(true)} style={s.btnSecondary}>
            <Icon name="package" size={13} color={DentalColors.ink2} />
            <Text style={s.btnSecondaryText}>Importar CSV</Text>
          </Pressable>
          <Pressable onPress={onNewPatient} style={s.btnPrimary}>
            <Icon name="plus" size={13} color="#fff" />
            <Text style={s.btnPrimaryText}>Novo paciente</Text>
          </Pressable>
        </View>
      </View>

      {/* STATS BAR */}
      <View style={s.statsRow}>
        {/* #1: mostra ativos/total */}
        <Stat label="ATIVOS" value={`${stats.active}/${stats.total}`} delta="dos últimos 180 dias" accent="cyan" />
        <Stat label="SEM RETORNO" value={String(stats.semRetorno)} delta={stats.semRetorno > 0 ? "convidar" : null} accent="amber" />
        <Stat label="ANIVERSARIANTES" value={String(stats.aniversariantes)} delta="proximos 7 dias" accent="violet" />
        <Stat label="CONVÊNIOS" value={String(stats.comConvenio)} delta={`${stats.total > 0 ? Math.round((stats.comConvenio / stats.total) * 100) : 0}% da base`} accent="cyan" />
      </View>

      {/* TOOLBAR */}
      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Icon name="search" size={14} color={DentalColors.ink3} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por nome, CPF, telefone..."
            placeholderTextColor={DentalColors.ink3}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* #1: toggle Ativos */}
        <Pressable onPress={() => setFilterActive((v) => !v)} style={[s.chip, filterActive && s.chipActive]}>
          <Text style={[s.chipText, filterActive && s.chipTextActive]}>
            {filterActive ? "Ativos ✓" : "Ativos: Todos"}
          </Text>
        </Pressable>

        {/* PR31: Convenio server-side */}
        <Pressable onPress={() => setFilterConvenio((v) => !v)} style={[s.chip, filterConvenio && s.chipActive]}>
          <Text style={[s.chipText, filterConvenio && s.chipTextActive]}>
            {filterConvenio ? "Com convenio ✓" : "Convenio: Todos"}
          </Text>
        </Pressable>

        {/* #1: Plano cycling chip */}
        <Pressable
          onPress={cyclePlan}
          style={[s.chip, filterPlano != null && s.chipActive]}
          disabled={availablePlans.length === 0}
        >
          <Text style={[s.chipText, filterPlano != null && s.chipTextActive]}>
            {filterPlano ? `Plano: ${filterPlano.length > 14 ? filterPlano.slice(0, 12) + "…" : filterPlano} ✓` : "Plano: Todos"}
          </Text>
        </Pressable>

        {/* PR31: Ultima visita */}
        <Pressable onPress={() => setFilterInactive((v) => !v)} style={[s.chip, filterInactive && s.chipActive]}>
          <Text style={[s.chipText, filterInactive && s.chipTextActive]}>
            {filterInactive ? "Inativos 100+d ✓" : "Ultima visita: Qualquer"}
          </Text>
        </Pressable>

        <Pressable onPress={() => setFilterAlergias((v) => !v)} style={[s.chip, filterAlergias && s.chipActive]}>
          <Text style={[s.chipText, filterAlergias && s.chipTextActive]}>
            Alergias {filterAlergias ? "✓" : ""}
          </Text>
        </Pressable>

        <View style={s.viewToggle}>
          <Pressable onPress={() => setViewMode("grid")} style={[s.viewBtn, viewMode === "grid" && s.viewBtnActive]}>
            <Icon name="grid" size={12} color={viewMode === "grid" ? "#fff" : DentalColors.ink3} />
            <Text style={[s.viewBtnText, viewMode === "grid" && s.viewBtnTextActive]}>Grid</Text>
          </Pressable>
          <Pressable onPress={() => setViewMode("list")} style={[s.viewBtn, viewMode === "list" && s.viewBtnActive]}>
            <Icon name="list" size={12} color={viewMode === "list" ? "#fff" : DentalColors.ink3} />
            <Text style={[s.viewBtnText, viewMode === "list" && s.viewBtnTextActive]}>Lista</Text>
          </Pressable>
        </View>
      </View>

      {/* BULK BAR */}
      {selectedCount > 0 && (
        <View style={s.bulkBar}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={s.bulkCount}><Text style={s.bulkCountText}>{selectedCount}</Text></View>
            <Text style={{ color: DentalColors.ink2, fontSize: 13 }}>pacientes selecionados</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pressable onPress={() => bulkAction("WhatsApp")} style={s.bulkBtn}><Text style={s.bulkBtnText}>📲 WhatsApp</Text></Pressable>
            <Pressable onPress={() => bulkAction("Etiquetas")} style={s.bulkBtn}><Text style={s.bulkBtnText}>🏷️ Etiquetas</Text></Pressable>
            <Pressable onPress={() => bulkAction("Exportar")} style={s.bulkBtn}><Text style={s.bulkBtnText}>📤 Exportar</Text></Pressable>
            <Pressable onPress={() => bulkAction("Arquivar")} style={[s.bulkBtn, s.bulkBtnDanger]}><Text style={[s.bulkBtnText, { color: DentalColors.red }]}>🗑️ Arquivar</Text></Pressable>
            <Pressable onPress={clearSelection} style={s.bulkBtn}><Text style={s.bulkBtnText}>✕ Limpar</Text></Pressable>
          </View>
        </View>
      )}

      {/* CONTENT */}
      {isLoading ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator color={DentalColors.cyan} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Icon name="users" size={28} color={DentalColors.ink3} />
          <Text style={s.emptyText}>{search || anyFilterActive ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}</Text>
          <Text style={s.emptyHint}>{search || anyFilterActive ? "Ajuste a busca ou os filtros" : 'Clique em "Novo paciente" para começar'}</Text>
        </View>
      ) : viewMode === "grid" ? (
        <View style={s.grid}>
          {filtered.map((p, idx) => (
            <PatientCard
              key={p.id}
              patient={p}
              index={idx + 1}
              selected={selectedIds.has(p.id)}
              onToggleSelect={() => toggleSelect(p.id)}
              onOpen={() => onOpenPatient(patientToLite(p))}
            />
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginHorizontal: -4 }}>
          <View style={{ minWidth: 760, gap: 4, paddingHorizontal: 4 }}>
            <View style={s.listHeader}>
              <View style={s.listCellCheck}>
                <Pressable onPress={selectedCount === filtered.length ? clearSelection : selectAll} style={[s.checkBox, selectedCount === filtered.length && s.checkBoxOn]}>
                  {selectedCount === filtered.length && <Text style={s.checkMark}>✓</Text>}
                </Pressable>
              </View>
              {/* #14: coluna codigo */}
              <Text style={[s.listHeaderText, { width: 44 }]}>#</Text>
              <Text style={[s.listHeaderText, { flex: 2 }]}>PACIENTE</Text>
              <Text style={[s.listHeaderText, { width: 140 }]}>TELEFONE</Text>
              <Text style={[s.listHeaderText, { width: 110 }]}>ULTIMA VISITA</Text>
              <Text style={[s.listHeaderText, { width: 100 }]}>PLANO</Text>
            </View>
            {filtered.map((p, idx) => (
              <PatientRow
                key={p.id}
                patient={p}
                index={idx + 1}
                selected={selectedIds.has(p.id)}
                onToggleSelect={() => toggleSelect(p.id)}
                onOpen={() => onOpenPatient(patientToLite(p))}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {/* MODAL Importar CSV */}
      <ImportCsvModal visible={importOpen} onClose={() => setImportOpen(false)} />
    </View>
  );
}

function PatientCard({ patient, index, selected, onToggleSelect, onOpen }: { patient: BackendPatient; index: number; selected: boolean; onToggleSelect: () => void; onOpen: () => void }) {
  const initials = (patient.full_name || patient.name || "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const hasBday = isBirthdayWithin(patient.birth_date, 7);
  const hasAlergia = !!(patient.allergies && patient.allergies.trim());
  const lastVisitDays = daysBetween(patient.last_visit_at);
  const isInactive = lastVisitDays != null && lastVisitDays > 100;
  const photoUrl = (patient as any).photo_url as string | null | undefined;
  const code = `#${String(index).padStart(3, "0")}`;

  return (
    <Pressable onPress={onOpen} style={[s.card, selected && s.cardSelected]}>
      <Pressable
        onPress={(e: any) => { e.stopPropagation?.(); onToggleSelect(); }}
        style={[s.cardCheck, selected && s.cardCheckOn]}
      >
        {selected && <Text style={s.checkMark}>✓</Text>}
      </Pressable>

      {/* #14: badge de codigo no canto inferior-esquerdo do avatar area */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ position: "relative" }}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={s.cardAvatar} />
          ) : (
            <View style={s.cardAvatarFallback}>
              <Text style={s.cardAvatarText}>{initials}</Text>
            </View>
          )}
          {/* codigo sequencial */}
          <View style={s.patientCode}>
            <Text style={s.patientCodeText}>{code}</Text>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardName} numberOfLines={1}>{patient.full_name || patient.name}</Text>
          <Text style={s.cardMeta}>
            {patient.gender ? (patient.gender === "F" ? "Feminino" : patient.gender === "M" ? "Masculino" : patient.gender) : ""}
          </Text>
          <View style={s.cardTags}>
            {hasAlergia && <Tag kind="alergia">⚠ {patient.allergies?.split(",")[0].trim().slice(0, 20)}</Tag>}
            {hasBday && <Tag kind="bday">🎂</Tag>}
            {patient.insurance_name && <Tag kind="convenio">{patient.insurance_name.slice(0, 12)}</Tag>}
          </View>
        </View>
      </View>

      <View style={s.cardInfo}>
        <View style={s.infoRow}>
          <Text style={s.infoLbl}>Telefone</Text>
          <Text style={s.infoVal} numberOfLines={1}>{patient.phone || "—"}</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLbl}>Ultima visita</Text>
          <Text style={s.infoVal}>{lastVisitDays != null ? `${fmtDate(patient.last_visit_at)} (${lastVisitDays}d)` : "Nunca"}</Text>
        </View>
      </View>

      {patient.next_appointment_at ? (
        <View style={s.nextAppt}>
          <Text style={s.nextApptText}>
            <Text style={{ color: DentalColors.cyan, fontWeight: "700" }}>Proximo: </Text>
            {fmtDate(patient.next_appointment_at)}
          </Text>
        </View>
      ) : isInactive ? (
        <View style={[s.nextAppt, { backgroundColor: "rgba(239,68,68,0.10)", borderLeftColor: DentalColors.red }]}>
          <Text style={s.nextApptText}>
            <Text style={{ color: DentalColors.red, fontWeight: "700" }}>✗ Inativo {lastVisitDays}d</Text> · campanha de retorno
          </Text>
        </View>
      ) : (
        <View style={[s.nextAppt, { backgroundColor: "rgba(251,191,36,0.10)", borderLeftColor: DentalColors.amber }]}>
          <Text style={s.nextApptText}>
            <Text style={{ color: DentalColors.amber, fontWeight: "700" }}>⚠</Text> Sem retorno agendado
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function PatientRow({ patient, index, selected, onToggleSelect, onOpen }: { patient: BackendPatient; index: number; selected: boolean; onToggleSelect: () => void; onOpen: () => void }) {
  const initials = (patient.full_name || patient.name || "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const lastVisitDays = daysBetween(patient.last_visit_at);
  const photoUrl = (patient as any).photo_url as string | null | undefined;
  const code = `#${String(index).padStart(3, "0")}`;

  return (
    <Pressable onPress={onOpen} style={[s.listRow, selected && s.listRowSelected]}>
      <View style={s.listCellCheck}>
        <Pressable onPress={(e: any) => { e.stopPropagation?.(); onToggleSelect(); }} style={[s.checkBox, selected && s.checkBoxOn]}>
          {selected && <Text style={s.checkMark}>✓</Text>}
        </Pressable>
      </View>
      {/* #14: codigo */}
      <Text style={[s.listCode, { width: 44 }]} numberOfLines={1}>{code}</Text>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={s.listAvatar} />
      ) : (
        <View style={[s.listAvatar, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{initials}</Text>
        </View>
      )}
      <View style={{ flex: 2, minWidth: 0 }}>
        <Text style={s.listName} numberOfLines={1}>{patient.full_name || patient.name}</Text>
        <Text style={s.listMeta} numberOfLines={1}>
          {patient.gender || ""}{patient.birth_date ? ` · nasceu ${fmtDate(patient.birth_date)}` : ""}
        </Text>
      </View>
      <Text style={[s.listText, { width: 140 }]} numberOfLines={1}>{patient.phone || "—"}</Text>
      <Text style={[s.listText, { width: 110 }]} numberOfLines={1}>
        {patient.last_visit_at ? `${fmtDate(patient.last_visit_at)} (${lastVisitDays}d)` : "Nunca"}
      </Text>
      <Text style={[s.listText, { width: 100 }]} numberOfLines={1}>{patient.insurance_name || "Particular"}</Text>
    </Pressable>
  );
}

function Stat({ label, value, delta, accent }: { label: string; value: string; delta: string | null; accent: "cyan" | "amber" | "violet" }) {
  const accentColor = accent === "cyan" ? DentalColors.cyan : accent === "amber" ? DentalColors.amber : DentalColors.violet;
  return (
    <View style={[s.stat, { borderLeftColor: accentColor, borderLeftWidth: 3 }]}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
      {delta && <Text style={[s.statDelta, accent === "amber" && { color: DentalColors.amber }]}>{delta}</Text>}
    </View>
  );
}

function Tag({ kind, children }: { kind: "alergia" | "bday" | "convenio" | "vip"; children: any }) {
  const colors: Record<string, { bg: string; fg: string; border: string }> = {
    alergia: { bg: "rgba(239,68,68,0.12)", fg: DentalColors.red, border: "rgba(239,68,68,0.30)" },
    bday: { bg: "rgba(251,191,36,0.12)", fg: DentalColors.amber, border: "rgba(251,191,36,0.30)" },
    convenio: { bg: DentalColors.cyanDim, fg: DentalColors.cyan, border: DentalColors.cyanBorder },
    vip: { bg: "rgba(124,58,237,0.12)", fg: "#c4b5fd", border: "rgba(124,58,237,0.30)" },
  };
  const c = colors[kind];
  return (
    <View style={[s.tag, { backgroundColor: c.bg, borderColor: c.border, borderWidth: 1 }]}>
      <Text style={[s.tagText, { color: c.fg }]}>{children}</Text>
    </View>
  );
}

function ImportCsvModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalBg}>
        <View style={s.modal}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: DentalColors.ink, marginBottom: 4 }}>📥 Importar pacientes</Text>
          <Text style={{ fontSize: 12, color: DentalColors.ink3, marginBottom: 18 }}>
            Aceita CSV ou XLSX com colunas nome, telefone, email, data_nascimento, cpf.
          </Text>

          <View style={s.uploadZone}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📂</Text>
            <Text style={{ fontSize: 13, color: DentalColors.ink, fontWeight: "600", textAlign: "center" }}>Arraste seu arquivo ou clique para selecionar</Text>
            <Text style={{ fontSize: 10, color: DentalColors.ink3, marginTop: 4, textAlign: "center" }}>CSV/XLSX · ate 5MB · max 5.000 linhas</Text>
          </View>

          <View style={{ marginTop: 14, padding: 12, backgroundColor: DentalColors.cyanDim, borderRadius: 10, borderWidth: 1, borderColor: DentalColors.cyanBorder }}>
            <Text style={{ fontSize: 11, color: DentalColors.cyan, fontWeight: "700", marginBottom: 4 }}>💡 EM BREVE</Text>
            <Text style={{ fontSize: 12, color: DentalColors.ink2, lineHeight: 18 }}>
              A importacao em lote esta em desenvolvimento. Por enquanto, cadastre os pacientes individualmente via "Novo paciente".
            </Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <Pressable onPress={onClose} style={s.btnSecondary}>
              <Text style={s.btnSecondaryText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  pageHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" },
  eyebrow: { fontSize: 11, color: DentalColors.ink3, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "600" },
  h1: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, color: DentalColors.ink, marginTop: 4 },
  sub: { fontSize: 13, color: DentalColors.ink2, marginTop: 4 },
  headActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  btnPrimary: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: DentalColors.cyan, borderWidth: 1, borderColor: DentalColors.cyan },
  btnPrimaryText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  btnSecondary: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: DentalColors.border },
  btnSecondaryText: { color: DentalColors.ink2, fontSize: 12, fontWeight: "600" },

  statsRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  stat: { flex: 1, minWidth: 140, padding: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: DentalColors.border, borderRadius: 12 },
  statLabel: { fontSize: 9, color: DentalColors.ink3, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  statValue: { fontSize: 22, fontWeight: "700", color: DentalColors.ink, marginTop: 4 },
  statDelta: { fontSize: 10, color: DentalColors.green, marginTop: 2, fontWeight: "600" },

  toolbar: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: DentalColors.border, borderRadius: 14, flexWrap: "wrap" },
  searchBox: { flex: 1, minWidth: 200, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: DentalColors.bg2, borderWidth: 1, borderColor: DentalColors.border, borderRadius: 10 },
  searchInput: { flex: 1, color: DentalColors.ink, fontSize: 13 } as any,
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: DentalColors.bg2, borderWidth: 1, borderColor: DentalColors.border },
  chipActive: { backgroundColor: DentalColors.cyanDim, borderColor: DentalColors.cyanBorder },
  chipText: { fontSize: 11, color: DentalColors.ink2, fontWeight: "600" },
  chipTextActive: { color: DentalColors.cyan },
  viewToggle: { flexDirection: "row", gap: 2, padding: 3, backgroundColor: DentalColors.bg2, borderRadius: 8, borderWidth: 1, borderColor: DentalColors.border },
  viewBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  viewBtnActive: { backgroundColor: DentalColors.cyan },
  viewBtnText: { fontSize: 11, color: DentalColors.ink3, fontWeight: "600" },
  viewBtnTextActive: { color: "#fff" },

  bulkBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, backgroundColor: DentalColors.cyanDim, borderWidth: 1, borderColor: DentalColors.cyanBorder, borderRadius: 14, gap: 10, flexWrap: "wrap" },
  bulkCount: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: DentalColors.cyan, borderRadius: 999 },
  bulkCountText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  bulkBtn: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: DentalColors.border },
  bulkBtnText: { fontSize: 11, color: DentalColors.ink2, fontWeight: "600" },
  bulkBtnDanger: { borderColor: "rgba(239,68,68,0.35)" },

  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, color: DentalColors.ink2, fontWeight: "600" },
  emptyHint: { fontSize: 12, color: DentalColors.ink3 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { flexBasis: 260, flexGrow: 1, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: DentalColors.border, borderRadius: 14, padding: 16, gap: 10, position: "relative" },
  cardSelected: { borderColor: DentalColors.cyan, backgroundColor: DentalColors.cyanGhost },
  cardCheck: { position: "absolute", top: 12, right: 12, width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: DentalColors.ink3, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", zIndex: 5 },
  cardCheckOn: { backgroundColor: DentalColors.cyan, borderColor: DentalColors.cyan },
  cardAvatar: { width: 52, height: 52, borderRadius: 26 },
  cardAvatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: DentalColors.cyan, alignItems: "center", justifyContent: "center" },
  cardAvatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  cardName: { fontSize: 14, fontWeight: "700", color: DentalColors.ink },
  cardMeta: { fontSize: 10, color: DentalColors.ink3, marginTop: 2 },
  cardTags: { flexDirection: "row", gap: 4, flexWrap: "wrap", marginTop: 4 },
  cardInfo: { borderTopWidth: 1, borderTopColor: DentalColors.border, paddingTop: 10, gap: 5 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  infoLbl: { fontSize: 11, color: DentalColors.ink3 },
  infoVal: { fontSize: 11, color: DentalColors.ink, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  nextAppt: { padding: 8, borderRadius: 8, backgroundColor: DentalColors.cyanGhost, borderLeftWidth: 3, borderLeftColor: DentalColors.cyan },
  nextApptText: { fontSize: 10, color: DentalColors.ink2 },

  // #14: badge de codigo no avatar
  patientCode: { position: "absolute", bottom: -4, left: -4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(6,182,212,0.20)", borderWidth: 1, borderColor: DentalColors.cyanBorder },
  patientCodeText: { fontSize: 9, fontWeight: "700", color: DentalColors.cyan, letterSpacing: 0.5 },

  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  tagText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },

  listHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, backgroundColor: DentalColors.bg2, borderRadius: 8 },
  listHeaderText: { fontSize: 9, color: DentalColors.ink3, letterSpacing: 1.2, fontWeight: "700", textTransform: "uppercase" },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: DentalColors.border, borderRadius: 10 },
  listRowSelected: { backgroundColor: DentalColors.cyanGhost, borderColor: DentalColors.cyan },
  listCellCheck: { width: 32, alignItems: "center", justifyContent: "center" },
  checkBox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: DentalColors.ink3, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
  checkBoxOn: { backgroundColor: DentalColors.cyan, borderColor: DentalColors.cyan },
  checkMark: { color: "#fff", fontSize: 11, fontWeight: "700" },
  listAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: DentalColors.cyan },
  listName: { fontSize: 13, fontWeight: "600", color: DentalColors.ink },
  listMeta: { fontSize: 10, color: DentalColors.ink3, marginTop: 2 },
  listText: { fontSize: 11, color: DentalColors.ink2 },
  // #14: codigo na lista
  listCode: { fontSize: 11, color: DentalColors.cyan, fontWeight: "700", fontVariant: ["tabular-nums"] as any },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { width: "100%", maxWidth: 520, backgroundColor: DentalColors.bg2, borderWidth: 1, borderColor: DentalColors.border, borderRadius: 16, padding: 24 },
  uploadZone: { borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.14)", borderRadius: 12, padding: 32, alignItems: "center", justifyContent: "center" },
});

export default PatientsList;
