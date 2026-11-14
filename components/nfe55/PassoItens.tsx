// ============================================================
// AURA. — NF-e 55 · Passo 2 · Itens e imposto (CP4). Itens fixos (são os
// da venda), CFOP sugerido pelo backend, natureza, entrega e observações.
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { Colors } from "@/constants/colors";
import type { Faltante, Previa } from "@/services/nfe55Api";
import { NATUREZAS, OPCOES_FRETE, brl, faltantesDosItens, type CampoForm, type FormNfe55 } from "@/utils/nfe55";
import { Campo, Cartao, Faixa, Opcao, p } from "./partes";

type Props = {
  form: FormNfe55;
  set: <K extends keyof FormNfe55>(k: K, v: FormNfe55[K]) => void;
  falta: Partial<Record<CampoForm, Faltante>>;
  faltantes: Faltante[];
  previa: Previa | null;
  estreito: boolean;
};

export function PassoItens({ form, set, falta, faltantes, previa, estreito }: Props) {
  const itens = previa?.itens || [];
  const semNcm = faltantesDosItens(faltantes);
  const cfops = [...new Set(itens.map((i) => i.cfop))];
  const interestadual = previa?.operacao?.id_dest === 2;
  return (
    <View testID="nfe55-passo-itens">
      {semNcm.length ? (
        <Faixa tom="ambar" titulo={semNcm.length === 1 ? "1 produto sem NCM no cadastro" : `${semNcm.length} produtos sem NCM no cadastro`}
          texto="A NF-e não sai sem o NCM (8 números). Corrija no cadastro do produto e volte aqui." testID="nfe55-faixa-ncm">
          {semNcm.map((f) => <Text key={f.campo} style={[p.bannerS, { marginTop: 4 }]}>• {f.mensagem}</Text>)}
        </Faixa>
      ) : null}
      <Cartao titulo="Itens da venda" sub="Os itens, as quantidades e os preços são os da venda. Para mudar um item, mude a venda.">
        {itens.map((it, i) => {
          const sem = semNcm.some((f) => f.campo === `itens[${i}].ncm`);
          return (
            <View key={i} style={{ flexDirection: estreito ? "column" : "row", gap: estreito ? 2 : 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border }} testID={"nfe55-item-" + i}>
              <View style={{ flex: 3, minWidth: 0 }}>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: Colors.ink }}>{it.nome}</Text>
                <Text style={[p.muted, sem && { color: Colors.amber, fontWeight: "600" }]}>
                  {it.quantidade} {it.unidade} · NCM {it.ncm || "não informado"}{it.csosn === "500" ? " · imposto já pago antes (ST)" : ""}
                </Text>
              </View>
              <Text style={{ flex: 1, fontSize: 12.5, color: Colors.violet3, fontWeight: "700" }}>CFOP {it.cfop}</Text>
              <Text style={{ flex: 1, fontSize: 13.5, color: Colors.ink, fontWeight: "600", textAlign: estreito ? "left" : "right" }}>{brl(it.valor_total)}</Text>
            </View>
          );
        })}
        {previa?.servicos_fora_da_nota ? (
          <Text style={[p.hint, { marginTop: 8 }]}>Serviços desta venda ficam fora da NF-e: eles saem na nota de serviço (NFS-e).</Text>
        ) : null}
      </Cartao>
      <View style={[p.grid, { marginTop: 16 }, estreito && { flexDirection: "column" }]}>
        <Cartao titulo="Tipo de venda" sub="Já escolhemos pelo cliente e pelo estado dele.">
          <Text style={p.lab}>Natureza da operação</Text>
          {NATUREZAS.map((n) => (
            <Opcao key={n} ligada={form.naturezaOperacao === n} titulo={n} onPress={() => set("naturezaOperacao", n)} testID={"nfe55-natureza-" + NATUREZAS.indexOf(n)} />
          ))}
          <Text style={[p.lab, { marginTop: 8 }]}>Código da operação (CFOP)</Text>
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: Colors.ink }} testID="nfe55-cfops">{cfops.join(" / ") || "—"}</Text>
          <Text style={p.hint}>
            {interestadual ? "Cliente de outro estado: 6102 (ou 6404 se o imposto já veio pago na compra)." : "Mesmo estado: 5102 (ou 5405 se o imposto já veio pago na compra)."}
            {" "}É o mesmo cálculo da NFC-e, pelo cadastro do produto.
          </Text>
        </Cartao>
        <Cartao titulo="Entrega" sub="Quem paga o frete.">
          {OPCOES_FRETE.map((o) => (
            <Opcao key={o.valor} ligada={form.modFrete === o.valor} titulo={o.titulo} texto={o.texto} onPress={() => set("modFrete", o.valor)} testID={"nfe55-frete-" + o.valor} />
          ))}
          {form.modFrete === 1 ? (
            <>
              <Campo rotulo="Transportadora (opcional)" valor={form.transportadoraNome} onChange={(v) => set("transportadoraNome", v)} />
              <Campo rotulo="CNPJ da transportadora (opcional)" valor={form.transportadoraDocumento} onChange={(v) => set("transportadoraDocumento", v)}
                falta={falta.transportadoraDocumento} teclado="number-pad" mono />
            </>
          ) : null}
          {previa?.totais?.frete ? <Text style={p.hint}>Frete da venda: {brl(previa.totais.frete)} (sai na nota).</Text> : null}
          <Campo rotulo="Observações na nota (opcional)" valor={form.observacoes} onChange={(v) => set("observacoes", v)} multiline
            dica={'Sai em "Informações complementares".'} testID="nfe55-obs" />
        </Cartao>
      </View>
    </View>
  );
}
