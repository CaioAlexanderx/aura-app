// ============================================================
// AURA. — Cadastro de item (aberto) · seção "Estoque"
//
// Unidade, a pergunta "quantidade única ou por cor e tamanho" e, quando
// é por cor e tamanho, os chips das cores/tamanhos MAIS a grade — tudo
// na mesma seção, à vista, sem "isso fica no próximo passo".
//
// A GRADE É ESTADO LOCAL, NOS DOIS MODOS. Digitar 12 numa célula não
// dispara requisição nenhuma: a matriz inteira vai no PUT /variations do
// Salvar (ver ItemFormModal). Foi isto que tirou do caminho o auto-save
// campo a campo que o wizard tinha — e é o que faz o mesmo componente
// servir ao cadastro (onde o produto ainda nem existe) e à edição.
//
// ENTER LOCAL. O painel salva o produto quando se aperta Enter dentro do
// modal, exceto em alvos com `data-enter-local`. Todo input daqui cujo
// Enter quer dizer outra coisa (adicionar tamanho, o Enter que o leitor
// de código de barras manda depois do bipe, andar na grade) leva essa
// marca — senão um bipe salvava o produto no meio do cadastro.
// ============================================================
import { useCallback, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { hexToName } from "@/utils/colorNames";
import { matrixKey } from "@/services/productsVariationsApi";
import { UNITS } from "../types";
import { Campo, Chip, Entrada, Nota, Secao, IS_WEB, s } from "./ui";
import { statusEstoque, type CorDoItem, type StockMode } from "./types";
// 22/09/2026 (Matcon M0, docs/matcon-faseamento-po-ux.md secao 2 e 4b):
// grupo "Materiais" + frase "Compro por" + estoque decimal — tudo atras
// de `matconEnabled`. Sem ele, nenhuma destas importacoes muda o render:
// UNITS continua a unica fonte dos 9 chips de hoje.
import { MATCON_UNITS, PURCHASE_UNITS, estoqueEmDecimal, ehMilheiro, parseQtyInput, toPackages, rotuloEmbalagem } from "@/utils/matconUnits";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ffffff", "#1f2937", "#6b7280", "#92400e",
];

// RN Web transforma em data-enter-local="1" (ver cabeçalho).
const ENTER_LOCAL = { enterLocal: "1" };

type Props = {
  narrow: boolean;
  modoEdicao: boolean;
  unidade: string; onUnidade: (v: string) => void;
  stockMode: StockMode; onStockMode: (v: StockMode) => void;
  estoque: string; onEstoque: (v: string) => void;
  minimo: string; onMinimo: (v: string) => void;
  cores: CorDoItem[]; onCores: (v: CorDoItem[]) => void;
  tamanhos: string[]; onTamanhos: (v: string[]) => void;
  celulas: Record<string, string>; onCelula: (chave: string, v: string) => void;
  barras: Record<string, string>; onBarra: (chave: string, v: string) => void;
  onSubmit: () => void;
  // Texto do modal quando havia cor/tamanho gravado no próprio produto
  // (sem variação). Só aparece no modo "Por cor e tamanho".
  avisoDoPai?: string | null;
  // 22/09/2026 (Matcon M0): tudo opcional, default = comportamento de
  // hoje. Com `matconEnabled` false/undefined nada abaixo é lido —
  // contrato de zero impacto (regra do doc §1).
  matconEnabled?: boolean;
  // Unidades habilitadas na config (`matcon_units`, ordem da config). As
  // demais de MATCON_UNITS ficam atrás do chip "+ …".
  matconUnits?: readonly string[];
  purchaseUnit?: string | null; onPurchaseUnit?: (v: string | null) => void;
  purchaseFactor?: string; onPurchaseFactor?: (v: string) => void;
};

function Radio({ ativo, titulo, onPress }: { ativo: boolean; titulo: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[st.rd, ativo && st.rdAtivo]} accessibilityLabel={titulo}>
      <View style={[st.rad, ativo && st.radAtivo]}>{ativo ? <View style={st.radDot} /> : null}</View>
      <Text style={[st.rdTxt, ativo && { fontWeight: "700" }]}>{titulo}</Text>
    </Pressable>
  );
}

