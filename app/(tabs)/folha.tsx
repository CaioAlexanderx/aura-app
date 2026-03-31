import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { TabBar } from "@/components/TabBar";
import { HoverCard } from "@/components/HoverCard";
import { HoverRow } from "@/components/HoverRow";
import { DemoBanner } from "@/components/DemoBanner";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { BackButton } from "@/components/BackButton";
import { toast } from "@/components/Toast";

const TABS = ["Funcionários", "Resumo mensal", "Histórico"];
type Employee = { id: string; name: string; role: string; salary: number; admDate: string; status: "active" | "vacation" | "dismissed" };
const EMPS: Employee[] = [
  { id: "1", name: "Ana Costa", role: "Atendente", salary: 1800, admDate: "15/03/2025", status: "active" },
  { id: "2", name: "Carlos Silva", role: "Barbeiro", salary: 2200, admDate: "01/06/2024", status: "active" },
  { id: "3", name: "Julia Santos", role: "Recepcionista", salary: 1600, admDate: "10/09/2025", status: "active" },
];
const INSS_F=[{ate:1412,aliq:0.075},{ate:2666.68,aliq:0.09},{ate:4000.03,aliq:0.12},{ate:7786.02,aliq:0.14}];
function cINSS(s:number){let i=0,p=0;for(const f of INSS_F){const b=Math.min(s,f.ate)-p;if(b<=0)break;i+=b*f.aliq;p=f.ate;}return i;}
function cIRRF(s:number,i:number){const b=s-i;if(b<=2259.20)return 0;if(b<=2826.65)return b*0.075-169.44;if(b<=3751.05)return b*0.15-381.44;if(b<=4664.68)return b*0.225-662.77;return b*0.275-896;}
const FR=0.08;
function cP(e:Employee){const i=cINSS(e.salary);const r=Math.max(0,cIRRF(e.salary,i));const f=e.salary*FR;return{inss:i,irrf:r,fgts:f,liquid:e.salary-i-r};}
const HIST=[{id:"h1",month:"Fevereiro/2026",total:5600,liquid:4612.40,paidAt:"05/03/2026",employees:3},{id:"h2",month:"Janeiro/2026",total:5600,liquid:4612.40,paidAt:"05/02/2026",employees:3},{id:"h3",month:"Dezembro/2025",total:5600,liquid:4612.40,paidAt:"05/01/2026",employees:3}];
const stMap={active:{l:"Ativo",c:Colors.green},vacation:{l:"Férias",c:Colors.amber},dismissed:{l:"Desligado",c:Colors.red}};

const LOGO_CDN="https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Aura.jpeg";

type CoInfo = { name: string; cnpj?: string; logo?: string; address?: string };

