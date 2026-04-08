import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Customer } from "./types";
import { fmt, getStatus } from "./types";

function Tag({ tag }: { tag: string }) {
  const m: Record<string, { b: string; f: string }> = {
    VIP: { b: Colors.violetD, f: Colors.violet3 }, Frequente: { b: Colors.greenD, f: Colors.green },
    Novo: { b: Colors.amberD, f: Colors.amber }, Inativo: { b: Colors.redD, f: Colors.red },
  };
  const c = m[tag] || { b: Colors.bg4, f: Colors.ink3 };
  return <View style={{ borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: c.b }}><Text style={{ fontSize: 9, fontWeight: "600", color: c.f, letterSpacing: 0.3 }}>{tag}</Text></View>;
}

function Stars({ r }: { r: number | null }) {
  if (r == null) return <Text style={{ fontSize: 10, color: Colors.ink3 }}>Sem avaliacao</Text>;
  return <View style={{ flexDirection: "row", gap: 2 }}>{[1, 2, 3, 4, 5].map(i => <Text key={i} style={{ fontSize: 12, color: i <= r ? Colors.amber : Colors.ink3 }}>*</Text>)}</View>;
}

export function CustomerRow({ c, expanded, onToggle, onDelete }: { c: Customer; expanded: boolean; onToggle: () => void; onDelete?: (id: string) => void }) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  const tags = getStatus(c);

  return (
    <View>
      <Pressable onPress={onToggle} onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
        style={[s.row, h && { backgroundColor: Colors.bg4 }, w && { transition: "background-color 0.15s ease" } as any]}>
        <View style={s.left}>
          <View style={s.avatar}><Text style={s.avatarText}>{c.name.charAt(0)}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.name}>{c.name}</Text><Text style={s.meta}>{c.phone}{c.instagram ? " / " + c.instagram : ""}</Text></View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={s.spent}>{fmt(c.totalSpent)}</Text>
          <View style={{ flexDirection: "row", gap: 4 }}>{tags.slice(0, 2).map(t => <Tag key={t} tag={t} />)}</View>
        </View>
      </Pressable>
      {expanded && (
        <View style={s.detail}>
          <View style={s.detailGrid}>
            {[["E-mail", c.email], ["Telefone", c.phone], ["Aniversario", c.birthday], ["Instagram", c.instagram || "---"], ["Primeira visita", c.firstVisit], ["Ultima compra", c.lastPurchase], ["Total gasto", fmt(c.totalSpent)], ["Visitas", String(c.visits)]].map(([l, v]) =>
              <View key={l} style={s.detailItem}><Text style={s.detailLabel}>{l}</Text><Text style={[s.detailValue, l === "Total gasto" && { color: Colors.green }, l === "Instagram" && { color: Colors.violet3 }]}>{v}</Text></View>
            )}
            <View style={s.detailItem}><Text style={s.detailLabel}>Avaliacao</Text><Stars r={c.rating} /></View>
          </View>
          {c.notes ? <Text style={s.notes}>{c.notes}</Text> : null}
          <View style={s.detailTags}><Text style={s.detailTagsLabel}>Status</Text><View style={{ flexDirection: "row", gap: 6 }}>{tags.map(t => <Tag key={t} tag={t} />)}</View></View>
          <View style={s.actions}>
            {["Enviar WhatsApp", "Pedir avaliacao", "Ver historico"].map(a =>
              <Pressable key={a} style={s.actionBtn}><Text style={s.actionText}>{a}</Text></Pressable>
            )}
            {onDelete && <Pressable onPress={() => onDelete(c.id)} style={s.deleteBtn}><Text style={s.deleteText}>Excluir cliente</Text></Pressable>}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  avatarText: { fontSize: 14, fontWeight: "700", color: Colors.violet3 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  meta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  spent: { fontSize: 13, color: Colors.green, fontWeight: "700" },
  detail: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 16, marginHorizontal: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  detailItem: { width: "30%", minWidth: 100, paddingVertical: 6, gap: 3 },
  detailLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  notes: { fontSize: 11, color: Colors.ink3, fontStyle: "italic", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  detailTags: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, gap: 6 },
  detailTagsLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, flexWrap: "wrap" },
  actionBtn: { backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  actionText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  deleteBtn: { backgroundColor: Colors.redD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.red + "33" },
  deleteText: { fontSize: 11, color: Colors.red, fontWeight: "600" },
});

export default CustomerRow;
