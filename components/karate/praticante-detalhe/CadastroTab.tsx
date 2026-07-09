import React from "react";
import {
  View, Text,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { PractitionerDetail } from "@/services/karateApi";
import { formatIsoToBr } from "@/components/inputs/DateInput";
import { formatEventDateNumeric } from "@/utils/eventDate";
import { formatCpfDisplay, formatPhoneDisplay, formatCepDisplay, ageFromBirthDate } from "./helpers";

// c5: "há X" a partir de uma data ISO — usado SÓ para o cálculo de diferença
// de tempo (nunca para formatar a data exibida ao usuário, que vem sempre de
// formatEventDateNumeric). Regra: <1 mês → dias; <24 meses → meses; senão anos.
function timeAgoLabel(iso: string): string | null {
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const then = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(then.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 30) {
    return `há ${diffDays} dia${diffDays === 1 ? "" : "s"}`;
  }
  const diffMonths =
    (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
  if (diffMonths < 24) {
    return `há ${diffMonths} ${diffMonths === 1 ? "mês" : "meses"}`;
  }
  const diffYears = Math.floor(diffMonths / 12);
  return `há ${diffYears} ano${diffYears === 1 ? "" : "s"}`;
}

interface Props {
  practitioner: PractitionerDetail;
}

// F4.1: rotulo sempre visível; valor ausente renderiza um travessão neutro ("—").
// Alinhamento: label fixo 110px, valor ao lado, ambos na mesma linha.
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={fieldStyles.row}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Text style={value ? fieldStyles.value : fieldStyles.empty} numberOfLines={2}>
        {value || "—"}
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
      {/* Foto movida para o avatar do cabeçalho da ficha (ao lado do nome). */}
      <SectionHeader title="DADOS PESSOAIS" />
      <Field label="Nome completo" value={p.full_name} />
      <Field label="CPF" value={formatCpfDisplay(p.cpf)} />
      <Field label="RG" value={p.rg} />
      <Field
        label="Nascimento"
        value={
          p.birth_date
            ? `${formatIsoToBr(p.birth_date)}${age !== null ? ` (${age} anos)` : ""}`
            : null
        }
      />
      <Field label="Sexo" value={p.sex === "masculino" ? "Masculino" : p.sex === "feminino" ? "Feminino" : p.sex === "outro" ? "Outro" : null} />
      <Field label="E-mail" value={p.email} />
      <Field label="Telefone" value={formatPhoneDisplay(p.phone)} />

      {/* Endereço — F4.4: mostra quando pelo menos 1 campo está preenchido.
          Endereço completo compõe logradouro + número + complemento
          (praticante cadastrado sem número aparecia "incompleto" na exibição
          apesar de o dado estar salvo — bug reportado). */}
      {[p.street, p.number, p.complement, p.neighborhood, p.city, p.state, p.zip_code].some(Boolean) && (
        <>
          <SectionHeader title="ENDEREÇO" />
          <Field label="CEP" value={formatCepDisplay(p.zip_code)} />
          <Field
            label="Endereço"
            value={
              p.street
                ? `${p.street}${p.number ? `, ${p.number}` : ""}`
                : (p.number ? `Nº ${p.number}` : null)
            }
          />
          <Field label="Complemento" value={p.complement} />
          <Field label="Bairro" value={p.neighborhood} />
          <Field
            label="Município"
            value={[p.city, p.state].filter(Boolean).join(" / ") || null}
          />
        </>
      )}

      {needsGuardian && (
        <>
          <SectionHeader title="RESPONSÁVEL LEGAL" />
          <Field label="Nome" value={p.guardian_name} />
          <Field label="Telefone" value={formatPhoneDisplay(p.guardian_phone)} />
          <Field label="CPF" value={formatCpfDisplay(p.guardian_cpf)} />
          <Field label="Parentesco" value={p.guardian_relationship ? p.guardian_relationship.charAt(0).toUpperCase() + p.guardian_relationship.slice(1) : null} />
        </>
      )}

      <SectionHeader title="FUNÇÕES" />
      <Field
        label="Funções"
        value={
          [
            p.is_arbiter ? "Árbitro" : null,
            p.is_instructor ? "Instrutor" : null,
            p.is_examiner ? "Examinador" : null,
            p.is_assistant ? "Auxiliar" : null,
          ]
            .filter(Boolean)
            .join(" · ") || null
        }
      />

      <SectionHeader title="ATIVIDADE" />
      <Field label="Filiado em" value={p.affiliation_since ? formatIsoToBr(p.affiliation_since) : null} />
      <Field label="Dojô" value={p.dojo_name} />
      {p.last_exam?.date ? (
        <Field
          label="Último exame"
          value={`${formatEventDateNumeric(p.last_exam.date)}${
            timeAgoLabel(p.last_exam.date) ? ` (${timeAgoLabel(p.last_exam.date)})` : ""
          }`}
        />
      ) : null}
      <Field label="Cursos (2 anos)" value={String(p.course_count_2y ?? 0)} />
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
});

