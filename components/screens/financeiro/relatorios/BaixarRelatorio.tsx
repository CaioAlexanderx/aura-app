// ============================================================
// AURA. — Financeiro › Relatórios: "Baixar PDF" e "Baixar planilha" (p-116)
//
// Os dois arquivos levam todas as linhas do filtro: pede a mesma rota com
// todas=1 (até 5.000; acima disso avisa na tela e no arquivo). jsPDF e o
// autotable chegam por import() só no clique — o Metro web os separa num
// chunk próprio, fora do bundle de entrada. A SheetJS já está no bundle (a
// importação de planilhas usa) e vem por require, como no "Vendas por
// produto e numeração".
// No celular os botões quebram linha; enquanto gera, o botão fica
// desabilitado com "Gerando…".
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { request } from "@/services/api";
import { queryString, type EstadoRelatorio, type RespostaRelatorio } from "@/utils/relatorioProdutos";
import {
  queryDoArquivo, montarDadosDoArquivo, nomeDoArquivo, AVISO_TRUNCADO, type Empresa,
} from "@/utils/relatorioArquivo";
import { gerarPdf, carregarImagem, paraDataUrlNoNavegador, type GerarPdfDeps } from "@/utils/relatorioPdf";
import { montarPlanilha } from "@/utils/relatorioXlsx";

export var MSG_ERRO_ARQUIVO = "Não conseguimos gerar o arquivo agora. Tente de novo em instantes.";

/** jsPDF + autotable, carregados só aqui (chunk separado no export web). */
export async function carregarBibliotecaDoPdf(): Promise<GerarPdfDeps> {
  // @ts-ignore TS1323: o module do tsconfig base do Expo não aceita import(); o Metro aceita e separa o chunk.
  var m1: any = await import("jspdf");
  // @ts-ignore idem
  var m2: any = await import("jspdf-autotable");
  return { jsPDF: m1.jsPDF || m1.default, autoTable: m2.autoTable || m2.default };
}

type Props = {
  companyId: string | null | undefined;
  estado: EstadoRelatorio;
  faixa: { de: string; ate: string } | null;
  podeVerCusto: boolean;
  consolidado: boolean;
  empresa: Empresa;
  emitidoPor: string;
  nomeDaCategoria?: string | null;
  hoje: string;
  /** Testes: troca a biblioteca do PDF e da planilha. */
  bibliotecas?: { pdf?: () => Promise<GerarPdfDeps>; xlsx?: () => any };
};

type Tipo = "pdf" | "xlsx";

export function BaixarRelatorio(p: Props) {
  var [gerando, setGerando] = useState<Tipo | null>(null);
  var [erro, setErro] = useState<string | null>(null);
  var [aviso, setAviso] = useState<string | null>(null);

  async function baixar(tipo: Tipo) {
    if (gerando || !p.faixa || !p.companyId) return;
    if (Platform.OS !== "web") { setErro("Os arquivos baixam no navegador. Abra a Aura no computador ou no navegador do celular."); return; }
    setErro(null); setAviso(null); setGerando(tipo);
    try {
      var qs = queryString(queryDoArquivo(p.estado, { de: p.faixa.de, ate: p.faixa.ate, consolidado: p.consolidado, podeVerCusto: p.podeVerCusto }));
      var resposta = await request<RespostaRelatorio>("/companies/" + p.companyId + "/relatorios/produtos?" + qs, { retry: 1, timeout: 45000 });
      var dados = montarDadosDoArquivo({
        estado: p.estado, resposta: resposta, podeVerCusto: p.podeVerCusto, consolidado: p.consolidado,
        empresa: p.empresa, emitidoPor: p.emitidoPor, nomeDaCategoria: p.nomeDaCategoria,
      });
      var nome = nomeDoArquivo(p.estado, p.hoje, tipo);
      if (tipo === "pdf") {
        var lib = await (p.bibliotecas && p.bibliotecas.pdf ? p.bibliotecas.pdf() : carregarBibliotecaDoPdf());
        var deps = { fetch: function(u: string, init?: any) { return fetch(u, init) as any; }, paraDataUrl: paraDataUrlNoNavegador };
        var logos = await Promise.all([
          carregarImagem("/aura-icone-192.png", deps),
          // Plano B: sem logo (ou se ela não carregar), só o nome da empresa.
          carregarImagem(p.empresa.logoUrl, deps),
        ]);
        var doc = gerarPdf(dados, lib, { aura: logos[0], loja: logos[1] });
        doc.save(nome);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        var XLSX: any = p.bibliotecas && p.bibliotecas.xlsx ? p.bibliotecas.xlsx() : require("xlsx");
        XLSX.writeFile(montarPlanilha(XLSX, dados), nome);
      }
      if (dados.truncado) setAviso(AVISO_TRUNCADO + " de " + dados.totalDeLinhas.toLocaleString("pt-BR") + " no arquivo. Para ver todas, aperte um filtro.");
    } catch (e) {
      console.warn("[relatorio-produtos] arquivo", e);
      setErro(MSG_ERRO_ARQUIVO);
    } finally {
      setGerando(null);
    }
  }

  return (
    <View style={{ gap: 8 }} testID="relatorio-baixar">
      <View style={s.linha}>
        <Pressable
          testID="relatorio-baixar-pdf"
          onPress={function() { baixar("pdf"); }}
          disabled={!!gerando || !p.faixa}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!gerando, busy: gerando === "pdf" }}
          style={[s.btn, s.btnP, !!gerando && { opacity: 0.6 }]}
        >
          <Text style={[s.btnTexto, { color: "#fff" }]}>{gerando === "pdf" ? "Gerando o PDF…" : "Baixar PDF"}</Text>
        </Pressable>
        <Pressable
          testID="relatorio-baixar-xlsx"
          onPress={function() { baixar("xlsx"); }}
          disabled={!!gerando || !p.faixa}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!gerando, busy: gerando === "xlsx" }}
          style={[s.btn, !!gerando && { opacity: 0.6 }]}
        >
          <Text style={s.btnTexto}>{gerando === "xlsx" ? "Gerando a planilha…" : "Baixar planilha (.xlsx)"}</Text>
        </Pressable>
      </View>
      {!!aviso && <Text style={s.aviso} testID="relatorio-baixar-aviso">{aviso}</Text>}
      {!!erro && <Text style={s.erro} testID="relatorio-baixar-erro">{erro}</Text>}
    </View>
  );
}

var s = StyleSheet.create({
  linha: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 14, minHeight: 40, justifyContent: "center" },
  btnP: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnTexto: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  aviso: { fontSize: 12.5, color: Colors.amber, fontWeight: "600" },
  erro: { fontSize: 12.5, color: Colors.red },
});
