import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform, Switch } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";
import { maskPhone } from "@/utils/masks";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: { id: string; name: string; phone: string }) => void;
};

/**
 * P0 #7: Quick customer registration modal for PDV
 * Fields: Nome*, Data nascimento*, Telefone*, Instagram (Nos segue? Sim/Nao)
 * Renders as a modal overlay that blurs the background
 */
export function QuickCustomerModal({ visible, onClose, onCustomerCreated }: Props) {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [followsUs, setFollowsUs] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!visible) return null;

  function maskDate(v: string) {
    const nums = v.replace(/\D/g, '').slice(0, 8);
    if (nums.length <= 2) return nums;
    if (nums.length <= 4) return nums.slice(0, 2) + '/' + nums.slice(2);
    return nums.slice(0, 2) + '/' + nums.slice(2, 4) + '/' + nums.slice(4);
  }

  const nameValid = name.trim().length >= 2;
  const phoneValid = phone.replace(/\D/g, '').length >= 10;
  const dateValid = birthDate.replace(/\D/g, '').length === 8;
  const canSave = nameValid && phoneValid && dateValid;

  async function handleSave() {
    if (!canSave || !company?.id) { toast.error('Preencha os campos obrigatorios'); return; }
    setSaving(true);
    try {
      const nums = birthDate.replace(/\D/g, '');
      const isoDate = `${nums.slice(4, 8)}-${nums.slice(2, 4)}-${nums.slice(0, 2)}`;
      const res = await companiesApi.createCustomer(company.id, {
        name: name.trim(),
        phone: phone.replace(/\D/g, ''),
        birth_date: isoDate,
        instagram: instagram.trim() ? instagram.trim().replace('@', '') : null,
        follows_instagram: followsUs,
        source: 'pdv',
      });
      toast.success(`${name.trim()} cadastrado!`);
      qc.invalidateQueries({ queryKey: ['customers', company.id] });
      onCustomerCreated({ id: res.id, name: res.name || name.trim(), phone: res.phone || phone });
      // Reset form
      setName(''); setBirthDate(''); setPhone(''); setInstagram(''); setFollowsUs(false);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao cadastrar cliente');
    } finally { setSaving(false); }
  }

  const overlay = (
    <View style={s.overlay}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.modal}>
        <View style={s.header}>
          <Text style={s.title}>Cadastro rapido de cliente</Text>
          <Pressable onPress={onClose} style={s.closeBtn}><Icon name="x" size={16} color={Colors.ink3} /></Pressable>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Nome completo *</Text>
          <TextInput style={[s.input, nameValid && s.inputValid]} value={name} onChangeText={setName}
            placeholder="Nome do cliente" placeholderTextColor={Colors.ink3} autoFocus />
        </View>

        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Data de nascimento *</Text>
            <TextInput style={[s.input, dateValid && s.inputValid]} value={birthDate}
              onChangeText={(v) => setBirthDate(maskDate(v))}
              placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Telefone *</Text>
            <TextInput style={[s.input, phoneValid && s.inputValid]} value={phone}
              onChangeText={(v) => setPhone(maskPhone(v))}
              placeholder="(12) 99999-0000" placeholderTextColor={Colors.ink3} keyboardType="phone-pad" maxLength={15} />
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Instagram</Text>
          <TextInput style={s.input} value={instagram} onChangeText={setInstagram}
            placeholder="@perfil" placeholderTextColor={Colors.ink3} autoCapitalize="none" />
        </View>

        <View style={s.followRow}>
          <Text style={s.followLabel}>Nos segue no Instagram?</Text>
          <Switch value={followsUs} onValueChange={setFollowsUs}
            trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
        </View>

        <View style={s.actions}>
          <Pressable onPress={onClose} style={s.cancelBtn}><Text style={s.cancelText}>Cancelar</Text></Pressable>
          <Pressable onPress={handleSave} disabled={saving || !canSave}
            style={[s.saveBtn, (!canSave || saving) && { opacity: 0.5 }]}>
            <Text style={s.saveText}>{saving ? 'Salvando...' : 'Cadastrar'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  // Web: use div with backdrop-filter for blur effect
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        background: 'rgba(0,0,0,0.5)',
      } as any} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ width: '100%', maxWidth: 440, padding: '0 16px' } as any}>
          {overlay}
        </div>
      </div>
    );
  }

  return overlay;
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2, width: '100%', maxWidth: 440, zIndex: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.ink },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: 14 },
  row2: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.ink },
  inputValid: { borderColor: Colors.green + '66' },
  followRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  followLabel: { fontSize: 13, color: Colors.ink, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 13, color: Colors.ink3, fontWeight: '500' },
  saveBtn: { backgroundColor: Colors.violet, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  saveText: { fontSize: 13, color: '#fff', fontWeight: '700' },
});

export default QuickCustomerModal;
