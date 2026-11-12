// ============================================================
// AURA. — Conferência de estoque · Últimos preenchimentos de custo
// (12/11/2026, mockup aprovado: tela E)
//
// Mesmo desenho do "Últimos reajustes" do Estoque (app#1172): quando, quem,
// quantos, de onde vieram os números e até quando dá para desfazer. "Ver"
// abre os itens ali mesmo; "Desfazer" pede confirmação dentro do cartão
// (nada de confirm() do navegador). O backend volta só o produto cujo custo
// ainda é o do preenchimento; o que mudou depois (uma entrada de
// mercadoria, por exemplo) fica como está e aparece no aviso.
//
// Por loja (multi-CNPJ): `companyId` é a loja da tela. Sem hover; alvos de
// 44 px; tema do app.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import {
  custoEmMassaApi, mensagemDoCusto,
  type ItemDoPreenchimento, type Preenchimento, type RespostaDesfazer,
} from "@/services/custoEmMassaApi";
import { brl, quandoDoPreenchimento, resumoDoPreenchimento, situacaoDoPreenchimento, listaDeNomes, plural } from "@/utils/custoEmMassa";
import { Aviso, Botao, Cartao, Selo, ui } from "../diferencas/ui";

var POR_PAGINA = 10;

type Props = {
  companyId: string;
  /** Muda quando a tela grava custos: a lista recarrega. */
  versao: number;
  /** Um preenchimento foi desfeito: a tela recarrega os produtos sem custo. */
  onCustosMudaram?: () => void;
};

