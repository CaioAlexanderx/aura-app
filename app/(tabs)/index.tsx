import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, Dimensions, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { dashboardApi } from "@/services/api";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
// Dashboard uses specialized inline components (KPI, QA, SR, OR)
// Intentionally NOT shared — they have dashboard-specific features
// (highlight mode, delta badges, icon bg colors, hover effects)
// Shared components: Icon, DemoTour
import { DemoTour } from "@/components/DemoTour";

const { width: W } = Dimensions.get("window");
const IS = W > 768;
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtK = (n: number) => n >= 1000 ? `R$ ${(n / 1000).toFixed(1)}k` : fmt(n);
function grt(){const h=new Date().getHours();return h<12?"Bom dia":h<18?"Boa tarde":"Boa noite";}
function gm(){return new Date().toLocaleString("pt-BR",{month:"long"}).replace(/^\w/,c=>c.toUpperCase());}

const MOCK={revenue:18420,expenses:7840,net:10580,salesToday:47,avgTicket:391.91,newCustomers:12,revenueDelta:12,expensesDelta:3,netDelta:18,dasAlert:{days:14,amount:76.90},sparkRevenue:[12400,13800,15200,14100,16800,17200,18420],sparkExpenses:[6200,6800,7100,6900,7400,7600,7840],sparkNet:[6200,7000,8100,7200,9400,9600,10580],
recentSales:[{id:"1",customer:"Maria Silva",amount:156.80,time:"14:32",method:"Pix"},{id:"2",customer:"Pedro Costa",amount:89.90,time:"13:15",method:"Cartao"},{id:"3",customer:"Ana Oliveira",amount:234.50,time:"11:47",method:"Dinheiro"},{id:"4",customer:"Joao Santos",amount:67.00,time:"10:20",method:"Pix"}],
obligations:[{id:"1",name:"DAS-MEI",due:"20/04/2026",amount:76.90,status:"pending",category:"aura_resolve"},{id:"2",name:"DASN-SIMEI",due:"31/05/2026",amount:null,status:"future",category:"aura_facilita"},{id:"3",name:"FGTS",due:"07/04/2026",amount:320.00,status:"pending",category:"aura_resolve"},{id:"4",name:"eSocial",due:"15/04/2026",amount:null,status:"future",category:"aura_facilita"}]};

function Av({name}:{name:string}){return <View style={av.c}><Text style={av.l}>{(name||"A").charAt(0).toUpperCase()}</Text></View>;}
const av=StyleSheet.create({c:{width:42,height:42,borderRadius:21,backgroundColor:Colors.violet,alignItems:"center",justifyContent:"center"},l:{fontSize:16,fontWeight:"700",color:"#fff"}});

function PB({plan}:{plan:string}){const m:Record<string,string>={expansao:"Expansao",negocio:"Negocio",essencial:"Essencial"};return <View style={pb.b}><View style={pb.d}/><Text style={pb.t}>{m[plan]||plan}</Text></View>;}
const pb=StyleSheet.create({b:{flexDirection:"row",alignItems:"center",backgroundColor:Colors.violetD,borderRadius:20,paddingHorizontal:10,paddingVertical:4,gap:5},d:{width:6,height:6,borderRadius:3,backgroundColor:Colors.green},t:{fontSize:11,color:Colors.violet3,fontWeight:"600",letterSpacing:0.3}});

function HC({children,style,highlight,onPress}:{children:React.ReactNode;style?:any;highlight?:boolean;onPress?:()=>void}){
  const[h,sH]=useState(false);const w=Platform.OS==="web";
  return <Pressable onPress={onPress} onHoverIn={w?()=>sH(true):undefined} onHoverOut={w?()=>sH(false):undefined} style={[style,h&&{transform:[{translateY:-3},{scale:1.015}],borderColor:highlight?Colors.violet2:Colors.border2,shadowColor:Colors.violet,shadowOffset:{width:0,height:8},shadowOpacity:0.15,shadowRadius:20,elevation:8},w&&{transition:"all 0.25s cubic-bezier(0.4,0,0.2,1)"}as any]}>{children}</Pressable>;
}

