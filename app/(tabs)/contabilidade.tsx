import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Image } from "react-native";
import { Colors } from "@/constants/colors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { TabBar } from "@/components/TabBar";
import { HoverRow } from "@/components/HoverRow";
import { DemoBanner } from "@/components/DemoBanner";
import { PageHeader } from "@/components/PageHeader";
import { AgentBanner } from "@/components/AgentBanner";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

const TABS = ["Checkpoints", "Guias", "Historico"];
type Step = { text: string; auto: boolean; media: string | null; hint: string };
type Obl = { id: string; name: string; icon: string; due: string; dl: number; amt: number | null; status: "done" | "progress" | "pending" | "future"; cat: string; desc: string; steps: Step[] };

const OBLS: Obl[] = [
  { id:"1",name:"CNPJ e regime configurados",icon:"#",due:"Inicial",dl:0,amt:null,status:"done",cat:"aura_resolve",desc:"Simples Nacional detectado via Receita Federal. Obrigacoes carregadas automaticamente.",steps:[{text:"Aura detecta seu regime tributario",auto:true,media:null,hint:"Via consulta ao CNPJ"},{text:"Obrigacoes carregadas automaticamente",auto:true,media:null,hint:"Baseado no Simples Nacional"}] },
  { id:"2",name:"Alertas de vencimento ativos",icon:"!",due:"Sempre",dl:0,amt:null,status:"done",cat:"aura_resolve",desc:"Notificacoes configuradas: 15 dias, 7 dias e 3 dias antes do vencimento.",steps:[{text:"Aura configura os alertas",auto:true,media:null,hint:"15d, 7d e 3d antes"},{text:"Voce recebe notificacao no app",auto:true,media:null,hint:"Push + email"}] },
  { id:"3",name:"Resumo gerencial do mes",icon:"$",due:"Auto",dl:0,amt:null,status:"done",cat:"aura_resolve",desc:"Resumo financeiro mensal gerado automaticamente com base nos lancamentos.",steps:[{text:"Aura compila os dados do mes",auto:true,media:null,hint:"Receitas, despesas, lucro"},{text:"Relatorio disponivel no Financeiro",auto:true,media:null,hint:"Aba Resumo"}] },
  { id:"4",name:"FGTS - Guia gerada",icon:"F",due:"07/04/2026",dl:8,amt:320.00,status:"done",cat:"aura_resolve",desc:"Fundo de Garantia calculado e guia pronta para pagamento.",steps:[{text:"Aura calcula com base na folha",auto:true,media:null,hint:"8% sobre salario"},{text:"Guia gerada automaticamente",auto:true,media:"https://placehold.co/600x280/1a1a2e/34d399?text=Guia+FGTS+gerada",hint:"Pronta para pagar"}] },
  { id:"5",name:"Pagar DAS - R$ 76,90",icon:"$",due:"20/04/2026",dl:21,amt:76.90,status:"progress",cat:"aura_resolve",desc:"Guia DAS-MEI pronta. Valor estimado com QR Code Pix disponivel.",steps:[{text:"Aura calcula o valor do DAS",auto:true,media:null,hint:"INSS + ISS + ICMS"},{text:"QR Code Pix gerado",auto:true,media:"https://placehold.co/600x280/1a1a2e/7c3aed?text=QR+Code+Pix+DAS",hint:"Escaneie com app bancario"},{text:"Aura confirma o pagamento",auto:true,media:null,hint:"Notificacao automatica"}] },
  { id:"6",name:"eSocial - Enviar XML",icon:"e",due:"15/04/2026",dl:16,amt:null,status:"pending",cat:"aura_facilita",desc:"Aura gera o arquivo XML. Voce envia pelo portal gov.br em 5 minutos.",steps:[{text:"Aura prepara os dados e gera o XML",auto:true,media:null,hint:"Arquivo na secao Documentos"},{text:"Acesse gov.br/esocial",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Portal+eSocial",hint:"Use seu navegador"},{text:"Faca login com Gov.br",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Login+Gov.br",hint:"CPF e senha"},{text:"Clique em Enviar arquivo",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Botao+Enviar",hint:"Menu lateral"},{text:"Selecione o XML da Aura",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Selecionar+XML",hint:"Pasta Downloads"},{text:"Confirme - pronto!",auto:false,media:null,hint:"Sucesso"}] },
  { id:"7",name:"PGDAS-D - Transmitir",icon:"P",due:"20/04/2026",dl:21,amt:1105.20,status:"pending",cat:"aura_facilita",desc:"Aura calcula o DAS estimado. Voce confere e transmite no portal do Simples.",steps:[{text:"Aura apura receita bruta",auto:true,media:null,hint:"Baseado nas notas"},{text:"Aura calcula DAS estimado",auto:true,media:"https://placehold.co/600x280/1a1a2e/34d399?text=DAS+estimado",hint:"Conforme seu anexo"},{text:"Acesse o portal PGDAS-D",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Portal+PGDAS-D",hint:"simplesnacional.receita.fazenda.gov.br"},{text:"Confira valores e transmita",auto:false,media:null,hint:"Compare com Aura"},{text:"Pague o DAS gerado",auto:false,media:null,hint:"Pix ou boleto"}] },
  { id:"8",name:"DASN-SIMEI - Anual",icon:"D",due:"31/05/2026",dl:62,amt:null,status:"future",cat:"aura_facilita",desc:"Declaracao anual. Aura consolida o faturamento e pre-preenche os dados.",steps:[{text:"Aura consolida faturamento anual",auto:true,media:null,hint:"Soma de todas as notas"},{text:"Aura pre-preenche declaracao",auto:true,media:"https://placehold.co/600x280/1a1a2e/a78bfa?text=Dados+preenchidos",hint:"Revise antes"},{text:"Acesse portal Simples Nacional",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Portal+Simples",hint:"receita.fazenda.gov.br"},{text:"Confira e clique Transmitir",auto:false,media:"https://placehold.co/600x320/1a1a2e/fbbf24?text=Transmitir+DASN",hint:"Compare valores"}] },
];

const DONE_LIST=[{id:"c1",n:"DAS-MEI",m:"Mar/26",at:"18/03",a:76.90},{id:"c2",n:"FGTS",m:"Mar/26",at:"05/03",a:320},{id:"c3",n:"DAS-MEI",m:"Fev/26",at:"18/02",a:76.90},{id:"c4",n:"FGTS",m:"Fev/26",at:"06/02",a:320},{id:"c5",n:"DAS-MEI",m:"Jan/26",at:"19/01",a:76.90}];
const STK={cur:3,best:5,tot:12};

const borderColors = { done: Colors.green, progress: Colors.violet, pending: Colors.amber, future: Colors.ink3 };
const numBg = { done: Colors.greenD, progress: Colors.violetD, pending: Colors.amberD, future: Colors.bg4 };
const numFg = { done: Colors.green, progress: Colors.violet3, pending: Colors.amber, future: Colors.ink3 };
const stLabel = { done: "OK", progress: "...", pending: ">>", future: "---" };
const stColor = { done: Colors.green, progress: Colors.violet3, pending: Colors.amber, future: Colors.ink3 };

function HeroRing({ obls }: { obls?: Obl[] }) {
  const data = obls || OBLS;
  const total = data.length;
  const done = data.filter(o => o.status === "done").length;
  const pending = data.filter(o => o.status === "progress" || o.status === "pending").length;
  const nextDue = data.filter(o => o.dl > 0).sort((a, b) => a.dl - b.dl)[0];
  const pct = done / total;
  const r = 38, circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <View style={hr.card}>
      <View style={hr.ringWrap}>
        {Platform.OS === "web" ? (
          <div style={{ width: 90, height: 90, position: "relative" } as any} dangerouslySetInnerHTML={{ __html: `
            <svg width="90" height="90" viewBox="0 0 90 90" style="transform:rotate(-90deg)">
              <circle cx="45" cy="45" r="38" fill="none" stroke="${Colors.bg4}" stroke-width="7"/>
              <circle cx="45" cy="45" r="38" fill="none" stroke="${Colors.violet}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
            </svg>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
              <div style="font-size:20px;font-weight:700;color:${Colors.ink}">${done}/${total}</div>
              <div style="font-size:10px;color:${Colors.ink3}">ok</div>
            </div>
          `}} />
        ) : (
          <View style={hr.fallbackRing}><Text style={hr.fallbackText}>{done}/{total}</Text><Text style={hr.fallbackLabel}>ok</Text></View>
        )}
      </View>
      <View style={hr.info}>
        <View style={hr.badges}><View style={hr.regBadge}><Text style={hr.regText}>Simples Nacional</Text></View></View>
        <Text style={hr.heroTitle}>{done === total ? "Tudo em dia!" : done >= total / 2 ? "Voce esta quase la." : "Vamos resolver suas pendencias."}</Text>
        <Text style={hr.heroSub}>{pending} {pending === 1 ? "item pendente" : "itens pendentes"}. {nextDue ? `Proximo vencimento em ${nextDue.dl} dias.` : ""}</Text>
        <View style={hr.miniStats}>
          <View style={hr.miniStat}><Text style={[hr.miniVal, { color: Colors.green }]}>{done}</Text><Text style={hr.miniLbl}>Concluidos</Text></View>
          <View style={hr.miniStat}><Text style={[hr.miniVal, { color: Colors.amber }]}>{pending}</Text><Text style={hr.miniLbl}>Pendentes</Text></View>
          {nextDue && <View style={hr.miniStat}><Text style={[hr.miniVal, { color: nextDue.dl <= 7 ? Colors.red : Colors.amber }]}>{nextDue.dl}</Text><Text style={hr.miniLbl}>Dias p/ {nextDue.name.split(" ")[0]}</Text></View>}
        </View>
      </View>
    </View>
  );
}
const hr = StyleSheet.create({
  card: { flexDirection: IS_WIDE ? "row" : "column", flexWrap: "wrap" as any, gap: 18, alignItems: IS_WIDE ? "center" : "flex-start", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 18, marginBottom: 14 },
  ringWrap: { flexShrink: 0 },
  fallbackRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 7, borderColor: Colors.violet, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  fallbackText: { fontSize: 20, fontWeight: "700", color: Colors.ink },
  fallbackLabel: { fontSize: 10, color: Colors.ink3 },
  info: { flex: 1 },
  badges: { flexDirection: "row", gap: 6, marginBottom: 5 },
  regBadge: { backgroundColor: Colors.violetD, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  regText: { fontSize: 10, fontWeight: "500", color: Colors.violet3 },
  heroTitle: { fontSize: 17, color: Colors.ink, fontWeight: "700", marginBottom: 3 },
  heroSub: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 9 },
  miniStats: { flexDirection: "row", gap: 14 },
  miniStat: { alignItems: "center" },
  miniVal: { fontSize: 16, fontWeight: "700" },
  miniLbl: { fontSize: 10, color: Colors.ink3 },
});

function StreakBar() {
  return (
    <View style={sk.bar}>
      <Text style={sk.fire}>*</Text>
      <Text style={sk.text}><Text style={sk.bold}>{STK.cur} meses consecutivos</Text> sem atraso em obrigacoes.</Text>
      <Text style={sk.pts}>+{STK.cur * 60} pts</Text>
    </View>
  );
}
const sk = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 9, padding: 10, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, marginBottom: 14 },
  fire: { fontSize: 18, color: Colors.amber },
  text: { flex: 1, fontSize: 12, color: Colors.ink3 },
  bold: { color: Colors.violet3, fontWeight: "500" },
  pts: { fontSize: 13, fontWeight: "500", color: Colors.violet3 },
});

function Checkpoint({ o, onGuide }: { o: Obl; onGuide: () => void }) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  const bc = borderColors[o.status];
  const isR = o.cat === "aura_resolve";
  const locked = o.status === "future";
  return (
    <Pressable onPress={locked ? undefined : onGuide} onHoverIn={w && !locked ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
      style={[cp.card, { borderLeftColor: bc }, locked && cp.locked, h && { borderColor: Colors.border2, backgroundColor: Colors.bg4 }, w && { transition: "all 0.15s ease" } as any]}>
      <View style={cp.top}>
        <View style={[cp.num, { backgroundColor: numBg[o.status] }]}><Text style={[cp.numText, { color: numFg[o.status] }]}>{o.status === "done" ? "OK" : o.icon}</Text></View>
        <Text style={cp.name} numberOfLines={1}>{o.name}</Text>
        <Text style={[cp.st, { color: stColor[o.status] }]}>{stLabel[o.status]}</Text>
      </View>
      <View style={cp.respRow}><View style={[cp.resp, { backgroundColor: isR ? Colors.greenD : Colors.amberD }]}><Text style={[cp.respText, { color: isR ? Colors.green : Colors.amber }]}>{isR ? "Aura resolve" : "Voce confirma"}</Text></View></View>
      <Text style={cp.desc} numberOfLines={2}>{o.desc}</Text>
      <View style={cp.bottom}>
        <Text style={cp.date}>{o.due}</Text>
        {o.status !== "done" && <Pressable style={cp.guideBtn} onPress={onGuide}><Text style={cp.guideText}>Ver guia</Text></Pressable>}
        {o.status === "done" && <Pressable style={cp.doneBtn} onPress={onGuide}><Text style={cp.doneText}>Ver</Text></Pressable>}
      </View>
    </Pressable>
  );
}
const cp = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderRadius: 10, padding: 13, overflow: "hidden" },
  locked: { opacity: 0.5 },
  top: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  numText: { fontSize: 10, fontWeight: "700" },
  name: { fontSize: 13, fontWeight: "500", color: Colors.ink, flex: 1 },
  st: { fontSize: 10 },
  respRow: { marginBottom: 6 },
  resp: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" },
  respText: { fontSize: 10, fontWeight: "500" },
  desc: { fontSize: 11, color: Colors.ink3, lineHeight: 16, marginBottom: 7 },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  date: { fontSize: 10, color: Colors.ink3 },
  guideBtn: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  guideText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
  doneBtn: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  doneText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
});