// Check escuro em cor clara (branco, amarelo), claro no resto.
function corClara(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

export function SecaoEstoque(p: Props) {
  const [abrirCor, setAbrirCor] = useState(false);
  const [corLivre, setCorLivre] = useState<string | null>(null);
  const [abrirTam, setAbrirTam] = useState(false);
  const [novoTam, setNovoTam] = useState("");
  const [abrirBarras, setAbrirBarras] = useState(false);
  // 22/09/2026 (Matcon M0): "+ rolo, lata, balde" revela o resto de
  // MATCON_UNITS que a config não habilitou (mesmo padrão do "+ Cor").
  const [maisMateriais, setMaisMateriais] = useState(false);
  // "Compro por [x ▾] de …": a lista de unidades de compra abre/fecha
  // como a paleta de cor, não é um <select> nativo (RN Web não tem um).
  const [abrirUnidadeCompra, setAbrirUnidadeCompra] = useState(false);

  function temCor(hex: string) {
    const h = hex.toUpperCase();
    return p.cores.some((c) => c.hex.toUpperCase() === h);
  }
  // Não fecha a paleta: quem cadastra grade adiciona várias cores seguidas.
  // Quem fecha é o "Pronto". Dedupe por hex, então confirmar duas vezes
  // (evento change + botão) não duplica.
  function addCor(hex: string) {
    const h = (hex || "").toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(h)) return;
    if (temCor(h)) return;
    p.onCores([...p.cores, { hex: h, name: hexToName(h) || h }]);
  }
  function fecharPaleta() {
    setAbrirCor(false);
    setCorLivre(null);
  }
  function addTam() {
    const t = novoTam.trim();
    if (!t || p.tamanhos.indexOf(t) >= 0) { setNovoTam(""); return; }
    p.onTamanhos([...p.tamanhos, t]);
    setNovoTam("");
    setAbrirTam(false);
  }

  // SELETOR NATIVO DE COR. O onChange do React num <input type="color">
  // dispara a cada evento `input` — ou seja, a cada passo do arrasto. Antes
  // ele adicionava a primeira cor intermediária e fechava a paleta,
  // desmontando o input com o seletor do navegador ainda aberto (bug de
  // lojista: "não consigo arrastar"). Agora o arrasto só mexe na prévia; a
  // cor entra no `change` nativo, que só vem quando o seletor confirma.
  // O listener é ligado pelo ref (o React não expõe esse `change`) e
  // desligado quando o input desmonta (o React chama o ref com null).
  const addCorRef = useRef(addCor);
  addCorRef.current = addCor;
  const inputCorRef = useRef<HTMLInputElement | null>(null);
  const aoConfirmarCor = useRef((e: Event) => {
    const v = String((e.target as HTMLInputElement).value || "").toUpperCase();
    setCorLivre(v);
    addCorRef.current(v);
  }).current;
  const refInputCor = useCallback((el: HTMLInputElement | null) => {
    if (inputCorRef.current) inputCorRef.current.removeEventListener("change", aoConfirmarCor);
    inputCorRef.current = el;
    if (el) el.addEventListener("change", aoConfirmarCor);
  }, [aoConfirmarCor]);

  const C = p.cores;
  const Z = p.tamanhos;
  const matriz = C.length > 0 && Z.length > 0;
  const umEixo = !matriz && (C.length > 0 || Z.length > 0);

  // Uma linha por combinação cor × tamanho, na ordem da grade.
  const combos = matriz
    ? C.flatMap((c) => Z.map((z) => ({ k: matrixKey(c.hex, z), hex: c.hex, nome: (c.name || c.hex) + " · " + z })))
    : [];
  const barrasPreenchidas = combos.filter((r) => (p.barras[r.k] ?? "").trim() !== "").length;

  // Bipou, o leitor manda Enter: pula pro próximo código, pra bipar a
  // grade inteira sem tocar na tela. Só web — o Entrada não repassa ref
  // (React 18), então o foco vai pelo id que o nativeID vira no DOM.
  function focarBarra(i: number) {
    if (!IS_WEB || typeof document === "undefined") return;
    const el = document.getElementById("estoque-barra-" + i) as HTMLElement | null;
    if (el) el.focus();
  }

  // 22/09/2026 (Matcon M0). `matconOn` false/undefined -> nada abaixo é
  // lido, os 9 chips de UNITS continuam a única coisa que renderiza.
  const matconOn = !!p.matconEnabled;
  const materiaisHabilitados = p.matconUnits || [];
  const materiaisExtras = MATCON_UNITS.filter((u) => materiaisHabilitados.indexOf(u) < 0);
  // A frase "Compro por" só faz sentido pra unidade que É de material
  // (m², sc, br…) — um produto em "un" não precisa de conversão.
  const ehUnidadeMaterial = MATCON_UNITS.indexOf(p.unidade as any) >= 0;
  const mostrarCompraPor = matconOn && ehUnidadeMaterial;
  // Milheiro também vai em decimal aqui: vender 500 tijolos deixa 19,5 mlh
  // no estoque, e a ficha precisa ler e salvar o "19,5" (QA 22/09/2026).
  const fracionado = matconOn && estoqueEmDecimal(p.unidade);
  const milheiro = matconOn && ehMilheiro(p.unidade);
  const fatorNum = p.purchaseFactor ? parseQtyInput(p.purchaseFactor) : null;
  const estoqueNum = parseQtyInput(p.estoque || "") || 0;
  const pacotes = fatorNum ? toPackages(estoqueNum, fatorNum) : null;

  return (
    <Secao icon="box" titulo="Estoque" selo={statusEstoque(p.stockMode, C, Z, p.estoque)}>
      <Campo label="Unidade de venda">
        <View style={s.chips}>
          {UNITS.map((u) => (
            <Chip key={u} label={u} active={p.unidade === u} onPress={() => p.onUnidade(u)} />
          ))}
        </View>
      </Campo>

      {matconOn ? (
        <Campo label="Materiais">
          <View style={s.chips}>
            {materiaisHabilitados.map((u) => (
              <Chip key={u} label={u} active={p.unidade === u} onPress={() => p.onUnidade(u)} />
            ))}
            {materiaisExtras.length > 0 ? (
              <Chip
                label={"+ " + materiaisExtras.join(", ")}
                dashed
                onPress={() => setMaisMateriais(!maisMateriais)}
              />
            ) : null}
          </View>
          {maisMateriais && materiaisExtras.length > 0 ? (
            <View style={[s.chips, { marginTop: 6 }]}>
              {materiaisExtras.map((u) => (
                <Chip key={u} label={u} active={p.unidade === u} onPress={() => p.onUnidade(u)} />
              ))}
            </View>
          ) : null}
          {milheiro ? (
            <Text style={s.hint} testID="ficha-milheiro-dica">
              1 milheiro = 1.000 unidades. No Caixa o vendedor digita a quantidade de peças.
            </Text>
          ) : null}
        </Campo>
      ) : null}

      {mostrarCompraPor ? (
        <Campo label="Compra">
          <View style={st.frase}>
            <Text style={st.fraseTxt}>Compro por</Text>
            <Pressable
              onPress={() => setAbrirUnidadeCompra(!abrirUnidadeCompra)}
              style={st.fraseChip}
              accessibilityLabel="Escolher unidade de compra"
            >
              <Text style={st.fraseChipTxt}>{(p.purchaseUnit || "cx") + " ▾"}</Text>
            </Pressable>
            <Text style={st.fraseTxt}>de</Text>
            <Entrada
              value={p.purchaseFactor ?? ""}
              onChangeText={(v: string) => p.onPurchaseFactor?.(v.replace(/[^0-9.,]/g, ""))}
              placeholder="0"
              keyboardType="decimal-pad"
              accessibilityLabel="Quantas unidades de venda cabem em 1 unidade de compra"
              dataSet={ENTER_LOCAL}
              style={st.fraseInput}
            />
            <Text style={st.fraseTxt}>{p.unidade + "."}</Text>
          </View>
          {abrirUnidadeCompra ? (
            <View style={[s.chips, { marginTop: 8 }]}>
              {PURCHASE_UNITS.map((u) => (
                <Chip
                  key={u}
                  label={u}
                  active={(p.purchaseUnit || "cx") === u}
                  onPress={() => { p.onPurchaseUnit?.(u); setAbrirUnidadeCompra(false); }}
                />
              ))}
            </View>
          ) : null}
          <Text style={s.hint}>
            {"A nota do fornecedor vem em " + (p.purchaseUnit || "caixa") + "; o balcão vende em " + p.unidade + ". Deixe em branco se você compra na mesma unidade que vende."}
          </Text>
        </Campo>
      ) : null}

      <Campo label="Como você controla o estoque?">
        <View style={[st.radios, p.narrow && { flexDirection: "column" }]}>
          <Radio ativo={p.stockMode === "single"} titulo="Quantidade única" onPress={() => p.onStockMode("single")} />
          <Radio ativo={p.stockMode === "variants"} titulo="Por cor e tamanho" onPress={() => p.onStockMode("variants")} />
        </View>
      </Campo>

      {p.stockMode === "single" ? (
        fracionado ? (
          // 22/09/2026 (Matcon M0): unidade fracionada (m², kg…) com o
          // toggle ligado — estoque e mínimo em decimal, na frase do
          // mockup aprovado, em vez das duas caixas separadas de hoje.
          <View style={{ marginBottom: 12 }}>
            <View style={st.frase}>
              <Text style={st.fraseTxt}>Tenho</Text>
              <Entrada
                value={p.estoque}
                onChangeText={(v: string) => p.onEstoque(v.replace(/[^0-9.,]/g, ""))}
                onSubmitEditing={p.onSubmit}
                placeholder="0"
                keyboardType="decimal-pad"
                style={st.fraseInput}
              />
              <Text style={st.fraseTxt}>{p.unidade + " em estoque"}</Text>
              {pacotes ? (
                <Text style={st.fraseMono}>{"(= " + rotuloEmbalagem(pacotes.packages, p.purchaseUnit) + ")"}</Text>
              ) : null}
              <Text style={st.fraseTxt}>, e me avise abaixo de</Text>
              <Entrada
                value={p.minimo}
                onChangeText={(v: string) => p.onMinimo(v.replace(/[^0-9.,]/g, ""))}
                onSubmitEditing={p.onSubmit}
                placeholder="0"
                keyboardType="decimal-pad"
                style={st.fraseInput}
              />
              <Text style={st.fraseTxt}>{p.unidade + "."}</Text>
            </View>
            <Text style={s.hint}>Estoque mínimo. Aparece na aba Alertas.</Text>
          </View>
        ) : (
        <View style={[s.linha2, p.narrow && { flexDirection: "column", gap: 0 }]}>
          <Campo label="Quantidade atual" style={{ flex: 1, marginBottom: 0 }}>
            <Entrada
              value={p.estoque}
              onChangeText={(v: string) => p.onEstoque(v.replace(/\D/g, ""))}
              onSubmitEditing={p.onSubmit}
              placeholder="0"
              keyboardType="number-pad"
            />
          </Campo>
          <Campo label="Avisar quando chegar em" style={{ flex: 1, marginBottom: 0 }}>
            <Entrada
              value={p.minimo}
              onChangeText={(v: string) => p.onMinimo(v.replace(/\D/g, ""))}
              onSubmitEditing={p.onSubmit}
              placeholder="0"
              keyboardType="number-pad"
            />
            <Text style={s.hint}>Estoque mínimo. Aparece na aba Alertas.</Text>
          </Campo>
        </View>
        )
      ) : (
        <View>
          {p.avisoDoPai ? (
            <View style={{ marginBottom: 12 }}>
              <Nota>
                <Text style={s.notaTxt}>{p.avisoDoPai}</Text>
              </Nota>
            </View>
          ) : null}

          <View style={[s.linha2, p.narrow && { flexDirection: "column", gap: 0 }]}>
            <Campo label="Cores" style={{ flex: 1 }}>
              <View style={s.chips}>
                {C.map((c) => (
                  <Chip
                    key={c.hex}
                    label={c.name || c.hex}
                    swatch={c.hex}
                    onRemove={() => p.onCores(C.filter((x) => x.hex.toUpperCase() !== c.hex.toUpperCase()))}
                    removeLabel={"Remover " + (c.name || c.hex)}
                  />
                ))}
                <Chip label="+ Cor" dashed onPress={() => (abrirCor ? fecharPaleta() : setAbrirCor(true))} />
              </View>
              {abrirCor && (
                <View style={st.paleta}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {PRESET_COLORS.map((c) => {
                      // Já na lista: fica marcada e não entra de novo.
                      const ja = temCor(c);
                      return (
                        <Pressable
                          key={c}
                          onPress={() => addCor(c)}
                          disabled={ja}
                          accessibilityLabel={(ja ? "Já adicionada: " : "Adicionar ") + (hexToName(c) || c)}
                          accessibilityState={{ selected: ja, disabled: ja }}
                          style={[st.paletaSwatch, { backgroundColor: c }, ja && st.paletaSwatchSel]}
                        >
                          {ja ? <Icon name="check" size={14} color={corClara(c) ? "#1f2937" : "#ffffff"} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                  {IS_WEB && (
                    <View style={st.corLivre}>
                      <Text style={st.corLivreTxt}>Outra cor…</Text>
                      {/* input nativo do navegador: não bloqueia a thread como um modal.
                          O onChange aqui é o `input` do arrasto: só atualiza a prévia. */}
                      <input
                        ref={refInputCor}
                        type="color"
                        defaultValue="#6D28D9"
                        data-enter-local="1"
                        onChange={(e: any) => setCorLivre(String(e.target.value || "").toUpperCase())}
                        style={{
                          position: "absolute", inset: 0, opacity: 0,
                          width: "100%", height: "100%", border: "none", cursor: "pointer",
                        } as any}
                      />
                    </View>
                  )}
                  {/* Prévia com botão explícito: garante a cor mesmo onde o
                      `change` do navegador não chega. */}
                  {IS_WEB && corLivre ? (
                    <View style={st.previa}>
                      <View style={[st.previaSw, { backgroundColor: corLivre }]} />
                      <Text style={st.previaTxt} numberOfLines={1}>
                        {(hexToName(corLivre) || corLivre) + " · " + corLivre}
                      </Text>
                      <Pressable
                        onPress={() => addCor(corLivre)}
                        disabled={temCor(corLivre)}
                        accessibilityLabel={temCor(corLivre) ? "Cor já adicionada" : "Adicionar esta cor"}
                        style={[st.previaBtn, temCor(corLivre) && st.previaBtnOff]}
                      >
                        <Text style={[st.previaBtnTxt, temCor(corLivre) && { color: Colors.ink3 }]}>
                          {temCor(corLivre) ? "Já adicionada" : "Adicionar esta cor"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                    <Pressable onPress={fecharPaleta} style={st.pronto} accessibilityLabel="Fechar paleta de cores">
                      <Text style={st.prontoTxt}>Pronto</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </Campo>

            <Campo label="Tamanhos" style={{ flex: 1 }}>
              <View style={s.chips}>
                {Z.map((z) => (
                  <Chip key={z} label={z} onRemove={() => p.onTamanhos(Z.filter((x) => x !== z))} removeLabel={"Remover " + z} />
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
                    dataSet={ENTER_LOCAL}
                    autoFocus
                  />
                  <Pressable onPress={addTam} style={st.addBtn} accessibilityLabel="Adicionar tamanho">
                    <Icon name="plus" size={14} color="#fff" />
                  </Pressable>
                </View>
              )}
            </Campo>
          </View>

          {matriz && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.grade} contentContainerStyle={{ minWidth: "100%" }}>
              <View>
                <View style={[st.linha, st.linhaCab]}>
                  <Text style={[st.cab, st.colNome]}>Estoque</Text>
                  {Z.map((z) => <Text key={z} style={[st.cab, st.colCelula]}>{z}</Text>)}
                </View>
                {C.map((c) => (
                  <View key={c.hex} style={st.linha}>
                    <View style={[st.colNome, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                      <View style={[st.sw, { backgroundColor: c.hex }]} />
                      <Text style={st.nomeCel} numberOfLines={1}>{c.name || c.hex}</Text>
                    </View>
                    {Z.map((z) => {
                      const k = matrixKey(c.hex, z);
                      return (
                        <Entrada
                          key={k}
                          value={p.celulas[k] ?? ""}
                          onChangeText={(v: string) => p.onCelula(k, v.replace(/\D/g, ""))}
                          placeholder="0"
                          keyboardType="number-pad"
                          selectTextOnFocus
                          accessibilityLabel={"Estoque de " + (c.name || c.hex) + " " + z}
                          dataSet={ENTER_LOCAL}
                          style={[st.colCelula, st.celula]}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Códigos de barras por combinação. Na grade cor × tamanho não
              cabem ao lado do estoque; o editor antigo tinha esta lista e
              ela tinha sumido. Fechada por padrão (a maioria não usa), com
              a contagem no cabeçalho pra dizer o que falta sem abrir. */}
          {matriz && (
            <View style={[st.grade, { marginTop: 8 }]}>
              <Pressable
                onPress={() => setAbrirBarras(!abrirBarras)}
                style={[st.linha, st.linhaCab, !abrirBarras && { borderBottomWidth: 0 }]}
                accessibilityRole="button"
                accessibilityState={{ expanded: abrirBarras }}
                accessibilityLabel={"Códigos de barras, " + barrasPreenchidas + " de " + combos.length + " preenchidos"}
              >
                <Icon name={abrirBarras ? "chevron_down" : "chevron_right"} size={14} color={Colors.ink3} />
                <Text style={st.barrasTit} numberOfLines={1}>
                  Códigos de barras
                  <Text style={st.barrasConta}>{" · " + barrasPreenchidas + " de " + combos.length + " preenchidos"}</Text>
                </Text>
              </Pressable>
              {abrirBarras && combos.map((r, i) => (
                <View key={r.k} style={[st.linha, p.narrow && st.linhaEmPe]}>
                  <View style={[p.narrow ? null : st.colBarraNome, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                    <View style={[st.sw, { backgroundColor: r.hex }]} />
                    <Text style={st.nomeCel} numberOfLines={1}>{r.nome}</Text>
                  </View>
                  <Entrada
                    nativeID={"estoque-barra-" + i}
                    value={p.barras[r.k] ?? ""}
                    onChangeText={(v: string) => p.onBarra(r.k, v)}
                    onSubmitEditing={() => focarBarra(i + 1)}
                    blurOnSubmit={false}
                    placeholder="Bipe ou digite"
                    accessibilityLabel={"Código de barras de " + r.nome}
                    dataSet={ENTER_LOCAL}
                    style={[p.narrow ? { alignSelf: "stretch" as const } : { flex: 1 }, st.celula]}
                  />
                </View>
              ))}
            </View>
          )}

          {umEixo && (
            <View style={st.grade}>
              <View style={[st.linha, st.linhaCab]}>
                <Text style={[st.cab, { flex: 1 }]}>{C.length ? "Cor" : "Tamanho"}</Text>
                <Text style={[st.cab, { width: 72 }]}>Estoque</Text>
                {!p.narrow && <Text style={[st.cab, { flex: 1 }]}>Cód. barras</Text>}
              </View>
              {(C.length ? C.map((c) => ({ k: matrixKey(c.hex, null), nome: c.name || c.hex, hex: c.hex }))
                          : Z.map((z) => ({ k: matrixKey(null, z), nome: z, hex: null as string | null }))
              ).map((r) => (
                <View key={r.k} style={[st.linha, p.narrow && { flexWrap: "wrap" as const }]}>
                  <View style={{ flex: 1, minWidth: 90, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {r.hex ? <View style={[st.sw, { backgroundColor: r.hex }]} /> : null}
                    <Text style={st.nomeCel} numberOfLines={1}>{r.nome}</Text>
                  </View>
                  <Entrada
                    value={p.celulas[r.k] ?? ""}
                    onChangeText={(v: string) => p.onCelula(r.k, v.replace(/\D/g, ""))}
                    placeholder="0"
                    keyboardType="number-pad"
                    selectTextOnFocus
                          accessibilityLabel={"Estoque de " + r.nome}
                    dataSet={ENTER_LOCAL}
                    style={[{ width: 72 }, st.celula]}
                  />
                  {/* Celular: o código de barras não cabe ao lado — cai para a
                      linha de baixo, inteiro, em vez de sumir. */}
                  <Entrada
                    value={p.barras[r.k] ?? ""}
                    onChangeText={(v: string) => p.onBarra(r.k, v)}
                    placeholder="Cód. barras: bipe ou digite"
                    accessibilityLabel={"Código de barras de " + r.nome}
                    dataSet={ENTER_LOCAL}
                    style={[p.narrow ? { width: "100%" as any } : { flex: 1 }, st.celula]}
                  />
                </View>
              ))}
            </View>
          )}

          <Text style={s.hint}>
            {"Preço é o mesmo para todas. " +
              (p.modoEdicao ? "A grade vai junto no Salvar." : "A grade é criada junto com o produto.")}
          </Text>
        </View>
      )}
    </Secao>
  );
}

const st = {
  // 22/09/2026 (Matcon M0) — "frase com número editável no meio" do
  // mockup (docs/mockups/matcon-modulo.html): uma linha que se lê como
  // português, não um formulário. Usada em "Compro por" e no estoque
  // decimal.
  frase: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 6 },
  fraseTxt: { fontSize: 13, color: Colors.ink2 },
  fraseMono: { fontSize: 11.5, color: Colors.ink3, fontFamily: IS_WEB ? ("monospace" as const) : undefined },
  fraseChip: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.violet,
  },
  fraseChipTxt: { fontSize: 12.5, fontWeight: "700" as const, color: Colors.violet3 },
  fraseInput: {
    width: 70, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, textAlign: "center" as const,
  },
  radios: { flexDirection: "row" as const, gap: 6 },
  rd: {
    flex: 1, flexDirection: "row" as const, gap: 8, alignItems: "center" as const,
    borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9,
    backgroundColor: Colors.bg3, borderWidth: 1.5, borderColor: Colors.border,
  },
  rdAtivo: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  rdTxt: { fontSize: 12.5, color: Colors.ink, flexShrink: 1 },
  rad: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: Colors.border2,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  radAtivo: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  radDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" },
  grade: {
    marginTop: 4, borderWidth: 1, borderColor: Colors.border, borderRadius: 9,
    backgroundColor: Colors.bg3, overflow: "hidden" as const,
  },
  linha: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  // Celular: rótulo em cima, input inteiro embaixo.
  linhaEmPe: { flexDirection: "column" as const, alignItems: "stretch" as const, gap: 4, paddingVertical: 7 },
  linhaCab: { backgroundColor: Colors.bg4 },
  cab: { fontSize: 10.5, letterSpacing: 0.3, textTransform: "uppercase" as const, color: Colors.ink3, fontWeight: "700" as const },
  colNome: { width: 116 },
  colCelula: { width: 56 },
  colBarraNome: { width: 150 },
  celula: { paddingHorizontal: 8, paddingVertical: 6, fontSize: 12.5 },
  nomeCel: { fontSize: 12.5, color: Colors.ink, flexShrink: 1 },
  sw: { width: 12, height: 12, borderRadius: 4, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  barrasTit: { flex: 1, fontSize: 12.5, color: Colors.ink, fontWeight: "700" as const, paddingVertical: 4 },
  barrasConta: { color: Colors.ink3, fontWeight: "500" as const },
  paleta: {
    marginTop: 8, padding: 10, borderRadius: 10,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  paletaSwatch: {
    width: 30, height: 30, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  paletaSwatchSel: { borderWidth: 2.5, borderColor: Colors.violet },
  corLivre: {
    position: "relative" as any, alignItems: "center" as const, justifyContent: "center" as const,
    borderRadius: 8, borderWidth: 1, borderStyle: "dashed" as any, borderColor: Colors.border2,
    paddingVertical: 8,
  },
  corLivreTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" as const },
  previa: {
    flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 8,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8, paddingVertical: 6,
  },
  previaSw: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  previaTxt: { flex: 1, minWidth: 90, fontSize: 12.5, color: Colors.ink },
  previaBtn: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.violet,
  },
  previaBtnOff: { backgroundColor: Colors.bg4 },
  previaBtnTxt: { fontSize: 12, color: "#fff", fontWeight: "700" as const },
  pronto: {
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  prontoTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" as const },
  addBtn: {
    width: 40, borderRadius: 9, backgroundColor: Colors.violet,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
};

export default SecaoEstoque;