function KPI({ic,iconColor,label,value,delta,deltaUp,large,onPress,sparkData,sparkColor,idx}:{ic:string;iconColor:string;label:string;value:string;delta?:string;deltaUp?:boolean;large?:boolean;onPress?:()=>void;idx?:number}){
  return <HC style={[k.card,large&&k.large,Platform.OS==="web"&&{animation:"auraStagger 0.5s ease-out both",animationDelay:(idx||0)*0.08+"s"}as any]} highlight={large} onPress={onPress}>
    <View style={k.header}><View style={[k.ic,{backgroundColor:iconColor+"22",borderColor:iconColor+"44"}]}><Icon name={ic as any} size={20} color={iconColor}/></View>{large&&<View style={[k.sb,{backgroundColor:iconColor+"18"}]}><Text style={[k.st,{color:iconColor}]}>Destaque</Text></View>}</View>
    <Text style={[k.val,large&&{fontSize:28}]}>{value}</Text><Text style={k.lb}>{label}</Text>
    {delta&&<View style={[k.db,{backgroundColor:deltaUp?Colors.greenD:Colors.redD}]}><Text style={[k.dt,{color:deltaUp?Colors.green:Colors.red}]}>{deltaUp?"+":"-"} {delta}</Text></View>}
    {sparkData && <Sparkline data={sparkData} color={sparkColor || Colors.violet3} />}
  </HC>;
}
const k=StyleSheet.create({card:{backgroundColor:Colors.bg3,borderRadius:16,padding:18,borderWidth:1,borderColor:Colors.border,flex:1,minWidth:IS?160:"45%",margin:5},large:{borderColor:Colors.border2,backgroundColor:Colors.bg4,borderWidth:1.5,minWidth:IS?260:"45%",flex:2},header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:14},ic:{width:40,height:40,borderRadius:12,alignItems:"center",justifyContent:"center",borderWidth:1},sb:{borderRadius:6,paddingHorizontal:8,paddingVertical:3},st:{fontSize:9,fontWeight:"700",letterSpacing:0.3},val:{fontSize:22,fontWeight:"800",color:Colors.ink,letterSpacing:-0.5,marginBottom:4},lb:{fontSize:11,color:Colors.ink3,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10},db:{alignSelf:"flex-start",borderRadius:6,paddingHorizontal:8,paddingVertical:3},dt:{fontSize:10,fontWeight:"600"}});

function QA({ic,iconColor,label,onPress}:{ic:string;iconColor:string;label:string;onPress?:()=>void}){
  const[h,sH]=useState(false);const w=Platform.OS==="web";
  return <Pressable style={[qa.btn,w&&{transition:"all 0.2s ease"}as any]} onHoverIn={w?()=>sH(true):undefined} onHoverOut={w?()=>sH(false):undefined} onPress={onPress}>
    <View style={[qa.iw,{borderColor:iconColor+"33"},h&&{backgroundColor:iconColor+"18",borderColor:iconColor+"55",animation:"auraBounce 0.4s ease"},w&&{transition:"all 0.2s ease"}as any]}><Icon name={ic as any} size={22} color={iconColor}/></View>
    <Text style={[qa.lb,h&&{color:Colors.ink}]}>{label}</Text>
  </Pressable>;
}
const qa=StyleSheet.create({btn:{alignItems:"center",gap:8,minWidth:72},iw:{width:52,height:52,borderRadius:16,backgroundColor:Colors.bg3,borderWidth:1.5,alignItems:"center",justifyContent:"center"},lb:{fontSize:10,color:Colors.ink3,fontWeight:"600",textAlign:"center"}});

