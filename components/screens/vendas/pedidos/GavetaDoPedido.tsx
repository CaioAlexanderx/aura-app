// ============================================================
// AURA. — Aba Pedidos: a gaveta do pedido (A5b, p-63f, 17/11/2026)
//
// Mockup aprovado em 17/11 (parte 3, "gaveta do pedido"), no contêiner do
// SaleDetailModal (ResponsiveSheet: diálogo no computador, folha de baixo
// no celular; cabeçalho fixo, conteúdo que rola, rodapé fixo).
//
//   · Cabeçalho: "Pedido P-0012", a cliente e quando foi guardado.
//   · Situação e "Vem buscar sexta, 20/11".
//   · Peças reservadas, Pagamento (total, sinal, falta na retirada) e
//     "O que aconteceu".
//   · Rodapé: Avisar / Lembrar a cliente, Separar ou Pronto.
//
// O detalhe vem de GET /companies/:id/pedidos/:oid (Aura-backend#1073), na
// loja DONA do pedido (consolidado incluso). O backend ainda não devolve a
// forma nem o dia do sinal (B4a) nem o nome de quem guardou: a gaveta mostra
// "Sinal" sem a forma, e o cabeçalho sem "por [vendedora]".
//
// Sem campo de texto e sem nada abrindo por cima: ResponsiveSheet basta
// (a exceção da JanelaEmpilhada não se aplica).
// ============================================================
import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { brl } from "@/components/screens/vendas/editarVendaUtils";
import { usePedidoDetalhe, type LinhaDoPedido } from "@/hooks/usePedidos";
import { SeloDaSituacao, SeloDaLoja } from "./LinhaDoPedido";
import { AcoesDoPedido } from "./AcoesDoPedido";
import {
  TEXTOS_DOS_PEDIDOS as T, TEXTOS_FORA_DO_MOCKUP as F, dataLonga, diaEHora, guardadoEm, situacaoAberta,
} from "./regrasDosPedidos";

type Props = {
  /** A linha da lista que foi aberta (null = gaveta fechada). */
  linha: LinhaDoPedido | null;
  hoje: string;
  mostrarLoja: boolean;
  onClose: () => void;
};

