// ============================================================
// AURA. — "Chegou mercadoria" · Passo 2: de onde vêm os itens (A3)
//
// Mockup estoque-portas-mockup-17-11.html, parte 4 ("Passo 2 · De onde vêm
// os itens" e "Passo 2 · A nota é de outro CNPJ") e os estados (arquivo
// errado, nota repetida, lendo).
//
// Três origens num passo: nota (XML), planilha e digitar. Aqui só a nota
// funciona; a planilha é o A6 e o digitar é o A5 (os botões ficam
// desligados até lá, e o wizard não tem porta até o A8).
//
// Avisos:
//   - arquivo errado (PDF ou XML que não é nota);
//   - nota de outro CNPJ: pergunta sempre, nunca troca sozinho (pendência 2);
//   - nota repetida (B3), com "Seguir mesmo assim".
// Quem decide e guarda as respostas é o shell; aqui só há tela.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { TEXTOS_CHEGOU as T } from "./textosChegou";
import type { NotaLida } from "./lerNota";
import {
  cnpjComMascara, diaMesLocal, horaMinuto,
  type EscolhaDoFornecedor, type FornecedorDaLista, type EntradaAnterior,
} from "./chegouRegras";

export type PerguntaDoCnpj = { atual: EscolhaDoFornecedor; achado: FornecedorDaLista | null };

type Props = {
  estreito: boolean;
  nota: NotaLida | null;
  arquivoErrado: boolean;
  lendoNota: boolean;
  /** Pergunta da nota de outro CNPJ, ainda sem resposta. */
  pergunta: PerguntaDoCnpj | null;
  /** Entrada anterior desta nota, ainda sem "Seguir mesmo assim". */
  anterior: EntradaAnterior | null;
  onNota: () => void;
  onUsarAchado: (f: FornecedorDaLista) => void;
  onCadastrarEmitente: () => void;
  onManter: () => void;
  onSeguirMesmoAssim: () => void;
  /** A6: a planilha lida, ou a que não deu para ler. */
  planilha?: { nome: string; itens: number } | null;
  planilhaIlegivel?: boolean;
  /** A6 (planilha) e A5 (digitar): sem a prop, o botão fica desligado. */
  onPlanilha?: () => void;
  onBaixarModelo?: () => void;
  onDigitar?: () => void;
  /**
   * F2: veio de "Importar a lista deste fornecedor" (Fornecedores). O cartão
   * da planilha chega marcado, com "Escolher planilha" como botão principal
   * e a dica do modo só ligar.
   */
  destaquePlanilha?: { dica: string } | null;
};

