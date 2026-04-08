import { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";

const IS = typeof window !== 'undefined' ? window.innerWidth > 768 : Dimensions.get('window').width > 768;
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const TABS = ["Clientes", "Ranking", "Retencao"];

function getStatus(c: { visits: number; totalSpent: number; lastPurchase: string }): string[] {
  const t: string[] = [];
  if (c.totalSpent >= 2000) t.push("VIP");
  if (c.visits >= 10) t.push("Frequente");
  if (c.visits <= 3) t.push("Novo");
  const p = c.lastPurchase.split("/");
  if (p.length === 3) { const d = new Date(+p[2], +p[1]-1, +p[0]); if ((Date.now()-d.getTime())/864e5 > 30) t.push("Inativo"); }
  return t;
}

type Cust = { id:string;name:string;email:string;phone:string;instagram:string;birthday:string;lastPurchase:string;totalSpent:number;visits:number;firstVisit:string;notes:string;rating:number|null };
const RET = { newM:3, ret:5, ina:1, avgT:391.91, avgV:13.6, bdays:[{ name:"Joao Santos", date:"08/04", days:10 }] };

function Tag({ tag }: { tag: string }) {
  const m: Record<string,{b:string;f:string}> = { VIP:{b:Colors.violetD,f:Colors.violet3}, Frequente:{b:Colors.greenD,f:Colors.green}, Novo:{b:Colors.amberD,f:Colors.amber}, Inativo:{b:Colors.redD,f:Colors.red} };
  const c = m[tag]||{b:Colors.bg4,f:Colors.ink3};
  return <View style={{borderRadius:6,paddingHorizontal:7,paddingVertical:2,backgroundColor:c.b}}><Text style={{fontSize:9,fontWeight:"600",color:c.f,letterSpacing:0.3}}>{tag}</Text></View>;
}
function Stars({ r }: { r: number|null }) {
  if (r==null) return <Text style={{fontSize:10,color:Colors.ink3}}>Sem avaliacao</Text>;
  return <View style={{flexDirection:"row",gap:2}}>{[1,2,3,4,5].map(i=><Text key={i} style={{fontSize:12,color:i<=r?Colors.amber:Colors.ink3}}>*</Text>)}</View>;
}
function SC({ l,v,c,sub }:{l:string;v:string;c?:string;sub?:string}) {
  const [h,sH]=useState(false); const w=Platform.OS==="web";
  return <Pressable onHoverIn={w?()=>sH(true):undefined} onHoverOut={w?()=>sH(false):undefined} style={[{backgroundColor:Colors.bg3,borderRadius:14,padding:16,borderWidth:1,borderColor:Colors.border,flex:1,minWidth:IS?140:"45%",margin:4},h&&{transform:[{translateY:-2}],borderColor:Colors.border2},w&&{transition:"all 0.2s ease"}as any]}><Text style={{fontSize:10,color:Colors.ink3,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>{l}</Text><Text style={{fontSize:20,fontWeight:"800",color:c||Colors.ink,letterSpacing:-0.5}}>{v}</Text>{sub&&<Text style={{fontSize:10,color:Colors.ink3,marginTop:4}}>{sub}</Text>}</Pressable>;
}
function TB({ a,onS }:{a:number;onS:(i:number)=>void}) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginBottom:20}} contentContainerStyle={{flexDirection:"row",gap:6}}>
{TABS.map((t,i)=><Pressable key={t} onPress={()=>onS(i)} style={[{paddingHorizontal:16,paddingVertical:9,borderRadius:10,backgroundColor:Colors.bg3,borderWidth:1,borderColor:Colors.border},a===i&&{backgroundColor:Colors.violet,borderColor:Colors.violet}]}><Text style={[{fontSize:13,color:Colors.ink3,fontWeight:"500"},a===i&&{color:"#fff",fontWeight:"600"}]}>{t}</Text></Pressable>)}</ScrollView>;
}

