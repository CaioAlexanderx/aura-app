// ============================================================
// AURA. — Vendas › Condicionais › Nova condicional (C6, 26/11/2026)
//
// Mockup aprovado (condicional/mockup.html, fluxo "Nova condicional"). Passos:
//   0. (só no consolidado) "De qual loja as peças vão sair?";
//   1. Cliente: busca, "+ Novo cliente" (nome e telefone obrigatórios);
//   2. Peças: bipe ou busca, cor e tamanho, uma unidade por linha;
//   3. Prazo e conferência e 4. Pronto: C7.
//
// Wizard no padrão TrocaModal (CLAUDE.md, armadilha 5): ver ./Casca.
// Guardar não é venda: nada entra em Financeiro, Caixa nem comissão.
//
// Multi-CNPJ: a condicional é de UMA loja. Em loja única, a ativa; no
// consolidado, a escolhida no passo 0. A cliente é do dono (vale no grupo).
//
// Como ligar o botão "Nova condicional" (C5): ver ./useNovaCondicional.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { lerVendaSemEstoque } from "@/utils/vendaSemEstoque";
import { fmtBRL } from "../../../pdv/troca/types";
import { Casca, e } from "./Casca";
import { TEXTOS_DA_NOVA as T } from "./textos";
import { EscolhaDaLoja } from "./EscolhaDaLoja";
import { PassoCliente } from "./PassoCliente";
import { PassoPecas } from "./PassoPecas";
import { NovoClienteCondicional, telefoneDaCondicionalValido } from "./NovoClienteCondicional";
import { usePecasDaLoja } from "./usePecasDaLoja";
import { totalDasPecas, type ClienteDaCondicional, type PecaDaCondicional } from "./busca";
import { type CondicionalGuardada, type FaltaDaCondicional } from "./api";
import { PassosDoFim, useGuardarCondicional, type EstadoDaNova } from "./PassosDoFim";

export type NovaCondicionalProps = {
  visible: boolean;
  onClose: () => void;
  /** O servidor guardou: a lista recarrega. */
  onCriada: (condicional: CondicionalGuardada) => void;
  /** "Ver a C-0029" no aviso de peça sem unidade livre (liga na lista/detalhe). */
  onVerCondicional?: (condicionalId: string) => void;
  /** Para os testes: o "hoje" de São Paulo. */
  hoje?: string;
};

