import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Image } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";

const LOGO="https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Aura.jpeg";
const NAV=[{s:"Principal",i:[{r:"/",l:"Painel",ic:"dashboard"},{r:"/financeiro",l:"Financeiro",ic:"wallet"},{r:"/nfe",l:"NF-e",ic:"file_text"}]},{s:"Contabil",i:[{r:"/contabilidade",l:"Contabilidade",ic:"calculator"}]},{s:"Vendas",i:[{r:"/pdv",l:"PDV",ic:"cart"},{r:"/estoque",l:"Estoque",ic:"package"}]},{s:"Equipe",i:[{r:"/folha",l:"Folha de Pagamento",ic:"payroll"}]},{s:"Clientes",i:[{r:"/clientes",l:"Clientes",ic:"users"}]}];
const MTABS=[{r:"/",l:"Painel",ic:"dashboard"},{r:"/pdv",l:"PDV",ic:"cart"},{r:"/financeiro",l:"Fin",ic:"wallet"},{r:"/clientes",l:"Clientes",ic:"users"},{r:"/contabilidade",l:"Contabil",ic:"calculator"}];
const GRAD=`radial-gradient(ellipse at 20% 0%,rgba(109,40,217,0.12) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(139,92,246,0.08) 0%,transparent 45%),radial-gradient(ellipse at 50% 50%,rgba(91,140,255,0.05) 0%,transparent 60%),${Colors.bg}`;

function isA(p:string,r:string){if(r==="/")return p==="/"||p===""||p.endsWith("/index")||p==="/(tabs)";return p.includes(r.replace("/",""));}

function SI({l,ic,a,onP}:{l:string;ic:string;a:boolean;onP:()=>void}){
  const [h,sH]=useState(false);
  return <Pressable onPress={onP} onHoverIn={()=>sH(true)} onHoverOut={()=>sH(false)} style={[si.item,a&&si.active,h&&!a&&si.hovered,{transition:"all 0.15s ease"}as any]}>
    <View style={[si.ib,a&&si.iba]}><Icon name={ic as any} size={16} color={a?"#fff":Colors.ink3}/></View>
    <Text style={[si.lb,a&&si.lba,h&&!a&&si.lbh]}>{l}</Text>
  </Pressable>;
}
const si=StyleSheet.create({item:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:9,paddingHorizontal:12,borderRadius:10,marginBottom:2},active:{backgroundColor:Colors.violetD},hovered:{backgroundColor:"rgba(255,255,255,0.03)"},ib:{width:30,height:30,borderRadius:8,backgroundColor:Colors.bg4,alignItems:"center",justifyContent:"center"},iba:{backgroundColor:Colors.violet},lb:{fontSize:13,color:Colors.ink3,fontWeight:"500"},lba:{color:Colors.ink,fontWeight:"600"},lbh:{color:Colors.ink2}});

function Sidebar(){
  const p=usePathname(),ro=useRouter(),{user:u,company:co,logout}=useAuthStore();
  const pl=co?.plan==="negocio"?"Negocio":co?.plan==="expansao"?"Expansao":"Essencial";
  return <View style={sb.c}>
    <Pressable onPress={()=>ro.push("/")} style={sb.lw}><Image source={{uri:LOGO}} style={sb.lo} resizeMode="contain"/></Pressable>
    <View style={sb.d}/>
    <ScrollView style={sb.n} showsVerticalScrollIndicator={false}>{NAV.map(s=><View key={s.s} style={sb.sc}><Text style={sb.sl}>{s.s}</Text>{s.i.map(i=><SI key={i.r} l={i.l} ic={i.ic} a={isA(p,i.r)} onP={()=>ro.push(i.r as any)}/>)}</View>)}</ScrollView>
    <View style={sb.d}/>
    <View style={sb.f}>
      <View style={sb.ur}><View style={sb.av}><Text style={sb.at}>{(u?.name||"A").charAt(0).toUpperCase()}</Text></View><View style={sb.ui}><Text style={sb.un} numberOfLines={1}>{u?.name||"---"}</Text><Text style={sb.up}>{pl}</Text></View></View>
      <Pressable onPress={logout} style={sb.lb}><View style={{flexDirection:"row",alignItems:"center",gap:6}}><Icon name="logout" size={14} color={Colors.ink3}/><Text style={sb.lt}>Sair</Text></View></Pressable>
    </View>
  </View>;
}
const sb=StyleSheet.create({c:{width:240,backgroundColor:Colors.bg2,borderRightWidth:1,borderRightColor:Colors.border,paddingTop:20,paddingBottom:16,paddingHorizontal:14,justifyContent:"flex-start"},lw:{paddingHorizontal:8,paddingBottom:16,alignItems:"flex-start"},lo:{width:100,height:36},d:{height:1,backgroundColor:Colors.border,marginVertical:8},n:{flex:1,marginTop:4},sc:{marginBottom:16},sl:{fontSize:10,color:Colors.ink3,fontWeight:"600",textTransform:"uppercase",letterSpacing:1.2,paddingHorizontal:12,marginBottom:6},f:{paddingTop:8},ur:{flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:4,marginBottom:10},av:{width:34,height:34,borderRadius:17,backgroundColor:Colors.violet,alignItems:"center",justifyContent:"center"},at:{fontSize:13,fontWeight:"700",color:"#fff"},ui:{flex:1},un:{fontSize:12,color:Colors.ink,fontWeight:"600"},up:{fontSize:10,color:Colors.violet3,marginTop:1},lb:{paddingVertical:8,paddingHorizontal:12,borderRadius:8,borderWidth:1,borderColor:Colors.border,alignItems:"center"},lt:{fontSize:11,color:Colors.ink3,fontWeight:"500"}});

function MBar(){
  const p=usePathname(),ro=useRouter();
  return <View style={mb.b}>{MTABS.map(t=>{const a=isA(p,t.r);return <Pressable key={t.r} style={mb.t} onPress={()=>ro.push(t.r as any)}><View style={[mb.iw,a&&mb.ia]}><Icon name={t.ic as any} size={18} color={a?Colors.violet3:Colors.ink3}/></View><Text style={[mb.lb,a&&mb.la]}>{t.l}</Text></Pressable>;})}</View>;
}
const mb=StyleSheet.create({b:{flexDirection:"row",backgroundColor:Colors.bg2,borderTopWidth:1,borderTopColor:Colors.border,paddingBottom:Platform.OS==="ios"?20:6,paddingTop:6},t:{flex:1,alignItems:"center",gap:3},iw:{width:32,height:32,borderRadius:10,alignItems:"center",justifyContent:"center"},ia:{backgroundColor:Colors.violetD},lb:{fontSize:9,color:Colors.ink3,fontWeight:"500"},la:{color:Colors.violet3,fontWeight:"600"}});

export default function TabsLayout(){
  const w=Platform.OS==="web";
  if(w) return (
    <div style={{display:"flex",flexDirection:"row",height:"100vh",width:"100%",background:Colors.bg} as any}>
      <Sidebar/>
      <div style={{flex:1,minHeight:"100%",background:GRAD,overflow:"auto"} as any}>
        <PageTransition><Slot/></PageTransition>
      </div>
    </div>
  );
  return <View style={{flex:1,backgroundColor:Colors.bg}}><View style={{flex:1}}><PageTransition><Slot/></PageTransition></View><MBar/></View>;
}
