import React from "react";
import {
  View, Text, Image,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { PractitionerDetail } from "@/services/karateApi";
import { formatIsoToBr, formatIsoToBrVariant } from "@/components/inputs/DateInput";
import { formatCpfDisplay, formatPhoneDisplay, formatCepDisplay, ageFromBirthDate } from "./helpers";

interface Props {
  practitioner: PractitionerDetail;
}

// F4.1: rotulo sempre visível; valor ausente renderiza um traçodeioro leve (“”
// Alinhamento: label fixo 110px, valor ao lado, ambos na mesma linha.
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={fieldStyles.row}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Text style={value ? fieldStyles.value : fieldStyles.empty} numberOfLines={2}>
        {value || "“"}
      </Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={fieldStyles.sectionHead}>{title}</Text>;
}

export function CadastroTab({ practitioner }: Props) {
  const p = practitioner;
  const age = ageFromBirthDate(p.birth_date);
  const needsGuardian = age !== null && age < 18;

  return (
    <View style={tabStyles.tab}>
      {// Foto / avatar
        p.photo_url ? (
          <View style={tabStyles.photoWrap}>
            <Image
              source={{ uri: p.photo_url }}
              style={tabStyles.photo}
              accessibilityLabel={`Foto de ${p.full_name}`}
            />
          </View>
        ) : (
          <View style={tabStyles.avatarWrap}>
            <View style={tabStyles.avatar}>
              <Text style={tabStyles.avatarTxt}>
                {p.full_name[0]?.toUpperCase() || "?"}
              </Text>
            </View>
          </View>
        )}

      <SectionHeader title="DADOS PESSOAIS" />
      <Field label="Nome completo" value={p.full_name} />
      <Field label="CPF" value={formatCpfDisplay(p.cpf)} />
      <Field label="RG" value={p.rig} />
      <Field
        label="Nascimento"
        value={
          p.birth_date
            ? `${formatIsoToBrVariant(p.birth_date)}${age !== null ? ` (${age} anos)` : ""}`
            : null
        }
      />
      <Field label="Sexo" value={p.gender === "M" ? "Masculino" : p.gender === "F" ? "Feminino" : p.gender} />
      <Field label="E-mail" value={p.email} />
      <Field label="Telefone" value={formatPhoneDisplay(p.phone)} />

      {/* Endereço — F4.4: mostra quando pelo menos 1 campo está preenchido */}
      {[p.address_street, p.address_neighborhood, p.address_city, p.address_state, p.address_zip].some(Boolean) && (
        <>
          <SectionHeader title="ENDEREÇO" />
          <Field label="CEP" value={formatCepDisplay(p.address_zip)} />
          <Field label="Endereço" value={p.address_street} />
          <Field label="Bairro" value={p.address_neighborhood} />
          <Field
            label="Município"
            value={[p.address_city, p.address_state].filter(Boolean).join(" / ") || null}
          />
        </>
      )}

      {needsGuardian && (
        <>
          <SectionHeader title="RESPONSÁVEL LEGAL" />
          <Field label="Nome" value={p.guardian_name} />
          <Field label="Telefone" value={formatPhoneDisplay(p.guardian_phone)} />
          <Field label="CPF" value={formatCpfDisplay(p.guardian_cpf)} />
        </>
      )}

      <SectionHeader title="ATIVIDADE" />
      <Field label="Filiado em" value={p.affiliation_since ? formatIsoToBr(p.affiliation_since) : null} />
      <Field label="Dojô" value={p.dojo_name} />
      <Field label="Anuidade" value={p.membership_status} />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  row:         { flexDirection: "row", alignItems: "flex-start", minHeight: 28 } as ViewStyle,
  label:       { width: 110, fontSize: 12, fontWeight: "600", color: KarateColors.ink2, paddingTop: 3 } as TextStyle,
  value:       { flex: 1, fontSize: 13, color: KarateColors.ink, paddingTop: 2 } as TextStyle,
  empty:       { flex: 1, fontSize: 13, color: KarateColors.ink4, paddingTop: 2 } as TextStyle,
  sectionHead: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7, color: KarateColors.ink3, marginTop: 8, marginBottom: 4, textTransform: "uppercase" } as TextStyle,
});

const tabStyles = StyleSheet.create({
  tab:       { padding: 16, gap: 6 } as ViewStyle,
  photoWrap: { alignItems: "center", marginBottom: 8 } as ViewStyle,
  photo:     { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: KarateColors.border2 } as any,
  avatarWrap: { alignItems: "center", marginBottom: 8 } as ViewStyle,
  avatar:   { width: 80, height: 80, borderRadius: 40, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  avatarTxt: { fontFamily: KarateFonts.heading, fontSize: 32, color: KarateColors.primary } as TextStyle,
});

