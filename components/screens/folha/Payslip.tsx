import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Employee } from "./types";
import { STATUS_MAP, fmt, calcPayroll, calcINSS, LOGO_CDN } from "./types";

type CoInfo = { name: string; cnpj?: string; logo?: string };

function genPayslipHTML(emp: Employee, co: CoInfo) {
  const p = calcPayroll(emp);
  const f2 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const logoHtml = co.logo ? `<img src="${co.logo}" alt="${co.name}" style="max-height:48px;max-width:180px;object-fit:contain"/>` : `<div style="font-size:24px;font-weight:800;color:#6d28d9">Aura<span style="color:#8b5cf6">.</span></div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',system-ui,sans-serif}body{background:#fff;padding:40px;max-width:720px;margin:0 auto;color:#1a1a2e}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6d28d9;padding-bottom:18px;margin-bottom:24px}.dt{text-align:right}.dt h2{font-size:14px;color:#6d28d9;text-transform:uppercase;letter-spacing:1.5px}.dt p{font-size:11px;color:#64748b;margin-top:3px}.ei{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f5f3ff;border:1px solid #e9e5f5;border-radius:10px;padding:16px;margin-bottom:24px}.ei .lb{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px}.ei .vl{font-size:13px;font-weight:600;color:#1a1a2e;margin-top:2px}.st{font-size:10px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;margin-top:20px}table{width:100%;border-collapse:collapse;margin-bottom:4px}th{background:#6d28d9;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;padding:10px 14px;text-align:left}th:last-child{text-align:right}td{padding:10px 14px;font-size:12px;border-bottom:1px solid #ede9fe;color:#334155}td:last-child{text-align:right;font-weight:600;font-variant-numeric:tabular-nums}td.pos{color:#059669}td.neg{color:#dc2626}.sr td{background:#faf5ff;font-weight:600;font-size:12px;border-top:1px solid #e9e5f5}.sr td:last-child{color:#6d28d9}.ts{background:#f5f3ff;border:2px solid #6d28d9;border-radius:10px;padding:16px;margin-top:20px;display:flex;justify-content:space-between;align-items:center}.tl{font-size:14px;font-weight:600;color:#334155}.tv{font-size:22px;font-weight:800;color:#059669}.ft{margin-top:32px;padding-top:14px;border-top:1px solid #e9e5f5;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}@media print{body{padding:20px}button{display:none!important}}</style></head><body><div class="hdr"><div>${logoHtml}<div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-top:6px">${co.name}</div></div><div class="dt"><h2>Holerite</h2><p>Competencia: ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p><p>Emissao: ${new Date().toLocaleDateString("pt-BR")}</p></div></div><div class="ei"><div><div class="lb">Funcionario</div><div class="vl">${emp.name}</div></div><div><div class="lb">Cargo</div><div class="vl">${emp.role}</div></div><div><div class="lb">Admissao</div><div class="vl">${emp.admDate}</div></div><div><div class="lb">Status</div><div class="vl">${STATUS_MAP[emp.status].l}</div></div></div><div class="st">Proventos</div><table><thead><tr><th>Descricao</th><th>Referencia</th><th>Valor (R$)</th></tr></thead><tbody><tr><td>Salario base</td><td>30 dias</td><td class="pos">${f2(emp.salary)}</td></tr></tbody><tfoot><tr class="sr"><td colspan="2">Total proventos</td><td>${f2(emp.salary)}</td></tr></tfoot></table><div class="st">Descontos</div><table><thead><tr><th>Descricao</th><th>Referencia</th><th>Valor (R$)</th></tr></thead><tbody><tr><td>INSS</td><td>${(calcINSS(emp.salary)/emp.salary*100).toFixed(1)}%</td><td class="neg">-${f2(p.inss)}</td></tr><tr><td>IRRF</td><td>${p.irrf > 0 ? (p.irrf/emp.salary*100).toFixed(1)+"%" : "Isento"}</td><td${p.irrf > 0 ? ' class="neg"' : ""}>${p.irrf > 0 ? "-"+f2(p.irrf) : "Isento"}</td></tr></tbody><tfoot><tr class="sr"><td colspan="2">Total descontos</td><td>-${f2(p.inss+p.irrf)}</td></tr></tfoot></table><div class="ts"><div class="tl">Salario liquido a receber</div><div class="tv">R$ ${f2(p.liquid)}</div></div><div class="ft"><span>Gerado por Aura. - getaura.com.br</span><span>${new Date().toLocaleDateString("pt-BR")}</span></div></body></html>`;
}

