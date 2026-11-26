// ============================================================
// AURA. — Detalhe da condicional: "Nova data" (C10, 26/11/2026)
//
// Mesmo padrão do NovaDataDoPedido (escolhas rápidas + "Outra data" com
// dd/mm/aaaa). O backend aceita de hoje até hoje + 30 (fuso de São Paulo) e
// qualquer vendedora pode mudar. Abre por cima da gaveta (ResponsiveSheet) e
// tem campo de texto: JanelaEmpilhada, nunca WebPortal.
// Erro (rede ou 409/422): o diálogo fica aberto, com a data escolhida, e
// mostra a frase do servidor.
// ============================================================
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { JanelaEmpilhada } from "@/components/JanelaEmpilhada";
import { DateInput, parseBrDate } from "@/components/inputs/DateInput";
import { dataLonga, opcoesDeData, somarDias, TEXTOS_DOS_PEDIDOS as P } from "@/components/screens/vendas/pedidos/regrasDosPedidos";
import { TEXTOS_DO_DETALHE as T, TEXTOS_FORA_DO_MOCKUP as F } from "./regrasDoDetalhe";

type Escolha = "amanha" | "sexta" | "em7" | "outra" | null;

type Props = {
  numero: string;
  cliente: string | null;
  prazoAtual: string | null;
  hoje: string;
  /** Grava; rejeita com o erro do servidor. */
  onSalvar: (dia: string) => Promise<unknown>;
  onClose: () => void;
};

export function NovaDataDaCondicional({ numero, cliente, prazoAtual, hoje, onSalvar, onClose }: Props) {
  const opcoes = useMemo(() => opcoesDeData(hoje), [hoje]);
  const [escolha, setEscolha] = useState<Escolha>(null);
  const [outra, setOutra] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const dia = escolha === "outra" ? parseBrDate(outra) : (opcoes.find((o) => o.key === escolha)?.dia || null);
  const aviso = dia && dia < hoje ? F.dataPassou : dia && dia > somarDias(hoje, 30) ? F.dataLonge : null;
  const podeSalvar = !!dia && !aviso && !salvando;

  async function salvar() {
    if (!podeSalvar || !dia) return;
    setErro(null);
    setSalvando(true);
    try {
      await onSalvar(dia);
      setSalvando(false);
      onClose();
    } catch (err: any) {
      setSalvando(false);
      setErro((err && err.message) || F.erroGenerico);
    }
  }

  const fechar = () => { if (!salvando) onClose(); };
  const sub = [numero, cliente].filter(Boolean).join(" · ");

  return (
    <JanelaEmpilhada onRequestClose={fechar}>
      <View style={s.overlay}>
        <Pressable style={s.fundo} onPress={fechar} accessibilityLabel={P.cancelar} testID="cond-nova-data-fundo" />
        <View style={[s.painel, painelWeb()]} testID="cond-nova-data">
          <View style={s.cab}>
            <View style={s.cabIcone}><Icon name="calendar" size={16} color={Colors.violet3} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.titulo}>{T.novaData}</Text>
              <Text style={s.sub} numberOfLines={1}>{sub}</Text>
            </View>
            <Pressable onPress={fechar} style={s.fechar} accessibilityRole="button" accessibilityLabel={P.cancelar} testID="cond-nova-data-fechar">
              <Icon name="x" size={16} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.corpo} keyboardShouldPersistTaps="handled">
            {!!prazoAtual && <Text style={s.antes} testID="cond-nova-data-antes">{"Hoje ela volta até " + dataLonga(prazoAtual) + "."}</Text>}
            <Text style={s.pergunta}>Volta até</Text>
            <View style={s.chips} accessibilityRole="radiogroup">
              {opcoes.map((o) => (
                <Chip key={o.key} on={escolha === o.key} onPress={() => { setEscolha(o.key); setErro(null); }} testID={"cond-nova-data-" + o.key}>
                  {o.label} <Text style={[s.chipDetalhe, escolha === o.key && s.chipDetalheOn]}>{o.detalhe}</Text>
                </Chip>
              ))}
              <Chip on={escolha === "outra"} onPress={() => { setEscolha("outra"); setErro(null); }} testID="cond-nova-data-outra">
                {P.outraData}
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
                  testID="cond-nova-data-campo"
                  onSubmitEditing={salvar}
                />
              </View>
            )}
            {!!aviso && <Text style={s.erro} testID="cond-nova-data-aviso">{aviso}</Text>}
            {!!erro && <Text style={s.erro} testID="cond-nova-data-erro">{erro}</Text>}
          </ScrollView>

          <View style={s.rodape}>
            <Button title={P.cancelar} variant="ghost" onPress={fechar} disabled={salvando} testID="cond-nova-data-cancelar" />
            <Button title={F.salvarData} variant="primary" onPress={salvar} loading={salvando} disabled={!podeSalvar} testID="cond-nova-data-salvar" />
          </View>
        </View>
      </View>
    </JanelaEmpilhada>
  );
}

function Chip({ on, onPress, testID, children }: { on: boolean; onPress: () => void; testID: string; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: on }} testID={testID}>
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
