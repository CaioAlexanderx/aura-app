// ============================================================
// AURA. — Campo "Código de Tributação Nacional" com busca por palavra
//
// 10/11/2026. Saiu de dentro de SecaoNfse.tsx (cadastro do serviço) para
// ser usado também no "Pronto para emitir NFS-e?" (código padrão da loja).
// Um campo só que aceita os 6 números OU o que a pessoa faz ("corte de
// cabelo"); a busca é na Lista de Serviços Nacional oficial, carregada sob
// demanda (hooks/useListaServicosNfse.ts). "Sugerir" usa o nome do serviço
// quando há um.
//
// Nome do campo igual ao do Emissor Nacional (gov.br) e do leiaute da DPS
// (cTribNac): "Código de Tributação Nacional".
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useListaServicosNfse } from "@/hooks/useListaServicosNfse";
import {
  DIGITOS_NFSE, acharServico, buscarServicos, faltamNumeros, fmtCodigoNfse, rotuloCurto,
  soDigitos, statusDoCodigo, sugestaoPeloNome,
} from "@/utils/nfseServico";
import { Campo, Entrada, MiniBtn, s } from "@/components/screens/estoque/item-form/ui";

// RN Web transforma em data-enter-local="1": Enter na busca escolhe o
// primeiro serviço da lista em vez de salvar o formulário em volta.
const ENTER_LOCAL = { enterLocal: "1" };

export const EXPERIMENTE_PADRAO = ["corte de cabelo", "manutenção de computador", "consultoria"];

export type StatusDoCampo = "vazio" | "parcial" | "ok" | "busca";

type Props = {
  /** Só dígitos (até 6). */
  codigo: string;
  onCodigo: (codigo: string) => void;
  /** Nome do serviço, para o "Sugerir". Sem nome, o botão some. */
  nome?: string;
  label?: string;
  optional?: string;
  /** Chips "Experimente:" quando o campo está vazio. */
  experimente?: string[];
  /** Avisa quem está em volta quando a pessoa está buscando por palavra. */
  onBuscando?: (buscando: boolean) => void;
  /** Prefixo dos testID (o cadastro do serviço usa "nfse"). */
  testIDBase?: string;
};

function Selinho({ status, texto }: { status: StatusDoCampo; texto: string }) {
  return (
    <View style={[st.selinho, status === "ok" && st.selinhoOk]} pointerEvents="none">
      <Text style={[
        st.selinhoTxt,
        status === "ok" && { color: Colors.green },
        status === "parcial" && { color: Colors.amber },
      ]}>{texto}</Text>
    </View>
  );
}

