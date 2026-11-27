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
import { View, Text, StyleSheet } from "react-native";
import { Lnk, Selo, Superficie, V, t } from "./waVidro";
import { renderizar } from "./waMensagem";
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
  /** "Ficar com o da Aura": descarta o texto não aprovado. */
  onRestaurar?: (m: WaModeloRaw) => void;
  /** Só estes modelos (chaves). Sem ela, todos da automática. */
  chaves?: string[];
}

export function ModelosLista({ automatica, modelos, carregando, onEditar, onRestaurar, chaves }: Props) {
  if (!modelos) {
    return (
      <Text style={s.aviso} testID={`wa-modelos-${automatica}-indisponivel`}>
        {carregando ? "Carregando as mensagens…" : "Não consegui carregar as mensagens agora."}
      </Text>
    );
  }
  const lista = modelos.filter((m) => m && m.automatica === automatica && typeof m.texto_em_uso === "string" && (!chaves || chaves.includes(String(m.key))));
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }} testID={`wa-modelos-${automatica}`}>
      {lista.map((m) => {
        const est = rotuloEstadoModelo(m.estado);
        const emAprovacao = m.estado === "EM_APROVACAO";
        return (
          <Superficie key={m.key || m.titulo} variante="dry" raio={22} padding={{ h: 18, v: 16 }} gap={8} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 300 }}>
            <View style={{ gap: 8 }} testID={`wa-modelo-${m.key}`}>
              <View style={s.topo}>
                <Text style={t(15, V.ink, "700")}>{m.titulo}</Text>
                <Selo texto={est.texto} tom={est.tom} testID={`wa-modelo-${m.key}-estado`} />
              </View>
              <Text style={t(14, V.ink2)} testID={`wa-modelo-${m.key}-texto`}>{renderizar(String(m.texto_em_uso))}</Text>
              {emAprovacao && (
                <>
                  {!!m.texto_novo && <Text style={t(14, V.ink2, "400", { opacity: 0.45 })}>{renderizar(String(m.texto_novo))}</Text>}
                  <Text style={t(13, V.ink3)}>Costuma sair em algumas horas; a Aura avisa no sino. Até lá vai o texto anterior.</Text>
                </>
              )}
              {m.estado === "NAO_APROVADA" && (
                <Text style={t(13, V.bad)}>
                  {m.motivo ? `${m.motivo} ` : ""}O texto atual continua valendo.
                </Text>
              )}
              <View style={s.acoes}>
                {!!onEditar && !emAprovacao && m.estado !== "AGUARDANDO_PADRAO" && (
                  <Lnk onPress={() => onEditar(m)} testID={`wa-modelo-${m.key}-editar`} tour="wa.editar">
                    {m.estado === "NAO_APROVADA" ? "Ajustar para mim" : "Editar"}
                  </Lnk>
                )}
                {!!onRestaurar && m.estado === "NAO_APROVADA" && (
                  <Lnk onPress={() => onRestaurar(m)} testID={`wa-modelo-${m.key}-restaurar`}>Ficar com o da Aura</Lnk>
                )}
              </View>
            </View>
          </Superficie>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  aviso: { fontSize: 14, fontWeight: "600", color: V.warn, lineHeight: 20 },
  topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  acoes: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
} as any);