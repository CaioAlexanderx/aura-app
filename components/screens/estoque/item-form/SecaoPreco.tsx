// ============================================================
// AURA. — Cadastro de item (aberto) · seção "Preço" / "Preço e duração"
//
// Preço, custo e a margem ao vivo. Serviço ganha os chips de duração
// aqui mesmo (e não tem estoque nenhum depois desta seção).
//
// 22/09/2026 — PERFIL MATCON (docs/mockups/matcon-cadastro-produto.html,
// pontos ③ e ④). O card vira "Como você vende": a unidade sai do Estoque e
// vem ANTES do preço ("Vendo por") — o preço é por m², e escolher a
// unidade depois do preço é o que fazia o lojista digitar o preço da caixa
// no campo do metro. Embaixo, "Como chega do fornecedor", sempre à vista e
// em QUALQUER unidade (un e pç também: caixa com 100 parafusos — decisão
// do Caio). Sem o perfil, a seção é a de hoje.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { maskCurrency } from "@/utils/masks";
import { MATCON_UNITS, PURCHASE_UNITS, ehMilheiro, fmtQty, parseQtyInput } from "@/utils/matconUnits";
import { UNITS } from "../types";
import { Campo, Chip, Entrada, Radio, Secao, fr, s } from "./ui";
import { PERFIL_PADRAO, nomeDaEmbalagem, type PerfilDoCadastro } from "./perfis";
import {
  calcMargem, valorDaMascara, fmtBRL, duracaoParaMinutos, minutosParaRotulo,
  statusPreco, DURATION_PRESET_MIN, DURATION_OTHER, type ItemType,
} from "./types";

// RN Web transforma em data-enter-local="1": Enter na frase "Compro por"
// não salva o produto (mesma regra do SecaoEstoque).
const ENTER_LOCAL = { enterLocal: "1" };

type Props = {
  type: ItemType;
  narrow: boolean;
  preco: string; onPreco: (v: string) => void;
  custo: string; onCusto: (v: string) => void;
  duracao: string; onDuracao: (v: string) => void;
  onSubmit: () => void;
  // 22/09/2026 (perfil de cadastro) — tudo opcional; só o perfil com
  // `vendoPorNoPreco` lê o que vem abaixo.
  perfil?: PerfilDoCadastro;
  unidade?: string; onUnidade?: (v: string) => void;
  // Unidades da config do Matcon (matcon_units), na ordem dela.
  unidadesDaLoja?: readonly string[];
  purchaseUnit?: string | null; onPurchaseUnit?: (v: string | null) => void;
  purchaseFactor?: string; onPurchaseFactor?: (v: string) => void;
};

/**
 * A linha "Vendo por": `un` + as unidades que a loja marcou na config; o
 * resto (as de hoje e as de material que a loja não marcou) em "+ outras".
 * Uma unidade gravada que não está em lista nenhuma (produto antigo) entra
 * na linha principal, pra nunca sumir da tela.
 */
export function unidadesDoVendoPor(
  unidadesDaLoja: readonly string[] | null | undefined,
  atual?: string | null
): { principais: string[]; outras: string[] } {
  const principais: string[] = ["un"];
  (unidadesDaLoja || []).forEach((u) => { if (principais.indexOf(u) < 0) principais.push(u); });
  const outras: string[] = [];
  [...UNITS, ...MATCON_UNITS].forEach((u) => {
    if (principais.indexOf(u) < 0 && outras.indexOf(u) < 0) outras.push(u);
  });
  if (atual && principais.indexOf(atual) < 0 && outras.indexOf(atual) < 0) principais.push(atual);
  return { principais, outras };
}

/** "A caixa sai a R$ 72,38 de custo e R$ 127,37 na venda." ("" sem valores). */
export function precoDaEmbalagem(purchaseUnit: string | null | undefined, custo: number, venda: number): string {
  const emb = nomeDaEmbalagem(purchaseUnit);
  const partes: string[] = [];
  if (custo > 0) partes.push(fmtBRL(custo) + " de custo");
  if (venda > 0) partes.push(fmtBRL(venda) + " na venda");
  if (!partes.length) return "";
  return (emb.artigo === "a" ? "A " : "O ") + emb.nome + " sai a " + partes.join(" e ") + ".";
}

