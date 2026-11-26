// ============================================================
// configUi — peças compartilhadas das telas de cada automática
//
// Passo (bloco numerado), Pilulas (escolha com um toque), PilulaToggle,
// Interruptor, BolhaExemplo (a mensagem como a cliente vê) e
// PreviaCorteView ("Cabem N de M", quem fica de fora apagado, "Trazer N do
// Venda+").
// ============================================================
import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import type { Corte } from "./waCorte";

export function Passo({ n, titulo, sub, children }: { n?: string; titulo: string; sub?: string; children?: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.passoTopo}>
        {!!n && <Text style={s.passoN}>{n}</Text>}
        <Text style={s.titulo}>{titulo}</Text>
      </View>
      {!!sub && <Text style={s.sub}>{sub}</Text>}
      {children}
    </View>
  );
}

export interface Opcao<T extends string> { valor: T; rotulo: string }

export function Pilulas<T extends string>({
  opcoes, valor, onPick, desabilitado, idBase,
}: { opcoes: Opcao<T>[]; valor: T | null | undefined; onPick: (v: T) => void; desabilitado?: boolean; idBase: string }) {
  return (
    <View style={s.pilulas}>
      {opcoes.map((o) => {
        const on = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onPick(o.valor)}
            disabled={desabilitado}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: !!desabilitado }}
            style={[s.pilula, on && s.pilulaOn, desabilitado && { opacity: 0.6 }]}
            testID={`${idBase}-${o.valor}`}
          >
            <Text style={[s.pilulaTxt, on && s.pilulaTxtOn]}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Liga/desliga de uma pílula (vários podem estar ligados ao mesmo tempo). */
export function PilulaToggle({
  rotulo, ligada, onToggle, desabilitado, testID,
}: { rotulo: string; ligada: boolean; onToggle: () => void; desabilitado?: boolean; testID: string }) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={desabilitado}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: ligada, disabled: !!desabilitado }}
      style={[s.pilula, ligada && s.pilulaOn, desabilitado && { opacity: 0.6 }]}
      testID={testID}
    >
      <Text style={[s.pilulaTxt, ligada && s.pilulaTxtOn]}>{rotulo}</Text>
    </Pressable>
  );
}

export function Interruptor({
  ligado, onToggle, desabilitado, rotulo, testID,
}: { ligado: boolean; onToggle: () => void; desabilitado?: boolean; rotulo: string; testID: string }) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={desabilitado}
      accessibilityRole="switch"
      accessibilityState={{ checked: ligado, disabled: !!desabilitado }}
      accessibilityLabel={rotulo}
      style={[s.sw, ligado && s.swOn, desabilitado && { opacity: 0.6 }]}
      testID={testID}
    >
      <View style={[s.swBolinha, ligado && s.swBolinhaOn]} />
    </Pressable>
  );
}

export function BolhaExemplo({ titulo, mensagem, rodape }: { titulo: string; mensagem: string | null | undefined; rodape?: boolean }) {
  // Sem exemplo, não inventa texto.
  if (!mensagem) return null;
  return (
    <View style={s.bolhaWrap} testID="wa-config-bolha">
      <Text style={s.bolhaTitulo}>{titulo}</Text>
      <View style={s.bolha}>
        <Text style={s.bolhaTxt}>{mensagem}</Text>
        {rodape !== false && <Text style={s.bolhaSair}>Para não receber mais, responda SAIR.</Text>}
      </View>
    </View>
  );
}

interface PreviaProps {
  corte: Corte | null;
  /** "aniversariantes", "clientes"... */
  substantivo: string;
  /** Nome da reserva: "Aniversário", "Venda+", "Crediário". */
  dono: string;
  /** Novidades que sobram para o dono (para "Usa N das M guardadas"). */
  reserva: number | null | undefined;
  trazer: number;
  onTrazer?: () => void;
  trazendo?: boolean;
  idBase: string;
}

