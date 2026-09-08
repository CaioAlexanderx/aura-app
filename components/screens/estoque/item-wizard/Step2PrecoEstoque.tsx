// ============================================================
// AURA. — Cadastro de item · passo 2 "Preço e estoque" / "Preço e duração"
//
// Preço, custo e a margem ao vivo. Produto escolhe aqui COMO controla o
// estoque: quantidade única ou por cor e tamanho — e, nesse caso, as
// listas de cores e tamanhos nascem aqui mesmo (v3). O estoque de cada
// combinação, o código de barras e a foto ficam no passo 3.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { maskCurrency } from "@/utils/masks";
import { hexToName } from "@/utils/colorNames";
import { UNITS } from "../types";
import { Campo, Chip, Entrada, Nota, IS_WEB, s } from "./ui";
import {
  calcMargem, valorDaMascara, fmtBRL, DURATION_PRESETS, DURATION_OTHER,
  type ItemType, type StockMode, type WizardColor,
} from "./types";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ffffff", "#1f2937", "#6b7280", "#92400e",
];

type Props = {
  type: ItemType;
  narrow: boolean;
  preco: string; onPreco: (v: string) => void;
  custo: string; onCusto: (v: string) => void;
  unidade: string; onUnidade: (v: string) => void;
  stockMode: StockMode; onStockMode: (v: StockMode) => void;
  estoque: string; onEstoque: (v: string) => void;
  minimo: string; onMinimo: (v: string) => void;
  cores: WizardColor[]; onCores: (v: WizardColor[]) => void;
  tamanhos: string[]; onTamanhos: (v: string[]) => void;
  duracao: string; onDuracao: (v: string) => void;
  onSubmit: () => void;
  onBlur: () => void;
};

function CaixaDeMargem({ preco, custo, isProduto }: { preco: number; custo: number; isProduto: boolean }) {
  const m = calcMargem(preco, custo);
  if (m.estado === "off") {
    return (
      <View style={[st.margem, st.margemOff]}>
        <Icon name="info" size={14} color={Colors.ink3} />
        <Text style={st.margemTxtOff}>
          {m.motivo === "sem-preco"
            ? "Preencha o preço para ver a margem."
            : "Informe o custo (opcional) para ver a margem de lucro."}
        </Text>
      </View>
    );
  }
  if (m.estado === "neg") {
    return (
      <View style={[st.margem, st.margemNeg]}>
        <Icon name="alert" size={14} color={Colors.red} />
        <Text style={st.margemTxt}>
          Custo acima do preço: <Text style={{ color: Colors.red, fontWeight: "700" }}>
            {"prejuízo de " + fmtBRL(-m.lucro)}
          </Text> por unidade.
        </Text>
      </View>
    );
  }
  return (
    <View style={st.margem}>
      <Icon name="check" size={14} color={Colors.green} />
      <Text style={st.margemTxt}>
        Margem <Text style={st.margemForte}>{m.pct + "%"}</Text> · lucro de{" "}
        <Text style={st.margemForte}>{fmtBRL(m.lucro)}</Text> por {isProduto ? "unidade" : "atendimento"}
      </Text>
    </View>
  );
}

function CartaoRadio({
  ativo, titulo, texto, onPress,
}: { ativo: boolean; titulo: string; texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[st.sm, ativo && st.smAtivo]} accessibilityLabel={titulo}>
      <View style={[st.rad, ativo && st.radAtivo]}>{ativo ? <View style={st.radDot} /> : null}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.smTitulo}>{titulo}</Text>
        <Text style={st.smTexto}>{texto}</Text>
      </View>
    </Pressable>
  );
}

