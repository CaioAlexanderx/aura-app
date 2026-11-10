// ============================================================
// AURA. — Caixa: a trava da venda com frete (09/11/2026, parte 2)
//
// Mockup aprovado pelo Caio em 09/11/2026 ("Entrega no Caixa", D e E).
// Aberto por "Finalizar venda" ANTES do pagamento (usePdvState.handleFinalize
// → utils/entregaDaVenda.precisaPedirEntrega):
//   - pedido "endereco": o cliente da venda não tem endereço. "Para onde vai
//     a entrega?" — o endereço vai para o cadastro e para a venda;
//   - pedido "quem": venda sem cliente. "Quem recebe a entrega?" — primeiro
//     a busca (a pessoa pode já ser cliente); se não for, nome, telefone e
//     endereço viram um cadastro novo, já vinculado à venda.
// Para cadastrar: nome, CEP ou rua, número e cidade. "Voltar" fecha e o
// carrinho fica como estava (o que foi digitado volta no rascunho).
//
// 10/11/2026 (incidente, decisão do Caio): identificar é OPCIONAL. Embaixo
// dos botões, "Seguir sem identificar" (pedido "quem") ou "Seguir sem
// endereço" (pedido "endereco") leva ao pagamento com o frete cobrado e
// sem entrega vinculada (usePdvState.dispensarEntrega).
//
// RN Web: filho de coluna usa width: "100%". Em menos de 420 px os botões
// empilham como no celular do mockup.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { maskPhone } from "@/utils/masks";
import { EnderecoForm } from "@/components/endereco/EnderecoForm";
import {
  ENDERECO_VAZIO, erroDoEndereco, resumoDoEndereco,
  type Endereco, type EnderecoDoCepComIbge,
} from "@/components/endereco/endereco";
import {
  faltandoNaEntrega, textoDoQueFalta, type EntregaDaVenda, type PedidoDeEntrega,
} from "@/utils/entregaDaVenda";

export type ClienteDaEntrega = {
  id: string;
  name: string;
  phone?: string | null;
  endereco?: Endereco;
  hasAddress?: boolean;
};

type Props = {
  /** null = fechado. */
  pedido: PedidoDeEntrega | null;
  /** Cliente da venda (pedido "endereco"). */
  cliente: ClienteDaEntrega | null;
  /** Para a busca do "Quem recebe". Vazio = sem busca (loja sem Clientes). */
  clientes: ClienteDaEntrega[];
  rascunho: EntregaDaVenda | null;
  onVoltar: (rascunho: EntregaDaVenda | null) => void;
  /** `cliente` vem quando a pessoa foi escolhida na busca. */
  onConfirmar: (entrega: EntregaDaVenda, cliente?: ClienteDaEntrega | null) => void;
  /** 10/11/2026: seguir para o pagamento sem identificar / sem endereço.
   *  `cliente` vem quando a pessoa foi escolhida na busca (fica na venda). */
  onSeguirSem?: (cliente?: ClienteDaEntrega | null) => void;
  /** Injetável para teste (padrão: ViaCEP). */
  buscarCep?: (cep8: string) => Promise<EnderecoDoCepComIbge | null>;
};

