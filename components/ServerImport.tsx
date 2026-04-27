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

// Simple CSV parser (handles quoted fields, BOM, semicolons)
function parseCSV(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, ''); // remove BOM
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim());

  return lines.slice(1).map(line => {
    const values = line.split(sep).map(v => v.replace(/^"|"$/g, '').trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { if (h) row[h] = values[i] || ''; });
    return row;
  }).filter(row => Object.values(row).some(v => v));
}

// Correct URL paths matching backend importData.js routes
const ROUTE_MAP: Record<string, string> = {
  products: 'products/import',
  customers: 'customers/import',
  transactions: 'transactions/import',
};

export function ServerImport({ entity, onComplete }: Props) {
  const { company, token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const isWeb = Platform.OS === 'web';

  const labels: Record<string, string> = {
    products: 'Importar produtos (CSV)',
    customers: 'Importar clientes (CSV)',
    transactions: 'Importar lancamentos (CSV)',
  };

  async function handleImport() {
    // FIX(9): erros explicitos em vez de retorno silencioso
    if (!isWeb) {
      toast.error("Importacao via CSV disponivel apenas no navegador (web)");
      return;
    }
    if (!company?.id) {
      toast.error("Sua conta nao esta associada a uma empresa. Contate o administrador.");
      return;
    }
    if (!token) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.txt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error('Arquivo muito grande (max 5MB)'); return; }

      setLoading(true);
      try {
        // Read file as text and parse CSV client-side
        const text = await file.text();
        const rows = parseCSV(text);

        if (rows.length === 0) {
          toast.error('Arquivo vazio ou formato invalido. Use CSV com cabecalho.');
          return;
        }

        // Send parsed rows as JSON to backend
        const route = ROUTE_MAP[entity] || `${entity}/import`;
        const res = await fetch(`${BASE_URL}/companies/${company.id}/${route}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rows }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erro ${res.status}`);
        }

        const data = await res.json();
        const imported = data.saved || data.imported || data.created || 0;
        const skipped = data.duplicates_skipped || 0;
        const errorCount = data.error_count || 0;
        toast.success(`${imported} importados${skipped > 0 ? `, ${skipped} duplicados` : ''}${errorCount > 0 ? `, ${errorCount} com erro` : ''}`);
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
