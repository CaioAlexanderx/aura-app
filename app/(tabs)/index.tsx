import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, Dimensions, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { dashboardApi } from "@/services/api";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { DemoTour } from "@/components/DemoTour";
import { TrialBanner } from "@/components/TrialBanner";
import { SkeletonDashboard, SkeletonStyle } from "@/components/Skeleton";
import { toast } from "@/components/Toast";

const IS = typeof window !== 'undefined' ? window.innerWidth > 768 : Dimensions.get('window').width > 768;
const fmt = (n: number) => `R$ ${(n||0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtK = (n: number) => n >= 1000 ? `R$ ${(n / 1000).toFixed(1)}k` : fmt(n);
function grt(){const h=new Date().getHours();return h<12?"Bom dia":h<18?"Boa tarde":"Boa noite";}
function gm(){return new Date().toLocaleString("pt-BR",{month:"long"}).replace(/^\w/,c=>c.toUpperCase());}

const MOCK={revenue:18420,expenses:7840,net:10580,salesToday:1250,avgTicket:391.91,newCustomers:12,revenueDelta:12,expensesDelta:3,netDelta:18,dasAlert:{days:14,amount:76.90},sparkRevenue:[12400,13800,15200,14100,16800,17200,18420],sparkExpenses:[6200,6800,7100,6900,7400,7600,7840],sparkNet:[6200,7000,8100,7200,9400,9600,10580],
recentSales:[{id:"1",customer:"Maria Silva",amount:156.80,time:"14:32",method:"Pix"},{id:"2",customer:"Pedro Costa",amount:89.90,time:"13:15",method:"Cartao"},{id:"3",customer:"Ana Oliveira",amount:234.50,time:"11:47",method:"Dinheiro"},{id:"4",customer:"Joao Santos",amount:67.00,time:"10:20",method:"Pix"}],
obligations:[{id:"1",name:"DAS-MEI",due:"20/04/2026",amount:76.90,status:"pending",category:"aura_resolve"},{id:"2",name:"DASN-SIMEI",due:"31/05/2026",amount:null,status:"future",category:"aura_facilita"},{id:"3",name:"FGTS",due:"07/04/2026",amount:320.00,status:"pending",category:"aura_resolve"},{id:"4",name:"eSocial",due:"15/04/2026",amount:null,status:"future",category:"aura_facilita"}]};

const EMPTY_DATA={revenue:0,expenses:0,net:0,salesToday:0,avgTicket:0,newCustomers:0,revenueDelta:0,expensesDelta:0,netDelta:0,sparkRevenue:[],sparkExpenses:[],sparkNet:[],recentSales:[],obligations:[]};

function Av({name}:{name:string}){return <View style={av.c}><Text style={av.l}>{(name||"A").charAt(0).toUpperCase()}</Text></View>;}
const av=StyleSheet.create({c:{width:42,height:42,borderRadius:21,backgroundColor:Colors.violet,alignItems:"center",justifyContent:"center"},l:{fontSize:16,fontWeight:"700",color:"#fff"}});

function PB({plan}:{plan:string}){const m:Record<string,string>={expansao:"Expansao",negocio:"Negocio",essencial:"Essencial"};return <View style={pb.b}><View style={pb.d}/><Text style={pb.t}>{m[plan]||plan}</Text></View>;}
const pb=StyleSheet.create({b:{flexDirection:"row",alignItems:"center",backgroundColor:Colors.violetD,borderRadius:20,paddingHorizontal:10,paddingVertical:4,gap:5},d:{width:6,height:6,borderRadius:3,backgroundColor:Colors.green},t:{fontSize:11,color:Colors.violet3,fontWeight:"600",letterSpacing:0.3}});

function HC({children,style,onPress}:{children:React.ReactNode;style?:any;onPress?:()=>void}){
  return <Pressable onPress={onPress} style={style}>{children}</Pressable>;
}

function KPI({ic,iconColor,label,value,delta,deltaUp,large,onPress}:{ic:string;iconColor:string;label:string;value:string;delta?:string;deltaUp?:boolean;large?:boolean;onPress?:()=>void}){
  return <Pressable style={[k.card,large&&k.large]} onPress={onPress}>
    <View style={k.header}><View style={[k.ic,{backgroundColor:iconColor+"22",borderColor:iconColor+"44"}]}><Icon name={ic as any} size={20} color={iconColor}/></View>{large&&<View style={[k.sb,{backgroundColor:iconColor+"18"}]}><Text style={[k.st,{color:iconColor}]}>Destaque</Text></View>}</View>
    <Text style={[k.val,large&&{fontSize:28}]}>{value}</Text><Text style={k.lb}>{label}</Text>
    {delta&&<View style={[k.db,{backgroundColor:deltaUp?Colors.greenD:Colors.redD}]}><Text style={[k.dt,{color:deltaUp?Colors.green:Colors.red}]}>{deltaUp?"+":"-"} {delta}</Text></View>}
  </Pressable>;
}
const k=StyleSheet.create({card:{backgroundColor:Colors.bg3,borderRadius:16,padding:18,borderWidth:1,borderColor:Colors.border,flex:1,minWidth:IS?160:"45%",margin:5},large:{borderColor:Colors.border2,backgroundColor:Colors.bg4,borderWidth:1.5,minWidth:IS?260:"100%",flex:IS?2:undefined},header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:14},ic:{width:40,height:40,borderRadius:12,alignItems:"center",justifyContent:"center",borderWidth:1},sb:{borderRadius:6,paddingHorizontal:8,paddingVertical:3},st:{fontSize:9,fontWeight:"700",letterSpacing:0.3},val:{fontSize:22,fontWeight:"800",color:Colors.ink,letterSpacing:-0.5,marginBottom:4},lb:{fontSize:11,color:Colors.ink3,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10},db:{alignSelf:"flex-start",borderRadius:6,paddingHorizontal:8,paddingVertical:3},dt:{fontSize:10,fontWeight:"600"}});

function QA({ic,iconColor,label,onPress}:{ic:string;iconColor:string;label:string;onPress?:()=>void}){
  return <Pressable style={qa.btn} onPress={onPress}>
    <View style={[qa.iw,{borderColor:iconColor+"33"}]}><Icon name={ic as any} size={22} color={iconColor}/></View>
    <Text style={qa.lb}>{label}</Text>
  </Pressable>;
}
const qa=StyleSheet.create({btn:{alignItems:"center",gap:8,minWidth:72},iw:{width:52,height:52,borderRadius:16,backgroundColor:Colors.bg3,borderWidth:1.5,alignItems:"center",justifyContent:"center"},lb:{fontSize:10,color:Colors.ink3,fontWeight:"600",textAlign:"center"}});

function SR({customer,amount,time,method}:{customer:string;amount:number;time:string;method?:string}){
  return <View style={sr.row}>
    <View style={sr.left}><View style={sr.av}><Text style={sr.at}>{customer.charAt(0)}</Text></View><View><Text style={sr.nm}>{customer}</Text><Text style={sr.tm}>{time}{method?(" / "+method):""}</Text></View></View>
    <Text style={sr.am}>+{fmt(amount)}</Text>
  </View>;
}
const sr=StyleSheet.create({row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:12,paddingHorizontal:8,borderRadius:10,borderBottomWidth:1,borderBottomColor:Colors.border},left:{flexDirection:"row",alignItems:"center",gap:12},av:{width:34,height:34,borderRadius:17,backgroundColor:Colors.bg4,alignItems:"center",justifyContent:"center"},at:{fontSize:12,fontWeight:"600",color:Colors.violet3},nm:{fontSize:13,color:Colors.ink,fontWeight:"500"},tm:{fontSize:11,color:Colors.ink3,marginTop:1},am:{fontSize:13,color:Colors.green,fontWeight:"600"}});

function OR({name,due,amount,status,category}:{name:string;due:string;amount:number|null;status:string;category:string}){
  const sc=status==="pending"?Colors.amber:Colors.ink3;const cl=category==="aura_resolve"?"Aura resolve":"Aura facilita";const cc=category==="aura_resolve"?Colors.green:Colors.amber;
  return <View style={ob.row}>
    <View style={ob.left}><View style={[ob.dot,{backgroundColor:sc}]}/><View><Text style={ob.nm}>{name}</Text><Text style={ob.du}>Vencimento: {due}</Text></View></View>
    <View style={ob.right}>{amount!=null&&<Text style={ob.am}>{fmt(amount)}</Text>}<View style={[ob.cb,{backgroundColor:cc+"18"}]}><Text style={[ob.ct,{color:cc}]}>{cl}</Text></View></View>
  </View>;
}
const ob=StyleSheet.create({row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:12,paddingHorizontal:8,borderRadius:10,borderBottomWidth:1,borderBottomColor:Colors.border},left:{flexDirection:"row",alignItems:"center",gap:10},dot:{width:8,height:8,borderRadius:4},nm:{fontSize:13,color:Colors.ink,fontWeight:"500"},du:{fontSize:11,color:Colors.ink3,marginTop:1},right:{alignItems:"flex-end",gap:4,flexShrink:0},am:{fontSize:13,color:Colors.ink,fontWeight:"600"},cb:{borderRadius:6,paddingHorizontal:8,paddingVertical:2},ct:{fontSize:8,fontWeight:"600",letterSpacing:0.3}});

function EmptyDashboard({name,onPress}:{name:string;onPress:(p:string)=>void}){
  return (
    <View style={emp.wrap}>
      <View style={emp.iconWrap}><Icon name="star" size={32} color={Colors.violet3} /></View>
      <Text style={emp.title}>Bem-vindo, {name}!</Text>
      <Text style={emp.sub}>Seu dashboard vai ganhar vida conforme voce usar a Aura. Comece por uma dessas acoes:</Text>
      <View style={emp.actions}>
        <Pressable style={emp.action} onPress={()=>onPress("/financeiro")}><Icon name="dollar" size={18} color={Colors.green} /><Text style={emp.actionText}>Lancar receita</Text></Pressable>
        <Pressable style={emp.action} onPress={()=>onPress("/estoque")}><Icon name="package" size={18} color={Colors.amber} /><Text style={emp.actionText}>Cadastrar produto</Text></Pressable>
        <Pressable style={emp.action} onPress={()=>onPress("/clientes")}><Icon name="user_plus" size={18} color={Colors.violet3} /><Text style={emp.actionText}>Adicionar cliente</Text></Pressable>
      </View>
    </View>
  );
}
const emp=StyleSheet.create({wrap:{backgroundColor:Colors.bg3,borderRadius:20,padding:28,borderWidth:1,borderColor:Colors.border2,alignItems:"center",marginBottom:28},iconWrap:{width:64,height:64,borderRadius:32,backgroundColor:Colors.violetD,alignItems:"center",justifyContent:"center",marginBottom:16},title:{fontSize:20,fontWeight:"700",color:Colors.ink,marginBottom:8},sub:{fontSize:13,color:Colors.ink3,textAlign:"center",lineHeight:20,marginBottom:24,maxWidth:360},actions:{flexDirection:IS?"row":"column",gap:10,width:"100%"},action:{flexDirection:"row",alignItems:"center",gap:10,backgroundColor:Colors.bg4,borderRadius:12,padding:14,borderWidth:1,borderColor:Colors.border,flex:1},actionText:{fontSize:13,color:Colors.ink,fontWeight:"500"}});

export default function DashboardScreen(){
  const{user,company,token,isDemo,logout}=useAuthStore();
  const router=useRouter();

  const{data,isLoading,isError}=useQuery({
    queryKey:["dashboard",company?.id],
    queryFn: () => dashboardApi.aggregate(company!.id),
    enabled:!!company?.id&&!!token&&!isDemo,
    retry:1,
    staleTime: 60000,
  });

  useEffect(()=>{
    if(isError && !isDemo) toast.error("Erro ao carregar dashboard. Verifique sua conexao.");
  },[isError]);

  const d = isDemo ? MOCK : (data || EMPTY_DATA);
  const isEmpty = !isDemo && !isLoading && !isError && d.revenue === 0 && d.expenses === 0 && d.salesToday === 0;
  const greeting=grt();const month=gm();const year=new Date().getFullYear();
  const go=(p:string)=>router.push(p as any);

  return (
    <View style={{flex:1}}>
      <DemoTour visible={isDemo} />
      <TrialBanner />
      <SkeletonStyle />
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.header}>
          <View style={s.hl}><Av name={user?.name??"A"}/><View><Text style={s.gr}>{greeting}, {user?.name?.split(" ")[0]??"usuario"}</Text><Text style={s.cn}>{company?.name??"---"}</Text></View></View>
          <View style={s.hr}><PB plan={company?.plan??"essencial"}/><TouchableOpacity onPress={logout} style={s.lo}><View style={{flexDirection:"row",alignItems:"center",gap:5}}><Icon name="logout" size={14} color={Colors.ink3}/><Text style={s.lt}>Sair</Text></View></TouchableOpacity></View>
        </View>

        {isLoading && !isDemo && <SkeletonDashboard />}

        {isEmpty && <EmptyDashboard name={user?.name?.split(" ")[0]??"usuario"} onPress={go} />}

        {!isLoading && !isEmpty && <>
          <View style={s.hero}>
            <View style={s.ht}><Text style={s.he}>{month} {year}</Text><View style={s.hb}><View style={s.hd}/><Text style={s.hx}>{d.net >= 0 ? "Saudavel" : "Atencao"}</Text></View></View>
            <Text style={s.hv}>{fmt(d.net)}</Text><Text style={s.hl2}>Lucro liquido do mes</Text>
          </View>

          <Text style={s.sec}>Visao geral</Text>
          <View style={s.grid}>
            <KPI ic="dollar" iconColor={Colors.green} label="RECEITA DO MES" value={fmtK(d.revenue)} delta={d.revenueDelta ? `${d.revenueDelta}% vs anterior` : undefined} deltaUp={d.revenueDelta > 0} large onPress={()=>go("/financeiro")}/>
            <KPI ic="trending_down" iconColor={Colors.red} label="DESPESAS" value={fmtK(d.expenses)} delta={d.expensesDelta ? `${d.expensesDelta}% vs anterior` : undefined} deltaUp={false} onPress={()=>go("/financeiro")}/>
            <KPI ic="trending_up" iconColor={Colors.green} label="LUCRO LIQUIDO" value={fmtK(d.net)} delta={d.netDelta ? `${d.netDelta}% vs anterior` : undefined} deltaUp={d.netDelta > 0} large onPress={()=>go("/financeiro")}/>
            <KPI ic="bag" iconColor={Colors.violet3} label="VENDAS HOJE" value={fmt(d.salesToday)} onPress={()=>go("/pdv")}/>
            <KPI ic="receipt" iconColor={Colors.amber} label="TICKET MEDIO" value={fmt(d.avgTicket)} onPress={()=>go("/financeiro")}/>
            <KPI ic="user_plus" iconColor={Colors.violet3} label="CLIENTES NOVOS" value={String(d.newCustomers)} onPress={()=>go("/clientes")}/>
          </View>

          <Text style={s.sec}>Acesso rapido</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.actsScroll} contentContainerStyle={s.acts}>
            <QA ic="cart" iconColor={Colors.green} label="PDV" onPress={()=>go("/pdv")}/>
            <QA ic="wallet" iconColor={Colors.violet3} label="Financeiro" onPress={()=>go("/financeiro")}/>
            <QA ic="package" iconColor={Colors.amber} label="Estoque" onPress={()=>go("/estoque")}/>
            <QA ic="file_text" iconColor={Colors.red} label="NF-e" onPress={()=>go("/nfe")}/>
            <QA ic="calculator" iconColor="#8b5cf6" label="Contabil" onPress={()=>go("/contabilidade")}/>
            <QA ic="users" iconColor={Colors.violet3} label="Clientes" onPress={()=>go("/clientes")}/>
          </ScrollView>

          {(d.obligations && d.obligations.length > 0) && <>
            <View style={s.sh}><Text style={s.sec}>Obrigacoes contabeis</Text><View style={s.db2}><Text style={s.dt2}>Estimativa</Text></View></View>
            <View style={s.lc}>
              {d.obligations.map((o:any)=><OR key={o.id} name={o.name} due={o.due} amount={o.amount} status={o.status} category={o.category}/>)}
              <View style={s.lf}><Text style={s.lft}>Apoio contabil informativo</Text></View>
            </View>
          </>}

          {(d.recentSales && d.recentSales.length > 0) && <>
            <View style={s.sh}><Text style={s.sec}>Ultimas vendas</Text><TouchableOpacity onPress={()=>go("/financeiro")}><Text style={s.sa}>Ver todas</Text></TouchableOpacity></View>
            <View style={s.lc}>
              {d.recentSales.map((sl:any)=><SR key={sl.id} customer={sl.customer} amount={sl.amount} time={sl.time} method={sl.method}/>)}
            </View>
          </>}
        </>}

        {isDemo&&<View style={s.dm}><Text style={s.dmt}>Modo demonstrativo - dados ilustrativos</Text></View>}
      </ScrollView>
    </View>
  );
}

const s=StyleSheet.create({
  scroll:{flex:1},
  content:{padding:IS?32:20,paddingBottom:48,maxWidth:960,alignSelf:"center",width:"100%",overflow:"hidden"},
  header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:24,flexWrap:"wrap",gap:12,overflow:"hidden"},
  hl:{flexDirection:"row",alignItems:"center",gap:12},hr:{flexDirection:"row",alignItems:"center",gap:12},
  gr:{fontSize:16,color:Colors.ink,fontWeight:"600"},cn:{fontSize:12,color:Colors.ink3,marginTop:2},
  lo:{paddingHorizontal:12,paddingVertical:6,borderRadius:6,borderWidth:1,borderColor:Colors.border},lt:{fontSize:11,color:Colors.ink3,fontWeight:"500"},
  hero:{backgroundColor:Colors.bg3,borderRadius:20,padding:IS?24:18,borderWidth:1,borderColor:Colors.border2,marginBottom:28},
  ht:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  he:{fontSize:11,color:Colors.violet3,textTransform:"uppercase",letterSpacing:1,fontWeight:"600"},
  hb:{flexDirection:"row",alignItems:"center",gap:5,backgroundColor:Colors.greenD,borderRadius:20,paddingHorizontal:10,paddingVertical:4},
  hd:{width:6,height:6,borderRadius:3,backgroundColor:Colors.green},hx:{fontSize:11,color:Colors.green,fontWeight:"600"},
  hv:{fontSize:IS?36:28,fontWeight:"800",color:Colors.ink,letterSpacing:-1,marginBottom:4},hl2:{fontSize:13,color:Colors.ink3,marginBottom:16},
  sec:{fontSize:15,color:Colors.ink,fontWeight:"600",marginBottom:14},sh:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:14},
  grid:{flexDirection:"row",flexWrap:"wrap",marginHorizontal:-5,marginBottom:28},
  actsScroll:{flexGrow:0,marginBottom:28},
  acts:{flexDirection:"row",gap:16,paddingVertical:4,paddingRight:20},
  sa:{fontSize:12,color:Colors.violet3,fontWeight:"500"},
  db2:{backgroundColor:Colors.amberD,borderRadius:6,paddingHorizontal:8,paddingVertical:3},dt2:{fontSize:9,color:Colors.amber,fontWeight:"600",letterSpacing:0.3},
  lc:{backgroundColor:Colors.bg3,borderRadius:16,padding:12,borderWidth:1,borderColor:Colors.border,marginBottom:24},
  lf:{paddingTop:10,alignItems:"center"},lft:{fontSize:10,color:Colors.ink3,fontStyle:"italic"},
  dm:{alignSelf:"center",backgroundColor:Colors.violetD,borderRadius:20,paddingHorizontal:16,paddingVertical:8,marginTop:8},dmt:{fontSize:11,color:Colors.violet3,fontWeight:"500"},
});
