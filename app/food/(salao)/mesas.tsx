import { useState, useMemo, ReactNode } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { FoodColors } from "@/constants/food-tokens";
import {
  useFoodTables, useFoodWaiterCalls, useFoodReservations,
  useCreateTableMutation, useUpdateTableMutation, useDeleteTableMutation,
  useCreateReservationMutation, useUpdateReservationMutation, useDeleteReservationMutation,
  type FoodTable, type FoodReservation,
} from "@/hooks/useFoodTables";
import { TableDrawer } from "@/components/food/TableDrawer";

// ============================================================
// Mesas — Fase 2 do MVP Food.
//
// 2 abas: Mesas / Reservas.
// Mesas: grid responsivo de cards de mesa com status (livre/ocupada/
// reservada), badge animada de chamada de garçom, polling 10s.
// Reservas: lista por data (default hoje), filtros por status,
// CRUD via modais inline.
// ============================================================

type Tab = "mesas" | "reservas";
type StatusFilter = "todas" | "free" | "occupied" | "reserved" | "with-call";

export default function MesasScreen() {
  const [tab, setTab] = useState<Tab>("mesas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [selectedTable, setSelectedTable] = useState<FoodTable | null>(null);
  const [editingTable, setEditingTable] = useState<FoodTable | null | "new">(null);
  const [editingReservation, setEditingReservation] = useState<FoodReservation | null | "new">(null);

  const today = new Date().toISOString().slice(0, 10);
  const [reservationDate, setReservationDate] = useState(today);

  const { data: tables, isLoading: tablesLoading } = useFoodTables();
  const { data: calls } = useFoodWaiterCalls();
  const { data: reservations } = useFoodReservations({ date: reservationDate });

  const callsByTable = useMemo(() => {
    const m = new Map<string, number>();
    calls?.forEach(c => m.set(c.table_id, (m.get(c.table_id) || 0) + 1));
    return m;
  }, [calls]);

  const tablesAll = tables || [];
  const tablesFiltered = useMemo(() => {
    if (statusFilter === "todas") return tablesAll;
    if (statusFilter === "with-call") return tablesAll.filter(t => callsByTable.has(t.id));
    return tablesAll.filter(t => t.status === statusFilter);
  }, [tablesAll, statusFilter, callsByTable]);

  // KPIs
  const occupied = tablesAll.filter(t => t.status === "occupied").length;
  const totalTables = tablesAll.length;

  if (tablesLoading) {
    return (
      <View style={{ padding: 40, alignItems: "center" }}>
        <ActivityIndicator color={FoodColors.red} />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: FoodColors.ink }}>Mesas</Text>
          <Text style={{ fontSize: 12, color: FoodColors.ink3, marginTop: 2 }}>
            {totalTables} mesas · {occupied} ocupadas · atualização a cada 10s
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", gap: 6, paddingVertical: 4 }}>
        {(["mesas", "reservas"] as Tab[]).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
              backgroundColor: tab === t ? FoodColors.red : FoodColors.surface,
              borderWidth: 1, borderColor: tab === t ? FoodColors.red : FoodColors.border,
            }}
          >
            <Text style={{
              color: tab === t ? "#fff" : FoodColors.ink2,
              fontWeight: "600", fontSize: 13, textTransform: "capitalize",
            }}>
              {t === "mesas" ? "Mesas (" + totalTables + ")" : "Reservas (" + (reservations?.length || 0) + ")"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* TAB MESAS */}
      {tab === "mesas" && (
        <View style={{ gap: 10 }}>
          {/* KPIs */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <KpiCard label="Ocupadas" value={occupied + "/" + totalTables} color={FoodColors.red} />
            <KpiCard label="Livres" value={tablesAll.filter(t => t.status === "free").length} color={FoodColors.ink3} />
            <KpiCard label="Reservadas" value={tablesAll.filter(t => t.status === "reserved").length} color={FoodColors.cyan} />
            <KpiCard label="Chamadas" value={calls?.length || 0} color={(calls?.length || 0) > 0 ? FoodColors.red : FoodColors.ink3} pulse={(calls?.length || 0) > 0} />
          </View>

          {/* Filtros */}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, flexDirection: "row" }}>
              <Chip label={"Todas (" + tablesAll.length + ")"} active={statusFilter==="todas"} onPress={() => setStatusFilter("todas")} />
              <Chip label="Livres" dot={FoodColors.ink3} active={statusFilter==="free"} onPress={() => setStatusFilter("free")} />
              <Chip label="Ocupadas" dot={FoodColors.red} active={statusFilter==="occupied"} onPress={() => setStatusFilter("occupied")} />
              <Chip label="Reservadas" dot={FoodColors.cyan} active={statusFilter==="reserved"} onPress={() => setStatusFilter("reserved")} />
              {(calls?.length || 0) > 0 && (
                <Chip label={"🔔 Com chamada"} active={statusFilter==="with-call"} onPress={() => setStatusFilter("with-call")} />
              )}
            </ScrollView>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setEditingTable("new")} style={{
              backgroundColor: FoodColors.red, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
            }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>+ Mesa</Text>
            </Pressable>
          </View>

          {/* Grid de mesas */}
          {tablesFiltered.length === 0 ? (
            <View style={{
              backgroundColor: FoodColors.surface, borderRadius: 10, padding: 30,
              alignItems: "center", borderWidth: 1, borderColor: FoodColors.border, borderStyle: "dashed",
            }}>
              <Text style={{ fontSize: 36 }}>🍽️</Text>
              <Text style={{ fontSize: 14, color: FoodColors.ink, fontWeight: "700", marginTop: 8 }}>
                {tablesAll.length === 0 ? "Sem mesas cadastradas" : "Nenhuma mesa neste filtro"}
              </Text>
              {tablesAll.length === 0 && (
                <Pressable onPress={() => setEditingTable("new")} style={{
                  marginTop: 12, backgroundColor: FoodColors.red,
                  paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
                }}>
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>+ Criar primeira mesa</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={{
              flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 4,
            }}>
              {tablesFiltered.map(table => (
                <MesaCard
                  key={table.id}
                  table={table}
                  hasCall={callsByTable.has(table.id)}
                  onPress={() => setSelectedTable(table)}
                  onEdit={() => setEditingTable(table)}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* TAB RESERVAS */}
      {tab === "reservas" && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Text style={{ fontSize: 12, color: FoodColors.ink3 }}>Data:</Text>
            <TextInput
              value={reservationDate} onChangeText={setReservationDate}
              placeholder="AAAA-MM-DD" placeholderTextColor={FoodColors.ink4}
              style={{
                backgroundColor: FoodColors.surface, color: FoodColors.ink,
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, fontSize: 12,
                borderWidth: 1, borderColor: FoodColors.border, minWidth: 130,
              }}
            />
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setEditingReservation("new")} style={{
              backgroundColor: FoodColors.red, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
            }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>+ Reserva</Text>
            </Pressable>
          </View>

          {!reservations || reservations.length === 0 ? (
            <View style={{
              backgroundColor: FoodColors.surface, borderRadius: 10, padding: 30,
              alignItems: "center", borderWidth: 1, borderColor: FoodColors.border, borderStyle: "dashed",
            }}>
              <Text style={{ fontSize: 36 }}>📆</Text>
              <Text style={{ fontSize: 14, color: FoodColors.ink, fontWeight: "700", marginTop: 8 }}>
                Nenhuma reserva em {reservationDate}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {reservations.map(r => (
                <ReservaCard key={r.id} r={r} onEdit={() => setEditingReservation(r)} />
              ))}
            </View>
          )}
        </View>
      )}

      {/* DRAWERS + MODAIS */}
      {selectedTable && (
        <TableDrawer table={selectedTable} onClose={() => setSelectedTable(null)} />
      )}
      {editingTable && (
        <MesaModal initial={editingTable === "new" ? null : editingTable} onClose={() => setEditingTable(null)} />
      )}
      {editingReservation && (
        <ReservaModal
          initial={editingReservation === "new" ? null : editingReservation}
          tables={tablesAll}
          onClose={() => setEditingReservation(null)}
        />
      )}
    </View>
  );
}

// ============================================================
// Subcomponents
// ============================================================

function MesaCard({ table, hasCall, onPress, onEdit }: { table: FoodTable; hasCall: boolean; onPress: () => void; onEdit: () => void }) {
  const isOccupied = table.status === "occupied";
  const isReserved = table.status === "reserved";
  const bgGrad =
    isOccupied ? "linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.04))" :
    isReserved ? "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(6,182,212,0.03))" :
    undefined;
  const borderC = isOccupied ? "rgba(239,68,68,0.5)" : isReserved ? "rgba(6,182,212,0.4)" : FoodColors.border;

  // duration
  const duration = table.opened_at
    ? Math.round((Date.now() - new Date(table.opened_at).getTime()) / 60000)
    : null;

  return (
    <Pressable onPress={onPress} style={[
      {
        width: 180, minHeight: 130, padding: 14, borderRadius: 12,
        borderWidth: 2, borderColor: borderC,
        backgroundColor: isOccupied ? "rgba(239,68,68,0.06)" :
                         isReserved ? "rgba(6,182,212,0.04)" :
                         FoodColors.surface,
        position: "relative",
      },
      Platform.OS === "web" ? ({ background: bgGrad, transition: "transform 0.15s" } as any) : {},
    ]}>
      {hasCall && (
        <View style={[{
          position: "absolute", top: 8, right: 8,
          backgroundColor: FoodColors.red,
          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
          flexDirection: "row", alignItems: "center", gap: 4,
        }, Platform.OS === "web" ? ({ animation: "pulse 1.6s infinite" } as any) : {}]}>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>🔔 Garçom</Text>
        </View>
      )}
      <Pressable
        onPress={(e: any) => { e?.stopPropagation?.(); onEdit(); }}
        style={{
          position: "absolute", top: 8, right: hasCall ? 76 : 8,
          width: 22, height: 22, borderRadius: 6,
          backgroundColor: "rgba(255,255,255,0.06)",
          alignItems: "center", justifyContent: "center",
          opacity: 0.5,
        }}
      >
        <Icon name="edit" size={10} color={FoodColors.ink3} />
      </Pressable>

      <View style={{ flex: 1, justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: "800", color: FoodColors.ink, lineHeight: 34 }}>
            {table.number.padStart(2, "0")}
          </Text>
          <Text style={{ fontSize: 11, color: FoodColors.ink3, marginTop: 2 }}>
            {table.seats ? table.seats + " lugares" : "—"}
          </Text>
        </View>
        <View>
          <Text style={{
            fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5,
            color: isOccupied ? FoodColors.red : isReserved ? FoodColors.cyan : FoodColors.ink3,
          }}>
            {isOccupied ? "Ocupada" : isReserved ? "Reservada" : "Livre"}
          </Text>
          {duration != null && (
            <Text style={{ fontSize: 10, color: FoodColors.ink3, marginTop: 2 }}>{duration}min</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ReservaCard({ r, onEdit }: { r: FoodReservation; onEdit: () => void }) {
  const dt = new Date(r.reservation_at);
  const time = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const STATUS_LABEL: Record<string, string> = {
    pending: "Pendente",
    confirmed: "Confirmada",
    checked_in: "Cliente presente",
    cancelled: "Cancelada",
    no_show: "Não compareceu",
  };
  const STATUS_COLOR: Record<string, string> = {
    pending: FoodColors.amber,
    confirmed: FoodColors.cyan,
    checked_in: FoodColors.green,
    cancelled: FoodColors.ink4,
    no_show: FoodColors.red,
  };
  const color = STATUS_COLOR[r.status] || FoodColors.ink3;
  return (
    <Pressable onPress={onEdit} style={{
      backgroundColor: FoodColors.surface, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: FoodColors.border,
      flexDirection: "row", alignItems: "center", gap: 12,
      opacity: r.status === "cancelled" || r.status === "no_show" ? 0.5 : 1,
    }}>
      <View style={{ alignItems: "center", minWidth: 56 }}>
        <Text style={{ fontSize: 18, color: FoodColors.ink, fontWeight: "800" }}>{time}</Text>
        <Text style={{ fontSize: 9, color: FoodColors.ink3, textTransform: "uppercase" }}>{r.duration_min}min</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: FoodColors.ink, fontWeight: "700" }}>{r.customer_name}</Text>
        <Text style={{ fontSize: 11, color: FoodColors.ink3, marginTop: 2 }}>
          {r.party_size} {r.party_size === 1 ? "pessoa" : "pessoas"}
          {r.table_number ? " · Mesa " + r.table_number : " · sem mesa"}
          {r.customer_phone ? " · " + r.customer_phone : ""}
        </Text>
      </View>
      <View style={{
        backgroundColor: color + "22", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
      }}>
        <Text style={{ fontSize: 9, color, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {STATUS_LABEL[r.status] || r.status}
        </Text>
      </View>
    </Pressable>
  );
}

function KpiCard({ label, value, color, pulse }: { label: string; value: string | number; color: string; pulse?: boolean }) {
  return (
    <View style={[
      {
        flex: 1, minWidth: 120,
        backgroundColor: FoodColors.surface, borderRadius: 10, padding: 12,
        borderWidth: 1, borderColor: FoodColors.border,
      },
      pulse && Platform.OS === "web" ? ({ animation: "pulse 1.6s infinite" } as any) : {},
    ]}>
      <Text style={{ fontSize: 10, color: FoodColors.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: "800", color, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function Chip({ label, active, dot, onPress }: { label: string; active: boolean; dot?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
      backgroundColor: active ? FoodColors.redDim : FoodColors.surface,
      borderWidth: 1, borderColor: active ? FoodColors.red : FoodColors.border,
      flexDirection: "row", alignItems: "center", gap: 6,
    }}>
      {dot && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />}
      <Text style={{ color: active ? FoodColors.red : FoodColors.ink3, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

// ============================================================
// Modais inline
// ============================================================

function MesaModal({ initial, onClose }: { initial: FoodTable | null; onClose: () => void }) {
  const createM = useCreateTableMutation();
  const updateM = useUpdateTableMutation();
  const deleteM = useDeleteTableMutation();

  const [number, setNumber] = useState(initial?.number || "");
  const [seats, setSeats] = useState(initial?.seats != null ? String(initial.seats) : "");

  const handleSave = async () => {
    if (!number.trim()) return;
    const body = { number: number.trim(), seats: seats ? parseInt(seats, 10) : null };
    if (initial) await updateM.mutateAsync({ id: initial.id, ...body });
    else         await createM.mutateAsync(body);
    onClose();
  };
  const handleDelete = async () => {
    if (!initial) return;
    if (Platform.OS === "web" && !window.confirm("Remover mesa " + initial.number + "?")) return;
    try {
      await deleteM.mutateAsync(initial.id);
      onClose();
    } catch (e: any) {
      if (Platform.OS === "web") window.alert(e?.message || "Erro ao remover mesa");
    }
  };
  const disabled = !number.trim() || createM.isPending || updateM.isPending;

  return (
    <CenteredModal title={initial ? "Editar mesa" : "Nova mesa"} onClose={onClose}>
      <Field label="Número *">
        <TextInput value={number} onChangeText={setNumber} placeholder="1" placeholderTextColor={FoodColors.ink4} style={fieldStyle} />
      </Field>
      <Field label="Lugares">
        <TextInput value={seats} onChangeText={setSeats} placeholder="4" placeholderTextColor={FoodColors.ink4} keyboardType="number-pad" style={fieldStyle} />
      </Field>

      <ModalActions>
        {initial && (
          <Pressable onPress={handleDelete} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: FoodColors.red }}>
            <Text style={{ color: FoodColors.red, fontSize: 13, fontWeight: "600" }}>Remover</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onClose} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: FoodColors.surface2 }}>
          <Text style={{ color: FoodColors.ink2, fontSize: 13, fontWeight: "600" }}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={disabled} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: FoodColors.red, opacity: disabled ? 0.4 : 1 }}>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{initial ? "Salvar" : "Criar"}</Text>
        </Pressable>
      </ModalActions>
    </CenteredModal>
  );
}

function ReservaModal({ initial, tables, onClose }: { initial: FoodReservation | null; tables: FoodTable[]; onClose: () => void }) {
  const createM = useCreateReservationMutation();
  const updateM = useUpdateReservationMutation();
  const deleteM = useDeleteReservationMutation();

  const initDt = initial ? new Date(initial.reservation_at) : new Date();
  const initDate = initDt.toISOString().slice(0, 10);
  const initTime = initDt.toTimeString().slice(0, 5);

  const [customerName, setCustomerName] = useState(initial?.customer_name || "");
  const [customerPhone, setCustomerPhone] = useState(initial?.customer_phone || "");
  const [partySize, setPartySize] = useState(String(initial?.party_size || 2));
  const [tableId, setTableId] = useState<string | null>(initial?.table_id || null);
  const [dateStr, setDateStr] = useState(initDate);
  const [timeStr, setTimeStr] = useState(initTime);
  const [duration, setDuration] = useState(String(initial?.duration_min || 90));
  const [notes, setNotes] = useState(initial?.notes || "");
  const [status, setStatus] = useState<FoodReservation["status"]>(initial?.status || "confirmed");

  const handleSave = async () => {
    if (!customerName.trim() || !dateStr || !timeStr) return;
    const body = {
      table_id: tableId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || null,
      party_size: parseInt(partySize, 10) || 2,
      reservation_at: new Date(dateStr + "T" + timeStr).toISOString(),
      duration_min: parseInt(duration, 10) || 90,
      notes: notes.trim() || null,
      status,
    };
    if (initial) await updateM.mutateAsync({ id: initial.id, ...body });
    else         await createM.mutateAsync(body);
    onClose();
  };
  const handleDelete = async () => {
    if (!initial) return;
    if (Platform.OS === "web" && !window.confirm("Cancelar reserva de " + initial.customer_name + "?")) return;
    await deleteM.mutateAsync(initial.id);
    onClose();
  };

  return (
    <CenteredModal title={initial ? "Editar reserva" : "Nova reserva"} onClose={onClose}>
      <Field label="Nome do cliente *">
        <TextInput value={customerName} onChangeText={setCustomerName} placeholder="Ex: João Silva" placeholderTextColor={FoodColors.ink4} style={fieldStyle} />
      </Field>
      <Field label="Telefone">
        <TextInput value={customerPhone} onChangeText={setCustomerPhone} placeholder="(11) 99999-9999" placeholderTextColor={FoodColors.ink4} keyboardType="phone-pad" style={fieldStyle} />
      </Field>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Field label="Data *" flex={1}>
          <TextInput value={dateStr} onChangeText={setDateStr} placeholder="AAAA-MM-DD" placeholderTextColor={FoodColors.ink4} style={fieldStyle} />
        </Field>
        <Field label="Hora *" flex={1}>
          <TextInput value={timeStr} onChangeText={setTimeStr} placeholder="HH:MM" placeholderTextColor={FoodColors.ink4} style={fieldStyle} />
        </Field>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Field label="Pessoas" flex={1}>
          <TextInput value={partySize} onChangeText={setPartySize} placeholder="2" placeholderTextColor={FoodColors.ink4} keyboardType="number-pad" style={fieldStyle} />
        </Field>
        <Field label="Duração (min)" flex={1}>
          <TextInput value={duration} onChangeText={setDuration} placeholder="90" placeholderTextColor={FoodColors.ink4} keyboardType="number-pad" style={fieldStyle} />
        </Field>
      </View>
      <Field label="Mesa (opcional)">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <Chip label="Sem mesa" active={!tableId} onPress={() => setTableId(null)} />
          {tables.map(t => <Chip key={t.id} label={"Mesa " + t.number} active={tableId === t.id} onPress={() => setTableId(t.id)} />)}
        </ScrollView>
      </Field>
      {initial && (
        <Field label="Status">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {(["confirmed","pending","checked_in","cancelled","no_show"] as FoodReservation["status"][]).map(s => (
              <Chip key={s} label={s} active={status === s} onPress={() => setStatus(s)} />
            ))}
          </ScrollView>
        </Field>
      )}
      <Field label="Observações">
        <TextInput value={notes} onChangeText={setNotes} placeholder="Aniversário, alergia, etc" placeholderTextColor={FoodColors.ink4} multiline style={[fieldStyle, { minHeight: 50 }]} />
      </Field>

      <ModalActions>
        {initial && (
          <Pressable onPress={handleDelete} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: FoodColors.red }}>
            <Text style={{ color: FoodColors.red, fontSize: 13, fontWeight: "600" }}>Cancelar reserva</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onClose} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: FoodColors.surface2 }}>
          <Text style={{ color: FoodColors.ink2, fontSize: 13, fontWeight: "600" }}>Fechar</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={!customerName.trim()} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: FoodColors.red, opacity: !customerName.trim() ? 0.4 : 1 }}>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{initial ? "Salvar" : "Criar"}</Text>
        </Pressable>
      </ModalActions>
    </CenteredModal>
  );
}

function Field({ label, children, flex }: { label: string; children: ReactNode; flex?: number }) {
  return (
    <View style={{ gap: 4, flex }}>
      <Text style={{ fontSize: 11, color: FoodColors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
      {children}
    </View>
  );
}

function CenteredModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 }}>
        <View style={{ backgroundColor: FoodColors.surface, borderRadius: 14, padding: 20, width: "100%", maxWidth: 500, gap: 12, borderWidth: 1, borderColor: FoodColors.border, maxHeight: "90%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ fontSize: 16, color: FoodColors.ink, fontWeight: "800" }}>{title}</Text>
            <Pressable onPress={onClose} style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: FoodColors.surface2 }}>
              <Icon name="x" size={13} color={FoodColors.ink3} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ModalActions({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: FoodColors.border, flexWrap: "wrap" }}>
      {children}
    </View>
  );
}

const fieldStyle: any = {
  backgroundColor: FoodColors.bg,
  color: FoodColors.ink,
  padding: 10,
  borderRadius: 8,
  fontSize: 13,
  borderWidth: 1,
  borderColor: FoodColors.border,
};
