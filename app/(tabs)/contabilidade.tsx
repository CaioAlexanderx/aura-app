import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Image } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { TabBar } from "@/components/TabBar";
import { HoverCard } from "@/components/HoverCard";
import { HoverRow } from "@/components/HoverRow";
import { DemoBanner } from "@/components/DemoBanner";
import { PageHeader } from "@/components/PageHeader";

const TABS = ["Calendario", "Guias", "Historico"];
type Step = { text: string; auto: boolean; media: string | null; hint: string };
const OBLS = [
  { id:"1",name:"DAS-MEI",due:"20/04/2026",dl:21,tot:30,amt:76.90,st:"upcoming" as const,cat:"aura_resolve",desc:"Guia mensal que reune INSS, ISS e ICMS em um unico pagamento.",steps:[{text:"Aura calcula o valor automaticamente",auto:true,media:null,hint:"Com base no seu faturamento"},{text:"QR Code Pix gerado para pagamento",auto:true,media:"https://placehold.co/600x280/1a1a2e/7c3aed?text=QR+Code+Pix",hint:"Escaneie com seu app bancario"},{text:"Aura confirma o pagamento",auto:true,media:null,hint:"Notificacao automatica"}] },
  { id:"2",name:"FGTS",due:"07/04/2026",dl:8,tot:30,amt:320.00,st:"attention" as const,cat:"aura_resolve",desc:"Fundo de Garantia para funcionarios. Obrigatorio todo mes.",steps:[{text:"Aura calcula com base na folha",auto:true,media:null,hint:"8% sobre salario"},{text:"Guia GFIP gerada",auto:true,media:"https://placehold.co/600x280/1a1a2e/34d399?text=Guia+GFIP",hint:"Pronta para pagamento"},{text:"Aura confirma o pagamento",auto:true,media:null,hint:""}] },
  { id:"3",name:"eSocial",due:"15/04/2026",dl:16,tot:30,amt:null,st:"upcoming" as const,cat:"aura_facilita",desc:"Envio digital de informacoes sobre funcionarios ao governo.",steps:[{text:"Aura prepara os dados e gera o XML",auto:true,media:null,hint:"Arquivo na secao Documentos"},{text:"Acesse o portal gov.br/esocial",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Portal+eSocial",hint:"Use seu navegador"},{text:"Faca login com sua conta Gov.br",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Login+Gov.br",hint:"CPF e senha"},{text:"Clique em Enviar arquivo",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Botao+Enviar",hint:"Menu lateral esquerdo"},{text:"Selecione o XML da Aura",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Selecionar+XML",hint:"Pasta Downloads"},{text:"Confirme o envio - pronto!",auto:false,media:null,hint:"Mensagem de sucesso"}] },
  { id:"4",name:"DASN-SIMEI",due:"31/05/2026",dl:62,tot:365,amt:null,st:"future" as const,cat:"aura_facilita",desc:"Declaracao anual do faturamento do ano anterior.",steps:[{text:"Aura consolida seu faturamento",auto:true,media:null,hint:"Soma de todas as notas"},{text:"Aura pre-preenche a declaracao",auto:true,media:"https://placehold.co/600x280/1a1a2e/a78bfa?text=Dados+preenchidos",hint:"Revise antes de enviar"},{text:"Acesse o portal do Simples Nacional",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Portal+Simples",hint:"receita.fazenda.gov.br"},{text:"Confira e clique em Transmitir",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Botao+Transmitir",hint:"Compare com valores da Aura"}] },
  { id:"5",name:"PGDAS-D",due:"20/04/2026",dl:21,tot:30,amt:1105.20,st:"upcoming" as const,cat:"aura_facilita",desc:"Apuracao mensal da receita bruta para calculo do DAS.",steps:[{text:"Aura apura sua receita bruta",auto:true,media:null,hint:"Baseado nas notas"},{text:"Aura calcula o DAS estimado",auto:true,media:"https://placehold.co/600x280/1a1a2e/34d399?text=DAS+calculado",hint:"Aliquota do seu anexo"},{text:"Acesse o PGDAS-D no portal",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Portal+PGDAS-D",hint:"simplesnacional.receita.fazenda.gov.br"},{text:"Confira os valores preparados",auto:false,media:null,hint:"Campos preenchidos"},{text:"Transmita e pague o DAS",auto:false,media:null,hint:"Guia gerada apos transmissao"}] },
];
const DONE=[{id:"c1",n:"DAS-MEI",m:"Marco/2026",at:"18/03",a:76.90},{id:"c2",n:"FGTS",m:"Marco/2026",at:"05/03",a:320},{id:"c3",n:"DAS-MEI",m:"Fev/2026",at:"18/02",a:76.90},{id:"c4",n:"FGTS",m:"Fev/2026",at:"06/02",a:320},{id:"c5",n:"DAS-MEI",m:"Jan/2026",at:"19/01",a:76.90}];
const STK={cur:3,best:5,tot:12};

function Ring({pct,sz,col,lb,vl}:{pct:number;sz:number;col:string;lb:string;vl:string}){
  const r=sz/2,segs=20,fill=Math.round((pct/100)*segs);
  return <View style={{alignItems:"center",gap:6}}><View style={{width:sz,height:sz,borderRadius:r,backgroundColor:Colors.bg4,alignItems:"center",justifyContent:"center"}}>
    {[...Array(segs)].map((_,i)=>{const a=(i/segs)*360-90,rd=a*Math.PI/180,x=r+(r-6)*Math.cos(rd)-3,y=r+(r-6)*Math.sin(rd)-3;return <View key={i} style={{position:"absolute",left:x,top:y,width:6,height:6,borderRadius:3,backgroundColor:i<fill?col:Colors.border}}/>;})}
    <Text style={{fontSize:sz*0.22,fontWeight:"800",color:col}}>{vl}</Text>
  </View><Text style={{fontSize:10,color:Colors.ink3,fontWeight:"500",textAlign:"center"}}>{lb}</Text></View>;
}

function TCard({o,onG,last}:{o:typeof OBLS[0];onG:()=>void;last:boolean}){
  const [h,sH]=useState(false);const w=Platform.OS==="web";
  const urg=o.dl<=7?Colors.red:o.dl<=15?Colors.amber:Colors.green;
  const urgL=o.dl<=7?"Urgente":o.dl<=15?"Em breve":"No prazo";
  const isR=o.cat==="aura_resolve";const pct=Math.max(0,Math.min(100,((o.tot-o.dl)/o.tot)*100));
  return <View style={{flexDirection:"row",gap:14}}>
    <View style={{alignItems:"center",width:20,paddingTop:6}}><View style={{width:14,height:14,borderRadius:7,backgroundColor:urg,borderWidth:2,borderColor:Colors.bg}}/>{!last&&<View style={{width:2,flex:1,backgroundColor:Colors.border,marginTop:4}}/>}</View>
    <Pressable onHoverIn={w?()=>sH(true):undefined} onHoverOut={w?()=>sH(false):undefined} style={[{flex:1,backgroundColor:Colors.bg3,borderRadius:16,padding:18,borderWidth:1,borderColor:Colors.border,marginBottom:14},h&&{borderColor:Colors.border2,transform:[{translateY:-2}]},w&&{transition:"all 0.2s ease"}as any]}>
      <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:12}}>
        <View style={{flexDirection:"row",alignItems:"center",gap:8}}><Text style={{fontSize:17,color:Colors.ink,fontWeight:"700"}}>{o.name}</Text><View style={[{borderRadius:6,paddingHorizontal:8,paddingVertical:3},{backgroundColor:urg+"18"}]}><Text style={{fontSize:10,fontWeight:"700",color:urg}}>{urgL}</Text></View></View>
        <View style={{width:60,height:6,backgroundColor:Colors.bg4,borderRadius:3,overflow:"hidden"}}><View style={{height:6,borderRadius:3,width:`${pct}%`,backgroundColor:urg}}/></View>
      </View>
      <Text style={{fontSize:12,color:Colors.ink3,lineHeight:18,marginBottom:12}}>{o.desc}</Text>
      <View style={{flexDirection:"row",gap:20,marginBottom:14,flexWrap:"wrap"}}>
        <View style={{gap:2}}><Text style={{fontSize:9,color:Colors.ink3,textTransform:"uppercase",letterSpacing:0.5}}>Vence em</Text><Text style={{fontSize:15,color:urg,fontWeight:"700"}}>{o.dl} dias</Text></View>
        <View style={{gap:2}}><Text style={{fontSize:9,color:Colors.ink3,textTransform:"uppercase",letterSpacing:0.5}}>Data</Text><Text style={{fontSize:15,color:Colors.ink,fontWeight:"700"}}>{o.due}</Text></View>
        {o.amt!=null&&<View style={{gap:2}}><Text style={{fontSize:9,color:Colors.ink3,textTransform:"uppercase",letterSpacing:0.5}}>Estimativa</Text><Text style={{fontSize:15,color:Colors.ink,fontWeight:"700"}}>{fmt(o.amt)}</Text></View>}
      </View>
      <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTopWidth:1,borderTopColor:Colors.border,flexWrap:"wrap",gap:8}}>
        <View style={[{borderRadius:6,paddingHorizontal:8,paddingVertical:3},{backgroundColor:isR?Colors.greenD:Colors.amberD}]}><Text style={{fontSize:9,fontWeight:"700",letterSpacing:0.3,color:isR?Colors.green:Colors.amber}}>{isR?"Aura resolve":"Aura facilita, voce resolve"}</Text></View>
        <View style={{flexDirection:"row",gap:6}}>
          <Pressable onPress={onG} style={{backgroundColor:Colors.violetD,borderRadius:10,paddingHorizontal:14,paddingVertical:9,borderWidth:1,borderColor:Colors.border2}}><Text style={{fontSize:11,color:Colors.violet3,fontWeight:"600"}}>Guia passo a passo</Text></Pressable>
          {isR&&o.amt!=null&&<Pressable style={{backgroundColor:Colors.violet,borderRadius:10,paddingHorizontal:14,paddingVertical:9}}><Text style={{fontSize:11,color:"#fff",fontWeight:"700"}}>Pagar Pix</Text></Pressable>}
        </View>
      </View>
    </Pressable>
  </View>;
}