function AddForm({ onSave,onX }:{onSave:(c:Cust)=>void;onX:()=>void}) {
  const [n,sN]=useState("");const [p,sP]=useState("");const [e,sE]=useState("");const [ig,sI]=useState("");const [bd,sB]=useState("");const [nt,sNt]=useState("");
  function save(){ if(!n.trim()){toast.error("Preencha o nome");return;} onSave({id:Date.now().toString(),name:n.trim(),email:e.trim(),phone:p.trim(),instagram:ig.trim(),birthday:bd.trim(),lastPurchase:"---",totalSpent:0,visits:0,firstVisit:new Date().toLocaleDateString("pt-BR"),notes:nt.trim(),rating:null}); }
  const i={backgroundColor:Colors.bg4,borderRadius:10,borderWidth:1,borderColor:Colors.border,paddingHorizontal:14,paddingVertical:11,fontSize:13,color:Colors.ink} as any;
  return <View style={{backgroundColor:Colors.bg3,borderRadius:20,padding:24,borderWidth:1,borderColor:Colors.border2,marginBottom:24}}>
    <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><Text style={{fontSize:20,color:Colors.ink,fontWeight:"700"}}>Adicionar cliente</Text><Pressable onPress={onX} style={{width:32,height:32,borderRadius:8,backgroundColor:Colors.bg4,alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:16,color:Colors.ink3,fontWeight:"600"}}>x</Text></Pressable></View>
    <Text style={{fontSize:12,color:Colors.ink3,marginBottom:16}}>Campos com * sao obrigatorios.</Text>
    <Text style={{fontSize:12,color:Colors.ink3,fontWeight:"600",marginBottom:6}}>Nome completo *</Text>
    <TextInput style={i} value={n} onChangeText={sN} placeholder="Ex: Maria da Silva" placeholderTextColor={Colors.ink3} />
    <View style={{height:16}} />
    <View style={{flexDirection:IS?"row":"column",gap:IS?12:0}}>
      <View style={{flex:1}}><Text style={{fontSize:12,color:Colors.ink3,fontWeight:"600",marginBottom:6}}>Telefone / WhatsApp</Text><TextInput style={i} value={p} onChangeText={sP} placeholder="(12) 99999-0000" placeholderTextColor={Colors.ink3} keyboardType="phone-pad" /><View style={{height:16}} /></View>
      <View style={{flex:1}}><Text style={{fontSize:12,color:Colors.ink3,fontWeight:"600",marginBottom:6}}>E-mail</Text><TextInput style={i} value={e} onChangeText={sE} placeholder="email@email.com" placeholderTextColor={Colors.ink3} keyboardType="email-address" autoCapitalize="none" /><View style={{height:16}} /></View>
    </View>
    <View style={{flexDirection:IS?"row":"column",gap:IS?12:0}}>
      <View style={{flex:1}}><Text style={{fontSize:12,color:Colors.ink3,fontWeight:"600",marginBottom:6}}>Instagram</Text><TextInput style={i} value={ig} onChangeText={sI} placeholder="@usuario" placeholderTextColor={Colors.ink3} autoCapitalize="none" /><View style={{height:16}} /></View>
      <View style={{flex:1}}><Text style={{fontSize:12,color:Colors.ink3,fontWeight:"600",marginBottom:6}}>Aniversario (dia/mes)</Text><TextInput style={i} value={bd} onChangeText={sB} placeholder="15/06" placeholderTextColor={Colors.ink3} /><View style={{height:16}} /></View>
    </View>
    <Text style={{fontSize:12,color:Colors.ink3,fontWeight:"600",marginBottom:6}}>Observacoes</Text>
    <TextInput style={[i,{minHeight:70,textAlignVertical:"top"}]} value={nt} onChangeText={sNt} placeholder="Preferencias, alergias, detalhes..." placeholderTextColor={Colors.ink3} multiline numberOfLines={3} />
    <View style={{flexDirection:"row",gap:10,justifyContent:"flex-end",marginTop:16}}>
      <Pressable onPress={onX} style={{paddingHorizontal:20,paddingVertical:12,borderRadius:10,borderWidth:1,borderColor:Colors.border}}><Text style={{fontSize:13,color:Colors.ink3,fontWeight:"500"}}>Cancelar</Text></Pressable>
      <Pressable onPress={save} style={{backgroundColor:Colors.violet,paddingHorizontal:24,paddingVertical:12,borderRadius:10}}><Text style={{fontSize:13,color:"#fff",fontWeight:"700"}}>Salvar cliente</Text></Pressable>
    </View>
  </View>;
}