// A5: Guide with localStorage persistence + instruction text
function Guide({ o, onBack, onComplete }: { o: Obl; onBack: () => void; onComplete?: (id: string) => void }) {
  const storageKey = `aura_guide_${o.id}`;
  const [dn, sD] = useState<number[]>(() => {
    if (typeof localStorage !== "undefined") {
      try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : []; } catch { return []; }
    }
    return [];
  });
  const isR = o.cat === "aura_resolve";
  const all = dn.length === o.steps.length;
  const pct = Math.round((dn.length / o.steps.length) * 100);
  function tg(i: number) {
    sD(p => {
      const next = p.includes(i) ? p.filter(x => x !== i) : [...p, i];
      if (typeof localStorage !== "undefined") { try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {} }
      if (next.length === o.steps.length && onComplete) { setTimeout(() => onComplete(o.id), 300); }
      return next;
    });
  }
  return (
    <View>
      <Pressable onPress={onBack} style={{ marginBottom: 16 }}><Text style={{ fontSize: 13, color: Colors.violet3, fontWeight: "600" }}>{"<"} Voltar</Text></Pressable>
      <View style={gv.hero}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={{ fontSize: 22, color: Colors.ink, fontWeight: "800" }}>{o.name}</Text>
          <View style={[{ borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" }, { backgroundColor: isR ? Colors.greenD : Colors.amberD }]}><Text style={{ fontSize: 10, fontWeight: "600", color: isR ? Colors.green : Colors.amber }}>{isR ? "Aura resolve" : "Aura facilita, voce resolve"}</Text></View>
          <Text style={{ fontSize: 13, color: Colors.ink3, lineHeight: 20 }}>{o.desc}</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {o.due !== "Inicial" && o.due !== "Sempre" && o.due !== "Auto" && <View style={gv.chip}><Text style={gv.chipL}>Vencimento</Text><Text style={gv.chipV}>{o.due}</Text></View>}
            {o.dl > 0 && <View style={gv.chip}><Text style={gv.chipL}>Prazo</Text><Text style={gv.chipV}>{o.dl}d</Text></View>}
            {o.amt != null && <View style={gv.chip}><Text style={gv.chipL}>Valor</Text><Text style={gv.chipV}>{fmt(o.amt)}</Text></View>}
          </View>
        </View>
      </View>
      <View style={{ marginBottom: 20, gap: 6 }}>
        <View style={{ height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: "hidden" }}><View style={{ height: 8, borderRadius: 4, width: `${pct}%`, backgroundColor: all ? Colors.green : Colors.violet }} /></View>
        <Text style={{ fontSize: 11, color: Colors.ink3 }}>{dn.length} de {o.steps.length} passos concluidos</Text>
      </View>
      {/* A5: Instruction text */}
      <View style={{ flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 }}>
        <Text style={{ fontSize: 14, color: Colors.violet3, fontWeight: "700" }}>i</Text>
        <Text style={{ fontSize: 12, color: Colors.ink3, flex: 1, lineHeight: 18 }}>Clique em cada etapa abaixo para marcar como concluida. Seu progresso e salvo automaticamente.</Text>
      </View>
      <Text style={{ fontSize: 16, color: Colors.ink, fontWeight: "700", marginBottom: 14 }}>{isR ? "A Aura cuida de tudo. Acompanhe:" : "Siga os passos abaixo:"}</Text>
      <View style={{ gap: 10, marginBottom: 20 }}>
        {o.steps.map((st, i) => {
          const d = dn.includes(i);
          return (
            <Pressable key={i} onPress={() => tg(i)} style={[gv.step, d && gv.stepDone]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[gv.stepNum, d && gv.stepNumDone]}><Text style={[gv.stepNumT, d && { color: "#fff" }]}>{d ? "OK" : i + 1}</Text></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[gv.stepT, d && gv.stepTDone]}>{st.text}</Text>
                  {st.auto && !d && <View style={{ backgroundColor: Colors.violetD, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, alignSelf: "flex-start" }}><Text style={{ fontSize: 9, color: Colors.violet3, fontWeight: "600" }}>Automatico</Text></View>}
                  {!st.auto && !d && <View style={{ backgroundColor: Colors.amberD, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, alignSelf: "flex-start" }}><Text style={{ fontSize: 9, color: Colors.amber, fontWeight: "600" }}>Voce faz</Text></View>}
                </View>
              </View>
              {st.hint && !d ? <Text style={{ fontSize: 11, color: Colors.ink3, marginTop: 8, marginLeft: 48, lineHeight: 16 }}>{st.hint}</Text> : null}
              {st.media && !d && (
                <View style={{ marginTop: 12, marginLeft: 48, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: Colors.border }}>
                  <Image source={{ uri: st.media }} style={{ width: "100%" as any, height: 180, backgroundColor: Colors.bg4 }} resizeMode="cover" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {all && <View style={gv.doneBanner}><View style={gv.doneCircle}><Text style={{ fontSize: 14, color: "#fff", fontWeight: "800" }}>OK</Text></View><View><Text style={{ fontSize: 16, color: Colors.green, fontWeight: "700" }}>Concluido!</Text><Text style={{ fontSize: 12, color: Colors.ink3, marginTop: 2 }}>{o.name} esta em dia.</Text></View></View>}
      <View style={{ flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14 }}><Text style={{ fontSize: 14, color: Colors.amber, fontWeight: "700" }}>i</Text><Text style={{ fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 }}>Estimativas para apoio contabil. Consulte o portal oficial.</Text></View>
    </View>
  );
}
const gv = StyleSheet.create({
  hero: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20, gap: 8 },
  chip: { backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
  chipL: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  chipV: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  step: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  stepDone: { borderColor: Colors.green + "44", backgroundColor: Colors.greenD },
  stepNum: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: Colors.border },
  stepNumDone: { backgroundColor: Colors.green, borderColor: Colors.green },
  stepNumT: { fontSize: 13, fontWeight: "800", color: Colors.ink3 },
  stepT: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  stepTDone: { color: Colors.ink3, textDecorationLine: "line-through" },
  doneBanner: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.greenD, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Colors.green + "44" },
  doneCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
});

function GList({ obls, onSel }: { obls: Obl[]; onSel: (id: string) => void }) {
  const gs = [{ t: "Aura resolve", h: "Tudo automatico", c: Colors.green, it: obls.filter(o => o.cat === "aura_resolve") }, { t: "Aura facilita, voce resolve", h: "Passo a passo com apoio da Aura", c: Colors.amber, it: obls.filter(o => o.cat === "aura_facilita") }];
  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.border2 }}><Text style={{ fontSize: 14, color: Colors.violet3, fontWeight: "700" }}>i</Text><Text style={{ fontSize: 12, color: Colors.ink3, flex: 1, lineHeight: 18 }}>Guias visuais com screenshots para cada etapa. A Aura prepara os dados e te guia pelo processo.</Text></View>
      {gs.map(g => (
        <View key={g.t} style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: g.c }} /><View><Text style={{ fontSize: 15, color: Colors.ink, fontWeight: "700" }}>{g.t}</Text><Text style={{ fontSize: 11, color: Colors.ink3, marginTop: 1 }}>{g.h}</Text></View></View>
          {g.it.map(o => (
            <HoverRow key={o.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 }} onPress={() => onSel(o.id)}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: g.c + "18", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 14, fontWeight: "800", color: g.c }}>{o.steps.length}</Text></View><View><Text style={{ fontSize: 14, color: Colors.ink, fontWeight: "600" }}>{o.name}</Text><Text style={{ fontSize: 11, color: Colors.ink3, marginTop: 1 }}>{o.steps.length} passos{o.steps.some(s => s.media) ? " com imagens" : ""}</Text></View></View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>{o.amt != null && <Text style={{ fontSize: 13, color: Colors.ink, fontWeight: "600" }}>{fmt(o.amt)}</Text>}<Text style={{ fontSize: 16, color: Colors.ink3 }}>{">"}</Text></View>
            </HoverRow>
          ))}
        </View>
      ))}
    </View>
  );
}

