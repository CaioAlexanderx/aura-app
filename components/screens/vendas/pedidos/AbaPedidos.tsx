// ============================================================
// AURA. — Vendas › Pedidos (A5a, p-63e, 17/11/2026)
//
// Mockup aprovado pelo Caio em 17/11 ("Pedido separado de venda", parte 3 e
// estados da parte 7): os pedidos abertos num lugar só, com os atrasados na
// frente. Quatro números (Abertos, Atrasados, Sinais recebidos, Falta
// receber), chips por situação, busca e a lista.
//
//   · Os números são sempre dos ABERTOS (o backend calcula assim), para o
//     cartão não mudar quando a lojista troca o chip.
//   · A ordem (atrasados primeiro, depois a data mais perto) vem do backend.
//   · Consolidado multi-CNPJ: /me/pedidos, números somados, "Centro 7 ·
//     Shopping 4" embaixo de Abertos e Atrasados, "soma das lojas" embaixo
//     dos valores, e o selo da loja em cada linha.
//   · Vazio: sem pedido nenhum, o convite do mockup com "Abrir o Caixa"; no
//     chip de atrasados sem resultado, "Nenhum pedido atrasado".
//
// Só aparece com a trava PEDIDO_LIBERADO e o módulo vendas.pedidos
// (hooks/usePedidos.ts, useAbaPedidos); quem decide é app/(tabs)/vendas.tsx.
//
// A5b (p-63f): ações na linha (AcoesDoPedido) e a gaveta (GavetaDoPedido).
// ============================================================
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { brl } from "@/components/screens/vendas/editarVendaUtils";
import { usePedidos, type ChipDosPedidos, type LinhaDoPedido as Pedido } from "@/hooks/usePedidos";
import { LinhaDoPedido, CabecalhoDaLista } from "./LinhaDoPedido";
import { AcoesDoPedido } from "./AcoesDoPedido";
import { GavetaDoPedido } from "./GavetaDoPedido";
import {
  TEXTOS_DOS_PEDIDOS as T, TEXTOS_FORA_DO_MOCKUP as F, chipsDosPedidos, hojeEmSaoPaulo,
  pecasReservadas, porLoja,
} from "./regrasDosPedidos";

/** Abaixo disto a lista vira cartões (celular e tablet em pé). */
export const LARGURA_DA_TABELA = 900;