function SR({customer,amount,time,method,onPress}:{customer:string;amount:number;time:string;method?:string;onPress?:()=>void}){
  const[h,sH]=useState(false);const w=Platform.OS==="web";
  return <Pressable onPress={onPress} style={[sr.row,h&&{backgroundColor:Colors.bg4},w&&{transition:"background-color 0.15s ease"}as any]} onHoverIn={w?()=>sH(true):undefined} onHoverOut={w?()=>sH(false):undefined}>
    <View style={sr.left}><View style={sr.av}><Text style={sr.at}>{customer.charAt(0)}</Text></View><View><Text style={sr.nm}>{customer}</Text><Text style={sr.tm}>{time}{method?(" / "+method):""}</Text></View></View>
    <Text style={sr.am}>+{fmt(amount)}</Text>
  </Pressable>;
}
const sr=StyleSheet.create({row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:12,paddingHorizontal:8,borderRadius:10,borderBottomWidth:1,borderBottomColor:Colors.border},left:{flexDirection:"row",alignItems:"center",gap:12},av:{width:34,height:34,borderRadius:17,backgroundColor:Colors.bg4,alignItems:"center",justifyContent:"center"},at:{fontSize:12,fontWeight:"600",color:Colors.violet3},nm:{fontSize:13,color:Colors.ink,fontWeight:"500"},tm:{fontSize:11,color:Colors.ink3,marginTop:1},am:{fontSize:13,color:Colors.green,fontWeight:"600"}});

function OR({name,due,amount,status,category,onPress}:{name:string;due:string;amount:number|null;status:string;category:string;onPress?:()=>void}){
  const[h,sH]=useState(false);const w=Platform.OS==="web";const sc=status==="pending"?Colors.amber:Colors.ink3;const cl=category==="aura_resolve"?"Aura resolve":"Aura facilita, você resolve";const cc=category==="aura_resolve"?Colors.green:Colors.amber;
  return <Pressable onPress={onPress} style={[ob.row,h&&{backgroundColor:Colors.bg4},w&&{transition:"background-color 0.15s ease"}as any]} onHoverIn={w?()=>sH(true):undefined} onHoverOut={w?()=>sH(false):undefined}>
    <View style={ob.left}><View style={[ob.dot,{backgroundColor:sc}]}/><View><Text style={ob.nm}>{name}</Text><Text style={ob.du}>Vencimento: {due}</Text></View></View>
    <View style={ob.right}>{amount!=null&&<Text style={ob.am}>{fmt(amount)}</Text>}<View style={[ob.cb,{backgroundColor:cc+"18"}]}><Text style={[ob.ct,{color:cc}]}>{cl}</Text></View></View>
  </Pressable>;
}
const ob=StyleSheet.create({row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:12,paddingHorizontal:8,borderRadius:10,borderBottomWidth:1,borderBottomColor:Colors.border},left:{flexDirection:"row",alignItems:"center",gap:10},dot:{width:8,height:8,borderRadius:4},nm:{fontSize:13,color:Colors.ink,fontWeight:"500"},du:{fontSize:11,color:Colors.ink3,marginTop:1},right:{alignItems:"flex-end",gap:4},am:{fontSize:13,color:Colors.ink,fontWeight:"600"},cb:{borderRadius:6,paddingHorizontal:8,paddingVertical:2},ct:{fontSize:9,fontWeight:"600",letterSpacing:0.3}});


// W-02: Count-up
function useCountUp(target, dur) { dur = dur || 1200; const [v, sv] = useState(0); const r = useRef(null); useEffect(function(){ var t0 = Date.now(); function tick(){ var p = Math.min((Date.now()-t0)/dur,1); sv(Math.floor(target*(1-Math.pow(1-p,3)))); if(p<1) r.current=requestAnimationFrame(tick); } r.current=requestAnimationFrame(tick); return function(){cancelAnimationFrame(r.current)}; },[target]); return v; }

