// ============================================================
// AURA. — NF-e 55 · Passo 3 · Revisar (CP4). Aviso de homologação ou
// produção, para quem, valores. O resultado de uma tentativa (recusa,
// espera, bloqueio) aparece aqui, em texto humano.
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { Colors } from "@/constants/colors";
import type { Previa } from "@/services/nfe55Api";
import { brl, fmtCep, fmtDocumento, rotuloDaIe, rotuloDoFrete, type FormNfe55, type ResultadoDaTela } from "@/utils/nfe55";
import { BotaoSec, Cartao, Faixa, Linha, p } from "./partes";

type Props = {
  form: FormNfe55;
  previa: Previa | null;
  estreito: boolean;
  resultado: ResultadoDaTela | null;
  onMudarCliente: () => void;
};

export function PassoRevisar({ form, previa, estreito, resultado, onMudarCliente }: Props) {
  const prod = previa?.ambiente === "producao";
  const t = previa?.totais;
  const cfops = [...new Set((previa?.itens || []).map((i) => i.cfop))].join(" / ");
  const endereco = [
    [form.logradouro, form.numero || "S/N", form.complemento].filter(Boolean).join(", "),
    form.bairro, `${form.municipio}/${form.uf}`, fmtCep(form.cep),
  ].filter(Boolean).join(" · ");
  return (
    <View testID="nfe55-passo-revisar">
      {resultado && resultado.tipo !== "pronto" ? <Resultado r={resultado} /> : null}
      {prod ? (
        <Faixa tom="verde" titulo="Nota de verdade (produção)" texto="Vai para a Sefaz com o certificado da loja." testID="nfe55-producao" />
      ) : (
        <Faixa tom="ambar" titulo="Nota de TESTE (homologação): não vale como nota fiscal"
          texto="Serve para conferir que tudo funciona. O cliente não deve usar esta nota. Para emitir de verdade, ligue a produção em Notas › Configurações." testID="nfe55-homologacao" />
      )}
      <View style={[p.grid, estreito && { flexDirection: "column" }]}>
        <Cartao titulo="Para quem">
          <Linha rotulo="Cliente" valor={form.nome || "—"} />
          <Linha rotulo={form.documento.replace(/\D/g, "").length === 14 ? "CNPJ" : "CPF"} valor={fmtDocumento(form.documento) || "—"} />
          <Linha rotulo="IE" valor={rotuloDaIe(form)} />
          <Linha rotulo="Endereço" valor={endereco || "—"} />
          {form.email ? <Linha rotulo="E-mail" valor={form.email} /> : null}
          <View style={{ marginTop: 10, alignSelf: "flex-start" }}><BotaoSec titulo="Mudar cliente" onPress={onMudarCliente} testID="nfe55-mudar-cliente" /></View>
        </Cartao>
        <Cartao titulo="Valores">
          <Linha rotulo="Produtos" valor={brl(t?.produtos)} />
          <Linha rotulo="Desconto" valor={brl(t?.desconto)} />
          <Linha rotulo={"Frete (" + rotuloDoFrete(form.modFrete).toLowerCase() + ")"} valor={brl(t?.frete)} />
          <Linha rotulo="Imposto destacado" valor="Simples Nacional: não destaca ICMS" />
          <Linha rotulo="Total da nota" valor={brl(t?.nota)} forte />
          {(previa?.pagamentos || []).map((pg, i) => (
            <Linha key={i} rotulo={i === 0 ? "Pagamento" : ""} valor={`${pg.forma}${pg.a_prazo ? " · a prazo" : ""} · ${brl(pg.valor)}`} />
          ))}
          <Linha rotulo="Natureza · CFOP" valor={`${form.naturezaOperacao} · ${cfops || "—"}`} />
          <Text style={[p.hint, { marginTop: 6 }]}>O número da nota é reservado na hora de emitir.</Text>
        </Cartao>
      </View>
    </View>
  );
}

function Resultado({ r }: { r: ResultadoDaTela }) {
  if (r.tipo === "rejeicao") {
    return (
      <Faixa tom="vermelho" titulo={r.titulo} texto={r.texto} testID="nfe55-rejeicao">
        <Text style={[p.bannerS, { marginTop: 6, color: Colors.ink, fontWeight: "600" }]}>O que fazer: {r.acao}</Text>
        {r.tecnico ? <Text style={[p.hint, { marginTop: 6 }]}>Detalhe técnico (para o suporte): {r.tecnico}</Text> : null}
      </Faixa>
    );
  }
  if (r.tipo === "aguardando") return <Faixa tom="ambar" titulo={r.titulo} texto={r.texto} testID="nfe55-aguardando" />;
  if (r.tipo === "conflito") return <Faixa tom="vermelho" titulo={r.titulo} texto={r.texto} testID="nfe55-conflito" />;
  if (r.tipo === "bloqueio" || r.tipo === "erro") return <Faixa tom="vermelho" titulo={r.titulo} texto={r.texto} testID="nfe55-bloqueio" />;
  if (r.tipo === "faltantes") return <Faixa tom="ambar" titulo={r.titulo} texto={r.texto} testID="nfe55-faltantes" />;
  return null;
}
