// ============================================================
// Seção "Funções na federação" + "Status" (só no modo edição).
// Extraído de components/karate/PraticanteFichaModal.tsx (refactor puro).
// ============================================================
import React from "react";
import { Form } from "./helpers";
import { SectionTitle, Toggle } from "./shared-styles";

interface PapeisSectionProps {
  form: Form;
  setField: <K extends keyof Form>(k: K, v: Form[K]) => void;
  isEdit: boolean;
}

export function PapeisSection({ form, setField, isEdit }: PapeisSectionProps) {
  return (
    <>
      <SectionTitle>Funções na federação</SectionTitle>
      <Toggle label="Árbitro" hint="Atua em competições" on={form.is_arbiter} onPress={() => setField("is_arbiter", !form.is_arbiter)} />
      <Toggle label="Instrutor" hint="Ministra aulas no dojô" on={form.is_instructor} onPress={() => setField("is_instructor", !form.is_instructor)} />
      <Toggle label="Examinador" hint="Banca de graduação" on={form.is_examiner} onPress={() => setField("is_examiner", !form.is_examiner)} />
      <Toggle label="Auxiliar" hint="Auxilia nas aulas do dojô" on={form.is_assistant} onPress={() => setField("is_assistant", !form.is_assistant)} />

      {/* Status — só na edição (no cadastro o praticante já nasce ativo) */}
      {isEdit && (
        <>
          <SectionTitle>Status</SectionTitle>
          <Toggle
            label={form.is_active ? "Ativo" : "Inativo"}
            hint={form.is_active ? "Aparece como ativo na federação" : "Mantido no histórico, fora da contagem de ativos"}
            on={form.is_active}
            onPress={() => setField("is_active", !form.is_active)}
          />
        </>
      )}
    </>
  );
}
