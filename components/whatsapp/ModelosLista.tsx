// ============================================================
// ModelosLista — o texto que o cliente lê, por automática
//
// Cada modelo vem pronto. Se a lojista muda o texto, ele passa pela
// aprovação do WhatsApp (algumas horas); até lá vai o anterior. Esta
// lista mostra o estado (contrato do agente B): PRONTA, EM_APROVACAO
// (texto novo apagado e o atual valendo), NAO_APROVADA (com o motivo e o
// atual continuando) e AGUARDANDO_PADRAO (o texto da Aura ainda não foi
// aprovado pela Meta: a automática que o usa não liga).
// ============================================================
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import type { WaModeloRaw } from "@/services/waConfigApi";

export function rotuloEstadoModelo(estado: string | null | undefined): { texto: string; tom: "ok" | "warn" | "danger" } {
  switch (estado) {
    case "EM_APROVACAO": return { texto: "Texto novo em aprovação", tom: "warn" };
    case "NAO_APROVADA": return { texto: "Não aprovado", tom: "danger" };
    case "AGUARDANDO_PADRAO": return { texto: "Aguardando o WhatsApp aprovar", tom: "warn" };
    case "PRONTA": return { texto: "Pronta", tom: "ok" };
    // Estado desconhecido: não afirma que está pronta.
    default: return { texto: "Conferindo", tom: "warn" };
  }
}

interface Props {
  automatica: string;
  modelos: WaModeloRaw[] | null;
  carregando: boolean;
  /** Abre o editor. Sem ela, a lista é só leitura. */
  onEditar?: (m: WaModeloRaw) => void;
}

export function ModelosLista({ automatica, modelos, carregando, onEditar }: Props) {
  if (!modelos) {
    return (
      <Text style={s.aviso} testID={`wa-modelos-${automatica}-indisponivel`}>
        {carregando ? "Carregando as mensagens…" : "Não consegui carregar as mensagens agora."}
      </Text>
    );
  }
  const lista = modelos.filter((m) => m && m.automatica === automatica && typeof m.texto_em_uso === "string");
  return (
    <View style={{ gap: 10 }} testID={`wa-modelos-${automatica}`}>
      {lista.map((m) => {
        const est = rotuloEstadoModelo(m.estado);
        const cor = est.tom === "ok" ? Colors.green : est.tom === "warn" ? Colors.amber : Colors.red;
        const emAprovacao = m.estado === "EM_APROVACAO";
        return (
          <View key={m.key || m.titulo} style={s.item} testID={`wa-modelo-${m.key}`}>
            <View style={s.topo}>
              <Text style={s.titulo}>{m.titulo}</Text>
              <Text style={[s.estado, { color: cor }]} testID={`wa-modelo-${m.key}-estado`}>{est.texto}</Text>
            </View>
            <Text style={s.texto}>{m.texto_em_uso}</Text>
            {emAprovacao && (
              <>
                {!!m.texto_novo && <Text style={[s.texto, { opacity: 0.45 }]}>{m.texto_novo}</Text>}
                <Text style={s.nota}>Costuma sair em algumas horas; a Aura avisa no sino. Até lá vai o texto anterior.</Text>
              </>
            )}
            {m.estado === "NAO_APROVADA" && (
              <Text style={[s.nota, { color: Colors.red }]}>
                {m.motivo ? `${m.motivo} ` : ""}O texto atual continua valendo.
              </Text>
            )}
            {!!onEditar && !emAprovacao && m.estado !== "AGUARDANDO_PADRAO" && (
              <Pressable onPress={() => onEditar(m)} accessibilityRole="button" style={s.btnLink} testID={`wa-modelo-${m.key}-editar`}>
                <Text style={s.btnLinkTxt}>{m.estado === "NAO_APROVADA" ? "Ajustar" : "Editar"}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  aviso: { fontSize: 12, fontWeight: "600", color: Colors.amber, lineHeight: 17 },
  item: { backgroundColor: Colors.bg2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, padding: 12, gap: 6 },
  topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  titulo: { fontSize: 13, fontWeight: "800", color: Colors.ink },
  estado: { fontSize: 11.5, fontWeight: "700" },
  texto: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  nota: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16 },
  btnLink: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  btnLinkTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
} as any);
