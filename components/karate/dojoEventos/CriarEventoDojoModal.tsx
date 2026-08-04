// ============================================================
// CriarEventoDojoModal — Aura Karatê (DOJÔ) · F9
//
// "Podemos usar a estrutura idêntica de criação de eventos que já temos
// na federação." — mesmo DNA visual/comportamental de
// components/karate/CriarExameModal.tsx (header com selo 空, máscaras
// dd/mm/aaaa e R$ consistentes, seletor de tipo em cards, CTA sumi
// full-width no rodapé) — mas é um componente PRÓPRIO, não um import
// dali: o modal da federação está fortemente acoplado ao domínio "exame
// de faixa" (steps de banca/candidatos, exam_type 'exame'|'curso',
// POST /belt-exams). O evento PRÓPRIO do dojô é outro modelo
// (karate_dojo_events, POST /federation/:id/dojo/own-events), com dois
// tipos DIFERENTES dos da federação — 'curso' e 'seminario' — e SEM
// banca/candidatos (por isso um único passo "Dados", sem Stepper).
//
// NÃO oferece criar exame de kyu por aqui — de propósito. O exame de
// kyu (karate_dojo_belt_exams) já existe, tem regra própria (teto do
// sensei, ligação com karate_belt_history) e ganha tela dedicada em
// outra frente (o backend já está pronto, falta só o consumidor). Este
// modal só sabe criar curso/seminário.
//
// location NÃO é obrigatória aqui (diferente do exame da federação): o
// backend (createEvent, karateDojoEventService.js) só exige kind/name/
// event_date — dado faltante é neutro, não pendência.
// ============================================================
import React, { useState } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, TextInput, Pressable,
  StyleSheet, useWindowDimensions, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { parseBrDate } from "@/components/inputs/DateInput";
import { karateDojoEventsApi, DojoEventKind } from "@/services/karateDojoEventsApi";
import { notify } from "@/utils/webAlert";

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  onCreated?: () => void;
}

// ── máscaras BR (mesmas de CriarExameModal — helper pequeno, duplicado
// de propósito: o par modal/máscara já é assim em todo o karatê) ──────
const onlyD = (v: string) => (v || "").replace(/\D/g, "");

function maskDate(v: string) {
  const d = onlyD(v).slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "$1/$2");
  return d;
}

function maskMoney(v: string) {
  const cents = onlyD(v).slice(0, 11);
  if (!cents) return "";
  const n = parseInt(cents, 10);
  const reais = Math.floor(n / 100);
  const frac = String(n % 100).padStart(2, "0");
  return `${reais.toLocaleString("pt-BR")},${frac}`;
}
function moneyToNumber(v: string): number {
  const cents = onlyD(v);
  return cents ? parseInt(cents, 10) / 100 : 0;
}

const KIND_LABEL: Record<DojoEventKind, { label: string; desc: string; icon: string }> = {
  curso: { label: "Curso", desc: "Formação com carga horária", icon: "dumbbell" },
  seminario: { label: "Seminário", desc: "Encontro pontual, sem grau", icon: "users" },
};

