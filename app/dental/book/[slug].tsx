// ============================================================
// AURA. — Pagina publica de agendamento (W1-03)
//
// URL: app.getaura.com.br/dental/book/:slug
// (e tambem getaura.com.br/dental/book/:slug se SPA estiver
// servida na raiz — mas hoje fica em app.getaura.com.br)
//
// Acessivel SEM login. AuthGuard ja isenta segments[0]==='dental'.
//
// Fluxo:
// 1. Le config publica via GET /dental/book/:slug
// 2. Mostra calendario simples (proximos N dias respeitando
//    available_days e max_advance_days)
// 3. Ao clicar num dia, mostra slots disponiveis (start_hour ate
//    end_hour em passos de slot_duration_min, exclui booked_slots
//    e horarios passados se for hoje)
// 4. Form com nome, telefone (se require_phone), email opcional,
//    motivo opcional
// 5. Submit POST /dental/book/:slug -> tela de sucesso
// ============================================================

import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { request } from '@/services/api';

interface BookingConfig {
  company_name: string;
  welcome_msg: string;
  slot_duration_min: number;
  available_days: number[];   // 0=domingo, 6=sabado
  start_hour: number;
  end_hour: number;
  require_phone: boolean;
  min_advance_hours: number;
  max_advance_days: number;
  booked_slots: Array<{ start: string; duration: number }>;
}

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function pad(n: number): string { return String(n).padStart(2, '0'); }
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function hm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Gera lista de slots HH:MM pra um dia, respeitando config + booked + minAdvance
function generateSlotsForDay(
  date: Date,
  config: BookingConfig
): Array<{ time: string; available: boolean; reason?: string }> {
  const slots: Array<{ time: string; available: boolean; reason?: string }> = [];
  const now = new Date();
  const minAdvanceMs = config.min_advance_hours * 60 * 60 * 1000;
  const isToday = ymd(date) === ymd(now);

  // Booked slots indexados por minuto-do-dia pra match rapido
  const bookedRanges: Array<{ start: number; end: number }> = [];
  for (const b of config.booked_slots || []) {
    const bDate = new Date(b.start);
    if (ymd(bDate) !== ymd(date)) continue;
    const startMin = bDate.getHours() * 60 + bDate.getMinutes();
    bookedRanges.push({ start: startMin, end: startMin + b.duration });
  }

  for (let h = config.start_hour; h < config.end_hour; h++) {
    for (let m = 0; m < 60; m += config.slot_duration_min) {
      const slotMin = h * 60 + m;
      const time = `${pad(h)}:${pad(m)}`;

      // Slot ja foi
      if (isToday) {
        const slotDate = new Date(date);
        slotDate.setHours(h, m, 0, 0);
        if (slotDate.getTime() - now.getTime() < minAdvanceMs) {
          slots.push({ time, available: false, reason: 'passou' });
          continue;
        }
      }

      // Conflito com horario ja agendado
      const slotEnd = slotMin + config.slot_duration_min;
      const conflict = bookedRanges.some(
        (b) => slotMin < b.end && slotEnd > b.start
      );
      if (conflict) {
        slots.push({ time, available: false, reason: 'ocupado' });
      } else {
        slots.push({ time, available: true });
      }
    }
  }

  return slots;
}

// Gera array de proximos N dias (apenas os available)
function generateAvailableDates(config: BookingConfig): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxDays = Math.min(config.max_advance_days || 30, 60);
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    if (config.available_days.includes(d.getDay())) {
      dates.push(d);
    }
  }
  return dates;
}

