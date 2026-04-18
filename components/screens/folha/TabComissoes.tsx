import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Switch, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";

var fmt = function(n: number) { return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); };

function currentMonth() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }

export function TabComissoes() {
  var { company } = useAuthStore();
  var qc = useQueryClient();
  var [month, setMonth] = useState(currentMonth());

  var { data: summaryData, isLoading } = useQuery({
    queryKey: ["commission-summary", company?.id, month],
    queryFn: function() { return request("/companies/" + company!.id + "/employees/commission/summary?month=" + month); },
    enabled: !!company?.id,
    staleTime: 30000,
  });

  var patchMutation = useMutation({
    mutationFn: function(body: { empId: string; commission_enabled?: boolean; commission_rate?: number }) {
      return request("/companies/" + company!.id + "/employees/" + body.empId + "/commission", {
        method: "PATCH", body: { commission_enabled: body.commission_enabled, commission_rate: body.commission_rate },
      });
    },
    onSuccess: function() { qc.invalidateQueries({ queryKey: ["commission-summary", company?.id] }); qc.invalidateQueries({ queryKey: ["employees", company?.id] }); },
    onError: function(err: any) { toast.error(err?.message || "Erro"); },
  });

  var summary = (summaryData as any) || {};
  var employees = summary.employees || [];
  var totals = summary.totals || {};

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
      </View>

      {totals.commission_total > 0 && (
        <View style={s.totalCard}>
          <View style={s.totalRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.totalLabel}>COMISSAO TOTAL</Text>
              <Text style={[s.totalValue, { color: Colors.green }]}>{fmt(totals.commission_total)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.totalLabel}>VENDEDORES ATIVOS</Text>
              <Text style={s.totalValue}>{totals.employees_with_commission}/{totals.employees_total}</Text>
            </View>
          </View>
        </View>
      )}

      {isLoading && <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>}

      {!isLoading && employees.length === 0 && (
        <View style={s.empty}><Icon name="dollar" size={28} color={Colors.ink3} /><Text style={s.emptyText}>Nenhum funcionario cadastrado</Text></View>
      )}

      {employees.map(function(e: any) {
        var commEnabled = e.commission_enabled || false;
        var rate = parseFloat(e.commission_rate) || 0;
        var revenue = parseFloat(e.total_revenue) || 0;
        var sales = parseInt(e.total_sales) || 0;
        var commAmount = parseFloat(e.commission_amount) || 0;

        return (
          <View key={e.employee_id} style={s.empCard}>
            <View style={s.empHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.empName}>{e.employee_name}</Text>
                <Text style={s.empRole}>{e.role || "Vendedor"}</Text>
              </View>
              <Switch
                value={commEnabled}
                onValueChange={function(v) { patchMutation.mutate({ empId: e.employee_id, commission_enabled: v }); }}
                trackColor={{ true: Colors.green, false: Colors.bg4 }}
                thumbColor="#fff"
              />
            </View>

            {commEnabled && (
              <View>
                <View style={s.rateRow}>
                  <Text style={s.rateLabel}>Taxa de comissao</Text>
                  <View style={s.rateInputRow}>
                    <TextInput
                      style={s.rateInput}
                      value={String(rate)}
                      onChangeText={function(v) {
                        var n = parseFloat(v.replace(",", "."));
                        if (!isNaN(n) && n >= 0 && n <= 100) {
                          patchMutation.mutate({ empId: e.employee_id, commission_rate: n });
                        }
                      }}
                      keyboardType="decimal-pad"
                      maxLength={5}
                    />
                    <Text style={s.ratePercent}>%</Text>
                  </View>
                </View>

                <View style={s.empStats}>
                  <View style={s.empStat}>
                    <Text style={s.empStatValue}>{sales}</Text>
                    <Text style={s.empStatLabel}>Vendas</Text>
                  </View>
                  <View style={s.empStat}>
                    <Text style={s.empStatValue}>{fmt(revenue)}</Text>
                    <Text style={s.empStatLabel}>Faturamento</Text>
                  </View>
                  <View style={[s.empStat, { backgroundColor: Colors.greenD }]}>
                    <Text style={[s.empStatValue, { color: Colors.green }]}>{fmt(commAmount)}</Text>
                    <Text style={s.empStatLabel}>Comissao</Text>
                  </View>
                </View>
              </View>
            )}

            {!commEnabled && (
              <Text style={s.disabledHint}>Comissao desativada para este vendedor</Text>
            )}
          </View>
        );
      })}

      <View style={s.infoCard}>
        <Icon name="info" size={12} color={Colors.violet3} />
        <Text style={s.infoText}>Comissoes calculadas sobre vendas confirmadas no periodo. Ative o toggle e defina a taxa % para cada vendedor.</Text>
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  monthNav: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  monthBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  monthBtnText: { fontSize: 18, color: Colors.ink3, fontWeight: "700" },
  monthLabel: { fontSize: 16, color: Colors.ink, fontWeight: "700", minWidth: 80, textAlign: "center" },
  totalCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border2, marginBottom: 16 },
  totalRow: { flexDirection: "row", gap: 16 },
  totalLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  totalValue: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  empCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, gap: 10 },
  empHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  empName: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  empRole: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  rateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rateLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  rateInputRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  rateInput: { width: 60, backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: Colors.ink, textAlign: "center", fontWeight: "700" },
  ratePercent: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  empStats: { flexDirection: "row", gap: 6 },
  empStat: { flex: 1, alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 8, paddingVertical: 8 },
  empStatValue: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  empStatLabel: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 },
  disabledHint: { fontSize: 11, color: Colors.ink3, fontStyle: "italic" },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.border2, marginTop: 8 },
  infoText: { fontSize: 11, color: Colors.ink3, flex: 1, lineHeight: 16 },
});

export default TabComissoes;