export function CriarEventoDojoModal({ visible, onClose, federationId, onCreated }: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(600, width - 24);

  const [kind, setKind] = useState<DojoEventKind>("curso");
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [fee, setFee] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateBad = eventDate.length === 10 && parseBrDate(eventDate) === null;

  const resetAndClose = () => {
    setKind("curso"); setName(""); setEventDate(""); setLocation(""); setFee("");
    setMaxParticipants(""); setHours(""); setDescription("");
    setLoading(false); setError(null);
    onClose();
  };

  const handleCreate = async () => {
    const iso = parseBrDate(eventDate);
    if (!name.trim() || !iso) {
      setError("Preencha o título e uma data válida (dd/mm/aaaa).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const created = await karateDojoEventsApi.createOwnEvent(federationId, {
        kind,
        name: name.trim(),
        event_date: iso,
        location: location.trim() || undefined,
        fee_amount: fee ? moneyToNumber(fee) : undefined,
        max_participants: maxParticipants ? parseInt(maxParticipants, 10) : undefined,
        hours: hours ? parseInt(hours, 10) : undefined,
        description: description.trim() || undefined,
      });
      onCreated?.();
      const what = kind === "curso" ? "Curso" : "Seminário";
      resetAndClose();
      notify(`${what} criado!`, `"${created.name}" já aparece em Meus eventos.`);
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível criar o evento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={resetAndClose} />
        <View style={[styles.card, { width: cardW }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>空  Meu dojô · Novo evento</Text>
              <Text style={styles.title}>Criar evento<Text style={{ color: P.red }}>.</Text></Text>
              <Text style={styles.sub}>Curso ou seminário do seu dojô — qualquer aluno pode participar.</Text>
            </View>
            <TouchableOpacity onPress={resetAndClose} hitSlop={10} style={styles.close} accessibilityLabel="Fechar modal">
              <Icon name="x" size={20} color={P.ink2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {error ? (
              <View style={styles.errorBanner}>
                <Icon name="alert_circle" size={15} color={P.red} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.kindRow}>
              {(Object.keys(KIND_LABEL) as DojoEventKind[]).map((k) => (
                <KindOption
                  key={k}
                  label={KIND_LABEL[k].label}
                  desc={KIND_LABEL[k].desc}
                  icon={KIND_LABEL[k].icon}
                  active={kind === k}
                  onPress={() => setKind(k)}
                />
              ))}
            </View>

            <Field label={kind === "curso" ? "Título do curso" : "Título do seminário"} req value={name} onChangeText={setName}
              placeholder={kind === "curso" ? "Ex.: Curso de Kata · Jun/2026" : "Ex.: Seminário com Sensei Convidado"} autoFocus returnKeyType="next" />
            <Row2>
              <Field flex label="Data" req hint="dd/mm/aaaa" mono value={eventDate}
                onChangeText={(v) => setEventDate(maskDate(v))} keyboardType="numeric" maxLength={10}
                placeholder="dd/mm/aaaa" bad={dateBad}
                note={dateBad ? "Data inválida. Use dd/mm/aaaa." : undefined} />
              <Field flex label="Local" hint="opcional" value={location} onChangeText={setLocation}
                placeholder="Dojô / ginásio" returnKeyType="next" />
            </Row2>
            <Row2>
              <Field flex label="Taxa" hint="opcional" mono value={fee}
                onChangeText={(v) => setFee(maskMoney(v))} keyboardType="numeric"
                placeholder="0,00" prefix="R$" />
              <Field flex label="Vagas" hint="opcional" mono value={maxParticipants}
                onChangeText={(v) => setMaxParticipants(onlyD(v))} keyboardType="numeric"
                placeholder="Sem limite" />
            </Row2>
            <Field label="Carga horária (horas/aula)" hint="opcional" mono value={hours}
              onChangeText={(v) => setHours(onlyD(v))} keyboardType="numeric"
              placeholder="Ex.: 8" />
            <Field label="Descrição" hint="opcional" value={description} onChangeText={setDescription}
              placeholder="Detalhes visíveis só pra você (não aparece pro aluno)" multiline />
          </ScrollView>

          <View style={styles.footer}>
            <KarateButton
              label={loading ? "Criando..." : "Criar evento"}
              variant="sumi" size="md" loading={loading} onPress={handleCreate} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function KindOption({ label, desc, icon, active, onPress }: {
  label: string; desc: string; icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.kindOpt, active && styles.kindOptActive]}
    >
      <View style={[styles.kindIcon, active && styles.kindIconActive]}>
        <Icon name={icon as any} size={16} color={active ? P.paper : P.ink2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.kindLabel, active && styles.kindLabelActive]}>{label}</Text>
        <Text style={styles.kindDesc}>{desc}</Text>
      </View>
      {active && <Icon name="check" size={16} color={P.red} />}
    </Pressable>
  );
}
function Row2({ children }: { children: React.ReactNode }) {
  return <View style={styles.row2}>{children}</View>;
}
function Field(props: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  hint?: string; req?: boolean; mono?: boolean; flex?: boolean; bad?: boolean; prefix?: string;
  note?: string; keyboardType?: any; maxLength?: number; autoFocus?: boolean; returnKeyType?: any;
  multiline?: boolean;
}) {
  return (
    <View style={[styles.field, props.flex && { flex: 1 }]}>
      <Text style={styles.label}>{props.label}{props.req ? <Text style={{ color: P.red }}> *</Text> : null}{props.hint ? <Text style={styles.labelHint}>  · {props.hint}</Text> : null}</Text>
      <View style={[styles.inputWrap, props.bad && styles.inputBad, props.multiline && styles.inputWrapMultiline]}>
        {props.prefix ? <Text style={styles.prefix}>{props.prefix}</Text> : null}
        <TextInput
          style={[styles.input, props.mono && styles.mono, props.multiline && styles.inputMultiline]}
          value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder}
          placeholderTextColor={P.ink4} keyboardType={props.keyboardType}
          maxLength={props.maxLength} autoFocus={props.autoFocus} returnKeyType={props.returnKeyType}
          multiline={props.multiline} numberOfLines={props.multiline ? 3 : undefined}
        />
      </View>
      {props.note ? <Text style={styles.noteBad}>{props.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, overflow: "hidden", maxHeight: "92%", borderWidth: 1, borderColor: P.line2 } as ViewStyle,

  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 24, color: P.ink, marginTop: 2 } as TextStyle,
  sub: { fontFamily: F.body, fontSize: 12.5, color: P.ink2, marginTop: 3 } as TextStyle,
  close: { padding: 4, borderRadius: 999 } as ViewStyle,

  bodyContent: { padding: 20, paddingTop: 16, gap: 12 } as ViewStyle,

  kindRow: { flexDirection: "row", gap: 10, marginBottom: 4 } as ViewStyle,
  kindOpt: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, padding: 12 } as ViewStyle,
  kindOptActive: { borderColor: P.red, backgroundColor: P.redWash } as ViewStyle,
  kindIcon: { width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: P.paper3 } as ViewStyle,
  kindIconActive: { backgroundColor: P.ink } as ViewStyle,
  kindLabel: { fontFamily: F.body, fontSize: 14, fontWeight: "800", color: P.ink } as TextStyle,
  kindLabelActive: { color: P.ink } as TextStyle,
  kindDesc: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 1 } as TextStyle,

  row2: { flexDirection: "row", gap: 12 } as ViewStyle,
  field: { marginBottom: 11 } as ViewStyle,
  label: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 5 } as TextStyle,
  labelHint: { fontWeight: "500", color: P.ink4 } as TextStyle,
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12 } as ViewStyle,
  inputWrapMultiline: { alignItems: "flex-start", paddingVertical: 8 } as ViewStyle,
  inputBad: { borderColor: P.red } as ViewStyle,
  prefix: { fontFamily: F.mono, fontSize: 13, color: P.ink3, marginRight: 6 } as TextStyle,
  input: { flex: 1, fontFamily: F.body, fontSize: 14, color: P.ink, paddingVertical: 11, outlineStyle: "none" as any } as TextStyle,
  inputMultiline: { paddingVertical: 0, textAlignVertical: "top" as any, minHeight: 60 } as TextStyle,
  mono: { fontFamily: F.mono, letterSpacing: 0.5 } as TextStyle,
  noteBad: { fontFamily: F.body, fontSize: 11, color: P.red, marginTop: 4 } as TextStyle,

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11 } as ViewStyle,
  errorText: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
});