function Guide({o,onBack}:{o:typeof OBLS[0];onBack:()=>void}){
  const [dn,sD]=useState<number[]>([]);const isR=o.cat==="aura_resolve";const all=dn.length===o.steps.length;const pct=Math.round((dn.length/o.steps.length)*100);
  function tg(i:number){sD(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i]);}
  return <View>
    <Pressable onPress={onBack} style={{marginBottom:16}}><Text style={{fontSize:13,color:Colors.violet3,fontWeight:"600"}}>{"<"} Voltar</Text></Pressable>
    <View style={{flexDirection:IS_WIDE?"row":"column",justifyContent:"space-between",alignItems:IS_WIDE?"center":"flex-start",backgroundColor:Colors.bg3,borderRadius:20,padding:24,borderWidth:1,borderColor:Colors.border2,marginBottom:20,gap:16}}>
      <View style={{flex:1,gap:8}}>
        <Text style={{fontSize:24,color:Colors.ink,fontWeight:"800"}}>{o.name}</Text>
        <View style={[{borderRadius:6,paddingHorizontal:8,paddingVertical:3,alignSelf:"flex-start"},{backgroundColor:isR?Colors.greenD:Colors.amberD}]}><Text style={{fontSize:9,fontWeight:"700",letterSpacing:0.3,color:isR?Colors.green:Colors.amber}}>{isR?"Aura resolve":"Aura facilita, voce resolve"}</Text></View>
        <Text style={{fontSize:13,color:Colors.ink3,lineHeight:20}}>{o.desc}</Text>
        <View style={{flexDirection:"row",gap:8,flexWrap:"wrap"}}>
          {[["Vencimento",o.due],["Prazo",o.dl+"d"],o.amt!=null?["Valor",fmt(o.amt)]:null].filter(Boolean).map(([l,v])=><View key={l as string} style={{backgroundColor:Colors.bg4,borderRadius:8,paddingHorizontal:10,paddingVertical:6,gap:2}}><Text style={{fontSize:9,color:Colors.ink3,textTransform:"uppercase",letterSpacing:0.5}}>{l}</Text><Text style={{fontSize:14,color:Colors.ink,fontWeight:"700"}}>{v}</Text></View>)}
        </View>
      </View>
      <Ring pct={pct} sz={90} col={all?Colors.green:Colors.violet3} lb="Progresso" vl={`${pct}%`}/>
    </View>
    <View style={{marginBottom:20,gap:6}}><View style={{height:8,backgroundColor:Colors.bg4,borderRadius:4,overflow:"hidden"}}><View style={{height:8,borderRadius:4,width:`${pct}%`,backgroundColor:all?Colors.green:Colors.violet}}/></View><Text style={{fontSize:11,color:Colors.ink3}}>{dn.length} de {o.steps.length} passos</Text></View>
    <Text style={{fontSize:16,color:Colors.ink,fontWeight:"700",marginBottom:14}}>{isR?"A Aura cuida de tudo. Acompanhe:":"Siga os passos abaixo:"}</Text>
    <View style={{gap:10,marginBottom:20}}>
      {o.steps.map((st:Step,i:number)=>{const d=dn.includes(i);return <Pressable key={i} onPress={()=>tg(i)} style={[{backgroundColor:Colors.bg3,borderRadius:14,padding:16,borderWidth:1,borderColor:Colors.border},d&&{borderColor:Colors.green+"44",backgroundColor:Colors.greenD}]}>
        <View style={{flexDirection:"row",alignItems:"center",gap:12}}>
          <View style={[{width:36,height:36,borderRadius:12,backgroundColor:Colors.bg4,alignItems:"center",justifyContent:"center",borderWidth:1.5,borderColor:Colors.border},d&&{backgroundColor:Colors.green,borderColor:Colors.green}]}><Text style={[{fontSize:13,fontWeight:"800",color:Colors.ink3},d&&{color:"#fff"}]}>{d?"OK":i+1}</Text></View>
          <View style={{flex:1,gap:3}}>
            <Text style={[{fontSize:14,color:Colors.ink,fontWeight:"600"},d&&{color:Colors.ink3,textDecorationLine:"line-through"}]}>{st.text}</Text>
            {st.auto&&!d&&<View style={{backgroundColor:Colors.violetD,borderRadius:4,paddingHorizontal:6,paddingVertical:1,alignSelf:"flex-start"}}><Text style={{fontSize:9,color:Colors.violet3,fontWeight:"600"}}>Automatico</Text></View>}
          </View>
        </View>
        {st.hint&&!d?<Text style={{fontSize:11,color:Colors.ink3,marginTop:8,marginLeft:48,lineHeight:16}}>{st.hint}</Text>:null}
        {st.media&&!d&&<View style={{marginTop:12,marginLeft:48,borderRadius:12,overflow:"hidden",borderWidth:1,borderColor:Colors.border}}>
          <Image source={{uri:st.media}} style={{width:"100%",height:180,backgroundColor:Colors.bg4}} resizeMode="cover"/>
          <View style={{position:"absolute",top:8,right:8,backgroundColor:"rgba(0,0,0,0.6)",borderRadius:6,paddingHorizontal:8,paddingVertical:3}}><Text style={{fontSize:9,color:"#fff",fontWeight:"600"}}>Screenshot / GIF</Text></View>
        </View>}
      </Pressable>;})}
    </View>
    {all&&<View style={{flexDirection:"row",alignItems:"center",gap:14,backgroundColor:Colors.greenD,borderRadius:16,padding:20,marginBottom:16,borderWidth:1,borderColor:Colors.green+"44"}}>
      <View style={{width:48,height:48,borderRadius:24,backgroundColor:Colors.green,alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:16,color:"#fff",fontWeight:"800"}}>OK</Text></View>
      <View><Text style={{fontSize:16,color:Colors.green,fontWeight:"700"}}>Tudo concluido!</Text><Text style={{fontSize:12,color:Colors.ink3,marginTop:2}}>Sua obrigacao {o.name} esta em dia.</Text></View>
    </View>}
    <View style={{flexDirection:"row",gap:8,backgroundColor:Colors.amberD,borderRadius:12,padding:14}}><Text style={{fontSize:14,color:Colors.amber,fontWeight:"700"}}>i</Text><Text style={{fontSize:11,color:Colors.amber,flex:1,lineHeight:16}}>Estimativas para apoio contabil. Consulte o portal oficial.</Text></View>
  </View>;
}

