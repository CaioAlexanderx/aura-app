import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Switch, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dentalConfigApi, type DentalPractitioner, type DentalChairSettings } from "@/services/dentalConfigApi";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// ============================================================
// AURA. — DentalSettings tab (D-FIX #1 + #6)
//
// Card 1: Cadeiras (toggle ativo + dentista alocado por cadeira)
//         - Plano negocio: 2 cadeiras
//         - Plano expansao: 4 cadeiras
//         - 1 sempre ativa minimo
//
// Card 2: Dentistas (CRUD com nome, CRO, especialidade, cor)
//         - Owner cadastrado automaticamente no primeiro acesso
//         - Owner nao pode ser deletado
// ============================================================

const PRESET_COLORS = [
  '#06B6D4', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#6366F1', '#14B8A6',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={s.colorRow}>
      {PRESET_COLORS.map(c => (
        <Pressable key={c} onPress={() => onChange(c)}
          style={[s.colorSwatch, { backgroundColor: c }, value === c && { borderWidth: 3, borderColor: '#fff' }]} />
      ))}
    </View>
  );
}

// ─── Form de adicao/edicao de dentista ───
function PractitionerForm({
  initial, onSave, onCancel, saving,
}: {
  initial?: Partial<DentalPractitioner>;
  onSave: (data: { name: string; cro?: string; specialty?: string; color: string; email?: string; phone?: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [cro, setCro] = useState(initial?.cro || '');
  const [specialty, setSpecialty] = useState(initial?.specialty || '');
  const [color, setColor] = useState(initial?.color || '#06B6D4');
  const [email, setEmail] = useState(initial?.email || '');
  const [phone, setPhone] = useState(initial?.phone || '');

  function handleSubmit() {
    if (!name.trim()) { toast.error('Nome eh obrigatorio'); return; }
    onSave({
      name: name.trim(),
      cro: cro.trim() || undefined,
      specialty: specialty.trim() || undefined,
      color,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    });
  }

  return (
    <View style={s.form}>
      <Text style={s.formTitle}>{initial?.id ? 'Editar dentista' : 'Adicionar dentista'}</Text>

      <View style={s.formField}>
        <Text style={s.label}>Nome <Text style={{ color: Colors.red }}>*</Text></Text>
        <TextInput style={s.input} value={name} onChangeText={setName}
          placeholder="Dr. Joao Silva" placeholderTextColor={Colors.ink3} autoFocus />
      </View>

      <View style={s.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>CRO</Text>
          <TextInput style={s.input} value={cro} onChangeText={setCro}
            placeholder="CRO-SP 12345" placeholderTextColor={Colors.ink3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Especialidade</Text>
          <TextInput style={s.input} value={specialty} onChangeText={setSpecialty}
            placeholder="Ortodontia" placeholderTextColor={Colors.ink3} />
        </View>
      </View>

      <View style={s.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail}
            placeholder="dr@clinica.com" placeholderTextColor={Colors.ink3} keyboardType="email-address" autoCapitalize="none" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Telefone</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone}
            placeholder="(11) 99999-9999" placeholderTextColor={Colors.ink3} keyboardType="phone-pad" />
        </View>
      </View>

      <View style={s.formField}>
        <Text style={s.label}>Cor (identifica na agenda)</Text>
        <ColorPicker value={color} onChange={setColor} />
      </View>

      <View style={s.formActions}>
        <Pressable onPress={onCancel} disabled={saving} style={s.cancelBtn}>
          <Text style={s.cancelText}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={handleSubmit} disabled={saving || !name.trim()}
          style={[s.saveBtn, (saving || !name.trim()) && { opacity: 0.5 }]}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : (
            <Text style={s.saveText}>{initial?.id ? 'Salvar' : 'Adicionar'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Componente principal ───
export function DentalSettings() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DentalPractitioner | null>(null);

  // Settings query
  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['dental-settings', company?.id],
    queryFn: () => dentalConfigApi.getSettings(company!.id),
    enabled: !!company?.id,
    staleTime: 30000,
  });

  // Practitioners query
  const { data: practitionersData, isLoading: loadingPractitioners } = useQuery({
    queryKey: ['dental-practitioners', company?.id],
    queryFn: () => dentalConfigApi.listPractitioners(company!.id),
    enabled: !!company?.id,
    staleTime: 30000,
  });

  const settings = settingsData?.settings;
  const maxChairs = settingsData?.max_chairs || 1;
  const practitioners = practitionersData?.practitioners || [];
  const editingPractitioner = practitioners.find(p => p.id === editingId);

  // Save settings mutation
  const saveSettingsMut = useMutation({
    mutationFn: (newSettings: DentalChairSettings) => dentalConfigApi.saveSettings(company!.id, newSettings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dental-settings'] });
      qc.invalidateQueries({ queryKey: ['dental-agenda'] });
      toast.success('Configuracoes salvas');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao salvar'),
  });

  // Practitioner mutations
  const createMut = useMutation({
    mutationFn: (body: any) => dentalConfigApi.createPractitioner(company!.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dental-practitioners'] });
      toast.success('Dentista cadastrado');
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao cadastrar'),
  });

  const updateMut = useMutation({
    mutationFn: (p: { id: string; body: any }) => dentalConfigApi.updatePractitioner(company!.id, p.id, p.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dental-practitioners'] });
      toast.success('Dentista atualizado');
      setShowForm(false);
      setEditingId(null);
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao atualizar'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => dentalConfigApi.deletePractitioner(company!.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dental-practitioners'] });
      qc.invalidateQueries({ queryKey: ['dental-settings'] });
      toast.success('Dentista removido');
      setConfirmDelete(null);
    },
    onError: (err: any) => toast.error(err?.data?.error || err?.message || 'Erro ao remover'),
  });

  // Handlers
  function toggleChair(idx: number) {
    if (!settings) return;
    const chairs_active = [...settings.chairs_active];
    chairs_active[idx] = !chairs_active[idx];
    if (!chairs_active.some(Boolean)) {
      toast.error('Pelo menos 1 cadeira deve estar ativa');
      return;
    }
    const chair_practitioner_ids = [...settings.chair_practitioner_ids];
    if (!chairs_active[idx]) chair_practitioner_ids[idx] = null;  // limpa alocacao se desativou
    saveSettingsMut.mutate({ chairs_active, chair_practitioner_ids });
  }

  function assignPractitioner(chairIdx: number, practitionerId: string | null) {
    if (!settings) return;
    const chair_practitioner_ids = [...settings.chair_practitioner_ids];
    chair_practitioner_ids[chairIdx] = practitionerId;
    saveSettingsMut.mutate({ chairs_active: settings.chairs_active, chair_practitioner_ids });
  }

  function handleSavePractitioner(data: any) {
    if (editingId) updateMut.mutate({ id: editingId, body: data });
    else createMut.mutate(data);
  }

  function startEdit(p: DentalPractitioner) {
    setEditingId(p.id);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
  }

  if (loadingSettings || loadingPractitioners) {
    return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={Colors.violet3} /></View>;
  }

  return (
    <View style={{ gap: 20 }}>
      {/* Card 1: Cadeiras */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Cadeiras</Text>
            <Text style={s.cardSub}>
              {maxChairs} cadeira{maxChairs > 1 ? 's' : ''} disponivel{maxChairs > 1 ? 'is' : ''} no seu plano. Desative as nao usadas pra limpar a interface.
            </Text>
          </View>
        </View>

        {settings && settings.chairs_active.map((isActive, idx) => {
          const allocatedId = settings.chair_practitioner_ids[idx];
          const allocated = practitioners.find(p => p.id === allocatedId);
          const activePractitioners = practitioners.filter(p => p.is_active);

          return (
            <View key={idx} style={s.chairRow}>
              <View style={s.chairHeader}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {allocated && <View style={[s.chairDot, { backgroundColor: allocated.color }]} />}
                  {!allocated && <View style={[s.chairDot, { backgroundColor: isActive ? '#06B6D4' : Colors.ink3 }]} />}
                  <Text style={[s.chairLabel, !isActive && { color: Colors.ink3 }]}>Cadeira {idx + 1}</Text>
                  {!isActive && <Text style={s.chairInactive}>(desativada)</Text>}
                </View>
                <Switch
                  value={isActive}
                  onValueChange={() => toggleChair(idx)}
                  disabled={saveSettingsMut.isPending}
                  trackColor={{ false: Colors.bg4, true: Colors.violetD }}
                  thumbColor={isActive ? Colors.violet3 : Colors.ink3}
                />
              </View>

              {isActive && (
                <View style={s.chairAssign}>
                  <Text style={s.chairAssignLabel}>Dentista alocado:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingRight: 12 }}>
                    <Pressable
                      onPress={() => assignPractitioner(idx, null)}
                      style={[s.assignChip, !allocatedId && s.assignChipActive]}>
                      <Text style={[s.assignChipText, !allocatedId && { color: Colors.violet3 }]}>Sem alocacao</Text>
                    </Pressable>
                    {activePractitioners.map(p => {
                      const selected = allocatedId === p.id;
                      return (
                        <Pressable key={p.id}
                          onPress={() => assignPractitioner(idx, p.id)}
                          style={[s.assignChip, selected && s.assignChipActive, selected && { borderColor: p.color }]}>
                          <View style={[s.assignChipDot, { backgroundColor: p.color }]} />
                          <Text style={[s.assignChipText, selected && { color: p.color, fontWeight: '700' }]}>
                            {p.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Card 2: Dentistas */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Dentistas ({practitioners.length})</Text>
            <Text style={s.cardSub}>
              Cadastre todos os dentistas que atendem na clinica. Cada um pode ser alocado em uma cadeira.
            </Text>
          </View>
          {!showForm && (
            <Pressable onPress={() => { setEditingId(null); setShowForm(true); }} style={s.addBtn}>
              <Icon name="plus" size={12} color="#fff" />
              <Text style={s.addBtnText}>Adicionar</Text>
            </Pressable>
          )}
        </View>

        {showForm && (
          <PractitionerForm
            initial={editingPractitioner}
            onSave={handleSavePractitioner}
            onCancel={cancelForm}
            saving={createMut.isPending || updateMut.isPending}
          />
        )}

        <View style={{ gap: 6, marginTop: showForm ? 12 : 0 }}>
          {practitioners.map(p => (
            <View key={p.id} style={[s.practRow, !p.is_active && { opacity: 0.5 }]}>
              <View style={[s.practDot, { backgroundColor: p.color }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.practName}>{p.name}</Text>
                  {p.is_owner && <View style={s.ownerBadge}><Text style={s.ownerBadgeText}>RESPONSAVEL</Text></View>}
                </View>
                <Text style={s.practMeta}>
                  {p.cro || 'Sem CRO'}{p.specialty ? ' \u00b7 ' + p.specialty : ''}
                </Text>
              </View>
              <Pressable onPress={() => startEdit(p)} style={s.iconBtn} hitSlop={8}>
                <Icon name="edit" size={13} color={Colors.ink3} />
              </Pressable>
              {!p.is_owner && (
                <Pressable onPress={() => setConfirmDelete(p)} style={s.iconBtn} hitSlop={8}>
                  <Icon name="trash" size={13} color={Colors.red} />
                </Pressable>
              )}
            </View>
          ))}
          {practitioners.length === 0 && (
            <Text style={s.emptyText}>Nenhum dentista cadastrado.</Text>
          )}
        </View>
      </View>

      <ConfirmDialog
        visible={!!confirmDelete}
        title="Excluir dentista?"
        message={`${confirmDelete?.name} sera removido. Agendamentos vinculados ficarao sem dentista.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.ink },
  cardSub: { fontSize: 11, color: Colors.ink3, marginTop: 3, lineHeight: 15 },

  // Cadeiras
  chairRow: { backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  chairHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chairDot: { width: 10, height: 10, borderRadius: 5 },
  chairLabel: { fontSize: 13, fontWeight: '700', color: Colors.ink },
  chairInactive: { fontSize: 10, color: Colors.ink3, fontStyle: 'italic' as any },
  chairAssign: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  chairAssignLabel: { fontSize: 10, color: Colors.ink3, fontWeight: '700', textTransform: 'uppercase' as any, letterSpacing: 0.4, marginBottom: 6 },
  assignChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  assignChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  assignChipDot: { width: 8, height: 8, borderRadius: 4 },
  assignChipText: { fontSize: 11, color: Colors.ink, fontWeight: '500' },

  // Adicionar btn
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  // Form
  form: { backgroundColor: Colors.bg4, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.border2, marginBottom: 12 },
  formTitle: { fontSize: 13, fontWeight: '700', color: Colors.ink, marginBottom: 12 },
  formField: { marginBottom: 10 },
  formRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  label: { fontSize: 10, color: Colors.ink3, fontWeight: '700', textTransform: 'uppercase' as any, letterSpacing: 0.4, marginBottom: 4 },
  input: { backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 12, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  cancelBtn: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 11, color: Colors.ink3, fontWeight: '500' },
  saveBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, backgroundColor: Colors.violet, minWidth: 100, alignItems: 'center' },
  saveText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  // Practitioner list
  practRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bg4, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border },
  practDot: { width: 10, height: 10, borderRadius: 5 },
  practName: { fontSize: 13, fontWeight: '600', color: Colors.ink },
  practMeta: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  ownerBadge: { backgroundColor: Colors.violetD, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: Colors.border2 },
  ownerBadgeText: { fontSize: 7, color: Colors.violet3, fontWeight: '800', letterSpacing: 0.4 },
  iconBtn: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: 'center', paddingVertical: 16, fontStyle: 'italic' as any },
});

export default DentalSettings;
