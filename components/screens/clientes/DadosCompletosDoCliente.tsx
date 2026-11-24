// ============================================================
// AURA. — Bloco "Dados completos" do cadastro do cliente (ótica)
//
// 23/11/2026. Só existe com a ótica ligada: AddCustomerForm recebe
// `dadosCompletos` de quem o abre e, sem ele, não monta nada daqui — o
// formulário das outras lojas fica exatamente como era.
//
// CPF: máscara e dígito verificador, opcional. RG, sexo e profissão só
// aparecem quando o servidor avisou que os aceita (`camposExtras`); ver
// utils/clienteDadosCompletos.ts e docs/otica-cadastro-completo-backend.md.
//
// Mockup: docs/mockups/otica-cadastro-e-receita.html, tela 1.
//
// 24/11/2026: a lista de clientes manda CPF e RG mascarados. Enquanto o
// documento inteiro não chega (hooks/useDocumentosDoCliente.ts), o campo
// fica SÓ LEITURA (`travas`): a máscara nunca vira valor editável. Se não
// der para buscar, continua só leitura com "Digitar de novo".
// ============================================================
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { SEXOS, erroDoCpf, formatarDocumento, type CampoExtra } from "@/utils/clienteDadosCompletos";

export type DadosCompletos = { cpf: string; rg: string; gender: string; occupation: string };
/** Por que o documento está só leitura: chegando do servidor, ou não deu para buscar. */
export type TravaDoDocumento = "carregando" | "falhou";
export type CampoDeDocumento = "cpf" | "rg";

type Props = {
  value: DadosCompletos;
  onChange: (next: DadosCompletos) => void;
  camposExtras: CampoExtra[];
  /** Uma coluna (celular) ou duas. */
  largo: boolean;
  /** CPF/RG só leitura, com a máscara da lista (ver o topo do arquivo). */
  travas?: Partial<Record<CampoDeDocumento, TravaDoDocumento>>;
  /** "Digitar de novo" quando não deu para buscar o documento inteiro. */
  onRedigitar?: (campo: CampoDeDocumento) => void;
};

