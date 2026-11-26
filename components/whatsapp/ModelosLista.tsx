// ============================================================
// ModelosLista — o texto que o cliente lê, por automática
//
// Cada modelo vem pronto. Se a lojista muda o texto, ele passa pela
// aprovação do WhatsApp (algumas horas); até lá vai o anterior. Esta
// lista mostra o estado: pronta, texto novo em aprovação (com o texto
// novo apagado e o atual valendo), aprovado, não aprovado (com o motivo
// em português e o texto atual continuando).
// ============================================================
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import type { WaModeloRaw } from "@/services/waConfigApi";

export function rotuloEstadoModelo(estado: string | null | undefined): { texto: string; tom: "ok" | "warn" | "danger" } {
  switch (estado) {
    case "em_aprovacao": return { texto: "Texto novo em aprovação", tom: "warn" };
    case "nao_aprovado": return { texto: "Não aprovado", tom: "danger" };
    case "aprovado": return { texto: "Aprovado", tom: "ok" };
    default: return { texto: "Pronta", tom: "ok" };
  }
}

interface Props {
  grupo: string;
  modelos: WaModeloRaw[] | null;
  carregando: boolean;
  /** Abre o editor. Sem ela, a lista é só leitura. */
  onEditar?: (m: WaModeloRaw) => void;
}

export function ModelosLista({ grupo, modelos, carregando, onEditar }: Props) {
  if (!modelos) {
    return (
      <Text style={s.aviso} testID={`wa-modelos-${grupo}-indisponivel`}>
        {carregando ? "Carregando as mensagens…" : "Não consegui carregar as mensagens agora."}
      </Text>
    );
  }
  const lista = modelos.filter((m) => m && m.grupo === grupo && typeof m.texto === "string");
  return (
    <View style={{ gap: 10 }} testID={`wa-modelos-${grupo}`}>
      {lista.map((m) => {
        const est = rotuloEstadoModelo(m.estado);
        const cor = est.tom === "ok" ? Colors.green : est.tom === "warn" ? Colors.amber : Colors.red;
        const emAprovacao = m.estado === "em_aprovacao";
        return (
          <View key={m.chave || m.titulo} style={s.item} testID={`wa-modelo-${m.chave}`}>
            <View style={s.topo}>
              <Text style={s.titulo}>{m.titulo}</Text>
              <Text style={[s.estado, { color: cor }]} testID={`wa-modelo-${m.chave}-estado`}>{est.texto}</Text>
            </View>
            <Text style={s.texto}>{m.texto}</Text>
            {emAprovacao && (
              <>
                {!!m.texto_pendente && <Text style={[s.texto, { opacity: 0.45 }]}>{m.texto_pendente}</Text>}
                <Text style={s.nota}>Costuma sair em algumas horas; a Aura avisa no sino. Até lá vai o texto anterior.</Text>
              </>
            )}
            {m.estado === "nao_aprovado" && (
              <Text style={[s.nota, { color: Colors.red }]}>
                {m.motivo ? `${m.motivo} ` : ""}O texto atual continua valendo.
              </Text>
            )}
            {!!onEditar && (
              <Pressable onPress={() => onEditar(m)} accessibilityRole="button" style={s.btnLink} testID={`wa-modelo-${m.chave}-editar`}>
                <Text style={s.btnLinkTxt}>{m.estado === "nao_aprovado" ? "Ajustar" : "Editar"}</Text>
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