function genPayslipHTML(emp: Employee, co: CoInfo){
  const p=cP(emp);
  const f2=(n:number)=>n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const logoHtml=co.logo?`<img src="${co.logo}" alt="${co.name}" style="max-height:48px;max-width:180px;object-fit:contain"/>`:`<div class="lt">Aura<span>.</span></div>`;
  const cnpjHtml=co.cnpj?`<div class="cd">CNPJ: ${co.cnpj}</div>`:"";
  const addrHtml=co.address?`<div class="cd">${co.address}</div>`:"";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',system-ui,sans-serif}
body{background:#fff;padding:40px;max-width:720px;margin:0 auto;color:#1a1a2e}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6d28d9;padding-bottom:18px;margin-bottom:24px}
.ci{display:flex;flex-direction:column;gap:4px}
.lt{font-size:24px;font-weight:800;color:#6d28d9;letter-spacing:-0.5px}.lt span{color:#8b5cf6}
.cn{font-size:14px;font-weight:700;color:#1a1a2e;margin-top:6px}
.cd{font-size:11px;color:#64748b}
.dt{text-align:right}.dt h2{font-size:14px;color:#6d28d9;text-transform:uppercase;letter-spacing:1.5px}.dt p{font-size:11px;color:#64748b;margin-top:3px}
.ei{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f5f3ff;border:1px solid #e9e5f5;border-radius:10px;padding:16px;margin-bottom:24px}
.ei .lb{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px}.ei .vl{font-size:13px;font-weight:600;color:#1a1a2e;margin-top:2px}
.st{font-size:10px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;margin-top:20px}
table{width:100%;border-collapse:collapse;margin-bottom:4px}
th{background:#6d28d9;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;padding:10px 14px;text-align:left}
th:last-child{text-align:right}
td{padding:10px 14px;font-size:12px;border-bottom:1px solid #ede9fe;color:#334155}
td:last-child{text-align:right;font-weight:600;font-variant-numeric:tabular-nums}
td.pos{color:#059669}td.neg{color:#dc2626}
.sr td{background:#faf5ff;font-weight:600;font-size:12px;border-top:1px solid #e9e5f5}
.sr td:last-child{color:#6d28d9}
.ts{background:#f5f3ff;border:2px solid #6d28d9;border-radius:10px;padding:16px;margin-top:20px;display:flex;justify-content:space-between;align-items:center}
.tl{font-size:14px;font-weight:600;color:#334155}.tv{font-size:22px;font-weight:800;color:#059669}
.ft{margin-top:32px;padding-top:14px;border-top:1px solid #e9e5f5;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
@media print{body{padding:20px}button{display:none!important}}
</style></head><body>
<div class="hdr"><div class="ci">${logoHtml}<div class="cn">${co.name}</div>${cnpjHtml}${addrHtml}</div>
<div class="dt"><h2>Holerite</h2><p>Competencia: Marco/2026</p><p>Emissao: ${new Date().toLocaleDateString("pt-BR")}</p></div></div>
<div class="ei"><div><div class="lb">Funcionario</div><div class="vl">${emp.name}</div></div><div><div class="lb">Cargo</div><div class="vl">${emp.role}</div></div><div><div class="lb">Admissao</div><div class="vl">${emp.admDate}</div></div><div><div class="lb">Status</div><div class="vl">${stMap[emp.status].l}</div></div></div>
<div class="st">Proventos</div>
<table><thead><tr><th>Descricao</th><th>Referencia</th><th>Valor (R$)</th></tr></thead><tbody>
<tr><td>Salário base</td><td>30 dias</td><td class="pos">${f2(emp.salary)}</td></tr>
</tbody><tfoot><tr class="sr"><td colspan="2">Total proventos</td><td>${f2(emp.salary)}</td></tr></tfoot></table>
<div class="st">Descontos</div>
<table><thead><tr><th>Descricao</th><th>Referencia</th><th>Valor (R$)</th></tr></thead><tbody>
<tr><td>INSS</td><td>${(cINSS(emp.salary)/emp.salary*100).toFixed(1)}%</td><td class="neg">-${f2(p.inss)}</td></tr>
<tr><td>IRRF</td><td>${p.irrf>0?(p.irrf/emp.salary*100).toFixed(1)+"%":"Isento"}</td><td${p.irrf>0?' class="neg"':""}>
${p.irrf>0?"-"+f2(p.irrf):"Isento"}</td></tr>
</tbody><tfoot><tr class="sr"><td colspan="2">Total descontos</td><td>-${f2(p.inss+p.irrf)}</td></tr></tfoot></table>
<div class="ts"><div class="tl">Salário líquido a receber</div><div class="tv">R$ ${f2(p.liquid)}</div></div>
<div class="ft"><span>Gerado por Aura. - getaura.com.br</span><span>${new Date().toLocaleDateString("pt-BR")}</span></div>
</body></html>`;
}

function SendModal({visible,emp,onClose}:{visible:boolean;emp:Employee;onClose:()=>void}){
  const {company}=useAuthStore();const [sent,setSent]=useState<string|null>(null);
  const coInfo: CoInfo = { name: company?.name || "Minha Empresa", cnpj: (company as any)?.cnpj, logo: (company as any)?.logo || LOGO_CDN, address: (company as any)?.address };
  function handleSend(via:string){setSent(via);setTimeout(()=>{setSent(null);onClose();toast.success("Holerite enviado via "+via+" para "+emp.name);},1500);}
  function handlePreview(){
    if(Platform.OS==="web"){const w=window.open("","_blank");if(w){w.document.write(genPayslipHTML(emp,coInfo));w.document.close();}}
  }
  if(!visible)return null;
  return <View style={sm.overlay}><View style={sm.modal}>
    <Text style={sm.title}>Enviar holerite</Text>
    <Text style={sm.sub}>Selecione como enviar o holerite de {emp.name}</Text>
    <View style={sm.preview}><View style={sm.previewHeader}><Text style={sm.previewLogo}>{coInfo.name}</Text><Text style={sm.previewDoc}>Holerite - Marco/2026</Text></View><View style={sm.previewBody}><Text style={sm.previewName}>{emp.name} / {emp.role}</Text><Text style={sm.previewVal}>Liquido: {fmt(cP(emp).liquid)}</Text></View></View>
    <Pressable onPress={handlePreview} style={sm.previewBtn}><Icon name="file_text" size={14} color={Colors.violet3}/><Text style={sm.previewBtnText}>Visualizar documento completo</Text></Pressable>
    <View style={sm.options}>
      <Pressable onPress={()=>handleSend("WhatsApp")} style={[sm.optBtn,{backgroundColor:"#075e54"}]}><Text style={sm.optIcon}>W</Text><View><Text style={sm.optTitle}>WhatsApp</Text><Text style={sm.optSub}>Envia PDF pelo WhatsApp Business</Text></View>{sent==="WhatsApp"&&<Text style={sm.sending}>Enviando...</Text>}</Pressable>
      <Pressable onPress={()=>handleSend("E-mail")} style={[sm.optBtn,{backgroundColor:Colors.violet}]}><Text style={sm.optIcon}>@</Text><View><Text style={sm.optTitle}>E-mail</Text><Text style={sm.optSub}>Envia PDF por e-mail</Text></View>{sent==="E-mail"&&<Text style={sm.sending}>Enviando...</Text>}</Pressable>
    </View>
    <Pressable onPress={onClose} style={sm.closeBtn}><Text style={sm.closeText}>Cancelar</Text></Pressable>
  </View></View>;
}
const sm=StyleSheet.create({overlay:{position:"absolute" as any,top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.6)",justifyContent:"center",alignItems:"center",zIndex:100},modal:{backgroundColor:Colors.bg3,borderRadius:20,padding:28,maxWidth:440,width:"90%",borderWidth:1,borderColor:Colors.border2},title:{fontSize:20,color:Colors.ink,fontWeight:"700",marginBottom:4},sub:{fontSize:13,color:Colors.ink3,marginBottom:20},preview:{backgroundColor:"#fff",borderRadius:12,padding:16,marginBottom:12},previewHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",borderBottomWidth:2,borderBottomColor:"#6d28d9",paddingBottom:8,marginBottom:10},previewLogo:{fontSize:14,fontWeight:"700",color:"#6d28d9"},previewDoc:{fontSize:10,color:"#6d28d9",fontWeight:"600",textTransform:"uppercase",letterSpacing:0.5},previewBody:{gap:4},previewName:{fontSize:12,color:"#334155",fontWeight:"600"},previewVal:{fontSize:14,color:"#059669",fontWeight:"700"},previewBtn:{flexDirection:"row",alignItems:"center",gap:6,alignSelf:"center",marginBottom:20,paddingVertical:8},previewBtnText:{fontSize:12,color:Colors.violet3,fontWeight:"600"},options:{gap:10,marginBottom:16},optBtn:{flexDirection:"row",alignItems:"center",gap:12,borderRadius:14,padding:16},optIcon:{fontSize:18,fontWeight:"800",color:"#fff",width:32,textAlign:"center"},optTitle:{fontSize:14,color:"#fff",fontWeight:"700"},optSub:{fontSize:11,color:"rgba(255,255,255,0.7)",marginTop:1},sending:{fontSize:11,color:"rgba(255,255,255,0.8)",fontWeight:"600",marginLeft:"auto" as any},closeBtn:{alignItems:"center",paddingVertical:10},closeText:{fontSize:13,color:Colors.ink3,fontWeight:"500"}});

function EC({emp,onCalc}:{emp:Employee;onCalc:()=>void}){
  const st=stMap[emp.status];
  return <HoverCard style={ec.card}><View style={ec.top}><View style={ec.av}><Text style={ec.at}>{emp.name.charAt(0)}</Text></View><View style={ec.inf}><Text style={ec.nm}>{emp.name}</Text><Text style={ec.rl}>{emp.role}</Text></View><View style={[ec.sb,{backgroundColor:st.c+"18"}]}><Text style={[ec.st,{color:st.c}]}>{st.l}</Text></View></View>
    <View style={ec.det}><View style={ec.di}><Text style={ec.dl}>Salário bruto</Text><Text style={ec.dv}>{fmt(emp.salary)}</Text></View><View style={ec.di}><Text style={ec.dl}>Admissao</Text><Text style={ec.dv}>{emp.admDate}</Text></View></View>
    <View style={ec.acts}><Pressable onPress={onCalc} style={ec.cb}><Icon name="receipt" size={14} color={Colors.violet3}/><Text style={ec.ct}>Ver holerite</Text></Pressable></View>
  </HoverCard>;
}
const ec=StyleSheet.create({card:{backgroundColor:Colors.bg3,borderRadius:16,padding:18,borderWidth:1,borderColor:Colors.border,marginBottom:10},top:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:14},av:{width:40,height:40,borderRadius:12,backgroundColor:Colors.violetD,alignItems:"center",justifyContent:"center"},at:{fontSize:16,fontWeight:"700",color:Colors.violet3},inf:{flex:1,gap:2},nm:{fontSize:15,color:Colors.ink,fontWeight:"700"},rl:{fontSize:12,color:Colors.ink3},sb:{borderRadius:6,paddingHorizontal:8,paddingVertical:3},st:{fontSize:10,fontWeight:"600"},det:{flexDirection:"row",gap:20,marginBottom:12},di:{gap:2},dl:{fontSize:9,color:Colors.ink3,textTransform:"uppercase",letterSpacing:0.5},dv:{fontSize:14,color:Colors.ink,fontWeight:"600"},acts:{paddingTop:12,borderTopWidth:1,borderTopColor:Colors.border},cb:{flexDirection:"row",alignItems:"center",gap:6,backgroundColor:Colors.violetD,borderRadius:10,paddingHorizontal:14,paddingVertical:9,alignSelf:"flex-start",borderWidth:1,borderColor:Colors.border2},ct:{fontSize:12,color:Colors.violet3,fontWeight:"600"}});

function PS({emp,onBack}:{emp:Employee;onBack:()=>void}){
  const p=cP(emp);const[showSend,setShowSend]=useState(false);
  return <View>
    <SendModal visible={showSend} emp={emp} onClose={()=>setShowSend(false)}/>
    <BackButton onPress={onBack} />
    <View style={pss.card}>
      <View style={pss.hdr}><View><Text style={pss.title}>Holerite - {emp.name}</Text><Text style={pss.sub}>{emp.role} / Competencia: Marco/2026</Text></View>
        <Pressable onPress={()=>setShowSend(true)} style={pss.sendBtn}><Icon name="file_text" size={16} color="#fff"/><Text style={pss.sendText}>Enviar holerite</Text></Pressable>
      </View>
      <View style={pss.sec}><Text style={pss.secT}>Proventos</Text><View style={pss.row}><Text style={pss.rl}>Salário base</Text><Text style={[pss.rv,{color:Colors.green}]}>{fmt(emp.salary)}</Text></View><View style={[pss.row,{borderTopWidth:1,borderTopColor:Colors.border,marginTop:4,paddingTop:8}]}><Text style={[pss.rl,{fontWeight:"600",color:Colors.ink}]}>Total proventos</Text><Text style={[pss.rv,{fontWeight:"700"}]}>{fmt(emp.salary)}</Text></View></View>
      <View style={pss.sec}><Text style={pss.secT}>Descontos</Text><View style={pss.row}><Text style={pss.rl}>INSS ({(cINSS(emp.salary)/emp.salary*100).toFixed(1)}%)</Text><Text style={[pss.rv,{color:Colors.red}]}>-{fmt(p.inss)}</Text></View><View style={pss.row}><Text style={pss.rl}>IRRF</Text><Text style={[pss.rv,{color:p.irrf>0?Colors.red:Colors.ink3}]}>{p.irrf>0?"-"+fmt(p.irrf):"Isento"}</Text></View><View style={[pss.row,{borderTopWidth:1,borderTopColor:Colors.border,marginTop:4,paddingTop:8}]}><Text style={[pss.rl,{fontWeight:"600",color:Colors.ink}]}>Total descontos</Text><Text style={[pss.rv,{fontWeight:"700",color:Colors.red}]}>-{fmt(p.inss+p.irrf)}</Text></View></View>
      <View style={pss.totalCard}><Text style={pss.totalLabel}>Salário líquido a receber</Text><Text style={pss.totalValue}>{fmt(p.liquid)}</Text></View>
    </View>
  </View>;
}
const pss=StyleSheet.create({card:{backgroundColor:Colors.bg3,borderRadius:20,padding:24,borderWidth:1,borderColor:Colors.border2},hdr:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12},title:{fontSize:20,color:Colors.ink,fontWeight:"700"},sub:{fontSize:12,color:Colors.ink3,marginTop:2},sendBtn:{flexDirection:"row",alignItems:"center",gap:6,backgroundColor:Colors.violet,borderRadius:10,paddingHorizontal:16,paddingVertical:10},sendText:{fontSize:13,color:"#fff",fontWeight:"600"},sec:{marginBottom:16},secT:{fontSize:11,color:Colors.ink3,fontWeight:"600",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8},row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:6},rl:{fontSize:13,color:Colors.ink3},rv:{fontSize:14,color:Colors.ink,fontWeight:"600"},totalCard:{backgroundColor:Colors.violetD,borderRadius:14,padding:18,marginTop:8,flexDirection:"row",justifyContent:"space-between",alignItems:"center",borderWidth:1,borderColor:Colors.border2},totalLabel:{fontSize:14,color:Colors.ink,fontWeight:"600"},totalValue:{fontSize:22,color:Colors.green,fontWeight:"800"}});

function CT(){
  const tB=EMPS.filter(e=>e.status==="active").reduce((s,e)=>s+e.salary,0);
  const tot=EMPS.filter(e=>e.status==="active").reduce((a,e)=>{const p=cP(e);return{inss:a.inss+p.inss,irrf:a.irrf+p.irrf,fgts:a.fgts+p.fgts,liquid:a.liquid+p.liquid};},{inss:0,irrf:0,fgts:0,liquid:0});
  return <View><HoverCard style={ct.sc}><Text style={ct.st}>Resumo da folha - Marco/2026</Text>
    <View style={ct.sg}><View style={ct.si}><Text style={ct.sl}>Funcionários ativos</Text><Text style={ct.sv}>{EMPS.filter(e=>e.status==="active").length}</Text></View><View style={ct.si}><Text style={ct.sl}>Total bruto</Text><Text style={ct.sv}>{fmt(tB)}</Text></View><View style={ct.si}><Text style={ct.sl}>INSS total</Text><Text style={[ct.sv,{color:Colors.red}]}>-{fmt(tot.inss)}</Text></View><View style={ct.si}><Text style={ct.sl}>IRRF total</Text><Text style={[ct.sv,{color:tot.irrf>0?Colors.red:Colors.ink3}]}>{tot.irrf>0?"-"+fmt(tot.irrf):"Isento"}</Text></View><View style={ct.si}><Text style={ct.sl}>Total líquido</Text><Text style={[ct.sv,{color:Colors.green,fontSize:18}]}>{fmt(tot.liquid)}</Text></View><View style={ct.si}><Text style={ct.sl}>FGTS a depositar</Text><Text style={ct.sv}>{fmt(tot.fgts)}</Text></View></View>
    <View style={ct.cr}><Text style={ct.cl}>Custo total para a empresa</Text><Text style={ct.cv}>{fmt(tB+tot.fgts)}</Text></View></HoverCard>
    <Text style={ct.bt}>Detalhamento por funcionário</Text>
    {EMPS.filter(e=>e.status==="active").map(e=>{const p=cP(e);return <HoverRow key={e.id} style={ct.er}><View style={ct.ei}><Text style={ct.en}>{e.name}</Text><Text style={ct.erl}>{e.role}</Text></View><View style={ct.ens}><Text style={ct.eb}>Bruto: {fmt(e.salary)}</Text><Text style={ct.el}>Liquido: {fmt(p.liquid)}</Text></View></HoverRow>;})}
  </View>;
}
const ct=StyleSheet.create({sc:{backgroundColor:Colors.bg3,borderRadius:16,padding:20,borderWidth:1,borderColor:Colors.border2,marginBottom:20},st:{fontSize:16,color:Colors.ink,fontWeight:"700",marginBottom:16},sg:{flexDirection:"row",flexWrap:"wrap",gap:12,marginBottom:16},si:{width:IS_WIDE?"30%":"46%",backgroundColor:Colors.bg4,borderRadius:10,padding:12,gap:4},sl:{fontSize:10,color:Colors.ink3,textTransform:"uppercase",letterSpacing:0.5},sv:{fontSize:16,color:Colors.ink,fontWeight:"700"},cr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",backgroundColor:Colors.violetD,borderRadius:10,padding:14,borderWidth:1,borderColor:Colors.border2},cl:{fontSize:13,color:Colors.ink3,fontWeight:"500"},cv:{fontSize:18,color:Colors.violet3,fontWeight:"700"},bt:{fontSize:15,color:Colors.ink,fontWeight:"700",marginBottom:12},er:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",backgroundColor:Colors.bg3,borderRadius:12,padding:14,borderWidth:1,borderColor:Colors.border,marginBottom:6},ei:{gap:2},en:{fontSize:13,color:Colors.ink,fontWeight:"600"},erl:{fontSize:11,color:Colors.ink3},ens:{alignItems:"flex-end",gap:2},eb:{fontSize:12,color:Colors.ink3},el:{fontSize:13,color:Colors.green,fontWeight:"600"}});

function HT(){return <View>{HIST.map(h=><HoverRow key={h.id} style={hs.row}><View style={hs.left}><View style={hs.ck}><Icon name="check" size={12} color={Colors.green}/></View><View style={hs.inf}><Text style={hs.mo}>{h.month}</Text><Text style={hs.me}>{h.employees} funcionários · pago em {h.paidAt}</Text></View></View><View style={hs.right}><Text style={hs.to}>{fmt(h.total)}</Text><Text style={hs.li}>Liquido: {fmt(h.liquid)}</Text></View></HoverRow>)}</View>;}
const hs=StyleSheet.create({row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",backgroundColor:Colors.bg3,borderRadius:14,padding:16,borderWidth:1,borderColor:Colors.border,marginBottom:8,flexWrap:"wrap",gap:8},left:{flexDirection:"row",alignItems:"center",gap:12},ck:{width:28,height:28,borderRadius:8,backgroundColor:Colors.greenD,alignItems:"center",justifyContent:"center"},inf:{gap:2},mo:{fontSize:14,color:Colors.ink,fontWeight:"600"},me:{fontSize:11,color:Colors.ink3},right:{alignItems:"flex-end",gap:4,flexShrink:0},to:{fontSize:14,color:Colors.ink,fontWeight:"600"},li:{fontSize:11,color:Colors.green}});

export default function FolhaScreen(){
  const[tab,sTab]=useState(0);const[psEmp,sPsEmp]=useState<Employee|null>(null);
  if(psEmp) return <ScrollView style={z.scr} contentContainerStyle={z.cnt}><PS emp={psEmp} onBack={()=>sPsEmp(null)}/><DemoBanner/></ScrollView>;
  const ac=EMPS.filter(e=>e.status==="active");const tB=ac.reduce((s,e)=>s+e.salary,0);const tF=ac.reduce((s,e)=>s+e.salary*FR,0);
  return <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
    <PageHeader title="Folha de Pagamento"/>
    <View style={z.kpis}><View style={z.kpi}><Icon name="users" size={20} color={Colors.violet3}/><Text style={z.kv}>{ac.length}</Text><Text style={z.kl}>Ativos</Text></View><View style={z.kpi}><Icon name="dollar" size={20} color={Colors.green}/><Text style={z.kv}>{fmt(tB)}</Text><Text style={z.kl}>Folha bruta</Text></View><View style={z.kpi}><Icon name="trending_up" size={20} color={Colors.amber}/><Text style={z.kv}>{fmt(tF)}</Text><Text style={z.kl}>FGTS</Text></View></View>
    <TabBar tabs={TABS} active={tab} onSelect={sTab}/>
    {tab===0&&<View>{EMPS.map(e=><EC key={e.id} emp={e} onCalc={()=>sPsEmp(e)}/>)}</View>}
    {tab===1&&<CT/>}{tab===2&&<HT/>}<DemoBanner/>
  </ScrollView>;
}
const z=StyleSheet.create({scr:{flex:1},cnt:{padding:IS_WIDE?32:20,paddingBottom:48,maxWidth:960,alignSelf:"center",width:"100%"},kpis:{flexDirection:"row",gap:10,marginBottom:20},kpi:{flex:1,backgroundColor:Colors.bg3,borderRadius:14,padding:16,borderWidth:1,borderColor:Colors.border,alignItems:"center",gap:6},kv:{fontSize:18,fontWeight:"700",color:Colors.ink},kl:{fontSize:10,color:Colors.ink3,textTransform:"uppercase",letterSpacing:0.5}});