/** Documento só leitura: a máscara da lista, nunca num campo de texto. */
function DocumentoTravado({ testID, valor, trava, onRedigitar }: { testID: string; valor: string; trava: TravaDoDocumento; onRedigitar?: () => void }) {
  return (
    <View>
      <View style={[s.input, s.inputTravado]} testID={`${testID}-travado`} accessibilityState={{ disabled: true }}>
        <Text style={s.travadoTxt}>{valor || "—"}</Text>
      </View>
      {trava === "carregando" ? (
        <Text style={s.dica} testID={`${testID}-carregando`}>Abrindo o documento completo…</Text>
      ) : (
        <>
          <Text style={s.dica} testID={`${testID}-falhou`}>Não deu para abrir o documento completo agora. Ele continua guardado como está; para trocar, digite de novo.</Text>
          {onRedigitar && (
            <Pressable onPress={onRedigitar} accessibilityRole="button" testID={`${testID}-redigitar`} style={s.redigitar}>
              <Text style={s.redigitarTxt}>Digitar de novo</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

export function DadosCompletosDoCliente({ value, onChange, camposExtras, largo, travas, onRedigitar }: Props) {
  const set = (patch: Partial<DadosCompletos>) => onChange({ ...value, ...patch });
  const erro = erroDoCpf(value.cpf);
  const completo = value.cpf.replace(/\D/g, "").length >= 11;
  const tem = (c: CampoExtra) => camposExtras.includes(c);

  return (
    <View style={s.bloco} testID="cliente-dados-completos">
      <Text style={s.titulo}>Dados completos</Text>
      <Text style={s.sub}>Para a ficha e a receita impressa. Ficam só no cadastro: não aparecem na lista de clientes nem em mensagem.</Text>

      <View style={[s.linha, !largo && s.coluna]}>
        <View style={s.campo}>
          <Text style={s.label}>CPF</Text>
          {travas?.cpf ? (
            <DocumentoTravado testID="cliente-cpf" valor={formatarDocumento(value.cpf)} trava={travas.cpf} onRedigitar={onRedigitar ? () => onRedigitar("cpf") : undefined} />
          ) : (<>
          <TextInput
            style={[s.input, completo && !!erro && s.inputErro]}
            value={formatarDocumento(value.cpf)}
            onChangeText={(v) => set({ cpf: v.replace(/\D/g, "").slice(0, 14) })}
            placeholder="000.000.000-00"
            placeholderTextColor={Colors.ink3}
            keyboardType="numeric"
            inputMode="numeric"
            maxLength={18}
            testID="cliente-cpf"
          />
          {/* Erro só com o número inteiro digitado: no meio da digitação é ruído. */}
          {completo && !!erro && <Text style={s.erro} testID="cliente-cpf-erro">{erro}</Text>}
          {completo && !erro && <Text style={s.ok} testID="cliente-cpf-ok">{value.cpf.replace(/\D/g, "").length === 14 ? "CNPJ conferido" : "CPF conferido"}</Text>}
          </>)}
        </View>
        {tem("rg") && (
          <View style={s.campo}>
            <Text style={s.label}>RG</Text>
            {travas?.rg ? (
              <DocumentoTravado testID="cliente-rg" valor={value.rg} trava={travas.rg} onRedigitar={onRedigitar ? () => onRedigitar("rg") : undefined} />
            ) : (
              <TextInput style={s.input} value={value.rg} onChangeText={(v) => set({ rg: v.slice(0, 20) })} placeholder="00.000.000-0" placeholderTextColor={Colors.ink3} testID="cliente-rg" />
            )}
          </View>
        )}
      </View>

      {(tem("gender") || tem("occupation")) && (
        <View style={[s.linha, !largo && s.coluna, { marginTop: 14 }]}>
          {tem("gender") && (
            <View style={s.campo}>
              <Text style={s.label}>Sexo</Text>
              <View style={s.chips}>
                {SEXOS.map((x) => {
                  const on = value.gender === x.key;
                  return (
                    <Pressable
                      key={x.key}
                      // Tocar de novo no escolhido limpa: o campo é opcional.
                      onPress={() => set({ gender: on ? "" : x.key })}
                      style={[s.chip, on && s.chipOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      testID={`cliente-sexo-${x.key}`}
                    >
                      <Text style={[s.chipTxt, on && s.chipTxtOn]}>{x.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          {tem("occupation") && (
            <View style={s.campo}>
              <Text style={s.label}>Profissão</Text>
              <TextInput style={s.input} value={value.occupation} onChangeText={(v) => set({ occupation: v.slice(0, 80) })} placeholder="Ex: professora, motorista" placeholderTextColor={Colors.ink3} testID="cliente-profissao" />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bloco: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.violetD, borderRadius: 14, padding: 14, marginBottom: 16 },
  titulo: { fontFamily: Fonts.body, fontSize: 13, color: Colors.ink, fontWeight: "700" },
  sub: { fontFamily: Fonts.body, fontSize: 12, color: Colors.ink3, marginTop: 2, marginBottom: 12, lineHeight: 17 },
  linha: { flexDirection: "row", gap: 12 },
  coluna: { flexDirection: "column", gap: 14 },
  campo: { flex: 1, minWidth: 0 },
  label: { fontFamily: Fonts.body, fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  input: { fontFamily: Fonts.body, backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  inputErro: { borderColor: Colors.red },
  inputTravado: { backgroundColor: Colors.bg2, borderStyle: "dashed" },
  travadoTxt: { fontFamily: Fonts.body, fontSize: 13, color: Colors.ink3 },
  dica: { fontFamily: Fonts.body, color: Colors.ink3, fontSize: 12, marginTop: 4, lineHeight: 17 },
  redigitar: { alignSelf: "flex-start", marginTop: 4, paddingVertical: 4 },
  redigitarTxt: { fontFamily: Fonts.body, color: Colors.violet3, fontSize: 12, fontWeight: "700" },
  erro: { fontFamily: Fonts.body, color: Colors.red, fontSize: 12, marginTop: 4 },
  ok: { fontFamily: Fonts.body, color: Colors.green, fontSize: 12, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipTxt: { fontFamily: Fonts.body, fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTxtOn: { color: Colors.violet3 },
});