export function Passo2Origem(p: Props) {
  const [verAnterior, setVerAnterior] = useState(false);
  const { nota } = p;

  if (p.lendoNota) {
    return (
      <View style={s.lendo} testID="chegou-lendo-nota">
        <ActivityIndicator size="small" color={Colors.violet3} />
        <Text style={s.lendoTitulo}>{T.lendoTitulo}</Text>
        <Text style={s.apoio}>{T.lendoTexto}</Text>
      </View>
    );
  }

  const avisoArquivo = p.arquivoErrado ? (
    <View style={[s.aviso, s.avisoVermelho]} testID="chegou-arquivo-errado">
      <Icon name="alert" size={16} color={Colors.red} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={s.avisoTitulo}>{T.arquivoErradoTitulo}</Text>
        <Text style={s.apoio}>{T.arquivoErradoTexto}</Text>
        <View style={s.acoes}>
          <Pressable onPress={p.onNota} style={s.btnSec} accessibilityRole="button" testID="chegou-outro-arquivo">
            <Text style={s.btnSecTxt}>{T.escolherOutroArquivo}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  ) : null;

  if (p.planilha) {
    return (
      <View style={{ gap: 12 }} testID="chegou-passo-2">
        <View style={s.notaLida} testID="chegou-planilha-lida">
          <Icon name="grid" size={16} color={Colors.green} />
          <Text style={s.notaLidaTxt}>{T.planilhaLida(p.planilha.nome, p.planilha.itens)}</Text>
          <Pressable onPress={p.onPlanilha} style={s.btnSec} accessibilityRole="button" testID="chegou-outra-planilha">
            <Text style={s.btnSecTxt}>{T.escolherOutroArquivo}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (nota && !p.arquivoErrado) {
    const emitente = nota.emitente.nome || cnpjComMascara(nota.emitente.cnpj) || "?";
    const detalhe = T.outroCnpjDetalhe(cnpjComMascara(nota.emitente.cnpj) || "—", nota.numero || "—", nota.itens.length);
    const pg = p.pergunta;
    const atualNome = pg && pg.atual && pg.atual.tipo === "existente" ? pg.atual.fornecedor.name : null;
    return (
      <View style={{ gap: 12 }} testID="chegou-passo-2">
        <View style={s.notaLida} testID="chegou-nota-lida">
          <Icon name="file_text" size={16} color={Colors.green} />
          <Text style={s.notaLidaTxt}>{T.notaLida(nota.numero || "—", emitente, nota.itens.length)}</Text>
          <Pressable onPress={p.onNota} style={s.btnSec} accessibilityRole="button" testID="chegou-outro-arquivo">
            <Text style={s.btnSecTxt}>{T.escolherOutroArquivo}</Text>
          </Pressable>
        </View>

        {pg ? (
          <View style={[s.aviso, s.avisoAmbar]} testID="chegou-outro-cnpj">
            <Icon name="alert_circle" size={16} color={Colors.amber} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={s.avisoTitulo}>
                {atualNome ? T.outroCnpjTitulo(emitente, atualNome) : T.semFornecedorLigar(emitente)}
              </Text>
              <Text style={s.apoio}>{detalhe}</Text>
              <View style={s.acoes}>
                {pg.achado ? (
                  <Pressable onPress={() => p.onUsarAchado(pg.achado!)} style={s.btnPri} accessibilityRole="button" testID="chegou-usar-emitente">
                    <Text style={s.btnPriTxt}>{T.usarEmitente(pg.achado.name)}</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={p.onCadastrarEmitente} style={s.btnPri} accessibilityRole="button" testID="chegou-cadastrar-emitente">
                    <Text style={s.btnPriTxt}>{T.cadastrarEmitente(emitente)}</Text>
                  </Pressable>
                )}
                <Pressable onPress={p.onManter} style={s.btnSec} accessibilityRole="button" testID="chegou-manter-fornecedor">
                  <Text style={s.btnSecTxt}>{atualNome ? T.manterFornecedor(atualNome) : T.semTitulo}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : p.anterior ? (
          <View style={[s.aviso, s.avisoAmbar]} testID="chegou-nota-repetida">
            <Icon name="alert_circle" size={16} color={Colors.amber} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={s.avisoTitulo}>
                {T.repetidaTitulo(nota.numero || "—", p.anterior.fornecedor, diaMesLocal(p.anterior.quando) || "—")}
              </Text>
              <Text style={s.apoio}>{T.repetidaTexto}</Text>
              {verAnterior ? (
                <Text style={s.apoio} testID="chegou-nota-repetida-detalhe">
                  {T.repetidaDetalhe(diaMesLocal(p.anterior.quando) || "—", horaMinuto(p.anterior.quando) || "—", p.anterior.itens)}
                </Text>
              ) : null}
              <View style={s.acoes}>
                {!verAnterior && (
                  <Pressable onPress={() => setVerAnterior(true)} style={s.btnSec} accessibilityRole="button" testID="chegou-ver-entrada">
                    <Text style={s.btnSecTxt}>{T.repetidaVer}</Text>
                  </Pressable>
                )}
                <Pressable onPress={p.onSeguirMesmoAssim} style={s.btnPri} accessibilityRole="button" testID="chegou-seguir-mesmo-assim">
                  <Text style={s.btnPriTxt}>{T.repetidaSeguir}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  // Sem nota: as três origens.
  const cartao = (
    id: string, icone: string, cor: string, titulo: string, apoio: string, formato: string,
    botoes: Array<{ id: string; rotulo: string; onPress?: () => void; principal?: boolean }>,
    marcado?: { dica: string } | null,
  ) => (
    <View
      key={id}
      style={[s.origem, p.estreito && s.origemEstreita, marcado ? s.origemMarcada : null]}
      testID={"chegou-origem-" + id}
      accessibilityState={marcado ? { selected: true } : undefined}
    >
      <View style={[s.origemIco, { backgroundColor: cor }]}><Icon name={icone as any} size={18} color="#fff" /></View>
      <Text style={s.origemTitulo}>{titulo}</Text>
      <Text style={s.apoio}>{apoio}</Text>
      <Text style={s.formato}>{formato}</Text>
      {marcado ? <Text style={s.dica} testID={"chegou-origem-" + id + "-dica"}>{marcado.dica}</Text> : null}
      <View style={s.acoes}>
        {botoes.map((b) => (
          <Pressable
            key={b.id}
            onPress={b.onPress}
            disabled={!b.onPress}
            style={[b.principal ? s.btnPri : s.btnSec, !b.onPress && { opacity: 0.45 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !b.onPress }}
            testID={"chegou-" + b.id}
          >
            <Text style={b.principal ? s.btnPriTxt : s.btnSecTxt}>{b.rotulo}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const avisoPlanilha = p.planilhaIlegivel ? (
    <View style={[s.aviso, s.avisoVermelho]} testID="chegou-planilha-ilegivel">
      <Icon name="alert" size={16} color={Colors.red} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={s.avisoTitulo}>{T.planilhaIlegivelTitulo}</Text>
        <Text style={s.apoio}>{T.planilhaIlegivelTexto}</Text>
        <View style={s.acoes}>
          <Pressable onPress={p.onPlanilha} style={s.btnSec} accessibilityRole="button" testID="chegou-planilha-de-novo">
            <Text style={s.btnSecTxt}>{T.escolherDeNovo}</Text>
          </Pressable>
          {p.onBaixarModelo ? (
            <Pressable onPress={p.onBaixarModelo} style={s.btnSec} accessibilityRole="button" testID="chegou-planilha-modelo-aviso">
              <Text style={s.btnSecTxt}>{T.origemPlanilhaModelo}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  ) : null;

  return (
    <View style={{ gap: 12 }} testID="chegou-passo-2">
      {avisoArquivo}
      {avisoPlanilha}
      <Text style={s.pergunta}>{T.pergunta2}</Text>
      <View style={[s.origens, p.estreito && { flexDirection: "column" }]}>
        {cartao("nota", "file_text", Colors.violet, T.origemNotaTitulo, T.origemNotaApoio, T.origemNotaFormato, [
          { id: "origem-nota-botao", rotulo: T.origemNotaBotao, onPress: p.onNota, principal: !p.destaquePlanilha },
        ])}
        {cartao("planilha", "grid", "#059669", T.origemPlanilhaTitulo, T.origemPlanilhaApoio, T.origemPlanilhaFormato, [
          { id: "origem-planilha-botao", rotulo: T.origemPlanilhaBotao, onPress: p.onPlanilha, principal: !!p.destaquePlanilha },
          { id: "origem-planilha-modelo", rotulo: T.origemPlanilhaModelo, onPress: p.onBaixarModelo },
        ], p.destaquePlanilha)}
        {cartao("digitar", "edit", "#2563eb", T.origemDigitarTitulo, T.origemDigitarApoio, T.origemDigitarFormato, [
          { id: "origem-digitar-botao", rotulo: T.origemDigitarBotao, onPress: p.onDigitar },
        ])}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pergunta: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.ink3 },
  origens: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  origem: { flex: 1, minWidth: 0, gap: 6, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  origemEstreita: { flex: undefined, width: "100%" },
  origemMarcada: { borderColor: "#059669", borderWidth: 2, backgroundColor: Colors.greenD },
  dica: { fontSize: 12, color: Colors.ink2, lineHeight: 17, marginTop: 4, fontWeight: "600" },
  origemIco: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  origemTitulo: { fontSize: 14.5, fontWeight: "700", color: Colors.ink },
  formato: { fontSize: 11.5, fontWeight: "600", color: Colors.ink3, marginTop: 2 },
  apoio: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  btnPri: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Colors.violet },
  btnPriTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnSec: {
    minHeight: 44, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  aviso: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  avisoVermelho: { backgroundColor: Colors.redD, borderColor: Colors.red },
  avisoAmbar: { backgroundColor: Colors.amberD, borderColor: Colors.amber },
  avisoTitulo: { fontSize: 13.5, fontWeight: "700", color: Colors.ink, lineHeight: 19 },
  notaLida: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.green, backgroundColor: Colors.greenD,
  },
  notaLidaTxt: { flex: 1, minWidth: 180, fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  lendo: { alignItems: "center", gap: 8, paddingVertical: 32, paddingHorizontal: 12 },
  lendoTitulo: { fontSize: 15, fontWeight: "700", color: Colors.ink },
});
