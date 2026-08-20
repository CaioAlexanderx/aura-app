// ============================================================
// Aura Karatê (dojô) — Eventos (F9: duas fontes, duas abas)
//
// DECISÃO DE PRODUTO (04/08, F9): esta tela agora tem DUAS abas:
//   • "Meus eventos" — o que o PRÓPRIO dojô organiza: curso e seminário
//                       (criados aqui) + exame de faixa/kyu (listado
//                       aqui, criado em outra tela — o backend já
//                       existe, falta só o consumidor). Fonte:
//                       GET /federation/:id/dojo/events-hub.
//   • "Da federação"  — o que a FEDERAÇÃO abre e o dojô inscreve alunos
//                       federados (comportamento ORIGINAL desta tela,
//                       preservado SEM mudança de lógica — só virou
//                       aba). Fonte: GET /federation/:id/dojo/events.
//
// POR QUE ABAS (e não duas telas, nem uma lista só): o pedido foi
// textual — "estrutura idêntica de criação de eventos que já temos na
// federação" para o evento PRÓPRIO do dojô — e o risco apontado foi o
// SENSEI CONFUNDIR "evento que eu criei" com "evento da federação em que
// eu inscrevo meus alunos" (semânticas bem diferentes: numa o dojô é
// dono e decide tudo; na outra só participa do que a federação abriu).
// Duas fontes de dado, duas regras de negócio (aluno não-federado
// participa vs. regra de ouro só-federado) e dois fluxos de criação
// diferentes — misturar numa lista só, mesmo com badge, escondia essa
// diferença atrás de scroll. Duas TELAS/rotas separadas também foi
// descartado: a nav (DojoShell) só tem UM item "Eventos", e
// components/karate/DojoShell.tsx está sendo mexido por outro agente
// nesta mesma leva (fora do escopo combinado desta PR) — trocar de rota
// exigiria editar a nav. Abas resolvem os dois: mesma rota, mesma nav,
// distinção explícita na interface. Mesmo padrão já usado em alunos.tsx
// (Meus alunos / Na federação) — convenção da casa pra "dado que o dojô
// controla" vs. "dado da federação", reaproveitada aqui.
//
// GAP CONHECIDO (documentado, não corrigido nesta PR — ver corpo do PR):
// DojoShell.tsx esconde o item de nav "Eventos" enquanto `linked ===
// false` (dojô não conectado à federação) — herança da era em que esta
// tela só continha consumo de eventos da federação (que de fato exige
// conexão). Agora que "Meus eventos" NÃO depende de conexão (curso/
// seminário são atos internos do dojô, ver F9 no backend), um dojô ainda
// não conectado fica sem CAMINHO NA NAV até criar seu primeiro curso —
// só alcança por URL direta. Não mexi em DojoShell.tsx porque outro
// agente está reorganizando a navegação do dojô em paralelo.
//
// Container por aba:
//   components/karate/dojoEventos/MeusEventosTab.tsx (novo, F9)
//   components/karate/dojoEventos/EventosFederacaoTab.tsx (extraído do
//     que ANTES era o corpo inteiro deste arquivo — lógica idêntica, só
//     mudou de tela pra componente).
// ============================================================
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { KarateFonts, KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { MeusEventosTab } from "@/components/karate/dojoEventos/MeusEventosTab";
import { EventosFederacaoTab } from "@/components/karate/dojoEventos/EventosFederacaoTab";

type TabKey = "meus" | "federacao";

const TABS: [TabKey, string][] = [
  ["meus", "Meus eventos"],
  ["federacao", "Da federação"],
];

export default function DojoEventos() {
  const { dojoName } = useKarateDojo();
  const [tab, setTab] = useState<TabKey>("meus");

  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>{dojoName}</Text>
        <Text style={styles.title}>Eventos</Text>
        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, tab === key && styles.tabOn]}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
            >
              <Text style={[styles.tabTxt, tab === key && styles.tabTxtOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.body}>
        {tab === "meus" ? <MeusEventosTab /> : <EventosFederacaoTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  head: { paddingHorizontal: 16, paddingTop: 16 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: KarateFonts.mono } as TextStyle,
  title: { fontSize: 24, fontFamily: KarateFonts.heading, fontWeight: "400", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  tabs: { flexDirection: "row", gap: 6, marginTop: 12, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  tab: { paddingVertical: 9, paddingHorizontal: 14, borderTopLeftRadius: KarateRadius.sm, borderTopRightRadius: KarateRadius.sm, borderBottomWidth: 2, borderBottomColor: "transparent" } as ViewStyle,
  tabOn: { borderBottomColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  tabTxt: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  tabTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  body: { flex: 1 } as ViewStyle,
});
