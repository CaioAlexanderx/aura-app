import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useMembers } from "@/hooks/useMembers";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const ROLE_OPTIONS = ['Colaborador', 'Gerente', 'Atendente', 'Caixa', 'Analista'];

export function MembersSection() {
  const { members, active, pending, monthlyCost, isLoading, inviteMember, removeMember } = useMembers();
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Colaborador');
  const [inviting, setInviting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function handleInvite() {
    if (!email.includes('@')) return;
    setInviting(true);
    try { await inviteMember({ email: email.trim().toLowerCase(), role_label: role }); setShowInvite(false); setEmail(''); }
    catch {} finally { setInviting(false); }
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Equipe</Text>
          <Text style={s.subtitle}>{active} ativo(s){pending > 0 ? ` / ${pending} pendente(s)` : ''}{monthlyCost > 0 ? ` / +R$${monthlyCost}/mes` : ''}</Text>
        </View>
        <Pressable onPress={() => setShowInvite(!showInvite)} style={s.inviteBtn}>
          <Icon name="user_plus" size={14} color="#fff" />
          <Text style={s.inviteBtnText}>Convidar</Text>
        </Pressable>
      </View>

      {showInvite && (
        <View style={s.inviteForm}>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="email@exemplo.com" placeholderTextColor={Colors.ink3} autoCapitalize="none" keyboardType="email-address" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 4, marginVertical: 8 }}>
            {ROLE_OPTIONS.map(r => (
              <Pressable key={r} onPress={() => setRole(r)} style={[s.roleChip, role === r && s.roleChipActive]}>
                <Text style={[s.roleChipText, role === r && { color: Colors.violet3 }]}>{r}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={handleInvite} disabled={inviting || !email.includes('@')} style={[s.sendBtn, (inviting || !email.includes('@')) && { opacity: 0.5 }]}>
            <Text style={s.sendBtnText}>{inviting ? 'Enviando...' : 'Enviar convite'}</Text>
          </Pressable>
        </View>
      )}

      <View style={s.list}>
        {members.map(m => (
          <View key={m.id} style={s.memberRow}>
            <View style={s.avatar}><Text style={s.avatarText}>{(m.name || m.email || '?').charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.memberName}>{m.name || m.email}</Text>
              <Text style={s.memberMeta}>{m.role_label || 'Membro'} · {m.status === 'active' ? 'Ativo' : m.status === 'pending' ? 'Pendente' : 'Suspenso'}</Text>
            </View>
            {m.role_label !== 'owner' && m.status !== 'suspended' && (
              <Pressable onPress={() => setDeleteTarget(m.id)} style={s.removeBtn}><Icon name="x" size={12} color={Colors.red} /></Pressable>
            )}
          </View>
        ))}
        {members.length === 0 && !isLoading && (
          <View style={s.empty}><Text style={s.emptyText}>Apenas voce por aqui. Convide sua equipe!</Text></View>
        )}
      </View>

      <View style={s.billingNote}><Text style={s.billingText}>O titular nao e cobrado. Cada membro adicional: R$19/mes.</Text></View>

      <ConfirmDialog visible={!!deleteTarget} title="Suspender membro?" message="O membro perdera acesso a empresa." confirmLabel="Suspender" destructive
        onConfirm={() => { if (deleteTarget) { removeMember(deleteTarget); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.ink },
  subtitle: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  inviteBtnText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  inviteForm: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  input: { backgroundColor: Colors.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  roleChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  roleChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  roleChipText: { fontSize: 11, color: Colors.ink3, fontWeight: '500' },
  sendBtn: { backgroundColor: Colors.violet, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  sendBtnText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  list: { gap: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.violet, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  memberName: { fontSize: 13, fontWeight: '600', color: Colors.ink },
  memberMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  removeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.redD, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: 12, color: Colors.ink3 },
  billingNote: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  billingText: { fontSize: 10, color: Colors.ink3, fontStyle: 'italic', textAlign: 'center' },
});

export default MembersSection;