function CRow({ c,exp,onE,onDelete }:{c:Cust;exp:boolean;onE:()=>void;onDelete?:(id:string)=>void}) {
  const [h,sH]=useState(false);const w=Platform.OS==="web";const tags=getStatus(c);
  return <View>
    <Pressable onPress={onE} onHoverIn={w?()=>sH(true):undefined} onHoverOut={w?()=>sH(false):undefined} style={[{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:12,paddingHorizontal:12,borderRadius:10,borderBottomWidth:1,borderBottomColor:Colors.border},h&&{backgroundColor:Colors.bg4},w&&{transition:"background-color 0.15s ease"}as any]}>
      <View style={{flexDirection:"row",alignItems:"center",gap:10,flex:1}}>
        <View style={{width:38,height:38,borderRadius:19,backgroundColor:Colors.violetD,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:Colors.border2}}><Text style={{fontSize:14,fontWeight:"700",color:Colors.violet3}}>{c.name.charAt(0)}</Text></View>
        <View style={{flex:1}}><Text style={{fontSize:13,color:Colors.ink,fontWeight:"600"}}>{c.name}</Text><Text style={{fontSize:11,color:Colors.ink3,marginTop:2}}>{c.phone}{c.instagram?" / "+c.instagram:""}</Text></View>
      </View>
      <View style={{alignItems:"flex-end",gap:4}}><Text style={{fontSize:13,color:Colors.green,fontWeight:"700"}}>{fmt(c.totalSpent)}</Text><View style={{flexDirection:"row",gap:4}}>{tags.slice(0,2).map(t=><Tag key={t} tag={t}/>)}</View></View>
    </Pressable>
    {exp&&<View style={{backgroundColor:Colors.bg4,borderRadius:12,padding:16,marginHorizontal:8,marginBottom:8,borderWidth:1,borderColor:Colors.border}}>
      <View style={{flexDirection:"row",flexWrap:"wrap",gap:4}}>
        {[["E-mail",c.email],["Telefone",c.phone],["Aniversario",c.birthday],["Instagram",c.instagram||"---"],["Primeira visita",c.firstVisit],["Ultima compra",c.lastPurchase],["Total gasto",fmt(c.totalSpent)],["Visitas",String(c.visits)]].map(([l,v])=><View key={l} style={{width:"30%",minWidth:100,paddingVertical:6,gap:3}}><Text style={{fontSize:10,color:Colors.ink3,textTransform:"uppercase",letterSpacing:0.5}}>{l}</Text><Text style={{fontSize:13,color:l==="Total gasto"?Colors.green:l==="Instagram"?Colors.violet3:Colors.ink,fontWeight:"600"}}>{v}</Text></View>)}
        <View style={{width:"30%",minWidth:100,paddingVertical:6,gap:3}}><Text style={{fontSize:10,color:Colors.ink3,textTransform:"uppercase",letterSpacing:0.5}}>Avaliacao</Text><Stars r={c.rating}/></View>
      </View>
      {c.notes?<Text style={{fontSize:11,color:Colors.ink3,fontStyle:"italic",marginTop:10,paddingTop:10,borderTopWidth:1,borderTopColor:Colors.border}}>{c.notes}</Text>:null}
      <View style={{marginTop:12,paddingTop:12,borderTopWidth:1,borderTopColor:Colors.border,gap:6}}>
        <Text style={{fontSize:11,color:Colors.ink3,fontWeight:"600",textTransform:"uppercase",letterSpacing:0.5}}>Status</Text>
        <View style={{flexDirection:"row",gap:6}}>{tags.map(t=><Tag key={t} tag={t}/>)}</View>
      </View>
      <View style={{flexDirection:"row",gap:8,marginTop:12,paddingTop:12,borderTopWidth:1,borderTopColor:Colors.border,flexWrap:"wrap"}}>
        {["Enviar WhatsApp","Pedir avaliacao","Ver historico"].map(a=><Pressable key={a} style={{backgroundColor:Colors.bg3,borderRadius:8,paddingHorizontal:12,paddingVertical:8,borderWidth:1,borderColor:Colors.border}}><Text style={{fontSize:11,color:Colors.violet3,fontWeight:"600"}}>{a}</Text></Pressable>)}
        {onDelete&&<Pressable onPress={()=>onDelete(c.id)} style={{backgroundColor:Colors.redD,borderRadius:8,paddingHorizontal:12,paddingVertical:8,borderWidth:1,borderColor:Colors.red+"33"}}><Text style={{fontSize:11,color:Colors.red,fontWeight:"600"}}>Excluir cliente</Text></Pressable>}
      </View>
    </View>}
  </View>;
}

