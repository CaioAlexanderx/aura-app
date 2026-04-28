// ============================================================
// DentalComplianceConfigCard - PR37 (2026-04-28)
//
// Card de configuracao de compliance odonto. Plugar na tela de
// configuracoes da clinica (/dental/(clinic)/clinica) ou em
// Configuracoes (Aura Negocio) quando vertical=odonto.
//
// Persiste em companies via PATCH /companies/:id/profile:
//  - vigilancia_alvara_expires_at
//  - vigilancia_alvara_number
//  - vigilancia_alvara_reminder_enabled (toggle)
//  - cro_state
//  - cro_pj_number
//  - cro_rt_number
//  - cro_rt_user_id (FK users)
//  - cnes_number
//  - uses_controlled_meds (toggle - ativa SNGPC)
//
// Componente se desabilita se vertical_active !== 'odonto'.
// ============================================================

import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Switch, ActivityIndicator, StyleSheet } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import { DentalColors } from "@/constants/dental-tokens";

interface ProfileResponse {
  id?: string;
  vigilancia_alvara_expires_at?: string | null;
  vigilancia_alvara_number?: string | null;
  vigilancia_alvara_reminder_enabled?: boolean;
  cro_state?: string | null;
  cro_pj_number?: string | null;
  cro_rt_number?: string | null;
  cnes_number?: string | null;
  uses_controlled_meds?: boolean;
}