export default function BookPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [email, setEmail]   = useState('');
  const [reason, setReason] = useState('');
  const [success, setSuccess] = useState(false);

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['public-booking-config', slug],
    queryFn: () => request<BookingConfig>(`/dental/book/${slug}`, { token: null, retry: 1 }),
    enabled: !!slug,
    staleTime: 60000,
  });

  const submitMut = useMutation({
    mutationFn: () =>
      request(`/dental/book/${slug}`, {
        token: null,
        method: 'POST',
        body: {
          patient_name: name.trim(),
          patient_phone: phone.replace(/\D/g, '') || null,
          patient_email: email.trim() || null,
          preferred_date: ymd(selectedDate!),
          preferred_time: selectedTime,
          chief_complaint: reason.trim() || null,
        },
      }),
    onSuccess: () => setSuccess(true),
  });

  const dates = useMemo(() => (config ? generateAvailableDates(config) : []), [config]);
  const slots = useMemo(
    () => (selectedDate && config ? generateSlotsForDay(selectedDate, config) : []),
    [selectedDate, config]
  );

  // Loading
  if (isLoading) {
    return (
      <View style={s.page}>
        <View style={s.centerWrap}>
          <ActivityIndicator size="large" color="#06B6D4" />
          <Text style={s.loadingText}>Carregando agenda...</Text>
        </View>
      </View>
    );
  }

  // Erro 404 ou desativada
  if (error || !config) {
    return (
      <View style={s.page}>
        <View style={s.centerWrap}>
          <Text style={s.errorIcon}>{'\u{1F50D}'}</Text>
          <Text style={s.errorTitle}>Agenda nao disponivel</Text>
          <Text style={s.errorText}>
            Esta clinica ainda nao ativou o agendamento online ou o link
            esta incorreto. Confira o endereco com a clinica.
          </Text>
        </View>
      </View>
    );
  }

  // Sucesso
  if (success) {
    return (
      <View style={s.page}>
        <View style={s.centerWrap}>
          <Text style={s.successIcon}>{'\u2705'}</Text>
          <Text style={s.successTitle}>Solicitacao enviada!</Text>
          <Text style={s.successText}>
            A {config.company_name} recebeu sua solicitacao para
            {' '}{ymd(selectedDate!).split('-').reverse().join('/')} as {selectedTime}.
          </Text>
          <Text style={s.successText}>
            Entraremos em contato em breve para confirmar o horario.
          </Text>
          <View style={s.successFooter}>
            <Text style={s.poweredBy}>Agendamento online por</Text>
            <Text style={s.brand}>Aura</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.companyName}>{config.company_name}</Text>
          <Text style={s.welcomeMsg}>{config.welcome_msg}</Text>
        </View>

        {/* Step 1: Escolher data */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>1. Escolha o dia</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateRow}>
            {dates.map((d) => {
              const isSelected = selectedDate && ymd(selectedDate) === ymd(d);
              return (
                <Pressable
                  key={ymd(d)}
                  onPress={() => { setSelectedDate(d); setSelectedTime(null); }}
                  style={[s.dateCard, isSelected && s.dateCardActive]}
                >
                  <Text style={[s.dateDay, isSelected && s.dateDayActive]}>
                    {DAYS_PT[d.getDay()]}
                  </Text>
                  <Text style={[s.dateNum, isSelected && s.dateNumActive]}>
                    {d.getDate()}
                  </Text>
                  <Text style={[s.dateMonth, isSelected && s.dateMonthActive]}>
                    {MONTHS_PT[d.getMonth()]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Step 2: Escolher horario */}
        {selectedDate && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>2. Escolha o horario</Text>
            <View style={s.slotsGrid}>
              {slots.map((s2) => (
                <Pressable
                  key={s2.time}
                  onPress={() => s2.available && setSelectedTime(s2.time)}
                  disabled={!s2.available}
                  style={[
                    s.slotChip,
                    !s2.available && s.slotChipDisabled,
                    selectedTime === s2.time && s.slotChipActive,
                  ]}
                >
                  <Text
                    style={[
                      s.slotText,
                      !s2.available && s.slotTextDisabled,
                      selectedTime === s2.time && s.slotTextActive,
                    ]}
                  >
                    {s2.time}
                  </Text>
                </Pressable>
              ))}
            </View>
            {slots.every((s2) => !s2.available) && (
              <Text style={s.noSlotsText}>
                Sem horarios disponiveis neste dia. Escolha outra data.
              </Text>
            )}
          </View>
        )}

        {/* Step 3: Dados */}
        {selectedDate && selectedTime && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>3. Seus dados</Text>

            <View style={s.field}>
              <Text style={s.label}>Nome completo *</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="Como devemos te chamar"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>
                Telefone {config.require_phone ? '*' : '(opcional)'}
              </Text>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="(11) 99999-9999"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Email (opcional)</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Motivo da consulta (opcional)</Text>
              <TextInput
                style={[s.input, { minHeight: 70 }]}
                value={reason}
                onChangeText={setReason}
                placeholder="Ex: limpeza, dor de dente, avaliacao"
                placeholderTextColor="#94A3B8"
                multiline
              />
            </View>

            {submitMut.isError && (
              <View style={s.errorBox}>
                <Text style={s.errorBoxText}>
                  {(submitMut.error as any)?.message || 'Erro ao enviar. Tente novamente.'}
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => {
                if (!name.trim()) {
                  alert('Por favor informe seu nome.');
                  return;
                }
                if (config.require_phone && !phone.trim()) {
                  alert('Por favor informe seu telefone.');
                  return;
                }
                submitMut.mutate();
              }}
              disabled={submitMut.isPending}
              style={[s.submitBtn, submitMut.isPending && { opacity: 0.5 }]}
            >
              {submitMut.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>Solicitar agendamento</Text>}
            </Pressable>

            <Text style={s.disclaimer}>
              Sua solicitacao sera analisada pela {config.company_name}.
              Voce recebera uma confirmacao por telefone ou email.
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.poweredBy}>Agendamento online por</Text>
          <Text style={s.brand}>Aura</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0F172A' },
  scroll: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 32,
    paddingBottom: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  centerWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12,
  },
  loadingText: { color: '#94A3B8', fontSize: 14 },

  // Erros / Sucesso
  errorIcon:    { fontSize: 64 },
  errorTitle:   { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  errorText:    { color: '#94A3B8', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 340 },
  successIcon:  { fontSize: 64 },
  successTitle: { color: '#10B981', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  successText:  { color: '#CBD5E1', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 360 },
  successFooter:{ marginTop: 24, alignItems: 'center', gap: 4 },

  // Header
  header: {
    marginBottom: 24, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  companyName: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 6 },
  welcomeMsg:  { color: '#94A3B8', fontSize: 14, lineHeight: 20 },

  // Sections
  section: { marginBottom: 28 },
  sectionTitle: {
    color: '#06B6D4', fontSize: 13, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },

  // Date row
  dateRow: { gap: 8, paddingVertical: 4 },
  dateCard: {
    width: 64, padding: 10, borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1, borderColor: '#334155',
    alignItems: 'center', gap: 2,
  },
  dateCardActive: {
    backgroundColor: '#06B6D4',
    borderColor: '#06B6D4',
  },
  dateDay: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  dateDayActive: { color: '#fff' },
  dateNum: { color: '#fff', fontSize: 20, fontWeight: '700' },
  dateNumActive: { color: '#fff' },
  dateMonth: { color: '#94A3B8', fontSize: 10 },
  dateMonthActive: { color: '#fff' },

  // Slots
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1, borderColor: '#334155',
    minWidth: 70, alignItems: 'center',
  },
  slotChipActive: {
    backgroundColor: '#06B6D4', borderColor: '#06B6D4',
  },
  slotChipDisabled: {
    backgroundColor: 'rgba(30,41,59,0.4)',
    borderColor: 'rgba(51,65,85,0.4)',
  },
  slotText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  slotTextActive: { color: '#fff' },
  slotTextDisabled: { color: '#475569', textDecorationLine: 'line-through' },
  noSlotsText: {
    color: '#94A3B8', fontSize: 13, textAlign: 'center',
    paddingVertical: 16, fontStyle: 'italic',
  },

  // Form
  field: { marginBottom: 14 },
  label: {
    color: '#94A3B8', fontSize: 12, fontWeight: '600',
    marginBottom: 6, letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#1E293B', borderRadius: 8, padding: 12,
    color: '#fff', fontSize: 15,
    borderWidth: 1, borderColor: '#334155',
  },

  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8, padding: 10, marginBottom: 12,
  },
  errorBoxText: { color: '#FCA5A5', fontSize: 13 },

  submitBtn: {
    backgroundColor: '#06B6D4', paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', marginTop: 8,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  disclaimer: {
    color: '#64748B', fontSize: 11, textAlign: 'center',
    marginTop: 12, lineHeight: 16,
  },

  // Footer
  footer: {
    marginTop: 32, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: '#1E293B',
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 6,
  },
  poweredBy: { color: '#475569', fontSize: 11 },
  brand: { color: '#06B6D4', fontSize: 13, fontWeight: '700' },
});
