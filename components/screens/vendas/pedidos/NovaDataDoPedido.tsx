// ============================================================
// AURA. — Aba Pedidos: "Nova data" do pedido (17/11/2026)
//
// O botão "Nova data" do mockup aprovado em 17/11 (parte 7, pedido
// atrasado) abre este diálogo, na linha da lista e na gaveta. As escolhas
// são as de "Quando ela vem buscar" do Novo pedido (parte 2): Amanhã,
// Sexta, Em 7 dias e Outra data (campo dd/mm/aaaa).
//
// Abre por cima da gaveta, que é um ResponsiveSheet (Modal), e tem campo de
// texto: por isso JanelaEmpilhada, nunca WebPortal (INC-2026-11-17-01, o
// foco voltava para a janela de baixo e não dava para digitar).
//
// Grava pelo PATCH /companies/:id/pedidos/:oid/data (Aura-backend#1077), na
// loja DONA do pedido (consolidado incluso). Ao gravar, fecha e a lista se
// atualiza: o atrasado sai do topo quando a data nova é futura (a ordem vem
// do backend). Erro (rede ou servidor): o diálogo fica aberto, com a data
// escolhida, e mostra a frase. O atraso só destaca: mudar a data não mexe
// na reserva nem na situação (pendência 5).
// ============================================================
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { toast } from "@/components/Toast";
import { JanelaEmpilhada } from "@/components/JanelaEmpilhada";
import { DateInput, formatIsoToBr, parseBrDate } from "@/components/inputs/DateInput";
import { useMudarDataDoPedido } from "@/hooks/usePedidos";
import {
  TEXTOS_DOS_PEDIDOS as T, TEXTOS_FORA_DO_MOCKUP as F, dataLonga, opcoesDeData,
} from "./regrasDosPedidos";

export type PedidoDaNovaData = {
  id: string;
  company_id: string;
  order_number: string;
  customer_name: string | null;
  promised_date: string | null;
};

type Escolha = "amanha" | "sexta" | "em7" | "outra" | null;

type Props = {
  pedido: PedidoDaNovaData;
  hoje: string;
  onClose: () => void;
};

/** A escolha que já vem marcada: a data de hoje do pedido, se ainda não passou. */
function escolhaInicial(promised: string | null, hoje: string): { escolha: Escolha; outra: string } {
  if (!promised || promised < hoje) return { escolha: null, outra: "" };
  const o = opcoesDeData(hoje).find((x) => x.dia === promised);
  if (o) return { escolha: o.key, outra: "" };
  return { escolha: "outra", outra: formatIsoToBr(promised) };
}