function isoToBR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function brToISO(br: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function maskBRDate(s: string): string {
  const d = (s || "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + "/" + d.slice(2);
  return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
}

export function DentalComplianceConfigCard() {
  const cid = useAuthStore().company?.id;
  const company = useAuthStore().company as any;
  const qc = useQueryClient();

  // Se nao for odonto, nao renderiza
  if (company?.vertical_active !== "odonto") return null;

  const [alvaraDateBR, setAlvaraDateBR] = useState("");
  const [alvaraNumber, setAlvaraNumber] = useState("");
  const [alvaraReminderOn, setAlvaraReminderOn] = useState(true);
  const [croState, setCroState] = useState("");
  const [croPj, setCroPj] = useState("");
  const [croRt, setCroRt] = useState("");
  const [cnesNumber, setCnesNumber] = useState("");
  const [usesControlled, setUsesControlled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Carrega dados atuais ao montar
  useEffect(() => {
    if (!cid) return;
    setLoading(true);
    request<ProfileResponse>(`/companies/${cid}/profile`)
      .then((p) => {
        setAlvaraDateBR(isoToBR(p.vigilancia_alvara_expires_at));
        setAlvaraNumber(p.vigilancia_alvara_number || "");
        setAlvaraReminderOn(p.vigilancia_alvara_reminder_enabled !== false);
        setCroState(p.cro_state || "");
        setCroPj(p.cro_pj_number || "");
        setCroRt(p.cro_rt_number || "");
        setCnesNumber(p.cnes_number || "");
        setUsesControlled(!!p.uses_controlled_meds);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cid]);

  const saveMut = useMutation({
    mutationFn: () => {
      const isoDate = alvaraDateBR ? brToISO(alvaraDateBR) : null;
      return request(`/companies/${cid}/profile`, {
        method: "PUT",
        body: {
          vigilancia_alvara_expires_at: isoDate,
          vigilancia_alvara_number: alvaraNumber.trim() || null,
          vigilancia_alvara_reminder_enabled: alvaraReminderOn,
          cro_state: croState.trim().toUpperCase().slice(0, 2) || null,
          cro_pj_number: croPj.trim() || null,
          cro_rt_number: croRt.trim() || null,
          cnes_number: cnesNumber.trim() || null,
          uses_controlled_meds: usesControlled,
        },
      });
    },
    onSuccess: () => {
      toast.success("Compliance odonto atualizado");
      qc.invalidateQueries({ queryKey: ["obligations-calendar"] });
      qc.invalidateQueries({ queryKey: ["company-profile"] });
    },
    onError: (e: any) => toast.error(e?.data?.error || "Erro ao salvar"),
  });

  // Calcula dias restantes do alvara (helper visual)
  let alvaraDaysLeft: number | null = null;
  if (alvaraDateBR) {
    const iso = brToISO(alvaraDateBR);
    if (iso) {
      const d = new Date(iso);
      alvaraDaysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
    }
  }

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.title}>🦷 Compliance Odonto</Text>
        <Text style={s.subtitle}>
          Cadastre os dados regulatorios da clinica. Usamos pra calcular vencimentos e lembrar voce 60/30/7 dias antes.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={DentalColors.cyan} style={{ padding: 20 }} />
      ) : (
        <>
          {/* ALVARA */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>🛡️ ALVARA DA VIGILANCIA SANITARIA</Text>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Validade (DD/MM/AAAA)</Text>
                <TextInput
                  value={alvaraDateBR}
                  onChangeText={(v) => setAlvaraDateBR(maskBRDate(v))}
                  placeholder="31/12/2026"
                  placeholderTextColor={DentalColors.ink3}
                  keyboardType="numeric"
                  maxLength={10}
                  style={s.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Numero do alvara</Text>
                <TextInput
                  value={alvaraNumber}
                  onChangeText={setAlvaraNumber}
                  placeholder="Ex: 123456/2024"
                  placeholderTextColor={DentalColors.ink3}
                  style={s.input}
                />
              </View>
            </View>
            {alvaraDaysLeft !== null && (
              <View style={[
                s.alvaraStatus,
                alvaraDaysLeft < 0 && { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.30)" },
                alvaraDaysLeft >= 0 && alvaraDaysLeft <= 30 && { backgroundColor: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.30)" },
                alvaraDaysLeft > 30 && { backgroundColor: DentalColors.cyanDim, borderColor: DentalColors.cyanBorder },
              ]}>
                <Text style={[
                  s.alvaraStatusText,
                  alvaraDaysLeft < 0 && { color: DentalColors.red },
                  alvaraDaysLeft >= 0 && alvaraDaysLeft <= 30 && { color: DentalColors.amber },
                  alvaraDaysLeft > 30 && { color: DentalColors.cyan },
                ]}>
                  {alvaraDaysLeft < 0
                    ? `⚠ Alvara vencido ha ${Math.abs(alvaraDaysLeft)} dias`
                    : alvaraDaysLeft === 0
                    ? "⚠ Alvara vence hoje!"
                    : alvaraDaysLeft <= 7
                    ? `⚠ Vence em ${alvaraDaysLeft} dia(s)`
                    : alvaraDaysLeft <= 30
                    ? `⚠ Vence em ${alvaraDaysLeft} dias - planeje renovacao`
                    : `✓ Alvara valido por mais ${alvaraDaysLeft} dias`}
                </Text>
              </View>
            )}
            <View style={s.toggleRow}>
              <Text style={s.toggleLabel}>Receber lembretes 60/30/7 dias antes do vencimento</Text>
              <Switch
                value={alvaraReminderOn}
                onValueChange={setAlvaraReminderOn}
                trackColor={{ false: "rgba(255,255,255,0.1)", true: DentalColors.cyan + "66" }}
                thumbColor={alvaraReminderOn ? DentalColors.cyan : DentalColors.ink3}
              />
            </View>
          </View>

          {/* CRO */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>🦷 CRO - CONSELHO REGIONAL DE ODONTOLOGIA</Text>
            <View style={s.row}>
              <View style={{ width: 80 }}>
                <Text style={s.label}>UF</Text>
                <TextInput
                  value={croState}
                  onChangeText={(v) => setCroState(v.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  placeholderTextColor={DentalColors.ink3}
                  maxLength={2}
                  style={s.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Inscricao da clinica (PJ)</Text>
                <TextInput
                  value={croPj}
                  onChangeText={setCroPj}
                  placeholder="Ex: CRO-SP/CL-12345"
                  placeholderTextColor={DentalColors.ink3}
                  style={s.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>RT (Responsavel Tecnico)</Text>
                <TextInput
                  value={croRt}
                  onChangeText={setCroRt}
                  placeholder="Ex: CRO-SP/12345"
                  placeholderTextColor={DentalColors.ink3}
                  style={s.input}
                />
              </View>
            </View>
          </View>

          {/* CNES */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>🏥 CNES - CADASTRO ESTABELECIMENTO SAUDE</Text>
            <View>
              <Text style={s.label}>Numero CNES</Text>
              <TextInput
                value={cnesNumber}
                onChangeText={setCnesNumber}
                placeholder="7 digitos"
                placeholderTextColor={DentalColors.ink3}
                keyboardType="numeric"
                maxLength={7}
                style={s.input}
              />
            </View>
          </View>

          {/* Medicamentos controlados */}
          <View style={s.section}>
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>Usa medicamentos controlados (anestesicos com vasoconstritor)</Text>
                <Text style={s.toggleHint}>Ativa lembretes mensais SNGPC (Anvisa)</Text>
              </View>
              <Switch
                value={usesControlled}
                onValueChange={setUsesControlled}
                trackColor={{ false: "rgba(255,255,255,0.1)", true: DentalColors.cyan + "66" }}
                thumbColor={usesControlled ? DentalColors.cyan : DentalColors.ink3}
              />
            </View>
          </View>

          <Pressable
            onPress={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            style={[s.btnSave, saveMut.isPending && { opacity: 0.6 }]}
          >
            {saveMut.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnSaveText}>Salvar compliance</Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: DentalColors.border,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  header: { marginBottom: 16 },
  title: { fontSize: 16, fontWeight: "800", color: DentalColors.ink },
  subtitle: { fontSize: 11, color: DentalColors.ink3, marginTop: 4, lineHeight: 16 },
  section: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: DentalColors.border,
  },
  sectionTitle: { fontSize: 9, color: DentalColors.cyan, letterSpacing: 1.5, fontWeight: "700", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  label: { fontSize: 10, color: DentalColors.ink3, marginBottom: 4, fontWeight: "600" },
  input: {
    backgroundColor: DentalColors.bg2,
    borderWidth: 1,
    borderColor: DentalColors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: DentalColors.ink,
  } as any,
  alvaraStatus: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  alvaraStatusText: { fontSize: 11, fontWeight: "700" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  toggleLabel: { fontSize: 12, color: DentalColors.ink, flex: 1 },
  toggleHint: { fontSize: 10, color: DentalColors.ink3, marginTop: 2 },
  btnSave: {
    backgroundColor: DentalColors.cyan,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  btnSaveText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});

export default DentalComplianceConfigCard;