function RRow({ c,rank,met }:{c:Cust;rank:number;met:"ltv"|"visits"}) {
  const [h,sH]=useState(false);const w=Platform.OS==="web";const mc=["",Colors.amber,Colors.ink3,"#cd7f32"];const col=rank<=3?mc[rank]:undefined;const tags=getStatus(c);
  return <Pressable onHoverIn={w?()=>sH(true):undefined} onHoverOut={w?()=>sH(false):undefined} style={[{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:12,paddingHorizontal:12,borderRadius:10,borderBottomWidth:1,borderBottomColor:Colors.border},h&&{backgroundColor:Colors.bg4},w&&{transition:"background-color 0.15s ease"}as any]}>
    <View style={[{width:30,height:30,borderRadius:8,alignItems:"center",justifyContent:"center",backgroundColor:Colors.bg4},col?{backgroundColor:col+"22"}:{}]}><Text style={[{fontSize:13,fontWeight:"800",color:Colors.ink3},col?{color:col}:{}]}>{rank}</Text></View>
    <View style={{width:34,height:34,borderRadius:17,backgroundColor:Colors.violetD,alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:12,fontWeight:"700",color:Colors.violet3}}>{c.name.charAt(0)}</Text></View>
    <View style={{flex:1,gap:4}}><Text style={{fontSize:13,color:Colors.ink,fontWeight:"600"}}>{c.name}</Text><View style={{flexDirection:"row",gap:4}}>{tags.slice(0,2).map(t=><Tag key={t} tag={t}/>)}</View></View>
    <Text style={{fontSize:14,color:Colors.green,fontWeight:"700"}}>{met==="ltv"?fmt(c.totalSpent):`${c.visits} visitas`}</Text>
  </Pressable>;
}

function RBar({l,v,tot,col}:{l:string;v:number;tot:number;col:string}) {
  const p=tot>0?(v/tot*100).toFixed(0):"0";
  return <View style={{gap:6}}><View style={{flexDirection:"row",justifyContent:"space-between"}}><Text style={{fontSize:12,color:Colors.ink,fontWeight:"500"}}>{l}</Text><Text style={{fontSize:12,fontWeight:"700",color:col}}>{v} clientes ({p}%)</Text></View><View style={{height:10,backgroundColor:Colors.bg4,borderRadius:5,overflow:"hidden"}}><View style={{height:10,borderRadius:5,width:`${p}%`,backgroundColor:col}}/></View></View>;
}