export function NovaCondicionalModal({ visible, onClose, onCriada, onVerCondicional, hoje }: NovaCondicionalProps) {
  const auth = useAuthStore() as any;
  const lojasDoGrupo: any[] = Array.isArray(auth.availableCompanies) ? auth.availableCompanies : [];
  const consolidado = !auth.company?.id && lojasDoGrupo.length > 0;

  const [passo, setPasso] = useState<0 | 1 | 2 | 3 | 4>(1);
  const [lojaId, setLojaId] = useState<string | null>(null);
  const [cliente, setCliente] = useState<ClienteDaCondicional | null>(null);
  const [telefoneAvulso, setTelefoneAvulso] = useState("");
  const [tentouContinuar, setTentouContinuar] = useState(false);
  const [novoCliente, setNovoCliente] = useState<{ busca: string } | null>(null);
  const [pecas, setPecas] = useState<PecaDaCondicional[]>([]);
  const [faltas, setFaltas] = useState<FaltaDaCondicional[] | null>(null);

  const lojaAtiva = consolidado ? lojaId : (auth.company?.id as string | undefined) || null;
  const { settings } = usePdvSettings(lojaAtiva);
  const vendeSemEstoque = lerVendaSemEstoque(settings);
  const { produtos, carregando, variantesDe } = usePecasDaLoja(lojaAtiva, visible && passo >= 1);

  // Abriu: recomeça do zero.
  const abertoAntes = useRef(false);
  useEffect(() => {
    if (visible && !abertoAntes.current) {
      setPasso(consolidado ? 0 : 1);
      setLojaId(null);
      setCliente(null);
      setTelefoneAvulso("");
      setTentouContinuar(false);
      setNovoCliente(null);
      setPecas([]);
      setFaltas(null);
    }
    abertoAntes.current = visible;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const estado: EstadoDaNova = {
    lojaId: lojaAtiva, cliente, telefoneAvulso, pecas, faltas, hoje,
  };
  const guardar = useGuardarCondicional(estado, { onCriada });
  const ocupado = guardar.enviando;

  function fechar() {
    if (ocupado) return;
    onClose();
  }

  if (!visible) return null;

  const total = totalDasPecas(pecas);
  const telefoneOk = !!cliente && (!!cliente.phone || telefoneDaCondicionalValido(telefoneAvulso));

  // ── Passo 0: loja (consolidado) ─────────────────────────────────────
  if (passo === 0) {
    return (
      <Casca titulo={T.titulo} passo={0} onFechar={fechar}
        corpo={<EscolhaDaLoja lojas={lojasDoGrupo} onEscolher={(id) => { setLojaId(id); setPasso(1); }} />} />
    );
  }

  // ── Pronto (C7) ─────────────────────────────────────────────────────
  if (passo === 4 && guardar.guardada) {
    return <PassosDoFim.Pronto guardada={guardar.guardada} onNova={() => { setPasso(consolidado ? 0 : 1); setLojaId(null); setCliente(null); setPecas([]); setFaltas(null); guardar.recomecar(); }} onVerNaLista={onClose} onFechar={onClose} />;
  }

  // ── Rodapé ──────────────────────────────────────────────────────────
  const Info = ({ children, testID }: { children: string; testID?: string }) => (
    <Text style={e.footerInfo} numberOfLines={2} testID={testID || "nova-rodape-info"}>{children}</Text>
  );

  let rodape: JSX.Element;
  if (passo === 1) {
    const podeSeguir = !!cliente;
    rodape = (
      <>
        <Info>{!cliente ? T.rodapeSemCliente : !telefoneOk && tentouContinuar ? T.rodapeSemTelefone : T.rodapeCliente(cliente.name)}</Info>
        <View style={e.footerActions}>
          <Pressable style={e.btnSec} onPress={fechar} testID="nova-cancelar" accessibilityRole="button"><Text style={e.btnSecTxt}>{T.cancelar}</Text></Pressable>
          <Pressable style={[e.btnPri, !podeSeguir && e.desligado]} disabled={!podeSeguir} testID="nova-continuar" accessibilityRole="button"
            onPress={() => { if (!telefoneOk) { setTentouContinuar(true); return; } setPasso(2); }}>
            <Text style={e.btnPriTxt}>{T.continuar}</Text><Icon name="arrow_right" size={14} color="#fff" />
          </Pressable>
        </View>
      </>
    );
  } else if (passo === 2) {
    const podeSeguir = pecas.length > 0 && !faltas?.length;
    rodape = (
      <>
        <Info>{pecas.length ? `${T.pecas(pecas.length)} · ${fmtBRL(total)}` : T.nenhumaPeca}</Info>
        <View style={e.footerActions}>
          <Pressable style={e.btnSec} onPress={() => setPasso(1)} testID="nova-voltar" accessibilityRole="button"><Icon name="arrow_left" size={14} color={Colors.ink} /><Text style={e.btnSecTxt}>{T.voltar}</Text></Pressable>
          <Pressable style={[e.btnPri, !podeSeguir && e.desligado]} disabled={!podeSeguir} testID="nova-continuar" accessibilityRole="button" onPress={() => setPasso(3)}>
            <Text style={e.btnPriTxt}>{T.continuar}</Text><Icon name="arrow_right" size={14} color="#fff" />
          </Pressable>
        </View>
      </>
    );
  } else {
    rodape = (
      <PassosDoFim.RodapeDoPasso3 estado={estado} guardar={guardar} total={total}
        onVoltar={() => setPasso(2)} onGuardada={() => setPasso(4)} onFaltas={(f) => { setFaltas(f); setPasso(2); }} />
    );
  }

  // ── Resumo roxo ─────────────────────────────────────────────────────
  const trilho = (
    <View testID="nova-resumo">
      <Text style={e.credRot}>{T.resumo}</Text>
      <View style={e.rLinha}><Text style={e.rRot}>{T.rCliente}</Text><Text style={e.rVal}>{cliente ? cliente.name : T.rAEscolher}</Text></View>
      <View style={e.rLinha}><Text style={e.rRot}>{T.rPecas}</Text><Text style={e.rVal}>{pecas.length ? T.pecas(pecas.length) : T.rNenhuma}</Text></View>
      <PassosDoFim.LinhasDoResumo estado={estado} />
      <View style={[e.rLinha, e.rTot]}><Text style={e.rRot}>{T.rTotal}</Text><Text style={e.rTotVal} testID="nova-resumo-total">{fmtBRL(total)}</Text></View>
      <View style={e.rNota}><Icon name="tag" size={14} color="#ddd6fe" /><Text style={e.rNotaTxt}>{T.notaNadaCobrado}</Text></View>
    </View>
  );

  const miolo = passo === 1 && novoCliente && lojaAtiva ? (
    <NovoClienteCondicional
      companyId={lojaAtiva}
      busca={novoCliente.busca}
      onCancelar={() => setNovoCliente(null)}
      onPronto={(c) => { setCliente(c); setTelefoneAvulso(""); setNovoCliente(null); }}
    />
  ) : undefined;

  return (
    <Casca
      titulo={T.titulo}
      passo={passo}
      miolo={miolo}
      trilho={trilho}
      rodape={miolo ? undefined : rodape}
      onFechar={fechar}
      corpo={
        passo === 1 ? (
          <PassoCliente
            cliente={cliente}
            onEscolher={(c) => { setCliente(c); setTelefoneAvulso(""); setTentouContinuar(false); }}
            onNovoCliente={(busca) => setNovoCliente({ busca })}
            telefoneAvulso={telefoneAvulso}
            onTelefoneAvulso={setTelefoneAvulso}
            erroTelefone={tentouContinuar && !telefoneOk}
          />
        ) : passo === 2 ? (
          <PassoPecas
            produtos={produtos}
            carregando={carregando}
            variantesDe={variantesDe}
            pecas={pecas}
            onAdicionar={(p) => { setPecas((l) => [...l, p]); setFaltas(null); }}
            onTirar={(chave) => { setPecas((l) => l.filter((x) => x.chave !== chave)); setFaltas(null); }}
            vendeSemEstoque={vendeSemEstoque}
            faltas={faltas}
            onVerCondicional={onVerCondicional}
          />
        ) : (
          <PassosDoFim.Passo3 estado={estado} guardar={guardar} />
        )
      }
    />
  );
}

export default NovaCondicionalModal;
