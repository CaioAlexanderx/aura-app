// RegistrationLotsManager — editor de lotes de inscrição do evento (Fase 2).
// Cada lote tem preço de filiado e de não-filiado + data de virada (ends_at).
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Switch } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { lotApi, RegistrationLot } from "@/services/karateApi";

function onlyMoney(v: string): string { return v.replace(/[^0-9,.]/g, "").replace(",", "."); }
function maskDate(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + "/" + d.slice(2);
  return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
}
function brDateToIso(v: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) return null;
  return m[3] + "-" + m[2] + "-" + m[1] + "T23:59:59-03:00";
}
function isoToBrDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return dd + "/" + mm + "/" + d.getFullYear();
}
function fmtBRL(n: number): string { return "R$ " + Number(n || 0).toFixed(2).replace(".", ","); }

type FormState = { id: string | null; name: string; priceMember: string; priceNonmember: string; endsBr: string; active: boolean };
const EMPTY: FormState = { id: null, name: "", priceMember: "", priceNonmember: "", endsBr: "", active: true };

export function RegistrationLotsManager({ federationId, eventId }: { federationId: string; eventId: string }) {
  const [lots, setLots] = useState<RegistrationLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await lotApi.listLots(federationId, eventId);
      setLots(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao carregar lotes");
    } finally { setLoading(false); }
  }, [federationId, eventId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setError(null); setForm({ ...EMPTY, name: "Lote " + (lots.length + 1) }); };
  const openEdit = (l: RegistrationLot) => {
    setError(null);
    setForm({
      id: l.id, name: l.name,
      priceMember: String(l.price_member ?? ""), priceNonmember: String(l.price_nonmember ?? ""),
      endsBr: isoToBrDate(l.ends_at), active: l.active,
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { setError("Dê um nome ao lote."); return; }
    if (form.endsBr && !brDateToIso(form.endsBr)) { setError("Data de virada inválida (use dd/mm/aaaa)."); return; }
    setSaving(true); setError(null);
    const body = {
      name: form.name.trim(),
      price_member: form.priceMember ? parseFloat(onlyMoney(form.priceMember)) : 0,
      price_nonmember: form.priceNonmember ? parseFloat(onlyMoney(form.priceNonmember)) : 0,
      ends_at: form.endsBr ? brDateToIso(form.endsBr) : null,
      active: form.active,
    };
    try {
      if (form.id) await lotApi.updateLot(federationId, eventId, form.id, body);
      else await lotApi.createLot(federationId, eventId, { ...body, sort_order: lots.length });
      setForm(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível salvar o lote.");
    } finally { setSaving(false); }
  };

  const remove = async (l: RegistrationLot) => {
    try { await lotApi.deleteLot(federationId, eventId, l.id); await load(); }
    catch (e: any) { setError(e?.message ?? "Erro ao remover lote."); }
  };

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Lotes de inscrição</Text>
          <Text style={s.sub}>Preço de filiado e de não-filiado por lote. O lote vigente é escolhido pela data de virada.</Text>
        </View>
        {!form ? <KarateButton label="Adicionar lote" variant="ghost" size="sm" onPress={openNew} /> : null}
      </View>

      {error ? (
        <View style={s.errBanner}><Icon name="alert_circle" size={14} color={P.red} /><Text style={s.errTxt}>{error}</Text></View>
      ) : null}

      {loading ? (
        <View style={{ paddingVertical: 20, alignItems: "center" }}><ActivityIndicator color={P.primary} /></View>
      ) : (
        <>
          {lots.length === 0 && !form ? (
            <Text style={s.empty}>Nenhum lote ainda. Sem lotes, vale a taxa única do evento.</Text>
          ) : null}

          {lots.map((l) => {
            const expired = !!l.ends_at && new Date(l.ends_at).getTime() < Date.now();
            return (
              <View key={l.id} style={[s.row, !l.active && s.rowOff]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.rowTop}>
                    <Text style={s.lotName}>{l.name}</Text>
                    {!l.active ? <Text style={s.tagOff}>inativo</Text> : expired ? <Text style={s.tagExp}>encerrado</Text> : null}
                    {l.ends_at ? <Text style={s.lotDate}>até {isoToBrDate(l.ends_at)}</Text> : null}
                  </View>
                  <Text style={s.lotPrices}>Filiado {fmtBRL(l.price_member)}  ·  Não-filiado {fmtBRL(l.price_nonmember)}</Text>
                </View>
                <TouchableOpacity onPress={() => openEdit(l)} style={s.iconBtn} hitSlop={8}><Icon name="edit" size={16} color={P.ink3} /></TouchableOpacity>
                <TouchableOpacity onPress={() => remove(l)} style={s.iconBtn} hitSlop={8}><Icon name="trash" size={16} color={P.red} /></TouchableOpacity>
              </View>
            );
          })}

          {form ? (
            <View style={s.form}>
              <Text style={s.formLabel}>Nome do lote</Text>
              <TextInput style={s.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Ex.: Lote 1" placeholderTextColor={P.ink4} />
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Preço filiado</Text>
                  <TextInput style={s.input} value={form.priceMember} onChangeText={(v) => setForm({ ...form, priceMember: onlyMoney(v) })} keyboardType="numeric" placeholder="0,00" placeholderTextColor={P.ink4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Preço não-filiado</Text>
                  <TextInput style={s.input} value={form.priceNonmember} onChangeText={(v) => setForm({ ...form, priceNonmember: onlyMoney(v) })} keyboardType="numeric" placeholder="0,00" placeholderTextColor={P.ink4} />
                </View>
              </View>
              <Text style={s.formLabel}>Virada do lote (opcional)</Text>
              <TextInput style={s.input} value={form.endsBr} onChangeText={(v) => setForm({ ...form, endsBr: maskDate(v) })} keyboardType="numeric" maxLength={10} placeholder="dd/mm/aaaa" placeholderTextColor={P.ink4} />
              <View style={s.toggleRow}>
                <Text style={s.formLabel}>Ativo</Text>
                <Switch value={form.active} onValueChange={(v) => setForm({ ...form, active: v })} trackColor={{ false: P.border, true: P.primary }} thumbColor={P.bg} />
              </View>
              <View style={s.formActions}>
                <KarateButton label="Cancelar" variant="ghost" size="md" onPress={() => setForm(null)} style={{ flex: 1 }} disabled={saving} />
                <KarateButton label={saving ? "Salvando..." : "Salvar lote"} variant="primary" size="md" loading={saving} onPress={save} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.lg, backgroundColor: P.glass, padding: 16, marginTop: 12 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { fontFamily: KarateFonts.heading, fontSize: 16, color: P.ink },
  sub: { fontSize: 12, color: P.ink3, marginTop: 3, lineHeight: 16 },
  empty: { fontSize: 13, color: P.ink3, marginTop: 12 },
  errBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.dangerSoft, borderRadius: 8, padding: 10, marginTop: 10 },
  errTxt: { color: P.red, fontSize: 12.5, flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, borderTopWidth: 1, borderTopColor: P.border, marginTop: 10 },
  rowOff: { opacity: 0.55 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  lotName: { fontSize: 14, fontWeight: "700", color: P.ink },
  lotDate: { fontSize: 11, color: P.ink3 },
  tagOff: { fontSize: 10, color: P.ink3, textTransform: "uppercase", letterSpacing: 0.4 },
  tagExp: { fontSize: 10, color: P.warn, textTransform: "uppercase", letterSpacing: 0.4 },
  lotPrices: { fontSize: 12.5, color: P.ink2, marginTop: 3 },
  iconBtn: { padding: 6, borderRadius: 8 },
  form: { marginTop: 14, borderTopWidth: 1, borderTopColor: P.border, paddingTop: 14, gap: 8 },
  formLabel: { fontSize: 11.5, color: P.ink3, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: P.ink, backgroundColor: P.bg },
  row2: { flexDirection: "row", gap: 12 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  formActions: { flexDirection: "row", gap: 10, marginTop: 8 },
});

export default RegistrationLotsManager;
