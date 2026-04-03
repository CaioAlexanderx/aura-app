import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Switch } from "react-native";
import { Colors } from "@/constants/colors";
import { HoverCard } from "@/components/HoverCard";
import { IS_WIDE } from "@/constants/helpers";

// VER-03d: Settings (plans, access codes, integrations)

const PLANS = [
  { key: "essencial", name: "Essencial", price: 89, features: 8 },
  { key: "negocio", name: "Negocio", price: 199, features: 16 },
  { key: "expansao", name: "Expansao", price: 299, features: 22 },
];

const CODES = [
  { code: "AURA2026", type: "trial", plan: "negocio", uses: 3, maxUses: 50, trialDays: 14, active: true },
  { code: "PROMO10", type: "discount", plan: "essencial", uses: 1, maxUses: 20, trialDays: 0, active: true },
  { code: "DENTISTA", type: "trial", plan: "negocio", uses: 0, maxUses: 10, trialDays: 30, active: false },
];

const INTEGRATIONS = [
  { name: "Asaas", status: "pendente", desc: "Gateway de pagamentos (aguardando CNPJ)" },
  { name: "NFE.io", status: "pendente", desc: "Emissao de NF-e/NFS-e" },
  { name: "WhatsApp", status: "pendente", desc: "Business API (conta criada)" },
  { name: "Cora", status: "pendente", desc: "Conta PJ (aguardando CNPJ)" },
  { name: "Sentry", status: "ativo", desc: "Monitoramento de erros" },
  { name: "Railway", status: "ativo", desc: "Backend hosting" },
  { name: "Supabase", status: "ativo", desc: "Banco de dados PostgreSQL" },
  { name: "Cloudflare", status: "ativo", desc: "CDN + DNS + Pages" },
];

export function ConfigAdmin() {
  return (
    <View style={s.container}>
      {/* Plans */}
      <HoverCard style={s.card}>
        <Text style={s.title}>Planos</Text>
        <View style={s.planRow}>
          {PLANS.map(p => (
            <View key={p.key} style={s.planCard}>
              <Text style={s.planName}>{p.name}</Text>
              <Text style={s.planPrice}>R$ {p.price}/mes</Text>
              <Text style={s.planFeatures}>{p.features} features</Text>
            </View>
          ))}
        </View>
        <Text style={s.planHint}>Add-ons: Vertical R$ 69/mes | Usuario extra R$ 19/mes</Text>
      </HoverCard>

      {/* Access Codes */}
      <HoverCard style={s.card}>
        <View style={s.headerRow}>
          <Text style={s.title}>Codigos de acesso</Text>
          <Pressable style={s.addBtn}><Text style={s.addBtnT}>+ Criar codigo</Text></Pressable>
        </View>
        {CODES.map((c, i) => (
          <View key={i} style={s.codeRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.codeName}>{c.code}</Text>
              <Text style={s.codeInfo}>{c.type === "trial" ? c.trialDays + " dias trial" : "Desconto"} | Plano {c.plan} | {c.uses}/{c.maxUses} usos</Text>
            </View>
            <View style={[s.codeBadge, { backgroundColor: c.active ? "rgba(16,185,129,0.12)" : "rgba(156,163,175,0.12)" }]}>
              <Text style={[s.codeBadgeT, { color: c.active ? "#10B981" : "#9CA3AF" }]}>{c.active ? "Ativo" : "Inativo"}</Text>
            </View>
          </View>
        ))}
      </HoverCard>

      {/* Integrations */}
      <HoverCard style={s.card}>
        <Text style={s.title}>Integracoes</Text>
        {INTEGRATIONS.map((ig, i) => (
          <View key={i} style={s.intRow}>
            <View style={[s.intDot, { backgroundColor: ig.status === "ativo" ? "#10B981" : "#F59E0B" }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.intName}>{ig.name}</Text>
              <Text style={s.intDesc}>{ig.desc}</Text>
            </View>
            <View style={[s.intBadge, { backgroundColor: ig.status === "ativo" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)" }]}>
              <Text style={[s.intBadgeT, { color: ig.status === "ativo" ? "#10B981" : "#F59E0B" }]}>{ig.status === "ativo" ? "Ativo" : "Pendente"}</Text>
            </View>
          </View>
        ))}
      </HoverCard>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 16 },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  addBtn: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  planRow: { flexDirection: IS_WIDE ? "row" : "column", gap: 10 },
  planCard: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 12, padding: 16, alignItems: "center", gap: 4, borderWidth: 0.5, borderColor: Colors.border },
  planName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  planPrice: { fontSize: 18, fontWeight: "800", color: Colors.violet3 },
  planFeatures: { fontSize: 11, color: Colors.ink3 },
  planHint: { fontSize: 11, color: Colors.ink3, marginTop: 10 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  codeName: { fontSize: 14, fontWeight: "700", color: Colors.violet3, fontFamily: "monospace" },
  codeInfo: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  codeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  codeBadgeT: { fontSize: 10, fontWeight: "600" },
  intRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  intDot: { width: 8, height: 8, borderRadius: 4 },
  intName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  intDesc: { fontSize: 11, color: Colors.ink3 },
  intBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  intBadgeT: { fontSize: 10, fontWeight: "600" },
});
