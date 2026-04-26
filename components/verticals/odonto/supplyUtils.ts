// AURA. — Supply Utils (GAP-03)
// Constantes e helpers compartilhados pelos componentes de estoque odonto.

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

export function fmt(v?: string | null): string {
  if (!v) return '—';
  try {
    return new Date(v + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch { return '—'; }
}

export function daysTo(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr + 'T12:00:00').getTime() - Date.now()) / 86400000);
}

export function categoryLabel(id: string): string {
  return CATEGORIES.find(c => c.id === id)?.label || id;
}
