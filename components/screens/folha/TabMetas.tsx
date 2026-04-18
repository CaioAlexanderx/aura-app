import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";

var fmt = function(n: number) { return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); };

function currentMonth() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={s.bar}>
      <View style={[s.barFill, { width: Math.min(pct, 100) + "%", backgroundColor: color }]} />
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  var config: Record<string, { label: string; bg: string; color: string }> = {
    achieved: { label: "Atingida", bg: Colors.greenD, color: Colors.green },
    on_track: { label: "No caminho", bg: Colors.violetD, color: Colors.violet3 },
    behind: { label: "Atrasado", bg: Colors.redD, color: Colors.red },
    no_goal: { label: "Sem meta", bg: Colors.bg4, color: Colors.ink3 },
  };
  var c = config[status] || config.no_goal;
  return <View style={[s.badge, { backgroundColor: c.bg }]}><Text style={[s.badgeText, { color: c.color }]}>{c.label}</Text></View>;
}

export function TabMetas() {
  var { company } = useAuthStore();
  var qc = useQueryClient();
  var [month, setMonth] = useState(currentMonth());
  var [showForm, setShowForm] = useState(false);
  var [formEmpId, setFormEmpId] = useState("");
  var [formAmount, setFormAmount] = useState("");
  var [formUnits, setFormUnits] = useState("");

  var { data: trackingData, isLoading } = useQuery({
    queryKey: ["goals-tracking", company?.id, month],
    queryFn: function() { return request("/companies/" + company!.id + "/goals/tracking?month=" + month); },
    enabled: !!company?.id,
    staleTime: 30000,
  });

  var { data: empData } = useQuery({
    queryKey: ["employees", company?.id],
    queryFn: function() { return request("/companies/" + company!.id + "/employees"); },
    enabled: !!company?.id && showForm,
    staleTime: 60000,
  });

  var saveMutation = useMutation({
    mutationFn: function(body: any) { return request("/companies/" + company!.id + "/goals", { method: "POST", body: body }); },
    onSuccess: function() { qc.invalidateQueries({ queryKey: ["goals-tracking", company?.id] }); toast.success("Meta salva!"); setShowForm(false); setFormAmount(""); setFormUnits(""); },
    onError: function(err: any) { toast.error(err?.message || "Erro ao salvar"); },
  });

  var tracking = (trackingData as any) || {};
  var employees = tracking.employees || [];
  var team = tracking.team || {};
  var allEmployees = ((empData as any)?.employees || (empData as any)?.data || []);

  function handleSave() {
    var amt = parseFloat(formAmount.replace(",", "."));
    if (!formEmpId || !amt || amt <= 0) { toast.error("Selecione um vendedor e informe o valor"); return; }
    saveMutation.mutate({ employee_id: formEmpId, reference_month: month, goal_amount: amt, goal_units: parseInt(formUnits) || null });
  }

  function changeMonth(delta: number) {
    var parts = month.split("-"); var y = parseInt(parts[0]); var m = parseInt(parts[1]) + delta;
    if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; }
    setMonth(y + "-" + String(m).padStart(2, "0"));
  }

  var monthLabel = (function() { var p = month.split("-"); var names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]; return names[parseInt(p[1])-1] + "/" + p[0]; })();

  return (
    <View>
      <View style={s.monthNav}>
        <Pressable onPress={function() { changeMonth(-1); }} style={s.monthBtn}><Text style={s.monthBtnText}>{"\u2039"}</Text></Pressable>
        <Text style={s.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={function() { changeMonth(1); }} style={s.monthBtn}><Text style={s.monthBtnText}>{"\u203A"}</Text></Pressable>
        <Pressable onPress={function() { setShowForm(!showForm); }} style={s.addGoalBtn}>
          <Icon name="plus" size={14} color={Colors.violet3} />
          <Text style={s.addGoalText}>Definir meta</Text>
        </Pressable>
      </View>

      {team.total_goal > 0 && (
        <View style={s.teamCard}>
          <Text style={s.teamTitle}>Equipe</Text>
          <View style={s.teamRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.teamValue}>{fmt(team.total_revenue || 0)}</Text>
              <Text style={s.teamSub}>de {fmt(team.total_goal)} ({team.pct || 0}%)</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.teamValue, { color: Colors.green }]}>{fmt(team.total_commission || 0)}</Text>
              <Text style={s.teamSub}>comissao total</Text>
            </View>
          </View>
          <ProgressBar pct={team.pct || 0} color={(team.pct || 0) >= 100 ? Colors.green : (team.pct || 0) >= 75 ? Colors.violet : Colors.amber} />
          <Text style={s.teamDays}>{tracking.days_in_month - tracking.day_of_month} dias restantes</Text>
        </View>
      )}

      {showForm && (
        <View style={s.formCard}>
          <Text style={s.formTitle}>Definir meta para {monthLabel}</Text>
          <Text style={s.formLabel}>Vendedor</Text>
          <View style={s.pickerRow}>
            {allEmployees.map(function(e: any) {
              var active = formEmpId === e.id;
              return <Pressable key={e.id} onPress={function() { setFormEmpId(e.id); }} style={[s.pickerBtn, active && s.pickerBtnActive]}><Text style={[s.pickerText, active && s.pickerTextActive]}>{e.name}</Text></Pressable>;
            })}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.formLabel}>Meta R$</Text>
              <TextInput style={s.formInput} value={formAmount} onChangeText={setFormAmount} placeholder="5000" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.formLabel}>Meta unidades (opc)</Text>
              <TextInput style={s.formInput} value={formUnits} onChangeText={setFormUnits} placeholder="50" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
            </View>
          </View>
          <Pressable onPress={handleSave} disabled={saveMutation.isPending} style={[s.saveBtn, saveMutation.isPending && { opacity: 0.6 }]}>
            {saveMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Salvar meta</Text>}
          </Pressable>
        </View>
      )}

      {isLoading && <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>}

      {!isLoading && employees.length === 0 && (
        <View style={s.empty}><Icon name="target" size={28} color={Colors.ink3} /><Text style={s.emptyText}>Nenhuma meta definida para {monthLabel}</Text><Text style={s.emptyHint}>Defina metas para acompanhar o desempenho da equipe.</Text></View>
      )}

      {employees.map(function(e: any) {
        return (
          <View key={e.employee_id} style={s.empCard}>
            <View style={s.empHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.empName}>{e.employee_name}</Text>
                <Text style={s.empMeta}>Meta: {fmt(e.goal_amount)} {e.goal_units > 0 ? "| " + e.goal_units + " un" : ""}</Text>
              </View>
              <StatusBadge status={e.on_track ? (e.pct_revenue >= 100 ? "achieved" : "on_track") : "behind"} />
            </View>
            <View style={s.empStats}>
              <View style={s.empStat}><Text style={s.empStatValue}>{fmt(e.actual_revenue)}</Text><Text style={s.empStatLabel}>Realizado</Text></View>
              <View style={s.empStat}><Text style={[s.empStatValue, { color: Colors.violet3 }]}>{e.pct_revenue}%</Text><Text style={s.empStatLabel}>Atingimento</Text></View>
              <View style={s.empStat}><Text style={s.empStatValue}>{e.actual_units}</Text><Text style={s.empStatLabel}>Vendas</Text></View>
              <View style={s.empStat}><Text style={[s.empStatValue, { color: Colors.green }]}>{fmt(e.commission_amount || 0)}</Text><Text style={s.empStatLabel}>Comissao</Text></View>
            </View>
            <ProgressBar pct={e.pct_revenue} color={e.pct_revenue >= 100 ? Colors.green : e.pct_revenue >= 75 ? Colors.violet : Colors.amber} />
            <View style={s.empFooter}>
              <Text style={s.empFooterText}>Projecao: {fmt(e.projected_revenue)} | Falta: {fmt(e.remaining)} | Ticket: {fmt(e.ticket_medio)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

var s = StyleSheet.create({
  monthNav: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  monthBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  monthBtnText: { fontSize: 18, color: Colors.ink3, fontWeight: "700" },
  monthLabel: { fontSize: 16, color: Colors.ink, fontWeight: "700", minWidth: 80, textAlign: "center" },
  addGoalBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto", backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border2 },
  addGoalText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  teamCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border2, marginBottom: 16, gap: 10 },
  teamTitle: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  teamRow: { flexDirection: "row", gap: 16 },
  teamValue: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  teamSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  teamDays: { fontSize: 11, color: Colors.ink3, textAlign: "right" },
  bar: { height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  formCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border2, marginBottom: 16, gap: 10 },
  formTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  formLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  formInput: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.ink },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pickerBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  pickerBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  pickerText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  pickerTextActive: { color: Colors.violet3, fontWeight: "600" },
  saveBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  emptyHint: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 280 },
  empCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, gap: 10 },
  empHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  empName: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  empMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  empStats: { flexDirection: "row", gap: 4 },
  empStat: { flex: 1, alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 8, paddingVertical: 8 },
  empStatValue: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  empStatLabel: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 },
  empFooter: { paddingTop: 4 },
  empFooterText: { fontSize: 10, color: Colors.ink3 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
});

export default TabMetas;
