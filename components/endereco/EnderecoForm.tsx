// ============================================================
// components/endereco/EnderecoForm.tsx
//
// Formulário de endereço comum (09/11/2026, "Endereço do cliente para
// entrega", parte 1 — mockup aprovado pelo Caio, seções A e B).
//
// O CEP vem primeiro: no 8º dígito (ou no "Buscar") o ViaCEP preenche
// rua, bairro, cidade e UF, e o cursor vai para o número. "Preencher à
// mão" abre os campos sem CEP. Nasceu do AddressForm da troca
// (components/screens/pdv/troca/AddressForm.tsx, que agora é um invólucro
// deste) e serve a:
//   - cadastro do cliente (Clientes › Novo/Editar) e ficha;
//   - cadastro rápido do Caixa;
//   - parte 2: a trava da venda com frete, com modo="obrigatorio".
//
// Modo "opcional" (padrão): nada é exigido. Modo "obrigatorio": número e
// cidade levam o selo "obrigatório" e, com mostrarErros, o que falta
// (CEP ou rua, número, cidade — faltandoParaEntrega) fica em vermelho.
//
// RN Web: filho de coluna usa width: "100%" (nunca flexBasis). Em menos de
// 420 px de largura a grade vira a do celular do mockup.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import {
  buscarCep as buscarCepPadrao, formatarCep, faltandoParaEntrega,
  type Endereco, type EnderecoDoCepComIbge,
} from "./endereco";

export type EnderecoFormProps = {
  value: Endereco;
  onChange: (next: Endereco) => void;
  /** "obrigatorio" = trava do frete (parte 2). Padrão: "opcional". */
  modo?: "opcional" | "obrigatorio";
  /** No modo obrigatório, pinta o que falta (depois de tentar salvar). */
  mostrarErros?: boolean;
  /** Campos extras. Padrão: complemento e referência sim, IBGE não. */
  campos?: { complemento?: boolean; referencia?: boolean; ibge?: boolean };
  /** Texto do campo de referência (a parte 2 pode trocar por "Recado"). */
  placeholderReferencia?: string;
  autoFocusCep?: boolean;
  /** Injetável para teste. Padrão: ViaCEP (endereco.ts → buscarCep). */
  buscarCep?: (cep8: string) => Promise<EnderecoDoCepComIbge | null>;
  /** Prefixo dos testIDs. Padrão "endereco". */
  testID?: string;
};

type Fase = "cep" | "buscando" | "achou" | "nao_achou" | "falhou" | "manual";

type Campo = keyof Endereco;