export function NovaDataDoPedido({ pedido: p, hoje, onClose }: Props) {
  const { mudarData, salvando } = useMudarDataDoPedido();
  const opcoes = useMemo(() => opcoesDeData(hoje), [hoje]);
  const inicio = useMemo(() => escolhaInicial(p.promised_date, hoje), [p.promised_date, hoje]);
  const [escolha, setEscolha] = useState<Escolha>(inicio.escolha);
  const [outra, setOutra] = useState(inicio.outra);
  const [erro, setErro] = useState<string | null>(null);

  const dia = escolha === "outra" ? parseBrDate(outra) : (opcoes.find((o) => o.key === escolha)?.dia || null);
  // Data que não existe (31/02): o próprio DateInput avisa, com a frase de baixo.
  const aviso = dia && dia < hoje ? F.dataPassou : null;
  const podeSalvar = !!dia && !aviso && !salvando;

  function escolher(e: Escolha) {
    setEscolha(e);
    setErro(null);
  }

  async function salvar() {
    if (!podeSalvar || !dia) return;
    setErro(null);
    try {
      await mudarData({ companyId: p.company_id, orderId: p.id, promised_date: dia });
      onClose();
    } catch (err: any) {
      const msg = (err && err.message) || F.erroAoMudarData;
      setErro(msg);
      // 409: o pedido foi concluído ou cancelado enquanto isso. Na gaveta o
      // rodapé some com a lista atualizada (e o diálogo junto): o toast garante
      // que a frase seja lida.
      if (Number(err && err.status) === 409) toast.error(msg);
    }
  }

  const fechar = () => { if (!salvando) onClose(); };
  const sub = ["Pedido " + p.order_number, p.customer_name].filter(Boolean).join(" · ");

  return (
    <JanelaEmpilhada onRequestClose={fechar}>
      <View style={s.overlay}>
        <Pressable style={s.fundo} onPress={fechar} accessibilityLabel={T.cancelar} testID="nova-data-fundo" />
        <View style={[s.painel, painelWeb()]} testID="nova-data">
          <View style={s.cab}>
            <View style={s.cabIcone}><Icon name="calendar" size={16} color={Colors.violet3} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.titulo}>{T.novaData}</Text>
              <Text style={s.sub} numberOfLines={1}>{sub}</Text>
            </View>
            <Pressable onPress={fechar} style={s.fechar} accessibilityRole="button" accessibilityLabel={T.cancelar} testID="nova-data-fechar">
              <Icon name="x" size={16} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.corpo} keyboardShouldPersistTaps="handled">
            {!!p.promised_date && (
              <Text style={s.antes} testID="nova-data-antes">{T.prometidoPara + " " + dataLonga(p.promised_date) + "."}</Text>
            )}
            <Text style={s.pergunta}>{T.quandoVemBuscar}</Text>
            <View style={s.chips} accessibilityRole="radiogroup">
              {opcoes.map((o) => (
                <Chip key={o.key} on={escolha === o.key} onPress={() => escolher(o.key)} testID={"nova-data-" + o.key}>
                  {o.label} <Text style={[s.chipDetalhe, escolha === o.key && s.chipDetalheOn]}>{o.detalhe}</Text>
                </Chip>
              ))}
              <Chip on={escolha === "outra"} onPress={() => escolher("outra")} icone testID="nova-data-outra">
                {T.outraData}
              </Chip>
            </View>
            {escolha === "outra" && (
              <View style={s.campo}>
                <DateInput
                  value={outra}
                  onChangeText={(v) => { setOutra(v); setErro(null); }}
                  autoFocus
                  forceShowError
                  errorMessage={F.dataInvalida}
                  testID="nova-data-campo"
                  onSubmitEditing={salvar}
                />
              </View>
            )}
            {!!aviso && <Text style={s.erro} testID="nova-data-aviso">{aviso}</Text>}
            {!!erro && <Text style={s.erro} testID="nova-data-erro">{erro}</Text>}
          </ScrollView>

          <View style={s.rodape}>
            <Button title={T.cancelar} variant="ghost" onPress={fechar} disabled={salvando} testID="nova-data-cancelar" />
            <Button
              title={F.salvarData}
              variant="primary"
              onPress={salvar}
              loading={salvando}
              disabled={!podeSalvar}
              testID="nova-data-salvar"
            />
          </View>
        </View>
      </View>
    </JanelaEmpilhada>
  );
}

function Chip({ on, onPress, icone, testID, children }: {
  on: boolean; onPress: () => void; icone?: boolean; testID: string; children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, on && s.chipOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      testID={testID}
    >
      {icone && <Icon name="calendar" size={14} color={on ? "#fff" : Colors.violet3} />}
      <Text style={[s.chipTexto, on && s.chipTextoOn]}>{children}</Text>
    </Pressable>
  );
}

function painelWeb(): any {
  if (typeof document === "undefined") return { backgroundColor: Colors.bg3 };
  return {
    backgroundColor: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
  };
}

const s = StyleSheet.create({
  overlay: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 16 },
  fundo: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  painel: { width: "100%", maxWidth: 480, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  cab: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cabIcone: { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 17, color: Colors.ink, fontWeight: "700" },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  fechar: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  corpo: { paddingHorizontal: 18, paddingVertical: 16 },
  antes: { fontSize: 13, color: Colors.ink2, marginBottom: 12 },
  pergunta: { fontSize: 12, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4 },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipTexto: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  chipTextoOn: { color: "#fff" },
  chipDetalhe: { fontSize: 12, fontWeight: "500", color: Colors.ink3 },
  chipDetalheOn: { color: "#ede9fe" },
  campo: { marginTop: 12, maxWidth: 260 },
  erro: { marginTop: 10, fontSize: 12.5, color: Colors.red, fontWeight: "600" },
  rodape: { flexDirection: "row", justifyContent: "flex-end", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg2 },
});
