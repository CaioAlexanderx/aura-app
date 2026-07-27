// ============================================================
// Aura Karatê (dojô) — Configurações (F1, tela nova; F3a: card Pix; F3b: Conta Aura)
//
// QA 27/07 (item 5): o /dojo/me era incompleto (11 campos "—") e o
// rodapé dizia "edições são feitas pela federação" pra TUDO — herança de
// quando a federação criava o cadastro do dojô. Com o contrato final
// (Aura-backend#429) o dojô tem registro PRÓPRIO, então a tela virou
// dois blocos:
//   • "Dados do dojô" — nome, CNPJ, e-mail, telefone, fundação.
//     EDITÁVEL pelo sensei via PATCH /dojo/me (decisão do Caio).
//   • "Filiação" — código FPKT, federação, situação, modelo, filiado
//     desde, região, praticantes registrados. SOMENTE LEITURA — vem da
//     federação; a nota de "fale com a federação pra corrigir" fica
//     restrita a este bloco (nunca aparece no bloco editável).
// Dado faltante continua NEUTRO ("—"), não erro — só no bloco Filiação
// agora (o bloco Dados do dojô é do próprio dojô; campo vazio ali é
// simplesmente "a preencher").
// Datas: parse manual tz-safe (nunca Date UTC de 'YYYY-MM-DD').
//
// F3a: card "Recebimento Pix" (PixConfigCard, alwaysShow) — a mesma
// chave Pix usada nas cobranças de mensalidade em (dojo)/mensalidades.
//
// F3b: card "Conta Aura" (ContaAuraCard, BaaS opt-in) logo abaixo —
// invisível quando a flag do backend está desligada.
//
// F4: card "Check-in por QR" (QrSettingsCard) — liga/desliga o painel
// de check-in por QR na tela Turmas; some sozinho se o endpoint ainda
// não existir no ambiente (mesmo racional do ContaAuraCard).
// ============================================================
import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { FormField } from "@/components/karate/FormField";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateDojoInfoApi, DojoMeUpdatePayload } from "@/services/karateDojoInfoApi";
import { PixConfigCard } from "@/components/karate/dojoMensalidades/PixConfigCard";
import { ContaAuraCard } from "@/components/karate/dojoMensalidades/contaAura/ContaAuraCard";
import { QrSettingsCard } from "@/components/karate/dojoTurmas/QrSettingsCard";
import { isoToBR, brToISO, maskDateBR, isValidEmail } from "@/components/karate/dojoAlunos/helpers";
import { maskCnpj, maskPhone, onlyDigits } from "@/utils/masks";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function fmtDataLonga(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  const [, y, mo, d] = m;
  const mi = parseInt(mo, 10) - 1;
  if (mi < 0 || mi > 11) return String(iso);
  return `${parseInt(d, 10)} de ${MESES[mi]} de ${y}`;
}

const AFFILIATION_STATUS_LABEL: Record<string, string> = {
  filiado: "Filiado",
  pendente: "Pendente",
  nao_filiado: "Não filiado",
};

type DojoMeErrorField = "name" | "cnpj" | "email" | "phone" | "founded_at" | "general";

function mapDojoMeSaveError(e: any): { field: DojoMeErrorField; message: string } {
  const code = e?.data?.code ?? e?.code ?? null;
  const apiErrors: string[] = Array.isArray(e?.data?.errors) ? e.data.errors : [];
  if (code === "VALIDATION_ERROR") {
    const joined = apiErrors.join(" ");
    if (/cnpj/i.test(joined)) return { field: "cnpj", message: "CNPJ inválido." };
    if (/email/i.test(joined)) return { field: "email", message: "E-mail inválido." };
    if (/phone/i.test(joined)) return { field: "phone", message: "Telefone inválido." };
    if (/founded_at/i.test(joined)) return { field: "founded_at", message: "Data de fundação inválida. Use DD/MM/AAAA." };
    if (/name/i.test(joined)) return { field: "name", message: "Informe o nome do dojô." };
    return { field: "general", message: apiErrors[0] || "Dados inválidos — confira o formulário." };
  }
  return { field: "general", message: e?.data?.error || e?.message || "Não foi possível salvar. Tente de novo." };
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value ?? "—"}</Text>
    </View>
  );
}

