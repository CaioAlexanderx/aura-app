// Uma linha contada: nome, variante, − número +, remover. Tocar no número
// abre o campo para digitar a quantidade. O botão de remover fica sempre
// visível (nada de aparecer só no hover: no celular não existe hover).
import { useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { lerQuantidadeDigitada, mostrarQuantidade, type LinhaContada } from "@/utils/conferenciaContagem";
import { ce } from "../estilos";

export function LinhaDaContagem({
  linha, destaque, asCegas, semConexao, onMais, onMenos, onDefinir, onRemover,
}: {
  linha: LinhaContada;
  destaque: boolean;
  asCegas: boolean;
  semConexao: boolean;
  onMais: () => void;
  onMenos: () => void;
  onDefinir: (n: number) => void;
  onRemover: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const id = linha.chave;

  function salvarTexto() {
    const n = lerQuantidadeDigitada(texto);
    if (n === null) return;
    onDefinir(n);
    setEditando(false);
  }

  const detalhe: string[] = [];
  if (linha.variante) detalhe.push(linha.variante);
  if (!linha.codigo) detalhe.push("sem código, achado pelo nome");
  // Às cegas: o número do sistema NUNCA aparece nesta tela.
  if (!asCegas && typeof linha.sistema === "number") detalhe.push("sistema: " + mostrarQuantidade(linha.sistema));

  return (
    <View
      testID={"linha-" + id}
      style={{
        padding: 10, borderRadius: 12, borderWidth: 1, gap: 6,
        borderColor: destaque ? Colors.green : Colors.border,
        backgroundColor: destaque ? Colors.greenD : Colors.bg3,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={ce.espaco}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.ink }} numberOfLines={2}>{linha.nome}</Text>
          {detalhe.length > 0 && <Text style={ce.nota} numberOfLines={2}>{detalhe.join(" · ")}</Text>}
        </View>
        {editando ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TextInput
              value={texto}
              onChangeText={setTexto}
              onSubmitEditing={salvarTexto}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
              style={[ce.input, { width: 72, paddingVertical: 7, textAlign: "center" }]}
              testID={"linha-campo-" + id}
              accessibilityLabel={"Quantidade contada de " + linha.nome}
            />
            <Pressable onPress={salvarTexto} style={[ce.btn, ce.btnPequeno]} testID={"linha-ok-" + id}>
              <Text style={ce.btnTexto}>OK</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Pressable onPress={onMenos} style={passo} testID={"linha-menos-" + id} accessibilityLabel={"Menos um de " + linha.nome}>
              <Text style={passoTexto}>−</Text>
            </Pressable>
            <Pressable
              onPress={() => { setTexto(mostrarQuantidade(linha.contado)); setEditando(true); }}
              testID={"linha-numero-" + id}
              accessibilityLabel={"Digitar a quantidade de " + linha.nome}
              style={{ minWidth: 34, paddingVertical: 6, alignItems: "center" }}
            >
              <Text style={{ fontSize: 17, fontWeight: "700", color: Colors.ink }}>{mostrarQuantidade(linha.contado)}</Text>
            </Pressable>
            <Pressable onPress={onMais} style={passo} testID={"linha-mais-" + id} accessibilityLabel={"Mais um de " + linha.nome}>
              <Text style={passoTexto}>+</Text>
            </Pressable>
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text style={[ce.nota, ce.espaco, linha.estado === "erro" && { color: Colors.red }]} testID={"linha-estado-" + id}>
          {linha.estado === "erro"
            ? (linha.mensagem || "Não deu para salvar este item.")
            : linha.estado === "pendente"
              ? (semConexao ? "Guardado aqui, esperando a conexão" : "Salvando…")
              : ""}
        </Text>
        {confirmarRemocao ? (
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable onPress={() => setConfirmarRemocao(false)} style={[ce.btnFantasma, ce.btnPequeno]}>
              <Text style={ce.btnFantasmaTexto}>Manter</Text>
            </Pressable>
            <Pressable onPress={onRemover} style={[ce.btn, ce.btnPequeno, { backgroundColor: Colors.red }]} testID={"linha-remover-sim-" + id}>
              <Text style={ce.btnTexto}>Tirar da contagem</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmarRemocao(true)} testID={"linha-remover-" + id} accessibilityRole="button" style={{ paddingVertical: 4 }}>
            <Text style={{ color: Colors.ink3, fontSize: 12.5, fontWeight: "600" }}>Remover</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const passo = {
  width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  backgroundColor: Colors.bg4, alignItems: "center" as const, justifyContent: "center" as const,
};
const passoTexto = { fontSize: 18, fontWeight: "700" as const, color: Colors.ink };