export function EnderecoForm({
  value, onChange, modo = "opcional", mostrarErros = false, campos,
  placeholderReferencia, autoFocusCep = false, buscarCep = buscarCepPadrao, testID = "endereco",
}: EnderecoFormProps) {
  const comComplemento = campos?.complemento !== false;
  const comReferencia = campos?.referencia !== false;
  const comIbge = campos?.ibge === true;
  const obrigatorio = modo === "obrigatorio";

  const [fase, setFase] = useState<Fase>("cep");
  const [auto, setAuto] = useState<Set<Campo>>(new Set());
  const [ibgeDoCep, setIbgeDoCep] = useState(false);
  const [estreito, setEstreito] = useState(false);

  // O ViaCEP responde depois: o valor mais novo vem do ref, senão o número
  // digitado durante a busca seria perdido.
  const valueRef = useRef(value);
  valueRef.current = value;
  const buscaAtual = useRef(0);
  const numeroRef = useRef<TextInput | null>(null);

  // Endereço que já chega preenchido (editar cliente) mostra os campos.
  const temDados = !!(value.street || value.city || value.neighborhood || value.number);
  const mostrarCampos = temDados || fase === "achou" || fase === "manual" || fase === "nao_achou";

  const falta = obrigatorio && mostrarErros ? new Set(faltandoParaEntrega(value)) : new Set<string>();

  function set(campo: Campo, v: string) {
    onChange({ ...valueRef.current, [campo]: v });
    if (auto.has(campo)) {
      const n = new Set(auto);
      n.delete(campo);
      setAuto(n);
    }
  }

  async function buscar(cep8: string) {
    if (cep8.length !== 8) return;
    const minha = ++buscaAtual.current;
    setFase("buscando");
    try {
      const e = await buscarCep(cep8);
      if (minha !== buscaAtual.current) return; // o CEP mudou no meio
      if (!e) { setFase("nao_achou"); return; }
      const atual = valueRef.current;
      onChange({
        ...atual,
        zip: cep8,
        street: e.rua || atual.street,
        neighborhood: e.bairro || atual.neighborhood,
        city: e.cidade || atual.city,
        state: (e.uf || atual.state || "").toUpperCase().slice(0, 2),
        ibge: e.ibge || atual.ibge || "",
      });
      const n = new Set<Campo>();
      if (e.rua) n.add("street");
      if (e.bairro) n.add("neighborhood");
      if (e.cidade) n.add("city");
      if (e.uf) n.add("state");
      setAuto(n);
      setIbgeDoCep(!!e.ibge);
      setFase("achou");
      // Só falta o número.
      setTimeout(() => { try { numeroRef.current?.focus(); } catch { /* sem foco */ } }, 0);
    } catch {
      if (minha !== buscaAtual.current) return;
      setFase("falhou");
    }
  }

  function aoDigitarCep(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    onChange({ ...valueRef.current, zip: d });
    if (d.length === 8) {
      buscar(d);
    } else {
      buscaAtual.current++; // uma busca em voo não vale mais
      // Mexeu no CEP depois de buscar: os campos ficam (viram "à mão") se
      // já tem algo neles; senão volta ao começo.
      if (fase !== "manual" && fase !== "cep") setFase(temDados ? "manual" : "cep");
    }
  }

  // CEP apagado de fora (ex.: o pai limpou o formulário) volta ao início.
  useEffect(() => {
    if (!value.zip && !temDados && fase !== "manual") setFase("cep");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.zip, temDados]);

  const estiloDe = (campo: Campo, chaveFalta?: string) => [
    s.input,
    auto.has(campo) && s.inputAuto,
    campo === "number" && mostrarCampos && !value.number && s.inputNeed,
    chaveFalta && falta.has(chaveFalta) && s.inputErro,
  ];

  // Função que devolve JSX (não componente): um componente definido aqui
  // dentro remontaria o TextInput a cada tecla e o foco iria embora.
  function input(p: {
    campo: Campo; placeholder: string; chaveFalta?: string; inputRef?: any;
    maxLength?: number; transform?: (t: string) => string; style?: any; autoCapitalize?: any;
    keyboardType?: any;
  }) {
    return (
      <TextInput
        ref={p.inputRef}
        testID={`${testID}-${p.campo}`}
        accessibilityLabel={p.placeholder}
        style={[...estiloDe(p.campo, p.chaveFalta), p.style] as any}
        value={String(value[p.campo] || "")}
        onChangeText={(v) => set(p.campo, p.transform ? p.transform(v) : v)}
        placeholder={p.placeholder}
        placeholderTextColor={Colors.ink3}
        maxLength={p.maxLength}
        autoCapitalize={p.autoCapitalize}
        keyboardType={p.keyboardType}
      />
    );
  }

  const rua = input({ campo: "street", placeholder: "Rua", chaveFalta: "CEP ou rua", maxLength: 200 });
  const numero = input({
    campo: "number", placeholder: obrigatorio ? "Número (obrigatório)" : "Número",
    chaveFalta: "número", inputRef: numeroRef, maxLength: 20,
  });
  const complemento = comComplemento
    ? input({ campo: "complement", placeholder: estreito ? "Compl." : "Complemento (apto, bloco)", maxLength: 120 })
    : null;
  const bairro = input({ campo: "neighborhood", placeholder: "Bairro", maxLength: 120 });
  const cidade = input({
    campo: "city", placeholder: obrigatorio ? "Cidade (obrigatório)" : "Cidade", chaveFalta: "cidade", maxLength: 120,
  });
  const uf = input({
    campo: "state", placeholder: "UF", maxLength: 2, autoCapitalize: "characters",
    transform: (v) => v.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2),
  });

  return (
    <View
      style={s.box}
      testID={testID}
      onLayout={(e) => {
        const w = e?.nativeEvent?.layout?.width;
        if (typeof w === "number" && w > 0) setEstreito(w < 420);
      }}
    >
      {/* CEP primeiro */}
      <View style={s.cepRow}>
        <TextInput
          testID={`${testID}-cep`}
          accessibilityLabel="CEP"
          style={[
            s.input, s.cepInput,
            fase === "achou" && s.inputOk,
            (fase === "nao_achou" || fase === "falhou") && s.inputErro,
            falta.has("CEP ou rua") && s.inputErro,
          ] as any}
          value={formatarCep(value.zip || "")}
          onChangeText={aoDigitarCep}
          placeholder="00000-000"
          placeholderTextColor={Colors.ink3}
          keyboardType="number-pad"
          maxLength={9}
          autoFocus={autoFocusCep}
        />
        <Pressable
          testID={`${testID}-buscar`}
          accessibilityRole="button"
          accessibilityLabel="Buscar endereço pelo CEP"
          onPress={() => buscar(String(value.zip || "").replace(/\D/g, ""))}
          disabled={String(value.zip || "").replace(/\D/g, "").length !== 8 || fase === "buscando"}
          style={[s.buscarBtn, String(value.zip || "").replace(/\D/g, "").length !== 8 && { opacity: 0.5 }]}
        >
          {fase === "buscando"
            ? <ActivityIndicator size="small" color={Colors.violet} />
            : <Text style={s.buscarTxt}>Buscar</Text>}
        </Pressable>
      </View>

      {fase === "buscando" && <Text style={s.info} testID={`${testID}-status`}>Buscando o endereço…</Text>}
      {fase === "achou" && (
        <Text style={s.ok} testID={`${testID}-status`}>✓ Encontramos o endereço. Confira e coloque o número.</Text>
      )}
      {fase === "nao_achou" && (
        <Text style={s.erro} testID={`${testID}-status`}>Não achamos esse CEP. Confira os números ou preencha à mão.</Text>
      )}
      {fase === "falhou" && (
        <View style={s.statusRow}>
          <Text style={s.erro} testID={`${testID}-status`}>Não deu para buscar o CEP agora.</Text>
          <Pressable onPress={() => buscar(String(value.zip || "").replace(/\D/g, ""))} testID={`${testID}-tentar`} accessibilityRole="button">
            <Text style={s.link}>Tentar de novo</Text>
          </Pressable>
        </View>
      )}

      {mostrarCampos && (
        <View style={s.campos} testID={`${testID}-campos`}>
          {estreito ? (
            <>
              <View style={s.linha}>{rua}</View>
              <View style={[s.row, s.gap]}>
                <View style={s.col1}>{numero}</View>
                {complemento && <View style={s.col1}>{complemento}</View>}
              </View>
              <View style={[s.linha, s.gap]}>{bairro}</View>
              <View style={[s.row, s.gap]}>
                <View style={s.col1}>{cidade}</View>
                <View style={s.ufCurta}>{uf}</View>
              </View>
            </>
          ) : (
            <>
              <View style={s.row}>
                <View style={s.col2}>{rua}</View>
                <View style={s.col1}>{numero}</View>
              </View>
              <View style={[s.row, s.gap]}>
                {complemento && <View style={s.col1}>{complemento}</View>}
                <View style={s.col1}>{bairro}</View>
              </View>
              <View style={[s.row, s.gap]}>
                <View style={s.col2}>{cidade}</View>
                <View style={s.col1}>{uf}</View>
              </View>
            </>
          )}
          {comReferencia && (
            <View style={[s.linha, s.gap]}>
              {input({
                campo: "reference", maxLength: 300,
                placeholder: placeholderReferencia
                  || (estreito ? "Ponto de referência" : "Ponto de referência (ex.: portão azul, ao lado da padaria)"),
              })}
            </View>
          )}
          {comIbge && !ibgeDoCep && (
            <View style={[s.linha, s.gap]}>
              {input({
                campo: "ibge", placeholder: "Código IBGE da cidade", maxLength: 7, keyboardType: "number-pad",
                transform: (v) => v.replace(/\D/g, "").slice(0, 7),
              })}
            </View>
          )}
        </View>
      )}

      {obrigatorio && mostrarErros && falta.size > 0 && (
        <Text style={[s.erro, { marginTop: 8 }]} testID={`${testID}-falta`}>
          Falta: {Array.from(falta).join(", ")}.
        </Text>
      )}

      {!mostrarCampos && fase !== "buscando" && (
        <View style={s.statusRow}>
          <Text style={s.small}>Não sabe o CEP?</Text>
          <Pressable
            onPress={() => setFase("manual")}
            testID={`${testID}-manual`}
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Text style={s.link}>Preencher à mão</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { width: "100%" },
  cepRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  cepInput: { flex: 1, minWidth: 0, fontWeight: "700", letterSpacing: 0.5 },
  buscarBtn: {
    width: 90, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2,
    backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center",
  },
  buscarTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  input: {
    width: "100%", minHeight: 44, backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink,
  },
  inputAuto: { backgroundColor: Colors.greenD, borderColor: Colors.green + "59" },
  inputNeed: { borderColor: Colors.violet, borderWidth: 1.5 },
  inputOk: { borderColor: Colors.green + "80" },
  inputErro: { borderColor: Colors.red, borderWidth: 1.5 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 6 },
  ok: { fontSize: 12, color: Colors.green, fontWeight: "600", marginTop: 6 },
  info: { fontSize: 12, color: Colors.violet3, fontWeight: "500", marginTop: 6 },
  erro: { fontSize: 12, color: Colors.red, fontWeight: "600", marginTop: 6 },
  small: { fontSize: 12, color: Colors.ink3 },
  link: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  campos: { width: "100%", marginTop: 10 },
  linha: { width: "100%" },
  gap: { marginTop: 10 },
  row: { flexDirection: "row", gap: 10, width: "100%" },
  col1: { flex: 1, minWidth: 0 },
  col2: { flex: 2, minWidth: 0 },
  ufCurta: { width: 70 },
});

export default EnderecoForm;
