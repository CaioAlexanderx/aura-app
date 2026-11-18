// ============================================================
// AURA. — Troca · "+ Novo cliente" dentro do passo (p-167, 17/11/2026)
//
// Mockup "Caixa e Troca", Parte 4. Padrão TrocaModal (CLAUDE.md, armadilha
// 5): troca o miolo do passo, sem segundo modal empilhado. O TrocaModal
// esconde o passo (continua montado, com os itens e escolhas no lugar),
// mantém a barra de passos e põe este formulário com o rodapé "Cancelar /
// Salvar cliente".
//
// Mesma regra e mesma rota do cadastro rápido do Caixa:
// validarCadastroRapido (só o nome é obrigatório) e
// POST /companies/:id/customers, na loja ativa da troca. O cliente é do
// dono: aparece em todas as lojas do grupo.
//
// Cliente parecido (acharClienteRepetido, sobre todas as listas
// ['customers', ...] em cache): aviso âmbar com "Usar este" e "Criar outro
// mesmo assim". Compara telefone ou nome sem acento e sem maiúscula.
// ============================================================
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { companiesApi } from "@/services/api";
import { maskPhone } from "@/utils/masks";
import { erroDoTelefone, TELEFONE_MAX_CARACTERES } from "@/utils/telefone";
import { validarCadastroRapido, nomeValido } from "@/utils/cadastroRapidoCliente";
import { acharClienteRepetido } from "@/utils/clienteRepetido";
import { TEXTOS_DO_CLIENTE, type TextosDoCliente } from "./textosDoCliente";
import type { ClienteDoCredito } from "./clienteDoCredito";
import { fmtBRL } from "./types";

type Parecido = ClienteDoCredito & { por: "nome" | "telefone" };

type Props = {
  /** Loja ativa da troca (onde o cadastro nasce). */
  companyId: string;
  /** Valor que vai como crédito, para o texto de apoio. */
  valorDoCredito: number;
  /** O que a pessoa digitou na busca: vira nome ou telefone. */
  busca: string;
  onCancelar: () => void;
  /** criado = true quando o cliente acabou de ser cadastrado; false quando
   *  a vendedora escolheu um parecido que já existia. */
  onPronto: (c: ClienteDoCredito, criado: boolean) => void;
  /** 17/11/2026 (Novo pedido, A2): as palavras do pedido. Ausente = as da troca. */
  textos?: Partial<TextosDoCliente>;
};

const soDigitos = (v: string) => String(v || "").replace(/\D/g, "");

/** A busca digitada vira o campo certo: com número, telefone; senão, nome. */
export function camposDaBusca(busca: string): { nome: string; tel: string } {
  const b = String(busca || "").trim();
  if (/\d/.test(b)) return { nome: "", tel: maskPhone(b) };
  return { nome: b, tel: "" };
}