function Hist() {
  const ms = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
  return (
    <View>
      <View style={{ backgroundColor: Colors.bg3, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 24 }}>
        <Text style={{ fontSize: 16, color: Colors.ink, fontWeight: "700", marginBottom: 16, textAlign: "center" }}>Sequencia de conformidade</Text>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {ms.map((m, i) => { const a = i < STK.cur; return <View key={m} style={{ alignItems: "center", gap: 6 }}><View style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.border }, a && { backgroundColor: Colors.greenD, borderColor: Colors.green }]}><Text style={[{ fontSize: 11, fontWeight: "800", color: Colors.ink3 }, a && { color: Colors.green }]}>{a ? "OK" : "?"}</Text></View><Text style={[{ fontSize: 10, color: Colors.ink3, fontWeight: "600" }, a && { color: Colors.green }]}>{m}</Text></View>; })}
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[[STK.cur, "Atual", Colors.green], [STK.best, "Recorde", Colors.amber], [STK.tot, "Total", Colors.green]].map(([v, l, c]) => <View key={l as string} style={{ flex: 1, alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 10, padding: 12 }}><Text style={{ fontSize: 22, fontWeight: "800", color: c as string }}>{v}</Text><Text style={{ fontSize: 10, color: Colors.ink3, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</Text></View>)}
        </View>
      </View>
      <Text style={{ fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 12 }}>Concluidas recentemente</Text>
      <View style={{ backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 }}>
        {DONE_LIST.map(c => <HoverRow key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border }}><View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 9, fontWeight: "800", color: Colors.green }}>OK</Text></View><View style={{ flex: 1, gap: 2 }}><Text style={{ fontSize: 13, color: Colors.ink, fontWeight: "600" }}>{c.n}</Text><Text style={{ fontSize: 11, color: Colors.ink3 }}>{c.m} - {c.at}</Text></View><Text style={{ fontSize: 13, color: Colors.ink, fontWeight: "600" }}>{fmt(c.a)}</Text></HoverRow>)}
      </View>
    </View>
  );
}