export function AbaPedidos() {
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_DA_TABELA;
  const [chip, setChip] = useState<ChipDosPedidos>("abertos");
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  // A5b: a gaveta do pedido (a linha aberta; null = fechada).
  const [aberto, setAberto] = useState<Pedido | null>(null);

  // A busca sai 300 ms depois da última tecla (uma ida ao servidor, não uma por letra).
  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const { pedidos, numeros, contagem, porEmpresa, lojas, consolidado, isLoading, error, refetch } =
    usePedidos(chip, busca);
  const hoje = hojeEmSaoPaulo();
  const mostrarLoja = consolidado && lojas > 1;
  const chips = chipsDosPedidos(contagem);
  const nenhumPedido = !!contagem && contagem.todos === 0;

  // A5b: as ações ficam sempre na linha (Avisar, Separar/Pronto, Mais ações).
  const acoesDaLinha = (p: Pedido) => (
    <AcoesDoPedido
      pedido={{
        id: p.id, company_id: p.company_id, order_number: p.order_number, status: String(p.status),
        customer_name: p.customer_name, customer_phone: p.customer_phone, promised_date: p.promised_date,
        pecas: p.pecas,
      }}
      hoje={hoje}
      cheio={!largo}
      onMais={() => setAberto(p)}
    />
  );
  const onAbrir = (p: Pedido) => setAberto(p);

  const subAbertos = mostrarLoja
    ? porLoja(porEmpresa.map((e) => ({ company_name: e.company_name, valor: e.abertos })))
    : pecasReservadas(numeros?.pecas_reservadas || 0);
  const subAtrasados = mostrarLoja
    ? porLoja(porEmpresa.map((e) => ({ company_name: e.company_name, valor: e.atrasados })))
    : T.kpiAtrasadosSub;

  return (
    <View testID="aba-pedidos">
      <View style={s.kpis}>
        <Kpi rotulo={T.kpiAbertos} valor={String(numeros?.abertos ?? 0)} sub={subAbertos} testID="kpi-abertos" />
        <Kpi rotulo={T.kpiAtrasados} valor={String(numeros?.atrasados ?? 0)} sub={subAtrasados} vermelho testID="kpi-atrasados" />
        <Kpi rotulo={T.kpiSinais} valor={brl(numeros?.sinais_recebidos || 0)} sub={mostrarLoja ? T.kpiSomaDasLojas : T.kpiSinaisSub} testID="kpi-sinais" />
        <Kpi rotulo={T.kpiFalta} valor={brl(numeros?.falta_receber || 0)} sub={mostrarLoja ? T.kpiSomaDasLojas : T.kpiFaltaSub} testID="kpi-falta" />
      </View>

      <View style={s.filtros}>
        <View style={s.chips}>
          {chips.map((c) => {
            const on = c.key === chip;
            return (
              <Pressable
                key={c.key}
                onPress={() => setChip(c.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[s.chip, on && s.chipOn, c.vermelho && !on && s.chipVermelho]}
                testID={"chip-" + c.key}
              >
                <Text style={[s.chipTexto, on && s.chipTextoOn, c.vermelho && !on && s.vermelho]}>{c.label}</Text>
                {c.contagem !== undefined && <Text style={s.chipNum}>{c.contagem}</Text>}
              </Pressable>
            );
          })}
        </View>
        <View style={s.busca}>
          <Icon name="search" size={15} color={Colors.ink3} />
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder={T.busca}
            placeholderTextColor={Colors.ink3}
            style={s.buscaInput}
            testID="busca-pedidos"
          />
        </View>
      </View>

      {isLoading && !pedidos.length ? (
        <View style={s.carregando}><ActivityIndicator color={Colors.violet3} /></View>
      ) : error && !pedidos.length ? (
        <View style={s.erro} testID="pedidos-erro">
          <Icon name="alert_circle" size={16} color={Colors.red} />
          <Text style={s.erroTexto}>{error.message}</Text>
          <Pressable onPress={() => refetch()} style={s.botao} accessibilityRole="button">
            <Text style={s.botaoTexto}>{T.tentarDeNovo}</Text>
          </Pressable>
        </View>
      ) : !pedidos.length ? (
        <Vazio chip={chip} buscando={!!busca} nenhumPedido={nenhumPedido} />
      ) : largo ? (
        <View style={s.tabela}>
          <CabecalhoDaLista comAcoes />
          {pedidos.map((p) => (
            <LinhaDoPedido
              key={p.id}
              pedido={p}
              hoje={hoje}
              largo
              mostrarLoja={mostrarLoja}
              acoes={acoesDaLinha(p)}
              onAbrir={() => onAbrir(p)}
            />
          ))}
        </View>
      ) : (
        <View>
          {pedidos.map((p) => (
            <LinhaDoPedido
              key={p.id}
              pedido={p}
              hoje={hoje}
              largo={false}
              mostrarLoja={mostrarLoja}
              acoes={acoesDaLinha(p)}
              onAbrir={() => onAbrir(p)}
            />
          ))}
        </View>
      )}

      <GavetaDoPedido linha={aberto} hoje={hoje} mostrarLoja={mostrarLoja} onClose={() => setAberto(null)} />
    </View>
  );
}

function Kpi({ rotulo, valor, sub, vermelho, testID }: { rotulo: string; valor: string; sub: string; vermelho?: boolean; testID: string }) {
  return (
    <View style={s.kpi} testID={testID}>
      <Text style={s.kpiRotulo}>{rotulo}</Text>
      <Text style={[s.kpiValor, vermelho && s.vermelho]}>{valor}</Text>
      {!!sub && <Text style={s.kpiSub}>{sub}</Text>}
    </View>
  );
}

function Vazio({ chip, buscando, nenhumPedido }: { chip: ChipDosPedidos; buscando: boolean; nenhumPedido: boolean }) {
  // Nenhum pedido na loja (ou nenhum aberto): o convite do mockup.
  if (!buscando && (nenhumPedido || chip === "abertos")) {
    return (
      <View style={s.vazio} testID="pedidos-vazio">
        <View style={s.vazioIcone}><Icon name="bag" size={24} color={Colors.violet3} /></View>
        <Text style={s.vazioTitulo}>{T.vazioTitulo}</Text>
        <Text style={s.vazioTexto}>{T.vazioTexto}</Text>
        <Pressable onPress={() => router.push("/(tabs)/pdv" as any)} style={s.botaoP} accessibilityRole="button" testID="pedidos-abrir-caixa">
          <Text style={s.botaoPTexto}>{T.vazioAcao}</Text>
        </Pressable>
      </View>
    );
  }
  if (!buscando && chip === "atrasados") {
    return (
      <View style={[s.vazio, s.vazioCurto]} testID="pedidos-sem-atrasado">
        <Text style={s.vazioTitulo}>{T.semAtrasadoTitulo}</Text>
        <Text style={[s.vazioTexto, { marginBottom: 0 }]}>{T.semAtrasadoTexto}</Text>
      </View>
    );
  }
  return (
    <View style={[s.vazio, s.vazioCurto]} testID="pedidos-sem-resultado">
      <Text style={[s.vazioTexto, { marginBottom: 0 }]}>{buscando ? F.semResultadoNaBusca : F.semResultadoNoChip}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  kpi: { flexGrow: 1, flexBasis: 150, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Colors.bg3 },
  kpiRotulo: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  kpiValor: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginTop: 2 },
  kpiSub: { fontSize: 12, color: Colors.ink3 },
  vermelho: { color: Colors.red },
  filtros: { gap: 10, marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3 },
  chipOn: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  chipVermelho: { borderColor: Colors.red },
  chipTexto: { fontSize: 12.5, fontWeight: "600", color: Colors.ink2 },
  chipTextoOn: { color: Colors.ink },
  chipNum: { fontSize: 11, color: Colors.ink3 },
  busca: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3 },
  buscaInput: { flex: 1, minWidth: 0, fontSize: 13, color: Colors.ink, paddingVertical: 8 },
  carregando: { paddingVertical: 48, alignItems: "center" },
  erro: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.red, backgroundColor: Colors.redD, flexWrap: "wrap" },
  erroTexto: { flex: 1, minWidth: 180, fontSize: 12.5, color: Colors.ink },
  botao: { minHeight: 36, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  botaoTexto: { fontSize: 12.5, fontWeight: "600", color: Colors.ink },
  tabela: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: "hidden", backgroundColor: Colors.bg3 },
  vazio: { alignItems: "center", paddingVertical: 34, paddingHorizontal: 20, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, borderRadius: 14, backgroundColor: Colors.bg3 },
  vazioCurto: { paddingVertical: 22 },
  vazioIcone: { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  vazioTitulo: { fontSize: 15, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  vazioTexto: { fontSize: 13, color: Colors.ink2, textAlign: "center", maxWidth: 420, marginTop: 4, marginBottom: 12, lineHeight: 19 },
  botaoP: { minHeight: 42, paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  botaoPTexto: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
});
