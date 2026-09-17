// AURA. — Supply Utils (GAP-03)
// Constantes e helpers compartilhados pelos componentes de estoque odonto.
import { dateOnlyToLocalDate, formatDateOnlyBR } from "@/utils/dateOnly";

export const CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'todos',                 label: 'Todos',         icon: '📦' },
  { id: 'anestesico',           label: 'Anestésicos',   icon: '💉' },
  { id: 'resina',               label: 'Resinas',        icon: '🔵' },
  { id: 'fio',                  label: 'Fios',           icon: '🧵' },
  { id: 'broca',                label: 'Brocas',         icon: '🔩' },
  { id: 'descartavel',          label: 'Descartáveis',  icon: '🧤' },
  { id: 'material_restaurador', label: 'Restauração',    icon: '🦷' },
  { id: 'material_protecao',    label: 'Proteção',       icon: '🛡️' },
  { id: 'rx',                   label: 'Rx/Imagem',      icon: '📷' },
  { id: 'equipamento',          label: 'Equipamentos',  icon: '⚕️' },
  { id: 'outro',                label: 'Outros',         icon: '📋' },
];

export const UNITS = ['un', 'cx', 'fr', 'ml', 'g', 'kg', 'L', 'par', 'rolo'];

// expiry_date e coluna DATE. O truque `v + 'T12:00:00'` dava Invalid Date
// quando a API manda "YYYY-MM-DDT00:00:00.000Z".
export function fmt(v?: string | null): string {
  return formatDateOnlyBR(v, '—');
}

export function daysTo(dateStr?: string | null): number | null {
  const d = dateOnlyToLocalDate(dateStr);
  if (!d) return null;
  d.setHours(12, 0, 0, 0);
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export function categoryLabel(id: string): string {
  return CATEGORIES.find(c => c.id === id)?.label || id;
}
