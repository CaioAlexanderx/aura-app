import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Employee, PayslipType } from "./types";
import { STATUS_MAP, fmt, calcPayroll, calcINSS, calcFerias, calc13 } from "./types";

type CoInfo = { name: string; cnpj?: string; logo?: string; address?: string };

const PAYSLIP_TYPES: { key: PayslipType; label: string }[] = [
  { key: "mensal", label: "Mensal" },
  { key: "ferias", label: "Ferias" },
  { key: "decimo_terceiro", label: "13o Salario" },
];

export function Payslip({ emp, onBack }: { emp: Employee; onBack: () => void }) {
  const { company } = useAuthStore();
  const [showSend, setShowSend] = useState(false);
  const [payslipType, setPayslipType] = useState<PayslipType>("mensal");

  const coInfo: CoInfo = {
    name: company?.name || "Minha Empresa",
    cnpj: (company as any)?.cnpj,
    logo: (company as any)?.logo,
    address: (company as any)?.address,
  };

  // Calculate based on type
  const mensal = calcPayroll(emp);
  const ferias = calcFerias(emp);
  const decimo = calc13(emp);

  function handleSend(via: string) { toast.success(`Holerite enviado via ${via} para ${emp.name}`); setShowSend(false); }

  return (
    <View>
      <Pressable onPress={onBack} style={{ marginBottom: 16 }}><Text style={{ fontSize: 13, color: Colors.violet3, fontWeight: "600" }}>{'<'} Voltar</Text></Pressable>
      <View style={s.card}>
        <View style={s.hdr}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Holerite - {emp.name}</Text>
            <Text style={s.sub}>{emp.role} / {STATUS_MAP[emp.status]?.l || emp.status} / {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text>
          </View>
          <Pressable onPress={() => setShowSend(!showSend)} style={s.sendBtn}><Text style={s.sendText}>Enviar</Text></Pressable>
        </View>

        {showSend && (
          <View style={s.sendOptions}>
            <Pressable onPress={() => handleSend("WhatsApp")} style={[s.sendOpt, { backgroundColor: "#075e54" }]}><Text style={s.sendOptText}>WhatsApp</Text></Pressable>
            <Pressable onPress={() => handleSend("E-mail")} style={[s.sendOpt, { backgroundColor: Colors.violet }]}><Text style={s.sendOptText}>E-mail</Text></Pressable>
          </View>
        )}

        {/* Type selector */}
        <View style={s.typeRow}>
          {PAYSLIP_TYPES.map(t => (
            <Pressable key={t.key} onPress={() => setPayslipType(t.key)} style={[s.typeBtn, payslipType === t.key && s.typeBtnActive]}>
              <Text style={[s.typeText, payslipType === t.key && s.typeTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* MENSAL */}
        {payslipType === "mensal" && (
          <>
            <View style={s.sec}><Text style={s.secT}>Proventos</Text>
              <View style={s.row}><Text style={s.rl}>Salario base</Text><Text style={[s.rv, { color: Colors.green }]}>{fmt(emp.salary)}</Text></View>
              <View style={[s.row, s.totalRow]}><Text style={[s.rl, s.bold]}>Total proventos</Text><Text style={[s.rv, s.bold]}>{fmt(emp.salary)}</Text></View>
            </View>
            <View style={s.sec}><Text style={s.secT}>Descontos</Text>
              <View style={s.row}><Text style={s.rl}>INSS ({(calcINSS(emp.salary)/emp.salary*100).toFixed(1)}%)</Text><Text style={[s.rv, { color: Colors.red }]}>-{fmt(mensal.inss)}</Text></View>
              <View style={s.row}><Text style={s.rl}>IRRF</Text><Text style={[s.rv, { color: mensal.irrf > 0 ? Colors.red : Colors.ink3 }]}>{mensal.irrf > 0 ? "-"+fmt(mensal.irrf) : "Isento"}</Text></View>
              <View style={[s.row, s.totalRow]}><Text style={[s.rl, s.bold]}>Total descontos</Text><Text style={[s.rv, s.bold, { color: Colors.red }]}>-{fmt(mensal.inss + mensal.irrf)}</Text></View>
            </View>
            <View style={s.totalCard}><Text style={s.totalLabel}>Salario liquido</Text><Text style={s.totalValue}>{fmt(mensal.liquid)}</Text></View>
          </>
        )}

        {/* FERIAS */}
        {payslipType === "ferias" && (
          <>
            <View style={s.sec}><Text style={s.secT}>Proventos</Text>
              <View style={s.row}><Text style={s.rl}>Salario base (30 dias)</Text><Text style={[s.rv, { color: Colors.green }]}>{fmt(ferias.salary)}</Text></View>
              <View style={s.row}><Text style={s.rl}>1/3 constitucional</Text><Text style={[s.rv, { color: Colors.green }]}>{fmt(ferias.terco)}</Text></View>
              <View style={[s.row, s.totalRow]}><Text style={[s.rl, s.bold]}>Total proventos</Text><Text style={[s.rv, s.bold]}>{fmt(ferias.bruto)}</Text></View>
            </View>
            <View style={s.sec}><Text style={s.secT}>Descontos</Text>
              <View style={s.row}><Text style={s.rl}>INSS</Text><Text style={[s.rv, { color: Colors.red }]}>-{fmt(ferias.inss)}</Text></View>
              <View style={s.row}><Text style={s.rl}>IRRF</Text><Text style={[s.rv, { color: ferias.irrf > 0 ? Colors.red : Colors.ink3 }]}>{ferias.irrf > 0 ? "-"+fmt(ferias.irrf) : "Isento"}</Text></View>
              <View style={[s.row, s.totalRow]}><Text style={[s.rl, s.bold]}>Total descontos</Text><Text style={[s.rv, s.bold, { color: Colors.red }]}>-{fmt(ferias.inss + ferias.irrf)}</Text></View>
            </View>
            <View style={s.infoCard}><Text style={s.infoText}>FGTS sobre ferias: {fmt(ferias.fgts)}</Text></View>
            <View style={s.totalCard}><Text style={s.totalLabel}>Liquido ferias</Text><Text style={s.totalValue}>{fmt(ferias.liquid)}</Text></View>
          </>
        )}

        {/* 13o SALARIO */}
        {payslipType === "decimo_terceiro" && (
          <>
            <View style={s.sec}><Text style={s.secT}>Proventos</Text>
              <View style={s.row}><Text style={s.rl}>13o salario ({decimo.proporcional}/12 avos)</Text><Text style={[s.rv, { color: Colors.green }]}>{fmt(decimo.bruto)}</Text></View>
              <View style={[s.row, s.totalRow]}><Text style={[s.rl, s.bold]}>Total proventos</Text><Text style={[s.rv, s.bold]}>{fmt(decimo.bruto)}</Text></View>
            </View>
            <View style={s.sec}><Text style={s.secT}>Descontos</Text>
              <View style={s.row}><Text style={s.rl}>INSS</Text><Text style={[s.rv, { color: Colors.red }]}>-{fmt(decimo.inss)}</Text></View>
              <View style={s.row}><Text style={s.rl}>IRRF</Text><Text style={[s.rv, { color: decimo.irrf > 0 ? Colors.red : Colors.ink3 }]}>{decimo.irrf > 0 ? "-"+fmt(decimo.irrf) : "Isento"}</Text></View>
              <View style={[s.row, s.totalRow]}><Text style={[s.rl, s.bold]}>Total descontos</Text><Text style={[s.rv, s.bold, { color: Colors.red }]}>-{fmt(decimo.inss + decimo.irrf)}</Text></View>
            </View>
            <View style={s.infoCard}><Text style={s.infoText}>FGTS sobre 13o: {fmt(decimo.fgts)}</Text></View>
            <View style={s.totalCard}><Text style={s.totalLabel}>Liquido 13o salario</Text><Text style={s.totalValue}>{fmt(decimo.liquid)}</Text></View>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2 },
  hdr: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700" },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  sendBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  sendText: { fontSize: 13, color: "#fff", fontWeight: "600" },
  sendOptions: { flexDirection: "row", gap: 8, marginBottom: 16 },
  sendOpt: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  sendOptText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  // Type selector
  typeRow: { flexDirection: "row", gap: 6, marginBottom: 20, backgroundColor: Colors.bg, borderRadius: 12, padding: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  typeBtnActive: { backgroundColor: Colors.violet },
  typeText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  typeTextActive: { color: "#fff", fontWeight: "600" },
  // Sections
  sec: { marginBottom: 16 },
  secT: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 8 },
  rl: { fontSize: 13, color: Colors.ink3 },
  rv: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  bold: { fontWeight: "700", color: Colors.ink },
  infoCard: { backgroundColor: Colors.violetD, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border2 },
  infoText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  totalCard: { backgroundColor: Colors.violetD, borderRadius: 14, padding: 18, marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: Colors.border2 },
  totalLabel: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  totalValue: { fontSize: 22, color: Colors.green, fontWeight: "800" },
});

export default Payslip;