export function Payslip({ emp, onBack }: { emp: Employee; onBack: () => void }) {
  const { company } = useAuthStore();
  const [showSend, setShowSend] = useState(false);
  const p = calcPayroll(emp);
  const coInfo: CoInfo = { name: company?.name || "Minha Empresa", cnpj: (company as any)?.cnpj, logo: (company as any)?.logo || LOGO_CDN };

  function handlePreview() {
    if (Platform.OS === "web") { const w = window.open("", "_blank"); if (w) { w.document.write(genPayslipHTML(emp, coInfo)); w.document.close(); } }
  }
  function handleSend(via: string) { toast.success(`Holerite enviado via ${via} para ${emp.name}`); setShowSend(false); }

  return (
    <View>
      <Pressable onPress={onBack} style={{ marginBottom: 16 }}><Text style={{ fontSize: 13, color: Colors.violet3, fontWeight: "600" }}>{'<'} Voltar</Text></Pressable>
      <View style={s.card}>
        <View style={s.hdr}>
          <View><Text style={s.title}>Holerite - {emp.name}</Text><Text style={s.sub}>{emp.role} / Competencia: {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text></View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={handlePreview} style={s.previewBtn}><Text style={s.previewText}>Visualizar</Text></Pressable>
            <Pressable onPress={() => setShowSend(!showSend)} style={s.sendBtn}><Text style={s.sendText}>Enviar</Text></Pressable>
          </View>
        </View>

        {showSend && (
          <View style={s.sendOptions}>
            <Pressable onPress={() => handleSend("WhatsApp")} style={[s.sendOpt, { backgroundColor: "#075e54" }]}><Text style={s.sendOptText}>WhatsApp</Text></Pressable>
            <Pressable onPress={() => handleSend("E-mail")} style={[s.sendOpt, { backgroundColor: Colors.violet }]}><Text style={s.sendOptText}>E-mail</Text></Pressable>
          </View>
        )}

        <View style={s.sec}><Text style={s.secT}>Proventos</Text>
          <View style={s.row}><Text style={s.rl}>Salario base</Text><Text style={[s.rv, { color: Colors.green }]}>{fmt(emp.salary)}</Text></View>
          <View style={[s.row, s.totalRow]}><Text style={[s.rl, { fontWeight: "600", color: Colors.ink }]}>Total proventos</Text><Text style={[s.rv, { fontWeight: "700" }]}>{fmt(emp.salary)}</Text></View>
        </View>

        <View style={s.sec}><Text style={s.secT}>Descontos</Text>
          <View style={s.row}><Text style={s.rl}>INSS ({(calcINSS(emp.salary)/emp.salary*100).toFixed(1)}%)</Text><Text style={[s.rv, { color: Colors.red }]}>-{fmt(p.inss)}</Text></View>
          <View style={s.row}><Text style={s.rl}>IRRF</Text><Text style={[s.rv, { color: p.irrf > 0 ? Colors.red : Colors.ink3 }]}>{p.irrf > 0 ? "-"+fmt(p.irrf) : "Isento"}</Text></View>
          <View style={[s.row, s.totalRow]}><Text style={[s.rl, { fontWeight: "600", color: Colors.ink }]}>Total descontos</Text><Text style={[s.rv, { fontWeight: "700", color: Colors.red }]}>-{fmt(p.inss + p.irrf)}</Text></View>
        </View>

        <View style={s.totalCard}><Text style={s.totalLabel}>Salario liquido a receber</Text><Text style={s.totalValue}>{fmt(p.liquid)}</Text></View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2 },
  hdr: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700" },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  previewBtn: { backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  previewText: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  sendBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  sendText: { fontSize: 13, color: "#fff", fontWeight: "600" },
  sendOptions: { flexDirection: "row", gap: 8, marginBottom: 16 },
  sendOpt: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  sendOptText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  sec: { marginBottom: 16 },
  secT: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 8 },
  rl: { fontSize: 13, color: Colors.ink3 },
  rv: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  totalCard: { backgroundColor: Colors.violetD, borderRadius: 14, padding: 18, marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: Colors.border2 },
  totalLabel: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  totalValue: { fontSize: 22, color: Colors.green, fontWeight: "800" },
});

export default Payslip;