function GList({obls,onSel}:{obls:typeof OBLS;onSel:(id:string)=>void}){
  const gs=[{t:"Aura resolve",h:"Tudo automatico",c:Colors.green,it:obls.filter(o=>o.cat==="aura_resolve")},{t:"Aura facilita, voce resolve",h:"Aura prepara, voce confirma",c:Colors.amber,it:obls.filter(o=>o.cat==="aura_facilita")}];
  return <View>
    <View style={{flexDirection:"row",gap:8,backgroundColor:Colors.violetD,borderRadius:12,padding:14,marginBottom:20,borderWidth:1,borderColor:Colors.border2}}><Text style={{fontSize:14,color:Colors.violet3,fontWeight:"700"}}>i</Text><Text style={{fontSize:12,color:Colors.ink2,flex:1,lineHeight:18}}>Guias visuais com screenshots para cada etapa.</Text></View>
    {gs.map(g=><View key={g.t} style={{marginBottom:20}}>
      <View style={{flexDirection:"row",alignItems:"center",gap:10,marginBottom:12}}><View style={{width:10,height:10,borderRadius:5,backgroundColor:g.c}}/><View><Text style={{fontSize:15,color:Colors.ink,fontWeight:"700"}}>{g.t}</Text><Text style={{fontSize:11,color:Colors.ink3,marginTop:1}}>{g.h}</Text></View></View>
      {g.it.map(o=><HoverRow key={o.id} style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:14,paddingHorizontal:14,borderRadius:12,backgroundColor:Colors.bg3,borderWidth:1,borderColor:Colors.border,marginBottom:6}} onPress={()=>onSel(o.id)}>
        <View style={{flexDirection:"row",alignItems:"center",gap:10}}><View style={{width:36,height:36,borderRadius:10,backgroundColor:g.c+"18",alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:14,fontWeight:"800",color:g.c}}>{o.steps.length}</Text></View><View><Text style={{fontSize:14,color:Colors.ink,fontWeight:"600"}}>{o.name}</Text><Text style={{fontSize:11,color:Colors.ink3,marginTop:1}}>{o.steps.length} passos{o.steps.some((s:Step)=>s.media)?" com imagens":""}</Text></View></View>
        <View style={{flexDirection:"row",alignItems:"center",gap:10}}>{o.amt!=null&&<Text style={{fontSize:13,color:Colors.ink,fontWeight:"600"}}>{fmt(o.amt)}</Text>}<Text style={{fontSize:16,color:Colors.ink3}}>{">"}</Text></View>
      </HoverRow>)}
    </View>)}
  </View>;
}

