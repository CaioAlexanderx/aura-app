// Extracted from contabilidade.tsx — FE-03 refactor
import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput, Platform } from "react-native";
import { Colors } from "@/constants/colors";

// Props type (customize as needed)
interface HeroRingProps {
  [key: string]: any;
}

export function HeroRing({ obls }: { obls?: Obl[] }) {
  const data = obls || OBLS;
  const total = data.length;
  const done = data.filter(o => o.status === "done").length;
  const pending = data.filter(o => o.status === "progress" || o.status === "pending").length;
  const nextDue = data.filter(o => o.dl > 0).sort((a, b) => a.dl - b.dl)[0];
  const pct = done / total;
  const r = 38, circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const month = new Date().toLocaleString("pt-BR", { month: "long" }).replace(/^\w/, c => c.toUpperCase());

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
          <View style={hr.fallbackRing}>
            <Text style={hr.fallbackText}>{done}/{total}</Text>
            <Text style={hr.fallbackLabel}>ok</Text>
          </View>
        )}
      </View>
      <View style={hr.info}>
        <View style={hr.badges}>
          <View style={hr.regBadge}><Text style={hr.regText}>Simples Nacional</Text></View>
        </View>
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


