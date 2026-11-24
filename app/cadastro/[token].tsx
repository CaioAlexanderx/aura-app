// ============================================================
// AURA. · Página pública /cadastro/[token]  (p-210, 23/11/2026)
//
// O cliente da loja recebeu um link no WhatsApp e preenche o próprio
// cadastro no celular (mockup aprovado: otica-pacote/mockup-cadastro-link.html,
// seção 5). Quem abre NÃO tem conta: a rota é pública em app/_layout.tsx
// (segments[0] === "cadastro") e as chamadas vão sem token nenhum.
//
// O QUE ESTA PÁGINA NÃO FAZ (a lista importa mais que a dos campos):
//   - Não mostra dado já cadastrado. O link pode ter sido encaminhado:
//     quem abre vê só o nome e o logo da loja e um formulário vazio.
//   - Não pede receita nem dado de saúde.
//   - Não deixa enviar sem o aviso de privacidade. O texto é do Caio e fica
//     em utils/cadastroPorLink.ts (AVISO_DE_PRIVACIDADE); enquanto ele for
//     null, o aceite não aparece e o botão não liga.
//
// Uma coluna, mobile primeiro, paleta clara fixa (não depende do tema do
// lojista), como a de /acompanhar.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Image, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Fonts } from "@/constants/fonts";
import { cadastroLinkApi, type LojaDoLink } from "@/services/cadastroLinkApi";
import { buscarCep } from "@/components/endereco/endereco";
import {
  AVISO_DE_PRIVACIDADE, VERSAO_DO_AVISO, avisoPronto, FORMULARIO_VAZIO, mascaras,
  errosDoFormulario, corpoDoEnvio, podeEnviar,
  type FormularioDoCadastro, type ErrosDoFormulario,
} from "@/utils/cadastroPorLink";

// Paleta do mockup (seção 5): branca, violeta da Aura como destaque.
const C = {
  bg: "#F3F1FA",
  card: "#FFFFFF",
  ink: "#18172B",
  ink2: "#3B3461",
  ink3: "#6A608E",
  line: "#E5E3EF",
  inBorder: "#CFCBE3",
  inBg: "#FAF9FF",
  accent: "#7C3AED",
  erro: "#B42318",
};

type Fase = "carregando" | "aberto" | "enviando" | "recebido" | "indisponivel" | "falhou";

type Props = { aviso?: string | null; versao?: string };

