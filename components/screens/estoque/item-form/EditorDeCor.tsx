// ============================================================
// Editor de cor do item (CP4a da revisão de cores, 14/11/2026)
//
// Mockup aprovado pelo Caio (https://claude.ai/artifact/TWrXQqRaJsQwuzKr2KYbVZ,
// telas 1 e 5):
//   - as cores do produto em chips; tocar no chip abre "Nome desta cor";
//   - "+ Cor" abre a paleta única COM O NOME de cada amostra, por família,
//     com busca ("caqui", "off", "marinho", com ou sem acento);
//   - "Nome próprio, com amostra": o nome que ela quiser + a amostra (seletor
//     do navegador no web; o hex digitado vale em qualquer lugar).
// Nada depende de hover (regra 7 do CLAUDE.md): toda ação é um botão.
// Regras (e a regra crítica da etiqueta) em regrasDaCor.ts.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Chip, Entrada, IS_WEB, s } from "./ui";
import type { CorDoItem } from "./types";
import {
  paletaFiltrada, jaTemCor, comCorDaPaleta, comNomeProprio, renomear,
  sugestoesParaAmostra, nomeMaisPerto, hexValido,
} from "./regrasDaCor";

const AMOSTRA_INICIAL = "#C8B6A6";

// Check escuro em cor clara (branco, amarelo), claro no resto.
function corClara(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

export function EditorDeCor({ cores, onCores, narrow }: {
  cores: CorDoItem[];
  onCores: (v: CorDoItem[]) => void;
  narrow?: boolean;
}) {
  const [abrir, setAbrir] = useState(false);
  const [busca, setBusca] = useState("");
  const [nomeProprio, setNomeProprio] = useState("");
  const [amostra, setAmostra] = useState(AMOSTRA_INICIAL);
  const [amostraTxt, setAmostraTxt] = useState(AMOSTRA_INICIAL);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");

  const familias = paletaFiltrada(busca);
  const corEmEdicao = renomeando ? cores.find((c) => c.hex.toUpperCase() === renomeando) || null : null;
  const podeAdicionar = !!nomeProprio.trim() && !!hexValido(amostra) && !jaTemCor(cores, amostra);

  function fecharPaleta() {
    setAbrir(false);
    setBusca("");
  }
  function abrirRenomear(c: CorDoItem) {
    setRenomeando(c.hex.toUpperCase());
    setNovoNome(c.name || "");
  }
  function salvarNome() {
    if (corEmEdicao) onCores(renomear(cores, corEmEdicao.hex, novoNome));
    setRenomeando(null);
  }
  function mudarAmostraTxt(v: string) {
    setAmostraTxt(v);
    const h = hexValido(v);
    if (h) setAmostra(h);
  }
  function adicionarNomeProprio() {
    if (!podeAdicionar) return;
    onCores(comNomeProprio(cores, nomeProprio, amostra));
    setNomeProprio("");
  }

  return (
    <View>
      <View style={s.chips}>
        {cores.map((c) => (
          <Chip
            key={c.hex}
            label={c.name || c.hex}
            swatch={c.hex}
            active={renomeando === c.hex.toUpperCase()}
            onPress={() => abrirRenomear(c)}
            accessibilityLabel={"Nome da cor " + (c.name || c.hex)}
            onRemove={() => {
              if (renomeando === c.hex.toUpperCase()) setRenomeando(null);
              onCores(cores.filter((x) => x.hex.toUpperCase() !== c.hex.toUpperCase()));
            }}
            removeLabel={"Remover " + (c.name || c.hex)}
          />
        ))}
        <Chip label="+ Cor" dashed onPress={() => (abrir ? fecharPaleta() : setAbrir(true))} />
      </View>

      {corEmEdicao ? (
        <View style={st.painel} testID="renomear-cor">
          <View style={st.cabeca}>
            <Text style={st.titulo}>Nome desta cor</Text>
            <Pressable onPress={() => setRenomeando(null)} style={st.fechar} accessibilityLabel="Fechar sem mudar o nome">
              <Text style={st.fecharTxt}>Fechar</Text>
            </Pressable>
          </View>
          {corEmEdicao.nomeSoParaMostrar ? (
            <Text style={st.nota}>Esta cor ainda não tem nome gravado. O que você salvar aqui passa a sair no Caixa, na etiqueta, na vitrine e na nota.</Text>
          ) : null}
          <View style={st.linha}>
            <View style={[st.amostraGrande, { backgroundColor: corEmEdicao.hex }]} />
            <Entrada
              value={novoNome}
              onChangeText={setNovoNome}
              placeholder="Nome da cor"
              maxLength={60}
              style={{ flex: 1 }}
              accessibilityLabel="Novo nome da cor"
              onSubmitEditing={salvarNome}
            />
          </View>
          <View style={st.sugestoes}>
            <Text style={st.dica}>Da paleta, para esta amostra:</Text>
            {sugestoesParaAmostra(corEmEdicao.hex).map((n) => (
              <Pressable key={n} onPress={() => setNovoNome(n)} style={st.sugestao} accessibilityLabel={"Usar o nome " + n}>
                <Text style={st.sugestaoTxt}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[st.linha, { justifyContent: "flex-end" }]}>
            <Pressable onPress={salvarNome} style={st.botao} accessibilityLabel="Salvar o nome da cor">
              <Text style={st.botaoTxt}>Salvar nome</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {abrir ? (
        <View style={st.painel} testID="paleta-de-cores">
          <View style={st.busca}>
            <Icon name="search" size={14} color={Colors.ink3} />
            <Entrada
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar: caqui, off, marinho…"
              style={st.buscaInput}
              accessibilityLabel="Buscar cor pelo nome"
            />
          </View>

          {familias.map((f) => (
            <View key={f.familia} style={{ gap: 5 }}>
              <Text style={st.familia}>{f.familia}</Text>
              <View style={st.grade}>
                {f.cores.map((c) => {
                  const ja = jaTemCor(cores, c.hex);
                  return (
                    <Pressable
                      key={c.hex}
                      onPress={() => onCores(comCorDaPaleta(cores, c))}
                      disabled={ja}
                      accessibilityRole="button"
                      accessibilityState={{ selected: ja, disabled: ja }}
                      accessibilityLabel={(ja ? "Já adicionada: " : "Adicionar ") + c.nome}
                      style={[st.cor, narrow && st.corEstreita, ja && st.corJa]}
                    >
                      <View style={[st.corAmostra, { backgroundColor: c.hex }]}>
                        {ja ? <Icon name="check" size={12} color={corClara(c.hex) ? "#1f2937" : "#ffffff"} /> : null}
                      </View>
                      <Text style={st.corNome} numberOfLines={1}>{c.nome}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          {familias.length === 0 ? (
            <Text style={st.dica}>{"Nenhuma cor da paleta com \"" + busca.trim() + "\". Use o nome próprio abaixo: ele entra como você escrever."}</Text>
          ) : null}

          <View style={st.proprio}>
            <Text style={st.titulo}>Nome próprio, com amostra</Text>
            <View style={[st.linha, narrow && { flexWrap: "wrap" }]}>
              <Entrada
                value={nomeProprio}
                onChangeText={setNomeProprio}
                placeholder="Ex.: Areia, Verde oliva, Off White"
                maxLength={60}
                style={{ flex: 1, minWidth: 150 }}
                accessibilityLabel="Nome da cor"
              />
              <View style={st.amostraCaixa}>
                {IS_WEB ? (
                  // Só mexe na amostra; a cor entra no "Adicionar" (nada de
                  // adicionar no meio do arrasto do seletor do navegador).
                  <input
                    type="color"
                    value={amostra}
                    aria-label="Escolher a amostra"
                    onChange={(e: any) => { const v = String(e.target.value || "").toUpperCase(); setAmostra(v); setAmostraTxt(v); }}
                    style={{ width: 30, height: 28, border: "none", padding: 0, background: "transparent", cursor: "pointer" } as any}
                  />
                ) : (
                  <View style={[st.amostraPequena, { backgroundColor: amostra }]} />
                )}
                <Entrada
                  value={amostraTxt}
                  onChangeText={mudarAmostraTxt}
                  autoCapitalize="characters"
                  maxLength={7}
                  style={st.hexInput}
                  accessibilityLabel="Hex da amostra"
                />
              </View>
              <Pressable
                onPress={adicionarNomeProprio}
                disabled={!podeAdicionar}
                style={[st.botao, !podeAdicionar && st.botaoOff]}
                accessibilityLabel="Adicionar a cor com nome próprio"
              >
                <Text style={[st.botaoTxt, !podeAdicionar && { color: Colors.ink3 }]}>Adicionar</Text>
              </Pressable>
            </View>
            <Text style={st.dica}>
              {"A amostra é a bolinha do Caixa e da vitrine; o nome é o que você escrever." + (nomeMaisPerto(amostra) ? " Mais perto na paleta: " + nomeMaisPerto(amostra) + "." : "")}
              {jaTemCor(cores, amostra) ? " Esta amostra já está no produto." : ""}
            </Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Pressable onPress={fecharPaleta} style={st.pronto} accessibilityLabel="Fechar paleta de cores">
              <Text style={st.prontoTxt}>Pronto</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const st = {
  painel: {
    marginTop: 8, padding: 10, borderRadius: 10, gap: 10,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  cabeca: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  titulo: { fontSize: 12.5, color: Colors.ink, fontWeight: "700" as const },
  nota: { fontSize: 11.5, color: Colors.ink2, lineHeight: 16 },
  fechar: { minHeight: 32, paddingHorizontal: 10, justifyContent: "center" as const, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2 },
  fecharTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" as const },
  linha: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  amostraGrande: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  sugestoes: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 6 },
  sugestao: {
    minHeight: 32, paddingHorizontal: 10, justifyContent: "center" as const,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.violetD,
  },
  sugestaoTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "600" as const },
  busca: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, paddingLeft: 10, backgroundColor: Colors.bg2,
  },
  buscaInput: { flex: 1, borderWidth: 0, backgroundColor: "transparent", paddingLeft: 2 },
  familia: { fontSize: 10.5, color: Colors.ink3, fontWeight: "700" as const, letterSpacing: 0.4, textTransform: "uppercase" as const },
  grade: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
  cor: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 7,
    minHeight: 38, width: 118, paddingHorizontal: 7, borderRadius: 9,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2,
  },
  // 375 px: três por linha.
  corEstreita: { width: "31.5%" as any },
  corJa: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  corAmostra: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.18)",
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  corNome: { flex: 1, fontSize: 12, color: Colors.ink },
  proprio: {
    gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderStyle: "dashed" as any,
    borderColor: Colors.border2, backgroundColor: Colors.violetD,
  },
  amostraCaixa: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingLeft: 6, backgroundColor: Colors.bg3,
  },
  amostraPequena: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  hexInput: { width: 92, borderWidth: 0, backgroundColor: "transparent" },
  botao: {
    minHeight: 38, paddingHorizontal: 14, justifyContent: "center" as const,
    borderRadius: 9, backgroundColor: Colors.violet,
  },
  botaoOff: { backgroundColor: Colors.bg4 },
  botaoTxt: { fontSize: 12.5, color: "#fff", fontWeight: "700" as const },
  dica: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16 },
  pronto: {
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  prontoTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" as const },
};

export default EditorDeCor;