// W-03: Sparkline
function Sparkline({ data, color, w, h }) { w=w||60; h=h||20; if(Platform.OS!=="web"||!data||data.length<2) return null; var mx=Math.max.apply(null,data),mn=Math.min.apply(null,data),r=mx-mn||1; var pts=data.map(function(v,i){return((i/(data.length-1))*w)+","+(h-((v-mn)/r)*(h-4)-2)}).join(" "); return <div style={{width:w,height:h,marginTop:4}} dangerouslySetInnerHTML={{__html:'<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/></svg>'}} />; }
export default function DashboardScreen(){
  const{user,company,token,isDemo,logout}=useAuthStore();const router=useRouter();
  const{data}=useQuery({queryKey:["dashboard",company?.id],queryFn:()=>dashboardApi.summary(company!.id,token!),enabled:!!company?.id&&!!token&&!isDemo,retry:1});
  const d=isDemo?MOCK:(data??MOCK);const greeting=grt();const month=gm();const year=new Date().getFullYear();const go=(p:string)=>router.push(p as any);

  return (
    <View style={{flex:1}}>
      <DemoTour visible={isDemo} />
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.header}>
          <View style={s.hl}><Av name={user?.name??"A"}/><View><Text style={s.gr}>{greeting}, {user?.name?.split(" ")[0]??"usuario"}</Text><Text style={s.cn}>{company?.name??"---"}</Text></View></View>
          <View style={s.hr}><PB plan={company?.plan??"essencial"}/><TouchableOpacity onPress={logout} style={s.lo}><View style={{flexDirection:"row",alignItems:"center",gap:5}}><Icon name="logout" size={14} color={Colors.ink3}/><Text style={s.lt}>Sair</Text></View></TouchableOpacity></View>
        </View>

        <HC style={s.hero} onPress={()=>go("/financeiro")}>
          <View style={s.ht}><Text style={s.he}>{month} {year}</Text><View style={s.hb}><View style={s.hd}/><Text style={s.hx}>Saudável</Text></View></View>
          <Text style={s.hv}>{fmt(useCountUp(d.net))}</Text><Text style={s.hl2}>Lucro líquido do mês</Text>
          {d.dasAlert&&<Pressable onPress={()=>go("/contabilidade")} style={s.da}><Icon name="alert" size={16} color={Colors.amber}/><Text style={s.dt}>DAS vence em {d.dasAlert.days} dias - estimativa {fmt(d.dasAlert.amount)}</Text><Text style={s.dl}>Ver</Text></Pressable>}
        </HC>

        <Text style={s.sec}>Visão geral</Text>
        <View style={s.grid}>
          <KPI idx={0} ic="dollar" iconColor={Colors.green} label="RECEITA DO MÊS" value={fmtK(d.revenue)} delta={`${d.revenueDelta}% vs anterior`} deltaUp large onPress={()=>go("/financeiro")} sparkData={d.sparkRevenue} sparkColor={Colors.green}/>
          <KPI idx={1} ic="trending_down" iconColor={Colors.red} label="DESPESAS" value={fmtK(d.expenses)} delta={`${d.expensesDelta}% vs anterior`} deltaUp={false} onPress={()=>go("/financeiro")} sparkData={d.sparkExpenses} sparkColor={Colors.red}/>
          <KPI idx={2} ic="trending_up" iconColor={Colors.green} label="LUCRO LÍQUIDO" value={fmtK(d.net)} delta={`${d.netDelta}% vs anterior`} deltaUp large onPress={()=>go("/financeiro")} sparkData={d.sparkNet} sparkColor={Colors.green}/>
          <KPI idx={3} ic="bag" iconColor={Colors.violet3} label="VENDAS HOJE" value={String(d.salesToday)} onPress={()=>go("/pdv")}/>
          <KPI idx={4} ic="receipt" iconColor={Colors.amber} label="TICKET MÉDIO" value={fmt(d.avgTicket)} onPress={()=>go("/financeiro")}/>
          <KPI idx={5} ic="user_plus" iconColor={Colors.violet3} label="CLIENTES NOVOS" value={String(d.newCustomers)} delta="este mes" deltaUp onPress={()=>go("/clientes")}/>
        </View>

        <Text style={s.sec}>Acesso rápido</Text>
        <View style={s.acts}>
          <QA ic="cart" iconColor={Colors.green} label="PDV" onPress={()=>go("/pdv")}/>
          <QA ic="wallet" iconColor={Colors.violet3} label="Financeiro" onPress={()=>go("/financeiro")}/>
          <QA ic="package" iconColor={Colors.amber} label="Estoque" onPress={()=>go("/estoque")}/>
          <QA ic="file_text" iconColor={Colors.red} label="NF-e" onPress={()=>go("/nfe")}/>
          <QA ic="calculator" iconColor="#8b5cf6" label="Contabil" onPress={()=>go("/contabilidade")}/>
        </View>

        <View style={s.sh}><Text style={s.sec}>Obrigações contábeis</Text><View style={s.db2}><Text style={s.dt2}>Estimativa</Text></View></View>
        <HC style={s.lc} onPress={()=>go("/contabilidade")}>
          {(d.obligations??MOCK.obligations).map((o:any)=><OR key={o.id} name={o.name} due={o.due} amount={o.amount} status={o.status} category={o.category} onPress={()=>go("/contabilidade")}/>)}
          <View style={s.lf}><Text style={s.lft}>Apoio contábil informativo</Text></View>
        </HC>

        <View style={s.sh}><Text style={s.sec}>Últimas vendas</Text><TouchableOpacity onPress={()=>go("/financeiro")}><Text style={s.sa}>Ver todas</Text></TouchableOpacity></View>
        <HC style={s.lc}>
          {(d.recentSales??MOCK.recentSales).map((sl:any)=><SR key={sl.id} customer={sl.customer} amount={sl.amount} time={sl.time} method={sl.method} onPress={()=>go("/clientes")}/>)}
        </HC>

        {isDemo&&<View style={s.dm}><Text style={s.dmt}>Modo demonstrativo - dados ilustrativos</Text></View>}
      </ScrollView>
    </View>
  );
}