export default function CadastroPorLinkPage({ aviso = AVISO_DE_PRIVACIDADE, versao = VERSAO_DO_AVISO }: Props = {}) {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [fase, setFase] = useState<Fase>("carregando");
  const [loja, setLoja] = useState<LojaDoLink | null>(null);
  const [form, setForm] = useState<FormularioDoCadastro>(FORMULARIO_VAZIO);
  const [tocados, setTocados] = useState<Partial<Record<keyof FormularioDoCadastro, boolean>>>({});
  const [errosDoServidor, setErrosDoServidor] = useState<ErrosDoFormulario>({});
  const [aceite, setAceite] = useState(false);
  const [aviso429, setAviso429] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<"" | "buscando" | "nao_achou" | "falhou">("");
  const ultimoCep = useRef("");

  useEffect(() => {
    if (!token) return;
    cadastroLinkApi
      .lojaDoLink(String(token))
      .then((r) => { setLoja(r.store); setFase("aberto"); })
      .catch((e: any) => {
        if (e?.data?.store) setLoja(e.data.store);
        setFase(e?.status === 410 ? "indisponivel" : "falhou");
      });
  }, [token]);

  const erros = errosDoFormulario(form);
  const comAviso = avisoPronto(aviso);
  const liberado = fase === "aberto" && podeEnviar(form, aceite, aviso);

  function mudar<K extends keyof FormularioDoCadastro>(k: K, v: string) {
    const mascara = (mascaras as Record<string, (s: string) => string>)[k];
    const valor = mascara ? mascara(v) : v;
    setForm((f) => ({ ...f, [k]: valor }));
    if (errosDoServidor[k]) setErrosDoServidor((e) => ({ ...e, [k]: undefined }));
    if (k === "zip_code") aoMudarCep(valor);
  }

  async function aoMudarCep(cep: string) {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8 || d === ultimoCep.current) return;
    ultimoCep.current = d;
    setCepStatus("buscando");
    try {
      const e = await buscarCep(d);
      if (!e) { setCepStatus("nao_achou"); return; }
      setForm((f) => ({
        ...f,
        street: f.street || e.rua,
        neighborhood: f.neighborhood || e.bairro,
        city: e.cidade,
        state: e.uf,
      }));
      setCepStatus("");
    } catch {
      setCepStatus("falhou");
    }
  }

  async function enviar() {
    if (!liberado || !token) return;
    setFase("enviando");
    setAviso429(null);
    try {
      const r = await cadastroLinkApi.enviar(String(token), corpoDoEnvio(form, versao));
      if (r?.store?.name) setLoja((l) => ({ name: r.store.name, logo_url: l?.logo_url ?? null }));
      setFase("recebido");
    } catch (e: any) {
      if (e?.status === 410) { setFase("indisponivel"); return; }
      setFase("aberto");
      if (e?.status === 429) { setAviso429("Muitas tentativas. Espere alguns minutos e tente de novo."); return; }
      const campo = e?.data?.field === "cpf" ? "cpf" : e?.data?.field;
      if (campo && campo in FORMULARIO_VAZIO) {
        setErrosDoServidor({ [campo]: e.data.error || "Confira este campo." });
        setTocados((t) => ({ ...t, [campo]: true }));
      } else {
        setAviso429(e?.data?.error || "Não deu para enviar agora. Tente de novo em instantes.");
      }
    }
  }

  const erroDe = (k: keyof FormularioDoCadastro) => errosDoServidor[k] || (tocados[k] ? erros[k] : undefined);
  const tocar = (k: keyof FormularioDoCadastro) => () => setTocados((t) => ({ ...t, [k]: true }));

  if (fase === "carregando") {
    return <View style={[s.tela, s.centro]}><ActivityIndicator color={C.accent} /></View>;
  }

  return (
    <ScrollView style={s.tela} contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
      <View style={s.cartao}>
        <Topo loja={loja} />

        {fase === "recebido" && (
          <View style={s.fim} testID="cadastro-recebido">
            <Text style={s.titulo}>Recebemos o seu cadastro.</Text>
            <Text style={s.nota}>Obrigado! {loja?.name ? `A ${loja.name}` : "A loja"} já tem seus dados. Pode fechar esta página.</Text>
          </View>
        )}

        {(fase === "indisponivel" || fase === "falhou") && (
          <View style={s.fim} testID="cadastro-indisponivel">
            <Text style={[s.titulo, { fontSize: 22 }]}>
              {fase === "indisponivel" ? "Este link já foi usado ou venceu." : "Não deu para abrir o cadastro."}
            </Text>
            <Text style={s.nota}>
              {fase === "indisponivel" ? "Peça um novo link à loja. Nenhum dado seu aparece aqui." : "Confira a internet e abra o link de novo."}
            </Text>
          </View>
        )}

        {(fase === "aberto" || fase === "enviando") && (
          <View testID="cadastro-formulario">
            <Text style={s.titulo}>Seu cadastro</Text>

            <Campo rotulo="Nome completo" valor={form.name} onChange={(v) => mudar("name", v)} onBlur={tocar("name")} erro={erroDe("name")}
              autoComplete="name" id="cadastro-nome" />
            <Campo rotulo="Data de nascimento" valor={form.birth_date} onChange={(v) => mudar("birth_date", v)} onBlur={tocar("birth_date")} erro={erroDe("birth_date")}
              placeholder="dd/mm/aaaa" teclado="numeric" autoComplete="birthdate-full" id="cadastro-nascimento" />
            <Campo rotulo="CPF" valor={form.cpf} onChange={(v) => mudar("cpf", v)} onBlur={tocar("cpf")} erro={erroDe("cpf")}
              placeholder="000.000.000-00" teclado="numeric" id="cadastro-cpf" />
            <Campo rotulo="CEP" valor={form.zip_code} onChange={(v) => mudar("zip_code", v)} onBlur={tocar("zip_code")} erro={erroDe("zip_code")}
              placeholder="00000-000" teclado="numeric" autoComplete="postal-code" id="cadastro-cep"
              dica={cepStatus === "buscando" ? "Buscando o endereço…" : cepStatus === "nao_achou" ? "Não achamos este CEP. Escreva o endereço abaixo." : cepStatus === "falhou" ? "Não deu para buscar o CEP. Escreva o endereço abaixo." : undefined} />
            <Campo rotulo="Endereço" sub="(preenchido pelo CEP)" valor={form.street} onChange={(v) => mudar("street", v)} erro={erroDe("street")}
              placeholder="Rua" autoComplete="address-line1" id="cadastro-rua" />
            <View style={s.linha}>
              <View style={{ flex: 1 }}>
                <Campo rotulo="Número" valor={form.number} onChange={(v) => mudar("number", v)} erro={erroDe("number")} id="cadastro-numero" />
              </View>
              <View style={{ flex: 2 }}>
                <Campo rotulo="Complemento" valor={form.complement} onChange={(v) => mudar("complement", v)} erro={erroDe("complement")} id="cadastro-complemento" />
              </View>
            </View>
            <Campo rotulo="Bairro" valor={form.neighborhood} onChange={(v) => mudar("neighborhood", v)} erro={erroDe("neighborhood")} id="cadastro-bairro" />
            <View style={s.linha}>
              <View style={{ flex: 3 }}>
                <Campo rotulo="Cidade" valor={form.city} onChange={(v) => mudar("city", v)} erro={erroDe("city")} id="cadastro-cidade" />
              </View>
              <View style={{ flex: 1 }}>
                <Campo rotulo="UF" valor={form.state} onChange={(v) => mudar("state", v)} onBlur={tocar("state")} erro={erroDe("state")} id="cadastro-uf" />
              </View>
            </View>
            <Campo rotulo="Telefone" valor={form.phone} onChange={(v) => mudar("phone", v)} onBlur={tocar("phone")} erro={erroDe("phone")}
              placeholder="(00) 90000-0000" teclado="phone-pad" autoComplete="tel" id="cadastro-telefone" />
            <Campo rotulo="E-mail" valor={form.email} onChange={(v) => mudar("email", v)} onBlur={tocar("email")} erro={erroDe("email")}
              teclado="email-address" autoComplete="email" id="cadastro-email" />

            {comAviso ? (
              <Pressable onPress={() => setAceite((a) => !a)} style={s.aceite} accessibilityRole="checkbox" accessibilityState={{ checked: aceite }} testID="cadastro-aceite">
                <View style={[s.caixa, aceite && s.caixaMarcada]}>{aceite && <Text style={s.visto}>✓</Text>}</View>
                <Text style={s.aceiteTexto}>{aviso}</Text>
              </Pressable>
            ) : (
              <Text style={s.semAviso} testID="cadastro-sem-aviso">O envio ainda não está disponível. Fale com a loja.</Text>
            )}

            {aviso429 && <Text style={s.erroGeral}>{aviso429}</Text>}

            <Pressable
              onPress={enviar}
              disabled={!liberado}
              style={[s.botao, !liberado && s.botaoDesligado]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !liberado }}
              testID="cadastro-enviar"
            >
              {fase === "enviando" ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTexto}>Enviar cadastro</Text>}
            </Pressable>
            <Text style={s.nota}>Esta página só recebe os dados; não mostra nada que já esteja cadastrado.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Topo({ loja }: { loja: LojaDoLink | null }) {
  const nome = loja?.name || "";
  return (
    <View style={s.topo}>
      {loja?.logo_url ? (
        <Image source={{ uri: loja.logo_url }} style={s.logo} resizeMode="contain" accessibilityLabel={nome ? `Logo da ${nome}` : "Logo da loja"} />
      ) : nome ? (
        <View style={[s.logo, s.logoVazio]}><Text style={s.logoLetra}>{nome.trim().charAt(0).toUpperCase()}</Text></View>
      ) : null}
      {!!nome && <Text style={s.nomeDaLoja} numberOfLines={2}>{nome}</Text>}
    </View>
  );
}

function Campo({
  rotulo, sub, valor, onChange, onBlur, erro, dica, placeholder, teclado, autoComplete, id: testID,
}: {
  rotulo: string; sub?: string; valor: string; onChange: (v: string) => void; onBlur?: () => void;
  erro?: string; dica?: string; placeholder?: string; teclado?: any; autoComplete?: any; id?: string;
}) {
  return (
    <View style={s.campo}>
      <Text style={s.rotulo}>{rotulo}{sub ? <Text style={s.sub}> {sub}</Text> : null}</Text>
      <TextInput
        style={[s.input, !!erro && s.inputErro]}
        value={valor}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#A29BC0"
        keyboardType={teclado}
        autoComplete={autoComplete}
        testID={testID}
      />
      {erro ? <Text style={s.erro} testID={testID ? `${testID}-erro` : undefined}>{erro}</Text> : dica ? <Text style={s.dica}>{dica}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: C.bg },
  centro: { alignItems: "center", justifyContent: "center" },
  conteudo: { paddingHorizontal: 16, paddingVertical: 24, alignItems: "center" },
  cartao: {
    width: "100%", maxWidth: 440, backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 22,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 22, shadowOffset: { width: 0, height: 6 },
  },
  topo: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line, minHeight: 36 },
  logo: { width: 40, height: 40, borderRadius: 8 },
  logoVazio: { backgroundColor: "rgba(124,58,237,0.10)", alignItems: "center", justifyContent: "center" },
  logoLetra: { fontSize: 18, fontWeight: "700", color: C.accent },
  nomeDaLoja: { flex: 1, fontSize: 15, fontWeight: "700", color: C.ink, fontFamily: Fonts.body },
  titulo: { fontFamily: Fonts.heading, fontSize: 26, lineHeight: 30, color: C.ink, marginTop: 16, marginBottom: 10 },
  fim: { alignItems: "center", paddingVertical: 18 },
  campo: { marginBottom: 11 },
  linha: { flexDirection: "row", gap: 10 },
  rotulo: { fontSize: 12, fontWeight: "600", color: C.ink2, marginBottom: 5, fontFamily: Fonts.body },
  sub: { fontWeight: "400", color: C.ink3 },
  input: { borderWidth: 1, borderColor: C.inBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, backgroundColor: C.inBg, color: C.ink, fontFamily: Fonts.body },
  inputErro: { borderColor: C.erro },
  erro: { fontSize: 12, color: C.erro, marginTop: 4, fontFamily: Fonts.body },
  dica: { fontSize: 12, color: C.ink3, marginTop: 4, fontFamily: Fonts.body },
  aceite: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 8, marginBottom: 14 },
  caixa: { width: 20, height: 20, borderWidth: 1.5, borderColor: C.accent, borderRadius: 5, marginTop: 1, alignItems: "center", justifyContent: "center" },
  caixaMarcada: { backgroundColor: C.accent },
  visto: { color: "#fff", fontSize: 13, fontWeight: "800", lineHeight: 15 },
  aceiteTexto: { flex: 1, fontSize: 13, color: C.ink2, lineHeight: 19, fontFamily: Fonts.body },
  semAviso: { fontSize: 13, color: C.ink3, lineHeight: 19, marginTop: 8, marginBottom: 14, fontFamily: Fonts.body },
  erroGeral: { fontSize: 13, color: C.erro, marginBottom: 10, fontFamily: Fonts.body },
  botao: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center", minHeight: 50, justifyContent: "center" },
  botaoDesligado: { opacity: 0.45 },
  botaoTexto: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: Fonts.body },
  nota: { fontSize: 13, color: C.ink3, lineHeight: 19, marginTop: 10, textAlign: "center", fontFamily: Fonts.body },
});
