import { KarateBelts, BeltKey } from "@/constants/karateTheme";
import { Platform, Alert } from "react-native";

// Papéis que podem transferir (federação admin/staff).
const TRANSFER_ROLES = ["federation_admin", "federation_staff"];
export function canTransfer(role: string | null): boolean {
  return role == null || TRANSFER_ROLES.includes(role);
}

// Fix C4: data-sentinela usada pelo backfill para faixas sem data conhecida.
// Pode vir como '1900-01-01' (date) ou '1900-01-01T00:00:00...' (timestamp);
// comparamos pelos 10 primeiros chars (mais robusto que igualdade exata).
export const BELT_DATE_UNKNOWN = "1900-01-01";
export function isUnknownBeltDate(v: string | null | undefined): boolean {
  if (!v) return true;
  return String(v).slice(0, 10) === BELT_DATE_UNKNOWN;
}

// F4.3: máscaras só de EXIBIÇÃO (não alteram o dado salvo). Se o valor não
// tiver dígitos suficientes (dado ruim da planilha), exibe como veio.
export function formatCpfDisplay(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = String(v).replace(/\D/g, "");
  if (d.length !== 11) return String(v); // dado incompleto/estranho: mostra cru
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
// bugfix (telefone sem máscara): formatPhoneDisplay só reconhecia dígitos
// crus com EXATAMENTE 10 ou 11 posições; qualquer outra contagem (ex.: DDI
// "55" residual de import/backfill deixando 12/13 dígitos) caía no fallback
// "mostra como veio" e aparecia sem máscara nenhuma — sintoma reportado ao
// inativar/reeditar praticantes com esse tipo de dado legado. A formatação é
// SEMPRE derivada só dos dígitos (nunca do status do praticante — is_active
// nunca entra nesta função), então o telefone deve aparecer mascarado tanto
// para ativos quanto inativos. Normalizamos o DDI 55 redundante antes de
// aplicar a máscara padrão BR.
export function stripRedundantCountryCode(d: string): string {
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
    const rest = d.slice(2);
    if (rest.length === 10 || rest.length === 11) return rest;
  }
  return d;
}
export function formatPhoneDisplay(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = stripRedundantCountryCode(String(v).replace(/\D/g, ""));
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return String(v); // dado incompleto/fora do padrão BR: mostra como veio
}
export function formatCepDisplay(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = String(v).replace(/\D/g, "");
  if (d.length !== 8) return String(v);
  return d.replace(/(\d{5})(\d{3})/, "$1-$2");
}

// P8: idade em anos completos a partir de "YYYY-MM-DD". Parseamos como data
// local (new Date(year, month-1, day)) para evitar o shift UTC que acontece
// com new Date("YYYY-MM-DD") (ISO string = meia-noite UTC → pode virar dia
// anterior am fusos negativos).
export function ageFromBirthDate(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const birth = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const mm = today.getMonth() - birth.getMonth();
  if (mm < 0 || (mm === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// Confirmação cross-plataforma. Na web o Alert.alert com botões é um no-op
// (o onPress nunca dispara) → usamos window.confirm. Em nativo, Alert.alert.
export function webConfirm(message: string): boolean {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.confirm(message);
  }
  // Em nativo não há confirmação síncrona; assumimos confirmado e deixamos a
  // ação para os fluxos nativos (esta tela é web-first na federação).
  return true;
}
export function webAlert(message: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") window.alert(message);
  else Alert.alert("Aviso", message);
}

// Opções de faixa para a graduação manual (deriva do mapa canônico de cores).
// Exclui faixas legadas (isLegacy: true, ex.: Vermelha) — no sistema novo
// não se gradua PARA essas faixas; elas seguem exibidas normalmente no
// histórico/faixa atual do praticante (ver KarateBelts / resolveBeltKey),
// só ficam fora das OPÇÕES de nova graduação.
export const BELT_OPTIONS: Array<{ key: BeltKey; label: string }> = (Object.keys(KarateBelts) as BeltKey[])
  .filter((k) => !KarateBelts[k].isLegacy)
  .map((k) => ({ key: k, label: KarateBelts[k].label }));

// Graus Dan (Preta): 1º a 10º
export const DAN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Kyu por faixa (FPKT Shotokan): lista de kyus que a faixa pode representar.
// Ex.: Marrom pode ser 3kyu, 2kyu ou 1kyu.
export const BELT_KYUS: Partial<Record<BeltKey, number[]>> = {
  // FPKT Shotokan (de-para): cada faixa = 1 kyu, exceto Marrom (3º/2º/1º).
  branca:      [10],
  amarela:     [9],
  laranja:     [8],
  verde:       [7],
  azul_claro:  [6],
  roxo:        [5],
  azul_escuro: [4],
  marrom:      [3, 2, 1],
};

/** Monta o belt_name legível para uma faixa + grau opcional. */
export function buildBeltName(key: BeltKey, dan?: number, kyu?: number): string {
  const label = KarateBelts[key].label;
  if (key === "preta" && dan) return `${label} ${dan}°`;
  if (kyu) return `${label} ${kyu}°kyu`;
  return label;
}