function DadosDojoCard() {
  const { dojoMe, dojoName, reload } = useKarateDojo();
  const { federationId } = useKarateFederation();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [foundedBR, setFoundedBR] = useState("");
  const [errors, setErrors] = useState<Partial<Record<DojoMeErrorField, string>>>({});
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setName(dojoMe?.name ?? dojoName ?? "");
    setCnpj(dojoMe?.cnpj ? maskCnpj(dojoMe.cnpj) : "");
    setEmail(dojoMe?.email ?? "");
    setPhone(dojoMe?.phone ? maskPhone(dojoMe.phone) : "");
    setFoundedBR(isoToBR(dojoMe?.founded_at ?? null));
    setErrors({});
    setEditing(true);
  }

  function cancelEdit() {
    setErrors({});
    setEditing(false);
  }

  async function save() {
    if (!federationId) return;
    const errs: Partial<Record<DojoMeErrorField, string>> = {};
    if (!name.trim()) errs.name = "Informe o nome do dojô.";
    if (email.trim() && !isValidEmail(email)) errs.email = "E-mail inválido.";
    let foundedISO: string | null = null;
    if (foundedBR.trim()) {
      foundedISO = brToISO(foundedBR);
      if (!foundedISO) errs.founded_at = "Data inválida. Use DD/MM/AAAA.";
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    const payload: DojoMeUpdatePayload = {
      name: name.trim(),
      cnpj: onlyDigits(cnpj) || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      founded_at: foundedISO,
    };

    setSaving(true);
    setErrors({});
    try {
      await karateDojoInfoApi.updateDojoMe(federationId, payload);
      setEditing(false);
      reload();
    } catch (e: any) {
      const mapped = mapDojoMeSaveError(e);
      setErrors({ [mapped.field]: mapped.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeadRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Dados do dojô</Text>
          <Text style={styles.cardSub}>Cadastro próprio do seu dojô — você pode editar.</Text>
        </View>
        {!editing && (
          <TouchableOpacity onPress={startEdit} accessibilityRole="button" style={styles.editBtn}>
            <Icon name="edit" size={13} color={KarateColors.primary} />
            <Text style={styles.editBtnTxt}>Editar</Text>
          </TouchableOpacity>
        )}
      </View>

      {!editing ? (
        <View style={{ marginTop: 6 }}>
          <InfoRow label="Nome do dojô" value={dojoMe?.name ?? dojoName} />
          <InfoRow label="CNPJ" value={dojoMe?.cnpj ? maskCnpj(dojoMe.cnpj) : null} />
          <InfoRow label="E-mail" value={dojoMe?.email ?? null} />
          <InfoRow label="Telefone" value={dojoMe?.phone ? maskPhone(dojoMe.phone) : null} />
          <InfoRow label="Fundado em" value={fmtDataLonga(dojoMe?.founded_at)} />
        </View>
      ) : (
        <View style={{ marginTop: 8, gap: 10 }}>
          <FormField label="Nome do dojô" required value={name} onChangeText={setName} error={errors.name} />
          <FormField
            label="CNPJ"
            value={cnpj}
            onChangeText={(t) => setCnpj(maskCnpj(t))}
            keyboardType="numeric"
            error={errors.cnpj}
          />
          <FormField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.email}
          />
          <FormField
            label="Telefone"
            value={phone}
            onChangeText={(t) => setPhone(maskPhone(t))}
            keyboardType="phone-pad"
            error={errors.phone}
          />
          <FormField
            label="Fundado em"
            value={foundedBR}
            onChangeText={(t) => setFoundedBR(maskDateBR(t))}
            placeholder="DD/MM/AAAA"
            keyboardType="numeric"
            error={errors.founded_at}
          />
          {!!errors.general && <Text style={styles.generalErr}>{errors.general}</Text>}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={cancelEdit} style={{ flex: 1 }} />
            <KarateButton label="Salvar alterações" variant="sumi" size="sm" onPress={save} loading={saving} style={{ flex: 2 }} />
          </View>
        </View>
      )}
    </View>
  );
}

function FiliacaoCard() {
  const { dojoMe } = useKarateDojo();

  const rows: { label: string; value: string | null }[] = [
    { label: "Código FPKT", value: dojoMe?.fpkt_affiliation_id ?? null },
    { label: "Federação", value: dojoMe?.federation_name ?? null },
    {
      label: "Situação",
      value: dojoMe?.affiliation_status ? (AFFILIATION_STATUS_LABEL[dojoMe.affiliation_status] ?? dojoMe.affiliation_status) : null,
    },
    { label: "Modelo de filiação", value: dojoMe?.affiliation_model ?? null },
    { label: "Filiado desde", value: fmtDataLonga(dojoMe?.affiliated_since) },
    { label: "Região", value: dojoMe?.region ?? null },
    {
      label: "Praticantes registrados",
      value: dojoMe?.practitioners_count != null ? String(dojoMe.practitioners_count) : null,
    },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Filiação</Text>
      <Text style={styles.cardSub}>Somente leitura — mantida pela federação</Text>
      <View style={{ marginTop: 6 }}>
        {rows.map((r) => (
          <InfoRow key={r.label} label={r.label} value={r.value} />
        ))}
      </View>
      <View style={styles.note}>
        <Icon name="alert-circle-outline" size={16} color={KarateColors.ink3} />
        <Text style={styles.noteTxt}>
          Estes dados vêm da federação. Se algo estiver errado ou desatualizado, avise a sua federação
          para corrigir o cadastro — a mudança aparece aqui automaticamente.
        </Text>
      </View>
    </View>
  );
}

export default function DojoConfiguracoes() {
  const { loading, error, reload, dojoName } = useKarateDojo();
  const { federationId } = useKarateFederation();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>Aura Karatê · {dojoName}</Text>
        <Text style={styles.title}>Configurações</Text>
        <Text style={styles.lead}>Os dados do seu dojô e a filiação à federação.</Text>
      </View>

      {loading && (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={KarateColors.primary} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.stateBox}>
          <Icon name="alert-circle-outline" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Não foi possível carregar os dados do dojô.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reload} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <>
          <DadosDojoCard />
          <FiliacaoCard />
        </>
      )}

      {/* F3a: chave Pix de recebimento das mensalidades */}
      {!!federationId && <PixConfigCard federationId={federationId} alwaysShow />}

      {/* F3b: Conta Aura (BaaS opt-in) — invisível com a flag desligada */}
      {!!federationId && <ContaAuraCard federationId={federationId} />}

      {/* F4: Check-in por QR (Turmas) — some se o endpoint ainda não existir */}
      {!!federationId && <QrSettingsCard federationId={federationId} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  cardHeadRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  editBtnTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  infoLabel: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  infoValue: { flex: 1, textAlign: "right", fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  generalErr: { fontSize: 12.5, color: KarateColors.danger, fontWeight: "600", lineHeight: 18 } as TextStyle,
  note: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12, marginTop: 12 } as ViewStyle,
  noteTxt: { flex: 1, fontSize: 12, color: KarateColors.ink3, lineHeight: 17 } as TextStyle,
});