export function CampoCodigoTributacao(p: Props) {
  const tid = p.testIDBase || "nfse";
  const { lista, erro: erroDaLista } = useListaServicosNfse(true);
  const [busca, setBusca] = useState("");
  const st0 = statusDoCodigo(p.codigo);
  const status: StatusDoCampo = busca ? "busca" : st0;
  const sugestao = useMemo(() => (p.nome != null ? sugestaoPeloNome(lista, p.nome) : null), [lista, p.nome]);
  const resultados = useMemo(() => (busca.trim().length >= 2 ? buscarServicos(lista, busca) : []), [lista, busca]);
  const escolhido = st0 === "ok" ? acharServico(lista, p.codigo) : null;
  const onBuscando = p.onBuscando;
  useEffect(() => { if (onBuscando) onBuscando(!!busca); }, [busca, onBuscando]);

  function usar(codigo: string) {
    setBusca("");
    p.onCodigo(codigo);
  }

  function digitarCodigo(raw: string) {
    if (/^[\d.\s]*$/.test(raw)) {
      setBusca("");
      p.onCodigo(soDigitos(raw, DIGITOS_NFSE.ctribnac));
    } else {
      setBusca(raw);
      if (p.codigo) p.onCodigo("");
    }
  }

  // ── o que aparece embaixo do código ─────────────────────
  let info: any = null;
  if (status === "vazio") {
    info = (
      <View>
        {sugestao ? (
          <Text style={s.hint}>
            Pelo nome:{" "}
            <Text style={s.link} onPress={() => usar(sugestao.codigo)} accessibilityRole="button" testID={tid + "-sugestao-pelo-nome"}>
              {fmtCodigoNfse(sugestao.codigo)}
            </Text>
            {" · " + rotuloCurto(sugestao.descricao) + ". Toque em Sugerir."}
          </Text>
        ) : (
          <Text style={s.hint}>
            Escreva o que você faz — por exemplo, "corte de cabelo" — e escolha na lista. Se já souber, digite os 6 números.
          </Text>
        )}
        <View style={st.comuns}>
          <Text style={st.comunsTxt}>Experimente:</Text>
          {(p.experimente || EXPERIMENTE_PADRAO).map((q) => (
            <Pressable key={q} onPress={() => digitarCodigo(q)} style={st.chipTr} accessibilityLabel={"Buscar " + q}>
              <Text style={st.chipTrTxt}>{q}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  } else if (status === "parcial") {
    info = (
      <Text style={[s.hint, { color: Colors.red }]} testID={tid + "-codigo-erro"}>
        {"Quase lá: " + faltamNumeros(p.codigo, 6).toLowerCase() + ". O código tem 6, como 06.01.01. Se preferir, escreva o nome do serviço e escolha na lista."}
      </Text>
    );
  } else if (status === "ok") {
    info = escolhido ? (
      <View style={st.escolhido} testID={tid + "-codigo-escolhido"}>
        <Icon name="check" size={14} color={Colors.green} />
        <Text style={st.escolhidoTxt}>
          <Text style={{ fontWeight: "700", color: Colors.ink }}>{fmtCodigoNfse(escolhido.codigo)}</Text>
          {" — " + escolhido.descricao + " "}
          <Text style={s.link} onPress={() => { setBusca(""); p.onCodigo(""); }} accessibilityRole="button">Trocar</Text>
        </Text>
      </View>
    ) : lista ? (
      <Text style={[s.hint, { color: Colors.amber }]}>
        Código com 6 números. Não achamos o nome dele na lista: confira com o seu contador antes de emitir.
      </Text>
    ) : (
      <Text style={[s.hint, { color: Colors.green }]}>✓ Código com 6 números</Text>
    );
  } else {
    info = <Text style={s.hint}>Escolha uma opção da lista para preencher o código.</Text>;
  }

  // ── lista de resultados da busca ────────────────────────
  const dropdown = busca.trim().length >= 2 ? (
    <View style={st.dd} testID={tid + "-busca-resultados"}>
      {!lista ? (
        <Text style={st.ddVazio}>
          {erroDaLista
            ? "Não conseguimos abrir a lista de serviços agora. Se já souber, digite os 6 números."
            : "Abrindo a lista de serviços…"}
        </Text>
      ) : resultados.length === 0 ? (
        <Text style={st.ddVazio}>
          {"Não achamos um serviço com \"" + busca.trim() + "\". Tente outra palavra, como \"cabelo\", \"conserto\" ou \"aula\"."}
        </Text>
      ) : (
        resultados.map((r, i) => (
          <Pressable
            key={r.codigo}
            onPress={() => usar(r.codigo)}
            style={[st.op, i > 0 && st.opSep]}
            testID={tid + "-opcao-" + r.codigo}
            accessibilityRole="button"
            accessibilityLabel={fmtCodigoNfse(r.codigo) + " " + r.descricao}
          >
            <Text style={st.opCod}>{fmtCodigoNfse(r.codigo)}</Text>
            <Text style={st.opTxt}>{r.descricao}</Text>
          </Pressable>
        ))
      )}
      <Text style={st.ddRod}>Lista de Serviços Nacional da NFS-e (gov.br, versão 1.01 de jan/2026)</Text>
    </View>
  ) : null;

  const label = p.label || "Código de Tributação Nacional";
  return (
    <Campo label={label} optional={p.optional}>
      <View style={s.linha2}>
        <View style={{ flex: 1, position: "relative" as any }}>
          <Entrada
            value={busca ? busca : fmtCodigoNfse(p.codigo)}
            onChangeText={digitarCodigo}
            placeholder="Busque pelo que você faz ou digite os 6 números"
            accessibilityLabel={label}
            testID={tid + "-codigo"}
            autoCorrect={false}
            autoCapitalize="none"
            dataSet={ENTER_LOCAL}
            onSubmitEditing={() => { if (resultados.length) usar(resultados[0].codigo); }}
            style={[{ paddingRight: 60 }, status === "parcial" && { borderColor: Colors.red }]}
          />
          <Selinho
            status={status}
            texto={status === "ok" ? "✓ OK" : status === "parcial" ? soDigitos(p.codigo).length + "/6" : status === "busca" ? "busca" : "vazio"}
          />
        </View>
        {p.nome != null && (
          <MiniBtn
            label="Sugerir"
            disabled={!sugestao || status === "ok"}
            onPress={() => { if (sugestao) usar(sugestao.codigo); }}
          />
        )}
      </View>
      {dropdown}
      {info}
    </Campo>
  );
}

const st = {
  selinho: {
    position: "absolute" as any, right: 6, top: 6, bottom: 6,
    paddingHorizontal: 7, borderRadius: 5,
    alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
  },
  selinhoOk: { borderColor: "rgba(52,211,153,0.3)", backgroundColor: Colors.greenD },
  selinhoTxt: { fontSize: 10, fontWeight: "700" as const, color: Colors.ink3 },
  comuns: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 6, marginTop: 8 },
  comunsTxt: { fontSize: 11, color: Colors.ink3 },
  chipTr: {
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border2, borderStyle: "dashed" as any,
  },
  chipTrTxt: { fontSize: 11.5, color: Colors.violet3, fontWeight: "600" as const },
  escolhido: {
    flexDirection: "row" as const, gap: 7, alignItems: "flex-start" as const, marginTop: 7,
    backgroundColor: Colors.greenD, borderRadius: 9, borderWidth: 1, borderColor: "rgba(52,211,153,0.3)",
    paddingHorizontal: 10, paddingVertical: 8,
  },
  escolhidoTxt: { flex: 1, fontSize: 11.5, color: Colors.ink2, lineHeight: 16 },
  dd: {
    marginTop: 6, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2,
    backgroundColor: Colors.bg3, overflow: "hidden" as const,
  },
  op: { flexDirection: "row" as const, gap: 10, paddingHorizontal: 12, paddingVertical: 9, alignItems: "flex-start" as const },
  opSep: { borderTopWidth: 1, borderTopColor: Colors.border },
  opCod: { fontSize: 12, fontWeight: "700" as const, color: Colors.violet3, minWidth: 62 },
  opTxt: { flex: 1, fontSize: 12, color: Colors.ink2, lineHeight: 16 },
  ddVazio: { fontSize: 12, color: Colors.ink3, padding: 12, lineHeight: 17 },
  ddRod: { fontSize: 10, color: Colors.ink3, paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.border },
};

export default CampoCodigoTributacao;