function CaixaDeMargem({ preco, custo, isProduto, porUnidade }: { preco: number; custo: number; isProduto: boolean; porUnidade?: string }) {
  const m = calcMargem(preco, custo);
  if (m.estado === "off") {
    return (
      <View style={[st.margem, st.margemOff]}>
        <Icon name="info" size={14} color={Colors.ink3} />
        <Text style={st.margemTxtOff}>
          {m.motivo === "sem-preco"
            ? "Preencha o preço para ver a margem."
            : "Com o custo, mostramos a margem."}
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
          </Text>
        </Text>
      </View>
    );
  }
  return (
    <View style={st.margem}>
      <Icon name="check" size={14} color={Colors.green} />
      <Text style={st.margemTxt}>
        Margem <Text style={st.margemForte}>{m.pct + "%"}</Text> · lucro{" "}
        <Text style={st.margemForte}>{fmtBRL(m.lucro)}</Text> por {isProduto ? (porUnidade || "un.") : "atendimento"}
      </Text>
    </View>
  );
}

export function SecaoPreco(props: Props) {
  const perfil = props.perfil || PERFIL_PADRAO;
  if (props.type === "product" && perfil.vendoPorNoPreco) return <ComoVoceVende {...props} />;
  return <PrecoDeHoje {...props} />;
}