export function NovoClienteNaTroca({ companyId, valorDoCredito, busca, onCancelar, onPronto, textos }: Props) {
  const T: TextosDoCliente = textos ? { ...TEXTOS_DO_CLIENTE, ...textos } : TEXTOS_DO_CLIENTE;
  const qc = useQueryClient();
  const inicial = camposDaBusca(busca);
  const [nome, setNome] = useState(inicial.nome);
  const [tel, setTel] = useState(inicial.tel);
  const [parecido, setParecido] = useState<Parecido | null>(null);
  const [salvando, setSalvando] = useState(false);

  const podeSalvar = nomeValido(nome) && !salvando;
  const erroTel = erroDoTelefone(tel);

  function acharParecido(): Parecido | null {
    const listas = qc.getQueriesData<any>({ queryKey: ["customers"] }).map(([, data]) => data);
    const dup = acharClienteRepetido(listas, nome, tel);
    if (!dup) return null;
    const d = soDigitos(tel);
    const por = d.length >= 10 && soDigitos(dup.phone) === d ? "telefone" : "nome";
    return { id: dup.id, name: dup.name, phone: dup.phone || null, por };
  }

  async function criar() {
    const v = validarCadastroRapido({ name: nome, birthDate: "", phone: tel });
    if (!v.ok) { toast.error(v.erro); return; }
    setSalvando(true);
    try {
      const res: any = await companiesApi.createCustomer(companyId, { ...v.body, source: "pdv" });
      qc.invalidateQueries({ queryKey: ["customers"] });
      const id = res?.id || res?.customer?.id;
      if (!id) { toast.error(T.erroAoSalvar); return; }
      onPronto({
        id,
        name: res?.name || res?.customer?.name || v.body.name,
        phone: res?.phone || res?.customer?.phone || v.body.phone || null,
      }, true);
    } catch (e: any) {
      toast.error(e?.message || T.erroAoSalvar);
    } finally {
      setSalvando(false);
    }
  }

  async function salvar() {
    if (!podeSalvar) return;
    const v = validarCadastroRapido({ name: nome, birthDate: "", phone: tel });
    if (!v.ok) { toast.error(v.erro); return; }
    const dup = acharParecido();
    if (dup) { setParecido(dup); return; }
    await criar();
  }

  return (
    <>
      <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled" testID="troca-novo-cliente">
        <Pressable onPress={onCancelar} style={s.voltar} testID="troca-novo-cliente-voltar" accessibilityRole="button">
          <Icon name="arrow_left" size={14} color={Colors.violet3} />
          <Text style={s.voltarTxt}>{T.voltarParaTroca}</Text>
        </Pressable>
        <Text style={s.titulo}>{T.novoClienteTitulo}</Text>
        <Text style={s.intro}>{T.novoClienteIntro(fmtBRL(valorDoCredito))}</Text>

        <View style={s.campo}>
          <View style={s.rotuloLinha}>
            <Text style={s.rotulo}>{T.campoNome}</Text>
            <Text style={[s.chip, s.chipObrig]}>{T.obrigatorio}</Text>
          </View>
          <TextInput
            testID="troca-novo-cliente-nome"
            value={nome}
            onChangeText={(v) => { setNome(v); setParecido(null); }}
            placeholder={T.campoNomePlaceholder}
            placeholderTextColor={Colors.ink3}
            autoFocus={!inicial.tel}
            autoCapitalize="words"
            style={s.input}
          />
        </View>

        <View style={s.campo}>
          <View style={s.rotuloLinha}>
            <Text style={s.rotulo}>{T.campoTelefone}</Text>
            <Text style={[s.chip, s.chipRec]}>{T.recomendado}</Text>
          </View>
          <TextInput
            testID="troca-novo-cliente-tel"
            value={tel}
            onChangeText={(v) => { setTel(maskPhone(v)); setParecido(null); }}
            placeholder="(12) 99999-0000"
            placeholderTextColor={Colors.ink3}
            keyboardType="phone-pad"
            maxLength={TELEFONE_MAX_CARACTERES}
            autoFocus={!!inicial.tel}
            style={s.input}
          />
          {erroTel ? (
            <Text style={s.erro} testID="troca-novo-cliente-tel-erro">{erroTel}</Text>
          ) : (
            <Text style={s.dica}>{T.campoTelefoneDica}</Text>
          )}
        </View>

        {parecido && (
          <View style={s.dup} testID="troca-novo-cliente-parecido" accessibilityRole="alert">
            <View style={s.dupLinha}>
              <Icon name="alert" size={15} color={Colors.amber} />
              <Text style={s.dupTxt}>
                {T.parecido(parecido.por)} <Text style={s.dupNome}>{parecido.name}</Text>
                {parecido.phone ? ` · ${parecido.phone}` : ""}. {T.usarEstePergunta}
              </Text>
            </View>
            <View style={s.dupAcoes}>
              <Pressable
                testID="troca-novo-cliente-usar-este"
                onPress={() => onPronto({ id: parecido.id, name: parecido.name, phone: parecido.phone }, false)}
                style={[s.dupBtn, s.dupUsar]}
                accessibilityRole="button"
              >
                <Text style={s.dupUsarTxt}>{T.usarEste}</Text>
              </Pressable>
              <Pressable
                testID="troca-novo-cliente-criar-mesmo"
                onPress={() => { setParecido(null); criar(); }}
                disabled={salvando}
                style={[s.dupBtn, s.dupCriar]}
                accessibilityRole="button"
              >
                <Text style={s.dupCriarTxt}>{T.criarMesmoAssim}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        <Text style={s.footerInfo} numberOfLines={2}>{T.rodapeNovoCliente}</Text>
        <View style={s.footerActions}>
          <Pressable style={s.btnSec} onPress={onCancelar} testID="troca-novo-cliente-cancelar" accessibilityRole="button">
            <Text style={s.btnSecTxt}>{T.cancelar}</Text>
          </Pressable>
          <Pressable
            style={[s.btnPri, !podeSalvar && { opacity: 0.45 }]}
            onPress={podeSalvar ? salvar : undefined}
            disabled={!podeSalvar}
            testID="troca-novo-cliente-salvar"
            accessibilityRole="button"
          >
            {salvando
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.btnPriTxt}>{T.salvarCliente}</Text>}
          </Pressable>
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  // Mesmas medidas do corpo e do rodapé do TrocaModal.
  body: { flex: 1 },
  bodyContent: { padding: 22, paddingBottom: 8, maxWidth: 520 },
  voltar: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    minHeight: 36, paddingRight: 10, marginBottom: 4,
  },
  voltarTxt: { color: Colors.violet3, fontSize: 13, fontWeight: "600" },
  titulo: { color: Colors.ink, fontSize: 18, fontWeight: "700" },
  intro: { color: Colors.ink2, fontSize: 13, marginTop: 2, marginBottom: 14, lineHeight: 19 },
  campo: { marginBottom: 12 },
  rotuloLinha: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  rotulo: { color: Colors.ink2, fontSize: 12, fontWeight: "600" },
  chip: { fontSize: 11, fontWeight: "600", paddingHorizontal: 7, paddingVertical: 1, borderRadius: 99, overflow: "hidden" },
  chipObrig: { backgroundColor: Colors.violetD, color: Colors.violet3 },
  chipRec: { backgroundColor: "rgba(255,255,255,0.06)", color: Colors.ink3 },
  input: {
    minHeight: 46, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border2, backgroundColor: "rgba(0,0,0,0.12)",
    color: Colors.ink, fontSize: 14,
  },
  dica: { color: Colors.ink3, fontSize: 12, marginTop: 5, lineHeight: 17 },
  erro: { color: Colors.red, fontSize: 12, marginTop: 5 },
  dup: {
    backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber,
    borderRadius: 12, padding: 12, gap: 10, marginBottom: 8,
  },
  dupLinha: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dupTxt: { flex: 1, color: Colors.ink, fontSize: 13, lineHeight: 19 },
  dupNome: { fontWeight: "700" },
  dupAcoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dupBtn: { flexGrow: 1, flexBasis: 140, minHeight: 44, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  dupUsar: { backgroundColor: Colors.violet },
  dupUsarTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  dupCriar: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: "rgba(255,255,255,0.04)" },
  dupCriarTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  footer: {
    paddingHorizontal: 22, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)",
    backgroundColor: "rgba(0,0,0,0.18)",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
    flexWrap: "wrap",
  },
  footerInfo: { flex: 1, minWidth: 160, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  footerActions: { flexDirection: "row", gap: 8, flexShrink: 0 },
  btnSec: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10, minHeight: 42, justifyContent: "center",
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "500" },
  btnPri: {
    backgroundColor: Colors.violet,
    paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, minHeight: 42, minWidth: 132,
    alignItems: "center", justifyContent: "center",
  },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
});

export default NovoClienteNaTroca;