function Hist(){
  const ms=["Jan","Fev","Mar","Abr","Mai","Jun"];
  return <View>
    <HoverCard style={{backgroundColor:Colors.bg3,borderRadius:16,padding:20,borderWidth:1,borderColor:Colors.border2,marginBottom:24}}>
      <Text style={{fontSize:16,color:Colors.ink,fontWeight:"700",marginBottom:16,textAlign:"center"}}>Sequencia de conformidade</Text>
      <View style={{flexDirection:"row",justifyContent:"center",gap:12,marginBottom:20}}>
        {ms.map((m,i)=>{const a=i<STK.cur;return <View key={m} style={{alignItems:"center",gap:6}}><View style={[{width:44,height:44,borderRadius:22,backgroundColor:Colors.bg4,alignItems:"center",justifyContent:"center",borderWidth:2,borderColor:Colors.border},a&&{backgroundColor:Colors.greenD,borderColor:Colors.green}]}><Text style={[{fontSize:11,fontWeight:"800",color:Colors.ink3},a&&{color:Colors.green}]}>{a?"OK":"?"}</Text></View><Text style={[{fontSize:10,color:Colors.ink3,fontWeight:"600"},a&&{color:Colors.green}]}>{m}</Text></View>;})}
      </View>
      <View style={{flexDirection:"row",gap:12}}>
        {[[STK.cur,"Atual",Colors.green],[STK.best,"Recorde",Colors.amber],[STK.tot,"Total",Colors.green]].map(([v,l,c])=><View key={l as string} style={{flex:1,alignItems:"center",backgroundColor:Colors.bg4,borderRadius:10,padding:12}}><Text style={{fontSize:22,fontWeight:"800",color:c as string}}>{v}</Text><Text style={{fontSize:10,color:Colors.ink3,marginTop:4,textTransform:"uppercase",letterSpacing:0.5}}>{l}</Text></View>)}
      </View>
    </HoverCard>
    <Text style={{fontSize:15,color:Colors.ink,fontWeight:"700",marginBottom:12}}>Concluidas recentemente</Text>
    <View style={{backgroundColor:Colors.bg3,borderRadius:16,padding:8,borderWidth:1,borderColor:Colors.border,marginBottom:20}}>
      {DONE.map(c=><HoverRow key={c.id} style={{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:12,paddingHorizontal:10,borderRadius:10,borderBottomWidth:1,borderBottomColor:Colors.border}}>
        <View style={{width:28,height:28,borderRadius:8,backgroundColor:Colors.greenD,alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:9,fontWeight:"800",color:Colors.green}}>OK</Text></View>
        <View style={{flex:1,gap:2}}><Text style={{fontSize:13,color:Colors.ink,fontWeight:"600"}}>{c.n}</Text><Text style={{fontSize:11,color:Colors.ink3}}>{c.m} - {c.at}</Text></View>
        <Text style={{fontSize:13,color:Colors.ink,fontWeight:"600"}}>{fmt(c.a)}</Text>
      </HoverRow>)}
    </View>
  </View>;
}

