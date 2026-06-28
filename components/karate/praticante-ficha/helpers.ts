// ============================================================
// Helpers e tipos compartilhados entre as seções da ficha do praticante.
// Extraído de components/karate/PraticanteFichaModal.tsx (refactor puro).
// ============================================================

export const GUARDIAN_RELATIONSHIPS = [
  "pai", "mãe", "avó/avô", "tio/tia", "responsável legal", "outro",
] as const;
export type GuardianRelationship = typeof GUARDIAN_RELATIONSHIPS[number];

export const EMPTY = {
  full_name: "", cpf: "", rg: "", birth_date: "", email: "", phone: "",
  dojo_id: "", dojo_name: "",
  zip_code: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  is_arbiter: false, is_instructor: false, is_examiner: false,
  is_active: true,
  // P6
  photo_url: "",
  // P7
  guardian_name: "", guardian_cpf: "", guardian_phone: "", guardian_relationship: "" as GuardianRelationship | "",
};
export type Form = typeof EMPTY;

// Snapshot dos campos compartilháveis entre cadastros (dojô + endereço).
export type SharedSnapshot = {
  dojo_id: string; dojo_name: string;
  zip_code: string; street: string; number: string; complement: string;
  neighborhood: string; city: string; state: string;
};

// ── máscaras BR ──────────────────────────────────────────────
export const onlyD = (v: string) => (v || "").replace(/\D/g, "");

export function maskCEP(v: string) {
  const d = onlyD(v).slice(0, 8);
  return d.length > 5 ? d.replace(/(\d{5})(\d+)/, "$1-$2") : d;
}

export function maskDate(v: string) {
  const d = onlyD(v).slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "$1/$2");
  return d;
}

export function cpfValido(c: string) {
  c = onlyD(c);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += +c[i] * (10 - i);
  let d = 11 - (s % 11); if (d >= 10) d = 0; if (d !== +c[9]) return false;
  s = 0; for (let i = 0; i < 10; i++) s += +c[i] * (11 - i);
  d = 11 - (s % 11); if (d >= 10) d = 0; return d === +c[10];
}

// P7: calcula idade a partir de dd/mm/aaaa (parse LOCAL, sem UTC shift)
export function ageFromBrDate(brDate: string): number | null {
  const d = onlyD(brDate);
  if (d.length !== 8) return null;
  const day = parseInt(d.slice(0, 2), 10);
  const month = parseInt(d.slice(2, 4), 10);
  const year = parseInt(d.slice(4, 8), 10);
  const born = new Date(year, month - 1, day);
  if (isNaN(born.getTime())) return null;
  if (born.getDate() !== day || born.getMonth() !== month - 1 || born.getFullYear() !== year) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
  return age;
}

// idade a partir do ISO validado (YYYY-MM-DD) — para exibição no campo nascimento
export function ageFromISO(iso: string | null): number | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(d.getTime())) return null;
  const t = new Date(); let a = t.getFullYear() - d.getFullYear();
  const mm = t.getMonth() - d.getMonth();
  if (mm < 0 || (mm === 0 && t.getDate() < d.getDate())) a--;
  return a;
}

// API (YYYY-MM-DD ou ISO) → dd/mm/aaaa
export function fromISO(v: string | null | undefined): string {
  if (!v) return "";
  const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