export function GavetaDoPedido({ linha, hoje, mostrarLoja, onClose }: Props) {
  const { pedido, isLoading, error } = usePedidoDetalhe(linha?.company_id, linha?.id);
  if (!linha) return null;

  // Enquanto o detalhe não chega, a linha da lista já dá o essencial.
  const status = String(pedido?.status || linha.status);
  const nome = pedido?.customer_name ?? linha.customer_name;
  const telefone = pedido?.customer_phone ?? linha.customer_phone;
  const promessa = pedido?.promised_date ?? linha.promised_date;
  const total = pedido ? pedido.total : linha.total;
  const sinal = pedido ? pedido.sinal_pago : linha.sinal_pago;
  const falta = pedido ? pedido.falta : linha.falta;
  const criado = pedido?.created_at || linha.created_at;
  const pecas = pedido ? pedido.items.reduce((n, i) => n + (Number(i.quantity) || 0), 0) : linha.pecas;
  const separou = status === "preparing" || status === "ready" || status === "delivered";

  const subtitulo = [nome, guardadoEm(criado, hoje)].filter(Boolean).join(" · ");

  return (
    <ResponsiveSheet visible={!!linha} onClose={onClose} maxWidth={480}>
      <View style={s.cab}>
        <View style={s.cabIcone}><Icon name="bag" size={16} color={Colors.violet3} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.titulo} numberOfLines={1}>{"Pedido " + linha.order_number}</Text>
          {!!subtitulo && <Text style={s.sub} numberOfLines={1}>{subtitulo}</Text>}
          {mostrarLoja && <SeloDaLoja nome={linha.company_name} />}
        </View>
        <Pressable onPress={onClose} style={s.fechar} accessibilityRole="button" accessibilityLabel={T.fechar} testID="pedido-fechar">
          <Icon name="x" size={16} color={Colors.ink3} />
        </Pressable>
      </View>

      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.corpo}>
        <View style={s.situacao}>
          <SeloDaSituacao status={status} />
          {!!promessa && situacaoAberta(status) && (
            <Text style={s.vem}>{T.vemBuscar} <Text style={s.forte}>{dataLonga(promessa)}</Text></Text>
          )}
        </View>

        <Text style={s.secao}>{T.pecasReservadas}</Text>
        {isLoading && !pedido ? (
          <View style={s.carregando}>
            <ActivityIndicator color={Colors.violet3} />
            <Text style={s.sub}>{F.carregando}</Text>
          </View>
        ) : error && !pedido ? (
          <Text style={s.erro} testID="pedido-erro">{error.message}</Text>
        ) : (
          (pedido?.items || []).map((i) => (
            <View key={i.id} style={s.linha} testID={"pedido-item-" + i.id}>
              <Text style={s.linhaTexto} numberOfLines={2}>
                {(i.quantity > 1 ? i.quantity + " × " : "") + i.product_name + (i.variant_label ? " · " + i.variant_label : "")}
              </Text>
              <Text style={s.valor}>{brl(i.subtotal)}</Text>
            </View>
          ))
        )}

        <Text style={s.secao}>{T.pagamento}</Text>
        <View style={s.linha}>
          <Text style={s.linhaTexto}>{T.totalDoPedido}</Text>
          <Text style={s.valor}>{brl(total)}</Text>
        </View>
        {sinal > 0 && (
          <View style={s.linha}>
            <Text style={s.linhaTexto}>{T.sinal}</Text>
            <Text style={[s.valor, s.verde]}>{"− " + brl(sinal)}</Text>
          </View>
        )}
        <View style={[s.linha, s.linhaTotal]} testID="pedido-falta">
          <Text style={[s.linhaTexto, s.forte]}>{T.faltaNaRetirada}</Text>
          <Text style={[s.valor, s.valorTotal]}>{brl(falta)}</Text>
        </View>

        <Text style={s.secao}>{T.oQueAconteceu}</Text>
        <View style={s.hist} testID="pedido-historico">
          <Marco feito>
            <Text style={s.forte}>{T.guardadoNoCaixa}</Text>{" " + T.noCaixa + (criado ? " · " + diaEHora(criado) : "")}
          </Marco>
          {sinal > 0 && (
            <Marco feito><Text style={s.forte}>{"Sinal de " + brl(sinal)}</Text></Marco>
          )}
          {situacaoAberta(status) && (
            <>
              <Marco feito={separou}>{T.separarAsPecas}</Marco>
              <Marco>{T.concluirFuturo}</Marco>
            </>
          )}
        </View>
      </ScrollView>

      {situacaoAberta(status) && (
        <View style={s.rodape}>
          <AcoesDoPedido
            pedido={{
              id: linha.id, company_id: linha.company_id, order_number: linha.order_number, status,
              customer_name: nome, customer_phone: telefone, promised_date: promessa, pecas,
            }}
            hoje={hoje}
            cheio
          />
        </View>
      )}
    </ResponsiveSheet>
  );
}

function Marco({ feito, children }: { feito?: boolean; children: React.ReactNode }) {
  return (
    <View style={s.marco}>
      <View style={[s.ponto, !feito && s.pontoFuturo]} />
      <Text style={s.marcoTexto}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  cab: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cabIcone: { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 17, color: Colors.ink, fontWeight: "700" },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  fechar: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  corpo: { paddingHorizontal: 18, paddingVertical: 14 },
  situacao: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  vem: { fontSize: 12.5, color: Colors.ink2 },
  forte: { color: Colors.ink, fontWeight: "700" },
  secao: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: Colors.ink3, marginTop: 14, marginBottom: 6 },
  carregando: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  erro: { fontSize: 12.5, color: Colors.red },
  linha: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 5 },
  linhaTexto: { flex: 1, fontSize: 13, color: Colors.ink2 },
  linhaTotal: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 8 },
  valor: { fontSize: 13, color: Colors.ink, fontFamily: "monospace" as any },
  valorTotal: { fontSize: 15, color: Colors.violet3, fontWeight: "700" },
  verde: { color: Colors.green },
  hist: { gap: 8, marginTop: 2 },
  marco: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  ponto: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.violet, marginTop: 4 },
  pontoFuturo: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: Colors.border2 },
  marcoTexto: { flex: 1, fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  rodape: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg2 },
});
