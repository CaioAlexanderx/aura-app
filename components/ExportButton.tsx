import { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";

type ExportType = 'dre' | 'sales' | 'payroll' | 'prolabore';
type ExportFormat = 'pdf' | 'csv';

type Props = {
  type: ExportType;
  label?: string;
  from?: string;
  to?: string;
  period?: string;
};

export function ExportButton({ type, label, from, to, period }: Props) {
  const { company, token } = useAuthStore();
  const [open, setOpen] = useState(false);
  const isWeb = Platform.OS === 'web';

  // Close on click outside (web)
  useEffect(() => {
    if (!open || !isWeb || typeof document === 'undefined') return;
    function handleClick(e: any) {
      // Close if click is outside the menu
      const target = e.target as HTMLElement;
      if (!target.closest('[data-export-menu]')) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function doExport(format: ExportFormat) {
    if (!isWeb || !company?.id || !token) { toast.error('Erro ao exportar'); return; }
    let url = `${BASE_URL}/companies/${company.id}/export/${type}?format=${format}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    if (period) url += `&period=${period}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error(); return res.blob(); })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const w = window.open(blobUrl, '_blank');
        if (!w) { const a = document.createElement('a'); a.href = blobUrl; a.download = `${type}.${format}`; a.click(); }
        toast.success(`Exportado como ${format.toUpperCase()}`);
      })
      .catch(() => toast.error('Erro ao exportar'));
    setOpen(false);
  }

  return (
    <View style={s.wrap} {...({ 'data-export-menu': true } as any)}>
      <Pressable onPress={() => setOpen(!open)} style={[s.btn, open && s.btnOpen]}>
        <Icon name="file_text" size={14} color={Colors.violet3} />
        <Text style={s.btnText}>{label || 'Exportar'}</Text>
        <Icon name="chevron_down" size={12} color={Colors.ink3} />
      </Pressable>
      {open && (
        <View style={s.menu}>
          <Pressable onPress={() => doExport('pdf')} style={s.menuItem}>
            <Icon name="file_text" size={14} color={Colors.ink} />
            <Text style={s.menuText}>PDF (Relatorio)</Text>
          </Pressable>
          <View style={s.menuDivider} />
          <Pressable onPress={() => doExport('csv')} style={s.menuItem}>
            <Icon name="download" size={14} color={Colors.ink} />
            <Text style={s.menuText}>CSV (Planilha)</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'relative' as any, zIndex: 999 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.bg3, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  btnOpen: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  btnText: { fontSize: 12, color: Colors.violet3, fontWeight: '600' },
  menu: {
    position: 'absolute' as any, top: 42, left: 0, zIndex: 1000, minWidth: 200,
    backgroundColor: Colors.bg2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, padding: 4,
    ...(Platform.OS === 'web' ? { boxShadow: '0 8px 24px rgba(0,0,0,0.4)' } as any : { elevation: 12 }),
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 8 },
  menuText: { fontSize: 13, color: Colors.ink, fontWeight: '500' },
  menuDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 8 },
});

export default ExportButton;