export function Step2PrecoEstoque({
  type, narrow, preco, onPreco, custo, onCusto, unidade, onUnidade,
  stockMode, onStockMode, estoque, onEstoque, minimo, onMinimo,
  cores, onCores, tamanhos, onTamanhos, duracao, onDuracao, onSubmit, onBlur,
}: Props) {
  const isProduto = type === "product";
  const [abrirCor, setAbrirCor] = useState(false);
  const [abrirTam, setAbrirTam] = useState(false);
  const [novoTam, setNovoTam] = useState("");
  const [mostrarOutra, setMostrarOutra] = useState(false);

  const ehPreset = DURATION_PRESETS.indexOf(duracao) >= 0;
  const outraAtiva = mostrarOutra || (!!duracao && !ehPreset);

  function addCor(hex: string) {
    const h = (hex || "").toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(h)) return;
    if (cores.some((c) => c.hex.toUpperCase() === h)) return;
    onCores([...cores, { hex: h, name: hexToName(h) || h }]);
    setAbrirCor(false);
  }
  function rmCor(hex: string) {
    onCores(cores.filter((c) => c.hex.toUpperCase() !== (hex || "").toUpperCase()));
  }
  function addTam() {
    const t = novoTam.trim();
    if (!t || tamanhos.indexOf(t) >= 0) { setNovoTam(""); return; }
    onTamanhos([...tamanhos, t]);
    setNovoTam("");
    setAbrirTam(false);
  }

  return (
    <View>
      <View style={[s.linha2, narrow && { flexDirection: "column", gap: 0 }]}>
        <Campo label="Preço de venda" required style={{ flex: 1 }}>
          <View style={st.prefixo}>
            <Text style={st.prefixoTxt}>R$</Text>
            <Entrada
              value={preco}
              onChangeText={(v: string) => onPreco(maskCurrency(v))}
              onBlur={onBlur}
              onSubmitEditing={onSubmit}
              placeholder="0,00"
              keyboardType="number-pad"
              style={{ paddingLeft: 34 }}
            />
          </View>
        </Campo>
        <Campo label="Custo" optional="opcional" style={{ flex: 1 }}>
          <View style={st.prefixo}>
            <Text style={st.prefixoTxt}>R$</Text>
            <Entrada
              value={custo}
              onChangeText={(v: string) => onCusto(maskCurrency(v))}
              onBlur={onBlur}
              onSubmitEditing={onSubmit}
              placeholder="0,00"
              keyboardType="number-pad"
              style={{ paddingLeft: 34 }}
            />
          </View>
        </Campo>
      </View>

      <CaixaDeMargem preco={valorDaMascara(preco)} custo={valorDaMascara(custo)} isProduto={isProduto} />

      {isProduto ? (
        <View>
          <Campo label="Unidade de venda">
            <View style={s.chips}>
              {UNITS.map((u) => (
                <Chip key={u} label={u} active={unidade === u} onPress={() => { onUnidade(u); onBlur(); }} />
              ))}
            </View>
          </Campo>

          <Campo label="Como você controla o estoque?">
            <View style={[st.modos, narrow && { flexDirection: "column" }]}>
              <CartaoRadio
                ativo={stockMode === "single"}
                titulo="Quantidade única"
                texto="Um número só. Serve para a maioria dos produtos."
                onPress={() => onStockMode("single")}
              />
              <CartaoRadio
                ativo={stockMode === "variants"}
                titulo="Por cor e tamanho"
                texto="Cada combinação tem seu próprio estoque e código."
                onPress={() => onStockMode("variants")}
              />
            </View>
          </Campo>

          {stockMode === "single" ? (
            <View style={[s.linha2, narrow && { flexDirection: "column", gap: 0 }]}>
              <Campo label="Quantidade atual" style={{ flex: 1 }}>
                <Entrada
                  value={estoque}
                  onChangeText={(v: string) => onEstoque(v.replace(/\D/g, ""))}
                  onBlur={onBlur}
                  onSubmitEditing={onSubmit}
                  placeholder="0"
                  keyboardType="number-pad"
                />
              </Campo>
              <Campo label="Avisar quando chegar em" style={{ flex: 1 }}>
                <Entrada
                  value={minimo}
                  onChangeText={(v: string) => onMinimo(v.replace(/\D/g, ""))}
                  onBlur={onBlur}
                  onSubmitEditing={onSubmit}
                  placeholder="0"
                  keyboardType="number-pad"
                />
                <Text style={s.hint}>Estoque mínimo. Aparece na aba Alertas.</Text>
              </Campo>
            </View>
          ) : (
            <View>
              <View style={st.vdef}>
                <Campo
                  label="Cores"
                  optional={cores.length ? cores.length + (cores.length === 1 ? " cor" : " cores") : "nenhuma"}
                  style={{ marginBottom: 10 }}
                >
                  <View style={s.chips}>
                    {cores.map((c) => (
                      <Chip
                        key={c.hex}
                        label={c.name || c.hex}
                        swatch={c.hex}
                        onRemove={() => rmCor(c.hex)}
                        removeLabel={"Remover " + (c.name || c.hex)}
                      />
                    ))}
                    <Chip label="+ Cor" dashed onPress={() => setAbrirCor(!abrirCor)} />
                  </View>
                  {abrirCor && (
                    <View style={st.paleta}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {PRESET_COLORS.map((c) => (
                          <Pressable
                            key={c}
                            onPress={() => addCor(c)}
                            accessibilityLabel={"Adicionar " + (hexToName(c) || c)}
                            style={[st.paletaSwatch, { backgroundColor: c }]}
                          />
                        ))}
                      </View>
                      {IS_WEB && (
                        <View style={st.corLivre}>
                          <Text style={st.corLivreTxt}>Outra cor…</Text>
                          {/* input nativo do navegador: não bloqueia a thread como um modal */}
                          <input
                            type="color"
                            defaultValue="#6d28d9"
                            onChange={(e: any) => addCor(e.target.value)}
                            style={{
                              position: "absolute", inset: 0, opacity: 0,
                              width: "100%", height: "100%", border: "none", cursor: "pointer",
                            } as any}
                          />
                        </View>
                      )}
                    </View>
                  )}
                </Campo>

                <Campo
                  label="Tamanhos"
                  optional={tamanhos.length ? tamanhos.length + (tamanhos.length === 1 ? " tamanho" : " tamanhos") : "nenhum"}
                  style={{ marginBottom: 0 }}
                >
                  <View style={s.chips}>
                    {tamanhos.map((z) => (
                      <Chip key={z} label={z} onRemove={() => onTamanhos(tamanhos.filter((x) => x !== z))} removeLabel={"Remover " + z} />
                    ))}
                    <Chip label="+ Tamanho" dashed onPress={() => setAbrirTam(!abrirTam)} />
                  </View>
                  {abrirTam && (
                    <View style={[s.linha2, { marginTop: 8 }]}>
                      <Entrada
                        value={novoTam}
                        onChangeText={setNovoTam}
                        onSubmitEditing={addTam}
                        placeholder="P, M, G, 38, 500ml…"
                        style={{ flex: 1 }}
                        autoFocus
                      />
                      <Pressable onPress={addTam} style={st.addBtn} accessibilityLabel="Adicionar tamanho">
                        <Icon name="plus" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  )}
                </Campo>
              </View>

              <Nota icon="layers">
                <Text style={s.hint}>
                  Estoque, código de barras e foto de cada uma ficam no{" "}
                  <Text style={{ color: Colors.ink, fontWeight: "700" }}>próximo passo</Text>.
                  {" "}O preço é o mesmo para todas.
                </Text>
              </Nota>
            </View>
          )}
        </View>
      ) : (
        <View>
          <Campo label="Duração estimada" optional="opcional">
            <View style={s.chips}>
              {DURATION_PRESETS.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  active={duracao === d}
                  onPress={() => { setMostrarOutra(false); onDuracao(duracao === d ? "" : d); onBlur(); }}
                />
              ))}
              <Chip
                label={DURATION_OTHER}
                active={outraAtiva}
                onPress={() => { setMostrarOutra(true); if (ehPreset) onDuracao(""); }}
              />
            </View>
            {outraAtiva && (
              <Entrada
                value={ehPreset ? "" : duracao}
                onChangeText={onDuracao}
                onBlur={onBlur}
                onSubmitEditing={onSubmit}
                placeholder="Ex.: 3h, 20 min, meio período"
                style={{ marginTop: 8 }}
              />
            )}
            <Text style={s.hint}>Ajuda na agenda e aparece na página do serviço.</Text>
          </Campo>
          <Nota>
            <Text style={s.hint}>
              Serviços <Text style={{ color: Colors.ink, fontWeight: "700" }}>não têm estoque</Text>.
              {" "}São vendidos direto no Caixa.
            </Text>
          </Nota>
        </View>
      )}
    </View>
  );
}