function PrecoDeHoje({ type, narrow, preco, onPreco, custo, onCusto, duracao, onDuracao, onSubmit }: Props) {
  const isProduto = type === "product";
  const [mostrarOutra, setMostrarOutra] = useState(false);

  // A duração vira NÚMERO (migration 323). O chip acende pelos minutos,
  // não pelo texto: quem digita "1 hora" no campo livre vê o chip "1h"
  // acender, porque é a mesma coisa. Texto que não vira número mantém
  // todos apagados e ganha uma dica — nada é gravado torto.
  const minutos = duracaoParaMinutos(duracao);
  const ehPreset = minutos != null && DURATION_PRESET_MIN.indexOf(minutos) >= 0;
  const outraAtiva = mostrarOutra || (!!duracao.trim() && !ehPreset);
  const naoEntendi = !!duracao.trim() && minutos == null;

  return (
    <Secao icon="dollar" titulo={isProduto ? "Preço" : "Preço e duração"} selo={statusPreco(valorDaMascara(preco))}>
      <View style={[s.linha2, narrow && { flexDirection: "column", gap: 0 }]}>
        <Campo label="Preço de venda" required style={{ flex: 1 }}>
          <View style={st.prefixo}>
            <Text style={st.prefixoTxt}>R$</Text>
            <Entrada
              value={preco}
              onChangeText={(v: string) => onPreco(maskCurrency(v))}
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
              onSubmitEditing={onSubmit}
              placeholder="0,00"
              keyboardType="number-pad"
              style={{ paddingLeft: 34 }}
            />
          </View>
        </Campo>
      </View>

      <CaixaDeMargem preco={valorDaMascara(preco)} custo={valorDaMascara(custo)} isProduto={isProduto} />

      {!isProduto && (
        <Campo label="Duração estimada" optional="opcional" style={{ marginTop: 10, marginBottom: 0 }}>
          <View style={s.chips}>
            {DURATION_PRESET_MIN.map((m) => (
              <Chip
                key={m}
                label={minutosParaRotulo(m)}
                active={minutos === m}
                onPress={() => {
                  setMostrarOutra(false);
                  onDuracao(minutos === m ? "" : minutosParaRotulo(m));
                }}
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
              value={mostrarOutra || !ehPreset ? duracao : ""}
              onChangeText={onDuracao}
              onSubmitEditing={onSubmit}
              placeholder="Ex.: 20 min, 3h, 1h30"
              style={{ marginTop: 8 }}
            />
          )}
          <Text style={s.hint}>
            {naoEntendi ? (
              <Text style={{ color: Colors.amber, fontWeight: "700" }}>
                {"Não vira minutos, então fica fora da agenda. Vai para a descrição do serviço como \"Duração: " + duracao.trim() + "\"."}
              </Text>
            ) : (
              "Ajuda na agenda e aparece na página do serviço. Serviços não têm estoque."
            )}
          </Text>
        </Campo>
      )}
    </Secao>
  );
}

// ── perfil Matcon: "Como você vende" ─────────────────────────
function ComoVoceVende(p: Props) {
  const unidade = p.unidade || "un";
  const [mostrarOutras, setMostrarOutras] = useState(false);
  const [abrirEmbalagem, setAbrirEmbalagem] = useState(false);
  const { principais, outras } = unidadesDoVendoPor(p.unidadesDaLoja, unidade);
  // Unidade escolhida em "outras" mantém a fileira aberta.
  const outrasAbertas = mostrarOutras || outras.indexOf(unidade) >= 0;

  // "Em caixa, saco ou fardo" = há unidade de compra ou número na frase.
  // "Do mesmo jeito que vendo" limpa os dois (e o Salvar grava null).
  const fatorTxt = p.purchaseFactor || "";
  const emEmbalagem = !!p.purchaseUnit || !!fatorTxt.trim();
  const unidadeCompra = p.purchaseUnit || "cx";
  const fator = fatorTxt.trim() ? parseQtyInput(fatorTxt) : null;
  const precoNum = valorDaMascara(p.preco);
  const custoNum = valorDaMascara(p.custo);

  function chipDeUnidade(u: string) {
    return <Chip key={u} label={u} active={unidade === u} onPress={() => p.onUnidade?.(u)} />;
  }

  function campoDeValor(label: string, valor: string, onValor: (v: string) => void, obrigatorio: boolean) {
    return (
      <Campo label={label} required={obrigatorio} optional={obrigatorio ? undefined : "opcional"} style={{ flex: 1 }}>
        <View style={st.prefixo}>
          <Text style={st.prefixoTxt}>R$</Text>
          <Entrada
            value={valor}
            onChangeText={(v: string) => onValor(maskCurrency(v))}
            onSubmitEditing={p.onSubmit}
            placeholder="0,00"
            keyboardType="number-pad"
            style={{ paddingLeft: 34, paddingRight: 64 }}
          />
          <Text style={st.sufixoTxt} numberOfLines={1}>{"por " + unidade}</Text>
        </View>
      </Campo>
    );
  }

  const precoDaCaixa = fator ? precoDaEmbalagem(unidadeCompra, custoNum * fator, precoNum * fator) : "";

  return (
    <Secao icon="dollar" titulo="Como você vende" selo={statusPreco(precoNum)}>
      <Campo label="Vendo por">
        <View style={s.chips}>
          {principais.map(chipDeUnidade)}
          {outras.length > 0 ? (
            <Chip label="+ outras" dashed onPress={() => setMostrarOutras(!outrasAbertas)} />
          ) : null}
        </View>
        {outrasAbertas && outras.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <Text style={[s.hint, { marginTop: 0, marginBottom: 5 }]}>outras</Text>
            <View style={s.chips}>{outras.map(chipDeUnidade)}</View>
          </View>
        ) : null}
        {ehMilheiro(unidade) ? (
          <Text style={s.hint} testID="ficha-milheiro-dica">
            1 milheiro = 1.000 unidades. No Caixa o vendedor digita a quantidade de peças.
          </Text>
        ) : null}
        <Text style={s.hint}>
          A linha de cima são as unidades que sua loja usa (Matcon › Configurações). m² e m³ vendem com vírgula no Caixa; saco e barra, inteiros.
        </Text>
      </Campo>

      <View style={[s.linha2, p.narrow && { flexDirection: "column", gap: 0 }]}>
        {campoDeValor("Preço de venda", p.preco, p.onPreco, true)}
        {campoDeValor("Custo", p.custo, p.onCusto, false)}
      </View>

      <CaixaDeMargem preco={precoNum} custo={custoNum} isProduto porUnidade={unidade} />

      <Campo label="Como chega do fornecedor" style={{ marginTop: 14, marginBottom: 0 }}>
        <View style={[fr.radios, p.narrow && { flexDirection: "column" }]}>
          <Radio
            ativo={!emEmbalagem}
            titulo="Do mesmo jeito que vendo"
            descricao={"compro e vendo em " + unidade}
            onPress={() => { p.onPurchaseUnit?.(null); p.onPurchaseFactor?.(""); setAbrirEmbalagem(false); }}
          />
          <Radio
            ativo={emEmbalagem}
            titulo="Em caixa, saco ou fardo"
            descricao="a nota vem numa unidade, o balcão vende em outra"
            onPress={() => { if (!emEmbalagem) p.onPurchaseUnit?.("cx"); }}
          />
        </View>

        {emEmbalagem ? (
          <View style={{ marginTop: 8 }}>
            <View style={fr.frase}>
              <Text style={fr.fraseTxt}>Compro por</Text>
              <Pressable
                onPress={() => setAbrirEmbalagem(!abrirEmbalagem)}
                style={fr.fraseChip}
                accessibilityLabel="Escolher unidade de compra"
              >
                <Text style={fr.fraseChipTxt}>{unidadeCompra + " ▾"}</Text>
              </Pressable>
              <Text style={fr.fraseTxt}>de</Text>
              <Entrada
                value={fatorTxt}
                onChangeText={(v: string) => p.onPurchaseFactor?.(v.replace(/[^0-9.,]/g, ""))}
                placeholder="0"
                keyboardType="decimal-pad"
                accessibilityLabel={"Quanto vem em 1 " + unidadeCompra + ", em " + unidade}
                dataSet={ENTER_LOCAL}
                style={fr.fraseInput}
              />
              <Text style={fr.fraseTxt}>{unidade + "."}</Text>
            </View>
            {abrirEmbalagem ? (
              <View style={[s.chips, { marginTop: 8 }]}>
                {PURCHASE_UNITS.map((u) => (
                  <Chip
                    key={u}
                    label={u}
                    active={unidadeCompra === u}
                    onPress={() => { p.onPurchaseUnit?.(u); setAbrirEmbalagem(false); }}
                  />
                ))}
              </View>
            ) : null}
            <Text style={s.hint}>
              {fator
                ? (precoDaCaixa ? precoDaCaixa + " " : "") +
                  "Com essa frase, a nota do fornecedor entra convertida (10 " + unidadeCompra + " → " +
                  fmtQty(Math.round(10 * fator * 1000) / 1000, unidade) + ")."
                : "Quanto vem em cada " + nomeDaEmbalagem(unidadeCompra).nome +
                  "? Com esse número, a nota do fornecedor entra convertida e o estoque mostra as embalagens."}
            </Text>
          </View>
        ) : (
          <Text style={s.hint}>Nada a converter: a nota do fornecedor entra como está.</Text>
        )}
      </Campo>
    </Secao>
  );
}

const st = {
  prefixo: { position: "relative" as any, justifyContent: "center" as const },
  prefixoTxt: {
    position: "absolute" as any, left: 12, zIndex: 2,
    fontSize: 12.5, color: Colors.ink3, fontWeight: "700" as const,
  },
  sufixoTxt: {
    position: "absolute" as any, right: 10, zIndex: 2, maxWidth: 60,
    fontSize: 11, color: Colors.ink3,
  },
  margem: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10,
    backgroundColor: Colors.greenD, borderWidth: 1, borderColor: "rgba(52,211,153,0.3)",
    borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, marginTop: -2,
  },
  margemOff: { backgroundColor: Colors.bg3, borderColor: Colors.border },
  margemNeg: { backgroundColor: Colors.redD, borderColor: "rgba(248,113,113,0.35)" },
  margemTxt: { fontSize: 12, color: Colors.ink2, flex: 1, lineHeight: 17 },
  margemTxtOff: { fontSize: 12, color: Colors.ink3, flex: 1, lineHeight: 17 },
  margemForte: { color: Colors.green, fontWeight: "700" as const },
};

export default SecaoPreco;