export default function ContabilidadeScreen() {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const scrollRef = useRef<any>(null);

  const { data: apiObligations } = useQuery({
    queryKey: ["obligations", company?.id],
    queryFn: () => companiesApi.obligations(company!.id),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1,
    staleTime: 60000,
  });

  const obligations: Obl[] = (() => {
    const apiArr = apiObligations?.obligations || apiObligations?.rows || apiObligations;
    if (apiArr instanceof Array && apiArr.length > 0) {
      return apiArr.map((o: any, i: number) => ({
        id: o.id || String(i + 1),
        name: o.name || o.obligation_name || "Obrigacao",
        icon: o.icon || (o.name || "").charAt(0).toUpperCase() || "#",
        due: o.due_date ? new Date(o.due_date).toLocaleDateString("pt-BR") : o.due || "---",
        dl: o.days_left ?? (o.due_date ? Math.max(0, Math.ceil((new Date(o.due_date).getTime() - Date.now()) / 864e5)) : 0),
        amt: o.estimated_amount != null ? parseFloat(o.estimated_amount) : o.amt ?? null,
        status: (o.status === "completed" ? "done" : o.status === "in_progress" ? "progress" : o.status === "future" ? "future" : "pending") as Obl["status"],
        cat: o.category || o.cat || "aura_resolve",
        desc: o.description || o.desc || "",
        steps: o.steps instanceof Array ? o.steps : (o.guide_steps instanceof Array ? o.guide_steps : []),
      }));
    }
    return OBLS;
  })();

  function handleGuideComplete(oblId: string) {
    if (company?.id && !isDemo) {
      companiesApi.completeCheckpoint(company.id, oblId)
        .then(() => {
          qc.invalidateQueries({ queryKey: ["obligations", company.id] });
          toast.success("Obrigacao concluida!");
        })
        .catch(() => {});
    } else {
      toast.success("Obrigacao concluida!");
    }
  }

  const [tab, sTab] = useState(0);
  const [gid, sGid] = useState<string | null>(null);
  const sel = gid ? obligations.find(o => o.id === gid) : null;

  if (sel) return (
    <ScrollView ref={scrollRef} style={z.scr} contentContainerStyle={z.cnt}>
      <Guide o={sel} onBack={() => sGid(null)} onComplete={handleGuideComplete} />
    </ScrollView>
  );

  return (
    <ScrollView ref={scrollRef} style={z.scr} contentContainerStyle={z.cnt}>
      <PageHeader title="Contabilidade" />
      <HeroRing obls={obligations} />
      <StreakBar />
      <TabBar tabs={TABS} active={tab} onSelect={(i: number) => { sTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }} />

      <AgentBanner agent="Contabil" insight={{ title: "DAS vence em 14 dias", desc: "O DAS-MEI de abril vence em 20/04. Valor estimado: R$ 76,90. Gere o QR Code Pix.", actionLabel: "Gerar QR Code", action: "das", priority: "high", icon: "alert" }} />

      {tab === 0 && (
        <View style={z.grid}>
          {obligations.map(o => <View key={o.id} style={z.gridItem}><Checkpoint o={o} onGuide={() => sGid(o.id)} /></View>)}
        </View>
      )}
      {tab === 1 && <GList obls={obligations} onSel={sGid} />}
      {tab === 2 && <Hist />}

      <View style={{ alignItems: "center", paddingVertical: 12 }}><Text style={{ fontSize: 10, color: Colors.ink3, fontStyle: "italic" }}>Estimativas para apoio contabil informativo.</Text></View>
      <DemoBanner />
    </ScrollView>
  );
}

const z = StyleSheet.create({
  scr: { flex: 1, backgroundColor: "transparent" },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%", overflow: "hidden" as any },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  gridItem: { width: IS_WIDE ? "48.5%" : "100%", flexShrink: 0 },
});
