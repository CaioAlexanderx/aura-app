import { useAuthStore } from "@/stores/auth";

// ============================================================
// useDentalPersona — detecta a persona dental do usuario logado
// usando company.member_role como fonte de verdade.
//
// Decisao 2026-04-26 (memory: plano_aura_odonto_portal):
// - Persona FIXA por usuario, sem toggle. Admin define o role no
//   momento do convite (Gestao Aura > Membros > role_label).
// - Owners do tenant viram Gestor por padrao.
// - Roles desconhecidas (ou ausentes) caem em Dentista — visao
//   padrao mais segura para clinico que opera direto no app.
//
// Mapping aceita sinonimos comuns (sem acentos, lower-case) pra
// evitar bug por causa de role digitada diferente no convite.
// ============================================================

export type DentalPersona = "dentista" | "recepcao" | "gestor";

const PERSONA_LABELS: Record<DentalPersona, string> = {
  dentista: "Dentista",
  recepcao: "Recepcao",
  gestor:   "Gestor",
};

function normalizeRole(role: string | null | undefined): string {
  if (!role) return "";
  return String(role)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

export function detectDentalPersona(memberRole: string | null | undefined): DentalPersona {
  const r = normalizeRole(memberRole);

  // Owners do tenant sao Gestores por padrao.
  if (!r || r === "owner" || r === "proprietario" || r === "dono") return "gestor";

  if (r === "gestor" || r === "admin" || r === "manager" || r === "diretor" || r === "socio") {
    return "gestor";
  }
  if (r === "recepcao" || r === "secretaria" || r === "atendente" || r === "recepcionista") {
    return "recepcao";
  }
  if (r === "dentista" || r === "cd" || r === "cirurgiaodentista" || r === "clinico" || r === "odontologo") {
    return "dentista";
  }

  return "dentista";
}

export function useDentalPersona(): DentalPersona {
  const { company } = useAuthStore();
  const memberRole = (company as any)?.member_role;
  return detectDentalPersona(memberRole);
}

export function dentalPersonaLabel(persona: DentalPersona): string {
  return PERSONA_LABELS[persona];
}