export default function ContabilidadeScreen(){
  const [tab,sTab]=useState(0);const [gid,sGid]=useState<string|null>(null);
  const att=OBLS.filter(o=>o.dl<=7).length;const upc=OBLS.filter(o=>o.dl>7&&o.dl<=30).length;
  const due=OBLS.filter(o=>o.amt!=null).reduce((s,o)=>s+(o.amt||0),0);
  const sel=gid?OBLS.find(o=>o.id===gid):null;
  if(sel) return <ScrollView style={z.scr} contentContainerStyle={z.cnt}><Guide o={sel} onBack={()=>sGid(null)}/><DemoBanner/></ScrollView>;
  return <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
    <PageHeader title="Contabilidade"/>
    <View style={z.rings}><Ring pct={att>0?100:0} sz={80} col={att>0?Colors.red:Colors.green} lb="Urgentes" vl={String(att)}/><Ring pct={(upc/OBLS.length)*100} sz={80} col={Colors.amber} lb="Proximas" vl={String(upc)}/><Ring pct={100} sz={80} col={Colors.violet3} lb="Estimado" vl={fmt(due).replace("R$ ","")}/><Ring pct={(STK.cur/STK.best)*100} sz={80} col={Colors.green} lb="Sequencia" vl={`${STK.cur}m`}/></View>
    <TabBar tabs={TABS} active={tab} onSelect={sTab}/>
    {tab===0&&<View>{att>0&&<View style={z.urg}><Text style={z.urgT}>{att} obrigacao(oes) vencendo em menos de 7 dias</Text></View>}{[...OBLS].sort((a,b)=>a.dl-b.dl).map((o,i)=><TCard key={o.id} o={o} onG={()=>sGid(o.id)} last={i===OBLS.length-1}/>)}<View style={{alignItems:"center",paddingVertical:12}}><Text style={{fontSize:10,color:Colors.ink3,fontStyle:"italic"}}>Estimativas para apoio contabil informativo.</Text></View></View>}
    {tab===1&&<GList obls={OBLS} onSel={sGid}/>}
    {tab===2&&<Hist/>}
    <DemoBanner/>
  </ScrollView>;
}
const z=StyleSheet.create({scr:{flex:1,backgroundColor:Colors.bg},cnt:{padding:IS_WIDE?32:20,paddingBottom:48,maxWidth:960,alignSelf:"center",width:"100%"},rings:{flexDirection:"row",justifyContent:"space-around",flexWrap:"wrap",gap:12,marginBottom:24,backgroundColor:Colors.bg3,borderRadius:16,padding:20,borderWidth:1,borderColor:Colors.border},urg:{backgroundColor:Colors.redD,borderRadius:12,padding:14,marginBottom:16},urgT:{fontSize:13,color:Colors.red,fontWeight:"600"}});
