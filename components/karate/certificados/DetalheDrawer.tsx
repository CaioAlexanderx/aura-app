// ============================================================
// DetalheDrawer — Track J (Certificados)
//
// Drawer de detalhe do pedido: cabeçalho, dados, linha do tempo
// (EstadoSelo por evento) e bloco "Processar" (avançar / recusar).
// Reskin Shoji; mesmo comportamento e props da versão inline.
// ============================================================
import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P } from "@/constants/karateTheme";
import { EstadoSelo, normalizeCertStatus, CertOrderStatus } from "@/components/karate/EstadoSelo";
import { CertOrder } from "@/services/karateApi";
import { cs, fmtDate, STATUS_SELECT_OPTIONS } from "./shared";

export function DetalheDrawer({
  order, visible, onClose, onAdvance, onRecusar,
}: {
  order: CertOrder | null;
  visible: boolean;
  onClose: () => void;
  onAdvance: (orderId: string, status: CertOrderStatus | "refused_trigger") => void;
  onRecusar: (orderId: string) => void;
}) {
  if (!order) return null;
  const history = order.history || [];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cs.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={cs.drawer}>
          <View style={cs.drawerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={cs.drawerMono}>{order.id.slice(0,8).toUpperCase()}</Text>
              <Text style={cs.drawerName}>{order.nome_impresso}</Text>
              <Text style={cs.drawerBelt}>{order.belt_name}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={22} color={C.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <Text style={cs.kLabel}>Estado</Text>
              <EstadoSelo status={normalizeCertStatus(order.status)} />
            </View>

            {order.status === "refused" && order.refusal_reason ? (
              <View style={cs.refusalBox}>
                <Text style={cs.refusalTitle}>Motivo da recusa</Text>
                <Text style={cs.refusalText}>{order.refusal_reason}</Text>
              </View>
            ) : null}

            <View style={cs.kvList}>
              <View style={cs.kvRow}><Text style={cs.kLabel}>Nome impresso</Text><Text style={cs.kValue}>{order.nome_impresso}</Text></View>
              <View style={cs.kvRow}><Text style={cs.kLabel}>Banca</Text><Text style={cs.kValue}>{order.exam_ref || order.exam_date || "—"}</Text></View>
              <View style={cs.kvRow}>
                <Text style={cs.kLabel}>Entrega</Text>
                <View>
                  <Text style={cs.kValue}>{order.delivery_type === "mail" ? "Envio por correio" : "Retirada no dojô"}</Text>
                  {order.delivery_type === "mail" && order.addr_logradouro ? (
                    <Text style={cs.kAddr}>{order.addr_logradouro}{order.addr_numero ? ", " + order.addr_numero : ""}{"\n"}{order.addr_complemento ? order.addr_complemento + "\n" : ""}{order.addr_cep} · {order.addr_cidade}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            <Text style={[cs.fieldLabel, { marginTop: 20, marginBottom: 10 }]}>Linha do tempo</Text>
            {history.length === 0 ? (
              <Text style={cs.kValue}>Nenhum registro ainda</Text>
            ) : (
              history.map((h, i) => (
                <View key={h.id} style={cs.tlRow}>
                  <View style={cs.tlDotCol}>
                    <View style={[cs.tlDot, { backgroundColor: i === history.length - 1 ? P.red : C.ink4 }]} />
                    {i < history.length - 1 ? <View style={cs.tlLine} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 14 }}>
                    <EstadoSelo status={normalizeCertStatus(h.to_status)} />
                    <Text style={cs.tlWho}>{h.who_name || "—"}</Text>
                    <Text style={cs.tlOrg}>{h.org_name || ""} · {fmtDate(h.created_at)}</Text>
                  </View>
                </View>
              ))
            )}

            {order.status !== "refused" && order.status !== "shipped" ? (
              <View style={cs.processBox}>
                <Text style={[cs.fieldLabel, { marginBottom: 10 }]}>Processar</Text>
                <View style={{ gap: 6 }}>
                  {STATUS_SELECT_OPTIONS.filter((o) => o.value !== order.status).map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={cs.processOpt}
                      onPress={() => {
                        if (opt.value === "refused_trigger") { onRecusar(order.id); }
                        else { onAdvance(order.id, opt.value as CertOrderStatus); }
                      }}
                    >
                      <Text style={[cs.processOptText, opt.value === "refused_trigger" && { color: C.danger }]}>{opt.label}</Text>
                      <Icon name="chevron_right" size={14} color={C.ink4} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