export function UltimosPreenchimentos({ companyId, versao, onCustosMudaram }: Props) {
  var vivo = useRef(true);
  useEffect(function () { vivo.current = true; return function () { vivo.current = false; }; }, []);

  var [lista, setLista] = useState<Preenchimento[]>([]);
  var [total, setTotal] = useState(0);
  var [carregando, setCarregando] = useState(true);
  var [erro, setErro] = useState<string | null>(null);
  var [aberto, setAberto] = useState<string | null>(null);
  var [itens, setItens] = useState<Record<string, ItemDoPreenchimento[]>>({});
  var [confirmar, setConfirmar] = useState<string | null>(null);
  var [desfazendo, setDesfazendo] = useState<string | null>(null);
  var [desfeito, setDesfeito] = useState<{ id: string; r: RespostaDesfazer } | null>(null);
  var [erroDesfazer, setErroDesfazer] = useState<{ id: string; msg: string } | null>(null);

  var carregar = useCallback(function (limite: number) {
    setErro(null);
    return custoEmMassaApi.historico(companyId, { limit: limite })
      .then(function (r) {
        if (!vivo.current) return;
        setLista(Array.isArray(r && r.preenchimentos) ? r.preenchimentos : []);
        setTotal(Number(r && r.total) || 0);
      })
      .catch(function (e) { if (vivo.current) setErro(mensagemDoCusto(e, "historico")); })
      .finally(function () { if (vivo.current) setCarregando(false); });
  }, [companyId]);

  useEffect(function () { carregar(POR_PAGINA); }, [carregar, versao]);

  function ver(p: Preenchimento) {
    if (aberto === p.id) { setAberto(null); return; }
    setAberto(p.id);
    if (itens[p.id]) return;
    custoEmMassaApi.detalhe(companyId, p.id)
      .then(function (d) {
        if (!vivo.current) return;
        setItens(function (m) { return { ...m, [p.id]: Array.isArray(d && d.itens) ? d.itens : [] }; });
      })
      .catch(function (e) { if (vivo.current) setErroDesfazer({ id: p.id, msg: mensagemDoCusto(e, "historico") }); });
  }

  function desfazer(p: Preenchimento) {
    if (desfazendo) return;
    setConfirmar(null);
    setDesfazendo(p.id);
    setErroDesfazer(null);
    custoEmMassaApi.desfazer(companyId, p.id)
      .then(function (r) {
        if (!vivo.current) return;
        setDesfeito({ id: p.id, r: r });
        setItens(function (m) { var n = { ...m }; delete n[p.id]; return n; });
        if (onCustosMudaram) onCustosMudaram();
        return carregar(Math.max(POR_PAGINA, lista.length));
      })
      .catch(function (e) {
        if (!vivo.current) return;
        setErroDesfazer({ id: p.id, msg: mensagemDoCusto(e, "desfazer") });
        if (e && (e.status === 409 || e.status === 410 || e.status === 404)) carregar(Math.max(POR_PAGINA, lista.length));
      })
      .finally(function () { if (vivo.current) setDesfazendo(null); });
  }

  if (carregando) {
    return <View style={{ padding: 16, alignItems: "center" }} testID="preench-carregando"><ActivityIndicator color={Colors.violet3} /></View>;
  }
  if (erro) {
    return (
      <Cartao testID="preench-erro" style={{ gap: 8 }}>
        <Text style={ui.h3}>Últimos preenchimentos de custo</Text>
        <Text style={ui.nota}>{erro}</Text>
        <View style={{ flexDirection: "row" }}>
          <Botao tipo="secundario" pequeno rotulo="Tentar de novo" onPress={function () { setCarregando(true); carregar(POR_PAGINA); }} testID="preench-tentar" />
        </View>
      </Cartao>
    );
  }
  if (lista.length === 0) return null;

  return (
    <Cartao testID="preench-lista" style={{ gap: 4, paddingHorizontal: 4 }}>
      <Text style={[ui.h3, { paddingHorizontal: 10, paddingTop: 4 }]}>Últimos preenchimentos de custo</Text>
      {lista.map(function (p) {
        var sit = situacaoDoPreenchimento(p);
        var itensAbertos = aberto === p.id ? itens[p.id] : null;
        var meuResultado = desfeito && desfeito.id === p.id ? desfeito.r : null;
        return (
          <View key={p.id} style={s.item} testID={"preench-" + p.id}>
            <View style={s.topo}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.quando}>{quandoDoPreenchimento(p)}</Text>
                <Text style={ui.nota} testID={"preench-resumo-" + p.id}>{resumoDoPreenchimento(p)}</Text>
              </View>
              {sit === "desfeito" ? <Selo tipo="neutro" testID={"preench-desfeito-" + p.id}>Desfeito</Selo> : null}
            </View>
            <View style={s.acoes}>
              <Botao tipo="secundario" pequeno rotulo={aberto === p.id ? "Fechar" : "Ver"} onPress={function () { ver(p); }} testID={"preench-ver-" + p.id} />
              {sit === "pode" ? (
                <Botao tipo="perigo" pequeno rotulo="Desfazer" ocupado={desfazendo === p.id}
                  onPress={function () { setErroDesfazer(null); setConfirmar(p.id); }} testID={"preench-desfazer-" + p.id} />
              ) : null}
            </View>

            {confirmar === p.id ? (
              <Aviso tipo="atencao" testID={"preench-confirmar-" + p.id}>
                <Text style={[ui.avisoTxt, { fontWeight: "700" }]}>{"Desfazer o preenchimento de " + quandoDoPreenchimento(p, true) + "?"}</Text>
                <Text style={[ui.nota, { marginTop: 4, color: Colors.ink }]}>
                  {(p.produtos === 1 ? "O produto volta" : "Os " + plural(p.produtos, "produto", "produtos") + " voltam")
                    + " a ficar sem custo. Se algum ganhou custo novo depois (por uma entrada de mercadoria, por exemplo), ele fica como está."}
                </Text>
                <View style={[s.acoes, { marginTop: 8 }]}>
                  <Botao tipo="secundario" pequeno rotulo="Não, manter" onPress={function () { setConfirmar(null); }} testID={"preench-manter-" + p.id} />
                  <Botao tipo="perigo" pequeno rotulo="Desfazer" onPress={function () { desfazer(p); }} testID={"preench-confirmar-desfazer-" + p.id} />
                </View>
              </Aviso>
            ) : null}

            {meuResultado ? (
              <Aviso tipo="ok" testID={"preench-resultado-" + p.id}>
                <Text style={ui.avisoTxt}>
                  {"Pronto, desfeito. " + (meuResultado.desfeitos === 1 ? "1 produto voltou" : plural(meuResultado.desfeitos, "produto voltou", "produtos voltaram")) + " a ficar sem custo."}
                </Text>
                {meuResultado.mudaram_depois > 0 ? (
                  <Text style={[ui.nota, { marginTop: 4, color: Colors.ink }]} testID={"preench-mudaram-" + p.id}>
                    {(meuResultado.mudaram_depois === 1 ? "1 ficou como está" : plural(meuResultado.mudaram_depois, "ficou como está", "ficaram como estão"))
                      + " porque o custo mudou depois: " + listaDeNomes((meuResultado.mudou_depois || []).map(function (m) { return m.nome || ""; }), 5) + "."}
                  </Text>
                ) : null}
              </Aviso>
            ) : null}

            {erroDesfazer && erroDesfazer.id === p.id ? <Aviso tipo="erro" testID={"preench-erro-" + p.id}>{erroDesfazer.msg}</Aviso> : null}

            {aberto === p.id ? (
              itensAbertos ? (
                <View style={{ gap: 2 }} testID={"preench-itens-" + p.id}>
                  {itensAbertos.map(function (i) {
                    return (
                      <View key={i.product_id} style={s.itemLinha}>
                        <Text style={[ui.nota, { flex: 1, minWidth: 0, color: Colors.ink }]} numberOfLines={2}>{i.nome || "Produto"}</Text>
                        <Text style={ui.nota}>
                          {(i.custo_antes ? brl(i.custo_antes) : "sem custo") + " → " + brl(i.custo_depois)
                            + (i.desfazer === "mudou_depois" ? " · mudou depois" : i.desfazer === "desfeito" ? " · desfeito" : "")}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : <ActivityIndicator color={Colors.violet3} />
            ) : null}
          </View>
        );
      })}
      {lista.length < total ? (
        <View style={{ padding: 10 }}>
          <Botao tipo="secundario" pequeno rotulo="Ver mais" onPress={function () { carregar(lista.length + POR_PAGINA); }} testID="preench-mais" />
        </View>
      ) : null}
    </Cartao>
  );
}

var s = StyleSheet.create({
  item: { borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 10, paddingVertical: 10, gap: 8 },
  topo: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  quando: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  itemLinha: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 3 },
});

export default UltimosPreenchimentos;