export default function ClientesScreen() {
  const { isDemo, company, token } = useAuthStore();
  const qc = useQueryClient();

  const { data: apiCustomers } = useQuery({
    queryKey: ["customers", company?.id],
    queryFn: () => companiesApi.customers(company!.id),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1,
    staleTime: 30000,
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (custId: string) => companiesApi.deleteCustomer(company!.id, custId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers", company?.id] }); toast.success("Cliente excluido"); },
    onError: () => toast.error("Erro ao excluir cliente"),
  });

  const addCustomerMutation = useMutation({
    mutationFn: (body: any) => companiesApi.createCustomer(company!.id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers", company?.id] }),
  });

  const scrollRef = useRef<any>(null);
  const [tab,sTab]=useState(0);
  const [q,sQ]=useState("");
  const [expId,sExp]=useState<string|null>(null);
  const [rm,sRm]=useState<"ltv"|"visits">("ltv");
  const [cust,sCust]=useState<Cust[]>([]);
  const [showAdd,sAdd]=useState(false);

  // Sync API data into local state
  const apiCustArr = (apiCustomers?.customers || apiCustomers?.rows || apiCustomers);
  useEffect(() => {
    if (apiCustArr instanceof Array) {
      const mapped = apiCustArr.map((c: any) => ({
        id: c.id || c.customer_id || String(Math.random()),
        name: c.name || c.customer_name || "Cliente",
        email: c.email || "",
        phone: c.phone || "",
        instagram: c.instagram || c.instagram_handle || "",
        birthday: c.birthday || c.birth_date || "",
        lastPurchase: c.last_purchase ? new Date(c.last_purchase).toLocaleDateString("pt-BR") : "---",
        totalSpent: parseFloat(c.total_spent ?? c.totalSpent ?? c.ltv) || 0,
        visits: parseInt(c.visit_count ?? c.visits) || 0,
        firstVisit: c.first_visit ? new Date(c.first_visit).toLocaleDateString("pt-BR") : c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "---",
        notes: c.notes || "",
        rating: c.rating != null ? parseInt(c.rating) : null,
      }));
      sCust(mapped);
    }
  }, [apiCustArr instanceof Array ? apiCustArr.length : 0]);

  function handleDeleteCustomer(id: string) {
    if (company?.id && !isDemo) {
      deleteCustomerMutation.mutate(id);
    }
  }

  function addC(c: Cust) {
    if (company?.id && !isDemo) {
      addCustomerMutation.mutate({ name: c.name, email: c.email, phone: c.phone, instagram_handle: c.instagram, birth_date: c.birthday, notes: c.notes }, {
        onSuccess: () => { toast.success("Cliente cadastrado!"); sAdd(false); },
        onError: () => { toast.error("Erro ao salvar cliente"); },
      });
    } else {
      sCust(p=>[c,...p]); sAdd(false);
    }
  }

  const fil=cust.filter(c=>{if(!q)return true;const s=q.toLowerCase();return c.name.toLowerCase().includes(s)||c.phone.includes(s)||c.email.toLowerCase().includes(s)||c.instagram.toLowerCase().includes(s);});
  const tot=cust.length;const ltv=cust.reduce((s,c)=>s+c.totalSpent,0);const rated=cust.filter(c=>c.rating!=null);const avg=rated.length?(rated.reduce((s,c)=>s+(c.rating||0),0)/rated.length).toFixed(1):"0";
  const ranked=[...cust].sort((a,b)=>rm==="ltv"?b.totalSpent-a.totalSpent:b.visits-a.visits);

  return <ScrollView ref={scrollRef} style={{flex:1,backgroundColor:"transparent"}} contentContainerStyle={{padding:IS?32:20,paddingBottom:48,maxWidth:960,alignSelf:"center",width:"100%"}}>
    <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
      <Text style={{fontSize:22,color:Colors.ink,fontWeight:"700"}}>Clientes</Text>
      <Pressable onPress={()=>{sAdd(true);sTab(0);}} style={{backgroundColor:Colors.violet,paddingHorizontal:18,paddingVertical:10,borderRadius:10}}><Text style={{color:"#fff",fontSize:13,fontWeight:"700"}}>+ Adicionar cliente</Text></Pressable>
    </View>
    <View style={{flexDirection:"row",flexWrap:"wrap",marginHorizontal:-4,marginBottom:16}}>
      <SC l="TOTAL CLIENTES" v={String(tot)}/><SC l="FATURAMENTO TOTAL" v={fmt(ltv)} c={Colors.green}/>
    </View>

    {showAdd&&<AddForm onSave={addC} onX={()=>sAdd(false)}/>}
    <TB a={tab} onS={(i: number) => { sTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }}/>

    {tab===0&&<View>
      <TextInput style={{backgroundColor:Colors.bg3,borderRadius:10,borderWidth:1,borderColor:Colors.border,paddingHorizontal:14,paddingVertical:11,fontSize:13,color:Colors.ink,marginBottom:16}} placeholder="Buscar por nome, telefone, email ou Instagram..." placeholderTextColor={Colors.ink3} value={q} onChangeText={sQ}/>
      <View style={{backgroundColor:Colors.bg3,borderRadius:16,padding:8,borderWidth:1,borderColor:Colors.border,marginBottom:20}}>
        {fil.length===0&&<View style={{alignItems:"center",paddingVertical:40}}><Text style={{fontSize:13,color:Colors.ink3}}>Nenhum cliente cadastrado</Text></View>}
        {fil.map(c=><CRow key={c.id} c={c} exp={expId===c.id} onE={()=>sExp(expId===c.id?null:c.id)} onDelete={handleDeleteCustomer}/>)}
      </View>
    </View>}

    {tab===1&&<View>
      <View style={{flexDirection:"row",gap:6,marginBottom:16}}>
        <Pressable onPress={()=>sRm("ltv")} style={[{paddingHorizontal:16,paddingVertical:9,borderRadius:10,backgroundColor:Colors.bg3,borderWidth:1,borderColor:Colors.border},rm==="ltv"&&{backgroundColor:Colors.violetD,borderColor:Colors.border2}]}><Text style={[{fontSize:13,color:Colors.ink3,fontWeight:"500"},rm==="ltv"&&{color:Colors.violet3,fontWeight:"600"}]}>Por faturamento</Text></Pressable>
        <Pressable onPress={()=>sRm("visits")} style={[{paddingHorizontal:16,paddingVertical:9,borderRadius:10,backgroundColor:Colors.bg3,borderWidth:1,borderColor:Colors.border},rm==="visits"&&{backgroundColor:Colors.violetD,borderColor:Colors.border2}]}><Text style={[{fontSize:13,color:Colors.ink3,fontWeight:"500"},rm==="visits"&&{color:Colors.violet3,fontWeight:"600"}]}>Por frequencia</Text></Pressable>
      </View>
      <View style={{backgroundColor:Colors.bg3,borderRadius:16,padding:8,borderWidth:1,borderColor:Colors.border,marginBottom:20}}>{ranked.map((c,i)=><RRow key={c.id} c={c} rank={i+1} met={rm}/>)}</View>
    </View>}

    {tab===2&&<View>
      <View style={{backgroundColor:Colors.bg3,borderRadius:16,padding:20,borderWidth:1,borderColor:Colors.border,marginBottom:20}}>
        <Text style={{fontSize:15,color:Colors.ink,fontWeight:"700",marginBottom:16}}>Composicao da base</Text>
        <Text style={{fontSize:12,color:Colors.ink3,lineHeight:18}}>As estatisticas de retencao serao calculadas automaticamente conforme voce cadastrar clientes e registrar vendas.</Text>
      </View>
    </View>}

    {isDemo&&<View style={{alignSelf:"center",backgroundColor:Colors.violetD,borderRadius:20,paddingHorizontal:16,paddingVertical:8,marginTop:8}}><Text style={{fontSize:11,color:Colors.violet3,fontWeight:"500"}}>Modo demonstrativo</Text></View>}
  </ScrollView>;
}