const sem = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function EntregaModal({ pedido, cliente, clientes, rascunho, onVoltar, onConfirmar, onSeguirSem, buscarCep }: Props) {
  const [escolhido, setEscolhido] = useState<ClienteDaEntrega | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState<Endereco>({ ...ENDERECO_VAZIO });
  const [recado, setRecado] = useState("");
  const [busca, setBusca] = useState("");
  const [mostrarErros, setMostrarErros] = useState(false);
  const [estreito, setEstreito] = useState(false);

  // Abre limpo, ou com o rascunho do mesmo contexto ("Voltar" não perde nada).
  useEffect(() => {
    if (!pedido) return;
    const mesmo = rascunho && (pedido === "quem"
      ? rascunho.novoCliente
      : !rascunho.novoCliente && rascunho.customerId === (cliente?.id || null));
    setEscolhido(null);
    setBusca("");
    setMostrarErros(false);
    setNome(mesmo ? rascunho!.nome : "");
    setTelefone(mesmo ? rascunho!.telefone : "");
    setEndereco(mesmo ? { ...rascunho!.endereco } : { ...ENDERECO_VAZIO });
    setRecado(mesmo ? rascunho!.recado : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  // "endereco" para o cliente da venda OU para quem foi escolhido na busca.
  const alvo = escolhido || (pedido === "endereco" ? cliente : null);
  const modo: PedidoDeEntrega = alvo ? "endereco" : "quem";

  const achados = useMemo(() => {
    const q = sem(busca);
    if (q.length < 2) return [];
    const dig = busca.replace(/\D/g, "");
    return clientes.filter((c) =>
      sem(c.name).includes(q) || (dig.length >= 3 && String(c.phone || "").replace(/\D/g, "").includes(dig)),
    ).slice(0, 5);
  }, [busca, clientes]);

  if (!pedido) return null;

  const falta = faltandoNaEntrega(endereco, { pedeNome: modo === "quem", nome });
  const erroFormato = erroDoEndereco(endereco);

  function montar(): EntregaDaVenda {
    if (alvo) {
      return {
        customerId: alvo.id, nome: alvo.name, telefone: String(alvo.phone || ""),
        endereco, recado: recado.trim(), novoCliente: false,
      };
    }
    return {
      customerId: null, nome: nome.trim(), telefone, endereco, recado: recado.trim(), novoCliente: true,
    };
  }

  function confirmar() {
    if (falta.length || erroFormato) { setMostrarErros(true); return; }
    onConfirmar(montar(), escolhido);
  }

  function escolher(c: ClienteDaEntrega) {
    if (c.hasAddress && c.endereco) {
      onConfirmar({
        customerId: c.id, nome: c.name, telefone: String(c.phone || ""),
        endereco: c.endereco, recado: recado.trim(), novoCliente: false,
      }, c);
      return;
    }
    setEscolhido(c);
    setEndereco({ ...ENDERECO_VAZIO });
    setMostrarErros(false);
  }

  const titulo = modo === "endereco" ? "Para onde vai a entrega?" : "Quem recebe a entrega?";
  const sub = modo === "endereco"
    ? `${alvo!.name} ainda não tem endereço. Se preencher, ele fica guardado no cadastro para as próximas entregas. Não é obrigatório: dá para seguir sem endereço.`
    : "Identificar quem recebe ajuda na entrega e já deixa o cadastro pronto. Se a pessoa já for cliente, é só procurar. Não é obrigatório: dá para seguir sem identificar.";
  const rotuloPri = modo === "endereco" ? "Salvar e continuar" : "Cadastrar e continuar";
  const rotuloSem = modo === "endereco" ? "Seguir sem endereço" : "Seguir sem identificar";

  const botaoVoltar = (
    <Pressable
      onPress={() => onVoltar(montar())}
      style={[s.btnSec, estreito && s.btnGhost]}
      testID="entrega-voltar"
      accessibilityRole="button"
    >
      <Text style={s.btnSecTxt}>Voltar</Text>
    </Pressable>
  );
  const botaoPri = (
    <Pressable onPress={confirmar} style={[s.btnPri, estreito && s.btnFull]} testID="entrega-confirmar" accessibilityRole="button">
      <Text style={s.btnPriTxt}>{rotuloPri}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onVoltar(montar())}>
      <View style={s.scrim}>
        <View
          style={s.card}
          testID="entrega-modal"
          onLayout={(e) => setEstreito(e.nativeEvent.layout.width < 420)}
        >
          <ScrollView style={{ width: "100%" }} contentContainerStyle={{ paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
            <View style={s.head}>
              <View style={s.ico}><Icon name="truck" size={16} color={Colors.violet3} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.title} testID="entrega-titulo">{titulo}</Text>
                <Text style={s.sub}>{sub}</Text>
              </View>
            </View>

            {modo === "quem" && clientes.length > 0 && (
              <View style={{ width: "100%" }}>
                <TextInput
                  value={busca}
                  onChangeText={setBusca}
                  placeholder="Procurar cliente por nome ou telefone"
                  placeholderTextColor={Colors.ink3}
                  style={s.input as any}
                  testID="entrega-busca"
                  accessibilityLabel="Procurar cliente por nome ou telefone"
                />
                {achados.map((c) => (
                  <Pressable key={c.id} onPress={() => escolher(c)} style={s.achado} testID={`entrega-cliente-${c.id}`} accessibilityRole="button">
                    <View style={s.av}><Text style={s.avTxt}>{(c.name || "?").slice(0, 1).toUpperCase()}</Text></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.achadoNome} numberOfLines={1}>{c.name}</Text>
                      <Text style={s.achadoMeta} numberOfLines={1}>
                        {[c.phone ? maskPhone(String(c.phone)) : "", c.hasAddress ? resumoDoEndereco(c.endereco) : ""].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Text style={[s.pill, c.hasAddress ? s.pillOk : s.pillNo]}>{c.hasAddress ? "com endereço" : "sem endereço"}</Text>
                  </Pressable>
                ))}
                {busca.trim().length >= 2 && achados.length === 0 && (
                  <Text style={s.hint} testID="entrega-busca-vazia">Ninguém com esse nome ou telefone. Cadastre abaixo.</Text>
                )}
                <View style={s.div} />
                <Text style={s.label}>Ou cadastre agora</Text>
              </View>
            )}

            {modo === "quem" && (
              <View style={[s.linha, estreito && s.coluna]}>
                <TextInput
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Nome de quem recebe"
                  placeholderTextColor={Colors.ink3}
                  style={[s.input as any, s.flex, estreito && s.cheio, mostrarErros && !nome.trim() && s.inputErro]}
                  testID="entrega-nome"
                  accessibilityLabel="Nome de quem recebe"
                  maxLength={120}
                />
                <TextInput
                  value={telefone}
                  onChangeText={(v) => setTelefone(maskPhone(v))}
                  placeholder="Telefone"
                  placeholderTextColor={Colors.ink3}
                  keyboardType="phone-pad"
                  style={[s.input as any, s.flex, estreito && s.cheio]}
                  testID="entrega-telefone"
                  accessibilityLabel="Telefone de quem recebe"
                />
              </View>
            )}
            {modo === "quem" && (
              <Text style={s.hint}>O telefone salva a entrega quando ninguém atende o portão.</Text>
            )}

            {modo === "endereco" && escolhido && (
              <Pressable onPress={() => setEscolhido(null)} style={s.trocar} testID="entrega-trocar" accessibilityRole="button">
                <Text style={s.trocarTxt}>Não é essa pessoa? Procurar de novo</Text>
              </Pressable>
            )}

            <View style={{ width: "100%", marginTop: 10 }}>
              <EnderecoForm
                value={endereco}
                onChange={setEndereco}
                modo="obrigatorio"
                mostrarErros={mostrarErros}
                autoFocusCep={modo === "endereco"}
                buscarCep={buscarCep}
                testID="entrega-endereco"
                placeholderReferencia="Ponto de referência (ex.: portão azul)"
              />
            </View>

            <Text style={s.label}>Recado para a entrega (opcional)</Text>
            <TextInput
              value={recado}
              onChangeText={setRecado}
              placeholder="Ex.: entregar depois das 14h, interfone 32"
              placeholderTextColor={Colors.ink3}
              style={s.input as any}
              testID="entrega-recado"
              accessibilityLabel="Recado para a entrega"
              maxLength={300}
            />

            {mostrarErros && (falta.length > 0 || erroFormato) && (
              <Text style={s.erro} testID="entrega-falta">
                {erroFormato || `Falta ${textoDoQueFalta(falta)} para levar a entrega.`}
              </Text>
            )}

            {estreito ? (
              <View style={s.footCol}>{botaoPri}{botaoVoltar}</View>
            ) : (
              <View style={s.foot}>{botaoVoltar}{botaoPri}</View>
            )}

            {onSeguirSem && (
              <Pressable
                onPress={() => onSeguirSem(escolhido)}
                style={s.seguirSem}
                testID="entrega-seguir-sem"
                accessibilityRole="button"
              >
                <Text style={s.seguirSemTxt}>{rotuloSem}</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(10,8,30,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 520, maxHeight: "92%", backgroundColor: Colors.bg3, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  ico: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 3, lineHeight: 17 },
  label: { fontSize: 11.5, fontWeight: "700", color: Colors.ink3, marginTop: 14, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 },
  input: { width: "100%", minHeight: 44, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg2 },
  inputErro: { borderColor: Colors.red },
  linha: { flexDirection: "row", gap: 10, width: "100%" },
  coluna: { flexDirection: "column" },
  flex: { flex: 1, width: "auto" as any },
  cheio: { width: "100%", flex: 0 as any },
  hint: { fontSize: 12, color: Colors.ink3, marginTop: 6 },
  erro: { fontSize: 12.5, color: Colors.red, fontWeight: "600", marginTop: 10 },
  div: { height: 1, backgroundColor: Colors.border, width: "100%", marginTop: 12 },
  achado: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 8, minHeight: 48, borderBottomWidth: 1, borderBottomColor: Colors.border, width: "100%" },
  av: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  avTxt: { color: Colors.violet3, fontWeight: "800", fontSize: 13 },
  achadoNome: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  achadoMeta: { fontSize: 12, color: Colors.ink3 },
  pill: { fontSize: 11, fontWeight: "700", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  pillOk: { color: Colors.green, backgroundColor: Colors.greenD },
  pillNo: { color: Colors.amber, backgroundColor: Colors.amberD },
  trocar: { marginTop: 4, paddingVertical: 6 },
  trocarTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  foot: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 },
  footCol: { width: "100%", gap: 8, marginTop: 16 },
  btnSec: { minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, alignItems: "center" },
  btnGhost: { borderWidth: 0, width: "100%" },
  btnSecTxt: { color: Colors.violet3, fontWeight: "700", fontSize: 13 },
  btnPri: { minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderRadius: 10, backgroundColor: Colors.violet, minWidth: 160, alignItems: "center" },
  btnFull: { width: "100%" },
  btnPriTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  seguirSem: { width: "100%", minHeight: 44, marginTop: 6, alignItems: "center", justifyContent: "center" },
  seguirSemTxt: { fontSize: 13, color: Colors.ink3, fontWeight: "700", textDecorationLine: "underline" },
});

export default EntregaModal;
