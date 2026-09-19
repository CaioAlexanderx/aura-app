// ============================================================
// AURA. — abcShared (Fase 1 ABC por categoria, 16/09/2026)
//
// Extraido de AbcCurveCard.tsx pra ser compartilhado por AbcCurveCard
// (visao por produto) e AbcPorCategoria (visao por categoria) sem
// duplicar constante/helper/estilo nem criar import circular entre eles
// (os dois importam daqui; nenhum importa do outro).
//
// Nada aqui mudou de comportamento em relacao ao AbcCurveCard.tsx
// original — e literalmente o mesmo codigo, movido.
// ============================================================
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";

export const ABC_COLORS = ["#10b981", "#fbbf24", "#6b7280"];

export const fmt = (n: number) => {
  if (!isFinite(n)) return "R$ 0,00";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
};
export const fmtK = (n: number) => {
  if (!isFinite(n)) return "R$ 0,00";
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return fmt(n);
};
export const toNum = (v: unknown): number => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") { const n = parseFloat(v); return isFinite(n) ? n : 0; }
  return 0;
};

export const PERIODS = [
  { key: "today",   label: "Hoje" },
  { key: "week",    label: "Semana" },
  { key: "month",   label: "Mês" },
  // 30/05/2026: adicionado "Ano" — pedido da Eryca. Ranking
  // do ano inteiro tipicamente mostra mais classes B/C.
  { key: "year",    label: "Ano" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];
export type Grade = "A" | "B" | "C";
export type ClassFilter = "ALL" | Grade;

export const CLASS_FILTERS: { key: ClassFilter; label: string }[] = [
  { key: "ALL", label: "Todos" },
  { key: "A",   label: "Curva A" },
  { key: "B",   label: "Curva B" },
  { key: "C",   label: "Curva C" },
];

// FIX 06/05/2026: backend retorna `period` como objeto { start, end, label }.
// Helper extrai a label seja qual for o shape (string legacy ou objeto novo).
export function periodLabelOf(p: unknown, fallback: string): string {
  if (p && typeof p === "object" && "label" in (p as any)) {
    return String((p as any).label || fallback);
  }
  if (typeof p === "string" && p) return p;
  return fallback;
}

export function AbcBadge({ abc, size = 22 }: { abc: Grade; size?: number }) {
  const colors = { A: Colors.green, B: Colors.amber, C: Colors.ink3 };
  const bgs = { A: Colors.greenD, B: Colors.amberD, C: "rgba(255,255,255,0.05)" };
  return (
    <View style={[s.badge, { backgroundColor: bgs[abc], width: size, height: size, borderRadius: Math.round(size / 4) }]}>
      <Text style={[s.badgeText, { color: colors[abc], fontSize: Math.round(size * 0.5) }]}>{abc}</Text>
    </View>
  );
}

// CSV genérico (web only). Quem chama monta headers/rows já formatados —
// mantém a função burra e reutilizável entre produto e categoria.
export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a);
  a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type PaginatorProps = {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
};

// Paginador reutilizado pela tabela de produtos e pela de categorias —
// mesmo visual, mesmo comportamento (Anterior/Proxima desabilita nas pontas).
export function Paginator({ page, totalPages, onPageChange }: PaginatorProps) {
  if (totalPages <= 1) return null;
  return (
    <View style={s.paginator}>
      <Pressable
        onPress={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        style={[s.pageBtn, page === 1 && s.pageBtnDisabled]}
      >
        <Text style={[s.pageBtnText, page === 1 && s.pageBtnTextDisabled]}>{"<"} Anterior</Text>
      </Pressable>
      <Text style={s.pageInfo}>Pagina {page} de {totalPages}</Text>
      <Pressable
        onPress={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        style={[s.pageBtn, page === totalPages && s.pageBtnDisabled]}
      >
        <Text style={[s.pageBtnText, page === totalPages && s.pageBtnTextDisabled]}>Proxima {">"}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { alignItems: "center", justifyContent: "center" },
  badgeText: { fontWeight: "800" },

  paginator: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 14, marginTop: 4,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  pageBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9,
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
  },
  pageBtnDisabled: { opacity: 0.35 },
  pageBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  pageBtnTextDisabled: { color: Colors.ink3 },
  pageInfo: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
});