const s=StyleSheet.create({
  scroll:{flex:1},
  content:{padding:IS?32:20,paddingBottom:48,maxWidth:960,alignSelf:"center",width:"100%"},
  header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:24},
  hl:{flexDirection:"row",alignItems:"center",gap:12},hr:{flexDirection:"row",alignItems:"center",gap:12},
  gr:{fontSize:16,color:Colors.ink,fontWeight:"600"},cn:{fontSize:12,color:Colors.ink3,marginTop:2},
  lo:{paddingHorizontal:12,paddingVertical:6,borderRadius:6,borderWidth:1,borderColor:Colors.border},lt:{fontSize:11,color:Colors.ink3,fontWeight:"500"},
  hero:{backgroundColor:Colors.bg3,borderRadius:20,padding:24,borderWidth:1,borderColor:Colors.border2,marginBottom:28},
  ht:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  he:{fontSize:11,color:Colors.violet3,textTransform:"uppercase",letterSpacing:1,fontWeight:"600"},
  hb:{flexDirection:"row",alignItems:"center",gap:5,backgroundColor:Colors.greenD,borderRadius:20,paddingHorizontal:10,paddingVertical:4},
  hd:{width:6,height:6,borderRadius:3,backgroundColor:Colors.green},hx:{fontSize:11,color:Colors.green,fontWeight:"600"},
  hv:{fontSize:36,fontWeight:"800",color:Colors.ink,letterSpacing:-1,marginBottom:4},hl2:{fontSize:13,color:Colors.ink3,marginBottom:16},
  da:{flexDirection:"row",alignItems:"center",gap:8,backgroundColor:Colors.amberD,borderRadius:10,padding:12},
  dt:{fontSize:12,color:Colors.amber,fontWeight:"500",flex:1},dl:{fontSize:12,color:Colors.violet3,fontWeight:"600"},
  sec:{fontSize:15,color:Colors.ink,fontWeight:"600",marginBottom:14},sh:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:14},
  grid:{flexDirection:"row",flexWrap:"wrap",marginHorizontal:-5,marginBottom:28},
  acts:{flexDirection:"row",gap:16,marginBottom:28,paddingVertical:4},
  sa:{fontSize:12,color:Colors.violet3,fontWeight:"500"},
  db2:{backgroundColor:Colors.amberD,borderRadius:6,paddingHorizontal:8,paddingVertical:3},dt2:{fontSize:9,color:Colors.amber,fontWeight:"600",letterSpacing:0.3},
  lc:{backgroundColor:Colors.bg3,borderRadius:16,padding:12,borderWidth:1,borderColor:Colors.border,marginBottom:24},
  lf:{paddingTop:10,alignItems:"center"},lft:{fontSize:10,color:Colors.ink3,fontStyle:"italic"},
  dm:{alignSelf:"center",backgroundColor:Colors.violetD,borderRadius:20,paddingHorizontal:16,paddingVertical:8,marginTop:8},dmt:{fontSize:11,color:Colors.violet3,fontWeight:"500"},
});
