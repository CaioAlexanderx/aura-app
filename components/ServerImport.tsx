import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";

type Props = {
  entity: 'products' | 'customers' | 'transactions';
  onComplete?: (result: { imported: number; skipped: number; errors: string[] }) => void;
};

export function ServerImport({ entity, onComplete }: Props) {
  const { company, token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const isWeb = Platform.OS === 'web';

  const labels: Record<string, string> = {
    products: 'Importar produtos (CSV/Excel)',
    customers: 'Importar clientes (CSV/Excel)',
    transactions: 'Importar lancamentos (OFX/CSV)',
  };

  async function handleImport() {
    if (!isWeb || !company?.id || !token) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = entity === 'transactions' ? '.csv,.ofx,.xlsx,.xls' : '.csv,.xlsx,.xls';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${BASE_URL}/companies/${company.id}/import/${entity}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erro ${res.status}`);
        }

        const data = await res.json();
        const imported = data.imported || data.created || 0;
        const skipped = data.skipped || data.errors?.length || 0;
        toast.success(`${imported} registros importados${skipped > 0 ? ` (${skipped} ignorados)` : ''}`);
        onComplete?.({ imported, skipped, errors: data.errors || [] });
      } catch (err: any) {
        toast.error(err?.message || 'Erro ao importar arquivo');
      } finally { setLoading(false); }
    };
    input.click();
  }

  return (
    <Pressable onPress={handleImport} disabled={loading} style={[s.btn, loading && { opacity: 0.6 }]}>
      {loading ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Icon name="file_text" size={14} color={Colors.violet3} />}
      <Text style={s.text}>{loading ? 'Importando...' : labels[entity] || 'Importar'}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.bg3, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  text: { fontSize: 12, color: Colors.violet3, fontWeight: '600' },
});

export default ServerImport;