const st = {
  prefixo: { position: "relative" as any, justifyContent: "center" as const },
  prefixoTxt: {
    position: "absolute" as any, left: 12, zIndex: 2,
    fontSize: 12.5, color: Colors.ink3, fontWeight: "700" as const,
  },
  margem: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10,
    backgroundColor: Colors.greenD, borderWidth: 1, borderColor: "rgba(52,211,153,0.3)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: -4, marginBottom: 14,
  },
  margemOff: { backgroundColor: Colors.bg4, borderColor: Colors.border },
  margemNeg: { backgroundColor: Colors.redD, borderColor: "rgba(248,113,113,0.35)" },
  margemTxt: { fontSize: 12.5, color: Colors.ink2, flex: 1, lineHeight: 17 },
  margemTxtOff: { fontSize: 12.5, color: Colors.ink3, flex: 1, lineHeight: 17 },
  margemForte: { color: Colors.green, fontWeight: "700" as const },
  modos: { flexDirection: "row" as const, gap: 10 },
  sm: {
    flex: 1, flexDirection: "row" as const, gap: 10, alignItems: "flex-start" as const,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Colors.bg4, borderWidth: 1.5, borderColor: Colors.border,
  },
  smAtivo: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  smTitulo: { fontSize: 13, color: Colors.ink, fontWeight: "700" as const },
  smTexto: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16, marginTop: 2 },
  rad: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border2,
    marginTop: 2, alignItems: "center" as const, justifyContent: "center" as const,
  },
  radAtivo: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  radDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  vdef: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Colors.violetD, marginBottom: 12,
  },
  paleta: {
    marginTop: 8, padding: 10, borderRadius: 10,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  paletaSwatch: { width: 30, height: 30, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border },
  corLivre: {
    position: "relative" as any, alignItems: "center" as const, justifyContent: "center" as const,
    borderRadius: 8, borderWidth: 1, borderStyle: "dashed" as any, borderColor: Colors.border2,
    paddingVertical: 8,
  },
  corLivreTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" as const },
  addBtn: {
    width: 40, borderRadius: 9, backgroundColor: Colors.violet,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
};

export default Step2PrecoEstoque;