export function PreviaCorteView({ corte, substantivo, dono, reserva, trazer, onTrazer, trazendo, idBase }: PreviaProps) {
  if (!corte) {
    return (
      <Text style={s.aviso} testID={`${idBase}-previa-indisponivel`}>
        Não consegui calcular quem cabe agora. Por segurança, nada é enviado até eu conseguir.
      </Text>
    );
  }
  const fica = corte.total - corte.cabem;
  return (
    <View style={{ gap: 8 }} testID={`${idBase}-previa`}>
      <Text style={s.tituloMenor} testID={`${idBase}-cabem`}>
        {corte.cabeTodos ? "Cabe todo mundo." : `Cabem ${corte.cabem} de ${corte.total}.`}
      </Text>
      <Text style={s.sub}>
        {corte.cabeTodos
          ? `Usa ${corte.precisa} das ${reserva ?? 0} novidades guardadas para ${dono}.`
          : `${fica} ${substantivo} ficam sem a mensagem${corte.ordem ? ` (${corte.ordem})` : ""}. Ninguém recebe além do que cabe.`}
      </Text>

      {corte.recebem.map((p) => (
        <View key={`r-${p.nome}`} style={s.pessoa} testID={`${idBase}-recebe`}>
          <Text style={s.pessoaNome}>{p.nome}</Text>
          {!!p.detalhe && <Text style={s.pessoaDet}>{p.detalhe}</Text>}
        </View>
      ))}
      {corte.ficam.map((p) => (
        <View key={`f-${p.nome}`} style={[s.pessoa, { opacity: 0.35 }]} testID={`${idBase}-fora`}>
          <Text style={s.pessoaNome}>{p.nome} · fica de fora</Text>
          {!!p.detalhe && <Text style={s.pessoaDet}>{p.detalhe}</Text>}
        </View>
      ))}
      {corte.alemDaLista > 0 && <Text style={s.sub}>e mais {corte.alemDaLista} {substantivo}</Text>}

      {trazer > 0 && !!onTrazer && (
        <Pressable
          onPress={onTrazer}
          disabled={trazendo}
          accessibilityRole="button"
          style={[s.btnSec, trazendo && { opacity: 0.6 }]}
          testID={`${idBase}-trazer`}
        >
          {trazendo && <ActivityIndicator size="small" color={Colors.violet3} />}
          <Text style={s.btnSecTxt}>{trazer === 1 ? "Trazer 1 do Venda+" : `Trazer ${trazer} do Venda+`}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  passoTopo: { flexDirection: "row", alignItems: "center", gap: 10 },
  passoN: { fontSize: 11, fontWeight: "800", color: Colors.violet3, letterSpacing: 1 },
  titulo: { fontSize: 14, fontWeight: "800", color: Colors.ink, flexShrink: 1 },
  tituloMenor: { fontSize: 13, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  aviso: { fontSize: 12, fontWeight: "600", color: Colors.amber, lineHeight: 17 },
  pilulas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pilula: {
    minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2,
  },
  pilulaOn: { backgroundColor: Colors.violetD, borderColor: Colors.violet3 },
  pilulaTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.ink2 },
  pilulaTxtOn: { color: Colors.violet3, fontWeight: "800" },
  sw: { width: 48, height: 28, borderRadius: 14, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border2, justifyContent: "center", padding: 2 },
  swOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  swBolinha: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.ink3 },
  swBolinhaOn: { backgroundColor: "#fff", alignSelf: "flex-end" },
  bolhaWrap: { gap: 6 },
  bolhaTitulo: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase" },
  bolha: { backgroundColor: Colors.violetD, borderRadius: 16, borderWidth: 1, borderColor: Colors.border2, padding: 12, gap: 6 },
  bolhaTxt: { fontSize: 13.5, color: Colors.ink, lineHeight: 20 },
  bolhaSair: { fontSize: 11, color: Colors.ink3 },
  pessoa: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 8 },
  pessoaNome: { fontSize: 12.5, fontWeight: "700", color: Colors.ink },
  pessoaDet: { fontSize: 11.5, color: Colors.ink3 },
  btnSec: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "flex-start",
    minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2,
  },
  btnSecTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
} as any);
