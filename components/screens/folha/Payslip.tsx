import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { BASE_URL } from "@/services/api";
import type { Employee, PayslipType } from "./types";
import { STATUS_MAP, fmt, calcPayroll, calcINSS, calcFerias, calc13 } from "./types";

const PAYSLIP_TYPES: { key: PayslipType; label: string }[] = [
  { key: "mensal", label: "Mensal" },
  { key: "ferias", label: "Ferias" },
  { key: "decimo_terceiro", label: "13o Salario" },
];

function generatePayslipHtml(emp: Employee, type: PayslipType, companyName: string, cnpj?: string) {
  const mensal = calcPayroll(emp);
  const ferias = calcFerias(emp);
  const decimo = calc13(emp);
  const period = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const typeLabels: Record<string, string> = { mensal: "Mensal", ferias: "Ferias", decimo_terceiro: "13o Salario" };
  const f = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  let proventosRows = "", descontosRows = "";
  let totalProv = 0, totalDesc = 0, liquid = 0, extras = "";

  if (type === "mensal") {
    totalProv = emp.salary; totalDesc = mensal.inss + mensal.irrf; liquid = mensal.liquid;
    proventosRows = `<tr><td>Salario base</td><td class="r">${f(emp.salary)}</td></tr>`;
    descontosRows = `<tr><td>INSS (${(mensal.inss/emp.salary*100).toFixed(1)}%)</td><td class="r red">${f(mensal.inss)}</td></tr>
      <tr><td>IRRF</td><td class="r ${mensal.irrf > 0 ? 'red' : ''}">${mensal.irrf > 0 ? f(mensal.irrf) : 'Isento'}</td></tr>`;
  } else if (type === "ferias") {
    totalProv = ferias.bruto; totalDesc = ferias.inss + ferias.irrf; liquid = ferias.liquid;
    proventosRows = `<tr><td>Salario base (30 dias)</td><td class="r">${f(ferias.salary)}</td></tr>
      <tr><td>1/3 constitucional</td><td class="r">${f(ferias.terco)}</td></tr>`;
    descontosRows = `<tr><td>INSS</td><td class="r red">${f(ferias.inss)}</td></tr>
      <tr><td>IRRF</td><td class="r ${ferias.irrf > 0 ? 'red' : ''}">${ferias.irrf > 0 ? f(ferias.irrf) : 'Isento'}</td></tr>`;
    extras = `<div style="background:#f5f3ff;border-radius:8px;padding:10px 14px;margin-top:8px;font-size:11px;color:#6d28d9;border:1px solid #ede9fe;">FGTS sobre ferias: ${f(ferias.fgts)}</div>`;
  } else {
    totalProv = decimo.bruto; totalDesc = decimo.inss + decimo.irrf; liquid = decimo.liquid;
    proventosRows = `<tr><td>13o salario (${decimo.proporcional}/12 avos)</td><td class="r">${f(decimo.bruto)}</td></tr>`;
    descontosRows = `<tr><td>INSS</td><td class="r red">${f(decimo.inss)}</td></tr>
      <tr><td>IRRF</td><td class="r ${decimo.irrf > 0 ? 'red' : ''}">${decimo.irrf > 0 ? f(decimo.irrf) : 'Isento'}</td></tr>`;
    extras = `<div style="background:#f5f3ff;border-radius:8px;padding:10px 14px;margin-top:8px;font-size:11px;color:#6d28d9;border:1px solid #ede9fe;">FGTS sobre 13o: ${f(decimo.fgts)}</div>`;
  }

  // Inline version for email (no external CSS classes, no print button)
  const inlineHtml = `<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#1a1a2e;max-width:560px;margin:0 auto;padding:20px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:12px;border-bottom:3px solid #6d28d9;margin-bottom:20px;">
    <div style="font-size:24px;font-weight:800;color:#6d28d9;letter-spacing:-1px;">aura.</div>
    <div style="text-align:right;font-size:10px;color:#555;"><strong>${companyName}</strong>${cnpj ? `<br>CNPJ: ${cnpj}` : ''}<br>Emitido em: ${new Date().toLocaleDateString('pt-BR')}</div>
  </div>
  <div style="margin-bottom:16px;"><h1 style="font-size:18px;font-weight:700;color:#1a1a2e;margin:0;">Holerite — ${typeLabels[type] || 'Mensal'}</h1><p style="font-size:11px;color:#666;margin:2px 0 0;">Competencia: ${period}</p></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f5f3ff;border-radius:10px;padding:14px;margin-bottom:20px;border:1px solid #ede9fe;">
    <div style="font-size:11px;color:#555;"><strong style="color:#1a1a2e;">Nome:</strong> ${emp.name}</div>
    <div style="font-size:11px;color:#555;"><strong style="color:#1a1a2e;">Cargo:</strong> ${emp.role || 'Colaborador'}</div>
    <div style="font-size:11px;color:#555;"><strong style="color:#1a1a2e;">CPF:</strong> ${emp.cpf || '—'}</div>
    <div style="font-size:11px;color:#555;"><strong style="color:#1a1a2e;">Admissao:</strong> ${emp.admDate || '—'}</div>
  </div>
  <div style="margin-bottom:16px;"><div style="font-size:10px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #ede9fe;">Proventos</div>
    <table style="width:100%;border-collapse:collapse;">${proventosRows}<tr style="font-weight:700;border-top:1.5px solid #6d28d9;background:#ede9fe;"><td style="padding:7px 10px;font-size:12px;">Total proventos</td><td style="padding:7px 10px;font-size:12px;text-align:right;font-family:monospace;">${f(totalProv)}</td></tr></table>
  </div>
  <div style="margin-bottom:16px;"><div style="font-size:10px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #ede9fe;">Descontos</div>
    <table style="width:100%;border-collapse:collapse;">${descontosRows}<tr style="font-weight:700;border-top:1.5px solid #6d28d9;background:#ede9fe;"><td style="padding:7px 10px;font-size:12px;">Total descontos</td><td style="padding:7px 10px;font-size:12px;text-align:right;font-family:monospace;color:#dc2626;">${f(totalDesc)}</td></tr></table>
  </div>
  ${extras}
  <div style="background:linear-gradient(135deg,#6d28d9,#7c3aed);border-radius:12px;padding:20px;display:flex;justify-content:space-between;align-items:center;margin-top:16px;">
    <span style="color:rgba(255,255,255,0.8);font-size:13px;font-weight:600;">${type === 'ferias' ? 'Liquido ferias' : type === 'decimo_terceiro' ? 'Liquido 13o' : 'Salario liquido'}</span>
    <span style="color:#fff;font-size:26px;font-weight:800;">${f(liquid)}</span>
  </div>
  <div style="margin-top:24px;padding-top:10px;border-top:0.5px solid #ddd;font-size:9px;color:#aaa;display:flex;justify-content:space-between;">
    <span>Aura. — Holerite estimado para apoio contabil</span><span>${period}</span>
  </div>
</div>`;

  // Full page version for PDF/print
  const fullPageHtml = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Holerite - ${emp.name}</title>
<style>
@page{margin:16mm;size:A4}@media print{.no-print{display:none!important}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#1a1a2e;line-height:1.5;max-width:700px;margin:0 auto;padding:20px}
table{width:100%;border-collapse:collapse}
td{padding:7px 10px;font-size:11px;border-bottom:0.5px solid #e5e7eb}
td.r{text-align:right;font-family:'Courier New',monospace}
td.red{color:#dc2626}
tr.total td{font-weight:700;border-top:1.5px solid #6d28d9;background:#ede9fe;font-size:12px}
.print-btn{display:block;margin:16px auto;padding:12px 32px;background:#6d28d9;color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer;font-weight:700}
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Salvar PDF</button>
${inlineHtml}
</body></html>`;

  return { inlineHtml, fullPageHtml };
}

export function Payslip({ emp, onBack }: { emp: Employee; onBack: () => void }) {
  const { company, token } = useAuthStore();
  const [showSend, setShowSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [payslipType, setPayslipType] = useState<PayslipType>("mensal");

  const mensal = calcPayroll(emp);
  const ferias = calcFerias(emp);
  const decimo = calc13(emp);

  async function handleSendEmail() {
    if (!emp.email) {
      toast.error("Funcionario sem e-mail cadastrado. Adicione na edicao.");
      return;
    }
    if (!company?.id || !token) { toast.error("Sessao expirada"); return; }

    setSending(true);
    try {
      const { inlineHtml } = generatePayslipHtml(emp, payslipType, company?.name || "Empresa", (company as any)?.cnpj);
      const period = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

      const res = await fetch(`${BASE_URL}/companies/${company.id}/employees/${emp.id}/payslip/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ payslip_html: inlineHtml, type: payslipType, period }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Holerite enviado para ${emp.email}`);
      } else {
        toast.error(data.error || "Erro ao enviar e-mail");
      }
    } catch {
      toast.error("Erro ao enviar holerite por e-mail");
    } finally {
      setSending(false);
      setShowSend(false);
    }
  }

  function handleSendWhatsApp() {
    toast.info("Envio por WhatsApp sera integrado em breve.");
    setShowSend(false);
  }

  function handleDownloadPdf() {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      toast.info("Impressao disponivel apenas na versao web");
      return;
    }
    const { fullPageHtml } = generatePayslipHtml(emp, payslipType, company?.name || "Minha Empresa", (company as any)?.cnpj);
    const w = window.open("", "_blank", "width=750,height=900,scrollbars=yes");
    if (w) { w.document.write(fullPageHtml); w.document.close(); }
    else toast.error("Pop-up bloqueado. Permita pop-ups para imprimir.");
  }

  return (
    <View>
      <Pressable onPress={onBack} style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 13, color: Colors.violet3, fontWeight: "600" }}>{'<'} Voltar</Text>
      </Pressable>
      <View style={s.card}>
        <View style={s.hdr}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Holerite - {emp.name}</Text>
            <Text style={s.sub}>{emp.role} / {STATUS_MAP[emp.status]?.l || emp.status} / {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={handleDownloadPdf} style={s.pdfBtn}>
              <Icon name="file_text" size={14} color={Colors.violet3} />
              <Text style={s.pdfText}>PDF</Text>
            </Pressable>
            <Pressable onPress={() => setShowSend(!showSend)} style={s.sendBtn}>
              <Text style={s.sendText}>Enviar</Text>
            </Pressable>
          </View>
        </View>

        {showSend && (
          <View style={s.sendOptions}>
            <Pressable onPress={handleSendWhatsApp} style={[s.sendOpt, { backgroundColor: "#075e54" }]}>
              <Text style={s.sendOptText}>WhatsApp</Text>
            </Pressable>
            <Pressable onPress={handleSendEmail} disabled={sending} style={[s.sendOpt, { backgroundColor: Colors.violet, opacity: sending ? 0.6 : 1 }]}>
              <Text style={s.sendOptText}>{sending ? "Enviando..." : "E-mail"}</Text>
            </Pressable>
          </View>
        )}

        <View style={s.typeRow}>
          {PAYSLIP_TYPES.map(t => (
            <Pressable key={t.key} onPress={() => setPayslipType(t.key)} style={[s.typeBtn, payslipType === t.key && s.typeBtnActive]}>
              <Text style={[s.typeText, payslipType === t.key && s.typeTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

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
  pdfBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  pdfText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  sendBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  sendText: { fontSize: 13, color: "#fff", fontWeight: "600" },
  sendOptions: { flexDirection: "row", gap: 8, marginBottom: 16 },
  sendOpt: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  sendOptText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  typeRow: { flexDirection: "row", gap: 6, marginBottom: 20, backgroundColor: Colors.bg, borderRadius: 12, padding: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  typeBtnActive: { backgroundColor: Colors.violet },
  typeText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  typeTextActive: { color: "#fff", fontWeight: "600" },
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
